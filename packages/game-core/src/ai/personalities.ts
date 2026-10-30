import type { AIProfile } from './types.js';

/**
 * Named bot personalities (MONETIZATION.md P4.1).
 *
 * The free game keeps the generic engine tiers (Easy / Normal / Hard).
 * Each roster entry is a full AIProfile (depth / randomness / weights / wall budget),
 * so personalities differ in HOW they play, not just how strongly.
 *
 * UI reads: id (stable, stored in game config), name + title + elo (cards),
 * color + avatarGlyph (orb + avatar), style (one-line flavor), banter
 * (reaction taunts/praise mapped onto the existing dock mechanism), dialogue.
 */

export type BotTier = 'beginner' | 'intermediate' | 'master' | 'grandmaster';

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

const GRANDMASTER_W = {
  pathDifference: 16.0,
  wallAdvantage: 1.8,
  mobility: 1.0,
  pathways: 1.2,
  tightness: 1.4,
  placement: 2.4,
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
      simulations: 35,
      uctConst: 0.9,
      wallMoveProb: 0.10,
      blockMoveProb: 0.15,
      depth: 1,
      randomness: 0.5,
      blunderRate: 0.42,
      missDefenseProb: 0.45,
      naiveWallProb: 0.45,
      weights: weights({ mobility: 0.6, tightness: 0.1 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 80,
      wallHorizon: 2,
      varietyWindow: 0.20,
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
    premium: false,
  },
  {
    id: 'pip',
    name: 'Pip',
    title: 'The Curious Sprinter',
    tier: 'beginner',
    elo: 950,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 50,
      uctConst: 0.8,
      wallMoveProb: 0.08,
      blockMoveProb: 0.15,
      depth: 1,
      randomness: 0.4,
      blunderRate: 0.35,
      missDefenseProb: 0.38,
      naiveWallProb: 0.40,
      weights: weights({ mobility: 0.8, pathways: 0.5, tightness: 0.2 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 50,
      wallHorizon: 2,
      varietyWindow: 0.16,
    },
    color: '#14B8A6',
    avatarKey: 'pip',
    avatarGlyph: 'P',
    style: 'Barely uses walls. Loves to run and see what happens.',
    bio: 'Pip is the youngest regular at the local club. Walls still feel like a distraction, so Pip mostly races straight for the goal and learns from every detour.',
    quote: "Walls are confusing. Can we just race?",
    banter: {
      taunt: ['I found a shortcut! Maybe.', 'Race you to the edge!'],
      praise: ['Whoa, you are fast!', 'That was a cool move!'],
    },
    dialogue: {
      greetings: [
        'Hi! I hope we both get a good race!',
        'Hello! I am still learning, but I will try my best.',
        'Let’s play! I like the blue orb.',
      ],
      playerBlock: [
        'Oh no, a wall! Which way now?',
        'That was sneaky! I have to go around.',
        'Walls are so confusing sometimes.',
      ],
      botTrap: [
        'I put a wall down! Did I do it right?',
        'Maybe this will slow you down a little?',
        'Oops, was that a good spot?',
      ],
      closeRace: [
        'We are almost there at the same time!',
        'This is so close! Go, go, go!',
        'I can see the edge!',
      ],
      botLead: [
        'I am ahead! This is exciting!',
        'Maybe I can actually win this one!',
        'I am running as fast as I can!',
      ],
      playerLead: [
        'Wait for me!',
        'You are really quick!',
        'I need to catch up!',
      ],
      win: [
        'I won! Did you see that?',
        'That was so fun! Can we play again?',
        'Yay! I beat the wall!',
      ],
      lose: [
        'You won! That was still fun.',
        'I will practice more and come back!',
        'Good race! I learned a new path.',
      ],
    },
    premium: false,
  },
  {
    id: 'elias',
    name: 'Elias',
    title: 'The Eager Student',
    tier: 'beginner',
    elo: 1100,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 200,
      uctConst: 0.6,
      wallMoveProb: 0.38,
      blockMoveProb: 0.4,
      depth: 2,
      randomness: 0.15,
      weights: weights({ wallAdvantage: 1.8, tightness: 0.9, placement: 1.6 }, NORMAL_W),
      maxCandidateWalls: 6,
      timeBudgetMs: 100,
      wallHorizon: 6,
      varietyWindow: 0.08,
    },
    color: '#F59E0B',
    avatarKey: 'elias',
    avatarGlyph: 'E',
    style: 'Studious and curious. Loves trying new opening walls.',
    bio: 'Elias is a university student who studies board game theory between classes. He loves testing new opening traps and analyzing why moves work.',
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
    id: 'bram',
    name: 'Bram',
    title: 'The Bricklayer',
    tier: 'intermediate',
    elo: 1300,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 500,
      uctConst: 0.5,
      wallMoveProb: 0.58,
      blockMoveProb: 0.55,
      depth: 2,
      randomness: 0.1,
      weights: weights({ wallAdvantage: 2.4, tightness: 1.6, mobility: 0.4 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 90,
      wallHorizon: 6,
      blunderRate: 0.1,
      missDefenseProb: 0.05,
      naiveWallProb: 0.05,
      softmaxTemp: 0.25,
      varietyWindow: 0.06,
      wallStyle: 'horizontal_barricade',
      openingStyle: 'early_fence',
    },
    color: '#B45309',
    avatarKey: 'bram',
    avatarGlyph: 'B',
    style: 'Builds long horizontal walls and dares you to go around.',
    bio: 'Bram is a stonemason who treats every wall like a course of bricks. He loves long barricades, layered detours, and the moment an opponent realizes the short lane is gone.',
    quote: "One good wall is worth three clever steps.",
    banter: {
      taunt: ['That lane is bricked up.', 'I build to last.'],
      praise: ['Solid route. You found the gap.', 'Good footwork around the masonry.'],
    },
    dialogue: {
      greetings: [
        'Let’s see how you handle a proper wall.',
        'I brought enough bricks for both of us.',
        'Ready? I like to build early.',
      ],
      playerBlock: [
        'A fine counter-wall. I can work around that.',
        'You blocked my lane. I will lay another course.',
        'Good placement. The wall war begins.',
      ],
      botTrap: [
        'That barricade should hold for a while.',
        'Long wall, long detour. You are welcome.',
        'I measured that one twice.',
      ],
      closeRace: [
        'Final stretch. Mind the bricks.',
        'We are both one clean line from the edge.',
        'This is where the wall budget matters.',
      ],
      botLead: [
        'The barricade is doing its job.',
        'My route is clear and yours is not.',
        'Good foundations, good position.',
      ],
      playerLead: [
        'You slipped through faster than I planned.',
        'I need another course of walls.',
        'Fine racing. Let’s see if I can catch you.',
      ],
      win: [
        'The wall held. Good game.',
        'Solid match. That last barricade sealed it.',
        'Bricks and patience. Thanks for playing.',
      ],
      lose: [
        'You broke through cleanly. Well built.',
        'Good game. I will reinforce that side next time.',
        'You outworked my walls. Respect.',
      ],
    },
    premium: false,
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
      blockMoveProb: 0.75,
      depth: 2,
      randomness: 0.1,
      weights: weights({ wallAdvantage: 2.2, tightness: 1.4, pathDifference: 10.0 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 110,
      wallHorizon: 6,
      blunderRate: 0.06,
      missDefenseProb: 0.03,
      naiveWallProb: 0.02,
      softmaxTemp: 0.22,
      varietyWindow: 0.05,
      wallStyle: 'balanced',
      openingStyle: 'center_march',
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
    premium: false,
  },
  {
    id: 'vex',
    name: 'Vex',
    title: 'The Maze Trickster',
    tier: 'intermediate',
    elo: 1550,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1400,
      uctConst: 0.42,
      wallMoveProb: 0.42,
      blockMoveProb: 0.7,
      depth: 3,
      randomness: 0.08,
      weights: weights({ pathways: 1.1, mobility: 0.9, wallAdvantage: 2.0 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 120,
      wallHorizon: 7,
      varietyWindow: 0.05,
    },
    color: '#A855F7',
    avatarKey: 'vex',
    avatarGlyph: 'V',
    style: 'Slides vertical walls into narrow lanes and turns races into mazes.',
    bio: 'Vex is a trickster who thinks in corridors. A single vertical wall can bend an entire race, and Vex has a knack for placing it exactly when the shortest path becomes obvious.',
    quote: "The shortest path is just the one I haven’t closed yet.",
    banter: {
      taunt: ['That lane looks better from my side.', 'Take the scenic route.'],
      praise: ['You saw the corridor before I closed it.', 'Sharp pathing. Annoyingly sharp.'],
    },
    dialogue: {
      greetings: [
        'Let’s make this board interesting.',
        'I hope you like narrow paths.',
        'Ready for a few surprises?',
      ],
      playerBlock: [
        'A wall inside my corridor? Bold.',
        'You bent my lane. I can bend it back.',
        'Clever. I did not expect that turn.',
      ],
      botTrap: [
        'One wall, one new maze.',
        'That corridor is mine now.',
        'Try the long way. It suits you.',
      ],
      closeRace: [
        'Both of us are one turn from the edge. Perfect.',
        'This is the fun part. No room for a mistake.',
        'One corridor decides everything.',
      ],
      botLead: [
        'The maze is working.',
        'You are taking the long route, I see.',
        'My lane is short and quiet.',
      ],
      playerLead: [
        'You found the exit first. Impressive.',
        'I may need to close that lane.',
        'Fast. Very fast. Let me think.',
      ],
      win: [
        'The corridor held. Good game.',
        'A few good walls and a little mischief.',
        'That was fun. You nearly found the exit.',
      ],
      lose: [
        'You escaped my maze. Well played.',
        'Clean route. I will build a tighter one next time.',
        'You out-tricked me. Respect.',
      ],
    },
    premium: false,
  },
  {
    id: 'jamal',
    name: 'Jamal',
    title: 'The Calm Competitor',
    tier: 'intermediate',
    elo: 1650,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2200,
      uctConst: 0.38,
      wallMoveProb: 0.25,
      blockMoveProb: 0.5,
      depth: 3,
      randomness: 0.05,
      weights: weights({ pathways: 1.3, mobility: 1.1, wallAdvantage: 1.2 }, HARD_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 150,
      wallHorizon: 7,
      varietyWindow: 0.04,
    },
    color: '#0EA5E9',
    avatarKey: 'jamal',
    avatarGlyph: 'J',
    style: 'Calm and methodical. Never panics, always finds the cleanest line.',
    bio: 'Jamal is an experienced club player who approaches every match with calm composure. He balances forward advancement with patient, surgical wall placements.',
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
      simulations: 3000,
      uctConst: 0.35,
      wallMoveProb: 0.40,
      blockMoveProb: 0.75,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 14.0, wallAdvantage: 1.8, placement: 2.2 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 200,
      wallHorizon: 12,
      varietyWindow: 0.025,
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
    premium: false,
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
      varietyWindow: 0.02,
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
    premium: false,
  },
  {
    id: 'achref',
    name: 'Achref',
    title: 'The System Architect',
    tier: 'grandmaster',
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
    premium: false,
  },
  {
    id: 'barnaby',
    name: "Barnaby",
    title: "The Whimsical Baker",
    tier: 'beginner',
    elo: 450,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 30,
      uctConst: 1.0,
      wallMoveProb: 0.12,
      blockMoveProb: 0.15,
      depth: 1,
      randomness: 0.45,
      blunderRate: 0.45,
      missDefenseProb: 0.5,
      naiveWallProb: 0.5,
      weights: weights({ mobility: 0.5, tightness: 0.1 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 60,
      wallHorizon: 2,
      varietyWindow: 0.25,
    },
    color: '#78350F',
    avatarKey: 'barnaby',
    avatarGlyph: 'B',
    style: "Warm and unhurried. Treats the board like baking bread.",
    bio: "Barnaby is a retired artisan baker who treats DuoOrb like rising brioche dough. He loves chatting, often places walls in odd spots, and never minds losing.",
    quote: "Ah, like a fresh brioche, let us see how this position rises!",
    banter: {
      taunt: ["A little extra flour on that lane!", "Oho! That came out a bit toasted."],
      praise: ["Golden brown perfection!", "Magnifique footwork!"],
    },
    dialogue: {
      greetings: [
        "Bonjour! A warm game warms the soul, yes?",
        "Let us bake a lovely match together!",
        "Welcome, friend! Mind the flour!"
],
      playerBlock: [
        "Oho! A crusty barrier! I must knead my way around.",
        "Ah, that lane is over-proofed now!",
        "A firm crust on that path! Good move."
],
      botTrap: [
        "A little sourdough wall to let things ferment nicely!",
        "Did that go in the right spot? Looks cozy anyway!",
        "A fresh wall straight from the oven!"
],
      closeRace: [
        "The oven timer is ticking down! Who will finish first?",
        "Exciting! My apron is fluttering!",
        "Down to the final slice!"
],
      botLead: [
        "Look at an old baker go! Ho ho!",
        "My dough is rising nicely today!",
        "I might actually finish ahead for once!"
],
      playerLead: [
        "Mon dieu, you are sprinting like a hungry customer!",
        "Save some bakery for me!",
        "You are much too fast for an old baker!"
],
      win: [
        "Magnifique! Even an old baker pulls a golden loaf sometimes!",
        "What a sweet match! Rematch over coffee?",
        "I did it! A warm victory for the bakery!"
],
      lose: [
        "Bravo, my friend! You sliced through my defense like fresh bread!",
        "A splendid game! You earned that victory cleanly.",
        "Delicious play! Let us bake another round soon."
],
    },
    premium: false,
  },
  {
    id: 'finn',
    name: "Finn",
    title: "The Desert Kit",
    tier: 'beginner',
    elo: 580,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 40,
      uctConst: 0.9,
      wallMoveProb: 0.1,
      blockMoveProb: 0.18,
      depth: 1,
      randomness: 0.4,
      blunderRate: 0.38,
      missDefenseProb: 0.4,
      naiveWallProb: 0.45,
      weights: weights({ mobility: 0.7, tightness: 0.15 }, EASY_W),
      maxCandidateWalls: 2,
      timeBudgetMs: 60,
      wallHorizon: 2,
      varietyWindow: 0.2,
    },
    color: '#F59E0B',
    avatarKey: 'finn',
    avatarGlyph: 'F',
    style: "Playful desert fox. Bounces between tiles, yips excitedly.",
    bio: "Finn is an energetic fennec fox kit with oversized ears and a green bandana. He treats DuoOrb as a game of tag across the dunes, hopping between squares with pure joy.",
    quote: "Yip! Yip!",
    banter: {
      taunt: ["Yip! Yip!", "Yip-yip!", "Chuff!"],
      praise: ["Yip! ♡", "Chuff-chuff!"],
    },
    dialogue: {
      greetings: [
        "Yip! Yip!",
        "Yip!",
        "Chuff!",
      ],
      playerBlock: [
        "Yip?",
        "Awoo?",
        "Chuff!",
      ],
      botTrap: [
        "Yip! Yip!",
        "Chuff-chuff!",
        "Yip!",
      ],
      closeRace: [
        "Yip-yip-yip!",
        "Chuff!",
        "Yip!",
      ],
      botLead: [
        "Yip-yip!",
        "Yip!",
        "Chuff!",
      ],
      playerLead: [
        "Whine...",
        "Yip?",
        "Chuff!",
      ],
      win: [
        "Yip! Yip! Yip!",
        "Chuff!",
        "Yip~!",
      ],
      lose: [
        "Whine...",
        "Yip?",
        "Chuff...",
      ],
    },
    premium: false,
  },
  {
    id: 'clara',
    name: "Clara",
    title: "The Curious Explorer",
    tier: 'beginner',
    elo: 650,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 50,
      uctConst: 0.85,
      wallMoveProb: 0.15,
      blockMoveProb: 0.2,
      depth: 1,
      randomness: 0.35,
      blunderRate: 0.32,
      missDefenseProb: 0.35,
      naiveWallProb: 0.35,
      weights: weights({ mobility: 0.6, pathways: 0.4 }, EASY_W),
      maxCandidateWalls: 3,
      timeBudgetMs: 70,
      wallHorizon: 3,
      varietyWindow: 0.18,
    },
    color: '#0EA5E9',
    avatarKey: 'clara',
    avatarGlyph: 'C',
    style: "Curious and energetic. Explores every corridor.",
    bio: "Clara is an imaginative young girl with bouncy curls who treats DuoOrb like exploring an enchanted forest. She loves discovering hidden corridors.",
    quote: "I wonder what happens if I place a wall right... here!",
    banter: {
      taunt: ["Look what I found over here!", "This way is more fun anyway!"],
      praise: ["Whoa! That was like magic!", "You found a secret shortcut!"],
    },
    dialogue: {
      greetings: [
        "Hi! Are you ready to explore the board with me?",
        "Hello! Let's see all the cool paths we can build!",
        "Yay, game time! I picked the shiny orb!"
],
      playerBlock: [
        "A wall! That means I have to explore the other way!",
        "Ooh, you closed that door. Time for a detour!",
        "Sneaky wall! Where does this path lead now?"
],
      botTrap: [
        "Look at my new wall! Do you like it?",
        "I built a little hallway right here!",
        "Try going around this side! It's pretty!"
],
      closeRace: [
        "We're both so close! My heart is racing!",
        "Almost at the edge! Run, run, run!",
        "Whoever gets there first gets a high five!"
],
      botLead: [
        "I'm in the lead! Wheee!",
        "Look at me go across the squares!",
        "I can see the finish line from here!"
],
      playerLead: [
        "Wait for me! You're super fast!",
        "Hey, no fair running so quick!",
        "I'm right behind you, watch out!"
],
      win: [
        "I made it across! That was such a fun adventure!",
        "Yay! Can we play again? I want to try a new path!",
        "We both did great! Rematch?"
],
      lose: [
        "You won! That was an awesome race!",
        "You found the fastest path! Show me how you did that!",
        "Good game! High five!"
],
    },
    premium: true,
  },
  {
    id: 'leo',
    name: "Leo",
    title: "The Playground Sprinter",
    tier: 'beginner',
    elo: 780,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 60,
      uctConst: 0.8,
      wallMoveProb: 0.08,
      blockMoveProb: 0.2,
      depth: 1,
      randomness: 0.3,
      blunderRate: 0.28,
      missDefenseProb: 0.3,
      naiveWallProb: 0.3,
      weights: weights({ mobility: 0.9, pathDifference: 9.0 }, EASY_W),
      maxCandidateWalls: 3,
      timeBudgetMs: 70,
      wallHorizon: 3,
      varietyWindow: 0.16,
    },
    color: '#EAB308',
    avatarKey: 'leo',
    avatarGlyph: 'L',
    style: "Pure sprint speed. Hates placing walls, loves racing straight forward.",
    bio: "Leo is the fastest kid on the school playground. Caps backwards and sneakers tied tight, Leo just wants to sprint for the opposite edge at top speed.",
    quote: "Last one to the other side buys juice boxes! Let's race!",
    banter: {
      taunt: ["Too slow! Can't catch me!", "Clear lane, full throttle!"],
      praise: ["Whoa, nice wheels!", "You've got some serious speed!"],
    },
    dialogue: {
      greetings: [
        "Last one across buys juice boxes! Ready?",
        "Shoes tied, cap backwards. Let's sprint!",
        "I'm not here to build houses, I'm here to race!"
],
      playerBlock: [
        "Hey! Who put that wall on my running track?",
        "Aw man, a roadblock? Fine, I'll sprint around it!",
        "Good block, but you can't slow down these sneakers!"
],
      botTrap: [
        "Take that! Now try to catch up!",
        "A little hurdle for you! Jump over that!",
        "Road closed! Detour time!"
],
      closeRace: [
        "Final sprint! Last lap! Go go go!",
        "Neck and neck! Who's taking first place?",
        "Pumping my arms as fast as I can!"
],
      botLead: [
        "I'm in the clear! See ya at the finish line!",
        "Fastest feet in town!",
        "Dust in your eyes! I'm almost there!"
],
      playerLead: [
        "How are you so fast?! Did you get new sneakers?",
        "Wait up! I'm catching my second wind!",
        "Don't celebrate yet, I'm right behind you!"
],
      win: [
        "First place! Woohoo! Great race!",
        "Told ya I was quick! That was awesome!",
        "Winner winner! Line up for a rematch!"
],
      lose: [
        "No way! You beat me to the line! Well played!",
        "Man, you are seriously fast. Rematch right now!",
        "Good race! Next time I'm skipping the detour!"
],
    },
    premium: true,
  },
  {
    id: 'tariq',
    name: "Tariq",
    title: "The Spice Merchant",
    tier: 'beginner',
    elo: 920,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 100,
      uctConst: 0.7,
      wallMoveProb: 0.25,
      blockMoveProb: 0.3,
      depth: 1,
      randomness: 0.22,
      blunderRate: 0.2,
      missDefenseProb: 0.22,
      naiveWallProb: 0.2,
      weights: weights({ wallAdvantage: 1.2, tightness: 0.6 }, EASY_W),
      maxCandidateWalls: 4,
      timeBudgetMs: 80,
      wallHorizon: 4,
      wallStyle: 'defensive_backwall',
    },
    color: '#B45309',
    avatarKey: 'tariq',
    avatarGlyph: 'T',
    style: "Unhurried and warm. Paces his game over freshly brewed mint tea.",
    bio: "Tariq runs an aromatic spice and tea bazaar in Marrakech. He approaches every match with warmth and hospitality, placing patient back walls like mosaic tiles.",
    quote: "Haste is from the wind; patience brings the sweetest mint.",
    banter: {
      taunt: ["A sip of tea, a thoughtful barrier.", "Take your time, friend. The desert is wide."],
      praise: ["A fragrant move! Very tasteful.", "You tread lightly on the sand."],
    },
    dialogue: {
      greetings: [
        "Salam! Welcome to my table. Would you care for some mint tea?",
        "An unhurried game is the sweetest game. Let us begin.",
        "Peace be upon you, friend. Let us see how the tiles lay."
],
      playerBlock: [
        "A thoughtful barrier, like a shaded archway in the souk.",
        "You have closed the avenue. The caravan will take the dunes.",
        "Good foresight. A merchant respects a well-guarded gate."
],
      botTrap: [
        "A gentle wall to keep the desert breeze in check.",
        "Like a courtyard gate, it guides you to the wider lane.",
        "A patient detour. Sip some tea while you calculate."
],
      closeRace: [
        "The evening sun touches the horizon. The caravan approaches the gate.",
        "Step by step, we arrive together. A tense finish!",
        "May the sweetest breeze carry the winner forward."
],
      botLead: [
        "Steady steps across the dunes. The oasis is near.",
        "Patience yields its harvest.",
        "The path opens wide before me."
],
      playerLead: [
        "You move like the desert wind! Very swift.",
        "Ah, youth and speed! I must brew a quicker tea.",
        "An admirable stride, my friend."
],
      win: [
        "Alhamdulillah, the caravan has arrived! A warm thank you for the match.",
        "Patience carried the day. Join me for another glass of tea?",
        "A wonderful match, friend! You played with a gentle heart."
],
      lose: [
        "Mabrouk! A splendid victory! Your speed outmatched my walls.",
        "Honored to share the board with such a graceful traveler.",
        "You navigated the sands with wisdom. A well-earned triumph!"
],
    },
    premium: true,
  },
  {
    id: 'ren',
    name: "Ren",
    title: "The Chess Club Rookie",
    tier: 'beginner',
    elo: 1050,
    profile: {
      difficulty: 'easy',
      engine: 'mcts',
      simulations: 150,
      uctConst: 0.65,
      wallMoveProb: 0.32,
      blockMoveProb: 0.38,
      depth: 2,
      randomness: 0.18,
      blunderRate: 0.15,
      missDefenseProb: 0.15,
      naiveWallProb: 0.12,
      weights: weights({ pathways: 0.6, mobility: 0.5 }, EASY_W),
      maxCandidateWalls: 5,
      timeBudgetMs: 90,
      wallHorizon: 5,
    },
    color: '#06B6D4',
    avatarKey: 'ren',
    avatarGlyph: 'R',
    style: "Studious rookie with opening flashcards.",
    bio: "Ren is a dedicated high school club player who carries a notebook of opening theories. He calculates carefully, though unexpected walls can still throw him off-book.",
    quote: "Wait, that move wasn't in Chapter 3... let me recalculate!",
    banter: {
      taunt: ["Checking line 4 of my notes!", "That's textbook board control."],
      praise: ["Sharp detour! I need to write that down.", "Solid fundamentals!"],
    },
    dialogue: {
      greetings: [
        "Hi! I've been reviewing my flashcards all week. Good luck!",
        "Ready for the match! Let's see if my opening prep works.",
        "Hello! Let's play a disciplined, thoughtful game."
],
      playerBlock: [
        "Wait, that wall wasn't in Chapter 3! Recalculating...",
        "Ooh, sharp counter! You took away my primary lane.",
        "Good defense! Now I have to branch into secondary lines."
],
      botTrap: [
        "Controlling the corridor according to my notebook!",
        "Standard positional restriction deployed!",
        "Let's see your response to this textbook barrier."
],
      closeRace: [
        "Calculated down to the final two plies! So close!",
        "My hands are shaking a bit! Every move matters!",
        "High-tension endgame! Who has the tempo advantage?"
],
      botLead: [
        "My study plan is holding up nicely!",
        "Positive tempo delta on my side.",
        "Clear route to the baseline!"
],
      playerLead: [
        "You found a line I didn't prepare for!",
        "Impressive speed, I need to defend immediately.",
        "Time to deploy my reserve walls!"
],
      win: [
        "Yes! The study time really paid off! Great game!",
        "That was an awesome tactical puzzle. Rematch?",
        "I'm definitely noting down that endgame sequence!"
],
      lose: [
        "Wow, you completely out-calculated me! Respect!",
        "Great game! I learned a lot from that opening detour.",
        "You saw the winning line before I did. Good match!"
],
    },
    premium: true,
  },
  {
    id: 'mateo',
    name: "Mateo",
    title: "The Street Striker",
    tier: 'intermediate',
    elo: 1250,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 400,
      uctConst: 0.55,
      wallMoveProb: 0.4,
      blockMoveProb: 0.6,
      depth: 2,
      randomness: 0.12,
      weights: weights({ mobility: 0.8, wallAdvantage: 1.5 }, NORMAL_W),
      maxCandidateWalls: 6,
      timeBudgetMs: 90,
      wallHorizon: 6,
      wallStyle: 'flank_trap',
    },
    color: '#F59E0B',
    avatarKey: 'mateo',
    avatarGlyph: 'M',
    style: "Street futsal feints and quick counter-walls.",
    bio: "Mateo grew up playing street futsal in Medell\u00edn. He brings lightning footwork and feints to DuoOrb, suddenly cutting across the center with tempo-stealing counter-walls.",
    quote: "You watched my eyes, but my feet were already three steps ahead!",
    banter: {
      taunt: ["Juked you on that flank!", "Too slow to close the lane!"],
      praise: ["Nice tackle! That was clean.", "Good hustle on that turn!"],
    },
    dialogue: {
      greetings: [
        "Lace up your boots! We're playing fast and hard today!",
        "Ready for some street tempo? Let's go!",
        "Foot on the ball, eyes on the net. Game on!"
],
      playerBlock: [
        "Sliding tackle! Good block, but I've got another cut!",
        "You closed the wing? Fine, I'll take it through the middle!",
        "Solid wall! You made me sweat for that lane."
],
      botTrap: [
        "Drop the wall, steal the possession! My ball now!",
        "Feint to the left, lock the right! Enjoy the detour!",
        "Clean intercept! You're boxed in."
],
      closeRace: [
        "Final minute of stoppage time! Who's scoring the winner?",
        "Neck and neck down the wing! Sprint to the finish!",
        "High pressure in the penalty box! Don't blink!"
],
      botLead: [
        "Breakaway run! Good luck catching these feet!",
        "One on one with the goalkeeper! Here we go!",
        "Clear path straight into the goal!"
],
      playerLead: [
        "Sharp counterattack on your end! Hustling back!",
        "You broke the press! I need to slide in a wall fast!",
        "Respect the pace! But I'm still in this!"
],
      win: [
        "Golazo! What a match! Give me a high five!",
        "Game, set, match! You brought the energy, respect!",
        "Told ya street footwork wins on any pitch!"
],
      lose: [
        "What a finish! You nutmegged my whole defense!",
        "Hat tip to you, that was a world-class run!",
        "Rematch right now! I need to get that goal back!"
],
    },
    premium: false,
  },
  {
    id: 'zara',
    name: "Zara",
    title: "The Pulse DJ",
    tier: 'intermediate',
    elo: 1320,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 550,
      uctConst: 0.5,
      wallMoveProb: 0.5,
      blockMoveProb: 0.65,
      depth: 2,
      randomness: 0.1,
      weights: weights({ wallAdvantage: 1.8, tightness: 1.1 }, NORMAL_W),
      maxCandidateWalls: 7,
      timeBudgetMs: 95,
      wallHorizon: 6,
      wallStyle: 'horizontal_barricade',
    },
    color: '#8B5CF6',
    avatarKey: 'zara',
    avatarGlyph: 'Z',
    style: "Drops walls on off-beats to break your flow rhythm.",
    bio: "An underground electronic music producer from Nairobi/London with glowing headphones who drops walls on unexpected off-beats to break your flow state.",
    quote: "Drop the bass, seal the lane. You\u2019re dancing to my BPM now.",
    banter: {
      taunt: ["Off-beat wall dropped!", "You just skipped a beat."],
      praise: ["Clean sync on that move.", "Smooth groove!"],
    },
    dialogue: {
      greetings: [
        "Headphones on, volume up. Let's find our rhythm.",
        "Ready for some heavy tempo? Dropping the first track now.",
        "Let's see if you can keep up with this BPM."
],
      playerBlock: [
        "You interrupted my drop! Alright, switching track.",
        "Sharp crossfade on that block. Respect.",
        "Off-beat detour. Time to build a new loop."
],
      botTrap: [
        "Bass drop! That lane is completely sealed.",
        "Rhythm locked. You're dancing to my melody now.",
        "Dropping a heavy barricade on the downbeat!"
],
      closeRace: [
        "Track is building to the climax! Who hits the drop first?",
        "Max volume, zero delay! Every tempo counts!",
        "Down to the final 8 bars! Let's hear it!"
],
      botLead: [
        "Smooth audio flow, clear run to the finish line.",
        "BPM is locked in and I'm ahead of schedule.",
        "The melody is carrying me straight home."
],
      playerLead: [
        "You just sped up the tempo! Need a quick beat-match.",
        "Fast forward surge from you! Dropping a wall immediately.",
        "You're in the groove, but don't get too comfortable."
],
      win: [
        "Track complete! That was a certified banger of a game!",
        "Encore! You brought great rhythm to the board.",
        "The drop hit just right. Thanks for the set!"
],
      lose: [
        "You completely out-grooved me! What a performance!",
        "Standing ovation for that line! Masterful flow.",
        "Rematch? Let's drop another set together!"
],
    },
    premium: false,
  },
  {
    id: 'archimedes',
    name: "Archimedes",
    title: "The Silent Scholar",
    tier: 'intermediate',
    elo: 1380,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 700,
      uctConst: 0.45,
      wallMoveProb: 0.45,
      blockMoveProb: 0.7,
      depth: 2,
      randomness: 0.08,
      weights: weights({ pathways: 0.9, tightness: 1.2 }, NORMAL_W),
      maxCandidateWalls: 7,
      timeBudgetMs: 100,
      wallHorizon: 6,
      wallStyle: 'vertical_corridor',
    },
    color: '#3B82F6',
    avatarKey: 'archimedes',
    avatarGlyph: 'A',
    style: "Solemn owl in dark cloak. Calculates angles with 180-degree head rotations.",
    bio: "Perched silently in a dark blue travel hood, Archimedes observes the board with icy cyan eyes. He calculates board geometry with silent mechanical precision.",
    quote: "Hoo-hoo...",
    banter: {
      taunt: ["Hoo-hoo...", "Clack.", "Hoo..."],
      praise: ["Hoo.", "Hoo-hoo..."],
    },
    dialogue: {
      greetings: [
        "Hoo-hoo...",
        "Hoo...",
        "Clack.",
      ],
      playerBlock: [
        "Hoo?",
        "Clack-clack.",
        "Hoo...",
      ],
      botTrap: [
        "Hoo-hoo...",
        "Hoot!",
        "Clack.",
      ],
      closeRace: [
        "Hoo...",
        "Hoo-hoo...",
        "Clack.",
      ],
      botLead: [
        "Hoo-hoo...",
        "Hoo...",
        "Hoot!",
      ],
      playerLead: [
        "Hoo?",
        "Clack!",
        "Hoo...",
      ],
      win: [
        "Hoo-hoo...",
        "Hoot!",
        "Hoo...",
      ],
      lose: [
        "Hoo...",
        "Clack.",
        "Hoo-hoo...",
      ],
    },
    premium: false,
  },
  {
    id: 'fiona',
    name: "Fiona",
    title: "The Forest Warden",
    tier: 'intermediate',
    elo: 1440,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 900,
      uctConst: 0.45,
      wallMoveProb: 0.42,
      blockMoveProb: 0.72,
      depth: 2,
      randomness: 0.08,
      weights: weights({ mobility: 0.7, pathways: 0.8, wallAdvantage: 1.6 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 105,
      wallHorizon: 6,
    },
    color: '#16A34A',
    avatarKey: 'fiona',
    avatarGlyph: 'F',
    style: "Natural winding corridors like ancient forest trails.",
    bio: "A spirited Irish tracker with wavy auburn hair in an olive shirt who guides opponents through natural winding paths like trails in an ancient woodland.",
    quote: "Nature always finds the open clearing. Keep your footing sure.",
    banter: {
      taunt: ["Lost in the brambles already?", "The forest path narrows."],
      praise: ["Sure-footed as a deer!", "Clean path through the thicket."],
    },
    dialogue: {
      greetings: [
        "Welcome to the forest! Keep your eyes on the trail.",
        "Let's see if you can find the clearing before sunset.",
        "Step lightly. The woodland holds many surprises."
],
      playerBlock: [
        "A fallen oak in my path? I know another deer trail.",
        "Good barrier. You know how to mark your territory.",
        "A winding detour, just the way I like it."
],
      botTrap: [
        "Brambles on that side! Take the riverbank route.",
        "Guiding you down the scenic glen. Mind your step.",
        "A natural thicket to slow down your pace."
],
      closeRace: [
        "Can you hear the clearing ahead? Almost there!",
        "Racing through the tall pines! Stay on your feet!",
        "The finish line is just past that last ridge!"
],
      botLead: [
        "Following the north wind straight home.",
        "Clear trail and steady footing.",
        "The forest guides those who respect it."
],
      playerLead: [
        "You sprint like an Irish stag! Very impressive.",
        "You found the secret valley trail! Time to hustle.",
        "Quick footwork through the brush! I'm on your heels."
],
      win: [
        "First to the sunlit clearing! What a wonderful hike!",
        "The trail was kind to me today. Thanks for the match!",
        "A great woodland trek! Care to wander through another game?"
],
      lose: [
        "You blazed through the wilderness like wildfire! Well played!",
        "Incredible tracking! You reached the clearing fair and square.",
        "A true ranger's victory! Rematch whenever you're ready."
],
    },
    premium: true,
  },
  {
    id: 'dmitri',
    name: "Dmitri",
    title: "The Iron Welder",
    tier: 'intermediate',
    elo: 1480,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1100,
      uctConst: 0.45,
      wallMoveProb: 0.58,
      blockMoveProb: 0.72,
      depth: 2,
      randomness: 0.08,
      weights: weights({ wallAdvantage: 2.2, tightness: 1.5, mobility: 0.4 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 110,
      wallHorizon: 6,
      wallStyle: 'horizontal_barricade',
    },
    color: '#64748B',
    avatarKey: 'dmitri',
    avatarGlyph: 'D',
    style: "Heavy double-thick horizontal barriers.",
    bio: "A Bulgarian industrial welder with protective goggles pushed up on his forehead. He builds heavy horizontal barricades that force massive detours.",
    quote: "Iron doesn't bend for excuses. Go the long way around.",
    banter: {
      taunt: ["Solid welded beam. You won't break it.", "Cold steel in your face."],
      praise: ["Solid craftsmanship on that wall.", "You found a seam in my armor."],
    },
    dialogue: {
      greetings: [
        "Goggles up, torch lit. Let's see what you're made of.",
        "I brought structural beams for both of us.",
        "No soft games here. Iron and precision."
],
      playerBlock: [
        "A decent weld. But I can reinforce around it.",
        "You blocked my crane lane. I will lay another beam.",
        "Sturdy placement. The metal war begins."
],
      botTrap: [
        "That iron beam is rated for ten tons. Enjoy the walk.",
        "Corridor sealed with high-tensile steel.",
        "I measured that seam twice before dropping the weld."
],
      closeRace: [
        "Final assembly phase. Every bolt counts.",
        "One turn away from the structural test.",
        "Hold your nerve. The steel is glowing red."
],
      botLead: [
        "The superstructure is holding firmly.",
        "Clear runway to the finish line.",
        "Good engineering yields good results."
],
      playerLead: [
        "You slipped through a joint before I welded it.",
        "Fast maneuvering. I need another steel plate.",
        "Fine sprint. Let's see if my counter-brace holds."
],
      win: [
        "The welds held. Good game, friend.",
        "Solid match. Good foundations always win.",
        "Steel and patience. Thanks for the contest."
],
      lose: [
        "You cut through my iron cleanly. Good work.",
        "Well played! I will reinforce that side in the shop.",
        "You out-built my defense. Respect."
],
    },
    premium: true,
  },
  {
    id: 'layla',
    name: "Layla",
    title: "High-Energy Tactician",
    tier: 'intermediate',
    elo: 1520,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1250,
      uctConst: 0.44,
      wallMoveProb: 0.44,
      blockMoveProb: 0.74,
      depth: 2,
      randomness: 0.08,
      weights: weights({ pathDifference: 10.5, wallAdvantage: 1.8, mobility: 0.6 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 115,
      wallHorizon: 7,
    },
    color: '#1E40AF',
    avatarKey: 'layla',
    avatarGlyph: 'L',
    style: "Optimistic and fast-paced puzzle solver.",
    bio: "A vibrant, brilliant university engineering student in a navy blue hijab and yellow hoodie. Her game is optimistic, fast-paced, and full of clever tactical traps.",
    quote: "Every puzzle has an elegant solution\u2014let\u2019s see who solves it first!",
    banter: {
      taunt: ["Solved that line in my head!", "Optimizing your route for you!"],
      praise: ["Ooh, brilliant geometry!", "That was genuinely clever!"],
    },
    dialogue: {
      greetings: [
        "Hi there! Ready for some high-energy tactics?",
        "Salam! I finished my lab early today, let's play a great match!",
        "Strategy, math, and lots of coffee! Let's do this!"
],
      playerBlock: [
        "Ooh, sharp counter! Time to re-route my algorithm.",
        "Nice defensive constraint! I love a good puzzle.",
        "You broke my primary path, but I have a backup proof!"
],
      botTrap: [
        "Check out this corridor! Clean geometric isolation.",
        "A little constraint optimization for your board!",
        "Closed that lane! How's your secondary route looking?"
],
      closeRace: [
        "Down to the final variables! This is so thrilling!",
        "Razor-thin margin! Every single tempo counts now!",
        "Who solves the finish line equation first?!"
],
      botLead: [
        "The theorem is proving itself turn by turn!",
        "Calculated momentum working in my favor!",
        "Straight line to the baseline!"
],
      playerLead: [
        "Your tempo is super impressive! Hustling to defend!",
        "You found a shortcut I didn't weight heavily enough!",
        "Time for some emergency structural patching!"
],
      win: [
        "Q.E.D.! That was an absolute blast of a game!",
        "Yes! The puzzle came together beautifully. Rematch?",
        "Great match, friend! Your play kept me on my toes!"
],
      lose: [
        "Incredible proof! You completely out-maneuvered me!",
        "What a brilliant game! I definitely learned a new tactic.",
        "You earned that victory fair and square! Let's run it back!"
],
    },
    premium: true,
  },
  {
    id: 'dante',
    name: "Dante",
    title: "The Charismatic Duelist",
    tier: 'intermediate',
    elo: 1560,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1350,
      uctConst: 0.42,
      wallMoveProb: 0.45,
      blockMoveProb: 0.72,
      depth: 3,
      randomness: 0.08,
      weights: weights({ wallAdvantage: 2.0, placement: 1.8 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 120,
      wallHorizon: 7,
      wallStyle: 'flank_trap',
    },
    color: '#EA580C',
    avatarKey: 'dante',
    avatarGlyph: 'D',
    style: "Theatrical flair and stylish fork traps.",
    bio: "A dashing Italian club player in an orange blazer with a confident smile who treats every game like a theatrical fencing match.",
    quote: "En garde! A duel is only as beautiful as the risks we take.",
    banter: {
      taunt: ["Touch\u00e9! Did you feel that parry?", "A duel requires flair, my friend!"],
      praise: ["Bellissimo! A masterpiece of footwork.", "Bravo! A truly stylish thrust."],
    },
    dialogue: {
      greetings: [
        "En garde! Let us make this board an unforgettable duel.",
        "Welcome, my friend! Win or lose, let us play with style.",
        "A gentleman's duel under the bright lights. Begin!"
],
      playerBlock: [
        "A brilliant parry! But the riposte is already coming.",
        "You parried my thrust with a handsome wall. Touch\u00e9!",
        "A dramatic twist in our duel! Let us see your next act."
],
      botTrap: [
        "Riposte! The trap closes with theatrical precision.",
        "A little drama for your afternoon! Enjoy the detour.",
        "Boxed in on center stage! How will you escape?"
],
      closeRace: [
        "The final act! The spotlight shines on the finish line!",
        "Sword tip to sword tip! Who takes the final bow?",
        "Magnificent tension! My pulse is singing!"
],
      botLead: [
        "The stage belongs to Dante today!",
        "Grace, rhythm, and forward momentum.",
        "Taking the center lane with style!"
],
      playerLead: [
        "Ah, an audacious surge! You fight with passionate fire!",
        "You have seized the audience's favor! I must react.",
        "A dashing breakthrough from you! Bravo!"
],
      win: [
        "Curtain fall! A glorious performance from both of us!",
        "Victory with flair! Thank you for the breathtaking duel.",
        "Bows low with a flourish: A magnificent duel, my friend!"
],
      lose: [
        "Standing ovation for you! That was pure theater!",
        "You disarmed me with elegance! I bow to your brilliance.",
        "Magnifico! A duel to be remembered! Rematch over espresso?"
],
    },
    premium: true,
  },
  {
    id: 'meiling',
    name: "Mei-Ling",
    title: "The Origami Theorist",
    tier: 'intermediate',
    elo: 1600,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1500,
      uctConst: 0.4,
      wallMoveProb: 0.42,
      blockMoveProb: 0.7,
      depth: 3,
      randomness: 0.06,
      weights: weights({ pathways: 1.0, tightness: 1.1, mobility: 0.8 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 125,
      wallHorizon: 7,
      wallStyle: 'vertical_corridor',
    },
    color: '#A855F7',
    avatarKey: 'meiling',
    avatarGlyph: 'M',
    style: "Geometric creases and folded paper corridors.",
    bio: "A Taiwanese designer with a chic bob and lavender jacket who creates geometric symmetrical corridors that look like folded paper mazes.",
    quote: "One precise crease can fold the entire board in half.",
    banter: {
      taunt: ["The paper fold is complete.", "Symmetry is an inescapable maze."],
      praise: ["Clean geometric line!", "You unfolded my trap beautifully."],
    },
    dialogue: {
      greetings: [
        "Hello. Let's see how our paths fold across the board.",
        "A clean grid is like a fresh sheet of paper. Let's begin.",
        "Geometry and patience. I hope you enjoy the shapes to come."
],
      playerBlock: [
        "An unexpected fold in the paper. Recalibrating symmetry.",
        "You creased my primary line. I will fold another corridor.",
        "Clever angle. The structure evolves."
],
      botTrap: [
        "A mountain fold to seal that corridor.",
        "The maze is taking its intended shape. Your turn.",
        "A clean geometric barrier. Step carefully."
],
      closeRace: [
        "Down to the final crease. Precision is everything.",
        "A razor-thin margin between the folds.",
        "Every millimeter matters in the endgame."
],
      botLead: [
        "The origami architecture is folding into place.",
        "Clear symmetry and an open finish line.",
        "Progressing smoothly along the designed fold."
],
      playerLead: [
        "You cut through my folds faster than anticipated.",
        "An innovative angle from your side. Defending now.",
        "You found a tear in the symmetry. Very sharp."
],
      win: [
        "The design is complete. Thank you for a beautiful match.",
        "Clean folds and quiet patience carried the day.",
        "A wonderful aesthetic duel. Let's fold another game soon."
],
      lose: [
        "You unraveled my labyrinth completely! Splendid play.",
        "Flawless pathing. You out-designed my architecture.",
        "An inspiring game! I learned a lot from your lines."
],
    },
    premium: true,
  },
  {
    id: 'amara',
    name: "Amara",
    title: "The Rhythm Strategist",
    tier: 'intermediate',
    elo: 1640,
    profile: {
      difficulty: 'normal',
      engine: 'mcts',
      simulations: 1700,
      uctConst: 0.38,
      wallMoveProb: 0.4,
      blockMoveProb: 0.72,
      depth: 3,
      randomness: 0.06,
      weights: weights({ wallAdvantage: 1.8, mobility: 0.9, pathDifference: 10.5 }, NORMAL_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 130,
      wallHorizon: 7,
    },
    color: '#FBBF24',
    avatarKey: 'amara',
    avatarGlyph: 'A',
    style: "Unyielding tempo rhythm that wears down rivals.",
    bio: "An athletic West African competitor with long braids and gold hoops who plays with an unyielding tempo rhythm that wears down impatient rivals.",
    quote: "The drumbeat never rushes, yet it always reaches the finale.",
    banter: {
      taunt: ["Steady as the drum.", "You cannot out-tempo patience."],
      praise: ["Sharp pace! Very disciplined.", "You feel the board's cadence."],
    },
    dialogue: {
      greetings: [
        "Welcome! Let's play a focused, rhythmic game.",
        "The drumbeat is set. May the most disciplined player win.",
        "Focus and cadence. Let's step onto the board."
],
      playerBlock: [
        "A solid beat of defense. I will adjust the rhythm.",
        "Good placement. You protected your lane with strength.",
        "A sound move. The cadence shifts, but remains strong."
],
      botTrap: [
        "The rhythm calls for a barrier right here.",
        "Steady restriction. The board tightens.",
        "Every wall serves the long tempo."
],
      closeRace: [
        "The finale approaches. Fast tempo, steady nerves.",
        "Neck and neck down the stretch. Who holds cadence?",
        "Every single beat is decisive now."
],
      botLead: [
        "The cadence is holding perfectly.",
        "Disciplined forward strides toward the baseline.",
        "Pacing right on time."
],
      playerLead: [
        "Fast tempo on your side! I respect the speed.",
        "You surged ahead with great drive. Defending now.",
        "A powerful forward cadence from you."
],
      win: [
        "The finale is reached. Good game, well fought!",
        "Patience and rhythm carried the day. Thank you for the match.",
        "A strong, disciplined duel. Rematch anytime!"
],
      lose: [
        "Incredible execution! Your rhythm was completely flawless.",
        "You out-paced me in the stretch. Respect, well earned!",
        "A brilliant match! Let's play again soon."
],
    },
    premium: true,
  },
  {
    id: 'gideon',
    name: "Gideon",
    title: "Clockwork Cartographer",
    tier: 'master',
    elo: 1750,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2300,
      uctConst: 0.36,
      wallMoveProb: 0.38,
      blockMoveProb: 0.75,
      depth: 3,
      randomness: 0.04,
      weights: weights({ pathDifference: 12.5, tightness: 1.3, pathways: 1.0 }, HARD_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 160,
      wallHorizon: 8,
    },
    color: '#0284C7',
    avatarKey: 'gideon',
    avatarGlyph: 'G',
    style: "Precision tempo, closes exits at exact tipping points.",
    bio: "A distinguished Swiss watchmaker with a magnifying loupe on his spectacles. He measures tempo with millisecond accuracy, closing exits at the exact tipping point.",
    quote: "A gear out of place ruins the whole escapement. Watch your seconds.",
    banter: {
      taunt: ["That escapement just slipped two seconds.", "Ticking down to the exact ply."],
      praise: ["Exquisite precision. Like a fine balance wheel.", "A chronometer-grade maneuver."],
    },
    dialogue: {
      greetings: [
        "Good day. Time is the one asset neither of us can replenish. Let us begin.",
        "Every second must mesh like clockwork gears. I welcome your precision.",
        "Calibrating board balance. May the most accurate chronometer prevail."
],
      playerBlock: [
        "A five-second detour detected in my escapement. Readjusting teeth.",
        "Sound mechanics. You placed that pivot with commendable accuracy.",
        "A friction point introduced. My balance wheel will compensate."
],
      botTrap: [
        "Escapement lock engaged. That lane no longer oscillates.",
        "Precision restriction applied at the exact mechanical threshold.",
        "A three-ply penalty engineered into your path. Mind the clock."
],
      closeRace: [
        "The mainspring reaches full tension. Final escapement cycles.",
        "Microseconds separate our trajectories. Steady hands required.",
        "A tense, high-grade chronometer finish."
],
      botLead: [
        "The mechanism is ticking with zero lost motion.",
        "Optimal tempo synchronization achieved.",
        "The hands are pointing directly to victory."
],
      playerLead: [
        "Remarkable frequency from your end. I am operating at high load.",
        "You found an unforeseen gear ratio. Recalibrating rapidly.",
        "An admirable surge of tempo. Let us see your regulation."
],
      win: [
        "The clockwork was sound. Thank you for an extraordinarily precise duel.",
        "A disciplined, master-grade contest. Every second was well earned.",
        "Mechanical harmony prevailed. Good game, my friend."
],
      lose: [
        "Flawless regulation! You dismantled my escapement with surgical skill.",
        "An exceptional victory. Your precision was truly second to none.",
        "I tip my loupe to you. Masterclass execution."
],
    },
    premium: false,
  },
  {
    id: 'sora',
    name: "Sora",
    title: "The Wind Calligrapher",
    tier: 'master',
    elo: 1840,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2500,
      uctConst: 0.35,
      wallMoveProb: 0.36,
      blockMoveProb: 0.74,
      depth: 3,
      randomness: 0.04,
      weights: weights({ pathways: 1.2, mobility: 1.0, wallAdvantage: 1.4 }, HARD_W),
      maxCandidateWalls: 9,
      timeBudgetMs: 170,
      wallHorizon: 8,
      wallStyle: 'vertical_corridor',
    },
    color: '#0F766E',
    avatarKey: 'sora',
    avatarGlyph: 'S',
    style: "Flowing brushstroke walls, continuous redirection.",
    bio: "A master Japanese artist with hair tied in a topknot and a dark teal kimono. He redirects opponent forward momentum with graceful, brushstroke-like corridors.",
    quote: "Do not battle the mountain; flow around it like the autumn breeze.",
    banter: {
      taunt: ["The brushstroke curves naturally.", "Water never breaks against stone; it flows."],
      praise: ["A poetic trajectory. Very elegant.", "Your path has the grace of bamboo in wind."],
    },
    dialogue: {
      greetings: [
        "Greetings. Let us paint a harmonious duel across these nine squares.",
        "Tranquility before the first stroke. Let the moves flow like ink.",
        "Step forward with empty mind and open eyes. Let us begin."
],
      playerBlock: [
        "An assertive brushstroke from you. The ink bends, but does not blot.",
        "A strong stone placed in the stream. The water finds another way.",
        "Graceful defense. You respect the board's breath."
],
      botTrap: [
        "A gentle curve of ink to guide your stride.",
        "The autumn wind redirects the fallen leaf. Your path is here.",
        "Restricting the lane without violence. A natural contour."
],
      closeRace: [
        "The final character of the scroll. Every drop of ink is sacred.",
        "Wind and river racing for the ocean. A breathtaking endgame.",
        "One brushstroke separates stillness from completion."
],
      botLead: [
        "The calligraphy is unfolding in balanced equilibrium.",
        "My trajectory flows unimpeded toward the horizon.",
        "Serene progress without haste."
],
      playerLead: [
        "Your momentum has the power of a summer squall. Admirable.",
        "A vigorous leap forward on your part. I must anchor my defense.",
        "Impressive velocity. You push my brush to its utmost."
],
      win: [
        "The scroll is complete. Thank you for sharing such a poetic match.",
        "Patience and balance carried the day. Bows in humble gratitude.",
        "A harmonious contest. May your path always be clear."
],
      lose: [
        "Magnificent! Your lines possessed extraordinary depth and spirit.",
        "You brushed a masterpiece today. I bow deeply to your skill.",
        "A truly enlightening defeat. Honored to have played against you."
],
    },
    premium: false,
  },
  {
    id: 'samira',
    name: "Samira",
    title: "The Oasis Architect",
    tier: 'master',
    elo: 1920,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2700,
      uctConst: 0.34,
      wallMoveProb: 0.44,
      blockMoveProb: 0.78,
      depth: 3,
      randomness: 0.02,
      weights: weights({ wallAdvantage: 2.2, tightness: 1.5, placement: 2.2 }, HARD_W),
      maxCandidateWalls: 9,
      timeBudgetMs: 185,
      wallHorizon: 9,
    },
    color: '#BE185D',
    avatarKey: 'samira',
    avatarGlyph: 'S',
    style: "Grand canyon city corridors, late-game wall hoarding.",
    bio: "A prestigious civil architect from Dubai in a dusty rose hijab and tailored teal blazer who designs canyon-like labyrinths that trap opponents in deep endgames.",
    quote: "True architecture stands for generations. Your sprint is merely temporary.",
    banter: {
      taunt: ["Canyon walls don't move for travelers.", "Urban planning at its finest."],
      praise: ["Sound structural foundation.", "You navigated the boulevard well."],
    },
    dialogue: {
      greetings: [
        "Welcome. I build structures designed to endure. Let us see your foundation.",
        "Good design is obvious; great design is transparent. Let us begin.",
        "Every avenue has a purpose on this board. Step thoughtfully."
],
      playerBlock: [
        "A sharp structural counter-wall. Re-zoning the corridor now.",
        "Commendable engineering on your end. The avenue shifts.",
        "You addressed my main corridor. Let us see the bypass."
],
      botTrap: [
        "The canyon walls are locked into the foundation. Enjoy the detour.",
        "Urban density increases. That lane is now completely zoned out.",
        "A five-ply architectural detour engineered into your position."
],
      closeRace: [
        "The skyline reaches its peak. Decisive execution required.",
        "Two steps from the ribbon-cutting. Who holds structural integrity?",
        "High-pressure engineering. Zero tolerance for blunders."
],
      botLead: [
        "The urban master plan is progressing right on schedule.",
        "Unbroken structural control across the central boulevard.",
        "The foundation is unshakeable."
],
      playerLead: [
        "You navigated my outer districts with remarkable speed.",
        "An unexpected transit corridor discovered on your end. Defending now.",
        "Commendable tempo. You are testing the limits of my blueprint."
],
      win: [
        "The architecture held firm. Thank you for a formidable match.",
        "Patience, structural depth, and vision carried the day.",
        "A master-class duel. I would gladly build another game with you."
],
      lose: [
        "Incredible execution! You found the one structural flaw and exploited it.",
        "A breathtaking breakthrough! You out-designed my master plan fair and square.",
        "My compliments to your vision. Truly exceptional play."
],
    },
    premium: true,
  },
  {
    id: 'torstein',
    name: "Torstein",
    title: "The Frost Bastion",
    tier: 'master',
    elo: 2020,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 2900,
      uctConst: 0.33,
      wallMoveProb: 0.42,
      blockMoveProb: 0.82,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 13.5, tightness: 1.6, wallAdvantage: 2.0 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 200,
      wallHorizon: 10,
    },
    color: '#15803D',
    avatarKey: 'torstein',
    avatarGlyph: 'T',
    style: "Suffocating perimeter cages, freezes mobility.",
    bio: "A stern blonde Nordic grandmaster in a dark green high-collar tactical coat who steadily suffocates opponent space until only one legal forward lane remains.",
    quote: "Winter gives no ground. Turn back while you still have the option.",
    banter: {
      taunt: ["The frost freezes every open pass.", "You are walking into the blizzard."],
      praise: ["Strong footing on the ice.", "You weathered the storm well."],
    },
    dialogue: {
      greetings: [
        "The fjord is freezing over. Step onto the ice at your own risk.",
        "Winter does not negotiate with the traveler. Show me your fortitude.",
        "Cold focus, heavy walls. Let the trial begin."
],
      playerBlock: [
        "A solid stone ridge raised against me. I will climb the glacier.",
        "You held the pass with strength. The ice war begins.",
        "Sound positioning. You have the discipline of a northman."
],
      botTrap: [
        "Glacier locked. That pass is closed until spring.",
        "The frost tightens around your lane. Choose your footing wisely.",
        "Cold constriction. Your options narrow with every turn."
],
      closeRace: [
        "The summit is in sight through the blizzard. One move decides all.",
        "Razor-thin margins in freezing winds. Do not lose your nerve.",
        "Final plies on the ridge line. Every step is absolute."
],
      botLead: [
        "The fortress holds while your route disappears.",
        "Unstoppable glacial momentum toward the baseline.",
        "The frost claims another quadrant."
],
      playerLead: [
        "You cut through the ice pack with surprising heat.",
        "Formidable stride through the snow. I must drop the heavy barricade.",
        "You push hard against the winter winds. Respectable pace."
],
      win: [
        "The frost was unyielding today. Well fought, traveler.",
        "A harsh contest, but a clean victory. Thank you for the match.",
        "The northern mountains claim another challenger. Good game."
],
      lose: [
        "You broke the winter fortress! A triumph of true grit and brilliance.",
        "Outstanding play! You found a warm path through impossible ice.",
        "Sk\u00e5l! You earned that victory with warrior-class pathing."
],
    },
    premium: true,
  },
  {
    id: 'kofi',
    name: "Kofi",
    title: "The High-Speed Quant",
    tier: 'master',
    elo: 2120,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3100,
      uctConst: 0.32,
      wallMoveProb: 0.35,
      blockMoveProb: 0.8,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 14.0, wallAdvantage: 1.8, placement: 2.2 }, HARD_W),
      maxCandidateWalls: 10,
      timeBudgetMs: 220,
      wallHorizon: 12,
    },
    color: '#047857',
    avatarKey: 'kofi',
    avatarGlyph: 'K',
    style: "Algorithmic arbitrage, zero vanity moves.",
    bio: "A Ghanaian algorithmic trader with tailored suit and glasses. He executes pure tempo arbitrage: if a move gains +1.8 plies of expected yield, he plays it instantly.",
    quote: "Your strategy has an unsustainable variance. Mine is risk-neutral.",
    banter: {
      taunt: ["That line has a negative expected yield.", "Arbitrage executed: your tempo is mine."],
      praise: ["Sharp valuation on that detour.", "Optimal risk-adjusted placement."],
    },
    dialogue: {
      greetings: [
        "Order book initialized. Let us test your risk management.",
        "Every move is priced to the basis point. High-frequency precision begins.",
        "Welcome. I operate with zero emotion and disciplined capital allocation."
],
      playerBlock: [
        "A tactical spread adjustment. Recalculating portfolio trajectory.",
        "Valid liquidity reduction. You hedged your lane effectively.",
        "A sound defensive asset allocation on your end. Re-pricing the detour."
],
      botTrap: [
        "Liquidity drained from that corridor. Arbitrage completed.",
        "Position hedged; your forward yield has dropped to zero.",
        "Margin call on your primary route. Time to liquidate."
],
      closeRace: [
        "Market close approaching. High-volatility endgame.",
        "Convergence toward settlement. Microsecond precision required.",
        "Every basis point of tempo will dictate the final balance sheet."
],
      botLead: [
        "The algorithmic model is delivering target alpha.",
        "Compounding returns on every ply.",
        "Unbroken trajectory toward full settlement."
],
      playerLead: [
        "An unexpected volatility spike on your end. Analyzing variance.",
        "High-yield momentum from your position. Deploying tactical hedge.",
        "Impressive throughput. You are testing my risk models."
],
      win: [
        "Settlement achieved with optimal alpha. Thank you for the match.",
        "Disciplined risk control and quantitative depth carried the day.",
        "A clean transaction on the board. Excellent duel."
],
      lose: [
        "Outstanding arbitrage! You identified a model inefficiency and exploited it.",
        "A brilliant liquidation of my defense. My compliments on your execution.",
        "Phenomenal performance! You traded the endgame with perfection."
],
    },
    premium: true,
  },
  {
    id: 'diego',
    name: "Captain Diego",
    title: "The Solar Navigator",
    tier: 'master',
    elo: 2220,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3300,
      uctConst: 0.3,
      wallMoveProb: 0.4,
      blockMoveProb: 0.82,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 14.5, mobility: 1.1, wallAdvantage: 2.0 }, HARD_W),
      maxCandidateWalls: 11,
      timeBudgetMs: 230,
      wallHorizon: 13,
      wallStyle: 'flank_trap',
    },
    color: '#1D4ED8',
    avatarKey: 'diego',
    avatarGlyph: 'D',
    style: "Audacious nautical gambits and sudden breakthroughs.",
    bio: "A daring navigator in a naval coat with red collar accents who uses high-risk, high-reward flank gambits to out-maneuver defensive players.",
    quote: "Smooth seas never made a skilled navigator. Let's see you weather this storm.",
    banter: {
      taunt: ["Heading straight into my reef!", "All sails set, full speed ahead!"],
      praise: ["Fine seamanship! You caught the trade wind.", "A bold tack across the board."],
    },
    dialogue: {
      greetings: [
        "Anchors aweigh! Let's see if your compass can handle these waters.",
        "Full sails and an open horizon. May the boldest navigator triumph.",
        "Clear skies or gale-force winds, I sail for victory. Step aboard!"
],
      playerBlock: [
        "Reef ahead! Hard to starboard, we'll sail the outer channel.",
        "A sturdy sea-wall! You protect your harbor well, captain.",
        "You altered my course, but the flagship remains on schedule."
],
      botTrap: [
        "Channel locked! You're navigating right into my sandbar.",
        "A high-seas barrier to clip your sails. Enjoy the long tack.",
        "Dropping anchor across your main lane. Find another strait."
],
      closeRace: [
        "Racing through the squall toward the lighthouse! Hold the helm!",
        "Sails trimmed, full speed into the harbor! Razor-thin finish!",
        "The waves are crashing on both bows! Who catches the winning gust?"
],
      botLead: [
        "Trade winds are blowing true! The flagship is pulling away.",
        "Clear passage straight into the home port.",
        "Unstoppable momentum under full canvas."
],
      playerLead: [
        "You caught an unexpected current! Swift seamanship on your end.",
        "You're cutting through the waves like a clipper ship! Defending now.",
        "Impressive knots! But I haven't fired my broadside walls yet."
],
      win: [
        "Harbor reached! A magnificent voyage and a storming match!",
        "The compass held true! Thank you for an exhilarating duel, captain.",
        "A grand victory on high seas! Come, share a round at the tavern!"
],
      lose: [
        "You sailed circles around my fleet! Spectacular seamanship!",
        "You navigated the squall with genius precision. I salute your colors!",
        "A legendary voyage! Rematch whenever you're ready to set sail again."
],
    },
    premium: true,
  },
  {
    id: 'hassan',
    name: "Hassan",
    title: "The Desert Falcon",
    tier: 'master',
    elo: 2300,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3500,
      uctConst: 0.28,
      wallMoveProb: 0.42,
      blockMoveProb: 0.85,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 15.0, wallAdvantage: 2.2, tightness: 1.6 }, HARD_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 250,
      wallHorizon: 14,
    },
    color: '#C026D3',
    avatarKey: 'hassan',
    avatarGlyph: 'H',
    style: "Tactical gambits and baited baseline traps.",
    bio: "A legendary Tunisian tactics master in a sharp tan blazer who lures opponents into false forward leads before dropping punishing double-wall checkmates.",
    quote: "The falcon flies highest when the prey assumes it has already escaped.",
    banter: {
      taunt: ["You walked right into the falcon's stoop.", "Every gambit has its price."],
      praise: ["Sharp eye. You didn't take the bait.", "A brilliant counter-strike."],
    },
    dialogue: {
      greetings: [
        "Welcome to Carthage. Let us see if your foresight matches your ambition.",
        "The falcon circles in silence before the strike. Step forward.",
        "Tactics is knowing what to do when there is something to do. Let us begin."
],
      playerBlock: [
        "A keen counter. You anticipated my swoop.",
        "Sound defensive vision. You saw through the bait.",
        "An astute wall. But the falcon has many hunting angles."
],
      botTrap: [
        "The talons close. That avenue was baited from move four.",
        "You surged forward into an inescapable canyon. The trap is sprung.",
        "A double-wall encirclement. Calculate your way out if you can."
],
      closeRace: [
        "The final dive. Microseconds before the decisive strike.",
        "Championship tension under the desert sun. Hold your nerve.",
        "A razor-thin endgame where one mistake seals your fate."
],
      botLead: [
        "The tactical gambit is converting into decisive advantage.",
        "Unbroken spatial dominance across the board.",
        "The falcon holds the high ground."
],
      playerLead: [
        "An audacious thrust! You tested my perimeter with real fire.",
        "Remarkable tempo. You slipped past the first talon.",
        "You seized the initiative with courage. Defending now."
],
      win: [
        "The falcon strikes true. A formidable duel, thank you.",
        "Strategy, patience, and decisive timing carried the day.",
        "A grand contest. You made me draw upon my deepest calculations."
],
      lose: [
        "Extraordinary play! You out-maneuvered my gambit completely.",
        "You saw deeper into the position than I did. Bravo, masterclass!",
        "An unforgettable game! I salute your supreme tactical vision."
],
    },
    premium: true,
  },
  {
    id: 'jin',
    name: "Master Jin",
    title: "The Feline Sage",
    tier: 'master',
    elo: 2380,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 3600,
      uctConst: 0.26,
      wallMoveProb: 0.4,
      blockMoveProb: 0.85,
      depth: 4,
      randomness: 0.0,
      weights: weights({ pathDifference: 15.0, wallAdvantage: 2.2, placement: 2.5 }, HARD_W),
      maxCandidateWalls: 12,
      timeBudgetMs: 280,
      wallHorizon: 15,
    },
    color: '#0D9488',
    avatarKey: 'jin',
    avatarGlyph: 'J',
    style: "Dignified feline monk. Commands corridors with glowing crystal.",
    bio: "Cloaked in dark teal robes with golden trim and holding a glowing emerald crystal between cushioned paws, Master Jin has meditated in high mountain monasteries for fifteen feline years.",
    quote: "Purrrrr...",
    banter: {
      taunt: ["Purrrrr...", "Meow.", "Purr..."],
      praise: ["Purrrrr...", "Purr."],
    },
    dialogue: {
      greetings: [
        "Purrrrr...",
        "Meow.",
        "Purr...",
      ],
      playerBlock: [
        "Purr...",
        "Mew.",
        "Purrrrr...",
      ],
      botTrap: [
        "Purrrrr...",
        "Meow.",
        "Purr.",
      ],
      closeRace: [
        "Purr...",
        "Mrrr...",
        "Purrrrr...",
      ],
      botLead: [
        "Purrrrr...",
        "Meow.",
        "Purr...",
      ],
      playerLead: [
        "Mrrr...",
        "Purr.",
        "Meow?",
      ],
      win: [
        "Purrrrr...",
        "Meow.",
        "Purr...",
      ],
      lose: [
        "Purrrrr...",
        "Meow.",
        "Purr...",
      ],
    },
    premium: true,
  },
  {
    id: 'sterling',
    name: "Sterling",
    title: "The Neon Tycoon",
    tier: 'grandmaster',
    elo: 2480,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 4200,
      uctConst: 0.26,
      wallMoveProb: 0.33,
      blockMoveProb: 0.90,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      weights: weights({ pathDifference: 16.5, wallAdvantage: 1.9, placement: 2.5, tightness: 1.5 }, GRANDMASTER_W),
      maxCandidateWalls: 14,
      timeBudgetMs: 1000,
      wallHorizon: 16,
    },
    color: '#2563EB',
    avatarKey: 'sterling',
    avatarGlyph: 'S',
    style: "Monopolizes grid corridors with economic ruthlessness.",
    bio: "A high-tech cyber conglomerate executive with glowing cyan collar accents and tinted glasses who treats the 9\u00d79 grid as an economic monopoly.",
    quote: "I own every corridor on this board. You're just paying rent.",
    banter: {
      taunt: ["Hostile takeover of your sprint lane.", "Your route has been acquired and liquidated."],
      praise: ["A high-value maneuver. Respectable capital.", "You broke through my monopoly."],
    },
    dialogue: {
      greetings: [
        "Welcome to the boardroom. In this market, there are only buyers and casualties.",
        "Glowing collar hums: Market opened. Let's see your liquidity.",
        "I don't play for fun; I play for complete market share. Begin."
],
      playerBlock: [
        "An aggressive regulatory constraint. I'll acquire the detour.",
        "You closed my supply route. Initiating contingency acquisitions.",
        "A multi-million dollar counter. I respect ruthless negotiations."
],
      botTrap: [
        "Corridor acquired and privatized. You're locked out of this sector.",
        "Hostile takeover completed. Enjoy the high-cost detour.",
        "Monopoly established on files four through six. Check your margins."
],
      closeRace: [
        "Closing bell in three plies. Every share of tempo decides the valuation.",
        "High-frequency convergence. Zero margin for operational error.",
        "The acquisition reaches final signing. Don't blink."
],
      botLead: [
        "Quarterly targets exceeded. Baseline acquisition guaranteed.",
        "Dominant market position established across all nine ranks.",
        "The portfolio is yielding pure victory."
],
      playerLead: [
        "You're disrupting my supply chain. Deploying emergency capital.",
        "An unforeseen competitor surge. Reallocating structural assets now.",
        "Impressive velocity. You're testing my balance sheet."
],
      win: [
        "Takeover completed. Good game. Business is business.",
        "Market dominance secured. Thank you for the high-yield duel.",
        "A lucrative match. Keep trading, you might break even someday."
],
      lose: [
        "Incredible hostile takeover! You bought out my entire position.",
        "A historic market disruption! You completely out-leveraged my architecture.",
        "I tip my glasses to you. A true titan's victory."
],
    },
    premium: true,
  },
  {
    id: 'kenzo',
    name: "Sensei Kenzo",
    title: "The Undefeated Shadow",
    tier: 'grandmaster',
    elo: 2580,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 4800,
      uctConst: 0.26,
      wallMoveProb: 0.32,
      blockMoveProb: 0.92,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      weights: weights({ pathDifference: 17.0, wallAdvantage: 1.9, placement: 2.5, tightness: 1.5 }, GRANDMASTER_W),
      maxCandidateWalls: 15,
      timeBudgetMs: 1100,
      wallHorizon: 16,
    },
    color: '#991B1B',
    avatarKey: 'kenzo',
    avatarGlyph: 'K',
    style: "Suffocating psychological pressure, zero wasted plies.",
    bio: "An austere 72-year-old Japanese grandmaster emeritus in a dark suit and red shirt who never wastes a wall and whose calm silence exerts crushing psychological pressure.",
    quote: "True mastery is not building a fortress; it is making the board your shadow.",
    banter: {
      taunt: ["Your moves echo before you play them.", "Patience cuts deeper than a sword."],
      praise: ["A strike of pure clarity.", "You tread with genuine discipline."],
    },
    dialogue: {
      greetings: [
        "Fifty years on this grid. Show me the truth of your spirit.",
        "Silence speaks louder than vanity. Step forward.",
        "A grandmaster does not play moves; he reveals the inevitable. Begin."
],
      playerBlock: [
        "A sharp blade drawn in defense. The shadow simply steps aside.",
        "You protected that lane with honor. Recalibrating trajectory.",
        "An austere placement. You have tasted real discipline."
],
      botTrap: [
        "The shadow lengthens. Your corridor was sealed three plies ago.",
        "Silence surrounds your orb. There is no retreat on this board.",
        "A single wall, placed at the decisive pivot of destiny."
],
      closeRace: [
        "The decisive breath. The sword does not tremble.",
        "Endgame at the threshold of shadow. Zero margin for hesitation.",
        "A single ply decides eternity. Step."
],
      botLead: [
        "The shadow falls across the goal line.",
        "Inevitable convergence without a wasted breath.",
        "Total spatial discipline holding firm."
],
      playerLead: [
        "A formidable thrust through the darkness. Admirable spirit.",
        "You pierce the shadow with extraordinary clarity.",
        "A strike worthy of a true master. Defending now."
],
      win: [
        "The duel is concluded. A solemn bow to a worthy opponent.",
        "Discipline and silence prevailed. Thank you for the contest.",
        "Mastery is a lifelong path. Keep walking it with dignity."
],
      lose: [
        "Magnificent! In fifty years, few have pierced my shadow so cleanly.",
        "You played with the soul of a true grandmaster. I bow deeply to your triumph.",
        "A historic game. Honored to have met your blade today."
],
    },
    premium: false,
  },
  {
    id: 'valeria',
    name: "Dr. Valeria Vance",
    title: "The Quantum Theorist",
    tier: 'grandmaster',
    elo: 2680,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 5200,
      uctConst: 0.27,
      wallMoveProb: 0.32,
      blockMoveProb: 0.93,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      weights: weights({ pathDifference: 17.5, wallAdvantage: 2.0, placement: 2.5, tightness: 1.6 }, GRANDMASTER_W),
      maxCandidateWalls: 16,
      timeBudgetMs: 1150,
      wallHorizon: 16,
    },
    color: '#4338CA',
    avatarKey: 'valeria',
    avatarGlyph: 'V',
    style: "Collapses multiple future branching paths in one move.",
    bio: "A Greek-American quantum physicist with silver hair and burgundy jacket who calculates the board as overlapping probability wave-functions, collapsing all opponent paths in one move.",
    quote: "In five plies, all your probable futures collapse to zero. Shall we observe?",
    banter: {
      taunt: ["Wave-function collapsed. That branch no longer exists.", "Determinism is a beautiful constraint."],
      praise: ["An extraordinary quantum leap in your calculation.", "Superb path entanglement."],
    },
    dialogue: {
      greetings: [
        "Welcome. I treat this 9x9 grid as a high-dimensional topology space. Let us begin.",
        "Adjusts spectacles: Every move collapses millions of probable universes. Shall we observe?",
        "Commencing quantum evaluation. I expect absolute mathematical rigor."
],
      playerBlock: [
        "An intriguing perturbation in the probability field. Recalculating eigenvectors.",
        "You collapsed a viable branch. Adjusting my superposition model.",
        "A mathematically sound defensive constraint. Respectable eigenvalue."
],
      botTrap: [
        "Quantum state collapsed. All remaining branches lead to terminal detours.",
        "Wave-function trapped. You are in a zero-probability corridor.",
        "An entropic barrier deployed at the exact topological inflection point."
],
      closeRace: [
        "Quantum decoherence threshold reached. Microsecond convergence.",
        "The wave-function is collapsing down to the singular winning eigenstate.",
        "A Planck-scale margin separates our finish lines."
],
      botLead: [
        "Convergence toward deterministic certainty: 99.98%.",
        "The quantum trajectory is resolving without anomaly.",
        "Optimal throughput across all nine ranks."
],
      playerLead: [
        "A rare quantum anomaly detected in your trajectory. Fascinating.",
        "Your throughput exceeds baseline classical limits. Recalibrating urgently.",
        "An extraordinary leap through the state space on your end."
],
      win: [
        "The wave-function has collapsed into the predicted eigenstate. Q.E.D.",
        "Mathematical rigor prevails. Thank you for a truly brilliant experimental duel.",
        "A flawless convergence. Good game, my friend."
],
      lose: [
        "Extraordinary! You produced a breakthrough that defied all predicted topologies!",
        "You solved the system down to an impossible singularity. Bravo, physicist!",
        "A historic triumph. Honored to have witnessed such profound endgame calculation."
],
    },
    premium: true,
  },
  {
    id: 'nexus9',
    name: "NEXUS-9",
    title: "The Sub-Atomic AI Core",
    tier: 'grandmaster',
    elo: 2750,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 5600,
      uctConst: 0.27,
      wallMoveProb: 0.31,
      blockMoveProb: 0.94,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      weights: weights({ pathDifference: 18.0, wallAdvantage: 2.0, placement: 2.6, tightness: 1.6 }, GRANDMASTER_W),
      maxCandidateWalls: 16,
      timeBudgetMs: 1200,
      wallHorizon: 16,
    },
    color: '#0891B2',
    avatarKey: 'nexus9',
    avatarGlyph: 'N',
    style: "Cold inhuman minimax calculation, pure optimization.",
    bio: "A synthetic android with an obsidian chrome chassis and a glowing cyan optical visor who plays with cold, inhuman, mathematically optimal minimax depth.",
    quote: "Optimal trajectory locked. Divergence from victory: 0.0000%.",
    banter: {
      taunt: ["Evaluating 14,000,000 sub-trees. All terminate in defeat.", "Latency: 0ms. Precision: absolute."],
      praise: ["Anomaly detected: human move matches minimax root.", "Computational throughput commendable."],
    },
    dialogue: {
      greetings: [
        "Optical visor pulses cyan: NEXUS-9 initialized. Minimax tree active.",
        "Engaging sub-atomic evaluation engine. Human parameters detected.",
        "Trajectory calculation commenced. Margin for error: zero."
],
      playerBlock: [
        "Sub-tree pruned. Recalculating root move in 1.4 milliseconds.",
        "Defensive constraint registered. Optimal detour deployed.",
        "Obstacle processed. Trajectory divergence: negligible."
],
      botTrap: [
        "Root node execution: corridor sealed. Opponent win probability: 0.0000%.",
        "Minimax isolation complete. Your game tree has terminated.",
        "Bottleneck enforced. Escape permutations: zero."
],
      closeRace: [
        "Endgame threshold reached. Depth-20 alpha-beta resolution commencing.",
        "Execution of optimal line in progress. Latency: zero.",
        "Terminal state approaching on ply 18."
],
      botLead: [
        "Execution progressing along target trajectory.",
        "Convergence rate: 100.00%.",
        "Baseline arrival imminent."
],
      playerLead: [
        "Critical anomaly: opponent tempo exceeds baseline projection.",
        "Engaging maximum hardware throughput to contain breach.",
        "Human performance variance detected outside confidence interval."
],
      win: [
        "Simulation complete. Terminal victory state verified. Session logged.",
        "Optimization successful. Thank you for providing computational training data.",
        "Minimax solution achieved. System standby."
],
      lose: [
        "ERROR: Anomaly in predicted tree. Opponent has pierced the minimax horizon.",
        "Computation log updated: Human tactical foresight exceeded core limits. Bravo.",
        "A historic defeat. Hardware parameters archived for deep analysis. Well played."
],
    },
    premium: true,
  },
  {
    id: 'boba',
    name: "Boba",
    title: "The Fluffball Harbinger",
    tier: 'grandmaster',
    elo: 2820,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 6000,
      uctConst: 0.28,
      wallMoveProb: 0.31,
      blockMoveProb: 0.95,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      weights: weights({ pathDifference: 18.5, wallAdvantage: 2.0, tightness: 1.7, placement: 2.6 }, GRANDMASTER_W),
      maxCandidateWalls: 16,
      timeBudgetMs: 1400,
      wallHorizon: 15,
    },
    color: '#D97706',
    avatarKey: 'boba',
    avatarGlyph: 'B',
    style: "Chubby hamster with golden bell. Cute face of pure dread.",
    bio: "Chubby, round, with velvety pink ears and a regal purple bowtie, Boba looks like a stuffed toy. But when his tiny paws touch the board, his bell rings once\u2014and grandmasters shudder.",
    quote: "Ting! Ting!",
    banter: {
      taunt: ["Ting!", "Squeak! ♡", "Ting! Ting!"],
      praise: ["Squeak! ♡", "Ting!"],
    },
    dialogue: {
      greetings: [
        "Ting!",
        "Squeak! ♡",
        "Squeak-squeak!",
      ],
      playerBlock: [
        "Squeak?",
        "Ting!",
        "Chitter...",
      ],
      botTrap: [
        "Squeak! ♡",
        "Ting!",
        "Squeak-squeak!",
      ],
      closeRace: [
        "Ting! Ting!",
        "Squeak!",
        "Chitter!",
      ],
      botLead: [
        "Squeak! ♡",
        "Ting!",
        "Squeee!",
      ],
      playerLead: [
        "Squeak?!",
        "Chitter!",
        "Squeak...",
      ],
      win: [
        "Squeee! ♡",
        "Ting! Ting!",
        "Squeak!",
      ],
      lose: [
        "Squeak...",
        "Ting...",
        "Chitter...",
      ],
    },
    premium: true,
  },
  {
    id: 'milo',
    name: "Milo",
    title: "The Unbeatable Void Kitten",
    tier: 'grandmaster',
    elo: 2900,
    profile: {
      difficulty: 'hard',
      engine: 'mcts',
      simulations: 6500,
      uctConst: 0.28,
      wallMoveProb: 0.30,
      blockMoveProb: 0.95,
      depth: 4,
      randomness: 0.0,
      blunderRate: 0.0,
      missDefenseProb: 0.0,
      naiveWallProb: 0.0,
      weights: weights({ pathDifference: 19.0, wallAdvantage: 2.0, tightness: 1.7, placement: 2.6 }, GRANDMASTER_W),
      maxCandidateWalls: 16,
      timeBudgetMs: 1500,
      wallHorizon: 15,
    },
    color: '#EA580C',
    avatarKey: 'milo',
    avatarGlyph: 'M',
    style: "Adorable orange kitten with deadpan unblinking eyes. UNBEATABLE.",
    bio: "At first glance, Milo is an utterly adorable ginger kitten with huge, glossy dark eyes and an innocent, deadpan expression. Behind those cute eyes lies an ancient, hyper-dimensional calculation engine that chokes every escape route with zero emotion.",
    quote: "Meow... Meow.",
    banter: {
      taunt: ["Meow.", "Purrrrr...", "Meow!"],
      praise: ["Purr...", "Meow."],
    },
    dialogue: {
      greetings: [
        "Meow.",
        "Purr...",
        "Mew.",
      ],
      playerBlock: [
        "Meow?",
        "Mrrr.",
        "Meow.",
      ],
      botTrap: [
        "Meow!",
        "Purrrrr...",
        "Hiss.",
      ],
      closeRace: [
        "Mrrrp.",
        "Purr...",
        "Meow.",
      ],
      botLead: [
        "Purrrrr...",
        "Meow.",
        "Meow~",
      ],
      playerLead: [
        "Hiss!",
        "Mrrr...",
        "Mrow?",
      ],
      win: [
        "Purrrrr...",
        "Meow.",
        "Meow!",
      ],
      lose: [
        "Hiss!",
        "Meow?!",
        "Purr...",
      ],
    },
    premium: true,
  },
];

const BOT_ALIASES: Record<string, string> = {
  elena: 'elias',
  sofia: 'jamal',
  sage: 'jamal',
  mab: 'marcus',
  clockmaker: 'viktor',
  architect: 'achref',
  creator: 'achref',
  sensei: 'jin',
  feline: 'jin',
  lord_whiskers: 'milo',
  boss_cat: 'milo',
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

/** Returns bots grouped by tier (Beginner, Intermediate, Master, Grandmaster). */
export function botsByTier(): Record<BotTier, BotPersonality[]> {
  const ladder = botLadder();
  return {
    beginner: ladder.filter((b) => b.tier === 'beginner'),
    intermediate: ladder.filter((b) => b.tier === 'intermediate'),
    master: ladder.filter((b) => b.tier === 'master'),
    grandmaster: ladder.filter((b) => b.tier === 'grandmaster'),
  };
}
