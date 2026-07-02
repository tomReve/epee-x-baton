import { SkillDefinition } from '../types/game.types';

// ---------------------------------------------------------------------------
// skills.data.ts
//
// Catalogue complet de tous les skills du jeu.
// Un skill peut être équipé par un héros (via availableFor) ou
// utilisé par un ennemi (référencé directement dans EnemyDefinition).
//
// Conventions de nommage des ids :
//   hero_{classe}_{nom}   ex: hero_archer_piercing_shot
//   enemy_{type}_{nom}    ex: enemy_goblin_slash
// ---------------------------------------------------------------------------

export const SKILLS: SkillDefinition[] = [

  // -------------------------------------------------------------------------
  // Archer — DPS distance
  // -------------------------------------------------------------------------
  {
    id:            'archer_quick_shot',
    name:          'Quick Shot',
    description:   'Tir rapide sur une cible à distance.',
    availableFor:  ['archer'],
    damage:        25,
    cooldownTurns: 0,
    range:         4,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'archer_piercing_shot',
    name:          'Piercing Shot',
    description:   'Flèche perçante qui traverse plusieurs ennemis en ligne.',
    availableFor:  ['archer'],
    damage:        35,
    cooldownTurns: 3,
    range:         5,
    targetType:    'aoe',
    aoe:           { type: 'line', value: 4 },
    type:          'physical',
  },
  {
    id:            'archer_rain_of_arrows',
    name:          'Rain of Arrows',
    description:   'Pluie de flèches sur une zone.',
    availableFor:  ['archer'],
    damage:        20,
    cooldownTurns: 4,
    range:         3,
    targetType:    'aoe',
    aoe:           { type: 'square', value: 1 },
    type:          'physical',
  },
  {
    id:            'archer_multishot',
    name:          'Multishot',
    description:   'Plusieurs tirs rapides sur la même cible.',
    availableFor:  ['archer'],
    damage:        15,
    hits:          3,
    cooldownTurns: 3,
    range:         4,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'archer_snipe',
    name:          'Snipe',
    description:   'Tir de précision à très longue portée.',
    availableFor:  ['archer'],
    damage:        70,
    cooldownTurns: 5,
    range:         7,
    targetType:    'single',
    type:          'physical',
  },

  // -------------------------------------------------------------------------
  // Lancer — DPS corps à corps
  // -------------------------------------------------------------------------
  {
    id:            'lancer_thrust',
    name:          'Thrust',
    description:   'Coup de lance frontal rapide.',
    availableFor:  ['lancer'],
    damage:        30,
    cooldownTurns: 0,
    range:         2,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'lancer_sweep',
    name:          'Sweep',
    description:   'Balayage horizontal touchant les ennemis adjacents.',
    availableFor:  ['lancer'],
    damage:        25,
    cooldownTurns: 3,
    range:         1,
    targetType:    'aoe',
    aoe:           { type: 'cross', value: 1 },
    type:          'physical',
  },
  {
    id:            'lancer_charge',
    name:          'Charge',
    description:   'Charge en ligne droite, frappe tous les ennemis sur le passage.',
    availableFor:  ['lancer'],
    damage:        40,
    cooldownTurns: 4,
    range:         1,
    targetType:    'aoe',
    aoe:           { type: 'line', value: 3 },
    type:          'physical',
  },
  {
    id:            'lancer_multi_thrust',
    name:          'Multi Thrust',
    description:   'Série de coups de lance rapides sur une cible.',
    availableFor:  ['lancer'],
    damage:        18,
    hits:          4,
    cooldownTurns: 4,
    range:         2,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'lancer_dragon_strike',
    name:          'Dragon Strike',
    description:   'Coup de lance puissant en saut.',
    availableFor:  ['lancer'],
    damage:        80,
    cooldownTurns: 6,
    range:         3,
    targetType:    'single',
    type:          'physical',
  },

  // -------------------------------------------------------------------------
  // Warrior — Tank
  // -------------------------------------------------------------------------
  {
    id:            'warrior_shield_bash',
    name:          'Shield Bash',
    description:   'Frappe au bouclier sur la cible adjacente.',
    availableFor:  ['warrior'],
    damage:        20,
    cooldownTurns: 0,
    range:         1,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'warrior_whirlwind',
    name:          'Whirlwind',
    description:   'Tourbillon frappant tous les ennemis autour.',
    availableFor:  ['warrior'],
    damage:        28,
    cooldownTurns: 4,
    range:         0,
    targetType:    'aoe',
    aoe:           { type: 'radius', value: 1 },
    type:          'physical',
  },
  {
    id:            'warrior_shockwave',
    name:          'Shockwave',
    description:   'Onde de choc dans un carré autour du guerrier.',
    availableFor:  ['warrior'],
    damage:        22,
    cooldownTurns: 3,
    range:         0,
    targetType:    'aoe',
    aoe:           { type: 'square', value: 1 },
    type:          'physical',
  },
  {
    id:            'warrior_power_slash',
    name:          'Power Slash',
    description:   'Coup puissant sur une cible.',
    availableFor:  ['warrior'],
    damage:        55,
    cooldownTurns: 4,
    range:         1,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'warrior_war_cry',
    name:          'War Cry',
    description:   'Cri de guerre qui frappe tous les ennemis.',
    availableFor:  ['warrior'],
    damage:        18,
    cooldownTurns: 5,
    range:         0,
    targetType:    'all',
    type:          'physical',
  },

  // -------------------------------------------------------------------------
  // Monk — Support / Soin
  // -------------------------------------------------------------------------
  {
    id:            'monk_heal',
    name:          'Heal',
    description:   'Soin sur le moine lui-même.',
    availableFor:  ['monk'],
    heal:          40,
    cooldownTurns: 1,
    range:         0,
    targetType:    'single',
    type:          'support',
  },
  {
    id:            'monk_holy_strike',
    name:          'Holy Strike',
    description:   'Frappe sacrée à distance.',
    availableFor:  ['monk'],
    damage:        30,
    cooldownTurns: 1,
    range:         3,
    targetType:    'single',
    type:          'magic',
  },
  {
    id:            'monk_holy_cross',
    name:          'Holy Cross',
    description:   'Croix de lumière touchant les ennemis en croix.',
    availableFor:  ['monk'],
    damage:        25,
    cooldownTurns: 5,
    range:         3,
    targetType:    'aoe',
    aoe:           { type: 'cross', value: 2 },
    type:          'magic',
  },
  {
    id:            'monk_meteor',
    name:          'Meteor',
    description:   'Météore frappant tous les ennemis.',
    availableFor:  ['monk'],
    damage:        22,
    cooldownTurns: 4,
    range:         0,
    targetType:    'all',
    type:          'magic',
  },
  {
    id:            'monk_nova',
    name:          'Nova',
    description:   'Explosion de lumière dans un grand carré.',
    availableFor:  ['monk'],
    damage:        28,
    cooldownTurns: 6,
    range:         2,
    targetType:    'aoe',
    aoe:           { type: 'square', value: 2 },
    type:          'magic',
  },

  // -------------------------------------------------------------------------
  // Skills ennemis — communs
  // -------------------------------------------------------------------------
  {
    id:            'enemy_basic_attack',
    name:          'Basic Attack',
    description:   'Attaque simple.',
    availableFor:  [],
    damage:        20,
    cooldownTurns: 0,
    range:         1,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'enemy_heavy_blow',
    name:          'Heavy Blow',
    description:   'Coup puissant sur une cible.',
    availableFor:  [],
    damage:        45,
    cooldownTurns: 3,
    range:         1,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'enemy_cleave',
    name:          'Cleave',
    description:   'Frappe en arc touchant plusieurs héros.',
    availableFor:  [],
    damage:        30,
    cooldownTurns: 3,
    range:         1,
    targetType:    'aoe',
    aoe:           { type: 'cross', value: 1 },
    type:          'physical',
  },

  // -------------------------------------------------------------------------
  // Skills boss
  // -------------------------------------------------------------------------
  {
    id:            'boss_rage',
    name:          'Rage',
    description:   'Attaque frénétique multi-coups.',
    availableFor:  [],
    damage:        25,
    hits:          3,
    cooldownTurns: 4,
    range:         1,
    targetType:    'single',
    type:          'physical',
  },
  {
    id:            'boss_shockwave',
    name:          'Boss Shockwave',
    description:   'Onde de choc touchant tous les héros.',
    availableFor:  [],
    damage:        35,
    cooldownTurns: 5,
    range:         0,
    targetType:    'all',
    type:          'physical',
  },
  {
    id:            'boss_ulti',
    name:          'Ultimate',
    description:   "Attaque ultime dévastatrice sur toute la zone.",
    availableFor:  [],
    damage:        60,
    cooldownTurns: 6,
    range:         0,
    targetType:    'all',
    type:          'magic',
  },
];

// Accès par id pour les lookups rapides
export const SKILLS_BY_ID = Object.fromEntries(
  SKILLS.map(s => [s.id, s])
) as Record<string, SkillDefinition>;

/** Retourne les skills disponibles pour une classe donnée. */
export function getSkillsForClass(heroClass: string): SkillDefinition[] {
  return SKILLS.filter(s => s.availableFor.includes(heroClass as any));
}
