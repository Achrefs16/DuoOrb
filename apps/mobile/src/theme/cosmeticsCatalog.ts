import { useSyncExternalStore } from 'react';
import { ImageSourcePropType } from 'react-native';
import { isPremiumActive } from '../monetization/premium';

export type CosmeticTier = 'free' | 'premium';
export type CosmeticCollection = 'fantasy' | 'warriors' | 'mythic';

export interface CosmeticAssets {
  /** In-game board piece token (1:1 circular orb/medallion) */
  orb: ImageSourcePropType;
  /** Full horizontal wall placed across 2 cells + 1 gap */
  wallH: ImageSourcePropType;
  /** Vertical wall placed on the board (90° rotated) */
  wallV: ImageSourcePropType;
  /** Condensed 3.5:1 mini-wall for the bottom inventory tray */
  wallTray: ImageSourcePropType;
  /** Optional full-body/bust portrait for HUD/profiles (available for Warriors collection) */
  avatarBust?: ImageSourcePropType;
}

export interface CosmeticSkin {
  id: string;
  name: string;
  collection: CosmeticCollection;
  tier: CosmeticTier;
  description: string;
  assets: CosmeticAssets;
  /** Dual-tone contrast profile for mirror matches */
  contrast: {
    hostRim: string;
    guestRim: string;
    glowColor: string;
  };
}

