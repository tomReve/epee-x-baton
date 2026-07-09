import { describe, it, expect, beforeEach } from 'vitest';
import { GridSystem } from '../../src/systems/GridSystem';
import { makeUnit, makeSkill } from '../helpers/factories';

describe('GridSystem — géométrie de base', () => {
  let grid: GridSystem;

  beforeEach(() => {
    grid = new GridSystem(8, 6);
  });

  it('calcule la distance de Manhattan', () => {
    expect(grid.distance({ col: 0, row: 0 }, { col: 3, row: 4 })).toBe(7);
    expect(grid.distance({ col: 2, row: 2 }, { col: 2, row: 2 })).toBe(0);
  });

  it('détecte les positions hors limites', () => {
    expect(grid.isInBounds({ col: 0, row: 0 })).toBe(true);
    expect(grid.isInBounds({ col: 8, row: 0 })).toBe(false);
    expect(grid.isInBounds({ col: -1, row: 0 })).toBe(false);
    expect(grid.isInBounds({ col: 0, row: 6 })).toBe(false);
  });

  it('une case libre devient occupée après addUnit', () => {
    const pos = { col: 2, row: 2 };
    expect(grid.isCellFree(pos)).toBe(true);
    grid.addUnit(makeUnit('u1', 2, 2, true));
    expect(grid.isCellFree(pos)).toBe(false);
  });

  it('removeUnit libère la case', () => {
    grid.addUnit(makeUnit('u1', 2, 2, true));
    grid.removeUnit('u1');
    expect(grid.isCellFree({ col: 2, row: 2 })).toBe(true);
    expect(grid.getUnit('u1')).toBeUndefined();
  });
});

describe('GridSystem — déplacement', () => {
  let grid: GridSystem;

  beforeEach(() => {
    grid = new GridSystem(8, 6);
  });

  it('getReachableCells respecte moveRange', () => {
    const unit = makeUnit('u1', 4, 3, true, 2);
    grid.addUnit(unit);
    const cells = grid.getReachableCells(unit);
    for (const c of cells) {
      expect(grid.distance(unit.pos, c)).toBeLessThanOrEqual(2);
    }
    // toutes les cases à distance <= 2 dans une grille 8x6 sans obstacle
    expect(cells.length).toBeGreaterThan(0);
  });

  it('getReachableCells respecte un maxDistance plus restrictif que moveRange', () => {
    const unit = makeUnit('u1', 4, 3, true, 4);
    grid.addUnit(unit);
    const cells = grid.getReachableCells(unit, 1);
    for (const c of cells) {
      expect(grid.distance(unit.pos, c)).toBeLessThanOrEqual(1);
    }
  });

  it('getReachableCells exclut les cases occupées', () => {
    const unit = makeUnit('u1', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('blocker', 1, 0, false));
    const cells = grid.getReachableCells(unit);
    expect(cells.some(c => c.col === 1 && c.row === 0)).toBe(false);
  });

  it('moveTowardNearest rapproche de l\'ennemi le plus proche', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('enemy', 5, 0, false));

    const result = grid.moveTowardNearest(unit);
    expect(result).not.toBeNull();
    expect(grid.distance(unit.pos, { col: 5, row: 0 })).toBeLessThan(5);
  });

  it('moveTowardNearest retourne null si aucun ennemi', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    expect(grid.moveTowardNearest(unit)).toBeNull();
  });

  it('moveTowardNearest respecte maxDistance (budget de mouvement)', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('enemy', 5, 0, false));

    const result = grid.moveTowardNearest(unit, 1);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeLessThanOrEqual(1);
  });

  it('moveTowardTargetIfReachable positionne l\'unité à portée de la cible', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('target', 5, 0, false));

    const result = grid.moveTowardTargetIfReachable(unit, { col: 5, row: 0 }, 2, 4);
    expect(result).not.toBeNull();
    expect(grid.distance(unit.pos, { col: 5, row: 0 })).toBeLessThanOrEqual(2);
  });

  it('moveTowardTargetIfReachable retourne null si la cible reste hors de portée après déplacement max', () => {
    const unit = makeUnit('hero', 0, 0, true, 1);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('target', 10, 0, false));

    const result = grid.moveTowardTargetIfReachable(unit, { col: 10, row: 0 }, 1, 1);
    expect(result).toBeNull();
  });

  it('moveTowardTargetIfReachable choisit la case la plus proche du point de départ (pas de la cible)', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    // cible loin, range large : plusieurs cases satisfont la range, doit prendre la plus proche du départ
    const result = grid.moveTowardTargetIfReachable(unit, { col: 6, row: 0 }, 5, 4);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeLessThanOrEqual(1);
  });
});

