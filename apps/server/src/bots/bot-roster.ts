import { BOT_ROSTER } from '@duoorb/game-core';
import { BOT_ID_PREFIX } from './bot-ids.js';

/**
 * Persistent computer-opponent personas.
 *
 * To feel authentic and indistinguishable from real players, the roster
 * features 20 distinct organic naming patterns (6 personas per pattern = 120 bots):
 *   1.  Clean Lowercase Gamer Tag (e.g. vortex, phantom, zenith, cipher, pulse, reaper)
 *   2.  PascalCase Gamer Handle (e.g. ShadowStrike, DarkKnight, SilentBlade, SilverFang)
 *   3.  Esports / Clan / Streamer Prefix (e.g. fn_blitz, ttv_storm, og_killer, pro_ninja)
 *   4.  Anime Character + Digits/Affix (e.g. sasuke99, itachi_7, tanjiro_k, luffy_gear5)
 *   5.  Full Formal Name (e.g. felix.weber, alex_miller, carlos.silva, rahul_sharma)
 *   6.  First Initial + Last Name (e.g. f_weber, a_miller, c_silva, r_sharma)
 *   7.  First Name + Last Initial (compact) (e.g. sarahj, lukasm, mateuso, priyap)
 *   8.  First Name + 4-Digit Birth Year (e.g. jake2003, elias1998, mateus2001, hannah1999)
 *   9.  First Name + 2-Digit Number (e.g. priya02, diego99, kevin97, chloe04)
 *   10. Clean Minimalist First Name (e.g. aarav, sophie, thiago, clara, caleb, kavya)
 *   11. "The", "Real", "Im", "Its" Prefix (e.g. the_real_caleb, im_kevin, official_leo)
 *   12. Two Compound Words (e.g. GhostRider, NightWalker, FireStorm, StormBreaker)
 *   13. ALL-CAPS Competitive Handle (e.g. NOVA, APEX, TITAN, FURY, ZERO, VIPER)
 *   14. Dot-Separated Tech / Gamer Words (e.g. hyper.sonic, cyber.punk, quantum.leap)
 *   15. Humorous / Casual / Meme Names (e.g. potato_lord, chill_guy, sleepy_panda)
 *   16. First Name + Gaming/Content Suffix (e.g. ethan_plays, leo_gaming, bruno_gg)
 *   17. Title / Honorific Style (e.g. sir_marcus, captain_derek, lord_arjun, dr_schmidt)
 *   18. Leetspeak / Number Substitutions (e.g. drag0n, bl1tz, v01d, gh0st, sn1per)
 *   19. Regional / City Shorthand (e.g. lucas_br, felix_de, rahul_delhi, austin_tx)
 *   20. x_Bookends or Double Underscore (e.g. xDragonx, zShadow, void__walker, dark__knight)
 */
export interface BotPersona {
  userId: string;
  username: string;
  displayName: string;
  region: 'de' | 'us' | 'in' | 'br';
  /** Target rating the bot is seeded at and kept near. */
  targetRating: number;
  /** game-core roster bot or native engine preset. */
  engineBotId: string;
  /** Whether this bot leverages the native AlphaZero ONNX engine after opening. */
  useOnnx: boolean;
  /** Plausible career totals for the seeded rating row. */
  gamesPlayed: number;
  wins: number;
}

export const BOT_MIN_RATING = 900;
export const BOT_MAX_RATING = 2100;

interface PersonaSeedDef {
  region: BotPersona['region'];
  username: string;
  displayName: string;
  ratingTier: number; // 0 (weakest ~900) to 1 (strongest ~2100)
  preferOnnx?: boolean;
}

