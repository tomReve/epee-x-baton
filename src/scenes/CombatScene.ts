import Phaser from 'phaser';
import { GridSystem, GridUnit } from '../systems/GridSystem';
import { CombatSystem, CombatEvent } from '../systems/CombatSystem';
import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';
import { EventBus } from '../utils/EventBus';
import { UnitAnimator } from '../entities/UnitAnimator';
import { TurnSystem } from '../systems/TurnSystem';

export class CombatScene extends Phaser.Scene {
    private grid!: GridSystem;
    private combatSystem!: CombatSystem;
    private turns!: TurnSystem;

    // Entités logiques
    private heroes: Hero[] = [];
    private enemies: Enemy[] = [];

    // Sprites Phaser indexés par unit id
    private unitSprites: Map<string, Phaser.GameObjects.Container> = new Map();

    private CELL_W = 0;
    private CELL_H = 0;
    private GRID_OFFSET_X = 0;
    private GRID_OFFSET_Y = 0;
    private COLS = 8;
    private ROWS = 8;

    private unitAnimators: Map<string, UnitAnimator> = new Map();
    private phase: 'preparation' | 'combat' = 'preparation';

    private timelineContainer!: Phaser.GameObjects.Container;

    private roundText!: Phaser.GameObjects.Text;
    private maxRounds = 15; // Nombre maximum de rounds avant timeout

    private skillSlots: Map<string, {
        bg: Phaser.GameObjects.Graphics;
        icon: Phaser.GameObjects.Graphics;
        cooldownOverlay: Phaser.GameObjects.Graphics;
        cooldownText: Phaser.GameObjects.Text;
        x: number;   // ✅ stocke la position
        y: number;
        w: number;
    }> = new Map();

    constructor() { super({ key: 'CombatScene' }); }

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

        // --- Création des héros ---
        const sword = new Hero({
            id: 'sword', name: 'Sword',
            hp: 200, maxHp: 200, attack: 25, defense: 5, speed: 1200,
            // Dans la définition du hero sword :
            skills: [
                {
                    id: 'multihit',
                    name: 'Multi Hit',
                    damage: 20,        // dégâts par coup
                    hits: 4,         // nombre de coups
                    cooldownTurns: 1,
                    target: 'enemy',
                    type: 'physical'
                },
                {
                    id: 'slash',
                    name: 'Slash',
                    damage: 25,        // dégâts par coup
                    cooldownTurns: 0,
                    target: 'enemy',
                    type: 'physical'
                }
            ]
        });
        const staff = new Hero({
            id: 'staff', name: 'Staff',
            hp: 150, maxHp: 150, attack: 18, defense: 3, speed: 1500,
            skills: [
                { id: 'regen', name: 'Regen', heal: 30, cooldownTurns: 1, target: 'self', type: 'support' }
            ]
        });
        this.heroes = [sword, staff];

        // --- Création des ennemis ---
        const goblin1 = new Enemy({ id: 'goblin1', name: 'Goblin', hp: 120, maxHp: 120, attack: 14, defense: 2, speed: 1400, xpReward: 30, goldReward: 10 });
        const goblin2 = new Enemy({ id: 'goblin2', name: 'Goblin', hp: 120, maxHp: 120, attack: 14, defense: 2, speed: 1400, xpReward: 30, goldReward: 10 });
        const boss = new Enemy({ id: 'boss', name: 'Boss', hp: 400, maxHp: 400, attack: 22, defense: 8, speed: 1800, xpReward: 100, goldReward: 50 });
        this.enemies = [goblin1, goblin2, boss];

        // --- Placement sur la grille ---
        interface Placement {
            id: string;
            isHero: boolean;
            moveRange: number;
            attackRange: number;
            col: number;
            row: number;
        }

        const placements: Placement[] = [
            { id: 'sword', isHero: true, moveRange: 2, attackRange: 1, col: 0, row: 1 },
            { id: 'staff', isHero: true, moveRange: 2, attackRange: 2, col: 0, row: 2 },
            { id: 'goblin1', isHero: false, moveRange: 1, attackRange: 1, col: 5, row: 0 },
            { id: 'goblin2', isHero: false, moveRange: 1, attackRange: 1, col: 5, row: 3 },
            { id: 'boss', isHero: false, moveRange: 2, attackRange: 1, col: 5, row: 2 },
        ];

        for (const p of placements) {
            const unit: GridUnit = {
                id: p.id,
                isHero: p.isHero,
                pos: { col: p.col, row: p.row },
                moveRange: p.moveRange,
                attackRange: p.attackRange,
            };
            this.grid.addUnit(unit);
        }

