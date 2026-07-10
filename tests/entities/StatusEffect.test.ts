import { describe, it, expect } from 'vitest';
import { StatusEffect } from '../../src/entities/StatusEffect';
import { makeStatusEffectDef } from '../helpers/factories';

describe('StatusEffect', () => {
  it('is not expired on creation when durationTurns > 0', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 2 }));
    expect(effect.isExpired()).toBe(false);
  });

  it('is expired immediately when durationTurns is 0', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 0 }));
    expect(effect.isExpired()).toBe(true);
  });

  it('tick() decrements turnsRemaining', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 2 }));
    effect.tick();
    expect(effect.getTurnsRemaining()).toBe(1);
    expect(effect.isExpired()).toBe(false);
  });

  it('becomes expired after enough ticks', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 2 }));
    effect.tick();
    effect.tick();
    expect(effect.isExpired()).toBe(true);
  });

  it('does not decrement below 0', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 1 }));
    effect.tick();
    effect.tick();
    effect.tick();
    expect(effect.getTurnsRemaining()).toBe(0);
  });

  it('getTurnsRemaining reflects current state', () => {
    const effect = new StatusEffect(makeStatusEffectDef({ durationTurns: 3 }));
    effect.tick();
    expect(effect.getTurnsRemaining()).toBe(2);
  });
});