import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

// Exemples d'events :
// EventBus.emit('combat:start', { enemies, zone })
// EventBus.emit('hero:levelup', { hero, newLevel })
// EventBus.emit('resources:update', { gold, xp })