import { EnemyDefinition } from '../types/game.types';

// ---------------------------------------------------------------------------
// enemies.data.ts
//
// Catalogue statique de tous les ennemis du jeu.
// Les stats de base sont pour scaleFactor = 1.0 (difficulté neutre).
// En combat, les stats réelles = baseStats * scaleFactor du niveau.
//
// Conventions skills :
//   normal  → 2 skills : [attaque_basique, coup_puissant]
//   boss    → 3 skills : [attaque_basique, coup_puissant, ulti]
// ---------------------------------------------------------------------------

export const ENEMY_DEFINITIONS: EnemyDefinition[] = [

  // -------------------------------------------------------------------------
  // Ennemis normaux — Forêt
  // -------------------------------------------------------------------------
  {
    id:        'goblin',
    name:      'Goblin',
    type:      'normal',
    baseStats: { hp: 600,  attack: 12, defense: 2,  speed: 1400 },
    moveRange: 3,
    skills:    ['enemy_basic_attack', 'enemy_heavy_blow'],
    spriteKey: 'goblin'
  },
  {
    id:        'orc',
    name:      'Orc',
    type:      'normal',
    baseStats: { hp: 900,  attack: 18, defense: 5,  speed: 1600 },
    moveRange: 2,
    skills:    ['enemy_basic_attack', 'enemy_cleave'],
    spriteKey: 'orc'
  },
  {
    id:        'dark_elf',
    name:      'Dark Elf',
    type:      'normal',
    baseStats: { hp: 500,  attack: 22, defense: 3,  speed: 1200 },
    moveRange: 4,
    skills:    ['enemy_basic_attack', 'enemy_heavy_blow'],
    spriteKey: 'dark_elf'
  },

  // -------------------------------------------------------------------------
  // Boss — Forêt
  // -------------------------------------------------------------------------
  {
    id:        'goblin_king',
    name:      'Goblin King',
    type:      'boss',
    baseStats: { hp: 2500, attack: 28, defense: 8,  speed: 1800 },
    moveRange: 2,
    skills:    ['enemy_basic_attack', 'enemy_cleave', 'boss_shockwave'],
    spriteKey: 'goblin_king'
  },

  // -------------------------------------------------------------------------
  // Ennemis normaux — Donjon
  // -------------------------------------------------------------------------
  {
    id:        'skeleton',
    name:      'Skeleton',
    type:      'normal',
    baseStats: { hp: 700,  attack: 15, defense: 4,  speed: 1500 },
    moveRange: 3,
    skills:    ['enemy_basic_attack', 'enemy_heavy_blow'],
    spriteKey: 'skeleton'
  },
  {
    id:        'skeleton_archer',
    name:      'Skeleton Archer',
    type:      'normal',
    baseStats: { hp: 500,  attack: 20, defense: 2,  speed: 1300 },
    moveRange: 2,
    skills:    ['enemy_basic_attack', 'enemy_heavy_blow'],
    spriteKey: 'skeleton_archer'
  },

  // -------------------------------------------------------------------------
  // Boss — Donjon
  // -------------------------------------------------------------------------
  {
    id:        'lich',
    name:      'Lich',
    type:      'boss',
    baseStats: { hp: 3000, attack: 35, defense: 6,  speed: 1600 },
    moveRange: 2,
    skills:    ['enemy_basic_attack', 'boss_rage', 'boss_ulti'],
    spriteKey: 'lich'
  },
];

export const ENEMY_DEFINITIONS_BY_ID = Object.fromEntries(
  ENEMY_DEFINITIONS.map(e => [e.id, e])
) as Record<string, EnemyDefinition>;
