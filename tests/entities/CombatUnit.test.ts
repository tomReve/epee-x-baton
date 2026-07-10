import { describe, it, expect } from 'vitest';
import { makeCombatUnit, makeSkill, makeStatusEffectDef } from '../helpers/factories';

describe('CombatUnit', () => {

  describe('constructor', () => {
    it('initialise currentHp à data.hp (pas forcément égal à maxHp)', () => {
      const unit = makeCombatUnit({ hp: 60, maxHp: 100 });
      expect(unit.currentHp).toBe(60);
    });
  });

  describe('takeDamage', () => {
    it('applique la défense en réduction de dégâts', () => {
      const unit = makeCombatUnit({ defense: 5 });
      const dmg = unit.takeDamage(20);
      expect(dmg).toBe(15);
      expect(unit.currentHp).toBe(85);
    });

    it('inflige un minimum de 1 dégât même si défense >= dégâts bruts', () => {
      const unit = makeCombatUnit({ defense: 50 });
      const dmg = unit.takeDamage(10);
      expect(dmg).toBe(1);
      expect(unit.currentHp).toBe(99);
    });

    it('ne descend pas sous 0 HP', () => {
      const unit = makeCombatUnit({ hp: 10, maxHp: 10, defense: 0 });
      unit.takeDamage(999);
      expect(unit.currentHp).toBe(0);
    });
  });

  describe('heal', () => {
    it('soigne sans dépasser maxHp', () => {
      const unit = makeCombatUnit({ hp: 90, maxHp: 100 });
      unit.heal(50);
      expect(unit.currentHp).toBe(100);
    });

    it('soigne normalement en dessous de maxHp', () => {
      const unit = makeCombatUnit({ hp: 50, maxHp: 100 });
      unit.heal(20);
      expect(unit.currentHp).toBe(70);
    });
  });

  describe('isAlive', () => {
    it('true si currentHp > 0', () => {
      const unit = makeCombatUnit({ hp: 1, maxHp: 100 });
      expect(unit.isAlive()).toBe(true);
    });

    it('false si currentHp === 0', () => {
      const unit = makeCombatUnit({ hp: 10, maxHp: 10 });
      unit.takeDamage(999);
      expect(unit.isAlive()).toBe(false);
    });
  });

  describe('getReadySkill', () => {
    it('retourne le premier skill prêt', () => {
      const unit = makeCombatUnit({
        skills: [
          makeSkill({ id: 'a', cooldownTurns: 3 }),
          makeSkill({ id: 'b', cooldownTurns: 0 }),
        ],
      });
      expect(unit.getReadySkill()?.data.id).toBe('b');
    });

    it('retourne null si aucun skill prêt', () => {
      const unit = makeCombatUnit({
        skills: [makeSkill({ id: 'a', cooldownTurns: 3 })],
      });
      expect(unit.getReadySkill()).toBeNull();
    });
  });

  describe('tickSkillCooldowns', () => {
    it('décrémente tous les skills si usedSkillIds est null', () => {
      const unit = makeCombatUnit({
        skills: [makeSkill({ id: 'a', cooldownTurns: 2 })],
      });
      unit.tickSkillCooldowns(null);
      expect(unit.skills[0].getTurnsRemaining()).toBe(1);
    });

    it('exclut les skills utilisés ce tour du tick', () => {
      const unit = makeCombatUnit({
        skills: [
          makeSkill({ id: 'a', cooldownTurns: 2 }),
          makeSkill({ id: 'b', cooldownTurns: 2 }),
        ],
      });
      unit.tickSkillCooldowns(new Set(['a']));
      expect(unit.skills[0].getTurnsRemaining()).toBe(2); // exclu
      expect(unit.skills[1].getTurnsRemaining()).toBe(1); // tické
    });
  });

  describe('CombatUnit — status effects', () => {
    it('applyStatusEffect adds the effect, detectable via hasStatusEffect', () => {
      const unit = makeCombatUnit();
      const def = makeStatusEffectDef({ id: 'poison' });
  
      unit.applyStatusEffect(def);
  
      expect(unit.hasStatusEffect('poison')).toBe(true);
    });
  
    it('hasStatusEffect returns false when the effect was never applied', () => {
      const unit = makeCombatUnit();
      expect(unit.hasStatusEffect('poison')).toBe(false);
    });

    it('applies durationOverride instead of the catalog default', () => {
        const unit = makeCombatUnit();
        const stun = makeStatusEffectDef({ id: 'stun', durationTurns: 1, tickTiming: 'turn_end' });

        unit.applyStatusEffect(stun, 3);
        unit.tickStatusEffects('turn_end');
        unit.tickStatusEffects('turn_end');

        // durationTurns override = 3, seulement 2 ticks effectués → toujours actif
        expect(unit.hasStatusEffect('stun')).toBe(true);

        unit.tickStatusEffects('turn_end');
        expect(unit.hasStatusEffect('stun')).toBe(false);
    });
  
    it('reapplying a non-stackable effect replaces the existing instance (resets duration)', () => {
      const unit = makeCombatUnit();
      const def = makeStatusEffectDef({ id: 'stun', stackable: false, durationTurns: 2 });
  
      unit.applyStatusEffect(def);
      unit.tickStatusEffects(def.tickTiming); // turnsRemaining: 1
      unit.applyStatusEffect(def); // reset
  
      expect(unit.statusEffects).toHaveLength(1);
      expect(unit.statusEffects[0].getTurnsRemaining()).toBe(2);
    });
  
    it('reapplying a stackable effect keeps both instances', () => {
      const unit = makeCombatUnit();
      const def = makeStatusEffectDef({ id: 'poison', stackable: true });
  
      unit.applyStatusEffect(def);
      unit.applyStatusEffect(def);
  
      expect(unit.statusEffects.filter(e => e.data.id === 'poison')).toHaveLength(2);
    });
  
    it('tickStatusEffects only ticks effects matching the given timing', () => {
      const unit = makeCombatUnit();
      const stun = makeStatusEffectDef({ id: 'stun', durationTurns: 1, tickTiming: 'turn_end' });
      const poison = makeStatusEffectDef({ id: 'poison', durationTurns: 1, tickTiming: 'turn_start' });
  
      unit.applyStatusEffect(stun);
      unit.applyStatusEffect(poison);
  
      unit.tickStatusEffects('turn_end');
  
      expect(unit.hasStatusEffect('stun')).toBe(false);   // expiré
      expect(unit.hasStatusEffect('poison')).toBe(true);  // intact, mauvais timing
    });
  
    it('tickStatusEffects removes expired effects', () => {
      const unit = makeCombatUnit();
      const def = makeStatusEffectDef({ id: 'short', durationTurns: 1 });
      unit.applyStatusEffect(def);
  
      unit.tickStatusEffects(def.tickTiming); // expire
  
      expect(unit.hasStatusEffect('short')).toBe(false);
      expect(unit.statusEffects).toHaveLength(0);
    });
  
    it('hasStatusEffect becomes false after expiration + tick', () => {
      const unit = makeCombatUnit();
      const def = makeStatusEffectDef({ id: 'stun', durationTurns: 1 });
      unit.applyStatusEffect(def);
  
      expect(unit.hasStatusEffect('stun')).toBe(true);
      unit.tickStatusEffects(def.tickTiming);
      expect(unit.hasStatusEffect('stun')).toBe(false);
    });
  });
});