import { StatusEffectDefinition } from '../types/game.types';
import { Skill, SkillData } from './Skill';
import { StatusEffect } from './StatusEffect';

export interface BaseUnitData {
  id:      string;
  name:    string;
  hp:      number;
  maxHp:   number;
  attack:  number;
  defense: number;
  speed:   number;
  skills:  SkillData[];
}

export abstract class CombatUnit {
  abstract data: BaseUnitData;
  skills: Skill[];
  currentHp: number;
  statusEffects: StatusEffect[] = [];

  constructor(data: BaseUnitData) {
    this.currentHp = data.hp;
    this.skills = data.skills.map(s => new Skill(s));
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  takeDamage(amount: number): number {
    const dmg = Math.max(1, amount - this.data.defense);
    this.currentHp = Math.max(0, this.currentHp - dmg);
    return dmg;
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.data.maxHp, this.currentHp + amount);
  }

  getReadySkill(): Skill | null {
    return this.skills.find(s => s.isReady()) ?? null;
  }

  tickSkillCooldowns(usedSkillIds: Set<string> | null): void {
    for (const skill of this.skills) {
      if (usedSkillIds?.has(skill.data.id)) continue;
      skill.tickCooldown();
    }
  }

  applyStatusEffect(def: StatusEffectDefinition): void {
    if (!def.stackable && this.hasStatusEffect(def.id)) {
      this.statusEffects = this.statusEffects.filter(e => e.data.id !== def.id);
    }
    this.statusEffects.push(new StatusEffect(def));
  }

  hasStatusEffect(id: string): boolean {
    return this.statusEffects.some(e => e.data.id === id);
  }

  tickStatusEffects(): void {
    for (const effect of this.statusEffects) effect.tick();
    this.statusEffects = this.statusEffects.filter(e => !e.isExpired());
  }
}