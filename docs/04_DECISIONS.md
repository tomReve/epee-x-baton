# 04 — Décisions d'architecture

## Phaser.js plutôt que Unity / Godot

**Contexte** : profil développeur web full-stack, pas d'expérience jeu vidéo.

**Décision** : rester dans l'écosystème web (TypeScript + Phaser 3 + Vite).

**Raisons** :
- Pas d'apprentissage d'un nouvel environnement (Unity C#, Godot GDScript)
- Deploy web natif, jouable dans le navigateur ou en PWA
- TypeScript familier, même patterns que le web (modules, imports, classes)
- Phaser 3 gère le rendu canvas/WebGL, les tweens, les spritesheets

**Contrainte** : Phaser est 2D uniquement — la vue 3D cel-shading initialement envisagée a été abandonnée au profit d'une vue 2D frontale avec effets visuels simulés.

---

## 2D frontale plutôt qu'isométrique

**Contexte** : plusieurs directions visuelles explorées (iso pixel art, FFTactics 3/4, 3D cel-shading).

**Décision** : vue 2D frontale style auto-battler mobile (AFK Arena, Sword x Staff).

**Raisons** :
- L'image de référence Sword x Staff montre des personnages debout sur un terrain semi-plat
- La vue iso complexifie le rendu (z-order, transformation de coordonnées, assets iso spécifiques)
- La 2D frontale est cohérente avec les assets anime disponibles sur itch.io
- Le damier logique reste présent mais invisible — les cases sont des dalles subtiles

---

## Grille partagée héros/ennemis

**Contexte** : première version avait des zones séparées (héros à gauche, ennemis à droite).

**Décision** : damier entièrement partagé, les deux camps peuvent aller n'importe où.

**Raisons** :
- Plus fidèle au fonctionnement de Sword x Staff
- Simplifie `GridSystem` (plus de filtrage par zone)
- Ouvre des possibilités tactiques (ennemis qui contournent, héros qui reculent)

---

## Tour par tour plutôt que temps réel

**Contexte** : première version utilisait un `setInterval` global où toutes les unités tickaient simultanément.

**Décision** : système de tour par tour strict, une unité agit à la fois.

**Raisons** :
- Plus lisible pour le joueur (on voit clairement qui agit)
- Timeline de tours possible (UI informative)
- Cohérent avec la spec "auto-battler tactique" plutôt que "idle en temps réel"
- Les cooldowns en tours (et non en secondes) sont plus intuitifs et prévisibles

**Impact** : refactoring complet de `CombatSystem` — suppression du `setInterval`, remplacement par une chaîne de `setTimeout` orchestrée avec `finishTurn()` comme point de convergence unique.

---

## `finishTurn()` comme point de convergence unique

**Contexte** : multiples chemins d'exécution (déplacement seul, attaque, skill, multi-skill, blocage) généraient des bugs de double-appel ou d'appels manquants.

**Décision** : `finishTurn()` est **l'unique** méthode qui avance le tour. `CombatScene` ne peut pas appeler `advanceTurn()` ou équivalent.

**Règle** : chaque chemin d'exécution dans `CombatSystem` doit aboutir à exactement **un** appel à `finishTurn()`.

---

## Cooldown tick en fin de tour sur les skills non utilisés

**Contexte** : plusieurs variantes testées pour le timing du tick (début de tour, fin de tour, après use).

**Décision finale** :
- `use()` initialise `turnsRemaining = cooldownTurns`
- `tickCooldown()` s'applique en **fin de tour** via `endHeroTurn(hero, usedSkillIds)`
- Les skills dans `usedSkillIds` sont **exclus** du tick ce tour
- Résultat : `cooldownTurns: 1` = 1 tour d'attente réel après utilisation

**Raison de l'exclusion** : sans exclusion, un skill utilisé au tour N serait immédiatement décrémenté au même tour N, réduisant effectivement le cooldown d'un tour.

---

## Range définie sur le skill, pas sur l'unité

**Contexte** : première version avait `attackRange` sur `GridUnit`.

**Décision** : chaque `SkillData` définit sa propre `range`.

**Raisons** :
- Un héros peut avoir des skills à portée différente (soin à 3 cases, attaque à 1 case)
- `GridUnit` ne contient plus que `moveRange`
- `GridSystem.getTargetsInRange()` (hardcodée à 1) supprimée, remplacée par `getTargetsInSkillRange(unit, range)`

---

## Séparation données statiques / état runtime

**Contexte** : héros et skills définis inline dans `CombatScene.initEntities()`.

**Décision** : couche `data/` distincte avec `SkillDefinition` ≠ `Skill`, `HeroDefinition` ≠ `PlayerHeroState`.

**Raisons** :
- Prépare le système de progression (XP, niveaux, équipements)
- Permet d'éditer le game design (stats, skills, niveaux) sans toucher au code de combat
- `levels.json` éditable sans recompiler
- `combat.factory.ts` est le seul point de transformation données → entités runtime

**Point critique** : `SkillDefinition` (data layer) doit être mappée vers `SkillData` (format attendu par `Hero`) dans la factory — pas d'injection directe.

---

## Niveaux en JSON, reste en TypeScript

**Contexte** : choix entre JSON pur, TypeScript pur, ou les deux.

**Décision** : `levels.json` (éditable) ponté par `levels.data.ts` (typage fort).

**Raisons** :
- Les niveaux sont la donnée la plus souvent modifiée par un game designer
- JSON = pas besoin de recompiler pour tester un nouveau niveau
- Le pont TypeScript assure l'autocomplétion et la validation de type au build

---

## `resolvePreviewCells` duplique la logique de `getAoeTargets`

**Contexte** : la preview AOE dans `CombatScene` a besoin des cases (positions), pas des unités.

**Décision** : duplication volontaire et documentée dans `resolvePreviewCells`.

**Raison** : `GridSystem.getAoeTargets` retourne des `GridUnit[]`, mais la preview a besoin de `GridPosition[]` (toutes les cases, même vides). Extraire une méthode partagée ajouterait une dépendance `CombatScene → GridSystem` plus profonde sans gain réel.

**Alternative possible** : ajouter `getAoeCellsForSkill(caster, skill): GridPosition[]` dans `GridSystem`. À réévaluer si la logique diverge davantage.

---

## Décisions visuelles

### Floating text : position capturée à la réception de l'event
**Raison** : l'ennemi peut mourir (et son sprite être détruit) entre l'émission de l'event et l'affichage différé (hitIndex * 120ms). On capture `container.x / container.y` immédiatement et on passe ces valeurs à `showFloatingTextAt`.

### `killTweensOf` avant tout nouveau flash
**Raison** : les AOE enchaînent des `flashSprite` sur plusieurs cibles simultanément. Sans `killTweensOf`, les tweens se cumulent et l'alpha ne remonte pas à 1 correctement.

### Frame 0 explicite à la création du sprite
**Raison** : sans frame initiale, Phaser affiche un carré barré pendant le split-second avant que `animator.play('idle')` ne soit appelé.

---

## Pas de supertype commun Hero/Enemy pour les skills ennemis

**Contexte** : implémentation des skills ennemis (symétrique au système héros). `processHeroTurn` et `processEnemyTurn` partagent la même structure logique (cible en portée ? sinon déplacement → skills → fin de tour).

**Décision** : dupliquer les méthodes de flux (`processEnemyTurn`, `executeEnemySkills`, `castEnemySkillsSequentially`, `endEnemyTurn`) plutôt que de fusionner avec leurs pendants héros. Seul le calcul d'impact pur (dégâts, multi-hit, stagger) est factorisé via `applySkillImpact<T extends DamageableUnit>`.

**Raisons** :
- `Hero` et `Enemy` n'ont pas de supertype commun ; les fusionner nécessiterait une interface `CombatUnit` non demandée et non documentée
- Les listes d'alliés/cibles (`this.heroes` / `this.enemies`) diffèrent structurellement selon le camp qui joue
- `handleDeath(id, isHero)` distingue déjà les deux camps pour les conditions de victoire — asymétrie déjà existante et assumée

**Alternative possible** : introduire `CombatUnit` (skills, attack, isAlive, heal?) implémentée par `Hero` et `Enemy`, pour unifier `processHeroTurn`/`processEnemyTurn` en une seule méthode paramétrée par camp. Non fait — refactor d'architecture à trancher explicitement si la duplication devient un problème réel (ex: 3e camp, mécaniques divergentes).
