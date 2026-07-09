# 05 — Tests

## Stack

- **Vitest** (`^4.0.0`) + `@vitest/coverage-v8`
- Config : `vitest.config.ts` à la racine
- Dossier centralisé : `tests/`, miroir de la structure de `src/`

## Commandes

```bash
npm run test           # run unique
npm run test:watch     # mode watch
npm run test:coverage  # avec rapport de couverture (text + html dans coverage/)
```

## Structure
```
tests/
├── helpers/
│   └── factories.ts        # builders partagés (makeHero, makeEnemy, makeUnit, makeSkill, makeCombatUnit)
├── systems/
│   ├── TurnSystem.test.ts
│   └── GridSystem.test.ts
├── entities/
│   ├── Skill.test.ts
│   └── CombatUnit.test.ts
└── data/                    # à venir
```

## Convention de helpers

Tout builder d'entité/objet de test réutilisé dans plusieurs fichiers va dans `tests/helpers/factories.ts`, jamais dupliqué localement. Builders actuels :

| Helper | Rôle |
|---|---|
| `makeHero(id, speed, alive?)` | Hero runtime minimal, sans skills |
| `makeEnemy(id, speed, alive?)` | Enemy runtime minimal, sans skills |
| `makeUnit(id, col, row, isHero, moveRange?)` | GridUnit pour tests géométrie |
| `makeSkill(overrides?)` | SkillData avec valeurs par défaut, override via objet partiel |
| `makeCombatUnit(overrides?)` | Hero runtime pour tests CombatUnit — override stats/skills. Note : `currentHp` s'initialise depuis `hp`, pas `maxHp` |

Avant d'ajouter un nouveau helper : vérifier qu'un existant ne peut pas être réutilisé ou étendu via ses paramètres/overrides.

## Périmètre

**Testé unitairement** : `systems/`, `entities/`, `data/` (logique pure, pas de dépendance Phaser).

**Non testé** (exclus de la stratégie de tests ET du coverage) : `scenes/` (`CombatScene.ts`, `BootScene.ts`), `main.ts` — dépendance directe à Phaser, non unitaire.

## Coverage

Config dans `vitest.config.ts` :
- `include: ['src/**/*.ts']`
- `exclude` : `scenes/**`, `main.ts`, `*.types.ts`, `*.data.ts`, `node_modules/**`

Les fichiers `*.data.ts` (catalogues statiques : `skills.data.ts`, `heroes.data.ts`, `enemies.data.ts`) sont exclus du coverage — pas de logique, juste des données. `power.ts` et `combat.factory.ts` restent inclus (logique réelle, testés/à tester).