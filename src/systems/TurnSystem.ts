import { Hero } from '../entities/Hero';
import { Enemy } from '../entities/Enemy';

export interface TurnUnit {
  id: string;
  isHero: boolean;
  speed: number;
  isAlive: () => boolean;
}

export class TurnSystem {
  private queue: TurnUnit[] = [];
  private currentIndex = 0;
  public  round = 0;

  constructor(heroes: Hero[], enemies: Enemy[]) {
    this.buildQueue(heroes, enemies);
  }

  private buildQueue(heroes: Hero[], enemies: Enemy[]): void {
    const all: TurnUnit[] = [
      ...heroes.map(h => ({
        id:      h.data.id,
        isHero:  true,
        speed:   h.data.speed,
        isAlive: () => h.isAlive(),
      })),
      ...enemies.map(e => ({
        id:      e.data.id,
        isHero:  false,
        speed:   e.data.speed,
        isAlive: () => e.isAlive(),
      })),
    ];

    // Tri décroissant par speed
    // Égalité : héros avant ennemis, puis par id alphabétique
    this.queue = all.sort((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      if (a.isHero !== b.isHero) return a.isHero ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    this.currentIndex = 0;
  }

  // Retire les morts et réajuste l'index
  removeUnit(id: string): void {
    const idx = this.queue.findIndex(u => u.id === id);
    if (idx === -1) return;
    this.queue.splice(idx, 1);
    // Si on a retiré une unité avant ou à l'index courant, on recule
    if (idx <= this.currentIndex) this.currentIndex--;
  }

  // Passe au prochain tour, gère le rebouclage
  next(): TurnUnit | null {
    // Avance en sautant les morts (sécurité)
    let attempts = 0;
    do {
      this.currentIndex++;
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = 0;
        this.round++;
      }
      attempts++;
    } while (
      this.queue.length > 0 &&
      !this.queue[this.currentIndex]?.isAlive() &&
      attempts < this.queue.length
    );

    return this.queue[this.currentIndex] ?? null;
  }

  current(): TurnUnit | null {
    return this.queue[this.currentIndex] ?? null;
  }

  // Retourne la queue complète pour la timeline UI
  getQueue(): TurnUnit[] {
    return this.queue;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
}