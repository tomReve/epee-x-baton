import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { Skill, SkillData } from '../entities/Skill';
import { GridSystem, GridUnit } from './GridSystem';
import { TurnSystem } from './TurnSystem';

export interface CombatEvent {
    type:
    | 'turn_start'      // nouvelle unité qui commence son tour
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
    | 'aoe_start'
    | 'skill_preview'   // ✅ nouveau — déclenche la preview AOE
    | 'skill_preview_clear' // ✅ efface la preview;
    source?: string;
    target?: string;
    value?: number;
    skillName?: string;
    fromPos?: { col: number; row: number };
    toPos?: { col: number; row: number };
    round?: number;
    hitIndex?: number;
    totalHits?: number;
    skillId?: string; // ✅ nouveau
    skillData?: SkillData;
}

export type CombatEventCallback = (event: CombatEvent) => void;

// Dans le constructeur, un paramètre optionnel :
export type CombatMode = 'eliminate' | 'damage_race';

// Et dans combat_timeout, selon le mode :
// 'eliminate'    → combat_lost (pas vaincu à temps)
// 'damage_race'  → combat_won avec un score de dégâts

// Délai entre chaque action (ms) — ajuste pour le feeling
const TURN_DELAY = 600;

export class CombatSystem {
    private heroes: Hero[];
    private enemies: Enemy[];
    private grid: GridSystem;
    private turns: TurnSystem;
    private onEvent: CombatEventCallback;
    private running = false;
    private timeoutId?: ReturnType<typeof setTimeout>;
    private maxRounds: number;
    private readonly ATTACK_ANIM_DELAY = 700;
    private readonly MOVE_ANIM_DELAY = 420;


