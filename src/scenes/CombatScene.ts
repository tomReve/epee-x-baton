import Phaser from 'phaser';
import { GridPosition, GridSystem, GridUnit } from '../systems/GridSystem';
import { CombatSystem, CombatEvent } from '../systems/CombatSystem';
import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { EventBus } from '../utils/EventBus';
import { UnitAnimator } from '../entities/UnitAnimator';
import { TurnSystem } from '../systems/TurnSystem';
import { SkillData } from '../entities/Skill';
import { buildCombatSetup } from '../data/combat.factory';
import { LEVELS_BY_ID } from '../data/levels.data';
import { DEFAULT_PLAYER_HERO_STATES } from '../data/heroes.data';

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface SkillSlotRefs {
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Graphics;
    cooldownOverlay: Phaser.GameObjects.Graphics;
    cooldownText: Phaser.GameObjects.Text;
    x: number;
    y: number;
    w: number;
}
// ---------------------------------------------------------------------------
// CombatScene
//
// Responsabilité : affichage et interactions Phaser.
// Ne contient aucune logique de combat — elle réagit aux CombatEvents.
// ---------------------------------------------------------------------------

export class CombatScene extends Phaser.Scene {

    // --- Systèmes logiques ---
    private grid!: GridSystem;
    private combatSystem!: CombatSystem;
    private turns!: TurnSystem;
    private heroes: Hero[] = [];
    private enemies: Enemy[] = [];

    // --- Affichage ---
    private unitSprites: Map<string, Phaser.GameObjects.Container> = new Map();
    private unitAnimators: Map<string, UnitAnimator> = new Map();
    private skillSlots: Map<string, SkillSlotRefs> = new Map();

    private timelineContainer!: Phaser.GameObjects.Container;
    private roundText!: Phaser.GameObjects.Text;
    private aoePreviewGraphics!: Phaser.GameObjects.Graphics;

    // --- Grille ---
    private CELL_W = 0;
    private CELL_H = 0;
    private GRID_OFFSET_X = 0;
    private GRID_OFFSET_Y = 0;
    private COLS = 8;
    private ROWS = 6;

    // --- État ---
    private phase: 'preparation' | 'combat' = 'preparation';
    private maxRounds = 15;
    private isPaused = false;

    private pauseBtn!: Phaser.GameObjects.Container;

    constructor() { super({ key: 'CombatScene' }); }

    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------

    create(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        const UI_TOP = 80;
        const UI_BOT = 160;

        this.COLS = 8;
        this.ROWS = 6;
        this.CELL_W = Math.floor(W / this.COLS);
        this.CELL_H = Math.floor((H - UI_TOP - UI_BOT) / this.ROWS);
        this.GRID_OFFSET_X = 0;
        this.GRID_OFFSET_Y = UI_TOP;

        this.grid = new GridSystem(this.COLS, this.ROWS);

        const level = LEVELS_BY_ID['forest_1'];
        const setup = buildCombatSetup(level, DEFAULT_PLAYER_HERO_STATES);

        this.heroes = setup.heroes;
        this.enemies = setup.enemies;

        for (const unit of [...setup.heroUnits, ...setup.enemyUnits]) {
            this.grid.addUnit(unit);
        }

        this.drawGrid();
        this.aoePreviewGraphics = this.add.graphics().setDepth(5);

        for (const hero of this.heroes) this.createUnitSprite(hero.data.id, hero.data.name, true, hero.currentHp, hero.data.maxHp);
        for (const enemy of this.enemies) this.createUnitSprite(enemy.data.id, enemy.data.name, false, enemy.currentHp, enemy.data.maxHp);

        this.turns = new TurnSystem(this.heroes, this.enemies);

        this.combatSystem = new CombatSystem(
            this.heroes, this.enemies,
            this.grid, this.turns,
            (e) => this.handleEvent(e),
            this.maxRounds
        );

        this.drawTimeline();
        this.drawRounds();
        this.drawSkillBar();
        this.drawControlButtons();
        this.drawPreparationUI();

        this.scale.on('resize', () => {
            this.combatSystem.stop();
            this.isPaused = false;
            this.scene.restart();
        });
    }