export const COSMETIC_SKINS: Record<string, CosmeticSkin> = {
  // ===================== COLLECTION 1: FANTASY & SCI-FI (newcos.png) =====================
  clockwork: {
    id: 'clockwork',
    name: 'Clockwork Automaton',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Brass gears, intricate cogs, and Victorian mechanical plates.',
    assets: {
      orb: require('../../assets/cosmetics/clockwork/orb.png'),
      wallH: require('../../assets/cosmetics/clockwork/wall_h.png'),
      wallV: require('../../assets/cosmetics/clockwork/wall_v.png'),
      wallTray: require('../../assets/cosmetics/clockwork/wall_tray.png'),
    },
    contrast: {
      hostRim: '#F59E0B',
      guestRim: '#78350F',
      glowColor: 'rgba(245, 158, 11, 0.4)',
    },
  },
  magical_heart: {
    id: 'magical_heart',
    name: 'Starlight Romance',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Ruby heart emblem with celestial gold wings and sparkling stars.',
    assets: {
      orb: require('../../assets/cosmetics/magical_heart/orb.png'),
      wallH: require('../../assets/cosmetics/magical_heart/wall_h.png'),
      wallV: require('../../assets/cosmetics/magical_heart/wall_v.png'),
      wallTray: require('../../assets/cosmetics/magical_heart/wall_tray.png'),
    },
    contrast: {
      hostRim: '#EC4899',
      guestRim: '#831843',
      glowColor: 'rgba(236, 72, 153, 0.4)',
    },
  },
  cyber_pulse: {
    id: 'cyber_pulse',
    name: 'Neon Gridlock',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Pulsing cyan radar rings and high-frequency circuit conduit walls.',
    assets: {
      orb: require('../../assets/cosmetics/cyber_pulse/orb.png'),
      wallH: require('../../assets/cosmetics/cyber_pulse/wall_h.png'),
      wallV: require('../../assets/cosmetics/cyber_pulse/wall_v.png'),
      wallTray: require('../../assets/cosmetics/cyber_pulse/wall_tray.png'),
    },
    contrast: {
      hostRim: '#06B6D4',
      guestRim: '#D946EF',
      glowColor: 'rgba(6, 182, 212, 0.4)',
    },
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Blossom',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Delicate pastel pink cherry blossoms and spring floral geometry.',
    assets: {
      orb: require('../../assets/cosmetics/sakura/orb.png'),
      wallH: require('../../assets/cosmetics/sakura/wall_h.png'),
      wallV: require('../../assets/cosmetics/sakura/wall_v.png'),
      wallTray: require('../../assets/cosmetics/sakura/wall_tray.png'),
    },
    contrast: {
      hostRim: '#F472B6',
      guestRim: '#34D399',
      glowColor: 'rgba(244, 114, 182, 0.35)',
    },
  },
  celestial: {
    id: 'celestial',
    name: 'Astral Astrolabe',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Midnight celestial spheres with gold compasses and constellation skies.',
    assets: {
      orb: require('../../assets/cosmetics/celestial/orb.png'),
      wallH: require('../../assets/cosmetics/celestial/wall_h.png'),
      wallV: require('../../assets/cosmetics/celestial/wall_v.png'),
      wallTray: require('../../assets/cosmetics/celestial/wall_tray.png'),
    },
    contrast: {
      hostRim: '#FBBF24',
      guestRim: '#312E81',
      glowColor: 'rgba(251, 191, 36, 0.4)',
    },
  },
  starlight_angel: {
    id: 'starlight_angel',
    name: 'Seraphic Dream',
    collection: 'fantasy',
    tier: 'premium',
    description: 'Pastel lavender aura with angelic wings and starry halos.',
    assets: {
      orb: require('../../assets/cosmetics/starlight_angel/orb.png'),
      wallH: require('../../assets/cosmetics/starlight_angel/wall_h.png'),
      wallV: require('../../assets/cosmetics/starlight_angel/wall_v.png'),
      wallTray: require('../../assets/cosmetics/starlight_angel/wall_tray.png'),
    },
    contrast: {
      hostRim: '#C084FC',
      guestRim: '#581C87',
      glowColor: 'rgba(192, 132, 252, 0.35)',
    },
  },

  // ===================== COLLECTION 2: WARRIORS & CHAMPIONS (newcos (2).png) =====================
  paladin_knight: {
    id: 'paladin_knight',
    name: 'Golden Paladin',
    collection: 'warriors',
    tier: 'premium',
    description: 'Polished silver and gilded royal plate armor with heavy fortress barriers.',
    assets: {
      orb: require('../../assets/cosmetics/paladin_knight/orb.png'),
      wallH: require('../../assets/cosmetics/paladin_knight/wall_h.png'),
      wallV: require('../../assets/cosmetics/paladin_knight/wall_v.png'),
      wallTray: require('../../assets/cosmetics/paladin_knight/wall_tray.png'),
      avatarBust: require('../../assets/cosmetics/paladin_knight/avatar_bust.png'),
    },
    contrast: {
      hostRim: '#EAB308',
      guestRim: '#475569',
      glowColor: 'rgba(234, 179, 8, 0.4)',
    },
  },
  crimson_samurai: {
    id: 'crimson_samurai',
    name: 'Crimson Shogun',
    collection: 'warriors',
    tier: 'premium',
    description: 'Lacquered kabuto battle armor with demonic red glow conduit walls.',
    assets: {
      orb: require('../../assets/cosmetics/crimson_samurai/orb.png'),
      wallH: require('../../assets/cosmetics/crimson_samurai/wall_h.png'),
      wallV: require('../../assets/cosmetics/crimson_samurai/wall_v.png'),
      wallTray: require('../../assets/cosmetics/crimson_samurai/wall_tray.png'),
      avatarBust: require('../../assets/cosmetics/crimson_samurai/avatar_bust.png'),
    },
    contrast: {
      hostRim: '#EF4444',
      guestRim: '#991B1B',
      glowColor: 'rgba(239, 68, 68, 0.4)',
    },
  },
  norse_viking: {
    id: 'norse_viking',
    name: 'Valhalla Warlord',
    collection: 'warriors',
    tier: 'premium',
    description: 'Forged iron and brass knotwork armor with ancient Celtic chain barriers.',
    assets: {
      orb: require('../../assets/cosmetics/norse_viking/orb.png'),
      wallH: require('../../assets/cosmetics/norse_viking/wall_h.png'),
      wallV: require('../../assets/cosmetics/norse_viking/wall_v.png'),
      wallTray: require('../../assets/cosmetics/norse_viking/wall_tray.png'),
      avatarBust: require('../../assets/cosmetics/norse_viking/avatar_bust.png'),
    },
    contrast: {
      hostRim: '#94A3B8',
      guestRim: '#334155',
      glowColor: 'rgba(148, 163, 184, 0.35)',
    },
  },
  mecha_specops: {
    id: 'mecha_specops',
    name: 'Apex Operative',
    collection: 'warriors',
    tier: 'premium',
    description: 'High-density composite exo-suit with ionized blue particle barriers.',
    assets: {
      orb: require('../../assets/cosmetics/mecha_specops/orb.png'),
      wallH: require('../../assets/cosmetics/mecha_specops/wall_h.png'),
      wallV: require('../../assets/cosmetics/mecha_specops/wall_v.png'),
      wallTray: require('../../assets/cosmetics/mecha_specops/wall_tray.png'),
      avatarBust: require('../../assets/cosmetics/mecha_specops/avatar_bust.png'),
    },
    contrast: {
      hostRim: '#38BDF8',
      guestRim: '#0369A1',
      glowColor: 'rgba(56, 189, 248, 0.4)',
    },
  },

  // ===================== COLLECTION 3: MYTHIC & LEGENDARY (newcos (3).png) =====================
  infernal_dragon: {
    id: 'infernal_dragon',
    name: 'Infernal Wyrm',
    collection: 'mythic',
    tier: 'premium',
    description: 'Fiery dragon visage sculpted into molten rock and scorched scale barriers.',
    assets: {
      orb: require('../../assets/cosmetics/infernal_dragon/orb.png'),
      wallH: require('../../assets/cosmetics/infernal_dragon/wall_h.png'),
      wallV: require('../../assets/cosmetics/infernal_dragon/wall_v.png'),
      wallTray: require('../../assets/cosmetics/infernal_dragon/wall_tray.png'),
    },
    contrast: {
      hostRim: '#F97316',
      guestRim: '#7C2D12',
      glowColor: 'rgba(249, 115, 22, 0.5)',
    },
  },
  shadow_oni: {
    id: 'shadow_oni',
    name: 'Demon Sovereign',
    collection: 'mythic',
    tier: 'premium',
    description: 'Fierce cyber-oni horned mask with blazing red optics and gold filigree.',
    assets: {
      orb: require('../../assets/cosmetics/shadow_oni/orb.png'),
      wallH: require('../../assets/cosmetics/shadow_oni/wall_h.png'),
      wallV: require('../../assets/cosmetics/shadow_oni/wall_v.png'),
      wallTray: require('../../assets/cosmetics/shadow_oni/wall_tray.png'),
    },
    contrast: {
      hostRim: '#DC2626',
      guestRim: '#450A0A',
      glowColor: 'rgba(220, 38, 38, 0.45)',
    },
  },
  golden_labyrinth: {
    id: 'golden_labyrinth',
    name: 'Daedalus Labyrinth',
    collection: 'mythic',
    tier: 'premium',
    description: 'Ancient architectural puzzle medallions with glowing gold maze corridors.',
    assets: {
      orb: require('../../assets/cosmetics/golden_labyrinth/orb.png'),
      wallH: require('../../assets/cosmetics/golden_labyrinth/wall_h.png'),
      wallV: require('../../assets/cosmetics/golden_labyrinth/wall_v.png'),
      wallTray: require('../../assets/cosmetics/golden_labyrinth/wall_tray.png'),
    },
    contrast: {
      hostRim: '#EAB308',
      guestRim: '#713F12',
      glowColor: 'rgba(234, 179, 8, 0.4)',
    },
  },
  quantum_core: {
    id: 'quantum_core',
    name: 'Singularity Aegis',
    collection: 'mythic',
    tier: 'premium',
    description: 'Futuristic magnetic core with multi-stage reactive armored plating.',
    assets: {
      orb: require('../../assets/cosmetics/quantum_core/orb.png'),
      wallH: require('../../assets/cosmetics/quantum_core/wall_h.png'),
      wallV: require('../../assets/cosmetics/quantum_core/wall_v.png'),
      wallTray: require('../../assets/cosmetics/quantum_core/wall_tray.png'),
    },
    contrast: {
      hostRim: '#0EA5E9',
      guestRim: '#1E293B',
      glowColor: 'rgba(14, 165, 233, 0.4)',
    },
  },
  cursed_gold: {
    id: 'cursed_gold',
    name: 'Kraken’s Curse',
    collection: 'mythic',
    tier: 'premium',
    description: 'Ghostly galleon skull emblem with billowing emerald soul-fire.',
    assets: {
      orb: require('../../assets/cosmetics/cursed_gold/orb.png'),
      wallH: require('../../assets/cosmetics/cursed_gold/wall_h.png'),
      wallV: require('../../assets/cosmetics/cursed_gold/wall_v.png'),
      wallTray: require('../../assets/cosmetics/cursed_gold/wall_tray.png'),
    },
    contrast: {
      hostRim: '#10B981',
      guestRim: '#064E3B',
      glowColor: 'rgba(16, 185, 129, 0.45)',
    },
  },
  void_demon: {
    id: 'void_demon',
    name: 'Abyssal Singularity',
    collection: 'mythic',
    tier: 'premium',
    description: 'Spiked crystalline dark matter barrier with a raging crimson event horizon.',
    assets: {
      orb: require('../../assets/cosmetics/void_demon/orb.png'),
      wallH: require('../../assets/cosmetics/void_demon/wall_h.png'),
      wallV: require('../../assets/cosmetics/void_demon/wall_v.png'),
      wallTray: require('../../assets/cosmetics/void_demon/wall_tray.png'),
    },
    contrast: {
      hostRim: '#E11D48',
      guestRim: '#4C0519',
      glowColor: 'rgba(225, 29, 72, 0.5)',
    },
  },
};

