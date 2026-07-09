import { describe, it, expect } from 'vitest';
import { Skill } from '../../src/entities/Skill';
import { makeSkill } from '../helpers/factories';

describe('Skill', () => {
  it('initialise turnsRemaining à cooldownTurns (cooldown initial actif)', () => {
    const skill = new Skill(makeSkill({ cooldownTurns: 3 }));
    expect(skill.isReady()).toBe(false);
    expect(skill.getTurnsRemaining()).toBe(3);
  });

  it('est prêt immédiatement si cooldownTurns = 0', () => {
    const skill = new Skill(makeSkill({ cooldownTurns: 0 }));
    expect(skill.isReady()).toBe(true);
    expect(skill.getTurnsRemaining()).toBe(0);
  });

  it('use() relance le cooldown à cooldownTurns', () => {
    const skill = new Skill(makeSkill({ cooldownTurns: 2 }));
    skill.tickCooldown();
    skill.tickCooldown();
    expect(skill.isReady()).toBe(true);

    skill.use();
    expect(skill.isReady()).toBe(false);
    expect(skill.getTurnsRemaining()).toBe(2);
  });

  it('tickCooldown() décrémente jusqu\'à 0 puis reste à 0', () => {
    const skill = new Skill(makeSkill({ cooldownTurns: 2 }));
    skill.tickCooldown();
    expect(skill.getTurnsRemaining()).toBe(1);

    skill.tickCooldown();
    expect(skill.getTurnsRemaining()).toBe(0);
    expect(skill.isReady()).toBe(true);

    skill.tickCooldown();
    expect(skill.getTurnsRemaining()).toBe(0);
  });
});