        // --- Dessin de la grille ---
        this.drawGrid();

        // --- Sprites des unités ---
        for (const hero of this.heroes) this.createUnitSprite(hero.data.id, hero.data.name, true, hero.currentHp, hero.data.maxHp);
        for (const enemy of this.enemies) this.createUnitSprite(enemy.data.id, enemy.data.name, false, enemy.currentHp, enemy.data.maxHp);


        // Après la création des héros et ennemis, avant combatSystem :
        this.turns = new TurnSystem(this.heroes, this.enemies);

        this.combatSystem = new CombatSystem(
            this.heroes, this.enemies,
            this.grid, this.turns,      // ← passe turns
            (e) => this.handleEvent(e),
            15
        );
        // --- Lancement du combat ---
        this.combatSystem = new CombatSystem(
            this.heroes, this.enemies,
            this.grid, this.turns,      // ← passe turns
            (e) => this.handleEvent(e)
        );
        this.drawPreparationUI();
        this.drawTimeline();
        this.drawRounds();
        this.drawSkillBar();
    }

    // Dessine la grille en arrière-plan
    private drawGrid(): void {
        // --- Dalles de pierre (la grille subtile) ---
        this.drawTiles();
        this.drawGridOverlay();  // ajoute cette ligne
    }

    private drawGridOverlay(): void {
        const g = this.add.graphics();
        g.setDepth(1); // au-dessus des tiles, en dessous des unités

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const x = this.GRID_OFFSET_X + col * this.CELL_W;
                const y = this.GRID_OFFSET_Y + row * this.CELL_H;

                // Contour de case — très subtil pour ne pas écraser le style
                g.lineStyle(1, 0xffffff, 0.08);
                g.strokeRect(x, y, this.CELL_W, this.CELL_H);

                // Légère teinte alternée pour distinguer les cases
                const isDark = (col + row) % 2 === 0;
                if (isDark) {
                    g.fillStyle(0x000000, 0.08);
                    g.fillRect(x, y, this.CELL_W, this.CELL_H);
                }
            }
        }
    }

    private drawTiles(): void {
        const COLS_IN_SHEET = 9;

        const frame = (col: number, row: number) => col + row * COLS_IN_SHEET;

        const TILE_LIGHT = frame(1, 1); // centre buisson vert clair

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const x = this.GRID_OFFSET_X + col * this.CELL_W + this.CELL_W / 2;
                const y = this.GRID_OFFSET_Y + row * this.CELL_H + this.CELL_H / 2;

                const frameIndex = TILE_LIGHT;

                this.add.image(x, y, 'tileset_green', frameIndex)
                    .setDisplaySize(this.CELL_W, this.CELL_H)
                    .setDepth(0);
            }
        }
    }

    private getSpriteKey(id: string): string {
        if (id === 'sword') return 'sword';
        if (id === 'staff') return 'staff';
        if (id.startsWith('goblin')) return 'goblin';
        if (id === 'boss') return 'boss';
        return 'goblin'; // fallback
    }

    private createUnitSprite(
        id: string, name: string, isHero: boolean, hp: number, maxHp: number
    ): void {
        const unit = this.grid.getUnit(id)!;
        const { x, y } = this.cellToPixel(unit.pos.col, unit.pos.row);
        const spriteKey = this.getSpriteKey(id);


        // --- Ombre au sol ---
        const shadow = this.add.ellipse(0, 28, 40, 12, 0x000000, 0.35);

        // --- Sprite animé ---
        const sprite = this.add.sprite(0, 0, `${spriteKey}_idle`, 0)
            .setScale(this.CELL_W / 192 * 1.4)

        const animator = new UnitAnimator(sprite, spriteKey);
        animator.play('idle');
        this.unitAnimators.set(id, animator);
        //this.drawCharacter(body, isHero, id);

        // --- Barre HP style mobile ---
        const hpBg = this.add.rectangle(0, -52, 48, 6, 0x1a1a1a, 0.9).setOrigin(0.5);
        const hpFill = this.add.rectangle(-24, -52, 48 * (hp / maxHp), 6, isHero ? 0xf0c020 : 0xff4422, 1)
            .setOrigin(0, 0.5);
        const hpBorder = this.add.rectangle(0, -52, 50, 8, 0x000000, 0)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0x000000, 0.8);

        // --- Nom ---
        const label = this.add.text(0, -66, name, {
            fontSize: '11px',
            color: isHero ? '#f0e060' : '#ff9980',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // --- Lueur douce sous le personnage (bloom simulé) ---
        const glow = this.add.ellipse(0, 20, 50, 16,
            isHero ? 0x4488ff : 0xff4422, 0.15);

        const container = this.add.container(x, y, [shadow, glow, sprite, hpBg, hpFill, hpBorder, label]);
        container.setData('hpFill', hpFill);
        container.setData('maxHp', maxHp);
        container.setDepth(unit.pos.row * 10 + unit.pos.col); // z-order correct

        this.unitSprites.set(id, container);
    }


    // Met à jour la barre HP d'une unité
    private updateHpBar(id: string, hp: number): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        const hpBar = container.getData('hpFill') as Phaser.GameObjects.Rectangle;
        const maxHp = container.getData('maxHp') as number;
        hpBar.width = 50 * Math.max(0, hp / maxHp);
    }

    // Anime le déplacement d'un sprite vers une nouvelle cellule
    private moveSprite(id: string, toCol: number, toRow: number): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        const { x, y } = this.cellToPixel(toCol, toRow);
        this.tweens.add({
            targets: container,
            x, y,
            duration: 350,
            ease: 'Sine.easeInOut'
        });
    }

    // Anime un flash sur la cible touchée
    private flashSprite(id: string): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        this.tweens.add({
            targets: container,
            alpha: 0.2,
            duration: 80,
            yoyo: true,
            repeat: 2
        });
    }

    // Retire un sprite mort avec un fade out
    private killSprite(id: string): void {
        const container = this.unitSprites.get(id);
        if (!container) return;
        this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 20,
            duration: 400,
            onComplete: () => container.destroy()
        });
        this.unitSprites.delete(id);
    }

    private handleEvent(event: CombatEvent): void {
        switch (event.type) {

            case 'turn_start':
                this.drawTimeline(); // rafraîchit la timeline à chaque nouveau tour
                return;

            case 'cooldowns_updated': {
                const hero = this.heroes.find(h => h.data.id === event.source);
                if (hero) this.updateSkillCooldowns(hero, event.skillId); // ✅ undefined = tout le héros
                return;
            }

            case 'round_start':
                const round = event.round ?? 0;
                this.roundText.setText(`Round ${round + 1} / ${this.maxRounds}`);
                break;

            case 'unit_moved': {
                const animator = this.unitAnimators.get(event.source!);
                animator?.playWalk(350);
                this.moveSprite(event.source!, event.toPos!.col, event.toPos!.row);
                // On ne appelle plus advanceTurn() ici
                // CombatSystem gère lui-même la suite (attaque ou fin de tour)
                return;
            }

            case 'hero_attack':
                this.unitAnimators.get(event.source!)?.play('attack');
                this.flashSprite(event.target!);
                const e = this.enemies.find(e => e.data.id === event.target);
                if (e) {
                    this.updateHpBar(e.data.id, e.currentHp);
                    this.showFloatingText(e.data.id, event.value!, false); // ✅ dégâts
                }
                break;

            case 'enemy_attack':
                this.unitAnimators.get(event.source!)?.play('attack');
                this.flashSprite(event.target!);
                const h = this.heroes.find(h => h.data.id === event.target);
                if (h) {
                    this.updateHpBar(h.data.id, h.currentHp);
                    this.showFloatingText(h.data.id, event.value!, false); // ✅ dégâts
                }
                break;

            case 'skill_used': {
                const hitIndex = event.hitIndex ?? 0;
                const totalHits = event.totalHits ?? 1;
                const isHeal = event.target === event.source;

                if (hitIndex === 0) {
                    this.unitAnimators.get(event.source!)?.play('attack');
                }
                this.flashSprite(event.target!);

                // ✅ Capture la position MAINTENANT, avant tout délai
                const targetContainer = this.unitSprites.get(event.target!);
                const capturedX = targetContainer?.x ?? 0;
                const capturedY = targetContainer?.y ?? 0;

                this.time.delayedCall(hitIndex * 120, () => {
                    this.showFloatingTextAt(capturedX, capturedY, event.value!, isHeal, hitIndex * 14);
                });

                if (isHeal) {
                    const healer = this.heroes.find(h => h.data.id === event.target);
                    if (healer) this.updateHpBar(healer.data.id, healer.currentHp);
                } else {
                    const t = this.enemies.find(e => e.data.id === event.target);
                    if (t) this.updateHpBar(t.data.id, t.currentHp);
                }

                if (hitIndex === totalHits - 1) {
                    const hero = this.heroes.find(h => h.data.id === event.source);
                    if (hero) this.updateSkillCooldowns(hero); // se rafraîchit à chaque skill, pas juste en fin de tour
                } else {
                    return;
                }
                break;
            }


            case 'enemy_died':
                this.killSprite(event.source!);
                this.drawTimeline();
                break;

            case 'hero_died':
                this.killSprite(event.source!);
                this.drawTimeline();
                break;

            case 'combat_won':
                this.showCombatResult('won');
                EventBus.emit('combat:won');
                break;

            case 'combat_lost':
                this.showCombatResult('lost');
                EventBus.emit('combat:lost');
                break;

            case 'combat_timeout':
                this.showCombatResult('timeout');
                EventBus.emit('combat:timeout');
                break;
        }
    }

    private cellToPixel(col: number, row: number): { x: number; y: number } {
        return {
            x: this.GRID_OFFSET_X + col * this.CELL_W + this.CELL_W / 2,
            y: this.GRID_OFFSET_Y + row * this.CELL_H + this.CELL_H / 2,
        };
    }

    private drawPreparationUI(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        // Overlay sombre sur la zone de combat
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.35);
        overlay.fillRect(0, 0, W, H);
        overlay.setDepth(10);

        // Texte "Préparez-vous"
        const title = this.add.text(W / 2, H * 0.35, 'Préparez-vous !', {
            fontSize: '28px',
            color: '#f0e060',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(11);

        // Sous-titre
        const sub = this.add.text(W / 2, H * 0.35 + 44, 'Placez votre équipe et lancez le combat', {
            fontSize: '14px',
            color: '#aaaacc',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setDepth(11);

        // Bouton Combattre
        const btnW = 220, btnH = 52;
        const btnX = W / 2 - btnW / 2;
        const btnY = H * 0.35 + 100;

        const btnBg = this.add.graphics().setDepth(11);
        btnBg.fillStyle(0xd4b820);
        btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 26);
        btnBg.lineStyle(2, 0xffffff, 0.3);
        btnBg.strokeRoundedRect(btnX + 2, btnY + 2, btnW - 4, btnH - 4, 24);

        const btnText = this.add.text(W / 2, btnY + btnH / 2, '⚔️ Combattre', {
            fontSize: '20px',
            color: '#1a1a00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 1,
        }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

        // Hover
        btnText.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0xffe040);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 26);
        });
        btnText.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0xd4b820);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 26);
        });

        // Clic — lance le combat
        btnText.on('pointerdown', () => {
            this.startCombat([overlay, title, sub, btnBg, btnText]);
        });
    }

    private startCombat(uiElements: Phaser.GameObjects.GameObject[]): void {
        this.phase = 'combat';

        // Fade out de l'overlay de préparation
        this.tweens.add({
            targets: uiElements,
            alpha: 0,
            duration: 300,
            onComplete: () => uiElements.forEach(e => e.destroy()),
        });

        // Lance le combat
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

        // Ligne de base
        const line = this.add.graphics();
        line.lineStyle(1, 0x334433, 0.5);
        line.lineBetween(startX - 10, Y, startX + totalW + 10, Y);
        elements.push(line);

        queue.forEach((unit, i) => {
            const x = startX + i * SPACING;
            const isActive = i === current;
            const color = unit.isHero ? 0x3b8bd4 : 0xe24b4a;
            const glow = unit.isHero ? 0x4488ff : 0xff4422;

            // Glow sur l'unité active
            if (isActive) {
                const glowCircle = this.add.circle(x, Y, ICON_SIZE / 2 + 6, glow, 0.25);
                elements.push(glowCircle);
            }

            // Cercle unité
            const circle = this.add.circle(x, Y, ICON_SIZE / 2,
                isActive ? 0xf0c020 : color,
                isActive ? 1 : 0.75
            );
            elements.push(circle);

            // Initiale
            const label = this.add.text(x, Y, unit.id[0].toUpperCase(), {
                fontSize: isActive ? '14px' : '12px',
                color: isActive ? '#1a1a00' : '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            elements.push(label);

            // Flèche "actif" au-dessus
            if (isActive) {
                const arrow = this.add.triangle(
                    x, Y - ICON_SIZE / 2 - 8,
                    -6, 0, 6, 0, 0, -8,
                    0xf0c020
                );
                elements.push(arrow);
            }

            // Speed en dessous
            const spd = this.add.text(x, Y + ICON_SIZE / 2 + 6, `${unit.speed}`, {
                fontSize: '9px', color: '#667766',
            }).setOrigin(0.5);
            elements.push(spd);
        });

        this.timelineContainer = this.add.container(0, 0, elements);
        this.timelineContainer.setDepth(20);
    }

    private drawRounds(): void {
        const W = this.scale.width;

        this.roundText = this.add.text(W / 4, 38, `Round 1 / ${this.maxRounds}`, {
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20);
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

        // Overlay
        const overlay = this.add.graphics().setDepth(30);
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, W, H);

        // Panel résultat
        const panelW = 320, panelH = 160;
        const panel = this.add.graphics().setDepth(31);
        panel.fillStyle(0x0a0a0a, 0.95);
        panel.fillRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);
        panel.lineStyle(2, cfg.color, 0.8);
        panel.strokeRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 16);

        // Texte
        this.add.text(W / 2, H / 2 - 30, cfg.text, {
            fontSize: '26px', color: '#' + cfg.color.toString(16).padStart(6, '0'),
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(32);

        this.add.text(W / 2, H / 2 + 10, cfg.sub, {
            fontSize: '14px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(32);

        // Bouton rejouer
        this.add.text(W / 2, H / 2 + 55, '↺ Rejouer', {
            fontSize: '16px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(32)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.combatSystem.stop();
                this.scene.restart();
            });
    }

    private showFloatingTextAt(
        x: number, y: number, value: number, isHeal: boolean, offsetX = 0
    ): void {
        const color = isHeal ? '#44ff88' : '#eedba7';
        const strokeColor = '#000000';
        const prefix = isHeal ? '+' : '';

        const text = this.add.text(
            x + 24 + offsetX,
            y - 50,
            `${prefix}${value}`,
            {
                fontSize: '20px',
                fontStyle: 'italic',
                fontFamily: 'Arial Black, Arial, sans-serif',
                color,
                stroke: strokeColor,
                strokeThickness: 5,
                padding: { left: 10, right: 20, top: 5, bottom: 5 }, // ✅ espace pour l'italique
            }
        ).setDepth(50)
            .setOrigin(0.5)
            .setAngle(-8);

        this.tweens.add({
            targets: text,
            scaleX: { from: 0.6, to: 1 },
            scaleY: { from: 0.6, to: 1 },
            duration: 100,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: text,
                    y: text.y - 60,
                    alpha: { from: 1, to: 0 },
                    duration: 900,
                    delay: 150,
                    ease: 'Sine.easeIn',
                    onComplete: () => text.destroy(),
                });
            }
        });
    }

    // Garde l'ancienne en wrapper pour les autres appels (hero_attack, enemy_attack)
    private showFloatingText(unitId: string, value: number, isHeal: boolean, offsetX = 0): void {
        const container = this.unitSprites.get(unitId);
        if (!container) return;
        this.showFloatingTextAt(container.x, container.y, value, isHeal, offsetX);
    }

    private drawSkillBar(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        const slotW = 56;
        const rowGap = 8;
        const heroGap = 16;

        let currentY = H - 100;

        // Une rangée par héros, du bas vers le haut
        for (let h = this.heroes.length - 1; h >= 0; h--) {
            const hero = this.heroes[h];
            const skills = hero.skills;

            const totalW = skills.length * slotW + (skills.length - 1) * rowGap;
            const startX = (W - totalW) / 2;

            // Label du héros à gauche de sa rangée
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
                    fontSize: '18px',
                    color: '#ffffff',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5).setDepth(18);

                // ✅ clé unique par héros + skill, sinon collision si 2 héros ont un skill au même id
                this.skillSlots.set(`${hero.data.id}_${skill.data.id}`, {
                    bg, icon, cooldownOverlay, cooldownText,
                    x: sx, y: sy, w: slotW
                });
            }

            currentY -= (slotW + heroGap); // remonte pour la rangée du héros suivant
        }

        for (const hero of this.heroes) {
            this.updateSkillCooldowns(hero);
        }
    }

    private updateSkillCooldowns(hero: Hero, onlySkillId?: string): void {
        if (!hero.isAlive()) return;

        for (const skill of hero.skills) {
            if (onlySkillId && skill.data.id !== onlySkillId) continue; // ✅ skip les autres

            const key = `${hero.data.id}_${skill.data.id}`;
            const slot = this.skillSlots.get(key);
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


}