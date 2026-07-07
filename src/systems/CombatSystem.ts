import { CombatUnit } from '../entities/CombatUnit';
import { Skill, SkillData } from '../entities/Skill';
import { GridPosition, GridSystem, GridUnit } from './GridSystem';
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
  previewTargets?: string[];
  isHeal?:    boolean;
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
  private speedMultiplier = 1;


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

  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  private delay(ms: number): number {
    return ms / this.speedMultiplier;
  }

  start(): void {
    this.running = true;
    this.onEvent({ type: 'round_start', round: 0 });
    this.scheduleTurn(this.delay(TURN_DELAY));
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
      this.scheduleTurn(this.delay(100));
      return;
    }

    this.onEvent({ type: 'turn_start', source: unit.id });

    const allies = unit.isHero ? this.heroes : this.enemies;
    const foes   = unit.isHero ? this.enemies : this.heroes;
    const self   = allies.find(u => u.data.id === unit.id)!;

    this.processUnitTurn(self, allies, foes);
  }

  private processUnitTurn(unit: CombatUnit, allies: CombatUnit[], foes: CombatUnit[]): void {
    const gridUnit = this.grid.getUnit(unit.data.id)!;
    this.executeSkills(unit, allies, foes, gridUnit.moveRange);
  }

  private executeSkills(unit: CombatUnit, allies: CombatUnit[], foes: CombatUnit[], moveBudget: number): void {
    const ready = unit.skills.filter(s => s.isReady());
    if (ready.length === 0) {
      this.endTurn(unit, null);
      return;
    }
    this.castSkillsSequentially(unit, allies, foes, ready, 0, new Set(), moveBudget);
  }

  private applyTargetPriority(skill: SkillData, targets: CombatUnit[]): CombatUnit[] {
    const priority = skill.targetPriority ?? 'first';

    if (priority !== 'first' && targets.length > 1) {
      const sorted = [...targets];
      if (priority === 'lowest_hp') sorted.sort((a, b) => (a.currentHp / a.data.maxHp) - (b.currentHp / b.data.maxHp));
      if (priority === 'highest_attack') sorted.sort((a, b) => b.data.attack - a.data.attack);
      targets = sorted;
    }

    return skill.targetType === 'single' ? targets.slice(0, 1) : targets;
  }

  private resolveLiveTargets(
    allies: CombatUnit[], foes: CombatUnit[], gridUnit: GridUnit, skill: Skill
  ): CombatUnit[] {
    const candidates = skill.data.targetSide === 'ally' ? allies : foes;
    const raw = this.grid.getAoeTargets(gridUnit, skill.data)
      .map(t => candidates.find(c => c.data.id === t.id && c.isAlive()))
      .filter((c): c is CombatUnit => c !== undefined);
    return this.applyTargetPriority(skill.data, raw);
  }

  private castSkillsSequentially(
    unit: CombatUnit,
    allies: CombatUnit[],
    foes: CombatUnit[],
    skills: Skill[],
    index: number,
    usedThisTurn: Set<string>,
    moveBudget: number
  ): void {
    if (index >= skills.length || !this.running) {
      this.endTurn(unit, usedThisTurn);
      return;
    }

    const skill = skills[index];
    const gridUnit = this.grid.getUnit(unit.data.id)!;

    if (skill.data.targetType === 'aoe' && moveBudget > 0) {
      const liveTargetsNow = this.resolveLiveTargets(allies, foes, gridUnit, skill);
      const currentHitCount = liveTargetsNow.length;

      const bestPosition = this.grid.findBestAoePosition(gridUnit, skill.data, moveBudget);

      if (bestPosition && bestPosition.hitCount > currentHitCount) {
        const from = { ...gridUnit.pos };
        this.grid.moveToPosition(gridUnit, bestPosition.pos);
        const remainingBudget = moveBudget - bestPosition.distance;

        this.onEvent({ type: 'unit_moved', source: unit.data.id, fromPos: from, toPos: bestPosition.pos });

        setTimeout(() => {
          if (!this.running) return;
          const liveTargets = this.resolveLiveTargets(allies, foes, gridUnit, skill);
          this.castSkillNow(unit, allies, foes, skills, index, usedThisTurn, skill, liveTargets, remainingBudget);
        }, this.delay(this.MOVE_ANIM_DELAY));
        return;
      }
    }

    const liveTargets = this.resolveLiveTargets(allies, foes, gridUnit, skill);

    const priorityTarget = this.findUnreachedPriorityTarget(skill, allies, foes, gridUnit);
    const needsFallbackReposition = liveTargets.length === 0 && skill.data.type !== 'support';

    if (priorityTarget || needsFallbackReposition) {
      this.tryRepositionForSkill(unit, allies, foes, skills, index, usedThisTurn, gridUnit, moveBudget, priorityTarget);
      return;
    }

    this.castSkillNow(unit, allies, foes, skills, index, usedThisTurn, skill, liveTargets, moveBudget);
  }

  /** Retourne la meilleure cible par priorité si elle existe et n'est pas déjà dans liveTargets. */
  private findUnreachedPriorityTarget(
    skill: Skill, allies: CombatUnit[], foes: CombatUnit[], gridUnit: GridUnit
  ): CombatUnit | null {
    if (skill.data.targetType !== 'single') return null;

    const priority = skill.data.targetPriority ?? 'first';
    if (priority === 'first') return null;

    const candidates = (skill.data.targetSide === 'ally' ? allies : foes).filter(u => u.isAlive());
    if (candidates.length === 0) return null;

    const best = priority === 'lowest_hp'
      ? candidates.reduce((a, b) => (b.currentHp / b.data.maxHp) < (a.currentHp / a.data.maxHp) ? b : a)
      : candidates.reduce((a, b) => b.data.attack > a.data.attack ? b : a);

    const bestGridUnit = this.grid.getUnit(best.data.id);
    if (!bestGridUnit) return null;

    const alreadyInRange = this.grid.distance(gridUnit.pos, bestGridUnit.pos) <= skill.data.range;
    return alreadyInRange ? null : best;
  }

  private tryRepositionForSkill(
    unit: CombatUnit,
    allies: CombatUnit[],
    foes: CombatUnit[],
    skills: Skill[],
    index: number,
    usedThisTurn: Set<string>,
    gridUnit: GridUnit,
    moveBudget: number,
    priorityTarget: CombatUnit | null
  ): void {
    if (moveBudget <= 0) {
      this.castSkillsSequentially(unit, allies, foes, skills, index + 1, usedThisTurn, moveBudget);
      return;
    }

    const skill = skills[index];
    const from = { ...gridUnit.pos };

    let result: { pos: GridPosition; distance: number } | null = null;

    if (priorityTarget) {
      const targetGridUnit = this.grid.getUnit(priorityTarget.data.id);
      if (targetGridUnit) {
        result = this.grid.moveTowardTargetIfReachable(gridUnit, targetGridUnit.pos, skill.data.range, moveBudget);
      }
    }

    if (!result) {
      result = this.grid.moveTowardNearest(gridUnit, moveBudget);
    }

    if (!result) {
      this.castSkillsSequentially(unit, allies, foes, skills, index + 1, usedThisTurn, moveBudget);
      return;
    }

    const remainingBudget = moveBudget - result.distance;
    this.onEvent({ type: 'unit_moved', source: unit.data.id, fromPos: from, toPos: result.pos });

    setTimeout(() => {
      if (!this.running) return;

      const liveTargets = this.resolveLiveTargets(allies, foes, gridUnit, skill);

      if (liveTargets.length === 0) {
        this.castSkillsSequentially(unit, allies, foes, skills, index + 1, usedThisTurn, remainingBudget);
        return;
      }

      this.castSkillNow(unit, allies, foes, skills, index, usedThisTurn, skill, liveTargets, remainingBudget);
    }, this.delay(this.MOVE_ANIM_DELAY));
  }

  private castSkillNow(
    unit:         CombatUnit,
    allies:       CombatUnit[],
    foes:         CombatUnit[],
    skills:       Skill[],
    index:        number,
    usedThisTurn: Set<string>,
    skill:        Skill,
    liveTargets:  CombatUnit[],
    moveBudget:   number
  ): void {
    this.onEvent({ type: 'skill_preview', source: unit.data.id, skillData: skill.data, previewTargets: liveTargets.map(t => t.data.id) });

    setTimeout(() => {
      if (!this.running) return;

      usedThisTurn.add(skill.data.id);
      const animDelay = this.useSkill(unit, skill, liveTargets);

      this.onEvent({ type: 'skill_preview_clear' });

      setTimeout(() => {
        if (!this.running) return;
        this.castSkillsSequentially(unit, allies, foes, skills, index + 1, usedThisTurn, moveBudget);
      }, animDelay);
    }, this.delay(PREVIEW_DELAY));
  }

  private useSkill(unit: CombatUnit, skill: Skill, targets: CombatUnit[]): number {
    skill.use();
    this.onEvent({ type: 'cooldowns_updated', source: unit.data.id, skillId: skill.data.id });

    let totalDelay = 0;

    if (skill.data.damage) {
      totalDelay = this.applySkillImpact(unit.data.attack, skill, targets, unit.data.id);
    }

    if (skill.data.heal) {
      const healTargets = targets.length > 0 ? targets : [unit];
      for (const target of healTargets) {
        target.heal(skill.data.heal);
        this.onEvent({
          type:      'skill_used',
          source:    unit.data.id,
          target:    target.data.id,
          value:     skill.data.heal,
          skillName: skill.data.name,
          hitIndex:  0,
          totalHits: 1,
          isHeal:    true,
        });
      }
    }

    return totalDelay + this.delay(this.ATTACK_ANIM_DELAY);
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
      const targetDelay = targetIndex * this.delay(TARGET_STAGGER);

      for (let i = 0; i < hits; i++) {
        const hitDelay = targetDelay + i * this.delay(HIT_STAGGER);

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

    this.scheduleTurn(this.delay(TURN_DELAY));
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