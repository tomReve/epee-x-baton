# Sword x Staff Clone

Un RPG auto-battler avec combat au tour par tour sur damier, inspiré de Sword x Staff. Développé en TypeScript avec Phaser.js et Vite.

## Stack

- **Phaser 3** — moteur de jeu 2D (rendu, animations, tweens)
- **TypeScript** — typage strict sur toute la codebase
- **Vite** — bundler et serveur de développement

## Lancer le projet

```bash
npm install
npm run dev
```

## Architecture

```
src/
├── main.ts                   # Config Phaser, point d'entrée
├── scenes/
│   ├── BootScene.ts          # Chargement des assets, création des animations
│   └── CombatScene.ts        # Rendu et interactions — aucune logique de combat
├── systems/
│   ├── GridSystem.ts         # Grille logique : positions, déplacements, portées, AOE
│   ├── CombatSystem.ts       # Orchestration du combat : tours, skills, morts
│   └── TurnSystem.ts         # File de tour triée par vitesse
├── entities/
│   ├── Hero.ts               # Données et état d'un héros
│   ├── Enemy.ts              # Données et état d'un ennemi
│   ├── Skill.ts              # Définition et état d'un skill (cooldown, portée, AOE)
│   └── UnitAnimator.ts       # Gestion des animations par unité (idle/walk/attack)
└── utils/
    └── EventBus.ts           # Pub/sub global entre scènes
```

### Séparation des responsabilités

| Couche | Responsabilité |
|---|---|
| `GridSystem` | Géométrie pure : cases libres, portées, formes AOE |
| `TurnSystem` | Ordre des tours, avancement, gestion des morts |
| `CombatSystem` | Flux d'un tour : déplacement → skills → fin de tour |
| `CombatScene` | Affichage Phaser, animations, UI — réagit aux `CombatEvent` |

`CombatSystem` ne connaît pas Phaser. `CombatScene` ne connaît pas la logique de combat. Ils communiquent exclusivement via `CombatEventCallback`.

## Système de combat

### Déroulement d'un tour héros

```
processHeroTurn
  ├── si cible en portée → executeHeroSkills
  │     └── castSkillsSequentially
  │           ├── preview AOE (400ms)
  │           ├── useHeroSkill (dégâts / soins)
  │           └── skill suivant ou endHeroTurn
  └── sinon → déplacement → [cible en portée ?] → executeHeroSkills ou endHeroTurn

endHeroTurn → tickSkillCooldowns (sauf skills utilisés ce tour) → finishTurn
finishTurn  → turns.next() → [nouveau round ?] → scheduleTurn
```

### Déroulement d'un tour ennemi

```
processEnemyTurn
  ├── si cible en portée → executeEnemyAttack → finishTurn
  └── sinon → déplacement → [cible en portée ?] → executeEnemyAttack ou finishTurn
```

### Cooldowns

Les cooldowns sont exprimés en **tours du héros** (pas en secondes).

- `cooldownTurns: 0` → le skill peut être lancé tous les tours
- `cooldownTurns: 1` → 1 tour d'attente après utilisation
- Au début du combat, les skills ont leur cooldown initial actif
- Le tick a lieu en **fin de tour**, et seulement pour les skills **non utilisés** ce tour

### Skills — SkillData

```typescript
interface SkillData {
  id:            string;
  name:          string;
  damage?:       number;          // dégâts de base (+ attaque du héros)
  heal?:         number;          // soin (ciblage = caster)
  hits?:         number;          // nombre de coups (défaut: 1)
  cooldownTurns: number;
  range:         number;          // portée de déclenchement (0 = centré sur le caster)
  targetType:    'single' | 'aoe' | 'all';
  aoe?:          AoeShape;        // uniquement si targetType === 'aoe'
  type:          'physical' | 'magic' | 'support';
}
```

### Formes AOE

| Type | Description |
|---|---|
| `radius` | Cercle de rayon `value` (distance Manhattan) |
| `square` | Carré de côté `value*2+1` centré sur l'origine |
| `cross` | Croix de longueur `value` dans les 4 directions |
| `line` | Ligne horizontale de longueur `value` dans les 2 sens |
| `all` | Toute la grille |

Avec `range: 0`, l'AOE est centrée sur le caster lui-même. Avec `range > 0`, elle est centrée sur la première cible en portée.

### Events de combat

`CombatSystem` émet des `CombatEvent` que `CombatScene` consomme pour l'affichage.

| Event | Déclencheur |
|---|---|
| `turn_start` | Une unité commence son tour |
| `unit_moved` | Une unité se déplace |
| `hero_attack` / `enemy_attack` | Attaque de base |
| `skill_used` | Un skill a infligé des dégâts ou soigné |
| `skill_preview` / `skill_preview_clear` | Début / fin de la preview AOE |
| `cooldowns_updated` | Les cooldowns d'un héros ont changé |
| `hero_died` / `enemy_died` | Une unité est morte |
| `round_start` | Toutes les unités ont joué, nouveau round |
| `combat_won` / `combat_lost` / `combat_timeout` | Fin du combat |

## Assets

Les assets sont chargés dans `BootScene.ts`.

```
public/assets/
├── tiles/
│   └── Tilemap_color1.png    # Tileset terrain 64×64 par tile
└── units/
    ├── sword_idle.png         # Spritesheet 192×192 par frame
    ├── sword_walk.png
    ├── sword_attack.png
    ├── staff_idle.png
    ├── staff_walk.png
    ├── staff_attack.png
    ├── goblin_idle.png
    ├── goblin_walk.png
    ├── goblin_attack.png
    ├── boss_idle.png
    ├── boss_walk.png
    └── boss_attack.png
```

Les frames sont détectées automatiquement par Phaser via `load.spritesheet`. Adapter les `frameCount` dans `UNIT_SPRITES` selon les assets réels.

## Roadmap

- [ ] Skills ennemis
- [ ] Ciblage intelligent (maximiser la zone, cibler le plus faible…)
- [ ] Déplacement après attaque dans le même tour
- [ ] Effets de statut (poison, stun, shield…)
- [ ] Coups critiques et esquives
- [ ] Système de progression (XP, niveaux, ressources)
- [ ] MapScene — exploration du monde
- [ ] Sauvegarde de la progression (localStorage ou API)