    constructor(
        heroes: Hero[],
        enemies: Enemy[],
        grid: GridSystem,
        turns: TurnSystem,
        onEvent: CombatEventCallback,
        maxRounds: number = 15
    ) {
        this.heroes = heroes;
        this.enemies = enemies;
        this.grid = grid;
        this.turns = turns;
        this.onEvent = onEvent;
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

    // Appelé par la CombatScene quand l'animation de l'unité est terminée
    onAnimationComplete(): void {
        if (!this.running) return;
        this.scheduleTurn(TURN_DELAY);
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

        if (unit.isHero) {
            this.processHeroTurn(unit.id);
        } else {
            this.processEnemyTurn(unit.id);
        }
    }


    // Dans CombatSystem.processHeroTurn :
    private processHeroTurn(id: string): void {
        const hero = this.heroes.find(h => h.data.id === id)!;
        const gridUnit = this.grid.getUnit(id)!;
        const readySkills = hero.skills.filter(s => s.isReady());

        // Vérifie si au moins un skill prêt a une cible en range
        const hasTarget = readySkills.some(skill =>
            this.grid.getAoeTargets(gridUnit, skill.data).length > 0
        );

        if (!hasTarget) {
            // Déplacement vers la cible la plus proche
            const from = { ...gridUnit.pos };
            const to = this.grid.moveTowardNearest(gridUnit);

            if (to) {
                this.onEvent({ type: 'unit_moved', source: id, fromPos: from, toPos: to });

                setTimeout(() => {
                    if (!this.running) return;
                    const targetsAfterMove = readySkills.some(skill =>
                        this.grid.getAoeTargets(gridUnit, skill.data).length > 0
                    );
                    if (targetsAfterMove) {
                        this.executeHeroSkills(hero, []);
                    } else {
                        this.endHeroTurn(hero, null);
                    }
                }, this.MOVE_ANIM_DELAY);
            } else {
                this.endHeroTurn(hero, null);
            }
            return;
        }

        this.executeHeroSkills(hero, []);
    }

    private executeHeroSkills(hero: Hero, _targets: GridUnit[]): void {
        const readySkills = hero.skills.filter(s => s.isReady());

        if (readySkills.length === 0) {
            this.endHeroTurn(hero, null);
            return;
        }

        this.castSkillsSequentially(hero, readySkills, 0, new Set());
    }

    private castSkillsSequentially(
        hero: Hero,
        skills: Skill[],
        index: number,
        usedThisTurn: Set<string>
    ): void {
        if (index >= skills.length || !this.running) {
            // ✅ Efface la preview en fin de chaîne
            this.onEvent({ type: 'skill_preview_clear' });
            this.endHeroTurn(hero, usedThisTurn);
            return;
        }

        const skill = skills[index];
        const gridUnit = this.grid.getUnit(hero.data.id)!;

        const liveTargets = this.grid.getAoeTargets(gridUnit, skill.data)
            .map(t => this.enemies.find(e => e.data.id === t.id && e.isAlive()))
            .filter(Boolean) as Enemy[];

        if (liveTargets.length === 0) {
            this.onEvent({ type: 'skill_preview_clear' });
            this.endHeroTurn(hero, usedThisTurn);
            return;
        }

        // ✅ Prévisualise la zone AVANT le cast
        this.onEvent({
            type: 'skill_preview',
            source: hero.data.id,
            skillData: skill.data,
        });

        // Délai court pour laisser la preview visible avant l'impact
        setTimeout(() => {
            if (!this.running) return;

            usedThisTurn.add(skill.data.id);
            const animDelay = this.useHeroSkill(hero, skill, liveTargets);

            // Efface la preview au moment de l'impact
            this.onEvent({ type: 'skill_preview_clear' });

            setTimeout(() => {
                if (!this.running) return;
                this.castSkillsSequentially(hero, skills, index + 1, usedThisTurn);
            }, animDelay);
        }, 400); // 400ms de preview avant l'impact
    }

    // Retire resolveTargets() — c'est maintenant GridSystem.getAoeTargets() qui s'en charge
    private useHeroSkill(
        hero: Hero,
        skill: Skill,
        targets: Enemy[]
    ): number {
        skill.use();
        this.onEvent({ type: 'cooldowns_updated', source: hero.data.id, skillId: skill.data.id });

        const hits = skill.data.hits ?? 1;
        let totalDelay = 0;

        targets.forEach((target, targetIndex) => {
            const targetDelay = targetIndex * 150;

            for (let i = 0; i < hits; i++) {
                const hitDelay = targetDelay + i * 120;
                setTimeout(() => {
                    if (!this.running || !target.isAlive()) return;
                    const dmg = target.takeDamage((skill.data.damage ?? 0) + hero.data.attack);
                    this.onEvent({
                        type: 'skill_used',
                        source: hero.data.id,
                        target: target.data.id,
                        value: dmg,
                        skillName: skill.data.name,
                        hitIndex: i,
                        totalHits: hits,
                    });
                    if (!target.isAlive()) this.handleDeath(target.data.id, false);
                }, hitDelay);

                totalDelay = Math.max(totalDelay, hitDelay);
            }
        });

        if (skill.data.heal) {
            hero.heal(skill.data.heal);
            this.onEvent({
                type: 'skill_used', source: hero.data.id, target: hero.data.id,
                value: skill.data.heal, skillName: skill.data.name, hitIndex: 0, totalHits: 1,
            });
        }

        return totalDelay + this.ATTACK_ANIM_DELAY;
    }

    // ✅ Point d'entrée unique de fin de tour héros — tick tous les skills SAUF le dernier utilisé
    private endHeroTurn(hero: Hero, usedSkillIds: Set<string> | null): void {
        hero.tickSkillCooldowns(usedSkillIds);
        this.onEvent({ type: 'cooldowns_updated', source: hero.data.id });
        this.finishTurn();
    }

    private processEnemyTurn(id: string): void {
        const enemy = this.enemies.find(e => e.data.id === id)!;
        const gridUnit = this.grid.getUnit(id)!;
        const now = Date.now();

        let targets = this.grid.getTargetsInRange(gridUnit);

        if (targets.length === 0) {
            const from = { ...gridUnit.pos };
            const to = this.grid.moveTowardNearest(gridUnit);

            if (to) {
                this.onEvent({ type: 'unit_moved', source: id, fromPos: from, toPos: to });
                targets = this.grid.getTargetsInRange(gridUnit);

                setTimeout(() => {
                    if (!this.running) return;
                    if (targets.length > 0) {
                        this.executeEnemyAttack(enemy, targets, now);
                    } else {
                        this.finishTurn(); // ✅ pas de paramètre
                    }
                }, this.MOVE_ANIM_DELAY);
            } else {
                this.finishTurn(); // ✅ pas de paramètre
            }
            return;
        }

        this.executeEnemyAttack(enemy, targets, now);
    }

    private executeEnemyAttack(enemy: Enemy, targets: GridUnit[], now: number): void {
        const heroTarget = this.heroes.find(h =>
            h.isAlive() && targets.some(t => t.id === h.data.id)
        );
        if (!heroTarget) { this.finishTurn(); return; } // ✅ pas de paramètre

        const dmg = heroTarget.takeDamage(enemy.attack(now));
        this.onEvent({ type: 'enemy_attack', source: enemy.data.id, target: heroTarget.data.id, value: dmg });
        if (!heroTarget.isAlive()) this.handleDeath(heroTarget.data.id, true);

        setTimeout(() => {
            if (this.running) this.finishTurn(); // ✅ pas de paramètre
        }, this.ATTACK_ANIM_DELAY);
    }

    // ✅ SEUL point d'entrée pour terminer un tour
    // heroId : si c'est un héros qui vient de jouer, on tick son cooldown ; sinon null
    private finishTurn(): void {
        if (!this.running) return;

        this.turns.next(); // ✅ l'appel manquant

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