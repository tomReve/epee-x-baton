import { SkillDefinition, AoeShape } from '../types/game.types';

export type { AoeShape };
export type SkillData = Omit<SkillDefinition, 'description' | 'availableFor'>;

export class Skill {
  data: SkillData;
  private turnsRemaining: number;

  constructor(data: SkillData) {
    this.data = data;
    this.turnsRemaining = data.cooldownTurns ?? 0;
  }

  isReady(): boolean {
    return this.turnsRemaining <= 0;
  }

  use(): void {
    this.turnsRemaining = this.data.cooldownTurns ?? 0;
  }

  tickCooldown(): void {
    if (this.turnsRemaining > 0) this.turnsRemaining--;
  }

  getTurnsRemaining(): number {
    return this.turnsRemaining;
  }
}