import { StatusEffectDefinition } from '../types/game.types';

export class StatusEffect {
  data: StatusEffectDefinition;
  private turnsRemaining: number;

  constructor(data: StatusEffectDefinition) {
    this.data = data;
    this.turnsRemaining = data.durationTurns;
  }

  isExpired(): boolean {
    return this.turnsRemaining <= 0;
  }

  tick(): void {
    if (this.turnsRemaining > 0) this.turnsRemaining--;
  }

  getTurnsRemaining(): number {
    return this.turnsRemaining;
  }
}