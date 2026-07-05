import { SkillData, AoeShape } from '../entities/Skill';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridPosition {
  col: number;
  row: number;
}

export interface GridUnit {
  id: string;
  pos: GridPosition;
  isHero: boolean;
  moveRange: number;
}

// ---------------------------------------------------------------------------
// GridSystem
//
// Responsabilité : gestion pure de la grille (positions, déplacements, portées).
// Aucune dépendance vers Phaser ou les entités Hero/Enemy.
// ---------------------------------------------------------------------------

export class GridSystem {
  readonly cols: number;
  readonly rows: number;
  private units: Map<string, GridUnit> = new Map();

  constructor(cols = 6, rows = 4) {
    this.cols = cols;
    this.rows = rows;
  }

  // ---------------------------------------------------------------------------
  // CRUD unités
  // ---------------------------------------------------------------------------

  addUnit(unit: GridUnit): void {
    this.units.set(unit.id, unit);
  }

  removeUnit(id: string): void {
    this.units.delete(id);
  }

  getUnit(id: string): GridUnit | undefined {
    return this.units.get(id);
  }

  getAllUnits(): GridUnit[] {
    return Array.from(this.units.values());
  }

  // ---------------------------------------------------------------------------
  // Géométrie
  // ---------------------------------------------------------------------------

  /** Distance de Manhattan entre deux positions. */
  distance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  isInBounds(pos: GridPosition): boolean {
    return pos.col >= 0 && pos.col < this.cols
      && pos.row >= 0 && pos.row < this.rows;
  }

  isCellFree(pos: GridPosition): boolean {
    if (!this.isInBounds(pos)) return false;
    for (const unit of this.units.values()) {
      if (unit.pos.col === pos.col && unit.pos.row === pos.row) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Déplacement
  // ---------------------------------------------------------------------------

  /** Retourne toutes les cases atteignables par une unité. */
  getReachableCells(unit: GridUnit, maxDistance?: number): GridPosition[] {
    const range = maxDistance !== undefined ? Math.min(unit.moveRange, maxDistance) : unit.moveRange;
    const result: GridPosition[] = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const target = { col: c, row: r };
        if (this.distance(unit.pos, target) <= range && this.isCellFree(target)) {
          result.push(target);
        }
      }
    }
    return result;
  }

  /**
   * IA simple : avance vers l'ennemi le plus proche en choisissant
   * la case accessible la plus proche de lui.
   * maxDistance borne le déplacement (budget de mouvement restant sur le tour).
   * Retourne la case atteinte et la distance parcourue, ou null si aucun déplacement possible.
   */
  moveTowardNearest(unit: GridUnit, maxDistance?: number): { pos: GridPosition; distance: number } | null {
    const enemies = Array.from(this.units.values()).filter(u => u.isHero !== unit.isHero);
    if (enemies.length === 0) return null;

    const nearest = enemies.reduce((best, t) =>
      this.distance(unit.pos, t.pos) < this.distance(unit.pos, best.pos) ? t : best
    );

    const reachable = this.getReachableCells(unit, maxDistance);
    if (reachable.length === 0) return null;

    const best = reachable.reduce((bestCell, cell) =>
      this.distance(cell, nearest.pos) < this.distance(bestCell, nearest.pos) ? cell : bestCell
    );

    const dist = this.distance(unit.pos, best);
    unit.pos = best;
    return { pos: best, distance: dist };
  }

  /** Déplacement manuel vers une position spécifique (usage futur : input joueur). */
  moveUnit(unit: GridUnit, target: GridPosition): boolean {
    const reachable = this.getReachableCells(unit);
    if (!reachable.some(c => c.col === target.col && c.row === target.row)) return false;
    unit.pos = target;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Ciblage
  // ---------------------------------------------------------------------------

  /** Unités adverses dans un rayon de `range` cases. */
  getTargetsInSkillRange(unit: GridUnit, range: number): GridUnit[] {
    return Array.from(this.units.values()).filter(other =>
      other.id !== unit.id
      && other.isHero !== unit.isHero
      && this.distance(unit.pos, other.pos) <= range
    );
  }

  hasAnyTargetInSkillRange(unit: GridUnit, range: number): boolean {
    return this.getTargetsInSkillRange(unit, range).length > 0;
  }

  // ---------------------------------------------------------------------------
  // AOE
  // ---------------------------------------------------------------------------

  /**
   * Retourne toutes les cases couvertes par une forme AOE
   * centrée sur `origin`, filtrées pour ne garder que les cases dans les limites.
   */
  getAoeCells(origin: GridPosition, aoe: AoeShape): GridPosition[] {
    const cells: GridPosition[] = [];

    switch (aoe.type) {
      case 'radius': {
        const r = aoe.value ?? 1;
        for (let c = 0; c < this.cols; c++) {
          for (let row = 0; row < this.rows; row++) {
            if (this.distance(origin, { col: c, row }) <= r) cells.push({ col: c, row });
          }
        }
        break;
      }
      case 'square': {
        const r = aoe.value ?? 1;
        for (let dc = -r; dc <= r; dc++) {
          for (let dr = -r; dr <= r; dr++) {
            cells.push({ col: origin.col + dc, row: origin.row + dr });
          }
        }
        break;
      }
      case 'line': {
        cells.push(origin);
        const len = aoe.value ?? 2;
        for (let i = 1; i <= len; i++) {
          cells.push({ col: origin.col + i, row: origin.row });
          cells.push({ col: origin.col - i, row: origin.row });
        }
        break;
      }
      case 'cross': {
        cells.push(origin);
        const r = aoe.value ?? 1;
        for (let i = 1; i <= r; i++) {
          cells.push({ col: origin.col + i, row: origin.row });
          cells.push({ col: origin.col - i, row: origin.row });
          cells.push({ col: origin.col, row: origin.row + i });
          cells.push({ col: origin.col, row: origin.row - i });
        }
        break;
      }
      case 'all': {
        for (let c = 0; c < this.cols; c++) {
          for (let row = 0; row < this.rows; row++) cells.push({ col: c, row });
        }
        break;
      }
    }

    return cells.filter(c => this.isInBounds(c));
  }

  /**
   * Résout les unités touchées par un skill, selon son targetType et sa range.
   *
   * - `single` : première cible à portée `skill.range` ou soi-même pour les soins à range 0
   * - `aoe`    : toutes les unités dans la zone AOE (centrée sur la première cible ou sur le caster si range=0)
   * - `all`    : toutes les unités adverses vivantes, sans contrainte de range
   */
  getAoeTargets(casterUnit: GridUnit, skill: SkillData): GridUnit[] {
    if (skill.targetType === 'all') {
      return Array.from(this.units.values()).filter(u => u.isHero !== casterUnit.isHero);
    }

    if (skill.targetType === 'aoe' && skill.aoe) {
      const origin = skill.range === 0
        ? casterUnit.pos
        : this.getTargetsInSkillRange(casterUnit, skill.range)[0]?.pos ?? casterUnit.pos;

      const aoeCells = this.getAoeCells(origin, skill.aoe);
      return Array.from(this.units.values()).filter(u =>
        u.isHero !== casterUnit.isHero
        && aoeCells.some(c => c.col === u.pos.col && c.row === u.pos.row)
      );
    }

    if (skill.targetType === 'single') {
      if (skill.range === 0 && skill.type === 'support') {
        return [casterUnit];
      }
      return this.getTargetsInSkillRange(casterUnit, skill.range).slice(0, 1);
    }

    return [];
  }
}
