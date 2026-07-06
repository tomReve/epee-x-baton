# 08 — Changelog

Historique des grandes décisions et évolutions du projet, dans l'ordre chronologique de développement.

---

## Phase 1 — Mise en place

### Setup initial
- Initialisation Vite + TypeScript + Phaser 3
- Structure de base : `main.ts`, `CombatScene.ts`, `Hero.ts`, `Enemy.ts`, `Skill.ts`
- Premier prototype de combat auto avec `setInterval` global (toutes les unités tickent ensemble)
- Cooldowns basés sur le temps (`Date.now()`)
- Premier `EventBus` pour la communication inter-scènes

### Ajout de la grille
- `GridSystem.ts` — grille logique indépendante de Phaser
- Distance de Manhattan pour les portées
- `GridUnit` avec `attackRange` (retiré plus tard)
- `moveTowardNearest()` — IA simple de déplacement

---

## Phase 2 — Système de combat

### Passage au tour par tour
- Suppression du `setInterval` global
- Création de `TurnSystem.ts` — tri des unités par speed, gestion du round
- `CombatSystem` devient event-driven : une action → un callback → prochain tour
- Ajout du type `CombatEvent` et de `CombatEventCallback`
- Timeline UI des tours en haut de l'écran

### Damier partagé
- Suppression des zones réservées héros/ennemis
- `isCellFree` et `getReachableCells` sans filtrage de camp

### Déplacement + attaque dans le même tour
- Un héros peut se déplacer ET attaquer dans le même tour
- `setTimeout` de `MOVE_ANIM_DELAY` avant de tenter l'attaque post-déplacement

### Sprites et animations
- `BootScene.ts` — chargement des spritesheets, création des animations Phaser
- `UnitAnimator.ts` — gestion idle/walk/attack avec retour auto idle
- Format : spritesheet 192×192 par frame, fichier séparé par animation
- Fix carré barré : frame 0 explicite à la création du sprite

### Phase de préparation
- Overlay "Préparez-vous" + bouton "Combattre" avant le lancement
- `CombatSystem` ne tourne pas pendant cette phase

### Limite de rounds et résultats
- `maxRounds` configurable
- Event `combat_timeout` + panneau de résultat (won/lost/timeout)
- Boutons Pause et Restart

---

## Phase 3 — Skills avancés

### Cooldowns en tours (refactoring majeur)
- Suppression des cooldowns en millisecondes
- `cooldownTurns: number` dans `SkillData`
- `turnsRemaining` initialisé dans le constructeur (cooldown initial actif)
- `tickCooldown()` en fin de tour, uniquement sur les skills non utilisés
- `Set<string> usedThisTurn` transmis à `endHeroTurn()` pour exclusion du tick
- `finishTurn()` comme point de convergence unique (suppression de `advanceTurn()`)

### Suppression de l'attaque de base
- Les héros n'attaquent plus en dehors de leurs skills
- Un héros sans skill prêt ne fait rien ce tour

### Multi-skill par tour
- `castSkillsSequentially` — enchaîne tous les skills prêts dans le même tour
- `usedThisTurn` accumule tous les skills castés pour le tick en fin de tour

### Multi-hit
- `hits?: number` dans `SkillData`
- Impacts échelonnés avec `HIT_STAGGER = 120ms`
- `hitIndex` et `totalHits` dans `CombatEvent` pour le floating text décalé

### Re-ciblage après kill
- Cibles recalculées à chaque skill dans la chaîne
- Si cible morte → skill suivant tente de trouver une nouvelle cible en range

### AOE et zones d'effet
- `targetType: 'single' | 'aoe' | 'all'` dans `SkillData`
- `AoeShape` : `radius`, `square`, `cross`, `line`, `all`
- `range: 0` = centré sur le caster
- `GridSystem.getAoeCells()` et `getAoeTargets()` — résolution pure sans logique Phaser

