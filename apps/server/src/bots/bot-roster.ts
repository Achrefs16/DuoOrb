import { BOT_ROSTER } from '@duoorb/game-core';
import { BOT_ID_PREFIX } from './bot-ids.js';

/**
 * Persistent computer-opponent personas.
 *
 * Designed to feel completely organic, authentic, and indistinguishable from real
 * mobile/online board game players across four key regions (US, DE, IN, BR).
 *
 * Every bot starts at the standard human rating baseline of 1500 Elo and has
 * played up to 16 realistic matches (with mixed wins and losses) that mathematically
 * align with their current rating, games played, and match history records.
 */
export type BotPlaystyle =
  | 'rush'
  | 'shiller'
  | 'split'
  | 'flank'
  | 'evasive'
  | 'counter'
  | 'early_wall'
  | 'reed'
  | 'gap'
  | 'tempo';

export type WallStyle =
  | 'balanced'
  | 'horizontal_barricade'
  | 'vertical_corridor'
  | 'defensive_backwall'
  | 'flank_trap'
  | 'minimal';

export type OpeningStyle =
  | 'mixed'
  | 'early_fence'
  | 'center_march'
  | 'wing_drift'
  | 'back_gate';

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
  /** Plausible career totals for the seeded rating row (strictly <= 16 matches). */
  gamesPlayed: number;
  wins: number;
  /** Distinct signature playstyle giving real visible personality in the opening and midgame. */
  playstyle: BotPlaystyle;
  /** Authentic human-sounding profile bio. */
  bio: string;
  /** Badges displayed on their public profile showcase. */
  equippedBadges: string[];
  /** Whether this persona holds a DuoOrb Pro/Premium subscription badge (~15% of roster). */
  isPremium: boolean;
  /** How many days ago this account was registered. */
  createdAtDaysAgo: number;
  /** Native Hybrid AI engine parameters */
  temperature: number;
  blunderRate: number;
  wallProbBias: number;
  wallStyle: WallStyle;
  openingStyle: OpeningStyle;
  varietyWindow: number;
  simulations: number;
}

export const BOT_MIN_RATING = 900;
export const BOT_MAX_RATING = 2100;
export const BOT_STARTING_RATING = 1500;
export const BOT_MAX_HISTORY_MATCHES = 16;

interface PersonaSeedDef {
  region: BotPersona['region'];
  username: string;
  displayName: string;
  ratingTier: number; // 0 (weakest ~900) to 1 (strongest ~2100)
  preferOnnx?: boolean;
  playstyle?: BotPlaystyle;
  customBio?: string;
}

