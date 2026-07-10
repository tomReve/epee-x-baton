# 06 — Modèle de données

## Types fondamentaux (`game.types.ts`)

### Énumérations

```typescript
type HeroClass   = 'archer' | 'lancer' | 'warrior' | 'monk';
type EnemyType   = 'normal' | 'boss' | 'mega_boss';
type SkillTargetType = 'single' | 'aoe' | 'all';
type SkillEffectType = 'physical' | 'magic' | 'support';
type AoeShapeType    = 'radius' | 'square' | 'cross' | 'line' | 'all';
```

### Stats de base

```typescript
interface BaseStats {
  hp:      number;   // points de vie
  attack:  number;   // dégâts de base (ajoutés aux dégâts du skill)
  defense: number;   // réduction de dégâts reçus
  speed:   number;   // détermine l'ordre de tour (plus bas = joue plus tôt)
}
```

## Skills

### `SkillDefinition` (données statiques, `skills.data.ts`)

```typescript
interface SkillDefinition {
  id:            string;
  name:          string;
  description:   string;
  availableFor:  HeroClass[];    // classes pouvant équiper ce skill ([] = skills ennemis)
  damage?:       number;         // dégâts de base
  heal?:         number;         // soin (appliqué sur le caster)
  hits?:         number;         // nombre de coups (défaut: 1)
  cooldownTurns: number;         // 0 = relançable chaque tour
  range:         number;         // 0 = centré sur le caster
  targetType:    SkillTargetType;
  targetSide?:   'enemy' | 'ally';        // défaut: 'enemy' si absent
  targetPriority?: 'first' | 'lowest_hp' | 'highest_attack';  // défaut: 'first' si absent
  aoe?:          AoeShape;       // uniquement si targetType === 'aoe'
  type:          SkillEffectType
  effects?:      SkillEffectApplication[];  // effets de statut appliqués aux cibles à l'impact
}

interface SkillEffectApplication {
  statusId:       string;    // référence STATUS_EFFECTS_BY_ID
  durationTurns?: number;    // override de StatusEffectDefinition.durationTurns
  chance?:        number;    // 1-100, anticipé, non lu actuellement (toujours appliqué)
}
```

### `SkillData` (format attendu par l'entité `Skill`, `entities/Skill.ts`)

`SkillData = Omit<SkillDefinition, 'description' | 'availableFor'>`. La relation de sous-ensemble est portée par le type système plutôt qu'une interface dupliquée. Produit par `combat.factory.ts` (le mapping filtre toujours les deux champs, mais n'a plus besoin de recopier chaque champ ajouté à `SkillDefinition`).

### `Skill` (entité runtime)

```typescript
class Skill {
  data: SkillData;
  private turnsRemaining: number;  // initialisé à cooldownTurns dans le constructeur

  isReady(): boolean              // turnsRemaining <= 0
  use(): void                     // turnsRemaining = cooldownTurns
  tickCooldown(): void            // turnsRemaining-- si > 0
  getTurnsRemaining(): number     // pour l'UI
}
```

## Effets de statut

### `StatusEffectDefinition` (données statiques, `statusEffects.data.ts`)

```typescript
type StatusEffectType   = 'poison' | 'burn' | 'stun' | 'shield' | 'buff' | 'debuff';
type StatusPolarity     = 'positive' | 'negative';
type StatusTickTiming   = 'turn_start' | 'turn_end';

interface StatusEffectDefinition {
  id:            string;
  name:          string;
  type:          StatusEffectType;
  polarity:      StatusPolarity;
  stackable:     boolean;
  durationTurns: number;
  tickTiming:    StatusTickTiming;
}
```

Catalogue statique (`STATUS_EFFECTS` / `STATUS_EFFECTS_BY_ID`), même pattern que `skills.data.ts`. Contient actuellement `stun` (`durationTurns: 1`, `tickTiming: 'turn_end'`, `stackable: false`). Chaque nouvel effet concret (poison, shield, buff/debuff...) est ajouté au catalogue lors de sa propre feature dédiée.

`tickTiming` détermine **quand** un effet est tické (`'turn_start'` pour anticiper poison ; `'turn_end'` utilisé par stun) — indépendant du `type` de l'effet. Le tick ne fait qu'avancer/expirer la durée ; le **comportement** associé (bloquer le tour, infliger des dégâts...) est dispatché dans `CombatSystem` selon `type`, jamais dans `StatusEffect`/`CombatUnit`.

### `StatusEffect` (entité runtime, `entities/StatusEffect.ts`)

```typescript
class StatusEffect {
  data: StatusEffectDefinition;
  private turnsRemaining: number;  // initialisé à durationTurns (ou override applyStatusEffect)

  isExpired(): boolean            // turnsRemaining <= 0
  tick(): void                    // turnsRemaining-- si > 0
  getTurnsRemaining(): number
}
```

