import { Hero, HeroData } from '../entities/Hero';
import { Enemy, EnemyData } from '../entities/Enemy';
import { GridUnit } from '../systems/GridSystem';
import { LevelDefinition, PlayerHeroState, EnemySpawn, HeroSpawn, BaseStats } from '../types/game.types';
import { HERO_DEFINITIONS_BY_ID } from './heroes.data';
import { ENEMY_DEFINITIONS_BY_ID } from './enemies.data';
import { SKILLS_BY_ID } from './skills.data';
import { SkillData } from '../entities/Skill';

// ---------------------------------------------------------------------------
// combat.factory.ts
//
// Construit les entités de combat (Hero, Enemy, GridUnit) depuis les
// données statiques (définitions) et l'état joueur (PlayerHeroState).
//
// C'est le seul endroit où les données "game design" se transforment
// en objets runtime utilisés par CombatSystem et CombatScene.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scalage des stats ennemis
// ---------------------------------------------------------------------------

function scaleStats(base: BaseStats, factor: number): BaseStats {
  return {
    hp: Math.round(base.hp * factor),
    attack: Math.round(base.attack * factor),
    defense: Math.round(base.defense * factor),
    speed: base.speed, // la vitesse n'est pas scalée
  };
}

// ---------------------------------------------------------------------------
// Construction des héros
// ---------------------------------------------------------------------------

/**
 * Construit un Hero runtime depuis l'état joueur.
 * Les stats sont scalées selon le niveau du héros (8% par niveau).
 */
export function buildHero(state: PlayerHeroState): Hero {
  const def = HERO_DEFINITIONS_BY_ID[state.heroId];
  if (!def) throw new Error(`Hero definition not found: ${state.heroId}`);

  const levelMultiplier = 1 + (state.level - 1) * 0.08;
  const scaledStats = {
    hp: Math.round(def.baseStats.hp * levelMultiplier),
    attack: Math.round(def.baseStats.attack * levelMultiplier),
    defense: Math.round(def.baseStats.defense * levelMultiplier),
    speed: def.baseStats.speed,
  };

  const skills: SkillData[] = state.equippedSkills
  .map(id => SKILLS_BY_ID[id])
  .filter(Boolean);

  if (skills.length === 0) {
    throw new Error(`Hero ${state.heroId} has no valid equipped skills`);
  }

  const heroData: HeroData = {
    id: def.id,
    name: def.name,
    hp: scaledStats.hp,
    maxHp: scaledStats.hp,
    attack: scaledStats.attack,
    defense: scaledStats.defense,
    speed: scaledStats.speed,
    skills,
  };

  return new Hero(heroData);
}

/**
 * Construit le GridUnit correspondant à un héros pour un niveau donné.
 */
export function buildHeroGridUnit(state: PlayerHeroState, spawn: HeroSpawn): GridUnit {
  const def = HERO_DEFINITIONS_BY_ID[state.heroId];
  if (!def) throw new Error(`Hero definition not found: ${state.heroId}`);

  return {
    id: def.id,
    isHero: true,
    pos: { col: spawn.col, row: spawn.row },
    moveRange: def.moveRange,
  };
}

// ---------------------------------------------------------------------------
// Construction des ennemis
// ---------------------------------------------------------------------------

/**
 * Construit un Enemy runtime depuis un EnemySpawn (qui contient le scaleFactor).
 */
export function buildEnemy(spawn: EnemySpawn, index: number): Enemy {
  const def = ENEMY_DEFINITIONS_BY_ID[spawn.enemyId];
  if (!def) throw new Error(`Enemy definition not found: ${spawn.enemyId}`);

  const scale = spawn.scaleFactor ?? 1.0;
  const scaledStats = scaleStats(def.baseStats, scale);

  // Les ennemis du même type reçoivent un id unique via l'index
  const uniqueId = `${def.id}_${index}`;

  const skills: SkillData[] = def.skills
  .map(id => SKILLS_BY_ID[id])
  .filter(Boolean);

  const enemyData: EnemyData = {
    id: uniqueId,
    name: def.name,
    hp: scaledStats.hp,
    maxHp: scaledStats.hp,
    attack: scaledStats.attack,
    defense: scaledStats.defense,
    speed: scaledStats.speed,
    skills
  };

  return new Enemy(enemyData);
}

/**
 * Construit le GridUnit correspondant à un ennemi dans un niveau.
 */
export function buildEnemyGridUnit(spawn: EnemySpawn, index: number): GridUnit {
  const def = ENEMY_DEFINITIONS_BY_ID[spawn.enemyId];
  if (!def) throw new Error(`Enemy definition not found: ${spawn.enemyId}`);

  return {
    id: `${def.id}_${index}`,
    isHero: false,
    pos: { col: spawn.col, row: spawn.row },
    moveRange: def.moveRange,
  };
}

// ---------------------------------------------------------------------------
// Construction complète d'un niveau
// ---------------------------------------------------------------------------

export interface CombatSetup {
  heroes: Hero[];
  enemies: Enemy[];
  heroUnits: GridUnit[];
  enemyUnits: GridUnit[];
  maxRounds: number;
}

/**
 * Point d'entrée principal : construit tout ce dont CombatScene a besoin
 * pour initialiser un combat depuis un niveau et l'état joueur.
 *
 * Usage dans CombatScene.create() :
 *   const setup = buildCombatSetup(level, playerHeroStates);
 *   this.heroes  = setup.heroes;
 *   this.enemies = setup.enemies;
 *   // placer les unités sur la grille...
 */
export function buildCombatSetup(
  level: LevelDefinition,
  heroStates: PlayerHeroState[]
): CombatSetup {
  // Héros — on ne construit que les héros présents dans heroSpawns du niveau
  const heroes: Hero[] = [];
  const heroUnits: GridUnit[] = [];

  for (const spawn of level.heroSpawns) {
    const state = heroStates.find(s => s.heroId === spawn.heroId);
    if (!state) continue; // héros non disponible pour ce joueur

    heroes.push(buildHero(state));
    heroUnits.push(buildHeroGridUnit(state, spawn));
  }

  // Ennemis
  const enemies: Enemy[] = [];
  const enemyUnits: GridUnit[] = [];

  level.enemySpawns.forEach((spawn, index) => {
    enemies.push(buildEnemy(spawn, index));
    enemyUnits.push(buildEnemyGridUnit(spawn, index));
  });

  return {
    heroes,
    enemies,
    heroUnits,
    enemyUnits,
    maxRounds: level.maxRounds,
  };
}
