# Sword x Staff Clone

RPG auto-battler au tour par tour sur damier, inspiré de Sword x Staff. TypeScript + Phaser 3 + Vite.

## Lancer le projet

```bash
npm install
npm run dev
```

## Structure

```
src/
├── main.ts          # Point d'entrée, config Phaser
├── scenes/           # BootScene (chargement), CombatScene (rendu — pas de logique de combat)
├── systems/           # GridSystem, TurnSystem, CombatSystem (logique pure, pas de Phaser)
├── entities/          # Hero, Enemy, Skill, UnitAnimator
├── data/             # Catalogues statiques (skills, héros, ennemis, niveaux) + factory
└── utils/            # EventBus
```

## Documentation

La documentation complète du projet vit dans `/docs` :

| Fichier | Contenu |
|---|---|
| [`00_CONTEXT.md`](docs/00_CONTEXT.md) | Vision, contexte développeur, stack, références |
| [`01_ARCHITECTURE.md`](docs/01_ARCHITECTURE.md) | Structure des fichiers, séparation des responsabilités, flux de tours |
| [`02_RULES.md`](docs/02_RULES.md) | Règles d'architecture et de code à respecter |
| [`03_FEATURES.md`](docs/03_FEATURES.md) | Features implémentées en détail |
| [`04_DECISIONS.md`](docs/04_DECISIONS.md) | Décisions d'architecture et leurs raisons |
| [`06_DATA_MODEL.md`](docs/06_DATA_MODEL.md) | Modèle de données complet (types, entités) |
| [`07_TODO.md`](docs/07_TODO.md) | Roadmap et tâches à venir |
| [`08_CHANGELOG.md`](docs/08_CHANGELOG.md) | Historique chronologique du développement |

**Règle absolue du projet** : `CombatSystem` ne connaît pas Phaser, `CombatScene` ne contient aucune logique de combat. Ils communiquent uniquement via `CombatEventCallback`. Détails dans `01_ARCHITECTURE.md`.