    // ---------------------------------------------------------------------------
    // Rendu du terrain
    // ---------------------------------------------------------------------------

    private drawGrid(): void {
        this.drawTiles();
        this.drawGridOverlay();
    }

    private drawTiles(): void {
        const COLS_IN_SHEET = 9;
        const TILE_FRAME = 1 + 1 * COLS_IN_SHEET; // frame(1, 1)

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const x = this.GRID_OFFSET_X + col * this.CELL_W + this.CELL_W / 2;
                const y = this.GRID_OFFSET_Y + row * this.CELL_H + this.CELL_H / 2;
                this.add.image(x, y, 'tileset_green', TILE_FRAME)
                    .setDisplaySize(this.CELL_W, this.CELL_H)
                    .setDepth(0);
            }
        }
    }

    private drawGridOverlay(): void {
        const g = this.add.graphics().setDepth(1);

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const x = this.GRID_OFFSET_X + col * this.CELL_W;
                const y = this.GRID_OFFSET_Y + row * this.CELL_H;

                g.lineStyle(1, 0xffffff, 0.08);
                g.strokeRect(x, y, this.CELL_W, this.CELL_H);

                if ((col + row) % 2 === 0) {
                    g.fillStyle(0x000000, 0.08);
                    g.fillRect(x, y, this.CELL_W, this.CELL_H);
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Sprites des unités
    // ---------------------------------------------------------------------------

    private getSpriteKey(id: string): string {
        if (id === 'warrior') return 'warrior';
        if (id === 'monk') return 'monk';
        return 'goblin';
    }

    private createUnitSprite(id: string, name: string, isHero: boolean, hp: number, maxHp: number): void {
        const unit = this.grid.getUnit(id)!;
        const { x, y } = this.cellToPixel(unit.pos.col, unit.pos.row);
        const spriteKey = this.getSpriteKey(id);

        const shadow = this.add.ellipse(0, 28, 40, 12, 0x000000, 0.35);
        const glow = this.add.ellipse(0, 20, 50, 16, isHero ? 0x4488ff : 0xff4422, 0.15);

        const sprite = this.add.sprite(0, 0, `${spriteKey}_idle`, 0)
            .setScale(this.CELL_W / 192 * 1.4);

        const animator = new UnitAnimator(sprite, spriteKey);
        animator.play('idle');
        this.unitAnimators.set(id, animator);

        const hpBg = this.add.rectangle(0, -52, 48, 6, 0x1a1a1a, 0.9).setOrigin(0.5);
        const hpFill = this.add.rectangle(-24, -52, 48 * (hp / maxHp), 6, isHero ? 0xf0c020 : 0xff4422).setOrigin(0, 0.5);
        const hpBorder = this.add.rectangle(0, -52, 50, 8, 0x000000, 0).setOrigin(0.5).setStrokeStyle(1, 0x000000, 0.8);

        const label = this.add.text(0, -66, name, {
            fontSize: '11px', color: isHero ? '#f0e060' : '#ff9980',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, glow, sprite, hpBg, hpFill, hpBorder, label]);
        container.setData('hpFill', hpFill);
        container.setData('maxHp', maxHp);
        container.setDepth(unit.pos.row * 10 + unit.pos.col);

        this.unitSprites.set(id, container);
    }

    private updateHpBar(id: string, hp: number): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        const hpFill = container.getData('hpFill') as Phaser.GameObjects.Rectangle;
        const maxHp = container.getData('maxHp') as number;
        hpFill.width = 50 * Math.max(0, hp / maxHp);
    }

    private moveSprite(id: string, toCol: number, toRow: number): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        const { x, y } = this.cellToPixel(toCol, toRow);
        this.tweens.add({ targets: container, x, y, duration: 350, ease: 'Sine.easeInOut' });
    }

    private flashSprite(id: string): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        this.tweens.killTweensOf(container);
        this.tweens.add({
            targets: container, alpha: 0.2, duration: 80, yoyo: true, repeat: 2,
            onComplete: () => container.setAlpha(1),
        });
    }

    private killSprite(id: string): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        this.tweens.add({
            targets: container, alpha: 0, y: container.y - 20, duration: 400,
            onComplete: () => container.destroy(),
        });
        this.unitSprites.delete(id);
    }

    // ---------------------------------------------------------------------------
    // AOE Preview
    // ---------------------------------------------------------------------------

    private showAoePreview(skill: SkillData, casterUnit: GridUnit): void {
        this.clearAoePreview();

        const cells = this.resolvePreviewCells(skill, casterUnit);
        if (cells.length === 0) return;

        const g = this.aoePreviewGraphics;
        const color = skill.type === 'magic' ? 0x8844ff
            : skill.type === 'support' ? 0x44ff88
                : 0xff6622;

        for (const cell of cells) {
            const x = this.GRID_OFFSET_X + cell.col * this.CELL_W;
            const y = this.GRID_OFFSET_Y + cell.row * this.CELL_H;
            g.fillStyle(color, 0.3);
            g.fillRect(x + 2, y + 2, this.CELL_W - 4, this.CELL_H - 4);
            g.lineStyle(1.5, color, 0.8);
            g.strokeRect(x + 2, y + 2, this.CELL_W - 4, this.CELL_H - 4);
        }

        this.tweens.add({
            targets: g, alpha: { from: 0.6, to: 1 },
            duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    private clearAoePreview(): void {
        this.tweens.killTweensOf(this.aoePreviewGraphics);
        this.aoePreviewGraphics.clear();
        this.aoePreviewGraphics.setAlpha(1);
    }

    /**
     * Résout les cases à surligner pour la preview.
     * Duplique volontairement la logique de GridSystem.getAoeTargets
     * pour retourner des GridPosition (cases) plutôt que des GridUnit.
     */
    private resolvePreviewCells(skill: SkillData, casterUnit: GridUnit): GridPosition[] {
        if (skill.targetType === 'all') {
            return this.grid.getAllUnits()
                .filter(u => u.isHero !== casterUnit.isHero)
                .map(u => u.pos);
        }

        if (skill.targetType === 'aoe' && skill.aoe) {
            const origin = skill.range === 0
                ? casterUnit.pos
                : this.grid.getTargetsInSkillRange(casterUnit, skill.range)[0]?.pos ?? casterUnit.pos;
            return this.grid.getAoeCells(origin, skill.aoe);
        }

        if (skill.range === 0 && skill.type === 'support') {
            return [casterUnit.pos];
        }

        const target = this.grid.getTargetsInSkillRange(casterUnit, skill.range)[0];
        return target ? [target.pos] : [];
    }

    private showFloatingTextAt(x: number, y: number, value: number, isHeal: boolean, offsetX = 0): void {
        const color = isHeal ? '#44ff88' : '#eedba7';
        const strokeColor = '#000000';
        const prefix = isHeal ? '+' : '';

        const text = this.add.text(x + 24 + offsetX, y - 50, `${prefix}${value}`, {
            fontSize: '20px', fontStyle: 'italic',
            fontFamily: 'Arial Black, Arial, sans-serif',
            color, stroke: strokeColor, strokeThickness: 5,
            padding: { left: 10, right: 20, top: 5, bottom: 5 },
        }).setDepth(50).setOrigin(0.5).setAngle(-8);

        this.tweens.add({
            targets: text, scaleX: { from: 0.6, to: 1 }, scaleY: { from: 0.6, to: 1 },
            duration: 100, ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: text, y: text.y - 60, alpha: { from: 1, to: 0 },
                    duration: 900, delay: 150, ease: 'Sine.easeIn',
                    onComplete: () => text.destroy(),
                });
            },
        });
    }

    // ---------------------------------------------------------------------------
    // Gestion des events combat
    // ---------------------------------------------------------------------------

    private handleEvent(event: CombatEvent): void {
        switch (event.type) {

            case 'turn_start':
                this.drawTimeline();
                return;

            case 'cooldowns_updated': {
                const hero = this.heroes.find(h => h.data.id === event.source);
                if (hero) this.updateSkillCooldowns(hero, event.skillId);
                return;
            }

            case 'round_start': {
                const round = event.round ?? 0;
                this.roundText.setText(`Round ${round + 1} / ${this.maxRounds}`);
                return;
            }

            case 'unit_moved': {
                this.unitAnimators.get(event.source!)?.playWalk(350);
                this.moveSprite(event.source!, event.toPos!.col, event.toPos!.row);
                return;
            }

            case 'skill_used': {
                const hitIndex = event.hitIndex ?? 0;
                const isHeal = event.target === event.source;

                if (hitIndex === 0) this.unitAnimators.get(event.source!)?.play('attack');
                this.flashSprite(event.target!);

                const pos = this.unitSprites.get(event.target!);
                const capturedX = pos?.x ?? 0;
                const capturedY = pos?.y ?? 0;

                this.time.delayedCall(hitIndex * 120, () => {
                    this.showFloatingTextAt(capturedX, capturedY, event.value!, isHeal, hitIndex * 14);
                });

                if (isHeal) {
                    const healer = this.heroes.find(h => h.data.id === event.target);
                    if (healer) this.updateHpBar(healer.data.id, healer.currentHp);
                } else {
                    const heroTarget = this.heroes.find(h => h.data.id === event.target);
                    const enemyTarget = this.enemies.find(e => e.data.id === event.target);
                    if (heroTarget) this.updateHpBar(heroTarget.data.id, heroTarget.currentHp);
                    if (enemyTarget) this.updateHpBar(enemyTarget.data.id, enemyTarget.currentHp);
                }

                return;
            }

            case 'skill_preview': {
                const casterUnit = this.grid.getUnit(event.source!);
                if (casterUnit && event.skillData) this.showAoePreview(event.skillData, casterUnit);
                return;
            }

            case 'skill_preview_clear':
                this.clearAoePreview();
                return;

            case 'unit_died':
                this.killSprite(event.source!);
                this.drawTimeline();
                return;

            case 'combat_won':
                this.showCombatResult('won');
                EventBus.emit('combat:won');
                return;

            case 'combat_lost':
                this.showCombatResult('lost');
                EventBus.emit('combat:lost');
                return;

            case 'combat_timeout':
                this.showCombatResult('timeout');
                EventBus.emit('combat:timeout');
                return;
        }
    }

    // ---------------------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------------------

    private drawPreparationUI(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        const overlay = this.add.graphics().setDepth(10);
        overlay.fillStyle(0x000000, 0.35);
        overlay.fillRect(0, 0, W, H);

        const title = this.add.text(W / 2, H * 0.35, 'Préparez-vous !', {
            fontSize: '28px', color: '#f0e060', stroke: '#000000', strokeThickness: 4, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);

        const sub = this.add.text(W / 2, H * 0.35 + 44, 'Placez votre équipe et lancez le combat', {
            fontSize: '14px', color: '#aaaacc', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(11);

        const btnW = 220, btnH = 52;
        const btnX = W / 2 - btnW / 2;
        const btnY = H * 0.35 + 100;

        const btnBg = this.add.graphics().setDepth(11);
        const drawBtn = (color: number) => {
            btnBg.clear();
            btnBg.fillStyle(color);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 26);
            btnBg.lineStyle(2, 0xffffff, 0.3);
            btnBg.strokeRoundedRect(btnX + 2, btnY + 2, btnW - 4, btnH - 4, 24);
        };
        drawBtn(0xd4b820);

        const btnText = this.add.text(W / 2, btnY + btnH / 2, '⚔️ Combattre', {
            fontSize: '20px', color: '#1a1a00', fontStyle: 'bold', stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

        btnText.on('pointerover', () => drawBtn(0xffe040));
        btnText.on('pointerout', () => drawBtn(0xd4b820));
        btnText.on('pointerdown', () => this.startCombat([overlay, title, sub, btnBg, btnText]));
    }

    private startCombat(uiElements: Phaser.GameObjects.GameObject[]): void {
        this.phase = 'combat';
        this.tweens.add({
            targets: uiElements, alpha: 0, duration: 300,
            onComplete: () => uiElements.forEach(e => e.destroy()),
        });
        this.combatSystem.start();
    }

    private drawTimeline(): void {
        const W = this.scale.width;

        if (this.timelineContainer) this.timelineContainer.destroy();

        const queue = this.turns.getQueue();
        const current = this.turns.getCurrentIndex();

        const ICON_SIZE = 36;
        const SPACING = 44;
        const totalW = queue.length * SPACING;
        const startX = W / 2 - totalW / 2;
        const Y = 38;

        const elements: Phaser.GameObjects.GameObject[] = [];

        const line = this.add.graphics();
        line.lineStyle(1, 0x334433, 0.5);
        line.lineBetween(startX - 10, Y, startX + totalW + 10, Y);
        elements.push(line);

        queue.forEach((unit, i) => {
            const x = startX + i * SPACING;
            const isActive = i === current;
            const color = unit.isHero ? 0x3b8bd4 : 0xe24b4a;
            const glow = unit.isHero ? 0x4488ff : 0xff4422;

            if (isActive) elements.push(this.add.circle(x, Y, ICON_SIZE / 2 + 6, glow, 0.25));

            elements.push(this.add.circle(x, Y, ICON_SIZE / 2, isActive ? 0xf0c020 : color, isActive ? 1 : 0.75));

            elements.push(this.add.text(x, Y, unit.id[0].toUpperCase(), {
                fontSize: isActive ? '14px' : '12px',
                color: isActive ? '#1a1a00' : '#ffffff',
                fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5));

            if (isActive) elements.push(this.add.triangle(x, Y - ICON_SIZE / 2 - 8, -6, 0, 6, 0, 0, -8, 0xf0c020));

            elements.push(this.add.text(x, Y + ICON_SIZE / 2 + 6, `${unit.speed}`, {
                fontSize: '9px', color: '#667766',
            }).setOrigin(0.5));
        });

        this.timelineContainer = this.add.container(0, 0, elements).setDepth(20);
    }

    private drawRounds(): void {
        const W = this.scale.width;
        this.roundText = this.add.text(W / 4, 38, `Round 1 / ${this.maxRounds}`, {
            fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
    }

    private drawSkillBar(): void {
        const W = this.scale.width;
        const H = this.scale.height;
        const slotW = 56;
        const rowGap = 8;
        const heroGap = 16;

        let currentY = H - 100;

        for (let h = this.heroes.length - 1; h >= 0; h--) {
            const hero = this.heroes[h];
            const skills = hero.skills;
            const totalW = skills.length * slotW + (skills.length - 1) * rowGap;
            const startX = (W - totalW) / 2;

            this.add.text(startX - 12, currentY + slotW / 2, hero.data.name, {
                fontSize: '11px', color: '#aaaacc',
            }).setOrigin(1, 0.5).setDepth(16);

            for (let i = 0; i < skills.length; i++) {
                const skill = skills[i];
                const sx = startX + i * (slotW + rowGap);
                const sy = currentY;

                const bg = this.add.graphics().setDepth(15);
                bg.fillStyle(0x1a1a2a, 0.95);
                bg.fillRoundedRect(sx, sy, slotW, slotW, 10);
                bg.lineStyle(1.5, 0x4488cc, 0.7);
                bg.strokeRoundedRect(sx, sy, slotW, slotW, 10);

                const icon = this.add.graphics().setDepth(16);
                icon.fillStyle(0x4488cc, 0.85);
                icon.fillCircle(sx + slotW / 2, sy + slotW / 2 - 6, 14);

                this.add.text(sx + slotW / 2, sy + slotW - 8, skill.data.name, {
                    fontSize: '8px', color: '#aaaacc',
                }).setOrigin(0.5).setDepth(16);

                const cooldownOverlay = this.add.graphics().setDepth(17);
                const cooldownText = this.add.text(sx + slotW / 2, sy + slotW / 2 - 6, '', {
                    fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
                    stroke: '#000000', strokeThickness: 3,
                }).setOrigin(0.5).setDepth(18);

                this.skillSlots.set(`${hero.data.id}_${skill.data.id}`, {
                    bg, icon, cooldownOverlay, cooldownText, x: sx, y: sy, w: slotW,
                });
            }

            currentY -= (slotW + heroGap);
        }

        for (const hero of this.heroes) this.updateSkillCooldowns(hero);
    }

    private updateSkillCooldowns(hero: Hero, onlySkillId?: string): void {
        if (!hero.isAlive()) return;

        for (const skill of hero.skills) {
            if (onlySkillId && skill.data.id !== onlySkillId) continue;

            const slot = this.skillSlots.get(`${hero.data.id}_${skill.data.id}`);
            if (!slot) continue;

            const remaining = skill.getTurnsRemaining();
            const isReady = remaining <= 0;

            slot.cooldownOverlay.clear();

            if (!isReady) {
                slot.cooldownOverlay.fillStyle(0x000000, 0.65);
                slot.cooldownOverlay.fillRoundedRect(slot.x, slot.y, slot.w, slot.w, 10);
                slot.cooldownText.setText(`${remaining}`);
                slot.icon.setAlpha(0.4);
            } else {
                slot.cooldownText.setText('');
                slot.icon.setAlpha(1);
            }
        }
    }

    private drawControlButtons(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        this.pauseBtn = this.createButton(W - 70, H - 160, '⏸', 0x334455, () => {
            this.isPaused = !this.isPaused;
            this.isPaused ? this.combatSystem.stop() : this.combatSystem.start();
            this.updatePauseLabel();
        });

        this.restartBtn = this.createButton(W - 70, H - 210, '↺', 0x553333, () => {
            this.combatSystem.stop();
            this.isPaused = false;
            this.scene.restart();
        });
    }

    private updatePauseLabel(): void {
        const text = this.pauseBtn.getAt(1) as Phaser.GameObjects.Text;
        text.setText(this.isPaused ? '▶' : '⏸');
    }

    private createButton(
        x: number, y: number, label: string, color: number, onClick: () => void
    ): Phaser.GameObjects.Container {
        const bg = this.add.rectangle(0, 0, 52, 36, color, 0.85).setInteractive({ useHandCursor: true });
        const text = this.add.text(0, 0, label, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
        const container = this.add.container(x, y, [bg, text]).setDepth(25);
        bg.on('pointerover', () => bg.setAlpha(1));
        bg.on('pointerout', () => bg.setAlpha(0.85));
        bg.on('pointerdown', onClick);
        return container;
    }

    private showCombatResult(result: 'won' | 'lost' | 'timeout'): void {
        const W = this.scale.width;
        const H = this.scale.height;

        const configs = {
            won: { color: 0xf0c020, text: '🏆 Victoire !', sub: 'Tous les ennemis ont été vaincus' },
            lost: { color: 0xcc2222, text: '💔 Défaite...', sub: 'Votre équipe a été éliminée' },
            timeout: { color: 0x884422, text: '⏱️ Temps écoulé !', sub: 'Les ennemis ont résisté' },
        };

        const cfg = configs[result];

        const overlay = this.add.graphics().setDepth(30);
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, W, H);

        const panelW = 320, panelH = 160;
        const panel = this.add.graphics().setDepth(31);
        panel.fillStyle(0x0a0a0a, 0.95);
        panel.fillRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);
        panel.lineStyle(2, cfg.color, 0.8);
        panel.strokeRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);

        this.add.text(W / 2, H / 2 - 30, cfg.text, {
            fontSize: '26px', color: `#${cfg.color.toString(16).padStart(6, '0')}`,
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(32);

        this.add.text(W / 2, H / 2 + 10, cfg.sub, {
            fontSize: '14px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(32);

        this.add.text(W / 2, H / 2 + 55, '↺ Rejouer', {
            fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(32)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.combatSystem.stop();
                this.scene.restart();
            });
    }

    // ---------------------------------------------------------------------------
    // Utilitaires
    // ---------------------------------------------------------------------------

    private cellToPixel(col: number, row: number): { x: number; y: number } {
        return {
            x: this.GRID_OFFSET_X + col * this.CELL_W + this.CELL_W / 2,
            y: this.GRID_OFFSET_Y + row * this.CELL_H + this.CELL_H / 2,
        };
    }
}