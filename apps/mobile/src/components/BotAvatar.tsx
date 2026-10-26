import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { THEME, useStyles } from '../theme';
import martinPng from '../../assets/bots/martin.png';
import pipPng from '../../assets/bots/pip.png';
import eliasPng from '../../assets/bots/elias.png';
import bramPng from '../../assets/bots/bram.png';
import nelsonPng from '../../assets/bots/nelson.png';
import vexPng from '../../assets/bots/vex.png';
import jamalPng from '../../assets/bots/jamal.png';
import marcusPng from '../../assets/bots/marcus.png';
import viktorPng from '../../assets/bots/viktor.png';
import achrefPng from '../../assets/bots/achref.png';
import barnabyPng from '../../assets/bots/barnaby.png';
import finnPng from '../../assets/bots/finn.png';
import claraPng from '../../assets/bots/clara.png';
import leoPng from '../../assets/bots/leo.png';
import tariqPng from '../../assets/bots/tariq.png';
import renPng from '../../assets/bots/ren.png';
import mateoPng from '../../assets/bots/mateo.png';
import zaraPng from '../../assets/bots/zara.png';
import archimedesPng from '../../assets/bots/archimedes.png';
import fionaPng from '../../assets/bots/fiona.png';
import dmitriPng from '../../assets/bots/dmitri.png';
import laylaPng from '../../assets/bots/layla.png';
import dantePng from '../../assets/bots/dante.png';
import meilingPng from '../../assets/bots/meiling.png';
import amaraPng from '../../assets/bots/amara.png';
import gideonPng from '../../assets/bots/gideon.png';
import soraPng from '../../assets/bots/sora.png';
import samiraPng from '../../assets/bots/samira.png';
import torsteinPng from '../../assets/bots/torstein.png';
import kofiPng from '../../assets/bots/kofi.png';
import diegoPng from '../../assets/bots/diego.png';
import hassanPng from '../../assets/bots/hassan.png';
import jinPng from '../../assets/bots/jin.png';
import sterlingPng from '../../assets/bots/sterling.png';
import kenzoPng from '../../assets/bots/kenzo.png';
import valeriaPng from '../../assets/bots/valeria.png';
import nexus9Png from '../../assets/bots/nexus9.png';
import bobaPng from '../../assets/bots/boba.png';
import miloPng from '../../assets/bots/milo.png';

export type BotAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<BotAvatarSize, number> = {
  xs: 26,
  sm: 34,
  md: 44,
  lg: 64,
  xl: 96,
};

interface BotAvatarProps {
  avatarKey?: string;
  color?: string;
  size?: BotAvatarSize | number;
  showGlow?: boolean;
  noBg?: boolean;
  selected?: boolean;
  style?: object;
}

/**
 * 1. Martin: The Friendly Dad (800 ELO)
 * Cozy green knit sweater, round tortoiseshell glasses, warm friendly dad smile.
 */
const MartinPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="martinBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#064E3B" />
      </LinearGradient>
      <LinearGradient id="martinSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FDDEC8" />
        <Stop offset="100%" stopColor="#F5C7A9" />
      </LinearGradient>
    </Defs>
    {/* Square background */}
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#martinBg)" />}

    {/* Cozy green sweater */}
    <Path d="M 16 100 C 20 72 34 68 50 68 C 66 68 80 72 84 100 Z" fill="#047857" />
    <Path d="M 42 68 L 50 78 L 58 68" stroke="#FFFFFF" strokeWidth="2.8" fill="none" />
    <Path d="M 38 68 Q 50 72 62 68" stroke="#065F46" strokeWidth="2" fill="none" />

    {/* Neck */}
    <Rect x="44" y="60" width="12" height="10" rx="3" fill="url(#martinSkin)" />

    {/* Ears */}
    <Circle cx="28" cy="48" r="4.5" fill="url(#martinSkin)" />
    <Circle cx="72" cy="48" r="4.5" fill="url(#martinSkin)" />

    {/* Head */}
    <Circle cx="50" cy="47" r="21" fill="url(#martinSkin)" />

    {/* Brown Dad Hair - neat side part */}
    <Path
      d="M 28 42 C 26 22 36 14 50 14 C 64 14 74 22 72 42 C 68 28 58 20 50 20 C 38 20 32 28 28 42 Z"
      fill="#5D4037"
    />
    <Path d="M 30 32 Q 42 22 56 26" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" fill="none" />

    {/* Eyebrows */}
    <Path d="M 36 38 Q 41 35 46 38" stroke="#4E342E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M 54 38 Q 59 35 64 38" stroke="#4E342E" strokeWidth="2.2" strokeLinecap="round" fill="none" />

    {/* Round Glasses */}
    <Circle cx="41" cy="46" r="8" stroke="#4E342E" strokeWidth="2.4" fill="#FFFFFF" fillOpacity="0.25" />
    <Circle cx="59" cy="46" r="8" stroke="#4E342E" strokeWidth="2.4" fill="#FFFFFF" fillOpacity="0.25" />
    <Path d="M 49 46 Q 50 44 51 46" stroke="#4E342E" strokeWidth="2.4" fill="none" />
    {/* Frame sides */}
    <Path d="M 33 46 L 28 45 M 67 46 L 72 45" stroke="#4E342E" strokeWidth="2" strokeLinecap="round" />

    {/* Smiling eyes behind glasses */}
    <Circle cx="41" cy="46" r="2.2" fill="#3E2723" />
    <Circle cx="59" cy="46" r="2.2" fill="#3E2723" />
    <Circle cx="42" cy="45" r="0.8" fill="#FFFFFF" />
    <Circle cx="60" cy="45" r="0.8" fill="#FFFFFF" />

    {/* Nose */}
    <Path d="M 50 48 Q 52 52 49 53" stroke="#D79E78" strokeWidth="1.8" strokeLinecap="round" fill="none" />

    {/* Friendly warm smile */}
    <Path d="M 43 58 Q 50 65 57 58" stroke="#991B1B" strokeWidth="2.2" strokeLinecap="round" fill="#FCA5A5" fillOpacity="0.4" />
  </Svg>
);

/**
 * 2. Elena: The Eager Student (1100 ELO)
 * College student, high dark ponytail, bright hazel eyes, amber varsity jacket.
 */
const ElenaPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="elenaBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#78350F" />
      </LinearGradient>
      <LinearGradient id="elenaSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FDE6D2" />
        <Stop offset="100%" stopColor="#FBCBA8" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#elenaBg)" />}

    {/* Ponytail swinging to side */}
    <Path d="M 64 28 C 78 24 88 38 86 56 C 82 50 78 42 70 36 Z" fill="#292524" />
    <Circle cx="66" cy="30" r="3.2" fill="#F59E0B" />

    {/* Varsity Jacket */}
    <Path d="M 18 100 C 22 72 34 67 50 67 C 66 67 78 72 82 100 Z" fill="#D97706" />
    <Path d="M 42 67 L 50 78 L 58 67" stroke="#FFFFFF" strokeWidth="3" fill="none" />
    <Path d="M 50 78 L 50 100" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3,2" fill="none" />

    {/* Neck */}
    <Rect x="44" y="58" width="12" height="11" rx="3" fill="url(#elenaSkin)" />

    {/* Ears with cute earrings */}
    <Circle cx="29" cy="47" r="4" fill="url(#elenaSkin)" />
    <Circle cx="71" cy="47" r="4" fill="url(#elenaSkin)" />
    <Circle cx="29" cy="50" r="1.5" fill="#F59E0B" />
    <Circle cx="71" cy="50" r="1.5" fill="#F59E0B" />

    {/* Head */}
    <Circle cx="50" cy="46" r="20.5" fill="url(#elenaSkin)" />

    {/* Hair front & bangs */}
    <Path
      d="M 28 42 C 26 22 40 16 50 16 C 62 16 72 22 72 42 C 68 28 60 22 50 22 C 38 22 32 28 28 42 Z"
      fill="#292524"
    />
    <Path d="M 32 30 Q 44 24 50 32" stroke="#1C1917" strokeWidth="2.5" fill="none" />

    {/* Eyebrows */}
    <Path d="M 36 38 Q 41 35 46 38" stroke="#292524" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M 54 38 Q 59 35 64 38" stroke="#292524" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Expressive Hazel Eyes */}
    <Circle cx="41" cy="45" r="3.2" fill="#78350F" />
    <Circle cx="59" cy="45" r="3.2" fill="#78350F" />
    <Circle cx="40" cy="44" r="1.3" fill="#FFFFFF" />
    <Circle cx="58" cy="44" r="1.3" fill="#FFFFFF" />
    <Path d="M 37 43 Q 41 40 45 43" stroke="#1C1917" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <Path d="M 55 43 Q 59 40 63 43" stroke="#1C1917" strokeWidth="1.6" strokeLinecap="round" fill="none" />

    {/* Nose */}
    <Path d="M 50 48 Q 51 51 49 52" stroke="#D79E78" strokeWidth="1.6" strokeLinecap="round" fill="none" />

    {/* Bright Student Smile */}
    <Path d="M 43 56 Q 50 63 57 56" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" fill="#FFFFFF" />
  </Svg>
);

