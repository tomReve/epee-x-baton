import { Skill, SkillData } from './Skill';

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
}