// 120 carefully crafted personas across 20 distinct organic naming patterns (6 personas each)
const SEED_DEFINITIONS: PersonaSeedDef[] = [
  // --- Pattern 1: Clean Lowercase Gamer Tag (6 personas) ---
  { region: 'us', username: 'vortex', displayName: 'Vortex', ratingTier: 0.94, preferOnnx: true },
  { region: 'de', username: 'phantom', displayName: 'Phantom', ratingTier: 0.86, preferOnnx: true },
  { region: 'in', username: 'zenith', displayName: 'Zenith', ratingTier: 0.77, preferOnnx: true },
  { region: 'br', username: 'cipher', displayName: 'Cipher', ratingTier: 0.64 },
  { region: 'us', username: 'pulse', displayName: 'Pulse', ratingTier: 0.52 },
  { region: 'de', username: 'reaper', displayName: 'Reaper', ratingTier: 0.38 },

  // --- Pattern 2: PascalCase Gamer Handle (6 personas) ---
  { region: 'us', username: 'ShadowStrike', displayName: 'ShadowStrike', ratingTier: 0.91, preferOnnx: true },
  { region: 'de', username: 'DarkKnight', displayName: 'DarkKnight', ratingTier: 0.83, preferOnnx: true },
  { region: 'in', username: 'SilentBlade', displayName: 'SilentBlade', ratingTier: 0.71, preferOnnx: true },
  { region: 'br', username: 'SilverFang', displayName: 'SilverFang', ratingTier: 0.62 },
  { region: 'us', username: 'IronClad', displayName: 'IronClad', ratingTier: 0.49 },
  { region: 'br', username: 'EchoKnight', displayName: 'EchoKnight', ratingTier: 0.35 },

  // --- Pattern 3: Esports / Clan / Streamer Prefix (6 personas) ---
  { region: 'us', username: 'fn_blitz', displayName: 'FN Blitz', ratingTier: 0.89, preferOnnx: true },
  { region: 'de', username: 'ttv_storm', displayName: 'TTV Storm', ratingTier: 0.79, preferOnnx: true },
  { region: 'in', username: 'og_killer', displayName: 'OG Killer', ratingTier: 0.85, preferOnnx: true },
  { region: 'br', username: 'pro_ninja', displayName: 'Pro Ninja', ratingTier: 0.68, preferOnnx: true },
  { region: 'in', username: 'faze_ghost', displayName: 'FaZe Ghost', ratingTier: 0.55 },
  { region: 'in', username: 'esl_striker', displayName: 'ESL Striker', ratingTier: 0.43 },

  // --- Pattern 4: Anime Character + Digits/Affix (6 personas) ---
  { region: 'us', username: 'sasuke99', displayName: 'Sasuke', ratingTier: 0.95, preferOnnx: true },
  { region: 'de', username: 'itachi_7', displayName: 'Itachi', ratingTier: 0.97, preferOnnx: true },
  { region: 'in', username: 'tanjiro_slayer', displayName: 'Tanjiro', ratingTier: 0.76, preferOnnx: true },
  { region: 'br', username: 'luffy_gear5', displayName: 'Luffy Gear 5', ratingTier: 0.88, preferOnnx: true },
  { region: 'us', username: 'gojo_satoru', displayName: 'Gojo', ratingTier: 0.92, preferOnnx: true },
  { region: 'in', username: 'deku_hero', displayName: 'Deku', ratingTier: 0.45 },

  // --- Pattern 5: Full Formal Name (6 personas) ---
  { region: 'de', username: 'felix.weber', displayName: 'Felix Weber', ratingTier: 0.87, preferOnnx: true },
  { region: 'us', username: 'alex_miller', displayName: 'Alex Miller', ratingTier: 0.90, preferOnnx: true },
  { region: 'br', username: 'carlos.silva', displayName: 'Carlos Silva', ratingTier: 0.84, preferOnnx: true },
  { region: 'in', username: 'rahul_sharma', displayName: 'Rahul Sharma', ratingTier: 0.82, preferOnnx: true },
  { region: 'de', username: 'sophie.schmidt', displayName: 'Sophie Schmidt', ratingTier: 0.65 },
  { region: 'us', username: 'sarah_jenkins', displayName: 'Sarah Jenkins', ratingTier: 0.58 },

  // --- Pattern 6: First Initial + Last Name (6 personas) ---
  { region: 'de', username: 'f_weber', displayName: 'F. Weber', ratingTier: 0.74, preferOnnx: true },
  { region: 'us', username: 'a_miller', displayName: 'A. Miller', ratingTier: 0.67 },
  { region: 'br', username: 'c_silva', displayName: 'C. Silva', ratingTier: 0.73, preferOnnx: true },
  { region: 'in', username: 'r_sharma', displayName: 'R. Sharma', ratingTier: 0.69 },
  { region: 'br', username: 'm_oliveira', displayName: 'M. Oliveira', ratingTier: 0.53 },
  { region: 'de', username: 't_hoffmann', displayName: 'T. Hoffmann', ratingTier: 0.41 },

  // --- Pattern 7: First Name + Last Initial (compact) (6 personas) ---
  { region: 'us', username: 'sarahj', displayName: 'Sarah J.', ratingTier: 0.81, preferOnnx: true },
  { region: 'de', username: 'lukasm', displayName: 'Lukas M.', ratingTier: 0.63 },
  { region: 'br', username: 'mateuso', displayName: 'Mateus O.', ratingTier: 0.70, preferOnnx: true },
  { region: 'in', username: 'priyap', displayName: 'Priya P.', ratingTier: 0.59 },
  { region: 'us', username: 'alexm', displayName: 'Alex M.', ratingTier: 0.48 },
  { region: 'de', username: 'jonasf', displayName: 'Jonas F.', ratingTier: 0.36 },

  // --- Pattern 8: First Name + 4-Digit Birth Year (6 personas) ---
  { region: 'us', username: 'jake2003', displayName: 'Jake', ratingTier: 0.44 },
  { region: 'de', username: 'elias1998', displayName: 'Elias', ratingTier: 0.66 },
  { region: 'br', username: 'mateus2001', displayName: 'Mateus', ratingTier: 0.75, preferOnnx: true },
  { region: 'de', username: 'hannah1999', displayName: 'Hannah', ratingTier: 0.51 },
  { region: 'br', username: 'clara2002', displayName: 'Clara', ratingTier: 0.39 },
  { region: 'br', username: 'austin2000', displayName: 'Austin', ratingTier: 0.57 },

  // --- Pattern 9: First Name + 2-Digit Number (6 personas) ---
  { region: 'in', username: 'priya02', displayName: 'Priya', ratingTier: 0.37 },
  { region: 'br', username: 'diego99', displayName: 'Diego', ratingTier: 0.80, preferOnnx: true },
  { region: 'us', username: 'kevin97', displayName: 'Kevin', ratingTier: 0.61 },
  { region: 'us', username: 'chloe04', displayName: 'Chloe', ratingTier: 0.42 },
  { region: 'de', username: 'leo07', displayName: 'Leo', ratingTier: 0.54 },
  { region: 'br', username: 'marcelo10', displayName: 'Marcelo', ratingTier: 0.78, preferOnnx: true },

  // --- Pattern 10: Clean Minimalist First Name (6 personas) ---
  { region: 'in', username: 'aarav', displayName: 'Aarav', ratingTier: 0.93, preferOnnx: true },
  { region: 'de', username: 'sophie', displayName: 'Sophie', ratingTier: 0.72, preferOnnx: true },
  { region: 'br', username: 'thiago', displayName: 'Thiago', ratingTier: 0.89, preferOnnx: true },
  { region: 'de', username: 'clara', displayName: 'Clara', ratingTier: 0.47 },
  { region: 'us', username: 'caleb', displayName: 'Caleb', ratingTier: 0.50 },
  { region: 'in', username: 'kavya', displayName: 'Kavya', ratingTier: 0.60 },

  // --- Pattern 11: "The", "Real", "Im", "Its" Prefix (6 personas) ---
  { region: 'us', username: 'the_real_caleb', displayName: 'The Real Caleb', ratingTier: 0.56 },
  { region: 'us', username: 'im_kevin', displayName: "I'm Kevin", ratingTier: 0.62 },
  { region: 'de', username: 'official_leo', displayName: 'Official Leo', ratingTier: 0.73, preferOnnx: true },
  { region: 'de', username: 'its_julia', displayName: "It's Julia", ratingTier: 0.46 },
  { region: 'br', username: 'real_diego', displayName: 'Real Diego', ratingTier: 0.81, preferOnnx: true },
  { region: 'in', username: 'iam_arjun', displayName: 'I Am Arjun', ratingTier: 0.90, preferOnnx: true },

  // --- Pattern 12: Two Compound Words (6 personas) ---
  { region: 'us', username: 'GhostRider', displayName: 'GhostRider', ratingTier: 0.85, preferOnnx: true },
  { region: 'de', username: 'NightWalker', displayName: 'NightWalker', ratingTier: 0.75, preferOnnx: true },
  { region: 'in', username: 'FireStorm', displayName: 'FireStorm', ratingTier: 0.67 },
  { region: 'de', username: 'FrostByte', displayName: 'FrostByte', ratingTier: 0.53 },
  { region: 'br', username: 'StormBreaker', displayName: 'StormBreaker', ratingTier: 0.83, preferOnnx: true },
  { region: 'in', username: 'NovaBurst', displayName: 'NovaBurst', ratingTier: 0.40 },

  // --- Pattern 13: ALL-CAPS Competitive Handle (6 personas) ---
  { region: 'us', username: 'NOVA', displayName: 'NOVA', ratingTier: 0.96, preferOnnx: true },
  { region: 'in', username: 'APEX', displayName: 'APEX', ratingTier: 0.94, preferOnnx: true },
  { region: 'de', username: 'TITAN', displayName: 'TITAN', ratingTier: 0.86, preferOnnx: true },
  { region: 'br', username: 'FURY', displayName: 'FURY', ratingTier: 0.77, preferOnnx: true },
  { region: 'de', username: 'ZERO', displayName: 'ZERO', ratingTier: 0.68, preferOnnx: true },
  { region: 'in', username: 'VIPER', displayName: 'VIPER', ratingTier: 0.58 },

  // --- Pattern 14: Dot-Separated Tech / Gamer Words (6 personas) ---
  { region: 'de', username: 'hyper.sonic', displayName: 'HyperSonic', ratingTier: 0.69 },
  { region: 'in', username: 'cyber.punk', displayName: 'CyberPunk', ratingTier: 0.79, preferOnnx: true },
  { region: 'us', username: 'pixel.art', displayName: 'PixelArt', ratingTier: 0.48 },
  { region: 'br', username: 'quantum.leap', displayName: 'QuantumLeap', ratingTier: 0.82, preferOnnx: true },
  { region: 'br', username: 'neon.rider', displayName: 'NeonRider', ratingTier: 0.55 },
  { region: 'in', username: 'vector.x', displayName: 'VectorX', ratingTier: 0.63 },

  // --- Pattern 15: Humorous / Casual / Meme Names (6 personas) ---
  { region: 'us', username: 'potato_lord', displayName: 'Potato Lord', ratingTier: 0.32 },
  { region: 'br', username: 'chill_guy', displayName: 'Chill Guy', ratingTier: 0.45 },
  { region: 'in', username: 'sleepy_panda', displayName: 'Sleepy Panda', ratingTier: 0.28 },
  { region: 'de', username: 'coffee_addict', displayName: 'Coffee Addict', ratingTier: 0.50 },
  { region: 'br', username: 'noob_master', displayName: 'NoobMaster', ratingTier: 0.71, preferOnnx: true },
  { region: 'in', username: 'couch_potato', displayName: 'Couch Potato', ratingTier: 0.22 },

  // --- Pattern 16: First Name + Gaming/Content Suffix (6 personas) ---
  { region: 'us', username: 'ethan_plays', displayName: 'Ethan Plays', ratingTier: 0.34 },
  { region: 'br', username: 'leo_gaming', displayName: 'Leo Gaming', ratingTier: 0.51 },
  { region: 'br', username: 'bruno_gg', displayName: 'Bruno GG', ratingTier: 0.47 },
  { region: 'de', username: 'niklas_tv', displayName: 'Niklas TV', ratingTier: 0.60 },
  { region: 'us', username: 'tyler_plays', displayName: 'Tyler Plays', ratingTier: 0.41 },
  { region: 'in', username: 'dev_gaming', displayName: 'Dev Gaming', ratingTier: 0.66 },

  // --- Pattern 17: Title / Honorific Style (6 personas) ---
  { region: 'us', username: 'sir_marcus', displayName: 'Sir Marcus', ratingTier: 0.64 },
  { region: 'us', username: 'captain_derek', displayName: 'Captain Derek', ratingTier: 0.54 },
  { region: 'in', username: 'lord_arjun', displayName: 'Lord Arjun', ratingTier: 0.88, preferOnnx: true },
  { region: 'de', username: 'dr_schmidt', displayName: 'Dr. Schmidt', ratingTier: 0.76, preferOnnx: true },
  { region: 'br', username: 'master_yoda', displayName: 'Master Yoda', ratingTier: 0.90, preferOnnx: true },
  { region: 'de', username: 'duke_alex', displayName: 'Duke Alex', ratingTier: 0.42 },

  // --- Pattern 18: Leetspeak / Number Substitutions (6 personas) ---
  { region: 'in', username: 'drag0n', displayName: 'Drag0n', ratingTier: 0.80, preferOnnx: true },
  { region: 'de', username: 'bl1tz', displayName: 'Bl1tz', ratingTier: 0.72, preferOnnx: true },
  { region: 'us', username: 'v01d', displayName: 'V01d', ratingTier: 0.85, preferOnnx: true },
  { region: 'br', username: 'gh0st', displayName: 'Gh0st', ratingTier: 0.61 },
  { region: 'in', username: 'sn1per', displayName: 'Sn1per', ratingTier: 0.53 },
  { region: 'br', username: 'n1ght', displayName: 'N1ght', ratingTier: 0.37 },

  // --- Pattern 19: Regional / City Shorthand (6 personas) ---
  { region: 'br', username: 'lucas_br', displayName: 'Lucas BR', ratingTier: 0.67 },
  { region: 'de', username: 'felix_de', displayName: 'Felix DE', ratingTier: 0.70, preferOnnx: true },
  { region: 'in', username: 'rahul_delhi', displayName: 'Rahul Delhi', ratingTier: 0.84, preferOnnx: true },
  { region: 'us', username: 'austin_tx', displayName: 'Austin TX', ratingTier: 0.58 },
  { region: 'br', username: 'bruno_rio', displayName: 'Bruno Rio', ratingTier: 0.49 },
  { region: 'in', username: 'sneha_blr', displayName: 'Sneha BLR', ratingTier: 0.35 },

  // --- Pattern 20: x_Bookends or Double Underscore (6 personas) ---
  { region: 'us', username: 'xDragonx', displayName: 'xDragonx', ratingTier: 0.93, preferOnnx: true },
  { region: 'br', username: 'zShadow', displayName: 'zShadow', ratingTier: 0.77, preferOnnx: true },
  { region: 'us', username: 'void__walker', displayName: 'Void Walker', ratingTier: 0.87, preferOnnx: true },
  { region: 'de', username: 'toxic__orb', displayName: 'Toxic Orb', ratingTier: 0.43 },
  { region: 'in', username: 'dark__knight', displayName: 'Dark Knight', ratingTier: 0.65 },
  { region: 'in', username: 'silent__blade', displayName: 'Silent Blade', ratingTier: 0.31 },
];

