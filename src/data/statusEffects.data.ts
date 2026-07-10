import { StatusEffectDefinition } from '../types/game.types';

export const STATUS_EFFECTS: StatusEffectDefinition[] = [
  {
    id:            'stun',
    name:          'Stun',
    type:          'stun',
    polarity:      'negative',
    stackable:     false,
    durationTurns: 1,
    tickTiming:    'turn_end',
  },
];

export const STATUS_EFFECTS_BY_ID = Object.fromEntries(
  STATUS_EFFECTS.map(e => [e.id, e])
) as Record<string, StatusEffectDefinition>;