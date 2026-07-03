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
│   ├── Hero.ts                 # Données et état runtime d'un héros
│   ├── Enemy.ts                # Données et état runtime d'un ennemi
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
| `CombatSystem` | Flux d'un tour : déplacement → skills → fin de tour | `GridSystem`, `TurnSystem`, `Hero`, `Enemy` |
| `CombatScene` | Affichage Phaser, animations, UI | Phaser, tous les systèmes |
| `data/` | Données statiques de game design | Types uniquement |
| `entities/` | État runtime des unités | `data/` via factory |

**Règle absolue** : `CombatSystem` ne connaît pas Phaser. `CombatScene` ne connaît pas la logique de combat. Ils communiquent exclusivement via `CombatEventCallback`.

## Flux de données

```
levels.json
    ↓ levels.data.ts (typage)
    ↓ combat.factory.ts (buildCombatSetup)
        ├── Hero[]        ← HeroDefinition + PlayerHeroState + SkillDefinition
        ├── Enemy[]       ← EnemyDefinition + SkillDefinition
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

## Flux d'un tour héros

```
processTurn()
  └── processHeroTurn(id)
        ├── Aucune cible en portée ?
        │     └── moveTowardNearest() → emit 'unit_moved'
        │           └── après MOVE_ANIM_DELAY : executeHeroSkills() ou endHeroTurn()
        └── Cible en portée ?
              └── executeHeroSkills()
                    └── castSkillsSequentially(skills, index, usedThisTurn)
                          ├── skill.heal && !skill.damage → useHeroSkill(hero, skill, [])
                          ├── liveTargets.length === 0 → skill suivant (pas de fin de tour)
                          └── liveTargets OK → emit 'skill_preview'
                                └── après PREVIEW_DELAY : useHeroSkill() → emit events
                                      └── après animDelay : skill suivant ou endHeroTurn()

endHeroTurn(hero, usedSkillIds)
  └── tickSkillCooldowns(usedSkillIds)  ← sauf skills utilisés ce tour
  └── emit 'cooldowns_updated'
  └── finishTurn()
        └── turns.next()
        └── [round_start si index === 0]
        └── scheduleTurn(TURN_DELAY)
```

## Flux d'un tour ennemi

```
processEnemyTurn(id)
  ├── Cible en portée d'un skill prêt ? → executeEnemySkills()
  │     └── castEnemySkillsSequentially(skills, index, usedThisTurn)
  │           ├── preview AOE (400ms)
  │           ├── useEnemySkill (dégâts)
  │           └── skill suivant ou endEnemyTurn()
  └── sinon → déplacement → [cible en portée ?] → executeEnemySkills() ou endEnemyTurn()

endEnemyTurn → tickSkillCooldowns (sauf skills utilisés ce tour) → finishTurn
```

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