### Range par skill (refactoring)
- Suppression de `attackRange` sur `GridUnit`
- `range: number` sur chaque `SkillData`
- `getTargetsInRange()` (hardcodée à 1) remplacée par `getTargetsInSkillRange(unit, range)`

### Skills de soin
- Fix : `heal && !damage` → ne cherche pas de cibles ennemies, s'applique sur le caster
- Fix : si un skill n'a pas de cible → passer au suivant (pas de fin de tour prématurée)

### Preview AOE
- Event `skill_preview` émis 400ms avant l'impact
- Surlignage des cases touchées (orange/violet/vert selon type)
- Pulsation via tween alpha
- Event `skill_preview_clear` à l'impact

---

## Phase 4 — Affichage

### Terrain
- Tileset `Tilemap_color1.png` (64×64, 9 colonnes)
- Overlay de grille subtil (contour + alternance sombre)
- Fond vert foncé adapté à l'ambiance forêt

### Floating damage numbers
- Style 1 retenu : italique, contour épais, rotation -8°, pop + montée + fade
- `showFloatingTextAt(x, y)` pour capture de position avant délai (fix mort de cible)
- Décalage horizontal progressif pour multi-hit
- `padding: { right: 20 }` pour éviter le crop de l'italique

### UI Cooldowns
- Slots de skills par héros en bas de l'écran
- Overlay sombre + chiffre quand en cooldown
- Mise à jour ciblée par skill (`skillId` dans `cooldowns_updated`) ou globale (fin de tour)
- Rafraîchissement à `turn_start` pour l'unité qui joue

### Flash sprite
- `killTweensOf(container)` avant tout nouveau flash (fix cumul alpha sur AOE)
- `onComplete: container.setAlpha(1)` pour garantir le retour à pleine opacité

---

## Phase 5 — Couche de données

### Refactoring CombatScene / CombatSystem
- Double instanciation de `CombatSystem` supprimée
- `onAnimationComplete()` (mort) supprimé
- `CombatMode` déplacé en type exporté
- `getTargetsInRange()` supprimée de `GridSystem`
- Import inline dynamique dans `GridSystem` nettoyé
- Constantes de timing extraites (`TURN_DELAY`, `PREVIEW_DELAY`, etc.)
- `interface Placement` et `interface SkillSlotRefs` sorties des méthodes

### Séparation données / scènes
- Nouveaux fichiers : `game.types.ts`, `skills.data.ts`, `heroes.data.ts`, `enemies.data.ts`, `levels.data.ts`, `levels.json`
- `combat.factory.ts` — `buildCombatSetup(level, heroStates)` remplace `initEntities()` + `initPlacements()`
- `power.ts` — calcul de puissance des équipes, `evaluateMatchup()`
- `PlayerHeroState` séparé de `HeroDefinition`

### Fix migration factory
- `SkillDefinition` → `SkillData` mappée explicitement dans `buildHero()` et `buildEnemy()`
- Sans ce mapping, `Skill.isReady()` ne fonctionnait pas (objet sans méthodes)

### Classes de héros
- Warrior (tank), Monk (support/soin), Archer (DPS distance), Lancer (DPS mêlée)
- 5 skills disponibles par classe, 4 équipés
- `getSpriteKey()` mis à jour avec les nouveaux ids de classe

---

## Phase 6 — Skills ennemis

### Enemy passe d'une attaque hardcodée à un système de skills complet
- `Enemy.ts` reçoit les mêmes primitives runtime que `Hero.ts` : `skills: Skill[]`, `getReadySkill()`, `tickSkillCooldowns(usedSkillIds)`
- Suppression de `ENEMY_RANGE = 1` hardcodé et de l'attaque simple dans `CombatSystem.processEnemyTurn`

### processEnemyTurn refondu sur le modèle héros
- `executeEnemySkills` / `castEnemySkillsSequentially` / `endEnemyTurn`, symétriques à leurs pendants héros
- Cooldown en tours, `usedThisTurn: Set<string>` exclu du tick, preview AOE avant impact

