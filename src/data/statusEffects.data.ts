import { StatusEffectDefinition } from '../types/game.types';

// Catalogue vide pour l'instant — chaque effet concret (poison, stun, shield...)
// sera ajouté ici lors de sa propre feature dédiée.
export const STATUS_EFFECTS: StatusEffectDefinition[] = [];

export const STATUS_EFFECTS_BY_ID = Object.fromEntries(
  STATUS_EFFECTS.map(e => [e.id, e])
) as Record<string, StatusEffectDefinition>;