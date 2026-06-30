import Phaser from 'phaser';

export const UNIT_SPRITES = {
  sword:  { key: 'sword',  path: 'assets/sprites/warrior',  frameCount: { idle: 8, walk: 6, attack: 4 } },
  staff:  { key: 'staff',  path: 'assets/sprites/heal',  frameCount: { idle: 6, walk: 4, attack: 11 } },
  goblin: { key: 'goblin', path: 'assets/sprites/pawn', frameCount: { idle: 8, walk: 6, attack: 4 } },
  boss:   { key: 'boss',   path: 'assets/sprites/pawn',   frameCount: { idle: 8, walk: 6, attack: 4 } },
} as const;

export type UnitSpriteKey = keyof typeof UNIT_SPRITES;
export type AnimType = 'idle' | 'walk' | 'attack';

const FRAME_W = 192;
const FRAME_H = 192;

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Barre de chargement
    const bar = this.add.rectangle(W/2 - 150, H/2, 0, 12, 0xf0c020).setOrigin(0, 0.5);
    this.add.rectangle(W/2, H/2, 304, 16, 0x222222).setOrigin(0.5);
    const label = this.add.text(W/2, H/2 + 24, '', {
      fontSize: '14px', color: '#aaaaaa'
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      bar.width = 300 * v;
      label.setText(`Chargement... ${Math.floor(v * 100)}%`);
    });

    // Charge les 3 animations pour chaque unité
    for (const [key, def] of Object.entries(UNIT_SPRITES)) {
      for (const anim of ['idle', 'walk', 'attack'] as AnimType[]) {
        this.load.spritesheet(`${key}_${anim}`, `${def.path}_${anim}.png`, {
          frameWidth:  FRAME_W,
          frameHeight: FRAME_H,
        });
      }
    }

    // Tileset terrain
    this.load.spritesheet('tileset_green', 'assets/sprites/Tilemap_color1.png', {
      frameWidth: 64, frameHeight: 64,
    });
  }

  create(): void {
    // Crée toutes les animations pour chaque unité
    for (const [key, def] of Object.entries(UNIT_SPRITES)) {
      for (const anim of ['idle', 'walk', 'attack'] as AnimType[]) {
        const animKey = `${key}_${anim}`;
        if (this.anims.exists(animKey)) continue;

        const frameCount = def.frameCount[anim as AnimType];

        this.anims.create({
          key: animKey,
          frames:    this.anims.generateFrameNumbers(animKey, {
            start: 0, end: frameCount - 1,
          }),
          frameRate: 10,
          repeat:    anim === 'idle' || anim === 'walk' ? -1 : 0, // attack joue une seule fois
        });
      }
    }

    this.scene.start('CombatScene');
  }
}