/**
 * 3. Nelson: The Aggressive Challenger (1450 ELO)
 * Cocky athletic guy, messy spiky dark hair, raised eyebrow, purple athletic hoodie.
 */
const NelsonPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="nelsonBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#8B5CF6" />
        <Stop offset="100%" stopColor="#3B0764" />
      </LinearGradient>
      <LinearGradient id="nelsonSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#F4CBB2" />
        <Stop offset="100%" stopColor="#E4A682" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#nelsonBg)" />}

    {/* Purple Athletic Hoodie */}
    <Path d="M 16 100 C 20 72 34 68 50 68 C 66 68 80 72 84 100 Z" fill="#7C3AED" />
    <Path d="M 34 68 Q 50 82 66 68" stroke="#5B21B6" strokeWidth="3" fill="none" />
    {/* Drawstrings */}
    <Path d="M 46 76 L 46 88 M 54 76 L 54 88" stroke="#DDD6FE" strokeWidth="2" strokeLinecap="round" />

    {/* Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="3" fill="url(#nelsonSkin)" />

    {/* Ears */}
    <Circle cx="27" cy="48" r="4.5" fill="url(#nelsonSkin)" />
    <Circle cx="73" cy="48" r="4.5" fill="url(#nelsonSkin)" />

    {/* Head */}
    <Circle cx="50" cy="47" r="21.5" fill="url(#nelsonSkin)" />

    {/* Spiky Messy Hair */}
    <Path
      d="M 24 38 C 22 18 32 10 50 10 C 62 8 76 16 76 38 C 72 24 64 16 50 16 C 36 16 28 24 24 38 Z"
      fill="#18181B"
    />
    <Path d="M 36 12 L 42 4 L 46 11 L 52 3 L 57 11 L 64 6 L 66 14" fill="#18181B" />

    {/* Eyebrows: left normal, right cocked up for that classic Nelson attitude */}
    <Path d="M 36 39 L 46 39" stroke="#18181B" strokeWidth="2.8" strokeLinecap="round" />
    <Path d="M 54 35 L 64 39" stroke="#18181B" strokeWidth="2.8" strokeLinecap="round" />

    {/* Sharp challenger eyes */}
    <Circle cx="41" cy="45" r="2.8" fill="#18181B" />
    <Circle cx="59" cy="45" r="2.8" fill="#18181B" />
    <Circle cx="42" cy="44" r="1" fill="#FFFFFF" />
    <Circle cx="60" cy="44" r="1" fill="#FFFFFF" />

    {/* Nose */}
    <Path d="M 50 47 L 48 52 L 52 52" stroke="#C97A52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* Cocky asymmetrical smirk */}
    <Path d="M 44 58 Q 52 57 58 53" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </Svg>
);

/**
 * 4. Sofia: The Calm Competitor (1650 ELO)
 * Elegant wavy auburn hair, composed sapphire eyes, tailored teal blazer.
 */
const SofiaPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="sofiaBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0EA5E9" />
        <Stop offset="100%" stopColor="#082F49" />
      </LinearGradient>
      <LinearGradient id="sofiaSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FEE2D5" />
        <Stop offset="100%" stopColor="#F8C8B4" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#sofiaBg)" />}

    {/* Wavy hair behind shoulders */}
    <Path d="M 24 46 C 22 66 26 80 30 92 C 34 76 30 58 28 46 Z" fill="#78350F" />
    <Path d="M 76 46 C 78 66 74 80 70 92 C 66 76 70 58 72 46 Z" fill="#78350F" />

    {/* Tailored Teal Blazer over Blouse */}
    <Path d="M 18 100 C 22 72 34 66 50 66 C 66 66 78 72 82 100 Z" fill="#0284C7" />
    <Path d="M 36 66 L 46 86 L 50 74 L 54 86 L 64 66" stroke="#0369A1" strokeWidth="2" fill="#F8FAFC" />

    {/* Neck */}
    <Rect x="44" y="56" width="12" height="12" rx="3" fill="url(#sofiaSkin)" />

    {/* Ears with pearl studs */}
    <Circle cx="29" cy="46" r="4" fill="url(#sofiaSkin)" />
    <Circle cx="71" cy="46" r="4" fill="url(#sofiaSkin)" />
    <Circle cx="29" cy="48" r="1.5" fill="#E0F2FE" />
    <Circle cx="71" cy="48" r="1.5" fill="#E0F2FE" />

    {/* Head */}
    <Circle cx="50" cy="45" r="20" fill="url(#sofiaSkin)" />

    {/* Wavy Auburn Hair front */}
    <Path
      d="M 28 42 C 26 20 38 14 50 14 C 64 14 74 20 72 42 C 68 28 58 22 50 22 C 38 22 32 28 28 42 Z"
      fill="#78350F"
    />
    <Path d="M 30 36 Q 44 26 62 34" stroke="#92400E" strokeWidth="2.5" fill="none" />

    {/* Eyebrows */}
    <Path d="M 36 38 Q 41 35 46 39" stroke="#451A03" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M 54 39 Q 59 35 64 38" stroke="#451A03" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Focused Sapphire Eyes */}
    <Circle cx="41" cy="44" r="2.8" fill="#0284C7" />
    <Circle cx="59" cy="44" r="2.8" fill="#0284C7" />
    <Circle cx="41" cy="44" r="1.5" fill="#082F49" />
    <Circle cx="59" cy="44" r="1.5" fill="#082F49" />
    <Circle cx="42" cy="43" r="1" fill="#FFFFFF" />
    <Circle cx="60" cy="43" r="1" fill="#FFFFFF" />

    {/* Nose */}
    <Path d="M 50 46 Q 51 49 49 51" stroke="#D79E78" strokeWidth="1.6" strokeLinecap="round" fill="none" />

    {/* Poised calm smile */}
    <Path d="M 44 56 Q 50 60 56 56" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" fill="none" />
  </Svg>
);

/**
 * 5. Marcus: The Seasoned Strategist (1900 ELO)
 * Short dark hair touched with silver at temples, neat beard, calculating gaze, crimson collared shirt.
 */
const MarcusPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="marcusBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#DC2626" />
        <Stop offset="100%" stopColor="#450A0A" />
      </LinearGradient>
      <LinearGradient id="marcusSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#E2BA9A" />
        <Stop offset="100%" stopColor="#C69C7B" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#marcusBg)" />}

    {/* Crimson Collared Shirt */}
    <Path d="M 16 100 C 20 72 34 68 50 68 C 66 68 80 72 84 100 Z" fill="#991B1B" />
    <Path d="M 40 68 L 50 78 L 60 68" stroke="#7F1D1D" strokeWidth="3" fill="#450A0A" />

    {/* Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="3" fill="url(#marcusSkin)" />

    {/* Ears */}
    <Circle cx="27" cy="48" r="4.5" fill="url(#marcusSkin)" />
    <Circle cx="73" cy="48" r="4.5" fill="url(#marcusSkin)" />

    {/* Head */}
    <Circle cx="50" cy="47" r="21.5" fill="url(#marcusSkin)" />

    {/* Dark Hair with touched gray */}
    <Path
      d="M 26 38 C 24 20 36 14 50 14 C 64 14 74 20 74 38 C 70 24 62 18 50 18 C 38 18 30 24 26 38 Z"
      fill="#262626"
    />
    {/* Silver streaks at temples */}
    <Path d="M 26 34 Q 28 26 32 24" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M 74 34 Q 72 26 68 24" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Trimmed Beard & Mustache */}
    <Path
      d="M 33 52 C 35 68 44 72 50 72 C 56 72 65 68 67 52 C 63 60 56 64 50 64 C 44 64 37 60 33 52 Z"
      fill="#262626"
    />
    <Path d="M 40 56 Q 50 54 60 56 Q 50 60 40 56 Z" fill="#262626" />

    {/* Strong calculating brows */}
    <Path d="M 36 39 L 46 41" stroke="#262626" strokeWidth="2.6" strokeLinecap="round" />
    <Path d="M 54 41 L 64 39" stroke="#262626" strokeWidth="2.6" strokeLinecap="round" />

    {/* Deep calculating eyes */}
    <Circle cx="41" cy="45" r="2.5" fill="#262626" />
    <Circle cx="59" cy="45" r="2.5" fill="#262626" />
    <Circle cx="42" cy="44" r="0.9" fill="#FFFFFF" />
    <Circle cx="60" cy="44" r="0.9" fill="#FFFFFF" />

    {/* Nose */}
    <Path d="M 50 45 L 48 51 L 52 51" stroke="#A7785B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/**
 * 6. Viktor: The Grandmaster Theorist (2100 ELO)
 * Sleek swept-back silver hair, modern rectangular glasses, dark charcoal turtleneck, deep intellectual gaze.
 */
const ViktorPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="viktorBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#475569" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
      <LinearGradient id="viktorSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#F5E6DA" />
        <Stop offset="100%" stopColor="#EAD0BC" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#viktorBg)" />}

    {/* Charcoal Turtleneck */}
    <Path d="M 18 100 C 22 74 34 68 50 68 C 66 68 78 74 82 100 Z" fill="#1E293B" />
    <Rect x="42" y="62" width="16" height="11" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />

    {/* Ears */}
    <Circle cx="27" cy="47" r="4.5" fill="url(#viktorSkin)" />
    <Circle cx="73" cy="47" r="4.5" fill="url(#viktorSkin)" />

    {/* Head */}
    <Circle cx="50" cy="46" r="21" fill="url(#viktorSkin)" />

    {/* Swept-back silver grandmaster hair */}
    <Path
      d="M 24 38 C 22 16 36 10 50 10 C 64 10 76 16 76 38 C 72 22 62 16 50 16 C 36 16 28 22 24 38 Z"
      fill="#E2E8F0"
    />
    <Path d="M 25 38 L 27 50 M 75 38 L 73 50" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />

    {/* Analytical gray brows */}
    <Path d="M 34 37 Q 41 34 47 38" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <Path d="M 53 38 Q 59 34 66 37" stroke="#94A3B8" strokeWidth="2.4" strokeLinecap="round" fill="none" />

    {/* Sleek rectangular modern glasses */}
    <Rect x="34" y="41" width="13" height="9" rx="2" stroke="#475569" strokeWidth="2" fill="#FFFFFF" fillOpacity="0.25" />
    <Rect x="53" y="41" width="13" height="9" rx="2" stroke="#475569" strokeWidth="2" fill="#FFFFFF" fillOpacity="0.25" />
    <Path d="M 47 45 L 53 45" stroke="#475569" strokeWidth="2" />
    {/* Frame sides */}
    <Path d="M 34 45 L 28 44 M 66 45 L 72 44" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />

    {/* Piercing gray-blue eyes */}
    <Circle cx="40.5" cy="45.5" r="2.2" fill="#334155" />
    <Circle cx="59.5" cy="45.5" r="2.2" fill="#334155" />
    <Circle cx="41.5" cy="44.5" r="0.8" fill="#FFFFFF" />
    <Circle cx="60.5" cy="44.5" r="0.8" fill="#FFFFFF" />

    {/* Refined nose */}
    <Path d="M 50 46 L 49 52 L 52 52" stroke="#C9A083" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* Composed subtle smirk */}
    <Path d="M 45 59 Q 50 62 55 59" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </Svg>
);

/**
 * 7. Pip: The Curious Sprinter (1050 ELO)
 * Messy copper hair, freckles, teal running jacket and an eager grin.
 */
const PipPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="pipBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#2DD4BF" />
        <Stop offset="100%" stopColor="#115E59" />
      </LinearGradient>
      <LinearGradient id="pipSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FBD5B5" />
        <Stop offset="100%" stopColor="#EFB990" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#pipBg)" />}
    <Path d="M 16 100 C 20 74 34 69 50 69 C 66 69 80 74 84 100 Z" fill="#0F766E" />
    <Path d="M 34 100 L 50 82 L 66 100" stroke="#14B8A6" strokeWidth="3" fill="none" />
    <Rect x="43" y="59" width="14" height="12" rx="4" fill="url(#pipSkin)" />
    <Circle cx="69" cy="48" r="4.5" fill="url(#pipSkin)" />
    <Circle cx="31" cy="48" r="4.5" fill="url(#pipSkin)" />
    <Circle cx="50" cy="46" r="21.5" fill="url(#pipSkin)" />
    <Path
      d="M 27 42 C 22 21 38 12 51 14 C 67 12 78 24 72 43 C 68 30 62 25 50 26 C 38 25 32 31 27 42 Z"
      fill="#B45309"
    />
    <Path d="M 30 28 Q 38 18 48 21" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" fill="none" />
    <Path d="M 34 38 Q 41 35 47 38" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M 53 38 Q 59 35 66 38" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Circle cx="41" cy="44" r="2.7" fill="#0F766E" />
    <Circle cx="59" cy="44" r="2.7" fill="#0F766E" />
    <Circle cx="42" cy="43" r="1" fill="#FFFFFF" />
    <Circle cx="60" cy="43" r="1" fill="#FFFFFF" />
    <Circle cx="37" cy="53" r="1" fill="#C2410C" opacity="0.7" />
    <Circle cx="43" cy="56" r="1" fill="#C2410C" opacity="0.7" />
    <Circle cx="58" cy="56" r="1" fill="#C2410C" opacity="0.7" />
    <Circle cx="64" cy="53" r="1" fill="#C2410C" opacity="0.7" />
    <Path d="M 50 46 L 49 51 L 52 51" stroke="#D99A6C" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <Path d="M 43 58 Q 50 65 57 58" stroke="#9A3412" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </Svg>
);

/**
 * 8. Bram: The Bricklayer (1250 ELO)
 * Broad jaw, knitted beanie, stubble and a sturdy work jacket.
 */
const BramPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="bramBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#78350F" />
      </LinearGradient>
      <LinearGradient id="bramSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#E7BE9B" />
        <Stop offset="100%" stopColor="#CE9A72" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#bramBg)" />}
    <Path d="M 13 100 C 18 73 33 66 50 66 C 67 66 82 73 87 100 Z" fill="#1E3A5F" />
    <Path d="M 37 68 L 50 80 L 63 68" stroke="#3B82F6" strokeWidth="3" fill="none" />
    <Rect x="43" y="58" width="14" height="12" rx="4" fill="url(#bramSkin)" />
    <Circle cx="27" cy="48" r="5" fill="url(#bramSkin)" />
    <Circle cx="73" cy="48" r="5" fill="url(#bramSkin)" />
    <Circle cx="50" cy="47" r="23" fill="url(#bramSkin)" />
    <Path
      d="M 25 40 C 24 20 37 13 50 13 C 63 13 76 20 75 40 L 25 40 Z"
      fill="#334155"
    />
    <Path d="M 25 36 Q 50 42 75 36" stroke="#475569" strokeWidth="4" fill="none" />
    <Path
      d="M 32 51 C 34 69 43 73 50 73 C 57 73 66 69 68 51 C 62 62 55 65 50 65 C 45 65 38 62 32 51 Z"
      fill="#78350F"
      opacity="0.75"
    />
    <Path d="M 35 39 L 45 41" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" />
    <Path d="M 55 41 L 65 39" stroke="#451A03" strokeWidth="2.8" strokeLinecap="round" />
    <Circle cx="41" cy="45" r="2.4" fill="#3B240F" />
    <Circle cx="59" cy="45" r="2.4" fill="#3B240F" />
    <Circle cx="42" cy="44" r="0.9" fill="#FFFFFF" />
    <Circle cx="60" cy="44" r="0.9" fill="#FFFFFF" />
    <Path d="M 50 46 L 48 52 L 52 52" stroke="#A9714B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M 43 59 Q 50 62 57 59" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" fill="none" />
  </Svg>
);

/**
 * 9. Vex: The Maze Trickster (1450 ELO)
 * Asymmetric hood, sharp teal eyes and a knowing smirk.
 */
const VexPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="vexBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#8B5CF6" />
        <Stop offset="100%" stopColor="#2E1065" />
      </LinearGradient>
      <LinearGradient id="vexSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#E9C6B0" />
        <Stop offset="100%" stopColor="#CFA189" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#vexBg)" />}
    <Path d="M 12 100 C 16 72 32 66 50 66 C 68 66 84 72 88 100 Z" fill="#312E81" />
    <Path
      d="M 24 63 C 17 42 23 20 40 13 C 52 8 69 14 76 30 C 80 42 77 57 70 68 L 63 64 C 69 50 67 33 55 25 C 43 17 33 28 33 42 C 33 52 36 60 39 66 Z"
      fill="#4C1D95"
    />
    <Path d="M 24 63 C 19 45 25 24 41 16" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Rect x="43" y="57" width="14" height="12" rx="4" fill="url(#vexSkin)" />
    <Circle cx="50" cy="47" r="21" fill="url(#vexSkin)" />
    <Path d="M 28 41 C 28 23 40 16 51 17 C 65 17 73 26 72 42 C 64 31 59 28 49 29 C 39 29 32 33 28 41 Z" fill="#1E1B4B" />
    <Path d="M 35 39 L 46 37" stroke="#312E81" strokeWidth="2.4" strokeLinecap="round" />
    <Path d="M 54 37 L 66 41" stroke="#312E81" strokeWidth="2.4" strokeLinecap="round" />
    <Circle cx="41" cy="44" r="2.8" fill="#2DD4BF" />
    <Circle cx="60" cy="44" r="2.8" fill="#2DD4BF" />
    <Circle cx="41" cy="44" r="1.2" fill="#022C22" />
    <Circle cx="60" cy="44" r="1.2" fill="#022C22" />
    <Circle cx="42" cy="43" r="0.9" fill="#FFFFFF" />
    <Circle cx="61" cy="43" r="0.9" fill="#FFFFFF" />
    <Path d="M 50 46 L 52 52 L 48 52" stroke="#B77F63" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M 43 58 Q 50 64 58 57" stroke="#7F1D1D" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M 58 57 L 61 55" stroke="#7F1D1D" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

/**
 * 10. Achref: The System Architect (2300 ELO)
 * Clean side-part, rimless glasses at the brow, emerald jacket and a
 * measured smile.
 */
const AchrefPortrait: React.FC<{ size: number; noBg?: boolean }> = ({ size, noBg }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="achrefBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0EA5E9" />
        <Stop offset="100%" stopColor="#172554" />
      </LinearGradient>
      <LinearGradient id="achrefSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#E8C3A4" />
        <Stop offset="100%" stopColor="#CFA07A" />
      </LinearGradient>
    </Defs>
    {!noBg && <Rect width="100" height="100" rx="16" fill="url(#achrefBg)" />}
    <Path d="M 14 100 C 19 73 34 67 50 67 C 66 67 81 73 86 100 Z" fill="#064E3B" />
    <Path d="M 40 68 L 50 80 L 60 68" stroke="#34D399" strokeWidth="2.5" fill="none" />
    <Rect x="43" y="58" width="14" height="12" rx="4" fill="url(#achrefSkin)" />
    <Circle cx="27" cy="48" r="4.5" fill="url(#achrefSkin)" />
    <Circle cx="73" cy="48" r="4.5" fill="url(#achrefSkin)" />
    <Circle cx="50" cy="46" r="21.5" fill="url(#achrefSkin)" />
    <Path
      d="M 26 40 C 24 20 37 13 52 14 C 66 14 76 21 74 40 C 68 26 61 22 49 23 C 37 23 31 29 26 40 Z"
      fill="#111827"
    />
    <Path d="M 33 29 Q 44 20 58 23" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" fill="none" />
    <Path d="M 35 39 L 46 40" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M 54 40 L 65 39" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
    <Circle cx="41" cy="45" r="2.5" fill="#0F172A" />
    <Circle cx="59" cy="45" r="2.5" fill="#0F172A" />
    <Circle cx="42" cy="44" r="0.9" fill="#FFFFFF" />
    <Circle cx="60" cy="44" r="0.9" fill="#FFFFFF" />
    <Path d="M 34 43 L 47 43 M 53 43 L 66 43" stroke="#38BDF8" strokeWidth="1.1" opacity="0.75" />
    <Path
      d="M 33 53 C 35 66 43 71 50 71 C 57 71 65 66 67 53 C 61 61 55 64 50 64 C 45 64 39 61 33 53 Z"
      fill="#111827"
      opacity="0.75"
    />
    <Path d="M 50 46 L 49 51 L 52 51" stroke="#B07A59" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <Path d="M 44 59 Q 50 62 56 59" stroke="#78350F" strokeWidth="2" strokeLinecap="round" fill="none" />
  </Svg>
);

