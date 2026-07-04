import { CombatUnit, BaseUnitData } from './CombatUnit';

export interface EnemyData extends BaseUnitData {}

export class Enemy extends CombatUnit {
  data: EnemyData;

  constructor(data: EnemyData) {
    super(data);
    this.data = { ...data };
  }
}