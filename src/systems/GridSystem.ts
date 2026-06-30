export interface GridPosition {
  col: number;
  row: number;
}

export interface GridUnit {
  id: string;
  pos: GridPosition;
  isHero: boolean;
  moveRange: number;
  attackRange: number;
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
      this.distance(unit.pos, other.pos) <= unit.attackRange
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
}