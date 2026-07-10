// tests/data/combat.factory.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildHero,
  buildHeroGridUnit,
  buildEnemy,
  buildEnemyGridUnit,
  buildCombatSetup,
} from '../../src/data/combat.factory';
import { PlayerHeroState, EnemySpawn, HeroSpawn, LevelDefinition } from '../../src/types/game.types';

// ---------------------------------------------------------------------------
// Mocks des catalogues data — isole la factory du contenu réel du jeu
// vi.mock est hoisted : les valeurs doivent être déclarées via vi.hoisted
// ---------------------------------------------------------------------------

const { mockHeroDef, mockEnemyDef, mockSkillA, mockSkillB } = vi.hoisted(() => {
  const mockHeroDef = {
    id: 'test_hero',
    name: 'Test Hero',
    class: 'warrior',
    baseStats: { hp: 1000, attack: 20, defense: 10, speed: 1500 },
    moveRange: 4,
    availableSkills: ['skill_a', 'skill_b'],
    spriteKey: 'test_hero',
  };

  const mockEnemyDef = {
    id: 'test_enemy',
    name: 'Test Enemy',
    type: 'normal',
    baseStats: { hp: 500, attack: 15, defense: 5, speed: 1400 },
    moveRange: 4,
    skills: ['skill_a'],
    spriteKey: 'test_enemy',
  };

  const mockSkillA = {
    id: 'skill_a', name: 'Skill A', description: '', availableFor: ['warrior'],
    damage: 20, cooldownTurns: 0, range: 1, targetType: 'single', type: 'physical',
  };

  const mockSkillB = {
    id: 'skill_b', name: 'Skill B', description: '', availableFor: ['warrior'],
    damage: 30, cooldownTurns: 2, range: 1, targetType: 'single', type: 'physical',
  };

  return { mockHeroDef, mockEnemyDef, mockSkillA, mockSkillB };
});

vi.mock('../../src/data/heroes.data', () => ({
  HERO_DEFINITIONS_BY_ID: { test_hero: mockHeroDef },
}));

vi.mock('../../src/data/enemies.data', () => ({
  ENEMY_DEFINITIONS_BY_ID: { test_enemy: mockEnemyDef },
}));

vi.mock('../../src/data/skills.data', () => ({
  SKILLS_BY_ID: { skill_a: mockSkillA, skill_b: mockSkillB },
}));

// ---------------------------------------------------------------------------
// buildHero
// ---------------------------------------------------------------------------

describe('buildHero', () => {
  const baseState: PlayerHeroState = {
    heroId: 'test_hero',
    level: 1,
    xp: 0,
    equippedSkills: ['skill_a', 'skill_b', 'skill_a', 'skill_b'],
  };

  it('lève une erreur si la définition héros est introuvable', () => {
    expect(() => buildHero({ ...baseState, heroId: 'unknown' })).toThrow('Hero definition not found: unknown');
  });

  it('ne scale pas les stats au niveau 1', () => {
    const hero = buildHero(baseState);
    expect(hero.data.hp).toBe(1000);
    expect(hero.data.attack).toBe(20);
    expect(hero.data.defense).toBe(10);
  });

  it('scale hp/attack/defense de 8% par niveau au-dessus de 1', () => {
    const hero = buildHero({ ...baseState, level: 3 }); // multiplier = 1.16
    expect(hero.data.hp).toBe(Math.round(1000 * 1.16));
    expect(hero.data.attack).toBe(Math.round(20 * 1.16));
    expect(hero.data.defense).toBe(Math.round(10 * 1.16));
  });

  it('ne scale pas la speed', () => {
    const hero = buildHero({ ...baseState, level: 5 });
    expect(hero.data.speed).toBe(1500);
  });

  it('maxHp est égal à hp (pas de HP partiel pour l\'instant)', () => {
    const hero = buildHero(baseState);
    expect(hero.data.maxHp).toBe(hero.data.hp);
  });

  it('mappe les skills équipés vers des SkillData exploitables (isReady fonctionne)', () => {
    const hero = buildHero(baseState);
    expect(hero.skills).toHaveLength(4);
    expect(hero.skills[0].isReady()).toBe(true);  // skill_a: cooldownTurns 0
    expect(hero.skills[1].isReady()).toBe(false); // skill_b: cooldownTurns 2, actif au départ
  });

  it('filtre silencieusement les skillIds inconnus', () => {
    const hero = buildHero({ ...baseState, equippedSkills: ['skill_a', 'unknown', 'skill_a', 'skill_a'] as any });
    expect(hero.skills).toHaveLength(3);
  });

  it('lève une erreur si aucun skill équipé n\'est valide', () => {
    expect(() => buildHero({ ...baseState, equippedSkills: ['x', 'y', 'z', 'w'] as any }))
      .toThrow('Hero test_hero has no valid equipped skills');
  });
});

// ---------------------------------------------------------------------------
// buildHeroGridUnit
// ---------------------------------------------------------------------------