// 120 authentic, non-repetitive human player personas (30 per region: US, DE, IN, BR)
const SEED_DEFINITIONS: PersonaSeedDef[] = [
  // ===================== REGION: US / UK / CAN (30 personas) =====================
  { region: 'us', username: 'marcus_reed', displayName: 'Marcus Reed', ratingTier: 0.92, preferOnnx: true, customBio: 'Ranked 1v1 grinder. Always calculating the tactical cut.' },
  { region: 'us', username: 'elena_ross', displayName: 'Elena Ross', ratingTier: 0.88, preferOnnx: true, customBio: 'Board control enthusiast. Clean corridors and patient timing.' },
  { region: 'us', username: 'david_b91', displayName: 'David B.', ratingTier: 0.74, preferOnnx: true, customBio: 'Casual evenings on the board. Learning endgame pathing.' },
  { region: 'us', username: 'sarah_jenkins', displayName: 'Sarah Jenkins', ratingTier: 0.81, preferOnnx: true, customBio: 'Classic chess & Quoridor player. Defense first.' },
  { region: 'us', username: 'nathan_cole', displayName: 'Nathan Cole', ratingTier: 0.65, customBio: 'Just here for quick games during lunch break.' },
  { region: 'us', username: 'chloe_adams', displayName: 'Chloe Adams', ratingTier: 0.58, customBio: 'Climbing slowly! Still practicing jump angles.' },
  { region: 'us', username: 'ryan_miller', displayName: 'Ryan Miller', ratingTier: 0.85, preferOnnx: true, customBio: "Tournament tempo specialist. Don't waste your walls early." },
  { region: 'us', username: 'hannah_turner', displayName: 'Hannah Turner', ratingTier: 0.49, customBio: 'Coffee and tactics. Enjoying the 1v1 climb.' },
  { region: 'us', username: 'jake_turner', displayName: 'Jake Turner', ratingTier: 0.42, customBio: 'Aggressive rush player. Fast games only.' },
  { region: 'us', username: 'oliver_stone', displayName: 'Oliver Stone', ratingTier: 0.95, preferOnnx: true, customBio: 'Quoridor tournament geometry nerd. Calculating every path.' },
  { region: 'us', username: 'emily_watson', displayName: 'Emily Watson', ratingTier: 0.68, customBio: 'Tactical flanker. Funneling rivals to the side.' },
  { region: 'us', username: 'liam_hayes', displayName: 'Liam Hayes', ratingTier: 0.91, preferOnnx: true, customBio: 'Road to 2000 Elo. Clean fundamentals.' },
  { region: 'us', username: 'connor_blake', displayName: 'Connor Blake', ratingTier: 0.53, customBio: 'Casual player. Learning wall placements.' },
  { region: 'us', username: 'zoe_mitchell', displayName: 'Zoe Mitchell', ratingTier: 0.77, preferOnnx: true, customBio: 'Counter-walling specialist. Block me and I block back.' },
  { region: 'us', username: 'sam_carter', displayName: 'Sam Carter', ratingTier: 0.62, customBio: 'Midgame split strategy main.' },
  { region: 'us', username: 'alex_quor', displayName: 'Alex Quor', ratingTier: 0.79, preferOnnx: true, customBio: 'Every wall has a purpose. Spatial strategy fan.' },
  { region: 'us', username: 'pawn_runner', displayName: 'Pawn Runner', ratingTier: 0.86, preferOnnx: true, customBio: 'Pawn mobility over heavy defense. Fast transitions.' },
  { region: 'us', username: 'swift_pawn', displayName: 'Swift Pawn', ratingTier: 0.45, customBio: 'Forward sprint enthusiast. Sometimes it works!' },
  { region: 'us', username: 'boardwalker', displayName: 'Board Walker', ratingTier: 0.72, preferOnnx: true, customBio: 'Slow and steady corridor builder.' },
  { region: 'us', username: 'tempoking', displayName: 'Tempo King', ratingTier: 0.89, preferOnnx: true, customBio: 'Timing is everything in Quoridor.' },
  { region: 'us', username: 'quietmove', displayName: 'Quiet Move', ratingTier: 0.66, customBio: 'Silent positional maneuvering.' },
  { region: 'us', username: 'ironquor', displayName: 'Iron Quor', ratingTier: 0.83, preferOnnx: true, customBio: 'Unbreakable backwall defense.' },
  { region: 'us', username: 'driftwood', displayName: 'Driftwood', ratingTier: 0.36, customBio: 'Just chilling and trying out crazy wall lines.' },
  { region: 'us', username: 'coffeepawn', displayName: 'Coffee Pawn', ratingTier: 0.55, customBio: 'Need my morning espresso before ranked matches.' },
  { region: 'us', username: 'maze_walker', displayName: 'Maze Walker', ratingTier: 0.70, preferOnnx: true, customBio: 'Turning the center into a labyrinth.' },
  { region: 'us', username: 'vector_mind', displayName: 'Vector Mind', ratingTier: 0.93, preferOnnx: true, customBio: 'Optimal path calculations only.' },
  { region: 'us', username: 'cornerstone', displayName: 'Cornerstone', ratingTier: 0.61, customBio: 'Solid defense and wing traps.' },
  { region: 'us', username: 'zenpawn', displayName: 'Zen Pawn', ratingTier: 0.47, customBio: "Stay calm and don't panic when blocked." },
  { region: 'us', username: 'horizon_pawn', displayName: 'Horizon Pawn', ratingTier: 0.52, customBio: 'Eyes on the opposite baseline.' },
  { region: 'us', username: 'silver_path', displayName: 'Silver Path', ratingTier: 0.75, preferOnnx: true, customBio: 'Finding the hidden path through the maze.' },

  // ===================== REGION: GERMANY / AT / CH (30 personas) =====================
  { region: 'de', username: 'felix_bauer', displayName: 'Felix Bauer', ratingTier: 0.94, preferOnnx: true, customBio: 'Quoridor Berlin club player. Precision moves only.' },
  { region: 'de', username: 'lukas_schmidt', displayName: 'Lukas Schmidt', ratingTier: 0.87, preferOnnx: true, customBio: 'Endgame tactician. Shiller defense devotee.' },
  { region: 'de', username: 'jonas_weber', displayName: 'Jonas Weber', ratingTier: 0.76, preferOnnx: true, customBio: 'Patience and solid wall structures.' },
  { region: 'de', username: 'sophie_richter', displayName: 'Sophie Richter', ratingTier: 0.84, preferOnnx: true, customBio: 'Classical Quoridor opening specialist.' },
  { region: 'de', username: 'niklas_meyer', displayName: 'Niklas Meyer', ratingTier: 0.69, customBio: 'Vertical corridor divider. Board symmetry fan.' },
  { region: 'de', username: 'leon_becker', displayName: 'Leon Becker', ratingTier: 0.82, preferOnnx: true, customBio: 'Competitive ranked player from Munich.' },
  { region: 'de', username: 'elias_hoffmann', displayName: 'Elias Hoffmann', ratingTier: 0.71, preferOnnx: true, customBio: 'Spatial geometry and counter-play.' },
  { region: 'de', username: 'clara_fischer', displayName: 'Clara Fischer', ratingTier: 0.54, customBio: 'Casual board gamer. Enjoying the puzzle!' },
  { region: 'de', username: 'moritz_weber', displayName: 'Moritz Weber', ratingTier: 0.63, customBio: 'Hamburg coffee & tactical board games.' },
  { region: 'de', username: 'maximilian_koch', displayName: 'Max Koch', ratingTier: 0.90, preferOnnx: true, customBio: 'Analyzing every ply. High-Elo ranked main.' },
  { region: 'de', username: 'tim_schneider', displayName: 'Tim Schneider', ratingTier: 0.48, customBio: 'Still learning corridor traps.' },
  { region: 'de', username: 'julian_horn', displayName: 'Julian Horn', ratingTier: 0.73, preferOnnx: true, customBio: 'Speed & accuracy on the board.' },
  { region: 'de', username: 'laura_wagner', displayName: 'Laura Wagner', ratingTier: 0.66, customBio: 'Defensive wall builder. Making you walk the long way.' },
  { region: 'de', username: 'simon_braun', displayName: 'Simon Braun', ratingTier: 0.59, customBio: 'Tactics over speed. Never rush into an open lane.' },
  { region: 'de', username: 'david_zimmermann', displayName: 'David Zimmermann', ratingTier: 0.78, preferOnnx: true, customBio: 'Calculated midgame corridor trades.' },
  { region: 'de', username: 'paul_hartmann', displayName: 'Paul Hartmann', ratingTier: 0.51, customBio: 'Fun games after work. Keep it friendly!' },
  { region: 'de', username: 'lena_schulz', displayName: 'Lena Schulz', ratingTier: 0.81, preferOnnx: true, customBio: 'Scott Reed opening devotee. Funneling you mid.' },
  { region: 'de', username: 'florian_kruse', displayName: 'Florian Kruse', ratingTier: 0.60, customBio: 'Center sprint with defensive backups.' },
  { region: 'de', username: 'tobias_lang', displayName: 'Tobias Lang', ratingTier: 0.43, customBio: 'Casual player from Cologne.' },
  { region: 'de', username: 'hannah_meier', displayName: 'Hannah Meier', ratingTier: 0.57, customBio: 'Quiet positional maneuvers.' },
  { region: 'de', username: 'philipp_werner', displayName: 'Philipp Werner', ratingTier: 0.88, preferOnnx: true, customBio: 'Two walls, one gap. Tournament geometry.' },
  { region: 'de', username: 'sebastian_voigt', displayName: 'Sebastian Voigt', ratingTier: 0.92, preferOnnx: true, customBio: 'Ranked ladder enthusiast. 2000 Elo push.' },
  { region: 'de', username: 'jan_sommer', displayName: 'Jan Sommer', ratingTier: 0.38, customBio: 'Just having fun with weird wall patterns.' },
  { region: 'de', username: 'marcel_kraus', displayName: 'Marcel Kraus', ratingTier: 0.65, customBio: "Solid wall defense. Don't leave corridors open." },
  { region: 'de', username: 'stefan_maurer', displayName: 'Stefan Maurer', ratingTier: 0.70, preferOnnx: true, customBio: 'Flank trapper. Corner control enthusiast.' },
  { region: 'de', username: 'valentin_fuchs', displayName: 'Valentin Fuchs', ratingTier: 0.46, customBio: 'Weekend board games and coffee.' },
  { region: 'de', username: 'robin_engel', displayName: 'Robin Engel', ratingTier: 0.77, preferOnnx: true, customBio: 'Fast walls, aggressive tempo.' },
  { region: 'de', username: 'fabian_jung', displayName: 'Fabian Jung', ratingTier: 0.53, customBio: 'Learning from every loss.' },
  { region: 'de', username: 'christian_wolf', displayName: 'Christian Wolf', ratingTier: 0.85, preferOnnx: true, customBio: 'Board symmetry breaker. Tactical positioning.' },
  { region: 'de', username: 'markus_frank', displayName: 'Markus Frank', ratingTier: 0.62, customBio: 'Midgame timing and pawn economy.' },

  // ===================== REGION: INDIA (30 personas) =====================
  { region: 'in', username: 'aarav_sharma', displayName: 'Aarav Sharma', ratingTier: 0.95, preferOnnx: true, customBio: 'Competitive Quoridor tactician from Bengaluru.' },
  { region: 'in', username: 'rohan_gupta', displayName: 'Rohan Gupta', ratingTier: 0.86, preferOnnx: true, customBio: 'Center sprint & jump specialist. Quick thinking.' },
  { region: 'in', username: 'priya_patel', displayName: 'Priya Patel', ratingTier: 0.80, preferOnnx: true, customBio: 'Funneling rivals through deliberate wall gaps.' },
  { region: 'in', username: 'aditya_verma', displayName: 'Aditya Verma', ratingTier: 0.75, preferOnnx: true, customBio: 'Endgame pathfinder. Calculating every detour.' },
  { region: 'in', username: 'kavya_nair', displayName: 'Kavya Nair', ratingTier: 0.72, preferOnnx: true, customBio: 'Strategic vertical divider. Making every move count.' },
  { region: 'in', username: 'vikram_singh', displayName: 'Vikram Singh', ratingTier: 0.89, preferOnnx: true, customBio: 'High-ranked 1v1 ladder climber from Delhi.' },
  { region: 'in', username: 'neha_joshi', displayName: 'Neha Joshi', ratingTier: 0.64, customBio: 'Patience and clean pawn development.' },
  { region: 'in', username: 'arjun_reddy', displayName: 'Arjun Reddy', ratingTier: 0.91, preferOnnx: true, customBio: 'Counter-walling specialist. Equalizing trades.' },
  { region: 'in', username: 'ananya_iyer', displayName: 'Ananya Iyer', ratingTier: 0.58, customBio: 'Casual ranked player. Learning new openings.' },
  { region: 'in', username: 'dev_malhotra', displayName: 'Dev Malhotra', ratingTier: 0.83, preferOnnx: true, customBio: 'Opening trap engineer. Board control from move 1.' },
  { region: 'in', username: 'sid_chawla', displayName: 'Siddharth Chawla', ratingTier: 0.67, customBio: 'Defensive wall enthusiast from Mumbai.' },
  { region: 'in', username: 'ishaan_bose', displayName: 'Ishaan Bose', ratingTier: 0.52, customBio: 'Fast moves and fun games.' },
  { region: 'in', username: 'meera_sen', displayName: 'Meera Sen', ratingTier: 0.78, preferOnnx: true, customBio: 'Spatial traps and calculated flank defenses.' },
  { region: 'in', username: 'raghav_kapoor', displayName: 'Raghav Kapoor', ratingTier: 0.84, preferOnnx: true, customBio: 'Tournament tempo and pawn conservation.' },
  { region: 'in', username: 'sneha_rao', displayName: 'Sneha Rao', ratingTier: 0.61, customBio: 'Playing daily to improve my Elo.' },
  { region: 'in', username: 'varun_das', displayName: 'Varun Das', ratingTier: 0.49, customBio: 'Love the mental puzzle of Quoridor.' },
  { region: 'in', username: 'tanvi_kapoor', displayName: 'Tanvi Kapoor', ratingTier: 0.70, preferOnnx: true, customBio: 'Diagonal maneuvers and dodging face-walls.' },
  { region: 'in', username: 'karan_chopra', displayName: 'Karan Chopra', ratingTier: 0.88, preferOnnx: true, customBio: '2000 Elo push. Calculated wall placements.' },
  { region: 'in', username: 'pooja_mehta', displayName: 'Pooja Mehta', ratingTier: 0.44, customBio: 'Coffee, board games, and good vibes.' },
  { region: 'in', username: 'rahul_kumar', displayName: 'Rahul Kumar', ratingTier: 0.76, preferOnnx: true, customBio: 'Scott Reed opening devotee from Hyderabad.' },
  { region: 'in', username: 'manish_nair', displayName: 'Manish Nair', ratingTier: 0.55, customBio: 'Solid fundamentals and tactical play.' },
  { region: 'in', username: 'divya_bhat', displayName: 'Divya Bhat', ratingTier: 0.63, customBio: 'Sidestepping blocks and finding the alternate route.' },
  { region: 'in', username: 'akash_tiwari', displayName: 'Akash Tiwari', ratingTier: 0.82, preferOnnx: true, customBio: 'Board geometry enthusiast from Pune.' },
  { region: 'in', username: 'alok_kumar', displayName: 'Alok Kumar', ratingTier: 0.41, customBio: 'Still figuring out how to stop the jump!' },
  { region: 'in', username: 'swati_sharma', displayName: 'Swati Sharma', ratingTier: 0.68, customBio: 'Strategic vertical corridors.' },
  { region: 'in', username: 'deepak_mishra', displayName: 'Deepak Mishra', ratingTier: 0.59, customBio: 'Late game endurance player.' },
  { region: 'in', username: 'amit_patel', displayName: 'Amit Patel', ratingTier: 0.73, preferOnnx: true, customBio: 'Clean pawn movements and counter-blocks.' },
  { region: 'in', username: 'harsh_vardhan', displayName: 'Harsh Vardhan', ratingTier: 0.93, preferOnnx: true, customBio: 'Ranked 1v1 master. Always calculating 4 steps ahead.' },
  { region: 'in', username: 'sanjay_rao', displayName: 'Sanjay Rao', ratingTier: 0.47, customBio: 'Evening games after work.' },
  { region: 'in', username: 'ritika_sen', displayName: 'Ritika Sen', ratingTier: 0.65, customBio: 'Wing drift opening and edge corridor traps.' },

  // ===================== REGION: BRAZIL / PT (30 personas) =====================
  { region: 'br', username: 'mateus_costa', displayName: 'Mateus Costa', ratingTier: 0.90, preferOnnx: true, customBio: 'Quoridor Brasil ranked player. Aggressive lines.' },
  { region: 'br', username: 'thiago_silva', displayName: 'Thiago Silva', ratingTier: 0.96, preferOnnx: true, customBio: 'Top ranked competitive player from São Paulo.' },
  { region: 'br', username: 'gabriel_lima', displayName: 'Gabriel Lima', ratingTier: 0.81, preferOnnx: true, customBio: 'Center corridor divider. Breaking board symmetry.' },
  { region: 'br', username: 'bruno_oliveira', displayName: 'Bruno Oliveira', ratingTier: 0.74, preferOnnx: true, customBio: 'Patience and solid wall structures.' },
  { region: 'br', username: 'diego_santos', displayName: 'Diego Santos', ratingTier: 0.87, preferOnnx: true, customBio: 'Ranked ladder grinder from Rio de Janeiro.' },
  { region: 'br', username: 'lucas_moraes', displayName: 'Lucas Moraes', ratingTier: 0.69, customBio: "Tactics over speed. Don't rush into obvious paths." },
  { region: 'br', username: 'carolina_barros', displayName: 'Carolina Barros', ratingTier: 0.77, preferOnnx: true, customBio: 'Flank trapper. Corner corridor control.' },
  { region: 'br', username: 'felipe_rocha', displayName: 'Felipe Rocha', ratingTier: 0.85, preferOnnx: true, customBio: 'Early-wall aggressive player. Immediate pressure.' },
  { region: 'br', username: 'rodrigo_alves', displayName: 'Rodrigo Alves', ratingTier: 0.62, customBio: 'Casual evening games from Belo Horizonte.' },
  { region: 'br', username: 'juliana_castro', displayName: 'Juliana Castro', ratingTier: 0.71, preferOnnx: true, customBio: 'Evasive sidesteps and diagonal leaps.' },
  { region: 'br', username: 'andre_martins', displayName: 'André Martins', ratingTier: 0.58, customBio: 'Practicing wall placement and pawn tempo.' },
  { region: 'br', username: 'marcelo_pires', displayName: 'Marcelo Pires', ratingTier: 0.83, preferOnnx: true, customBio: 'Scott Reed funnel devotee from Curitiba.' },
  { region: 'br', username: 'leandro_gomes', displayName: 'Leandro Gomes', ratingTier: 0.50, customBio: 'Learning from my blunders!' },
  { region: 'br', username: 'camila_duarte', displayName: 'Camila Duarte', ratingTier: 0.79, preferOnnx: true, customBio: 'Calculated midgame corridor trades.' },
  { region: 'br', username: 'vitor_hugo', displayName: 'Vítor Hugo', ratingTier: 0.66, customBio: 'Clean pawn development and late walls.' },
  { region: 'br', username: 'rafael_peixoto', displayName: 'Rafael Peixoto', ratingTier: 0.92, preferOnnx: true, customBio: 'Grandmaster push. Precision geometry.' },
  { region: 'br', username: 'gustavo_mendes', displayName: 'Gustavo Mendes', ratingTier: 0.45, customBio: 'Just here for the fun and strategy.' },
  { region: 'br', username: 'mariana_vieira', displayName: 'Mariana Vieira', ratingTier: 0.64, customBio: 'Strategic barriers and edge traps.' },
  { region: 'br', username: 'leonardo_castro', displayName: 'Leonardo Castro', ratingTier: 0.53, customBio: 'Casual 1v1s from Porto Alegre.' },
  { region: 'br', username: 'eduardo_souza', displayName: 'Eduardo Souza', ratingTier: 0.88, preferOnnx: true, customBio: 'Tournament tempo specialist. Every wall counts.' },
  { region: 'br', username: 'danilo_franco', displayName: 'Danilo Franco', ratingTier: 0.72, preferOnnx: true, customBio: 'Channeling paths and split corridors.' },
  { region: 'br', username: 'beatriz_lima', displayName: 'Beatriz Lima', ratingTier: 0.60, customBio: 'Defensive walling from Recife.' },
  { region: 'br', username: 'renato_cardoso', displayName: 'Renato Cardoso', ratingTier: 0.75, preferOnnx: true, customBio: 'Counter-walling tactician.' },
  { region: 'br', username: 'otavio_br', displayName: 'Otávio B.', ratingTier: 0.42, customBio: 'Learning the jump rules!' },
  { region: 'br', username: 'vinicius_reis', displayName: 'Vinícius Reis', ratingTier: 0.80, preferOnnx: true, customBio: 'Central pawn sprint with defensive backups.' },
  { region: 'br', username: 'fernanda_melo', displayName: 'Fernanda Melo', ratingTier: 0.56, customBio: 'Board games & coffee. Friendly matches!' },
  { region: 'br', username: 'caio_torres', displayName: 'Caio Torres', ratingTier: 0.84, preferOnnx: true, customBio: 'Two walls, one gap. Tactical lure master.' },
  { region: 'br', username: 'igor_pereira', displayName: 'Igor Pereira', ratingTier: 0.67, customBio: 'Solid fundamentals and pawn speed.' },
  { region: 'br', username: 'tiago_fontes', displayName: 'Tiago Fontes', ratingTier: 0.48, customBio: 'Casual player from Brasília.' },
  { region: 'br', username: 'heitor_borges', displayName: 'Heitor Borges', ratingTier: 0.73, preferOnnx: true, customBio: 'Spatial traps and corridor maneuvers.' },
];