/** Roster bot whose engine strength is closest to `rating`. */
export function engineBotForRating(rating: number): string {
  let best = BOT_ROSTER[0];
  let bestGap = Infinity;
  for (const bot of BOT_ROSTER) {
    if (bot.tier === 'grandmaster') continue;
    const gap = Math.abs(bot.elo - rating);
    if (gap < bestGap) {
      bestGap = gap;
      best = bot;
    }
  }
  return best.id;
}

function buildRoster(): BotPersona[] {
  const personas: BotPersona[] = [];
  const regionCounters: Record<BotPersona['region'], number> = {
    de: 0,
    us: 0,
    in: 0,
    br: 0,
  };

  SEED_DEFINITIONS.forEach((def, index) => {
    const reg = (def.region in regionCounters ? def.region : 'us') as BotPersona['region'];
    regionCounters[reg]++;
    const userId = `${BOT_ID_PREFIX}${reg}_${String(regionCounters[reg]).padStart(3, '0')}`;

    const targetRating = Math.round(
      BOT_MIN_RATING + def.ratingTier * (BOT_MAX_RATING - BOT_MIN_RATING)
    );
    const gamesPlayed = 45 + Math.floor((def.ratingTier * 280) + (index * 7) % 60);
    const winRate = 0.42 + def.ratingTier * 0.20;
    const wins = Math.round(gamesPlayed * winRate);

    // High rating or explicitly marked -> ONNX AlphaZero engine
    const useOnnx = Boolean(def.preferOnnx || targetRating >= 1650);
    const engineBotId = useOnnx ? 'milo' : engineBotForRating(targetRating);

    personas.push({
      userId,
      username: def.username,
      displayName: def.displayName,
      region: reg,
      targetRating,
      engineBotId,
      useOnnx,
      gamesPlayed,
      wins,
    });
  });

  return personas;
}

export const BOT_PERSONAS: readonly BotPersona[] = buildRoster();

const BY_ID = new Map(BOT_PERSONAS.map((p) => [p.userId, p]));

export function personaById(userId: string): BotPersona | undefined {
  return BY_ID.get(userId);
}