export const COSMETIC_SKIN_LIST = Object.values(COSMETIC_SKINS);

// ===================== REACTIVE SELECTION STORE =====================

let activeBallSkinId = 'classic';
let activeWallSkinId = 'classic';
const cosmeticListeners = new Set<() => void>();

function emitCosmeticsChange(): void {
  cosmeticListeners.forEach((fn) => fn());
}

function subscribeCosmetics(fn: () => void): () => void {
  cosmeticListeners.add(fn);
  return () => {
    cosmeticListeners.delete(fn);
  };
}

export function getBallSkinId(): string {
  return activeBallSkinId;
}

export function getWallSkinId(): string {
  return activeWallSkinId;
}

export function syncCosmeticsToServer(): void {
  try {
    const { socketManager } = require('../network/socket');
    const raw = socketManager?.getSocket?.();
    if (raw) {
      try {
        const rawAuth = (raw as any).auth ?? {};
        (raw as any).auth = {
          ...rawAuth,
          ballSkinId: activeBallSkinId,
          wallSkinId: activeWallSkinId,
        };
      } catch {
        // Non-fatal
      }
      if (raw.connected) {
        socketManager.emit('cosmetics:equip', {
          ballSkinId: activeBallSkinId,
          wallSkinId: activeWallSkinId,
        });
      }
    }
  } catch {
    // Non-fatal
  }
}

