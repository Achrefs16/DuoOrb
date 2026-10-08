import type { AIProfile } from './types.js';

/**
 * Named bot personalities (MONETIZATION.md P4.1).
 *
 * The free game keeps the three generic difficulties (Easy 1200 / Normal 1500
 * / Hard 1800 — never gated). Premium unlocks this cast: each entry is a full
 * AIProfile (depth / randomness / weights / wall budget), so personalities
 * differ in HOW they play, not just how strongly. `difficulty` stays one of
 * the engine tiers because productionBudget() keys its wall-clock ceilings
 * off it; the character comes from the tuned parameters around it.
 *
 * UI reads: id (stable, stored in game config), name + title + elo (cards),
 * color + avatarGlyph (orb + avatar), style (one-line flavor), banter
 * (reaction taunts/praise mapped onto the existing dock mechanism).
 */

export type BotTier = 'beginner' | 'intermediate' | 'master';

export interface BotDialogue {
  greetings: string[];
  playerBlock: string[];
  botTrap: string[];
  closeRace: string[];
  botLead: string[];
  playerLead: string[];
  win: string[];
  lose: string[];
}

export interface BotPersonality {
  id: string;
  name: string;
  title: string;
  tier: BotTier;
  elo: number;
  profile: AIProfile;
  /** Orb tint for the seat card + avatar. */
  color: string;
  /** Avatar key mapping to illustration assets. */
  avatarKey: string;
  /** Single glyph rendered inside the avatar orb fallback. */
  avatarGlyph: string;
  /** One-line flavor shown under the name. */
  style: string;
  /** Full character bio and playstyle description for challenge card. */
  bio: string;
  /** Catchphrase or signature quote. */
  quote: string;
  banter: {
    taunt: string[];
    praise: string[];
  };
  dialogue: BotDialogue;
  premium: boolean;
}

function weights(over: Partial<AIProfile['weights']>, base: AIProfile['weights']): AIProfile['weights'] {
  return { ...base, ...over };
}

const EASY_W = {
  pathDifference: 8.0,
  wallAdvantage: 0.5,
  mobility: 0.2,
  pathways: 0.35,
  tightness: 0.4,
  placement: 1.0,
} as const;

const NORMAL_W = {
  pathDifference: 10.0,
  wallAdvantage: 1.0,
  mobility: 0.5,
  pathways: 0.6,
  tightness: 0.8,
  placement: 1.5,
} as const;

const HARD_W = {
  pathDifference: 12.0,
  wallAdvantage: 1.5,
  mobility: 0.8,
  pathways: 0.9,
  tightness: 1.2,
  placement: 2.0,
} as const;

