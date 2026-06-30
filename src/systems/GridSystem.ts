import { AoeShape } from '../entities/Skill';

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

export class GridSystem {
  readonly cols: number;
  readonly rows: number;
  private units: Map<string, GridUnit> = new Map();

  constructor(cols = 6, rows = 4) {
    this.cols = cols;
    this.rows = rows;
  }

  addUnit(unit: GridUnit): void { this.units.set(unit.id, unit); }
  removeUnit(id: string): void { this.units.delete(id); }
  getUnit(id: string): GridUnit | undefined { return this.units.get(id); }
  getAllUnits(): GridUnit[] { return Array.from(this.units.values()); }

  distance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  isInBounds(pos: GridPosition): boolean {
    return pos.col >= 0 && pos.col < this.cols &&
      pos.row >= 0 && pos.row < this.rows;
  }

  // Une case est libre si personne n'y est — camp indifférent
  isCellFree(pos: GridPosition): boolean {
    if (!this.isInBounds(pos)) return false;
    for (const unit of this.units.values()) {
      if (unit.pos.col === pos.col && unit.pos.row === pos.row) return false;
    }
    return true;
  }

  // Cases atteignables — pas de restriction de zone
  getReachableCells(unit: GridUnit): GridPosition[] {
    const result: GridPosition[] = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const target = { col: c, row: r };
        if (
          this.distance(unit.pos, target) <= unit.moveRange &&
          this.isCellFree(target)
        ) {
          result.push(target);
        }
      }
    }
    return result;
  }

  // Cibles adverses à portée — camp opposé uniquement
  getTargetsInRange(unit: GridUnit): GridUnit[] {
    return Array.from(this.units.values()).filter(other =>
      other.id !== unit.id &&
      other.isHero !== unit.isHero &&
      this.distance(unit.pos, other.pos) <= 1
    );
  }

  // IA : avance vers la cible adverse la plus proche
  moveTowardNearest(unit: GridUnit): GridPosition | null {
    const targets = Array.from(this.units.values())
      .filter(u => u.isHero !== unit.isHero);

    if (targets.length === 0) return null;

    const nearest = targets.reduce((best, t) =>
      this.distance(unit.pos, t.pos) < this.distance(unit.pos, best.pos) ? t : best
    );

    const reachable = this.getReachableCells(unit);
    if (reachable.length === 0) return null;

    const best = reachable.reduce((bestCell, cell) =>
      this.distance(cell, nearest.pos) < this.distance(bestCell, nearest.pos)
        ? cell : bestCell
    );

    unit.pos = best;
    return best;
  }

  // Déplacement manuel (input joueur futur)
  moveUnit(unit: GridUnit, target: GridPosition): boolean {
    const reachable = this.getReachableCells(unit);
    const canMove = reachable.some(c => c.col === target.col && c.row === target.row);
    if (canMove) { unit.pos = target; return true; }
    return false;
  }

  // Retourne les unités adverses à portée d'un skill spécifique
  getTargetsInSkillRange(unit: GridUnit, range: number): GridUnit[] {
    return Array.from(this.units.values()).filter(other =>
      other.id !== unit.id &&
      other.isHero !== unit.isHero &&
      this.distance(unit.pos, other.pos) <= range
    );
  }

  getAoeCells(origin: GridPosition, aoe: AoeShape): GridPosition[] {
    const cells: GridPosition[] = [];

    switch (aoe.type) {
      case 'radius': {
        const r = aoe.value ?? 1;
        for (let c = 0; c < this.cols; c++) {
          for (let row = 0; row < this.rows; row++) {
            if (this.distance(origin, { col: c, row }) <= r) {
              cells.push({ col: c, row });
            }
          }
        }
        break;
      }

      case 'square': {
        // ✅ Carré de (value*2+1) x (value*2+1) centré sur l'origine
        const r = aoe.value ?? 1;
        for (let dc = -r; dc <= r; dc++) {
          for (let dr = -r; dr <= r; dr++) {
            cells.push({ col: origin.col + dc, row: origin.row + dr });
          }
        }
        break;
      }

      case 'line': {
        const len = aoe.value ?? 2;
        for (let i = 1; i <= len; i++) {
          cells.push({ col: origin.col + i, row: origin.row });
          cells.push({ col: origin.col - i, row: origin.row });
        }
        break;
      }

      case 'cross': {
        const r = aoe.value ?? 1;
        for (let i = 1; i <= r; i++) {
          cells.push({ col: origin.col + i, row: origin.row });
          cells.push({ col: origin.col - i, row: origin.row });
          cells.push({ col: origin.col, row: origin.row + i });
          cells.push({ col: origin.col, row: origin.row - i });
        }
        break;
      }

      case 'all':
        for (let c = 0; c < this.cols; c++) {
          for (let row = 0; row < this.rows; row++) {
            cells.push({ col: c, row });
          }
        }
        break;
    }

    return cells.filter(c => this.isInBounds(c));
  }

  getAoeTargets(casterUnit: GridUnit, skill: import('../entities/Skill').SkillData): GridUnit[] {
    if (skill.targetType === 'all') {
      // ✅ range: 0 sur 'all' = s'applique depuis la position du caster sans contrainte de range
      return Array.from(this.units.values()).filter(u => u.isHero !== casterUnit.isHero);
    }

    if (skill.targetType === 'aoe' && skill.aoe) {
      // ✅ range: 0 = l'AOE s'applique autour du caster lui-même sans condition de proximité d'ennemi
      const origin = skill.range === 0
        ? casterUnit.pos                                           // centré sur le caster
        : this.getTargetsInSkillRange(casterUnit, skill.range)[0]?.pos ?? casterUnit.pos; // centré sur la première cible en range

      const aoeCells = this.getAoeCells(origin, skill.aoe);
      return Array.from(this.units.values()).filter(u =>
        u.isHero !== casterUnit.isHero &&
        aoeCells.some(c => c.col === u.pos.col && c.row === u.pos.row)
      );
    }

    // single
    return this.getTargetsInSkillRange(casterUnit, skill.range).slice(0, 1);
  }

  // Dans GridSystem, ajoute cette méthode utilitaire :
  hasAnyTargetInRange(unit: GridUnit, range: number): boolean {
    return this.getTargetsInSkillRange(unit, range).length > 0;
  }
}