### Suppression des events `hero_attack` / `enemy_attack`
- Tous les dégâts (héros comme ennemis) passent par `skill_used`

### Factorisation applySkillImpact
- Nouvelle méthode privée dans `CombatSystem`, partagée entre `useHeroSkill` et `useEnemySkill`
- Choix documenté : pas de fusion `processHeroTurn`/`processEnemyTurn` (Hero et Enemy sans supertype commun)

## Phase 7 — Unification Hero/Enemy

### Classe commune CombatUnit
- Nouvelle classe abstraite `entities/CombatUnit.ts` : porte `data`, `skills`, `currentHp`, `isAlive()`, `takeDamage()`, `heal()`, `getReadySkill()`, `tickSkillCooldowns()`
- `Hero` et `Enemy` allégés, héritent de `CombatUnit`
- Renverse la décision documentée en Phase 6 ("pas de supertype commun") — justifiée par l'absence de divergence runtime réelle entre les deux camps

### Retrait xpReward/goldReward d'Enemy
- Champs jamais utilisés dans le code, retirés d'`EnemyDefinition`, `enemies.data.ts`, `combat.factory.ts`
- Seront réintroduits plus tard au niveau `LevelDefinition`, avec composante aléatoire

### Fusion complète CombatSystem
- `processHeroTurn`/`processEnemyTurn` → `processUnitTurn` unique, générique sur `CombatUnit`
- Idem pour `executeSkills`, `castSkillsSequentially`, `useSkill`, `endTurn`, `applySkillImpact`, `handleDeath`
- Le seul point restant sensible au camp : `processTurn()`, via `TurnUnit.isHero`
- `hero_died`/`enemy_died` fusionnés en `unit_died` (traitement identique des deux côtés, distinction inutilisée)