/** Roster bot whose engine strength is closest to `rating`. */
export function engineBotForRating(rating: number): string {
  let best = BOT_ROSTER[0];
  let bestGap = Infinity;
  for (const bot of BOT_ROSTER) {
    const gap = Math.abs(bot.elo - rating);
    if (gap < bestGap) {
      bestGap = gap;
      best = bot;
    }
  }
  return best.id;
}

const PLAYSTYLES: BotPlaystyle[] = [
  'early_wall',
  'reed',
  'shiller',
  'split',
  'flank',
  'gap',
  'counter',
  'evasive',
  'tempo',
  'rush',
];

const PLAYSTYLE_BIOS: Record<BotPlaystyle, string[]> = {
  early_wall: [
    'Early-wall aggressive player ⚡ Immediate board pressure from move 1.',
    'Fast walls, aggressive tempo • Why wait to control the board?',
    'Opening trap engineer 🚧 Board control starts on the first move.',
  ],
  reed: [
    'Scott Reed opening devotee 🧱 Funneling opponents through the center gap.',
    'Classical Reed defense • Choking corridors before you cross mid.',
    'Two walls, one gap • Quoridor tournament geometry enthusiast.',
  ],
  shiller: [
    'Shiller defense specialist 🧱 Board control is everything.',
    'Patience and solid wall structures • Larry Shiller disciple.',
    'Strategic vertical divider • Making every corridor count.',
  ],
  split: [
    'Vertical corridor divider ♟️ Splitting the board in two.',
    'Channeling paths and calculated moves • Road to 2000 Elo.',
    'Board symmetry breaker • Tactical positioning main.',
  ],
  flank: [
    'Flank trapper • Funneling rivals toward the edges.',
    'Closing the wings early 🛡️ Corner corridor control.',
    'Tactics over speed • Never walk into the obvious path.',
  ],
  gap: [
    'Gap opening tactician 🕳️ Tactical openings and calculated corridor trades.',
    'Baiting moves through deliberate openings • Quoridor theorist.',
    'Spatial trap designer • Every open gap is an intentional lure.',
  ],
  counter: [
    'Counter-wall punisher ⚔️ Block me, and I block you back.',
    'Reactive tactician • Punishing aggressive early walls.',
    'Equalizing wall trades • Think twice before blocking.',
  ],
  evasive: [
    'Sidestep & diagonal maneuvers 🌀 Dodging face-walls.',
    'Positional patience • Slipping past blocks and traps.',
    'Finding the third path • Ranked 1v1 enthusiast.',
  ],
  tempo: [
    'Tournament tempo specialist ⏱️ Solid pawn development and midgame timing.',
    'Clean fundamentals • Saving walls for the decisive turn.',
    'Pawn economy main • Calculated midgame walling.',
  ],
  rush: [
    'Central pawn rusher ⚡ Always contesting the jump.',
    'Pawn speed & momentum • Climbing the ranked ladder!',
    'Direct playstyle • Fast games and quick finishes 🚀',
  ],
};