Symétrique à `Skill`/`SkillData`.

### Intégration sur `CombatUnit`

```typescript
abstract class CombatUnit {
  statusEffects: StatusEffect[];

  applyStatusEffect(def: StatusEffectDefinition, durationOverride?: number): void
  // non-stackable + déjà présent → remplace l'instance existante (durée = durationOverride ?? def.durationTurns)
  // stackable → nouvelle instance ajoutée, les deux coexistent

  hasStatusEffect(id: string): boolean

  tickStatusEffects(timing: StatusTickTiming): void
  // tick uniquement les instances dont tickTiming === timing, retire celles expirées
}
```

**Statut** : infrastructure branchée pour le **stun** uniquement. `CombatSystem.processTurn()` vérifie `hasStatusEffect('stun')` avant d'exécuter le tour d'une unité ; `endTurn()` appelle `tickStatusEffects('turn_end')` au même point que `tickSkillCooldowns()`. Poison (`'turn_start'`), buff/debuff, shield restent à implémenter — chacun ajoutera son propre point de dispatch dans `CombatSystem`.

### Formes AOE

```typescript
interface AoeShape {
  type:   'radius' | 'square' | 'cross' | 'line' | 'all';
  value?: number;
  // radius → cercle Manhattan de rayon value
  // square → carré (value*2+1)×(value*2+1)
  // cross  → croix de longueur value dans 4 directions
  // line   → ligne horizontale, value cases de chaque côté
  // all    → toute la grille (value ignoré)
}
```

## Unités de combat

### `CombatUnit` (classe abstraite, `entities/CombatUnit.ts`)

Porte tout l'état et les comportements runtime de combat, communs à `Hero` et `Enemy`. Introduite pour éliminer la duplication qui existait entre les deux entités (voir `04_DECISIONS.md`).

```typescript
interface BaseUnitData {
  id:      string;
  name:    string;
  hp:      number; // HP courant à l'entrée en combat (peut être < maxHp, ex: dégâts d'exploration)
  maxHp:   number;
  attack:  number;
  defense: number;
  speed:   number;
  skills:  SkillData[];
}

abstract class CombatUnit {
  abstract data: BaseUnitData;
  skills:    Skill[];
  currentHp: number;

  isAlive(): boolean
  takeDamage(amount: number): number    // retourne les dégâts réels (après defense)
  heal(amount: number): void
  getReadySkill(): Skill | null         // premier skill isReady()
  tickSkillCooldowns(usedSkillIds: Set<string> | null): void
}
```

`heal()` est disponible sur `CombatUnit`, donc aussi sur `Enemy`, en anticipation d'un futur skill de soin ennemi — aucun skill ennemi actuel n'en dispose.

### `Hero` (entité runtime, `entities/Hero.ts`)

```typescript
interface HeroData extends BaseUnitData {}

class Hero extends CombatUnit {
  data: HeroData;
}
```

Aucune méthode propre au-delà de `CombatUnit` à ce stade. La distinction avec `Enemy` se joue au niveau des données statiques (`HeroDefinition`) et de la progression joueur (`PlayerHeroState`), pas au niveau du runtime de combat.

### `Enemy` (entité runtime, `entities/Enemy.ts`)

```typescript
interface EnemyData extends BaseUnitData {}

class Enemy extends CombatUnit {
  data: EnemyData;
}
```

`id` unique par instance en combat : `${enemyId}_${index}` (permet plusieurs goblins dans le même niveau). Pas de `xpReward`/`goldReward` sur `EnemyData` (retirés — voir `04_DECISIONS.md` et section Ennemis ci-dessous).

## Héros — couches statiques et progression

### `HeroDefinition` (données statiques, `heroes.data.ts`)

```typescript
interface HeroDefinition {
  id:              string;         // = HeroClass pour l'instant ('warrior', 'monk'...)
  name:            string;
  class:           HeroClass;
  baseStats:       BaseStats;
  moveRange:       number;         // cases de déplacement par tour
  availableSkills: string[];       // ids des skills équipables
  spriteKey:       string;         // clé Phaser pour les assets
}
```

### `PlayerHeroState` (état persisté joueur, à sauvegarder)

```typescript
interface PlayerHeroState {
  heroId:         string;
  level:          number;
  xp:             number;
  equippedSkills: [string, string, string, string];  // exactement 4 skills
  // equipment: EquipmentId[]  // à ajouter
}
```

## Ennemis — couche statique

### `EnemyDefinition` (données statiques, `enemies.data.ts`)

```typescript
interface EnemyDefinition {
  id:        string;
  name:      string;
  type:      EnemyType;
  baseStats: BaseStats;
  moveRange: number;
  skills:    string[];       // 2 pour normal, 3 pour boss
  spriteKey: string;
}
```

