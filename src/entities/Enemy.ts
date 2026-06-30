export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  xpReward: number;
  goldReward: number;
}

export class Enemy {
  data: EnemyData;
  currentHp: number;
  lastAttack: number = 0;

  constructor(data: EnemyData) {
    this.data = { ...data };
    this.currentHp = data.maxHp;
  }

  isAlive(): boolean { return this.currentHp > 0; }

  takeDamage(amount: number): number {
    const dmg = Math.max(1, amount - this.data.defense);
    this.currentHp = Math.max(0, this.currentHp - dmg);
    return dmg;
  }

  canAttack(now: number): boolean {
    return now - this.lastAttack >= this.data.speed;
  }

  attack(now: number): number {
    this.lastAttack = now;
    return this.data.attack;
  }
}