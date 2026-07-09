import { describe, it, expect } from 'vitest';
import { TurnSystem } from '../../src/systems/TurnSystem';
import { Enemy } from '../../src/entities/Enemy';
import { makeHero, makeEnemy } from '../helpers/factories';

describe('TurnSystem — construction de la queue', () => {
  it('trie par speed décroissante', () => {
    const heroes = [makeHero('h1', 1000)];
    const enemies = [makeEnemy('e1', 2000), makeEnemy('e2', 1500)];
    const turns = new TurnSystem(heroes, enemies);

    const ids = turns.getQueue().map(u => u.id);
    expect(ids).toEqual(['e1', 'e2', 'h1']);
  });

  it('égalité de speed : héros avant ennemis', () => {
    const heroes = [makeHero('h1', 1000)];
    const enemies = [makeEnemy('e1', 1000)];
    const turns = new TurnSystem(heroes, enemies);

    const ids = turns.getQueue().map(u => u.id);
    expect(ids).toEqual(['h1', 'e1']);
  });

  it('égalité de speed et de camp : tri alphabétique par id', () => {
    const heroes = [makeHero('warrior', 1000), makeHero('archer', 1000)];
    const enemies: Enemy[] = [];
    const turns = new TurnSystem(heroes, enemies);

    const ids = turns.getQueue().map(u => u.id);
    expect(ids).toEqual(['archer', 'warrior']);
  });

  it('currentIndex démarre à 0', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    expect(turns.getCurrentIndex()).toBe(0);
  });
});

describe('TurnSystem — current()', () => {
  it('retourne l’unité à currentIndex', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    expect(turns.current()?.id).toBe('e1');
  });

  it('retourne null si la queue est vide', () => {
    const turns = new TurnSystem([], []);
    expect(turns.current()).toBeNull();
  });
});

describe('TurnSystem — next()', () => {
  it('avance au prochain élément de la queue', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    // queue: e1, h1
    const next = turns.next();
    expect(next?.id).toBe('h1');
    expect(turns.getCurrentIndex()).toBe(1);
  });

  it('rebouclage : incrémente round et repart à l’index 0', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    // queue: e1(0), h1(1)
    turns.next(); // -> h1, index 1
    const back = turns.next(); // -> reboucle, index 0
    expect(back?.id).toBe('e1');
    expect(turns.getCurrentIndex()).toBe(0);
    expect(turns.round).toBe(1);
  });

  it('saute les unités mortes', () => {
    const heroes = [makeHero('h1', 1000)];
    const enemies = [makeEnemy('e1', 2000), makeEnemy('e2', 1500, false)];
    const turns = new TurnSystem(heroes, enemies);
    // queue: e1(0), e2(1, dead), h1(2)

    const next = turns.next();
    expect(next?.id).toBe('h1');
    expect(turns.getCurrentIndex()).toBe(2);
  });

  it('round n’incrémente qu’une fois même en sautant plusieurs unités mortes en fin de queue', () => {
    const heroes = [makeHero('h1', 1000, false)];
    const enemies = [makeEnemy('e1', 2000), makeEnemy('e2', 1500, false)];
    const turns = new TurnSystem(heroes, enemies);
    // queue: e1(0, alive), e2(1, dead), h1(2, dead)

    const next = turns.next(); // e1 -> e2(dead) -> h1(dead) -> reboucle -> e1
    expect(next?.id).toBe('e1');
    expect(turns.round).toBe(1);
  });
});

describe('TurnSystem — removeUnit()', () => {
  it('retire l’unité de la queue', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    turns.removeUnit('e1');
    expect(turns.getQueue().map(u => u.id)).toEqual(['h1']);
  });

  it('décrémente currentIndex si l’unité retirée est avant ou à l’index courant', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000)]);
    // queue: e1(0), h1(1)
    turns.next(); // currentIndex = 1 (h1)
    turns.removeUnit('e1'); // retire index 0, <= currentIndex
    expect(turns.getCurrentIndex()).toBe(0);
    expect(turns.current()?.id).toBe('h1');
  });

  it('ne modifie pas currentIndex si l’unité retirée est après', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], [makeEnemy('e1', 2000), makeEnemy('e2', 1500)]);
    // queue: e1(0), e2(1), h1(2)
    turns.removeUnit('h1'); // index 2, > currentIndex 0
    expect(turns.getCurrentIndex()).toBe(0);
    expect(turns.current()?.id).toBe('e1');
  });

  it('ignore silencieusement un id inexistant', () => {
    const turns = new TurnSystem([makeHero('h1', 1000)], []);
    expect(() => turns.removeUnit('inconnu')).not.toThrow();
    expect(turns.getQueue().length).toBe(1);
  });
});