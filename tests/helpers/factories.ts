import { Hero } from '../../src/entities/Hero';
import { Enemy } from '../../src/entities/Enemy';
import { GridUnit } from '../../src/systems/GridSystem';
import { SkillData } from '../../src/entities/Skill';

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