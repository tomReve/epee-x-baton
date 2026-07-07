# 07 — TODO & Roadmap

## Priorité haute (prochaines sessions)

### Effets de statut / effets de sort spéciaux
- [ ] Poison (dégâts par tour)
- [ ] Burn (case appliquant des dégats sous certaines conditions)
- [ ] Stun / Frozen (passe le tour, empêche certaines actions) — dépend du refactor "déplacement avant/après skill"
- [ ] Shield (absorption de dégâts) — dépend de la décision Hero/Enemy (touche `takeDamage()`)
- [ ] Taunt / Fear (les ennemis focus / evite le joueur qui à taunter / fear) — à coordonner avec "ciblage intelligent"
- [ ] Buff/Debuff (améliore / diminue les statistiques du joueur (attaque / def / crit / speed / mouvement / etc))
- [ ] Dispel (retire les status)
- [ ] Lifesteal (soigne le héros de X% des dégats subits, ignore les dégats appliqués aux shields)
- [ ] Réduction de cooldown (réduit le cooldown de x sorts)
- [ ] Shield break (dommage supplémentaire sur les boucliers)
- [ ] Contre (renvoi de dégats)
- [ ] Ajouter `effects?: StatusEffect[]` dans `SkillData` dès maintenant pour préparer la structure
- [ ] **À trancher avant implémentation** : ordre d'application quand plusieurs effets actifs simultanément sur une même unité (ex: Poison + Burn + Shield en fin de tour)

### Ciblage intelligent
- [ ] Origine de zone pour un heal AOE actuellement toujours centrée sur le caster — à réévaluer si besoin de centrer sur un allié prioritaire, comme pour les dégâts AOE

## Priorité moyenne

### Avenir de la preview AOE
- [ ] Décision à terme : retirer la preview AOE du gameplay normal
- [ ] Possible conservation en mode debug uniquement (toggle dev)
- [ ] Si conservée en debug : décider si elle doit alors afficher la vraie zone géométrique (`getAoeCells`) plutôt que les seules cases occupées par des cibles résolues (comportement actuel)

### Skills avec déplacement ou crowd control
- [ ] Implémenter la possibilité d'avoir des skills qui déplace le personnage avant ou après l'attaque (dash, jump, teleportation, etc)
- [ ] Implémenter la possibilité d'avoir des skills qui déplace les ennemis (attirer, pousser, regrouper)

### Probabilité d'évènement
- [ ] Chance d'application (les effets de status peuvent avoir une chance d'application entre 1 et 100%)
- [ ] Chance de skill en chaine (chance de déclencher x fois des dégats)

### Coups critiques, esquives et autres stats secondaires
- [ ] `critRate?: number` sur `SkillData` ou `HeroDefinition`
- [ ] `missRate?: number` sur `EnemyDefinition`
- [ ] Floating text spécial pour les crits (taille plus grande, couleur différente)
- [ ] Reflexions sur d'autres stats à implémenter
- [ ] À faire avant la refonte du calcul de dégâts (ingrédient de cette refonte)

### Skills élémentaires
- [ ] Les skills élémentaires ont différent type (feu, eau, air, lumière, ténèbre)
- [ ] Certains ennemies sont plus résistant à un élément et plus faible à un autre
- [ ] Les héros peuvent renforcer leur affinité avec ou plusieurs éléments et augmenter leur résistance avec un ou plusieurs éléments

### Modification du calcul des dégats, effet de statut et buff
- [ ] Développer un system de calcul des dégats plus poussé
- [ ] Dégats de compétence en fonction des statistiques + valeur flat (attaque, maitrise physique, maitrise élémentaire)
- [ ] Scalling des sorts en fonction d'une statistique
- [ ] Calcul plus complexe que juste utilisé les valeurs flats (remplacer les formules comme dégats - défense = dégats appliqués)
- [ ] Regroupe les besoins de crit/miss + éléments : à faire une seule fois avec tous les ingrédients connus, pas en plusieurs passes

### Skills unique de début de combat
- [ ] Pouvoir créer des skills qui ne se déclenche qu'une fois au début du combat (effet de status la plupart du temps)

### Système de progression
- [ ] XP gagnée après combat (selon `xpReward` des ennemis vaincus)
- [ ] Niveau des héros : `+8% stats` par niveau (formule déjà dans `combat.factory.ts`)
- [ ] Sauvegarde `PlayerHeroState` dans localStorage
- [ ] Écran de résultat post-combat avec XP et gold gagnés
- [ ] Indépendant du reste — peut se faire en parallèle à tout moment

### Sélection de skills avant combat
- [ ] UI de sélection des 4 skills équipés parmi `HeroDefinition.availableSkills`
- [ ] Filtrage par classe (`getSkillsForClass(heroClass)` déjà implémenté dans `skills.data.ts`)
- [ ] Prévisualisation des skills (description, portée, AOE)