export function setBallSkinId(id?: string): string {
  const next = id && (id === 'classic' || COSMETIC_SKINS[id]) ? id : 'classic';
  if (activeBallSkinId !== next) {
    activeBallSkinId = next;
    emitCosmeticsChange();
    syncCosmeticsToServer();
  }
  return activeBallSkinId;
}

export function setWallSkinId(id?: string): string {
  const next = id && (id === 'classic' || COSMETIC_SKINS[id]) ? id : 'classic';
  if (activeWallSkinId !== next) {
    activeWallSkinId = next;
    emitCosmeticsChange();
    syncCosmeticsToServer();
  }
  return activeWallSkinId;
}

export function useBallSkinId(): string {
  return useSyncExternalStore(subscribeCosmetics, () => activeBallSkinId, () => activeBallSkinId);
}

export function useWallSkinId(): string {
  return useSyncExternalStore(subscribeCosmetics, () => activeWallSkinId, () => activeWallSkinId);
}

export function getCosmeticSkin(id?: string | null): CosmeticSkin | null {
  if (!id || id === 'classic') return null;
  return COSMETIC_SKINS[id] ?? null;
}

/** Active custom ball skin for rendering (null = default classic orb; strictly locked to Premium) */
export function useEquippedBallSkin(): CosmeticSkin | null {
  const id = useBallSkinId();
  if (!isPremiumActive()) return null;
  return getCosmeticSkin(id);
}

/** Active custom wall skin for rendering (null = default classic/board wall; strictly locked to Premium) */
export function useEquippedWallSkin(): CosmeticSkin | null {
  const id = useWallSkinId();
  if (!isPremiumActive()) return null;
  return getCosmeticSkin(id);
}