describe('buildHeroGridUnit', () => {
  it('construit un GridUnit à la position du spawn', () => {
    const state: PlayerHeroState = { heroId: 'test_hero', level: 1, xp: 0, equippedSkills: ['skill_a', 'skill_a', 'skill_a', 'skill_a'] };
    const spawn: HeroSpawn = { heroId: 'test_hero', col: 2, row: 3 };

    const unit = buildHeroGridUnit(state, spawn);

    expect(unit).toEqual({ id: 'test_hero', isHero: true, pos: { col: 2, row: 3 }, moveRange: 4 });
  });

  it('lève une erreur si la définition héros est introuvable', () => {
    const state: PlayerHeroState = { heroId: 'unknown', level: 1, xp: 0, equippedSkills: ['skill_a', 'skill_a', 'skill_a', 'skill_a'] };
    expect(() => buildHeroGridUnit(state, { heroId: 'unknown', col: 0, row: 0 })).toThrow('Hero definition not found: unknown');
  });
});

// ---------------------------------------------------------------------------
// buildEnemy
// ---------------------------------------------------------------------------

describe('buildEnemy', () => {
  const spawn: EnemySpawn = { enemyId: 'test_enemy', col: 5, row: 1 };

  it('lève une erreur si la définition ennemi est introuvable', () => {
    expect(() => buildEnemy({ ...spawn, enemyId: 'unknown' }, 0)).toThrow('Enemy definition not found: unknown');
  });

  it('applique scaleFactor par défaut (1.0) si absent', () => {
    const enemy = buildEnemy(spawn, 0);
    expect(enemy.data.hp).toBe(500);
    expect(enemy.data.attack).toBe(15);
    expect(enemy.data.defense).toBe(5);
  });

  it('scale hp/attack/defense selon scaleFactor', () => {
    const enemy = buildEnemy({ ...spawn, scaleFactor: 1.5 }, 0);
    expect(enemy.data.hp).toBe(750);
    expect(enemy.data.attack).toBe(Math.round(15 * 1.5));
    expect(enemy.data.defense).toBe(Math.round(5 * 1.5));
  });

  it('ne scale pas la speed', () => {
    const enemy = buildEnemy({ ...spawn, scaleFactor: 2 }, 0);
    expect(enemy.data.speed).toBe(1400);
  });

  it('génère un id unique via l\'index', () => {
    const enemy = buildEnemy(spawn, 3);
    expect(enemy.data.id).toBe('test_enemy_3');
  });

  it('mappe les skills définis sur l\'ennemi', () => {
    const enemy = buildEnemy(spawn, 0);
    expect(enemy.skills).toHaveLength(1);
    expect(enemy.skills[0].data.id).toBe('skill_a');
  });
});

// ---------------------------------------------------------------------------
// buildEnemyGridUnit
// ---------------------------------------------------------------------------

describe('buildEnemyGridUnit', () => {
  it('construit un GridUnit avec id unique et position du spawn', () => {
    const spawn: EnemySpawn = { enemyId: 'test_enemy', col: 6, row: 2 };
    const unit = buildEnemyGridUnit(spawn, 2);

    expect(unit).toEqual({ id: 'test_enemy_2', isHero: false, pos: { col: 6, row: 2 }, moveRange: 4 });
  });

  it('lève une erreur si la définition ennemi est introuvable', () => {
    expect(() => buildEnemyGridUnit({ enemyId: 'unknown', col: 0, row: 0 }, 0)).toThrow('Enemy definition not found: unknown');
  });
});

// ---------------------------------------------------------------------------
// buildCombatSetup
// ---------------------------------------------------------------------------

describe('buildCombatSetup', () => {
  const heroStates: PlayerHeroState[] = [
    { heroId: 'test_hero', level: 1, xp: 0, equippedSkills: ['skill_a', 'skill_a', 'skill_a', 'skill_a'] },
  ];

  const level: LevelDefinition = {
    id: 'test_level',
    name: 'Test Level',
    zone: 'test',
    order: 1,
    maxRounds: 10,
    heroSpawns: [{ heroId: 'test_hero', col: 0, row: 0 }],
    enemySpawns: [
      { enemyId: 'test_enemy', col: 5, row: 0 },
      { enemyId: 'test_enemy', col: 5, row: 1 },
    ],
  };

  it('construit heroes/enemies/heroUnits/enemyUnits/maxRounds cohérents', () => {
    const setup = buildCombatSetup(level, heroStates);

    expect(setup.heroes).toHaveLength(1);
    expect(setup.enemies).toHaveLength(2);
    expect(setup.heroUnits).toHaveLength(1);
    expect(setup.enemyUnits).toHaveLength(2);
    expect(setup.maxRounds).toBe(10);
  });

  it('ignore les heroSpawns sans état joueur correspondant', () => {
    const level2: LevelDefinition = {
      ...level,
      heroSpawns: [
        { heroId: 'test_hero', col: 0, row: 0 },
        { heroId: 'not_owned_hero', col: 1, row: 0 },
      ],
    };

    const setup = buildCombatSetup(level2, heroStates);

    expect(setup.heroes).toHaveLength(1);
    expect(setup.heroUnits).toHaveLength(1);
  });

  it('génère des ids uniques pour plusieurs ennemis du même type', () => {
    const setup = buildCombatSetup(level, heroStates);
    const ids = setup.enemies.map(e => e.data.id);
    expect(ids).toEqual(['test_enemy_0', 'test_enemy_1']);
  });
});