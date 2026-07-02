import { LevelDefinition } from '../types/game.types';
import levelsJson from './json/levels.json';

// ---------------------------------------------------------------------------
// levels.data.ts
//
// Pont TypeScript → JSON pour les définitions de niveaux.
// Le JSON est la source de données (éditable sans recompiler),
// ce module assure le typage fort et expose les fonctions d'accès.
// ---------------------------------------------------------------------------

export const LEVELS: LevelDefinition[] = levelsJson as LevelDefinition[];

export const LEVELS_BY_ID = Object.fromEntries(
  LEVELS.map(l => [l.id, l])
) as Record<string, LevelDefinition>;

/** Retourne les niveaux d'une zone triés par ordre de difficulté. */
export function getLevelsByZone(zone: string): LevelDefinition[] {
  return LEVELS
    .filter(l => l.zone === zone)
    .sort((a, b) => a.order - b.order);
}

/** Retourne le niveau suivant dans la progression globale. */
export function getNextLevel(currentLevelId: string): LevelDefinition | null {
  const current = LEVELS_BY_ID[currentLevelId];
  if (!current) return null;
  return LEVELS.find(l => l.order === current.order + 1) ?? null;
}
