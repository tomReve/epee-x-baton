import { CombatUnit } from '../entities/CombatUnit';
import { Skill, SkillData } from '../entities/Skill';
import { GridSystem, GridUnit } from './GridSystem';
import { TurnSystem } from './TurnSystem';

export type CombatMode = 'eliminate' | 'damage_race';

export interface CombatEvent {
  type:
    | 'turn_start'
    | 'unit_moved'
    | 'skill_used'
    | 'unit_died'
    | 'round_start'
    | 'combat_won'
    | 'combat_lost'
    | 'combat_timeout'
    | 'cooldowns_updated'
    | 'skill_preview'
    | 'skill_preview_clear';
  source?:    string;
  target?:    string;
  targets?:   string[];
  value?:     number;
  skillName?: string;
  fromPos?:   { col: number; row: number };
  toPos?:     { col: number; row: number };
  round?:     number;
  hitIndex?:  number;
  totalHits?: number;
  skillId?:   string;
  skillData?: SkillData;
}

export type CombatEventCallback = (event: CombatEvent) => void;

const TURN_DELAY     = 600;
const PREVIEW_DELAY  = 400;
const HIT_STAGGER     = 120;
const TARGET_STAGGER  = 150;

export class CombatSystem {
  private readonly heroes:    CombatUnit[];
  private readonly enemies:   CombatUnit[];
  private readonly grid:      GridSystem;
  private readonly turns:     TurnSystem;
  private readonly onEvent:   CombatEventCallback;
  private readonly maxRounds: number;

  private running = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  private readonly ATTACK_ANIM_DELAY = 700;
  private readonly MOVE_ANIM_DELAY   = 420;

  constructor(
    heroes:    CombatUnit[],
    enemies:   CombatUnit[],
    grid:      GridSystem,
    turns:     TurnSystem,
    onEvent:   CombatEventCallback,
    maxRounds  = 15
  ) {
    this.heroes    = heroes;
    this.enemies   = enemies;
    this.grid      = grid;
    this.turns     = turns;
    this.onEvent   = onEvent;
    this.maxRounds = maxRounds;
  }

