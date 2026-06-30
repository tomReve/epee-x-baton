export interface AoeShape {
  type:   'radius' | 'line' | 'cross' | 'square' | 'all';
  value?: number;
}

export interface SkillData {
  id:            string;
  name:          string;
  damage?:       number;
  heal?:         number;
  hits?:         number;
  cooldownTurns: number;
  range:         number;        // ✅ portée du skill (remplace attackRange sur l'unité)
  targetType:    'single' | 'aoe' | 'all';
  aoe?:          AoeShape;      // ✅ défini uniquement si targetType === 'aoe'
  type:          'physical' | 'magic' | 'support';
}

export class Skill {
  data: SkillData;
  private turnsRemaining: number;

  constructor(data: SkillData) {
    this.data = data;
    // ✅ Cooldown initial actif dès le début du combat
    this.turnsRemaining = data.cooldownTurns ?? 0;
  }

  isReady(): boolean {
    return this.turnsRemaining <= 0;
  }

  use(): void {
    this.turnsRemaining = this.data.cooldownTurns ?? 0;
  }

  // Appelé une fois, à la FIN du tour du héros
  tickCooldown(): void {
    if (this.turnsRemaining > 0) this.turnsRemaining--;
  }

  getTurnsRemaining(): number {
    return this.turnsRemaining;
  }
}