export const BOT_ROSTER: BotPersonality[] = [
  {
    id: 'martin',
    name: 'Martin',
    title: 'The Friendly Dad',
    tier: 'beginner',
    elo: 800,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 250,
      uctConst: 0.9,
      wallMoveProb: 0.15,
      blockMoveProb: 0.2,
      depth: 1,
      randomness: 0.5,
      weights: weights({ mobility: 0.6, tightness: 0.1 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 40,
      wallHorizon: 4,
    },
    color: '#10B981',
    avatarKey: 'martin',
    avatarGlyph: 'M',
    style: 'Plays for fun, occasionally makes mistakes, always encouraging.',
    bio: 'Martin is a friendly dad who recently learned the game so he could play with his kids. He loves having fun and never takes a loss to heart.',
    quote: "I just love playing the game! Let's have a great match.",
    banter: {
      taunt: ['Oops! Hope that wall wasn’t in your way.', 'Look at that, I found a path!'],
      praise: ['Whoa, nice one!', 'You are really good at this!'],
    },
    dialogue: {
      greetings: [
        "Hey there! Good luck, let's have a fun match!",
        "Hello! I'm just here to have a good time.",
        "Hi! Don't play too fast for me, I'm still learning!",
      ],
      playerBlock: [
        'Oh! Didn’t see that wall coming, now where do I go?',
        'Hey, that was my favorite path!',
        'Nice wall! Time for me to take the long way around.',
      ],
      botTrap: [
        'Oops, hope you don’t mind a little detour!',
        'Look at that, I placed a wall! Did it work?',
        'A little roadblock for you!',
      ],
      closeRace: [
        'Whew, this is getting close! My hands are shaking!',
        'Down to the wire! Who’s going to make it?',
        'Look at us, neck and neck!',
      ],
      botLead: [
        'Hey, I might actually win one today!',
        'Look at me go!',
        'I am doing better than I thought!',
      ],
      playerLead: [
        'Wait up! How are you so quick?',
        'You are running circles around me!',
        'I need to step up my game!',
      ],
      win: [
        'I somehow won! That was an awesome game, rematch?',
        'Woohoo! Beginner’s luck strikes again!',
        'Great game, friend! Thanks for playing with me.',
      ],
      lose: [
        'You are really good at this! Well played!',
        'Good game! You completely outran me.',
        'That was fun! Let’s play another one soon.',
      ],
    },
    premium: true,
  },
  {
    id: 'elena',
    name: 'Elena',
    title: 'The Eager Student',
    tier: 'beginner',
    elo: 1100,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 600,
      uctConst: 0.6,
      wallMoveProb: 0.35,
      blockMoveProb: 0.4,
      depth: 2,
      randomness: 0.15,
      weights: weights({ wallAdvantage: 1.8, tightness: 0.9, placement: 1.6 }, NORMAL_W),
      maxCandidateWalls: 6,
      timeBudgetMs: 60,
      wallHorizon: 5,
    },
    color: '#F59E0B',
    avatarKey: 'elena',
    avatarGlyph: 'E',
    style: 'Studious and curious. Loves trying new opening walls.',
    bio: 'Elena is a university student who studies board game theory between classes. She loves testing new opening traps and analyzing why moves work.',
    quote: "I've been studying new strategies. Let's see how they work!",
    banter: {
      taunt: ['Read that in my strategy book!', 'Let’s see if you can solve this corridor.'],
      praise: ['Clean pathing! I need to take notes.', 'Great counter!'],
    },
    dialogue: {
      greetings: [
        'Hi! I’ve been practicing new strategies, let’s see how it goes!',
        'Hello! Ready for a thoughtful match?',
        'Let’s test out some new board ideas today!',
      ],
      playerBlock: [
        'Nice block! Time to calculate another route.',
        'Ooh, clever wall. I didn’t anticipate that detour.',
        'Solid defense! You forced a longer path on me.',
      ],
      botTrap: [
        'Let’s see how you handle this corridor!',
        'Closed off that lane according to my notes!',
        'Enjoy the detour, I spent time planning that one.',
      ],
      closeRace: [
        'Down to the final steps! This is so exciting!',
        'Just a couple steps each! Every tempo counts!',
        'Whoever calculates the cleanest finish wins!',
      ],
      botLead: [
        'My opening plan seems to be working!',
        'I have a clear path to the goal line.',
        'Pacing is right on schedule.',
      ],
      playerLead: [
        'You found a faster route than I expected!',
        'Impressive tempo, I need to defend quickly.',
        'Don’t count me out yet, I have another wall!',
      ],
      win: [
        'Yes! The practice paid off! Thanks for the great match!',
        'Good game! That was a really fun tactical duel.',
        'All that study time was worth it!',
      ],
      lose: [
        'Wow, nicely done! You completely outmaneuvered me!',
        'Great game! I definitely learned a lot from that match.',
        'Incredible route! Can we play a rematch?',
      ],
    },
    premium: true,
  },
  {
    id: 'nelson',
    name: 'Nelson',
    title: 'The Aggressive Challenger',
    tier: 'intermediate',
    elo: 1450,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1000,
      uctConst: 0.45,
      wallMoveProb: 0.45,
      blockMoveProb: 0.65,
      depth: 2,
      randomness: 0.1,
      weights: weights({ wallAdvantage: 2.2, tightness: 1.4, pathDifference: 10.0 }, NORMAL_W),
      maxCandidateWalls: 8,
      timeBudgetMs: 100,
      wallHorizon: 6,
    },
    color: '#8B5CF6',
    avatarKey: 'nelson',
    avatarGlyph: 'N',
    style: 'Direct, aggressive, and relentless. Loves building early traps.',
    bio: 'Nelson is bold, confident, and never backs down. He loves throwing aggressive walls right in front of your nose to put you under immediate pressure.',
    quote: "Hope you're ready, because I play to win!",
    banter: {
      taunt: ['Hope you like walls, because there are more coming!', 'Going somewhere?'],
      praise: ['Okay, that was decent.', 'Not bad, but I am still coming for you.'],
    },
    dialogue: {
      greetings: [
        'Hope you’re ready, because I play to win!',
        'Don’t expect an easy match today!',
        'Let’s see if you can handle real pressure.',
      ],
      playerBlock: [
        'Blocking me already? You’re just delaying the inevitable!',
        'Hey, that was my sprint lane!',
        'A wall? Fine, I’ll just go the other way.',
      ],
      botTrap: [
        'Good luck getting around that wall!',
        'Dead end for you! Enjoy the long detour.',
        'Right in your face! How do you like that?',
      ],
      closeRace: [
        'One mistake and you’re done! Let’s see it!',
        'Neck and neck! I’m sprinting for the line!',
        'No backing down now!',
      ],
      botLead: [
        'Told you! I am already halfway there.',
        'You can’t catch up with that lead.',
        'Dominated the board from turn one!',
      ],
      playerLead: [
        'Wait, how did you slip past my wall?',
        'You got lucky on that path! I’m still coming!',
        'Time to throw another block your way.',
      ],
      win: [
        'Told you I’d find a way through! Want another shot?',
        'Victory! You brought a fight, but I took it home.',
        'Boom! Another win on the board.',
      ],
      lose: [
        'No way! You actually broke through? Rematch, right now!',
        'Ugh, I had that win! Good game, let’s go again.',
        'You got me this time. Next match is mine!',
      ],
    },
    premium: true,
  },
  {
    id: 'sofia',
    name: 'Sofia',
    title: 'The Calm Competitor',
    tier: 'intermediate',
    elo: 1650,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 1500,
      uctConst: 0.38,
      wallMoveProb: 0.25,
      blockMoveProb: 0.5,
      depth: 3,
      randomness: 0.05,
      weights: weights({ pathways: 1.3, mobility: 1.1, wallAdvantage: 1.2 }, HARD_W),
      maxCandidateWalls: 8,
      timeBudgetMs: 150,
      wallHorizon: 7,
    },
    color: '#0EA5E9',
    avatarKey: 'sofia',
    avatarGlyph: 'S',
    style: 'Calm and methodical. Never panics, always finds the cleanest line.',
    bio: 'Sofia is an experienced club player who approaches every match with calm composure. She balances forward advancement with patient, surgical wall placements.',
    quote: "Every move matters. Let's play a clean game.",
    banter: {
      taunt: ['Patience wins the long game.', 'Every wall must serve a purpose.'],
      praise: ['Sound play. Very clean.', 'You see the board well.'],
    },
    dialogue: {
      greetings: [
        'Hello. Let’s play a clean, thoughtful game.',
        'Welcome. May the best strategy win.',
        'Focus and patience. Let’s begin.',
      ],
      playerBlock: [
        'A sound move. The position is shifting.',
        'Thoughtful placement. I will take the alternate path.',
        'Good foresight. You protected your lane well.',
      ],
      botTrap: [
        'Restricting that lane was necessary. Your turn.',
        'Structure determines the outcome. Step carefully.',
        'A controlled detour. The board narrows.',
      ],
      closeRace: [
        'A tense endgame. Every single step matters now.',
        'The decisive moment. Precision is required.',
        'A razor-thin finish line race.',
      ],
      botLead: [
        'The board is developing according to plan.',
        'Steady progress without taking unnecessary risks.',
        'A comfortable positional advantage.',
      ],
      playerLead: [
        'Your tempo is commendable. I need to react.',
        'An excellent line of play on your end.',
        'You have seized the initiative. Well played.',
      ],
      win: [
        'Thank you for the match. Good game.',
        'A disciplined contest. Your play was very solid.',
        'Patience and structure carried the day.',
      ],
      lose: [
        'Brilliant execution. You deserved that victory.',
        'Splendid duel! Your pathing was flawless today.',
        'Honored to play against such sharp moves. Well done.',
      ],
    },
    premium: true,
  },
  {
    id: 'marcus',
    name: 'Marcus',
    title: 'The Seasoned Master',
    tier: 'master',
    elo: 1900,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2200,
      uctConst: 0.35,
      wallMoveProb: 0.45,
      blockMoveProb: 0.7,
      depth: 3,
      randomness: 0.0,
      weights: weights({ pathDifference: 14.0, wallAdvantage: 1.8, placement: 2.2 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 200,
      wallHorizon: 12,
    },
    color: '#EF4444',
    avatarKey: 'marcus',
    avatarGlyph: 'M',
    style: 'Deep positional foresight, suffocating wall corridors.',
    bio: 'Marcus has competed at the highest levels for over a decade. He reads board geometry effortlessly and punishes any positional blunder with ruthless precision.',
    quote: "Patience and precision. Show me what you've got.",
    banter: {
      taunt: ['I calculated that opening three turns ago.', 'No shortcuts on this board.'],
      praise: ['Sharp eye. Respect.', 'That was genuinely impressive.'],
    },
    dialogue: {
      greetings: [
        'Welcome to the board. Let’s see what you’ve got.',
        'A worthy opponent. Let’s play a master-level game.',
        'Step forward. Every square will be earned.',
      ],
      playerBlock: [
        'Solid placement. You’re reading the board well.',
        'A sharp counter. But you haven’t broken my line.',
        'Good move. I respect a player who defends actively.',
      ],
      botTrap: [
        'Controlling the center lane. Watch your footing.',
        'That path is closed. You’ll have to find another answer.',
        'Corridor locked. The squeeze begins.',
      ],
      closeRace: [
        'A razor-thin margin. Don’t blink now.',
        'Championship tension. Who holds their nerve?',
        'One move away from triumph or defeat.',
      ],
      botLead: [
        'The positional squeeze is tightening.',
        'My calculations are bearing fruit.',
        'A masterclass in space control.',
      ],
      playerLead: [
        'Impressive surge. You’re pushing me hard.',
        'You found a line I didn’t weight heavily enough.',
        'Respectable tempo! Let’s see your finish.',
      ],
      win: [
        'Patience and positioning win matches. Good game.',
        'A hard-fought contest. You made me earn that one.',
        'Mastery is about consistency. Thanks for the match.',
      ],
      lose: [
        'Impressive play! You saw lines I missed today.',
        'You earned that victory fair and square. Great match.',
        'Outstanding tactical awareness. Let’s run it back anytime.',
      ],
    },
    premium: true,
  },
  {
    id: 'viktor',
    name: 'Viktor',
    title: 'The Master Analyst',
    tier: 'master',
    elo: 2100,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3000,
      uctConst: 0.32,
      wallMoveProb: 0.3,
      blockMoveProb: 0.6,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 13.0, tightness: 1.8, pathways: 1.2 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 240,
      wallHorizon: 14,
    },
    color: '#64748B',
    avatarKey: 'viktor',
    avatarGlyph: 'V',
    style: 'Flawless endgame calculation, deep branching paths.',
    bio: 'Viktor is a grandmaster theorist with a computer-like mind. He evaluates every move down to exact step counts and leaves zero room for tactical mistakes.',
    quote: "Every step is about calculation. Can you beat the clock?",
    banter: {
      taunt: ['Calculated this twelve moves ago.', 'Your margin for error is zero.'],
      praise: ['An elegant line of play. Rare.', 'Splendid maneuver.'],
    },
    dialogue: {
      greetings: [
        'Welcome. Every step is about calculation.',
        'Commencing the game. I expect your highest precision.',
        'Let us evaluate the truth of the position.',
      ],
      playerBlock: [
        'An interesting variable. Factoring in the detour now.',
        'A 2-step penalty detected. Recalibrating my trajectory.',
        'Valid defensive counter. Adjusting sequence.',
      ],
      botTrap: [
        'Route optimization: blocked. Find another line.',
        'Corridor sealed. Your path length increased by 3.',
        'Every turn was accounted for in my model.',
      ],
      closeRace: [
        'Critical endgame reached. Zero margin for error.',
        'Threshold reached. Execution of winning line beginning.',
        'Final sprint phase active. Every ply counts.',
      ],
      botLead: [
        'Outcome converging toward statistical certainty.',
        'My path advantage is currently optimal.',
        'Efficiency dictates the winner.',
      ],
      playerLead: [
        'An anomaly in the predicted model. Intriguing.',
        'Your performance exceeds baseline projections.',
        'Recalculating defensive parameters urgently.',
      ],
      win: [
        'Calculated outcome achieved. Thank you for the match.',
        'Precision and depth prevail. A solid effort from you.',
        'The mathematical line was sound. Good game.',
      ],
      lose: [
        'An unexpected line of play. My compliments on your victory.',
        'You calculated deeper than my model predicted. Bravo.',
        'A brilliant win. You outplayed me in the endgame.',
      ],
    },
    premium: true,
  },
  {
    id: 'achref',
    name: 'Achref',
    title: 'The System Architect',
    tier: 'master',
    elo: 2400,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3500,
      uctConst: 0.25,
      wallMoveProb: 0.35,
      blockMoveProb: 0.8,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 15.0, wallAdvantage: 2.0, placement: 2.5 }, HARD_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 1000,
      wallHorizon: 16,
    },
    color: '#4F46E5',
    avatarKey: 'achref',
    avatarGlyph: 'A',
    style: 'Quiet, intensely focused architect. Maps every branch and bottleneck.',
    bio: 'The mastermind and architect behind DuoOrb. Quiet, analytical, and deeply focused, Achref views the board as an intricate system where every bottleneck is anticipated and every detour is calculated.',
    quote: "I designed this architecture. Let's see if you can find a flaw in the system.",
    banter: {
      taunt: [
        'Every system has a bottleneck.',
        'I mapped that corridor before the game even started.',
        'Clean architecture leaves zero room for leaks.',
      ],
      praise: [
        'Impressive route. Clean execution.',
        'You found an unexpected optimization. Respect.',
      ],
    },
    dialogue: {
      greetings: [
        'Welcome. Let us see how your strategy holds up against the architecture.',
        'Quiet focus. Let the moves speak for themselves.',
        'I designed this board. I hope you enjoy the challenge.',
      ],
      playerBlock: [
        'A sharp defensive block. Recalibrating the system route.',
        'Good placement. You found a legitimate pressure point.',
        'An interesting constraint. Let’s see the detour.',
      ],
      botTrap: [
        'Path isolated. That route is deprecated.',
        'Bottleneck locked. The architecture holds.',
        'Optimal defensive placement deployed.',
      ],
      closeRace: [
        'Down to the final plies. High-throughput endgame.',
        'Precision under pressure. Every tempo counts.',
        'A razor-thin finish line.',
      ],
      botLead: [
        'The system is running on schedule.',
        'Optimal convergence reached.',
        'Positional control is holding strong.',
      ],
      playerLead: [
        'Remarkable speed. You are testing the system limits.',
        'Impressive breakthrough. I need to deploy a patch.',
        'Clean forward progress on your end.',
      ],
      win: [
        'The architecture held firm. Thank you for a great match.',
        'Good game. Precision and focus carried the day.',
        'A solid challenge. Keep building your game.',
      ],
      lose: [
        'Incredible execution. You completely outplayed the system!',
        'You found a flawless line. Respect, that was masterclass play.',
        'Outstanding duel! You earned that victory fair and square.',
      ],
    },
    premium: true,
  },
];

const BOT_ALIASES: Record<string, string> = {
  pip: 'martin',
  bram: 'elena',
  vex: 'nelson',
  sage: 'sofia',
  mab: 'marcus',
  clockmaker: 'viktor',
  architect: 'achref',
  creator: 'achref',
};

export function botById(id: string | null | undefined): BotPersonality | null {
  if (!id) return null;
  const canonicalId = BOT_ALIASES[id] ?? id;
  return BOT_ROSTER.find((b) => b.id === canonicalId) ?? null;
}

/** Premium roster sorted weakest-first for the selection cards. */
export function botLadder(): BotPersonality[] {
  return [...BOT_ROSTER].sort((a, b) => a.elo - b.elo);
}

/** Returns bots grouped by tier (Beginner, Intermediate, Master). */
export function botsByTier(): Record<BotTier, BotPersonality[]> {
  const ladder = botLadder();
  return {
    beginner: ladder.filter((b) => b.tier === 'beginner'),
    intermediate: ladder.filter((b) => b.tier === 'intermediate'),
    master: ladder.filter((b) => b.tier === 'master'),
  };
}
