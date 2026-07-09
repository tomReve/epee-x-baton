import { describe, it, expect } from 'vitest';
import { makeCombatUnit, makeSkill } from '../helpers/factories';

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
});