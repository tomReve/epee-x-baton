import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { Skill, SkillData } from '../entities/Skill';
import { GridSystem, GridUnit } from './GridSystem';
import { TurnSystem } from './TurnSystem';

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export type CombatMode = 'eliminate' | 'damage_race';

export interface CombatEvent {
  type:
    | 'turn_start'
    | 'unit_moved'
    | 'hero_attack'
    | 'enemy_attack'
    | 'skill_used'
    | 'hero_died'
    | 'enemy_died'
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

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TURN_DELAY        = 600;  // ms entre chaque tour
const PREVIEW_DELAY     = 400;  // ms d'affichage de la preview AOE avant l'impact
const HIT_STAGGER       = 120;  // ms entre chaque coup (multi-hit)
const TARGET_STAGGER    = 150;  // ms entre chaque cible (AOE)

// ---------------------------------------------------------------------------
// CombatSystem
//
// Responsabilité : orchestration du déroulement du combat.
// Ne contient aucune logique Phaser ni d'affichage.
// Communique avec la scène exclusivement via CombatEventCallback.
//
// Flux d'un tour héros :
//   processHeroTurn → [déplacement?] → executeHeroSkills
//     → castSkillsSequentially (preview → useHeroSkill → suivant)
//     → endHeroTurn (tick cooldowns) → finishTurn (next turn)
//
// Flux d'un tour ennemi :
//   processEnemyTurn → [déplacement?] → executeEnemyAttack → finishTurn
// ---------------------------------------------------------------------------

export class CombatSystem {
  private readonly heroes:    Hero[];
  private readonly enemies:   Enemy[];
  private readonly grid:      GridSystem;
  private readonly turns:     TurnSystem;
  private readonly onEvent:   CombatEventCallback;
  private readonly maxRounds: number;

  private running   = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  private readonly ATTACK_ANIM_DELAY = 700;
  private readonly MOVE_ANIM_DELAY   = 420;

