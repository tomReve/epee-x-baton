import { AnimType } from '../scenes/BootScene';

export class UnitAnimator {
  private sprite: Phaser.GameObjects.Sprite;
  private spriteKey: string;
  private currentAnim: AnimType = 'idle';

  constructor(sprite: Phaser.GameObjects.Sprite, spriteKey: string) {
    this.sprite    = sprite;
    this.spriteKey = spriteKey;
  }

  play(anim: AnimType): void {
    if (this.currentAnim === anim) return;
    this.currentAnim = anim;
    const key = `${this.spriteKey}_${anim}`;

    this.sprite.play(key);

    // Attack et hurt reviennent à idle automatiquement à la fin
    if (anim === 'attack') {
      this.sprite.once('animationcomplete', () => {
        this.currentAnim = 'idle';
        this.sprite.play(`${this.spriteKey}_idle`);
      });
    }
  }

  // Joue walk puis revient à idle après une durée (ms)
  playWalk(duration: number): void {
    this.play('walk');
    setTimeout(() => {
      if (this.currentAnim === 'walk') this.play('idle');
    }, duration);
  }

  getCurrent(): AnimType { return this.currentAnim; }
}