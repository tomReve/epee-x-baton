# 02 — Règles de développement

## Règles d'architecture

### Séparation logique / affichage
- `CombatSystem` ne doit **jamais** importer Phaser ni accéder à des GameObjects
- `CombatScene` ne doit **jamais** contenir de logique de combat (calculs de dégâts, résolution de cibles, gestion des tours)
- Toute communication entre les deux passe exclusivement par `CombatEventCallback`

### Gestion des tours
- **Un seul chemin** vers `finishTurn()` par action — jamais deux `finishTurn()` possibles pour la même action
- Tout chemin d'exécution doit aboutir à `finishTurn()`, sinon le combat bloque
- `advanceTurn()` n'existe plus — `finishTurn()` est le seul point d'entrée

### Cooldowns
- Les cooldowns sont exprimés en **tours du héros** (pas en millisecondes)
- `tickCooldown()` s'applique en **fin de tour**, uniquement sur les skills **non utilisés** ce tour
- Un skill utilisé ce tour est ajouté au `Set<string> usedThisTurn` — ce Set est transmis à `endHeroTurn()` pour être exclu du tick
- `cooldownTurns: 0` → relançable chaque tour (si une cible est à portée)
- Au démarrage du combat, les skills ont leur cooldown initial actif (`turnsRemaining = cooldownTurns` dans le constructeur)

### Résolution des cibles
- Les skills offensifs (`damage`) cherchent des cibles via `GridSystem.getAoeTargets()`
- Les skills de soin (`heal && !damage`) ne cherchent **pas** de cibles ennemies — ils s'auto-appliquent
- Si un skill n'a pas de cible, on passe au **skill suivant** (pas de fin de tour prématurée)
- La résolution de cibles est recalculée à chaque skill dans la chaîne (re-ciblage après kill)

### Données vs Runtime
- `SkillDefinition` (data layer) ≠ `Skill` (entité runtime avec état de cooldown)
- `HeroDefinition` (game design statique) ≠ `PlayerHeroState` (progression persistée)
- `combat.factory.ts` est le **seul** endroit où les données statiques se transforment en entités runtime
- Ne jamais instancier `Hero` ou `Enemy` directement dans `CombatScene` — passer par la factory

### GridSystem
- `getTargetsInRange()` (ancienne méthode hardcodée à range 1) est **supprimée**
- Utiliser `getTargetsInSkillRange(unit, range)` avec la range explicite
- Les imports de types dans GridSystem doivent être des imports nommés en haut de fichier, pas des imports inline dynamiques

## Règles de code TypeScript

### Interfaces
- `interface Placement` et autres interfaces locales → en haut du fichier, **jamais** à l'intérieur d'une méthode
- `interface SkillSlotRefs` → en bas du fichier si privée à la scène
- Types partagés entre plusieurs fichiers → dans `src/types/game.types.ts`

### Gestion des `setTimeout`
- Chaque `setTimeout` imbriqué doit vérifier `if (!this.running) return;` en premier
- Les délais d'animation sont des constantes nommées (`ATTACK_ANIM_DELAY`, etc.), pas des magic numbers
- Ne jamais passer de `setTimeout` non annulable — `stop()` doit pouvoir interrompre le combat proprement

### Sprites Phaser
- Toujours créer un sprite avec la frame 0 explicite : `this.add.sprite(0, 0, key, 0)` — évite le carré barré au chargement
- Ne jamais utiliser `setAlpha(0)` comme hack de chargement — utiliser la frame initiale
- `tweens.killTweensOf(container)` avant tout nouveau tween sur le même objet (évite les cumuls d'alpha)
- Capturer la position `container.x / container.y` **immédiatement** à la réception d'un event (la cible peut mourir avant l'affichage différé)

### Texte flottant (floating damage)
- Utiliser `showFloatingTextAt(x, y, ...)` avec position capturée, pas `showFloatingText(unitId, ...)` quand il y a un délai
- Les chiffres de dégâts : italique, contour épais, `padding: { right: 20 }` pour éviter le crop de l'italique

## Règles de game design

### Skills
- Chaque héros dispose de **4 skills équipés** parmi les skills disponibles pour sa classe
- Les skills sont définis dans `skills.data.ts` avec `availableFor: HeroClass[]`
- Un skill sans `damage` ni `heal` n'est pas valide (à confirmer si des buffs/debuffs sont ajoutés)
- `range: 0` = centré sur le caster (AOE autour de soi ou `targetType: 'all'` sans condition de range)

### Ennemis
- Ennemis normaux : **2 skills** (`[basic_attack, heavy_blow]`)
- Boss : **3 skills** (`[basic_attack, heavy_blow, ulti]`)
- Mega boss : à définir plus tard

### Niveaux
- Un niveau définit `maxRounds`, les `enemySpawns` (avec `scaleFactor`) et les `heroSpawns`
- Si `maxRounds` est atteint sans victoire → `combat_timeout` (défaite dans le mode `eliminate`)
- Le `scaleFactor` s'applique aux stats HP/ATK/DEF des ennemis, **pas** à leur vitesse

## Ce qui ne change pas
- La grille est **entièrement partagée** — pas de zones réservées par camp
- Une case = une unité maximum
- Les héros sont **permanents** pour le joueur (pas de perte en cas de défaite)
- Pas de gacha, pas d'energy timer, pas de paywall — jamais