  constructor(
    heroes:    Hero[],
    enemies:   Enemy[],
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

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------

  start(): void {
    this.running = true;
    this.onEvent({ type: 'round_start', round: 0 });
    this.scheduleTurn(TURN_DELAY);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  // ---------------------------------------------------------------------------
  // Orchestration des tours
  // ---------------------------------------------------------------------------

  private scheduleTurn(delay: number): void {
    this.timeoutId = setTimeout(() => this.processTurn(), delay);
  }

  private processTurn(): void {
    if (!this.running) return;

    const unit = this.turns.current();

    // Unité morte ou absente : on passe silencieusement
    if (!unit || !unit.isAlive()) {
      this.turns.next();
      this.scheduleTurn(100);
      return;
    }

    this.onEvent({ type: 'turn_start', source: unit.id });

    if (unit.isHero) {
      this.processHeroTurn(unit.id);
    } else {
      this.processEnemyTurn(unit.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Tour héros
  // ---------------------------------------------------------------------------

  private processHeroTurn(id: string): void {
    const hero      = this.heroes.find(h => h.data.id === id)!;
    const gridUnit  = this.grid.getUnit(id)!;
    const ready     = hero.skills.filter(s => s.isReady());

    const hasTarget = ready.some(skill =>
      this.grid.getAoeTargets(gridUnit, skill.data).length > 0
    );

    if (hasTarget) {
      this.executeHeroSkills(hero);
      return;
    }

    // Aucune cible en portée — déplacement
    const from = { ...gridUnit.pos };
    const to   = this.grid.moveTowardNearest(gridUnit);

    if (!to) {
      this.endHeroTurn(hero, null);
      return;
    }

    this.onEvent({ type: 'unit_moved', source: id, fromPos: from, toPos: to });

    setTimeout(() => {
      if (!this.running) return;
      const hasTargetAfterMove = ready.some(skill =>
        this.grid.getAoeTargets(gridUnit, skill.data).length > 0
      );
      if (hasTargetAfterMove) {
        this.executeHeroSkills(hero);
      } else {
        this.endHeroTurn(hero, null);
      }
    }, this.MOVE_ANIM_DELAY);
  }

  private executeHeroSkills(hero: Hero): void {
    console.log(`[${hero.data.id}] skills:`, hero.skills.map(s => ({
    id:        s.data.id,
    remaining: s.getTurnsRemaining(),
    ready:     s.isReady(),
  })));
    const ready = hero.skills.filter(s => s.isReady());
    if (ready.length === 0) {
      this.endHeroTurn(hero, null);
      return;
    }
    this.castSkillsSequentially(hero, ready, 0, new Set());
  }

  /**
   * Enchaîne les skills prêts un par un.
   * Chaque skill attend la fin de l'animation du précédent avant de se lancer.
   * `usedThisTurn` accumule les ids des skills castés pour exclure leur tick en fin de tour.
   */
  private castSkillsSequentially(
    hero:         Hero,
    skills:       Skill[],
    index:        number,
    usedThisTurn: Set<string>
  ): void {
    if (index >= skills.length || !this.running) {
      this.endHeroTurn(hero, usedThisTurn);
      return;
    }

    const skill    = skills[index];
    const gridUnit = this.grid.getUnit(hero.data.id)!;

    const liveTargets = this.grid.getAoeTargets(gridUnit, skill.data)
      .map(t => this.enemies.find(e => e.data.id === t.id && e.isAlive()))
      .filter((e): e is Enemy => e !== undefined);

    if (liveTargets.length === 0 && skill.data.type !== 'support') {
      this.castSkillsSequentially(hero, skills, index + 1, usedThisTurn);
      return;
    }

    // Preview AOE avant l'impact
    this.onEvent({ type: 'skill_preview', source: hero.data.id, skillData: skill.data });

    setTimeout(() => {
      if (!this.running) return;

      usedThisTurn.add(skill.data.id);
      const animDelay = this.useHeroSkill(hero, skill, liveTargets);

      this.onEvent({ type: 'skill_preview_clear' });

      setTimeout(() => {
        if (!this.running) return;
        this.castSkillsSequentially(hero, skills, index + 1, usedThisTurn);
      }, animDelay);
    }, PREVIEW_DELAY);
  }

  /**
   * Applique les dégâts / soins d'un skill sur ses cibles.
   * Retourne le délai total avant que tous les impacts soient résolus.
   */
  private useHeroSkill(hero: Hero, skill: Skill, targets: Enemy[]): number {
    skill.use();
    this.onEvent({ type: 'cooldowns_updated', source: hero.data.id, skillId: skill.data.id });

    const hits      = skill.data.hits ?? 1;
    let totalDelay  = 0;

    // Dégâts — chaque cible reçoit ses coups avec un décalage visuel
    if (skill.data.damage) {
      targets.forEach((target, targetIndex) => {
        const targetDelay = targetIndex * TARGET_STAGGER;

        for (let i = 0; i < hits; i++) {
          const hitDelay = targetDelay + i * HIT_STAGGER;

          setTimeout(() => {
            if (!this.running || !target.isAlive()) return;
            const dmg = target.takeDamage((skill.data.damage ?? 0) + hero.data.attack);
            this.onEvent({
              type:      'skill_used',
              source:    hero.data.id,
              target:    target.data.id,
              value:     dmg,
              skillName: skill.data.name,
              hitIndex:  i,
              totalHits: hits,
            });
            if (!target.isAlive()) this.handleDeath(target.data.id, false);
          }, hitDelay);

          totalDelay = Math.max(totalDelay, hitDelay);
        }
      });
    }

    // Soin — appliqué sur le caster
    if (skill.data.heal) {
      hero.heal(skill.data.heal);
      this.onEvent({
        type:      'skill_used',
        source:    hero.data.id,
        target:    hero.data.id,
        value:     skill.data.heal,
        skillName: skill.data.name,
        hitIndex:  0,
        totalHits: 1,
      });
    }

    return totalDelay + this.ATTACK_ANIM_DELAY;
  }

  /**
   * Termine le tour d'un héros :
   * 1. Tick les cooldowns de tous ses skills SAUF ceux utilisés ce tour
   * 2. Émet cooldowns_updated pour rafraîchir l'UI
   * 3. Passe au tour suivant
   */
  private endHeroTurn(hero: Hero, usedSkillIds: Set<string> | null): void {
    hero.tickSkillCooldowns(usedSkillIds);
    this.onEvent({ type: 'cooldowns_updated', source: hero.data.id });
    this.finishTurn();
  }

  // ---------------------------------------------------------------------------
  // Tour ennemi
  // ---------------------------------------------------------------------------

  private processEnemyTurn(id: string): void {
    const enemy    = this.enemies.find(e => e.data.id === id)!;
    const gridUnit = this.grid.getUnit(id)!;
    const now      = Date.now();

    // Utilise une range fixe de 1 pour les ennemis (pas encore de système de skills ennemis)
    const ENEMY_RANGE = 1;
    let targets = this.grid.getTargetsInSkillRange(gridUnit, ENEMY_RANGE);

    if (targets.length > 0) {
      this.executeEnemyAttack(enemy, targets, now);
      return;
    }

    // Déplacement vers la cible la plus proche
    const from = { ...gridUnit.pos };
    const to   = this.grid.moveTowardNearest(gridUnit);

    if (!to) {
      this.finishTurn();
      return;
    }

    this.onEvent({ type: 'unit_moved', source: id, fromPos: from, toPos: to });

    setTimeout(() => {
      if (!this.running) return;
      targets = this.grid.getTargetsInSkillRange(gridUnit, ENEMY_RANGE);
      if (targets.length > 0) {
        this.executeEnemyAttack(enemy, targets, now);
      } else {
        this.finishTurn();
      }
    }, this.MOVE_ANIM_DELAY);
  }

  private executeEnemyAttack(enemy: Enemy, targets: GridUnit[], now: number): void {
    const heroTarget = this.heroes.find(h =>
      h.isAlive() && targets.some(t => t.id === h.data.id)
    );

    if (!heroTarget) {
      this.finishTurn();
      return;
    }

    const dmg = heroTarget.takeDamage(enemy.attack(now));
    this.onEvent({ type: 'enemy_attack', source: enemy.data.id, target: heroTarget.data.id, value: dmg });
    if (!heroTarget.isAlive()) this.handleDeath(heroTarget.data.id, true);

    setTimeout(() => {
      if (this.running) this.finishTurn();
    }, this.ATTACK_ANIM_DELAY);
  }

  // ---------------------------------------------------------------------------
  // Fin de tour & mort
  // ---------------------------------------------------------------------------

  /** Point d'entrée unique pour passer au tour suivant. */
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

  private handleDeath(id: string, isHero: boolean): void {
    this.grid.removeUnit(id);
    this.turns.removeUnit(id);
    this.onEvent({ type: isHero ? 'hero_died' : 'enemy_died', source: id });

    if (!this.enemies.some(e => e.isAlive())) {
      this.stop();
      this.onEvent({ type: 'combat_won' });
    } else if (!this.heroes.some(h => h.isAlive())) {
      this.stop();
      this.onEvent({ type: 'combat_lost' });
    }
  }
}