function badgesForRating(rating: number): string[] {
  if (rating >= 2000) return ['rating-2000', 'rank-100', 'legend'];
  if (rating >= 1800) return ['rating-1800', 'veteran', 'wins-100'];
  if (rating >= 1600) return ['rating-1600', 'champion', 'games-100'];
  if (rating >= 1400) return ['unbreakable', 'games-50', 'wins-25'];
  return ['first-blood', 'games-10'];
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

    // Realistic matches played bounded strictly to <= 16 matches (8 to 16 matches)
    const matchesCount = Math.min(
      BOT_MAX_HISTORY_MATCHES,
      Math.max(8, Math.round(8 + def.ratingTier * 8))
    );

    // Starting baseline is 1500; delta drives career win/loss record
    const deltaRating = targetRating - BOT_STARTING_RATING;
    const winRate = Math.max(0.15, Math.min(0.92, 0.5 + deltaRating / (matchesCount * 55)));
    const wins = Math.min(matchesCount - 1, Math.max(1, Math.round(matchesCount * winRate)));
    const gamesPlayed = matchesCount;

    // High rating or explicitly marked -> ONNX AlphaZero engine
    const useOnnx = Boolean(def.preferOnnx || targetRating >= 1650);
    const engineBotId = engineBotForRating(targetRating);

    const playstyle = def.playstyle ?? PLAYSTYLES[index % PLAYSTYLES.length];
    const bios = PLAYSTYLE_BIOS[playstyle];
    const bio = def.customBio ?? bios[index % bios.length];
    const equippedBadges = badgesForRating(targetRating);
    const isPremium = index % 7 === 0;
    const createdAtDaysAgo = 45 + ((index * 23) % 320);

    // Dynamic hybrid personality parameters matching the 39-bot system:
    const tierFrac = def.ratingTier; // 0.0 to 1.0
    const temperature = Number((0.75 - tierFrac * 0.70).toFixed(2));
    const blunderRate = Number(Math.max(0, 0.18 - tierFrac * 0.22).toFixed(2));
    const varietyWindow = Number((0.08 - tierFrac * 0.06).toFixed(3));
    const simulations = Math.round(600 + tierFrac * 6400);

    let wallStyle: WallStyle = 'balanced';
    let openingStyle: OpeningStyle = 'mixed';
    let wallProbBias = 0.0;

    switch (playstyle) {
      case 'early_wall':
        wallStyle = 'horizontal_barricade';
        openingStyle = 'early_fence';
        wallProbBias = 0.08;
        break;
      case 'reed':
        wallStyle = 'horizontal_barricade';
        openingStyle = 'early_fence';
        wallProbBias = 0.06;
        break;
      case 'shiller':
        wallStyle = 'vertical_corridor';
        openingStyle = 'center_march';
        wallProbBias = 0.04;
        break;
      case 'split':
        wallStyle = 'vertical_corridor';
        openingStyle = 'center_march';
        wallProbBias = 0.05;
        break;
      case 'flank':
        wallStyle = 'flank_trap';
        openingStyle = 'wing_drift';
        wallProbBias = 0.06;
        break;
      case 'gap':
        wallStyle = 'defensive_backwall';
        openingStyle = 'early_fence';
        wallProbBias = 0.03;
        break;
      case 'counter':
        wallStyle = 'defensive_backwall';
        openingStyle = 'mixed';
        wallProbBias = 0.04;
        break;
      case 'evasive':
        wallStyle = 'minimal';
        openingStyle = 'wing_drift';
        wallProbBias = -0.05;
        break;
      case 'tempo':
        wallStyle = 'balanced';
        openingStyle = 'mixed';
        wallProbBias = 0.01;
        break;
      case 'rush':
        wallStyle = 'minimal';
        openingStyle = 'center_march';
        wallProbBias = -0.08;
        break;
    }

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
      playstyle,
      bio,
      equippedBadges,
      isPremium,
      createdAtDaysAgo,
      temperature,
      blunderRate,
      wallProbBias,
      wallStyle,
      openingStyle,
      varietyWindow,
      simulations,
    });
  });

  return personas;
}

export const BOT_PERSONAS: BotPersona[] = buildRoster();

const PERSONA_BY_ID = new Map<string, BotPersona>();
for (const p of BOT_PERSONAS) {
  PERSONA_BY_ID.set(p.userId, p);
}

export function personaById(userId: string): BotPersona | undefined {
  return PERSONA_BY_ID.get(userId);
}
