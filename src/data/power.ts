import { BaseStats, PowerRating, LevelDefinition, PlayerHeroState } from '../types/game.types';
import { HERO_DEFINITIONS_BY_ID } from './heroes.data';
import { ENEMY_DEFINITIONS_BY_ID } from './enemies.data';
import { SKILLS_BY_ID } from './skills.data';

// ---------------------------------------------------------------------------
// power.ts
//
// Calcul de la puissance d'une équipe (héros ou ennemis).
// Utilisé avant le combat pour afficher les chances de victoire du joueur.
//
// Formule de puissance :
//   power = hp * 0.4 + attack * 15 + defense * 10 + (2000 / speed) * 5
//
// Les coefficients sont volontairement simples et ajustables.
// La vitesse contribue inversement : plus elle est basse, plus le héros joue tôt.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  hp:      0.4,
  attack:  15,
  defense: 10,
  speed:   5,    // coefficient pour 2000/speed (plus bas = meilleur)
};

function computeStatsPower(stats: BaseStats): PowerRating {
  const hp      = stats.hp      * WEIGHTS.hp;
  const attack  = stats.attack  * WEIGHTS.attack;
  const defense = stats.defense * WEIGHTS.defense;
  const speed   = (2000 / stats.speed) * WEIGHTS.speed;

  return {
    total: Math.round(hp + attack + defense + speed),
    breakdown: {
      hp:      Math.round(hp),
      attack:  Math.round(attack),
      defense: Math.round(defense),
      speed:   Math.round(speed),
    },
  };
}

function mergeRatings(ratings: PowerRating[]): PowerRating {
  return ratings.reduce((acc, r) => ({
    total: acc.total + r.total,
    breakdown: {
      hp:      acc.breakdown.hp      + r.breakdown.hp,
      attack:  acc.breakdown.attack  + r.breakdown.attack,
      defense: acc.breakdown.defense + r.breakdown.defense,
      speed:   acc.breakdown.speed   + r.breakdown.speed,
    },
  }), { total: 0, breakdown: { hp: 0, attack: 0, defense: 0, speed: 0 } });
}

// ---------------------------------------------------------------------------
// Puissance des héros du joueur
// ---------------------------------------------------------------------------

/**
 * Calcule la puissance d'un héros en tenant compte de son niveau.
 * Les stats augmentent de 8% par niveau au-dessus du niveau 1.
 */
export function computeHeroPower(state: PlayerHeroState): PowerRating {
  const def = HERO_DEFINITIONS_BY_ID[state.heroId];
  if (!def) return { total: 0, breakdown: { hp: 0, attack: 0, defense: 0, speed: 0 } };

  const levelMultiplier = 1 + (state.level - 1) * 0.08;

  const scaledStats: BaseStats = {
    hp:      Math.round(def.baseStats.hp      * levelMultiplier),
    attack:  Math.round(def.baseStats.attack  * levelMultiplier),
    defense: Math.round(def.baseStats.defense * levelMultiplier),
    speed:   def.baseStats.speed, // la vitesse n'est pas affectée par le niveau
  };

  // Bonus de skills équipés (chaque skill actif ajoute un petit bonus)
  const skillBonus = state.equippedSkills.reduce((bonus, skillId) => {
    const skill = SKILLS_BY_ID[skillId];
    if (!skill) return bonus;
    return bonus + (skill.damage ?? 0) * 0.5 + (skill.heal ?? 0) * 0.3;
  }, 0);

  const base = computeStatsPower(scaledStats);
  return {
    total:     Math.round(base.total + skillBonus),
    breakdown: base.breakdown,
  };
}

/** Puissance totale de l'équipe de héros du joueur. */
export function computeTeamPower(heroStates: PlayerHeroState[]): PowerRating {
  return mergeRatings(heroStates.map(computeHeroPower));
}

// ---------------------------------------------------------------------------
// Puissance des ennemis d'un niveau
// ---------------------------------------------------------------------------

/** Calcule la puissance totale des ennemis d'un niveau donné. */
export function computeLevelPower(level: LevelDefinition): PowerRating {
  const ratings = level.enemySpawns.map(spawn => {
    const def = ENEMY_DEFINITIONS_BY_ID[spawn.enemyId];
    if (!def) return { total: 0, breakdown: { hp: 0, attack: 0, defense: 0, speed: 0 } };

    const scale = spawn.scaleFactor ?? 1.0;
    const scaledStats: BaseStats = {
      hp:      Math.round(def.baseStats.hp      * scale),
      attack:  Math.round(def.baseStats.attack  * scale),
      defense: Math.round(def.baseStats.defense * scale),
      speed:   def.baseStats.speed,
    };

    return computeStatsPower(scaledStats);
  });

  return mergeRatings(ratings);
}

// ---------------------------------------------------------------------------
// Comparaison & affichage
// ---------------------------------------------------------------------------

export type MatchupResult = 'strong' | 'even' | 'weak';

/**
 * Évalue l'avantage de l'équipe héros par rapport aux ennemis d'un niveau.
 *
 * > 1.2 → forte avance (strong)
 * 0.8–1.2 → combat équilibré (even)
 * < 0.8 → désavantage (weak)
 */
export function evaluateMatchup(
  heroStates: PlayerHeroState[],
  level:      LevelDefinition
): { result: MatchupResult; ratio: number; heroPower: PowerRating; enemyPower: PowerRating } {
  const heroPower  = computeTeamPower(heroStates);
  const enemyPower = computeLevelPower(level);

  const ratio = enemyPower.total > 0
    ? heroPower.total / enemyPower.total
    : Infinity;

  const result: MatchupResult =
    ratio > 1.2 ? 'strong' :
    ratio < 0.8 ? 'weak'   : 'even';

  return { result, ratio: Math.round(ratio * 100) / 100, heroPower, enemyPower };
}

/**
 * Texte et couleur à afficher dans l'UI avant le combat.
 */
export function getMatchupDisplay(result: MatchupResult): { label: string; color: string } {
  switch (result) {
    case 'strong': return { label: 'Avantage',   color: '#44ff88' };
    case 'even':   return { label: 'Équilibré',  color: '#f0c020' };
    case 'weak':   return { label: 'Désavantage', color: '#ff4422' };
  }
}
