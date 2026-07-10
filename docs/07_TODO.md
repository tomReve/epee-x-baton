# 07 — TODO & Roadmap

## Priorité haute (prochaines sessions)

### Effets de statut (implémenter au moins un sort avec l'effet de statut développé)
- [x] Infrastructure de base posée : `StatusEffectDefinition`, `StatusEffect` (runtime), `CombatUnit.statusEffects` — catalogue vide, non branché dans `CombatSystem`
- [x] Stun (passe le tour, empêche l'action) Décisions déjà actées : cooldowns tickent normalement pendant le tour raté ; le tick de durée du stun se fait en fin de tour (même timing que `tickSkillCooldowns`), pour que `durationTurns: N` bloque exactement N tours
- [ ] Poison (dégâts par tour) — `tickTiming` autre que `'turn_end'` à définir (ex: `'turn_start'`), pas encore supporté par l'infra actuelle
- [ ] Sort déclenchant un effet (par exemple, un sort des déclenche le poison)
- [ ] Burn (case appliquant des dégâts) — `tickTiming` autre que `'turn_end'` à définir (ex: `'on_move'`), pas encore supporté par l'infra actuelle
- [ ] Buff/Debuff stats (attaque/def/crit/speed/mouvement)
- [ ] Taunt / Fear — à coordonner avec le ciblage intelligent existant
- [ ] Contre (renvoi de dégâts)
- [ ] **À trancher avant implémentation** : ordre d'application quand plusieurs effets actifs simultanément sur une même unité (ex: Poison + Burn + Shield en fin de tour)
- [ ] **Chance d'application** : `SkillEffectApplication.chance` existe dans le type mais n'est pas encore lu — tout effet listé dans `effects[]` est actuellement appliqué à 100%
- [ ] **Feedback visuel des effets de statut** : icône ou indicateur à côté du sprite de l'unité affectée (`CombatScene` ne traite pas encore l'event `unit_stunned`, ni aucun affichage de statut actif) — à cadrer avec le reste de l'UI (timeline, HP bars)

### Propriétés / effets de sort ponctuelles résolus à l'impact d'un skill :
- [ ] Cadrer le fonctionnement pour centraliser un maximum ce genre de propriétés sans divergé de l'architecture actuelle
- [ ] Shield (absorption de dégâts) - Applique un bouclier protégeant de x degats avant de toucher les PV réels
- [ ] Dispel (retire les statuts, négatif si cible allié, positif si cible ennemi)
- [ ] Lifesteal — pas un statut, un champ `lifesteal?: number` sur `SkillDefinition`, lu dans `applySkillImpact` (voir 04_DECISIONS.md)
- [ ] Réduction de cooldown
- [ ] Shield break — dépend de Shield ; champ dédié lu au même point que le shield, pas un statut

## Priorité moyenne

### Effet de flicker quand dégats subit
- [ ] Supprimer l'effet de flicker lors d'un soin et appliqué un effet plus cohérent (j'ai un asset , ça serait top de l'implémenter)

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

### Tests unitaires
- [ ] `tests/data/power.test.ts` — `computeHeroPower`, `computeTeamPower`, `computeLevelPower`, `evaluateMatchup` (seuils strong/even/weak) -> ne pas faire pour l'instant car pas utiliser

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

### HP partiel en début de combat (exploration/nourriture)
- [ ] `CombatUnit.currentHp` s'initialise désormais depuis `data.hp` (pas `maxHp`) — changement fait en prévision, sans effet actuel (`combat.factory.ts` envoie toujours `hp === maxHp`)
- [ ] Reste à faire : `combat.factory.ts` doit recevoir et transmettre le HP courant réel du héros (persisté hors combat, pas de récup après combat/en donjon, géré via système de nourriture à définir)
- [ ] Dépend de : système de progression/sauvegarde (`PlayerHeroState`) + mécanique nourriture non encore spécifiée

## Priorité basse

### Sytème de tags sur les skills
- [ ] Implémenté un système de tag sur les skills (exemple : attack, debuff, etc) purement informatif (reflexion sur quelque chose d'automatisé ou manuel)

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

### Hot-reload
- [ ] Hot-reload des données JSON sans restart du serveur de dev

### Back-end et BDD
- [ ] Construire un backend et une base de données pour stocker les informations (statiques (sorts/infos heros et monstre de base, etc) et dynamique (progression))

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