// ---------------------------------------------------------------------------
// game.types.ts
//
// Types fondamentaux partagés dans toute la codebase.
// Aucune dépendance vers Phaser ou les systèmes de combat.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Classes & rôles
// ---------------------------------------------------------------------------

export type HeroClass =
  | 'archer'   // DPS distance
  | 'lancer'   // DPS corps à corps
  | 'warrior'  // Tank
  | 'monk';    // Support / soin

export type EnemyType = 'normal' | 'boss' | 'mega_boss';

export type SkillTargetType = 'single' | 'aoe' | 'all';

export type SkillEffectType = 'physical' | 'magic' | 'support';

export type AoeShapeType = 'radius' | 'square' | 'cross' | 'line' | 'all';

// ---------------------------------------------------------------------------
// Statistiques de base
// ---------------------------------------------------------------------------

/**
 * Stats brutes d'une unité.
 * Utilisées à la fois pour les héros (via HeroDefinition) et les ennemis (via EnemyDefinition).
 */
export interface BaseStats {
  hp:      number;
  attack:  number;
  defense: number;
  speed:   number;   // détermine l'ordre dans la timeline de tour
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export interface AoeShape {
  type:   AoeShapeType;
  value?: number;
}

/**
 * Définition statique d'un skill — ne change jamais en cours de partie.
 * L'état runtime (cooldown restant) est géré dans la classe Skill.
 */
export interface SkillDefinition {
  id:            string;
  name:          string;
  description:   string;
  availableFor:  HeroClass[];   // classes qui peuvent équiper ce skill (vide = tous)
  damage?:       number;
  heal?:         number;
  hits?:         number;        // nombre de coups (défaut: 1)
  cooldownTurns: number;        // 0 = relançable chaque tour
  range:         number;        // 0 = centré sur le caster
  targetType:    SkillTargetType;
  aoe?:          AoeShape;
  type:          SkillEffectType;
}

// ---------------------------------------------------------------------------
// Héros
// ---------------------------------------------------------------------------

/** Définition statique d'un héros — données de game design, ne changent pas. */
export interface HeroDefinition {
  id:              string;
  name:            string;
  class:           HeroClass;
  baseStats:       BaseStats;
  moveRange:       number;
  availableSkills: string[];    // ids des skills que ce héros peut équiper
  spriteKey:       string;      // clé Phaser pour charger les assets
}

/**
 * État persisté d'un héros pour un joueur donné.
 * C'est cette structure qui sera sauvegardée (localStorage / API).
 */
export interface PlayerHeroState {
  heroId:         string;
  level:          number;
  xp:             number;
  equippedSkills: [string, string, string, string]; // toujours exactement 4 skills
  // equipment: EquipmentId[]  // à ajouter plus tard
}

// ---------------------------------------------------------------------------
// Ennemis
// ---------------------------------------------------------------------------

/** Définition statique d'un ennemi — données de game design. */
export interface EnemyDefinition {
  id:        string;
  name:      string;
  type:      EnemyType;
  baseStats: BaseStats;
  moveRange: number;
  skills:    string[];    // 2 skills pour normal, 3 pour boss
  spriteKey: string;
  xpReward:  number;
  goldReward: number;
}

// ---------------------------------------------------------------------------
// Niveaux / Maps de combat
// ---------------------------------------------------------------------------

/** Placement d'un ennemi dans un niveau, avec scalage optionnel de difficulté. */
export interface EnemySpawn {
  enemyId:      string;
  col:          number;
  row:          number;
  scaleFactor?: number;   // multiplie les stats de base (défaut: 1.0)
}

/** Placement de départ d'un héros sur la grille. */
export interface HeroSpawn {
  heroId: string;
  col:    number;
  row:    number;
}

/** Définition complète d'un niveau de combat. */
export interface LevelDefinition {
  id:             string;
  name:           string;
  zone:           string;         // ex: 'foret', 'donjon', 'volcan'
  order:          number;         // position dans la progression (1, 2, 3...)
  maxRounds:      number;
  enemySpawns:    EnemySpawn[];
  heroSpawns:     HeroSpawn[];    // positions de départ suggérées pour les héros
}

// ---------------------------------------------------------------------------
// Puissance & difficulté
// ---------------------------------------------------------------------------

/**
 * Résultat du calcul de puissance d'une équipe.
 * Affiché avant le combat pour aider le joueur à évaluer ses chances.
 */
export interface PowerRating {
  total:      number;
  breakdown: {
    hp:      number;
    attack:  number;
    defense: number;
    speed:   number;
  };
}
