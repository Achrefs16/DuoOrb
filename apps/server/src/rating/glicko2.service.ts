export interface GlickoPlayer {
  rating: number; // default 1500
  rd: number;     // rating deviation, default 350
  vol: number;    // volatility, default 0.06
}

export interface MatchResult {
  opponent: GlickoPlayer;
  score: number; // 1.0 = win, 0.5 = draw, 0.0 = loss
}

/**
 * Rating algorithm version stamped on every rating_history row so future
 * tuning can distinguish which formula produced a delta.
 */
export const RATING_ALGORITHM_VERSION = 'G2_UNIFIED_V1';

/**
 * Information weight by table size: a multiplayer result carries less
 * rating information than a direct 1v1. Tuned by simulation (see
 * unified-rating.sim.spec.ts): 2P = full weight, 3P ≈ 75%, 4P ≈ 57%.
 */
export const RATING_INFO_WEIGHT_2P = 1.0;
export const RATING_INFO_WEIGHT_3P = 0.75;
export const RATING_INFO_WEIGHT_4P = 0.575;

export function infoWeightForPlayerCount(count: number): number {
  if (count <= 2) return RATING_INFO_WEIGHT_2P;
  if (count === 3) return RATING_INFO_WEIGHT_3P;
  return RATING_INFO_WEIGHT_4P;
}

export class Glicko2Service {
  private readonly TAU = 0.5; // System constant constraining volatility changes
  private readonly SCALE = 173.7178;

  /**
   * Converts standard Glicko rating to Glicko-2 scale.
   */
  private toGlicko2Scale(player: GlickoPlayer): { mu: number; phi: number; sigma: number } {
    return {
      mu: (player.rating - 1500) / this.SCALE,
      phi: player.rd / this.SCALE,
      sigma: player.vol,
    };
  }

  /**
   * Converts Glicko-2 scale back to standard Glicko rating.
   */
  private toStandardScale(mu: number, phi: number, sigma: number): GlickoPlayer {
    return {
      rating: Math.round(mu * this.SCALE + 1500),
      rd: Math.max(30, Math.round(phi * this.SCALE)),
      vol: Number(sigma.toFixed(6)),
    };
  }

  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  private E(mu: number, mu_j: number, phi_j: number): number {
    return 1 / (1 + Math.exp(-this.g(phi_j) * (mu - mu_j)));
  }

  /**
   * Updates a player's Glicko-2 rating after a rating period / match results.
   *
   * The optional information weight (0 < weight <= 1) scales the result's
   * contribution: v is inflated and the mu step shrunk exactly as if the
   * player had played that fraction of the observations. RD still behaves
   * properly (shrinks less for low-weight results) and volatility uses the
   * same machinery — no second formula, no post-hoc delta scaling.
   * weight = 1 is bit-for-bit the classic Glicko-2 update.
   */
  public updatePlayer(player: GlickoPlayer, results: MatchResult[], weight = 1): GlickoPlayer {
    if (results.length === 0) {
      // If player did not play, only RD increases due to uncertainty
      const { phi, sigma, mu } = this.toGlicko2Scale(player);
      const newPhi = Math.sqrt(phi * phi + sigma * sigma);
      return this.toStandardScale(mu, newPhi, sigma);
    }

    const { mu, phi, sigma } = this.toGlicko2Scale(player);

    // Compute estimated variance v
    let v_inv = 0;
    let delta_sum = 0;

    for (const match of results) {
      const opp = this.toGlicko2Scale(match.opponent);
      const g_phi = this.g(opp.phi);
      const e = this.E(mu, opp.mu, opp.phi);

      v_inv += weight * g_phi * g_phi * e * (1 - e);
      delta_sum += weight * g_phi * (match.score - e);
    }

    const v = 1 / v_inv;
    const delta = v * delta_sum;

    // Compute new volatility sigma' using Illinois algorithm / Newton iteration
    const a = Math.log(sigma * sigma);
    const f = (x: number): number => {
      const ex = Math.exp(x);
      const num1 = ex * (delta * delta - phi * phi - v - ex);
      const den1 = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
      const term2 = (x - a) / (this.TAU * this.TAU);
      return num1 / den1 - term2;
    };

    let A = a;
    let B: number;
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * this.TAU) < 0) {
        k++;
      }
      B = a - k * this.TAU;
    }

    let fA = f(A);
    let fB = f(B);

    while (Math.abs(B - A) > 0.000001) {
      const C = A + ((A - B) * fA) / (fB - fA);
      const fC = f(C);

      if (fC * fB <= 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }

      B = C;
      fB = fC;
    }

    const newSigma = Math.exp(A / 2);

    // Update rating deviation phi'
    const phi_star = Math.sqrt(phi * phi + newSigma * newSigma);
    const newPhi = 1 / Math.sqrt(1 / (phi_star * phi_star) + 1 / v);

    // Update rating mu'
    const newMu = mu + newPhi * newPhi * delta_sum;

    return this.toStandardScale(newMu, newPhi, newSigma);
  }

  /**
   * 1v1 update helper: computes new ratings for both players in a head-to-head match.
   */
  public update1v1(
    p1: GlickoPlayer,
    p2: GlickoPlayer,
    p1Score: 1.0 | 0.5 | 0.0
  ): { p1: GlickoPlayer; p2: GlickoPlayer } {
    const updatedP1 = this.updatePlayer(p1, [{ opponent: p2, score: p1Score }]);
    const updatedP2 = this.updatePlayer(p2, [{ opponent: p1, score: 1.0 - p1Score }]);
    return { p1: updatedP1, p2: updatedP2 };
  }

  /**
   * Multiplayer free-for-all update (3-4 players). Uses the complete
   * placement order: each player is paired virtually against EVERY other
   * player (ahead = win, behind = loss), so beating a 1700 field counts
   * more than beating a 1400 field. The table-size information weight is
   * applied inside the calculation (see updatePlayer), never as a
   * post-hoc multiplier on the final delta.
   *
   * Weight semantics: the WHOLE multiplayer game carries w-times a 1v1's
   * information (3P ≈ 75%, 4P ≈ 57%), spread evenly over the N-1 virtual
   * pairings — so a 3P winner moves ~75% of an equivalent 1v1 win while
   * every opponent's actual rating still shapes the result.
   */
  public updateMultiplayer(
    placements: { player: GlickoPlayer; rank: number }[],
    weight = (placements.length > 1
      ? infoWeightForPlayerCount(placements.length) / (placements.length - 1)
      : 1)
  ): GlickoPlayer[] {
    const updated: GlickoPlayer[] = [];

    for (let i = 0; i < placements.length; i++) {
      const subject = placements[i];
      const matchResults: MatchResult[] = [];

      for (let j = 0; j < placements.length; j++) {
        if (i === j) continue;
        const opponent = placements[j];
        let score = 0.5;
        if (subject.rank < opponent.rank) {
          score = 1.0; // Finished ahead of opponent
        } else if (subject.rank > opponent.rank) {
          score = 0.0; // Finished behind opponent
        }
        matchResults.push({ opponent: opponent.player, score });
      }

      updated.push(this.updatePlayer(subject.player, matchResults, weight));
    }

    return updated;
  }

  /**
   * 4-Player Free-For-All update (legacy alias, full information weight).
   * Prefer updateMultiplayer, which applies the tuned table-size weight.
   */
  public update4Player(
    placements: { player: GlickoPlayer; rank: number }[]
  ): GlickoPlayer[] {
    return this.updateMultiplayer(placements, 1);
  }
}
