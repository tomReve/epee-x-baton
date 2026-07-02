# 07 — TODO & Roadmap

## Priorité haute (prochaines sessions)

### Skills ennemis
- [ ] Implémenter `processEnemySkillTurn` dans `CombatSystem` sur le modèle de `processHeroTurn`
- [ ] Supprimer `ENEMY_RANGE = 1` hardcodé dans `processEnemyTurn`
- [ ] Les ennemis normaux utilisent 2 skills, les boss 3 (dont un ulti)
- [ ] Appliquer le même système de cooldown en tours que les héros

### Déplacement après attaque dans le même tour
- [ ] Un héros peut se déplacer **avant et/ou après** ses skills dans le même tour
- [ ] Structure du tour : [move?] → [skills] → [move?]
- [ ] Permet d'attaquer un ennemi, de le finir, puis de se repositionner pour le suivant
- [ ] Implique de refactoriser `processHeroTurn` pour séparer les phases de déplacement et d'attaque

### Ciblage intelligent
- [ ] Maximiser les cibles touchées par une AOE (choisir la position/cible qui touche le plus d'ennemis)
- [ ] Cibler le plus faible (pour finir rapidement)
- [ ] Cibler le plus dangereux (celui avec le plus d'ATK)
- [ ] Configurable par skill ou par type d'ennemi

## Priorité moyenne

### Effets de statut
- [ ] Poison (dégâts par tour)
- [ ] Stun (passe le tour)
- [ ] Shield (absorption de dégâts)
- [ ] Burn (version magic du poison)
- [ ] Ajouter `effects?: StatusEffect[]` dans `SkillData` dès maintenant pour préparer la structure

### Ciblage côté allié (heal/buff)
- [ ] `targetSide: 'enemy' | 'ally'` dans `SkillData`
- [ ] Permettre aux skills de soin de cibler l'allié le plus bas en HP
- [ ] Le soin actuel est uniquement sur le caster — à étendre

### Coups critiques et esquives
- [ ] `critRate?: number` sur `SkillData` ou `HeroDefinition`
- [ ] `missRate?: number` sur `EnemyDefinition`
- [ ] Floating text spécial pour les crits (taille plus grande, couleur différente)

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
- [ ] **Skill targeting** : un héros peut-il avoir un skill qui cible un allié autre que lui-même ?
- [ ] **Mort des héros** : les héros sont "permanents" — mais peuvent-ils être KO temporairement en combat et se relever ?
- [ ] **Gold** : à quoi servira-t-il ? Équipements ? Upgrades de skills ?
