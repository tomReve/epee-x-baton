import Phaser from 'phaser';
import { CombatScene } from './scenes/CombatScene';
import { BootScene } from './scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  scene: [BootScene,CombatScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  }
};

new Phaser.Game(config);