Pas de `xpReward`/`goldReward` : retirés, aucune utilisation dans le code actuel. Seront réintroduits au niveau `LevelDefinition` (avec composante aléatoire), pas par ennemi individuel — voir `07_TODO.md`.

## Grille

### `GridUnit` (runtime, `systems/GridSystem.ts`)

```typescript
interface GridUnit {
  id:        string;
  isHero:    boolean;
  pos:       GridPosition;  // { col: number; row: number }
  moveRange: number;
  // plus d'attackRange — la range est sur chaque SkillData
}
```

## Niveaux

### `LevelDefinition` (`types/game.types.ts`, source `levels.json`)

```typescript
interface LevelDefinition {
  id:          string;
  name:        string;
  zone:        string;          // 'foret', 'donjon', etc.
  order:       number;          // position dans la progression globale
  maxRounds:   number;
  enemySpawns: EnemySpawn[];
  heroSpawns:  HeroSpawn[];
}

interface EnemySpawn {
  enemyId:      string;
  col:          number;
  row:          number;
  scaleFactor?: number;         // multiplie HP/ATK/DEF (défaut: 1.0, vitesse inchangée)
}

interface HeroSpawn {
  heroId: string;
  col:    number;
  row:    number;
}
```

## Puissance

```typescript
interface PowerRating {
  total:     number;
  breakdown: { hp: number; attack: number; defense: number; speed: number };
}

type MatchupResult = 'strong' | 'even' | 'weak';
// strong : ratio > 1.2
// even   : ratio 0.8–1.2
// weak   : ratio < 0.8
```

Formule puissance par unité :
```
power = hp * 0.4 + attack * 15 + defense * 10 + (2000 / speed) * 5
```

## Events de combat (`CombatSystem.ts`)

```typescript
interface CombatEvent {
  type:
    | 'turn_start'           // une unité commence son tour
    | 'unit_moved'           // une unité s'est déplacée
    | 'skill_used'           // un skill a infligé des dégâts ou soigné
    | 'unit_died'            // une unité (héros ou ennemi) est morte
    | 'round_start'          // nouveau round
    | 'combat_won'           // tous les ennemis vaincus
    | 'combat_lost'          // tous les héros vaincus
    | 'combat_timeout'       // maxRounds atteint
    | 'cooldowns_updated'    // cooldowns d'un héros ont changé
    | 'skill_preview'        // affiche la preview AOE
    | 'skill_preview_clear'; // efface la preview AOE
    | 'unit_stunned';

  source?:    string;           // id de l'unité qui agit
  target?:    string;           // id de la cible principale
  targets?:   string[];         // ids de toutes les cibles (AOE)
  value?:     number;           // dégâts ou soin
  skillName?: string;
  skillId?:   string;           // pour cooldowns_updated ciblé
  skillData?: SkillData;        // pour skill_preview
  fromPos?:   GridPosition;
  toPos?:     GridPosition;
  round?:     number;
  hitIndex?:  number;           // index du coup dans un multi-hit (0-based)
  totalHits?: number;
  previewTargets?: string[];    // ids des unités réellement ciblées, pour la preview AOE
  isHeal?:    boolean;          // distingue soin/dégât dans skill_used (plutôt que déduire via target === source)
}
```

`unit_died` remplace les anciens `hero_died`/`enemy_died` : les deux déclenchaient un traitement strictement identique côté `CombatScene` et `CombatSystem`, la distinction était purement informative et inutilisée.

## Factory — `buildCombatSetup`

```typescript
interface CombatSetup {
  heroes:     Hero[];
  enemies:    Enemy[];
  heroUnits:  GridUnit[];
  enemyUnits: GridUnit[];
  maxRounds:  number;
}

function buildCombatSetup(
  level:      LevelDefinition,
  heroStates: PlayerHeroState[]
): CombatSetup
```

## Relations entre types

```
PlayerHeroState ──────────────► HeroDefinition (via heroId)
      │                               │
      │ equippedSkills[4]             │ availableSkills[]
      ▼                               ▼
  SkillDefinition ◄──────── SKILLS_BY_ID ──────► EnemyDefinition.skills[]
      │
      ▼ (mappé dans combat.factory)
   SkillData
      │
      ▼ (instancié dans Hero/Enemy constructor, via CombatUnit)
    Skill (avec état cooldown)

HeroDefinition + PlayerHeroState ──► Hero extends CombatUnit
EnemyDefinition                  ──► Enemy extends CombatUnit

LevelDefinition.enemySpawns[] ──► EnemyDefinition (via enemyId)
LevelDefinition.heroSpawns[]  ──► PlayerHeroState (via heroId)

SkillDefinition.effects[] ──► StatusEffectDefinition (via statusId)
      │
      ▼ (appliqué dans CombatSystem.applySkillEffects)
   CombatUnit.statusEffects[] (StatusEffect runtime)
```