describe('GridSystem — ciblage single/aoe/all', () => {
  let grid: GridSystem;

  beforeEach(() => {
    grid = new GridSystem(8, 6);
  });

  it('getTargetsInSkillRange filtre par camp ennemi', () => {
    const caster = makeUnit('hero', 0, 0, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('enemy1', 1, 0, false));
    grid.addUnit(makeUnit('ally1', 0, 1, true));

    const targets = grid.getTargetsInSkillRange(caster, 3, 'enemy', false);
    expect(targets.map(t => t.id)).toEqual(['enemy1']);
  });

  it('getTargetsInSkillRange avec side=ally et includeSelf inclut le caster', () => {
    const caster = makeUnit('monk', 0, 0, true);
    grid.addUnit(caster);
    const targets = grid.getTargetsInSkillRange(caster, 3, 'ally', true);
    expect(targets.map(t => t.id)).toContain('monk');
  });

  it('getTargetsInSkillRange exclut le caster si includeSelf=false', () => {
    const caster = makeUnit('monk', 0, 0, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('warrior', 0, 1, true));
    const targets = grid.getTargetsInSkillRange(caster, 3, 'ally', false);
    expect(targets.map(t => t.id)).not.toContain('monk');
    expect(targets.map(t => t.id)).toContain('warrior');
  });

  it('getAoeCells radius couvre les cases dans le rayon Manhattan', () => {
    const cells = grid.getAoeCells({ col: 3, row: 3 }, { type: 'radius', value: 1 });
    expect(cells).toContainEqual({ col: 3, row: 3 });
    expect(cells).toContainEqual({ col: 4, row: 3 });
    expect(cells).not.toContainEqual({ col: 5, row: 3 });
  });

  it('getAoeCells square couvre un carré complet', () => {
    const cells = grid.getAoeCells({ col: 3, row: 3 }, { type: 'square', value: 1 });
    expect(cells).toContainEqual({ col: 2, row: 2 });
    expect(cells).toContainEqual({ col: 4, row: 4 });
    expect(cells.length).toBe(9);
  });

  it('getAoeCells cross couvre les 4 directions + origine', () => {
    const cells = grid.getAoeCells({ col: 3, row: 3 }, { type: 'cross', value: 2 });
    expect(cells).toContainEqual({ col: 3, row: 3 });
    expect(cells).toContainEqual({ col: 5, row: 3 });
    expect(cells).toContainEqual({ col: 3, row: 1 });
    expect(cells).not.toContainEqual({ col: 4, row: 4 });
  });

  it('getAoeCells line couvre une ligne horizontale des deux côtés', () => {
    const cells = grid.getAoeCells({ col: 3, row: 3 }, { type: 'line', value: 2 });
    expect(cells).toContainEqual({ col: 1, row: 3 });
    expect(cells).toContainEqual({ col: 5, row: 3 });
    expect(cells).not.toContainEqual({ col: 3, row: 2 });
  });

  it('getAoeCells all couvre toute la grille', () => {
    const cells = grid.getAoeCells({ col: 0, row: 0 }, { type: 'all' });
    expect(cells.length).toBe(8 * 6);
  });

  it('getAoeCells filtre les cases hors limites', () => {
    const cells = grid.getAoeCells({ col: 0, row: 0 }, { type: 'square', value: 2 });
    expect(cells.every(c => grid.isInBounds(c))).toBe(true);
  });

  it('getAoeTargets single retourne toutes les cibles en range (pas de coupe à 1)', () => {
    const caster = makeUnit('hero', 0, 0, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('e1', 1, 0, false));
    grid.addUnit(makeUnit('e2', 0, 1, false));

    const targets = grid.getAoeTargets(caster, makeSkill({ targetType: 'single', range: 3 }));
    expect(targets.length).toBe(2);
  });

  it('getAoeTargets aoe centre la zone sur la première cible ennemie en range', () => {
    const caster = makeUnit('hero', 0, 0, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('e1', 3, 0, false));
    grid.addUnit(makeUnit('e2', 3, 1, false));

    const skill = makeSkill({ targetType: 'aoe', range: 5, aoe: { type: 'radius', value: 1 } });
    const targets = grid.getAoeTargets(caster, skill);
    expect(targets.map(t => t.id)).toContain('e1');
  });

  it('getAoeTargets aoe avec range=0 centre sur le caster', () => {
    const caster = makeUnit('hero', 3, 3, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('e1', 4, 3, false));
    grid.addUnit(makeUnit('e2', 0, 0, false));

    const skill = makeSkill({ targetType: 'aoe', range: 0, aoe: { type: 'radius', value: 1 } });
    const targets = grid.getAoeTargets(caster, skill);
    expect(targets.map(t => t.id)).toEqual(['e1']);
  });

  it('getAoeTargets ally sur aoe force l\'origine sur le caster (inclut le caster si dans la zone)', () => {
    const caster = makeUnit('monk', 3, 3, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('ally', 3, 4, true));
    grid.addUnit(makeUnit('enemy', 3, 3 + 10, false));

    const skill = makeSkill({ targetType: 'aoe', targetSide: 'ally', range: 0, aoe: { type: 'radius', value: 1 } });
    const targets = grid.getAoeTargets(caster, skill);
    const ids = targets.map(t => t.id);
    expect(ids).toContain('monk');
    expect(ids).toContain('ally');
  });

  it('getAoeTargets all retourne tous les ennemis vivants sans contrainte de range', () => {
    const caster = makeUnit('hero', 0, 0, true);
    grid.addUnit(caster);
    grid.addUnit(makeUnit('e1', 7, 5, false));

    const skill = makeSkill({ targetType: 'all', range: 0 });
    const targets = grid.getAoeTargets(caster, skill);
    expect(targets.map(t => t.id)).toEqual(['e1']);
  });
});

