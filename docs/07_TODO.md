# 07 — TODO & Roadmap

## Priorité haute (prochaines sessions)

### Déplacement après attaque dans le même tour
- [ ] Un héros ou un ennemi peut se déplacer **avant et/ou après** ses skills dans le même tour
- [ ] Structure du tour : [move?] → [skills] → [move?]
- [ ] Permet d'attaquer un ennemi, de le finir, puis de se repositionner pour le suivant
- [ ] Implique de refactoriser `processXTurn` pour séparer les phases de déplacement et d'attaque
- [ ] Peut-être est-ce le moment de réfactoriser Hero et Ennemy, pour les combats et les statistiques ils suivent plutôt la même logique. C'est en dehors des combats qu'ils sera différents (progression de heros que les ennemis n'ont pas). Avoir une classe parente ? (fais mois un état des lieux de leurs différences à date)

### Ciblage intelligent
- [ ] Maximiser les cibles touchées par une AOE (choisir la position/cible qui touche le plus d'ennemis)
- [ ] Cibler le plus faible (pour finir rapidement)
- [ ] Cibler le plus dangereux (celui avec le plus d'ATK)
- [ ] Configurable par skill (exemple : monocible avec gros dégat focus le monstre avec le plus de HP, sort pour cibler les ennemis avec le moins / le plus de PV)

## Priorité moyenne

### Skills avec déplacement ou crownd crontrol
- [ ] Implémenter la possibilité d'avoir des skills qui déplace le personnage avant ou après l'attaque (dash, jump, teleportation, etc)
- [ ] Implémenter la possibilité d'avoir des skills qui déplace les ennemis (attirer, pousser, regrouper)

### Effets de statut / effet de sort spéciaux
- [ ] Poison (dégâts par tour)
- [ ] Burn (case appliquant des dégats sous certaines conditions)
- [ ] Stun / Frozen (passe le tour, empêche certaines actions)
- [ ] Shield (absorption de dégâts)
- [ ] Taunt / Fear (les ennemis focus / evite le joueur qui à taunter / fear)
- [ ] Buff/Debuff (améliore / diminue les statistiques du joueur (attaque / def / crit / speed / mouvement / etc))
- [ ] Dispel (retire les status)
- [ ] Lifesteal (soigne le héros de X% des dégats subits, ignore les dégats appliqués aux shields)
- [ ] Réduction de cooldown (réduit le cooldown de x sorts)
- [ ] Shield break (dommage supplémentaire sur les boucliers)
- [ ] Contre (renvoi de dégats)
- [ ] Ajouter `effects?: StatusEffect[]` dans `SkillData` dès maintenant pour préparer la structure

### Probabilité d'évènement : 
- [ ] Chance d'application (les effets de status peuvent avoir une chance d'application entre 1 et 100%)
- [ ] Chance de skill en chaine (chance de déclencher x fois des dégats )

### Ciblage côté allié (heal/buff)
- [ ] `targetSide: 'enemy' | 'ally'` dans `SkillData`
- [ ] Permettre aux skills de soin de cibler l'allié le plus bas en HP
- [ ] Le soin actuel est uniquement sur le caster — à étendre
- [ ] Les soins et buff peuvent être de zone

### Coups critiques, esquives et autres stats secondaires
- [ ] `critRate?: number` sur `SkillData` ou `HeroDefinition`
- [ ] `missRate?: number` sur `EnemyDefinition`
- [ ] Floating text spécial pour les crits (taille plus grande, couleur différente)
- [ ] Reflexions sur d'autres stats à implémenter

### Modification du calcul des dégats, effet de statut et buff
- [ ] Développer un system de calcul des dégats plus poussé
- [ ] Dégats de compétence en fonction des statistiques + valeur flat (attaque, maitrise physique, maitrise élémentaire)
- [ ] Scalling des sorts en fonction d'une statistique
- [ ] Calcul plus complexe que juste utilisé les valeurs flats (remplacer les formules comme dégats - défense = dégats appliqués)

### Skills élémentaires
- [ ] Les skills élémentaires ont différent type (feu, eau, air, lumière, ténèbre)
- [ ] Certains ennemies sont plus résistant à un élément et plus faible à un autre
- [ ] Les héros peuvent renforcer leur affinité avec ou plusieurs éléments et augmenter leur résistance avec un ou plusieurs éléments

### Skills unique de début de combat
- [] Pouvoir créer des skills qui ne se déclenche qu'une fois au début du combat (effet de status la plupart du temps)

### Système de progression
- [ ] XP gagnée après combat (selon `xpReward` des ennemis vaincus)
- [ ] Niveau des héros : `+8% stats` par niveau (formule déjà dans `combat.factory.ts`)
- [ ] Sauvegarde `PlayerHeroState` dans localStorage
- [ ] Écran de résultat post-combat avec XP et gold gagnés

### Sélection de skills avant combat
- [ ] UI de sélection des 4 skills équipés parmi `HeroDefinition.availableSkills`
- [ ] Filtrage par classe (`getSkillsForClass(heroClass)` déjà implémenté dans `skills.data.ts`)
- [ ] Prévisualisation des skills (description, portée, AOE)

### Équipements
- [ ] Structure `Equipment` à définir dans `game.types.ts`
- [ ] `PlayerHeroState.equipment: EquipmentId[]` déjà prévu
- [ ] Bonus de stats ou de skills

## Priorité basse

### Définir l'identité des classe et une bonne base de skills
- [] Réflexion sur l'identité des classes
- [] Réflexion et création d'une bonne liste de skills pour chaque class correspondant à son rôle

### Classes évolutives
- [] Chaque classes à plusieurs niveau de classes (exemple: archer -> tirreur d'élite -> Arbalétrier)
- [] Chaque niveau de classe débloque de nouveaux skills / charmes
- [] Les niveaux de classes se débloquent en remplissant certaines conditions

### Skills passifs (charmes)
- [] Les monstres et héros peuvent avoir X skills passifs en plus des skills actifs

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

### Technique
- [ ] Tests unitaires sur `GridSystem` (calculs AOE, pathfinding)
- [ ] Tests unitaires sur `TurnSystem` (ordre, gestion des morts)
- [ ] Tests unitaires sur le système de cooldown
- [ ] Hot-reload des données JSON sans restart du serveur de dev

## À confirmer

- [ ] **Mega boss** : mêmes stats/skills qu'un boss mais avec une phase 2 ? Mécaniques spéciales ?
- [ ] **Sauvegarde** : localStorage uniquement, ou API backend prévu ?
- [ ] **Multi-héros** : combien de héros max dans une équipe ? (actuellement 2, données prévoient 4 classes)
- [ ] **Mort des héros** : les héros sont "permanents" — mais peuvent-ils être KO temporairement en combat et se relever ?
- [ ] **Gold** : à quoi servira-t-il ? Équipements ? Upgrades de skills ?
