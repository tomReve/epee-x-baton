import { HeroDefinition, PlayerHeroState } from '../types/game.types';

// ---------------------------------------------------------------------------
// heroes.data.ts
//
// Catalogue statique des héros jouables.
// HeroDefinition = ce que le héros EST (game design, ne change pas)
// PlayerHeroState = ce que le héros DEVIENT (progression joueur, persisté)
// ---------------------------------------------------------------------------

const MOVE_RANGE_NORMAL = 4;

export const HERO_DEFINITIONS: HeroDefinition[] = [
  {
    id:        'archer',
    name:      'Archer',
    class:     'archer',
    baseStats: { hp: 1200, attack: 30, defense: 4,  speed: 1600 },
    moveRange: MOVE_RANGE_NORMAL,
    availableSkills: [
      'archer_quick_shot',
      'archer_piercing_shot',
      'archer_rain_of_arrows',
      'archer_multishot',
      'archer_snipe',
    ],
    spriteKey: 'archer',
  },
  {
    id:        'lancer',
    name:      'Lancer',
    class:     'lancer',
    baseStats: { hp: 1600, attack: 28, defense: 6,  speed: 1400 },
    moveRange: MOVE_RANGE_NORMAL,
    availableSkills: [
      'lancer_thrust',
      'lancer_sweep',
      'lancer_charge',
      'lancer_multi_thrust',
      'lancer_dragon_strike',
    ],
    spriteKey: 'lancer',
  },
  {
    id:        'warrior',
    name:      'Warrior',
    class:     'warrior',
    baseStats: { hp: 2500, attack: 20, defense: 12, speed: 1200 },
    moveRange: MOVE_RANGE_NORMAL,
    availableSkills: [
      'warrior_shield_bash',
      'warrior_whirlwind',
      'warrior_shockwave',
      'warrior_power_slash',
      'warrior_war_cry',
    ],
    spriteKey: 'warrior',
  },
  {
    id:        'monk',
    name:      'Monk',
    class:     'monk',
    baseStats: { hp: 1400, attack: 18, defense: 5,  speed: 1500 },
    moveRange: MOVE_RANGE_NORMAL,
    availableSkills: [
      'monk_heal',
      'monk_holy_strike',
      'monk_holy_cross',
      'monk_meteor',
      'monk_nova',
    ],
    spriteKey: 'monk',
  },
];

export const HERO_DEFINITIONS_BY_ID = Object.fromEntries(
  HERO_DEFINITIONS.map(h => [h.id, h])
) as Record<string, HeroDefinition>;

// ---------------------------------------------------------------------------
// État joueur par défaut
//
// Utilisé pour initialiser un nouveau joueur.
// En jeu, ces états seront chargés depuis la sauvegarde.
// ---------------------------------------------------------------------------

export const DEFAULT_PLAYER_HERO_STATES: PlayerHeroState[] = [
  {
    heroId:         'warrior',
    level:          1,
    xp:             0,
    equippedSkills: ['warrior_shield_bash', 'warrior_whirlwind', 'warrior_shockwave', 'warrior_power_slash'],
  },
  {
    heroId:         'monk',
    level:          1,
    xp:             0,
    equippedSkills: ['monk_heal', 'monk_sanctuary', 'monk_holy_cross', 'monk_meteor'],
  },
];