describe('GridSystem — findBestAoePosition (maximisation AOE)', () => {
  let grid: GridSystem;

  beforeEach(() => {
    grid = new GridSystem(8, 6);
  });

  it('retourne null si le skill n\'a pas d\'aoe', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    const result = grid.findBestAoePosition(unit, makeSkill({ targetType: 'single' }));
    expect(result).toBeNull();
  });

  it('trouve la case qui maximise le nombre de cibles pour range=0 (self-centered)', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    // 3 ennemis groupés serré à portée de mouvement, 1 ennemi isolé loin
    grid.addUnit(makeUnit('e1', 2, 1, false));
    grid.addUnit(makeUnit('e2', 3, 2, false));
    grid.addUnit(makeUnit('e3', 2 ,3, false));
    grid.addUnit(makeUnit('lonely', 7, 5, false));

    const skill = makeSkill({ targetType: 'aoe', range: 0, aoe: { type: 'radius', value: 1 } });
    const result = grid.findBestAoePosition(unit, skill, 4);
    expect(result).not.toBeNull();
    expect(result!.hitCount).toBeGreaterThanOrEqual(3);
  });

  it('en cas d\'égalité de hitCount, choisit la case la plus proche du départ', () => {
    const unit = makeUnit('hero', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('e1', 4, 0, false));

    const skill = makeSkill({ targetType: 'aoe', range: 0, aoe: { type: 'radius', value: 5 } });
    const result = grid.findBestAoePosition(unit, skill, 4);
    // la zone touche l'ennemi depuis n'importe quelle case atteignable → doit rester proche du départ
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(1);;
  });

  it('inclut le caster comme cible valide pour un heal de zone (includeSelf)', () => {
    const unit = makeUnit('monk', 0, 0, true, 4);
    grid.addUnit(unit);
    grid.addUnit(makeUnit('ally_far', 5, 5, true));

    const skill = makeSkill({
      targetType: 'aoe', targetSide: 'ally', range: 0, aoe: { type: 'radius', value: 1 }, damage: undefined, heal: 10,
    });
    const result = grid.findBestAoePosition(unit, skill, 4);
    expect(result).not.toBeNull();
    // le caster seul (sur sa case de départ) compte déjà comme 1 cible
    expect(result!.hitCount).toBeGreaterThanOrEqual(1);
  });
});