  start(): void {
    this.running = true;
    this.onEvent({ type: 'round_start', round: 0 });
    this.scheduleTurn(TURN_DELAY);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  private scheduleTurn(delay: number): void {
    this.timeoutId = setTimeout(() => this.processTurn(), delay);
  }

  private processTurn(): void {
    if (!this.running) return;

    const unit = this.turns.current();

    if (!unit || !unit.isAlive()) {
      this.turns.next();
      this.scheduleTurn(100);
      return;
    }

    this.onEvent({ type: 'turn_start', source: unit.id });

    const allies = unit.isHero ? this.heroes : this.enemies;
    const foes   = unit.isHero ? this.enemies : this.heroes;
    const self   = allies.find(u => u.data.id === unit.id)!;

    this.processUnitTurn(self, foes);
  }

  private processUnitTurn(unit: CombatUnit, foes: CombatUnit[]): void {
    const gridUnit = this.grid.getUnit(unit.data.id)!;
    const ready    = unit.skills.filter(s => s.isReady());

    const hasTarget = ready.some(skill =>
      this.grid.getAoeTargets(gridUnit, skill.data).length > 0
    );

    if (hasTarget) {
      this.executeSkills(unit, foes);
      return;
    }

    const from = { ...gridUnit.pos };
    const to   = this.grid.moveTowardNearest(gridUnit);

    if (!to) {
      this.endTurn(unit, null);
      return;
    }

    this.onEvent({ type: 'unit_moved', source: unit.data.id, fromPos: from, toPos: to });

    setTimeout(() => {
      if (!this.running) return;
      const hasTargetAfterMove = ready.some(skill =>
        this.grid.getAoeTargets(gridUnit, skill.data).length > 0
      );
      if (hasTargetAfterMove) {
        this.executeSkills(unit, foes);
      } else {
        this.endTurn(unit, null);
      }
    }, this.MOVE_ANIM_DELAY);
  }

  private executeSkills(unit: CombatUnit, foes: CombatUnit[]): void {
    const ready = unit.skills.filter(s => s.isReady());
    if (ready.length === 0) {
      this.endTurn(unit, null);
      return;
    }
    this.castSkillsSequentially(unit, foes, ready, 0, new Set());
  }

  private castSkillsSequentially(
    unit:         CombatUnit,
    foes:         CombatUnit[],
    skills:       Skill[],
    index:        number,
    usedThisTurn: Set<string>
  ): void {
    if (index >= skills.length || !this.running) {
      this.endTurn(unit, usedThisTurn);
      return;
    }

    const skill    = skills[index];
    const gridUnit = this.grid.getUnit(unit.data.id)!;

    const liveTargets = this.grid.getAoeTargets(gridUnit, skill.data)
      .map(t => foes.find(f => f.data.id === t.id && f.isAlive()))
      .filter((f): f is CombatUnit => f !== undefined);

    if (liveTargets.length === 0 && skill.data.type !== 'support') {
      this.castSkillsSequentially(unit, foes, skills, index + 1, usedThisTurn);
      return;
    }

    this.onEvent({ type: 'skill_preview', source: unit.data.id, skillData: skill.data });

    setTimeout(() => {
      if (!this.running) return;

      usedThisTurn.add(skill.data.id);
      const animDelay = this.useSkill(unit, skill, liveTargets);

      this.onEvent({ type: 'skill_preview_clear' });

      setTimeout(() => {
        if (!this.running) return;
        this.castSkillsSequentially(unit, foes, skills, index + 1, usedThisTurn);
      }, animDelay);
    }, PREVIEW_DELAY);
  }

  private useSkill(unit: CombatUnit, skill: Skill, targets: CombatUnit[]): number {
    skill.use();
    this.onEvent({ type: 'cooldowns_updated', source: unit.data.id, skillId: skill.data.id });

    let totalDelay = 0;

    if (skill.data.damage) {
      totalDelay = this.applySkillImpact(unit.data.attack, skill, targets, unit.data.id);
    }

    if (skill.data.heal) {
      unit.heal(skill.data.heal);
      this.onEvent({
        type:      'skill_used',
        source:    unit.data.id,
        target:    unit.data.id,
        value:     skill.data.heal,
        skillName: skill.data.name,
        hitIndex:  0,
        totalHits: 1,
      });
    }

    return totalDelay + this.ATTACK_ANIM_DELAY;
  }

  private endTurn(unit: CombatUnit, usedSkillIds: Set<string> | null): void {
    unit.tickSkillCooldowns(usedSkillIds);
    this.onEvent({ type: 'cooldowns_updated', source: unit.data.id });
    this.finishTurn();
  }

  private applySkillImpact(
    attackerAttack: number,
    skill:          Skill,
    targets:        CombatUnit[],
    sourceId:       string
  ): number {
    const hits = skill.data.hits ?? 1;
    let totalDelay = 0;

    targets.forEach((target, targetIndex) => {
      const targetDelay = targetIndex * TARGET_STAGGER;

      for (let i = 0; i < hits; i++) {
        const hitDelay = targetDelay + i * HIT_STAGGER;

        setTimeout(() => {
          if (!this.running || !target.isAlive()) return;
          const dmg = target.takeDamage((skill.data.damage ?? 0) + attackerAttack);
          this.onEvent({
            type:      'skill_used',
            source:    sourceId,
            target:    target.data.id,
            value:     dmg,
            skillName: skill.data.name,
            hitIndex:  i,
            totalHits: hits,
          });
          if (!target.isAlive()) this.handleDeath(target);
        }, hitDelay);

        totalDelay = Math.max(totalDelay, hitDelay);
      }
    });

    return totalDelay;
  }

  private finishTurn(): void {
    if (!this.running) return;

    this.turns.next();

    if (this.turns.getCurrentIndex() === 0) {
      this.onEvent({ type: 'round_start', round: this.turns.round });
      if (this.turns.round >= this.maxRounds) {
        this.stop();
        this.onEvent({ type: 'combat_timeout', round: this.turns.round });
        return;
      }
    }

    this.scheduleTurn(TURN_DELAY);
  }

  private handleDeath(unit: CombatUnit): void {
    this.grid.removeUnit(unit.data.id);
    this.turns.removeUnit(unit.data.id);
    this.onEvent({ type: 'unit_died', source: unit.data.id });

    if (!this.enemies.some(e => e.isAlive())) {
      this.stop();
      this.onEvent({ type: 'combat_won' });
    } else if (!this.heroes.some(h => h.isAlive())) {
      this.stop();
      this.onEvent({ type: 'combat_lost' });
    }
  }
}