### Équipements
- [ ] Structure `Equipment` à définir dans `game.types.ts`
- [ ] `PlayerHeroState.equipment: EquipmentId[]` déjà prévu
- [ ] Bonus de stats ou de skills

### Tests unitaires (remonté de priorité basse)
- [ ] Tests sur `GridSystem.getAoeTargets` — zone touchée par quasi toutes les features à venir (stun, shield, ciblage intelligent)
- [ ] Tests sur le système de cooldown — historique de bug déjà rencontré (cooldown qui se relançait)
- [ ] Tests sur `TurnSystem` (ordre, gestion des morts)
- [ ] À faire avant d'attaquer les effets de statut pour sécuriser une base de non-régression

## Priorité basse

### Définir l'identité des classes et une bonne base de skills
- [ ] Réflexion sur l'identité des classes
- [ ] Réflexion et création d'une bonne liste de skills pour chaque classe correspondant à son rôle

### Classes évolutives
- [ ] Chaque classe à plusieurs niveaux de classe (exemple: archer → tireur d'élite → arbalétrier)
- [ ] Chaque niveau de classe débloque de nouveaux skills / charmes
- [ ] Les niveaux de classe se débloquent en remplissant certaines conditions

### Skills passifs (charmes)
- [ ] Les monstres et héros peuvent avoir X skills passifs en plus des skills actifs

### MapScene — Exploration du monde
- [ ] Carte du monde avec zones (forêt, donjon, etc.)
- [ ] Navigation entre les niveaux d'une zone
- [ ] Indicateur de progression (niveaux complétés, difficulté)
- [ ] Affichage de la puissance de l'équipe vs puissance du niveau (`evaluateMatchup`)

### Amélioration de l'IA ennemie
- [ ] Pathfinding A* pour contourner les unités
- [ ] Positionnement tactique (tanks en avant, rangés en retrait)
- [ ] Priorité de cible (attaquer le plus faible, le support en premier, etc.)

### Mega Boss
- [ ] Type `mega_boss` déjà défini dans `EnemyType`
- [ ] Stats et mécaniques à définir (phase 2 quand HP < 50% ?)
- [ ] Prend plusieurs cases

### Mode `damage_race`
- [ ] Type `CombatMode = 'eliminate' | 'damage_race'` déjà défini dans `CombatSystem`
- [ ] En `damage_race` : `combat_timeout` → score de dégâts au lieu de défaite
- [ ] Affichage du score en temps réel

### Effets visuels avancés des skills
- [ ] Projectiles (flèches pour l'archer, boules de feu pour le moine)
- [ ] Effets de particules sur impact
- [ ] Animation de skill distincte selon le type (physique vs magique)

### UI améliorée
- [ ] Portraits des héros dans la skill bar
- [ ] Icônes de skills (assets ou générées)
- [ ] Chat serveur (décoratif, style Sword x Staff)
- [ ] Indicateur de tour actif sur le sprite de l'unité (cercle lumineux au sol)

### Contrôle de vitesse de combat
- [ ] Vitesse x2 / x4 pour accélérer les combats longs (standard du genre auto-battler)

### Hot-reload
- [ ] Hot-reload des données JSON sans restart du serveur de dev

## À confirmer

- [ ] **Mega boss** : mêmes stats/skills qu'un boss mais avec une phase 2 ? Mécaniques spéciales ?
- [ ] **Sauvegarde** : localStorage uniquement, ou API backend prévu ?
- [ ] **Multi-héros** : combien de héros max dans une équipe ? (actuellement 2, données prévoient 4 classes)
- [ ] **Mort des héros** : les héros sont "permanents" — mais peuvent-ils être KO temporairement en combat et se relever ?
- [ ] **Gold** : à quoi servira-t-il ? Équipements ? Upgrades de skills ?
- [ ] **Statuts persistants** : un buff/debuff peut-il survivre à la fin d'un combat, ou tout est reset systématiquement ?
- [ ] **Resize mobile** : le resize restart actuellement toute la scène (`scale.on('resize') → scene.restart()`) — acceptable si rotation d'écran en cours de combat sur mobile/PWA, ou à traiter différemment ?

## Veille technique (pas d'action requise pour l'instant)
- [ ] `isHero` existe en triple source (`GridUnit.isHero`, `TurnUnit.isHero`, appartenance à `heroes[]`/`enemies[]` dans `CombatSystem`) — à surveiller si une feature (invocation, pet temporaire) introduit une unité qui change de camp ou n'est pas connue à la construction du combat
- [ ] `CombatSystem.handleDeath` suppose `this.heroes`/`this.enemies` figés depuis le début du combat pour la détection victoire/défaite — à revoir si une feature d'invocation en cours de combat est ajoutée
- [ ] `resolvePreviewCells` dans `CombatScene.ts` reste une duplication assumée de `GridSystem.getAoeTargets` (déjà documentée dans `04_DECISIONS.md`) — à réévaluer si la logique de ciblage diverge davantage (ex: ciblage intelligent, ciblage allié)