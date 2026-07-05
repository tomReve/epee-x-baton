# 01 — Architecture

## Structure des fichiers

```
src/
├── main.ts                     # Config Phaser, point d'entrée
│
├── scenes/
│   ├── BootScene.ts            # Chargement assets, création animations Phaser
│   └── CombatScene.ts          # Rendu et interactions — aucune logique de combat
│
├── systems/
│   ├── GridSystem.ts           # Grille logique : positions, déplacements, portées, AOE
│   ├── CombatSystem.ts         # Orchestration du combat : tours, skills, morts
│   └── TurnSystem.ts           # File de tour triée par vitesse
│
├── entities/
│   ├── CombatUnit.ts           # Classe abstraite commune : état runtime combat (hp, skills, cooldowns)
│   ├── Hero.ts                 # Données spécifiques héros, hérite de CombatUnit
│   ├── Enemy.ts                # Données spécifiques ennemi, hérite de CombatUnit
│   ├── Skill.ts                # Définition + état runtime d'un skill (cooldown)
│   └── UnitAnimator.ts         # Gestion des animations par unité (idle/walk/attack)
│
├── data/
│   ├── skills.data.ts          # Catalogue de tous les skills (héros + ennemis)
│   ├── heroes.data.ts          # Définitions statiques des héros + états joueur par défaut
│   ├── enemies.data.ts         # Catalogue des ennemis par zone
│   ├── levels.data.ts          # Pont TypeScript → JSON pour les niveaux
│   ├── combat.factory.ts       # Factory : construit entités runtime depuis données statiques
│   ├── power.ts                # Calcul de puissance des équipes
│   └── json/
│       └── levels.json         # Définitions des niveaux (éditable sans recompiler)
│
├── types/
│   └── game.types.ts           # Types fondamentaux partagés dans toute la codebase
│
└── utils/
    └── EventBus.ts             # Pub/sub global entre scènes (Phaser.Events.EventEmitter)
```

## Séparation des responsabilités

| Couche | Responsabilité | Dépendances |
|---|---|---|
| `GridSystem` | Géométrie pure : cases libres, portées, formes AOE | Aucune (pas Phaser, pas entités) |
| `TurnSystem` | Ordre des tours, avancement, gestion des morts | `Hero`, `Enemy` (interfaces légères) |
| `CombatSystem` | Flux d'un tour : déplacement → skills → fin de tour | `GridSystem`, `TurnSystem`, `CombatUnit` |
| `CombatScene` | Affichage Phaser, animations, UI | Phaser, tous les systèmes |
| `data/` | Données statiques de game design | Types uniquement |
| `entities/` | État runtime des unités | `data/` via factory |

**Règle absolue** : `CombatSystem` ne connaît pas Phaser. `CombatScene` ne connaît pas la logique de combat. Ils communiquent exclusivement via `CombatEventCallback`.

## Flux de données

```
levels.json
    ↓ levels.data.ts (typage)
    ↓ combat.factory.ts (buildCombatSetup)
        ├── Hero[]        ← HeroDefinition + PlayerHeroState + SkillDefinition (extends CombatUnit)
        ├── Enemy[]       ← EnemyDefinition + SkillDefinition (extends CombatUnit)
        └── GridUnit[]    ← positions initiales
    ↓ CombatScene.create()
        ├── GridSystem    ← addUnit(gridUnit)
        ├── TurnSystem    ← new TurnSystem(heroes, enemies)
        └── CombatSystem  ← new CombatSystem(..., onEvent)
                ↓ CombatEvent
            CombatScene.handleEvent()
                ├── Phaser tweens / animations
                ├── UI updates (HP bars, cooldowns, timeline)
                └── EventBus.emit (résultats combat)
```

## Flux d'un tour (héros ou ennemi, générique sur CombatUnit)

\`\`\`
processTurn()
  └── résout allies/foes selon TurnUnit.isHero
  └── processUnitTurn(unit, foes)
        └── executeSkills(unit, foes, moveBudget)  [moveBudget = gridUnit.moveRange]
              └── castSkillsSequentially(skills, index, usedThisTurn, moveBudget)
                    ├── skill sans cible en portée (hors support) ?
                    │     └── tryRepositionForSkill()
                    │           ├── moveBudget épuisé ou aucune case atteignable → skill suivant
                    │           └── sinon → moveTowardNearest(budget restant) → emit 'unit_moved'
                    │                 └── après MOVE_ANIM_DELAY : re-check cibles
                    │                       ├── toujours aucune cible → skill suivant (budget décrémenté)
                    │                       └── cible trouvée → castSkillNow()
                    ├── skill.heal && !skill.damage → castSkillNow() direct (auto-cible)
                    └── cible(s) en portée → castSkillNow()
                          └── emit 'skill_preview'
                                └── après PREVIEW_DELAY : useSkill() → emit events
                                      └── après animDelay : skill suivant (même budget) ou endTurn()

endTurn(unit, usedSkillIds)
  └── tickSkillCooldowns(usedSkillIds)
  └── emit 'cooldowns_updated'
  └── finishTurn()
        └── turns.next()
        └── [round_start si index === 0]
        └── scheduleTurn(TURN_DELAY)
\`\`\`

Le budget de déplacement (`moveBudget`, initialisé à `gridUnit.moveRange`) se consomme en **cases cumulées sur tout le tour**, pas en nombre de déplacements distincts. Il circule en paramètre à travers la chaîne d'appels, jamais stocké sur `this` — cohérent avec `usedThisTurn` (même pattern déjà en place).

Une seule implémentation pour héros et ennemis — `CombatSystem` ne connaît que `CombatUnit`, jamais `Hero`/`Enemy` directement.

## Constantes de timing (CombatSystem)

| Constante | Valeur | Rôle |
|---|---|---|
| `TURN_DELAY` | 600ms | Pause entre deux tours |
| `PREVIEW_DELAY` | 400ms | Durée d'affichage de la preview AOE avant impact |
| `HIT_STAGGER` | 120ms | Délai entre chaque coup (multi-hit) |
| `TARGET_STAGGER` | 150ms | Délai entre chaque cible (AOE multi-cibles) |
| `ATTACK_ANIM_DELAY` | 700ms | Durée de l'animation d'attaque |
| `MOVE_ANIM_DELAY` | 420ms | Durée du tween de déplacement |

## Configuration Phaser

```typescript
scale: {
  mode: Phaser.Scale.RESIZE,     // s'adapte à chaque redimensionnement
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: window.innerWidth,
  height: window.innerHeight,
}
```

La scène se restart complètement au redimensionnement (`scale.on('resize', () => scene.restart())`).

## Scènes

| Scène | Rôle |
|---|---|
| `BootScene` | Précharge tous les assets, crée les animations Phaser, démarre `CombatScene` |
| `CombatScene` | Scène principale de combat (actuellement la seule scène active) |

Scènes futures prévues : `MapScene` (exploration), `UIScene` (HUD permanent overlay).