/** Maps legacy bot IDs to canonical roster IDs. */
const CANONICAL_BOT_KEY: Record<string, string> = {
  elena: 'elias',
  sofia: 'jamal',
  sage: 'jamal',
  mab: 'marcus',
  clockmaker: 'viktor',
  architect: 'achref',
  creator: 'achref',
  sensei: 'jin',
  feline: 'jin',
  sensei_cat: 'jin',
  boss_cat: 'milo',
  lord_whiskers: 'milo',
};

/**
 * High-resolution 512x512 custom bot portraits from assets/bots/*.png.
 * Any bot without an entry falls back to its styled SVG portrait.
 */
const BOT_AVATAR_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  martin: martinPng,
  pip: pipPng,
  elias: eliasPng,
  elena: eliasPng,
  bram: bramPng,
  nelson: nelsonPng,
  vex: vexPng,
  jamal: jamalPng,
  sofia: jamalPng,
  marcus: marcusPng,
  viktor: viktorPng,
  achref: achrefPng,
  barnaby: barnabyPng,
  finn: finnPng,
  clara: claraPng,
  leo: leoPng,
  tariq: tariqPng,
  ren: renPng,
  mateo: mateoPng,
  zara: zaraPng,
  archimedes: archimedesPng,
  fiona: fionaPng,
  dmitri: dmitriPng,
  layla: laylaPng,
  dante: dantePng,
  meiling: meilingPng,
  amara: amaraPng,
  gideon: gideonPng,
  sora: soraPng,
  samira: samiraPng,
  torstein: torsteinPng,
  kofi: kofiPng,
  diego: diegoPng,
  hassan: hassanPng,
  jin: jinPng,
  sterling: sterlingPng,
  kenzo: kenzoPng,
  valeria: valeriaPng,
  nexus9: nexus9Png,
  boba: bobaPng,
  milo: miloPng,
};

export const BotAvatar: React.FC<BotAvatarProps> = ({
  avatarKey = 'martin',
  color = THEME.colors.primary,
  size = 'md',
  showGlow = false,
  noBg = false,
  selected = false,
  style,
}) => {
  const styles = useStyles(createStyles);
  const px = typeof size === 'number' ? size : SIZE_MAP[size] ?? SIZE_MAP.md;
  const cornerRadius = Math.max(6, Math.round(px * 0.18));

  const resolvedKey = CANONICAL_BOT_KEY[avatarKey] ?? avatarKey;
  const customImg = BOT_AVATAR_IMAGES[resolvedKey] ?? BOT_AVATAR_IMAGES[avatarKey];

  const containerStyle = [
    styles.container,
    {
      width: px,
      height: px,
      borderRadius: noBg ? 0 : cornerRadius,
      backgroundColor: noBg ? 'transparent' : THEME.colors.surfaceMuted,
      borderWidth: noBg ? 0 : 2.5,
      borderColor: selected ? THEME.colors.primary : 'transparent',
    },
    style,
  ];

  let portrait: React.ReactNode;
  switch (resolvedKey) {
    case 'martin':
      portrait = <MartinPortrait size={px} noBg={noBg} />;
      break;
    case 'pip':
      portrait = <PipPortrait size={px} noBg={noBg} />;
      break;
    case 'elias':
    case 'elena':
      portrait = <ElenaPortrait size={px} noBg={noBg} />;
      break;
    case 'bram':
      portrait = <BramPortrait size={px} noBg={noBg} />;
      break;
    case 'nelson':
      portrait = <NelsonPortrait size={px} noBg={noBg} />;
      break;
    case 'vex':
      portrait = <VexPortrait size={px} noBg={noBg} />;
      break;
    case 'jamal':
    case 'sofia':
      portrait = <SofiaPortrait size={px} noBg={noBg} />;
      break;
    case 'marcus':
      portrait = <MarcusPortrait size={px} noBg={noBg} />;
      break;
    case 'viktor':
      portrait = <ViktorPortrait size={px} noBg={noBg} />;
      break;
    case 'achref':
      portrait = <AchrefPortrait size={px} noBg={noBg} />;
      break;
    default:
      portrait = (
        <View
          style={{
            width: px,
            height: px,
            backgroundColor: noBg ? 'transparent' : color,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        />
      );
      break;
  }

  return (
    <View style={containerStyle}>
      {customImg ? (
        <Image
          source={customImg}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: noBg ? 0 : Math.max(0, cornerRadius - 2),
          }}
          resizeMode={noBg ? 'contain' : 'cover'}
        />
      ) : (
        portrait
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
  });