### Code mort supprimé
- `lastAttack`, `canAttack()`, `attack()` retirés de `Hero`/`Enemy` (inutilisés depuis la suppression de l'attaque de base en Phase 3)

---

## Phase 8 — Repositionnement inter-skills

### Déplacement avant chaque skill de la chaîne
- `castSkillsSequentially` : si un skill (hors support) n'a pas de cible en portée, tentative de repositionnement via `tryRepositionForSkill` avant de passer au skill suivant
- Ancien move-before de `processUnitTurn` supprimé, remplacé par ce point de vérification unique répété avant chaque skill
- `GridSystem.getReachableCells`/`moveTowardNearest` acceptent un `maxDistance` optionnel — `moveTowardNearest` retourne `{ pos, distance }` pour permettre le décompte de budget

### Budget de déplacement par tour
- `moveBudget` initialisé à `gridUnit.moveRange`, consommé en cases cumulées (pas en nombre de déplacements), transmis en paramètre dans toute la chaîne d'appels — même pattern que `usedThisTurn`

### Uniformisation moveRange
- `MOVE_RANGE_NORMAL = 4` ajoutée dans `heroes.data.ts` et `enemies.data.ts`, remplace les valeurs 2/3 précédentes par unité

---

## Phase 9 — Ciblage par camp et priorité

### targetSide et targetPriority
- `SkillDefinition`/`SkillData` : `targetSide?: 'enemy' | 'ally'` (défaut `'enemy'`), `targetPriority?: 'first' | 'lowest_hp' | 'highest_attack'` (défaut `'first'`)
- `GridSystem.getTargetsInSkillRange(unit, range, side, includeSelf)` — signature paramétrée, remplace l'ancienne version implicitement `'enemy'` sans self
- `GridSystem.hasAnyTargetInSkillRange` supprimée (inutilisée)
- `GridSystem.getAoeTargets` : origine de zone forcée sur le caster quand `targetSide: 'ally'` (pas de recherche de cible qui exclurait le caster)
- `CombatSystem` : `allies` propagé dans toute la chaîne (`processUnitTurn` → `castSkillsSequentially` → `tryRepositionForSkill` → `castSkillNow`), `applyTargetPriority()` trie les cibles déjà résolues (HP/attack), appliqué dans `resolveLiveTargets()`
- `useSkill()` : le heal boucle désormais sur tous les `targets` (au lieu de `targets[0]` uniquement) — permet le heal de zone

### SkillData dérivé de SkillDefinition
- `SkillData = Omit<SkillDefinition, 'description' | 'availableFor'>` remplace l'interface dupliquée — un seul endroit à maintenir pour les champs partagés
- `AoeShape` déplacée dans `game.types.ts`, ré-exportée depuis `entities/Skill.ts` (aucun import existant cassé)

### Preview AOE pilotée par les cibles résolues
- `CombatEvent.previewTargets: string[]` — ids des cibles déjà résolues par `CombatSystem`, transmis à l'event `skill_preview`
- `CombatScene.resolvePreviewCells` supprimée (dupliquait `GridSystem.getAoeTargets`) — remplacée par un lookup direct des positions via `previewTargets`
- `CombatEvent.isHeal` ajouté — `CombatScene` n'a plus besoin de déduire `isHeal` par comparaison `target === source`, fragile dès qu'un heal peut cibler un autre allié
- **Limite actée** : la preview reflète les cibles réellement ciblées, pas la zone géométrique brute — un heal de zone avec peu d'alliés dans la zone affiche peu de cases. Retrait de la preview envisagé à terme (voir `07_TODO.md`)

### Nouveaux skills
- `monk_heal` migré : `range: 0 → 3`, `targetSide: 'ally'`, `targetPriority: 'lowest_hp'` (cible l'allié le plus bas en HP à portée, caster inclus)
- `monk_sanctuary` ajouté : soin de zone (`targetType: 'aoe'`, `targetSide: 'ally'`, `aoe: radius 2`), zone centrée sur le caster

---

## Bugs résolus notables

| Bug | Cause | Fix |
|---|---|---|
| Combat bloqué sur le premier ennemi | `this.turns.next()` manquant dans `finishTurn()` | Restauré |
| Carré barré au chargement des sprites | Pas de frame initiale avant `play()` | Frame 0 explicite à la création |
| Sprites invisibles jusqu'au premier déplacement | `setAlpha(0)` + `animationstart` non déclenché | Suppression du hack, frame 0 à la création |
| Cooldown de 1 se relançait chaque tour | Tick appliqué au skill qui venait d'être utilisé | `usedThisTurn` Set pour exclusion du tick |
| Multi-hit bloquait le tour suivant | `advanceTurn()` appelé plusieurs fois | `finishTurn()` centralisé avec délai calculé |
| Flash sprite restait à faible opacité (AOE) | Tweens qui se cumulent | `killTweensOf()` avant chaque flash |
| Dégâts non affichés si ennemi mort pendant multi-hit | Position lue après destruction du sprite | Position capturée à la réception de l'event |
| Monk ne lançait jamais ses sorts | `SkillDefinition` injectée directement sans mapping → pas de `isReady()` | Mapping explicite vers `SkillData` dans factory |
| Sort sans cible terminait tout le tour | `endHeroTurn()` appelé si `liveTargets.length === 0` | Passage au skill suivant à la place |
| Barre HP décalée (fill vs bg) | Origines inconsistantes entre les deux rectangles | `setOrigin(0, 0.5)` sur les deux, même `x` ancrage gauche |
| Preview jamais affichée | `previewTargets` non peuplé dans l'event `skill_preview` | Ajout de `previewTargets: liveTargets.map(t => t.data.id)` dans `castSkillNow` |
| Monk ne se soigne jamais lui-même en repositionnement, mais ne rate pas non plus un autre allié en range | `includeSelf: false` en dur dans `getAoeTargets` pour `targetType: 'single'` dès que `range > 0` | `includeSelf: true` pour tout `side === 'ally'`, indépendamment de la range |
| Heal de zone ne soigne qu'une seule cible | `useSkill` appliquait le heal sur `targets[0]` uniquement | Boucle sur tous les `targets`, un event `skill_used` par cible |
