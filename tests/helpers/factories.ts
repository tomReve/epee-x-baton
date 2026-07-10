import { Hero, HeroData } from '../../src/entities/Hero';
import { Enemy } from '../../src/entities/Enemy';
import { GridSystem, GridUnit } from '../../src/systems/GridSystem';
import { SkillData } from '../../src/entities/Skill';
import { TurnSystem } from '../../src/systems/TurnSystem';
import { CombatSystem, CombatEvent } from '../../src/systems/CombatSystem';
import { StatusEffectDefinition } from '../../src/types/game.types';

export function makeHero(id: string, speed: number, alive = true): Hero {
  const hero = new Hero({
    id, name: id, hp: alive ? 100 : 0, maxHp: 100,
    attack: 10, defense: 0, speed, skills: [],
  });
  if (!alive) hero.currentHp = 0;
  return hero;
}

export function makeEnemy(id: string, speed: number, alive = true): Enemy {
  const enemy = new Enemy({
    id, name: id, hp: alive ? 100 : 0, maxHp: 100,
    attack: 10, defense: 0, speed, skills: [],
  });
  if (!alive) enemy.currentHp = 0;
  return enemy;
}

export function makeUnit(id: string, col: number, row: number, isHero: boolean, moveRange = 4): GridUnit {
  return { id, pos: { col, row }, isHero, moveRange };
}

export function makeSkill(overrides: Partial<SkillData> = {}): SkillData {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    cooldownTurns: 0,
    range: 1,
    targetType: 'single',
    type: 'physical',
    damage: 10,
    ...overrides,
  };
}

export function makeCombatUnit(
  overrides: Partial<HeroData> = {},
  isHero: boolean = true
) {
  const data = {
    id: 'unit_1', name: 'Test Unit',
    hp: 100, maxHp: 100, attack: 10, defense: 5, speed: 1000,
    skills: [],
    ...overrides,
  };
  return isHero ? new Hero(data) : new Enemy(data);
}

export function makeCombatSetup(
  heroes: Hero[],
  enemies: Enemy[],
  options?: { gridUnits?: GridUnit[]; maxRounds?: number; cols?: number; rows?: number }
) {
  const grid = new GridSystem(options?.cols ?? 8, options?.rows ?? 6);

  const gridUnits = options?.gridUnits ?? [
    ...heroes.map((h, i) => ({ id: h.data.id, isHero: true, pos: { col: 0, row: i }, moveRange: 4 })),
    ...enemies.map((e, i) => ({ id: e.data.id, isHero: false, pos: { col: 5, row: i }, moveRange: 4 })),
  ];
  for (const gu of gridUnits) grid.addUnit(gu);

  const turns = new TurnSystem(heroes, enemies);

  const events: CombatEvent[] = [];
  const combat = new CombatSystem(
    heroes, enemies, grid, turns,
    (e) => events.push(e),
    options?.maxRounds ?? 15
  );

  return { combat, grid, turns, events };
}

export function makeStatusEffectDef(overrides?: Partial<StatusEffectDefinition>): StatusEffectDefinition {
  return {
    id:            'test_effect',
    name:          'Test Effect',
    type:          'debuff',
    polarity:      'negative',
    stackable:     false,
    durationTurns: 2,
    tickTiming:    'turn_end',
    ...overrides,
  };
}