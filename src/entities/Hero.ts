import { CombatUnit, BaseUnitData } from './CombatUnit';

export interface HeroData extends BaseUnitData {}

export class Hero extends CombatUnit {
  data: HeroData;

  constructor(data: HeroData) {
    super(data);
    this.data = { ...data };
  }
}