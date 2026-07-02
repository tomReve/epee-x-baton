# 00 — Contexte du projet

## Vision

Clone personnel de **Sword x Staff** (Boltray Games, iOS/Android, mai 2026) — un RPG mobile auto-battler tour par tour sur damier, dit "Third Way RPG" (entre JRPG et WRPG).

Objectif : reproduire la boucle de gameplay (exploration + auto-combat + builds) **sans les mécaniques bloquantes** (gacha, energy timers, paywalls). Le projet est avant tout personnel — pas de release commerciale prévue à court terme.

## Contexte développeur

- Développeur **web full-stack confirmé**, maîtrise TypeScript / Node.js / écosystème web
- Pas d'expérience préalable en développement de jeux vidéo
- Choix de rester dans l'écosystème web (pas Unity, pas Godot)
- A suivi le tutoriel Phaser.js avant de démarrer le projet

## Stack technique

| Outil | Rôle |
|---|---|
| **Phaser 3** | Moteur de jeu 2D (rendu, animations, tweens, sprites) |
| **TypeScript** | Typage strict sur toute la codebase |
| **Vite** | Bundler et serveur de développement |

## Lancer le projet

```bash
npm install
npm run dev
```

## Références visuelles et gameplay

- **Sword x Staff** — auto-battler, damier partagé héros/ennemis, skills à cooldown, timeline de tours
- **AFK Arena** — auto-combat, progression idle, UI mobile
- **Fire Emblem / FFTactics** — damier tactique, vue légèrement en plongée (référence visuelle retirée au profit d'une vue 2D frontale)

## Style visuel retenu

- Vue **2D frontale** (pas isométrique, pas de perspective)
- Sprites anime 2D avec animations (idle / walk / attack)
- Terrain : tileset herbe/nature, damier subtil visible mais discret
- UI style MMORPG mobile : skills en bas, rounds en haut, timeline des tours
- Bloom simulé via glows et overlays Phaser (pas de post-processing 3D)

## Assets

```
public/assets/
├── sprites/
│   ├── warrior_idle.png      # Spritesheet 192×192 par frame
│   ├── warrior_walk.png
│   ├── warrior_attack.png
│   ├── monk_idle.png / walk / attack
│   ├── archer_idle.png / walk / attack
│   ├── lancer_idle.png / walk / attack
│   ├── goblin_idle.png / walk / attack
│   └── pawn_idle.png / walk / attack  (boss / ennemis génériques)
└── sprites/
    └── Tilemap_color1.png    # Tileset terrain 64×64 par tile, 9 colonnes
```

Format spritesheets : une image par animation, frames 192×192 côte à côte, 6–8 frames selon l'animation.
