# 03 — Features

## Features implémentées

### Système de combat — Core

#### Tour par tour basé sur la vitesse
- Toutes les unités (héros + ennemis) sont triées par `speed` décroissante dans `TurnSystem`
- Égalité de speed : héros avant ennemis, puis tri alphabétique par id
- Les unités mortes sont retirées de la queue immédiatement via `removeUnit(id)`
- Rebouclage automatique quand toutes les unités ont joué → nouveau round

#### Déplacement + attaque dans le même tour
- Si aucune cible n'est à portée d'un skill prêt → déplacement vers le plus proche
- Après déplacement, re-vérification des cibles → attaque si une cible est maintenant à portée
- Si toujours pas de cible après déplacement → fin de tour

#### Système de skills
- Chaque héros dispose de **4 skills équipés**
- Plusieurs skills peuvent être lancés dans le même tour si leurs cooldowns sont à 0
- Les skills sont enchaînés via `castSkillsSequentially` avec délai visuel entre chaque
- Si un skill n'a pas de cible, on passe au suivant (pas de fin de tour prématurée)

#### Ciblage par camp et priorité
- `targetSide?: 'enemy' | 'ally'` sur `SkillData` — défaut `'enemy'` si absent (comportement historique inchangé)
- `targetPriority?: 'first' | 'lowest_hp' | 'highest_attack'` — trie les cibles déjà résolues en range ; `'first'` = comportement historique
- Le caster est un candidat valide pour un skill `targetSide: 'ally'` (peut se cibler lui-même)
- Résolution : `GridSystem.getAoeTargets` filtre par camp + géométrie, `CombatSystem.applyTargetPriority` trie ensuite selon les stats (HP/attack) — `GridSystem` reste ignorant des stats de combat
- Heal de zone (`targetType: 'aoe'` + `targetSide: 'ally'`) : tous les alliés dans la zone sont soignés (event `skill_used` par cible), zone toujours centrée sur le caster (choix simple retenu, pas de ciblage d'origine intelligent pour l'instant)

#### Ciblage intelligent — repositionnement conscient de la priorité (single target)
- Pour les skills `targetType: 'single'` avec `targetPriority` défini (`lowest_hp`/`highest_attack`), si la meilleure cible n'est pas en range, l'unité se déplace vers elle plutôt que vers l'ennemi le plus proche
- Sans priorité (`'first'`, comportement par défaut) : repositionnement inchangé, toujours vers la cible la plus proche (maximise le mouvement restant pour la suite du tour)
- `lowest_hp` compare le **ratio** `currentHp / maxHp`, pas la valeur flat — une unité à faible maxHp et pleine vie n'est plus jugée prioritaire face à une unité à gros maxHp mais fortement endommagée en proportion
- Le déplacement vise la case atteignable la plus proche du point de départ qui met la cible en range (pas la case la plus proche de la cible) — évite les déplacements superflus quand une case proche suffit déjà
- `getAoeTargets` (GridSystem) ne coupe plus à 1 candidat pour `single` : toutes les cibles en range remontent, le tri par priorité puis la coupe à 1 se font dans `CombatSystem.applyTargetPriority`

#### Ciblage intelligent — maximisation AOE
- Pour les skills `targetType: 'aoe'` (offensifs ou heals de zone ally), le système recherche systématiquement, parmi toutes les cases atteignables, celle qui maximise le nombre de cibles adverses ou alliées touchées par la zone — pas seulement en fallback quand 0 cible n'est en portée
- Le repositionnement n'a lieu que si une case atteignable touche **strictement plus** d'ennemis que la position actuelle (sinon le `moveBudget` est préservé pour la suite du tour)
- `range: 0` (AOE centrée sur le caster, ex: Whirlwind, Shockwave) : chaque case candidate est elle-même testée comme origine de zone
- `range > 0` (ex: Rain of Arrows, Nova) : pour chaque case candidate, toutes les cibles adverses atteignables depuis cette case servent d'origine potentielle, le meilleur score parmi elles est retenu
- `GridSystem.findBestAoePosition(unit, skill, maxDistance?)` — nouvelle méthode, géométrie pure, réutilise `getAoeCells`
- Égalité de score : la case la plus proche du point de départ est privilégiée (cohérent avec le principe déjà en place pour le ciblage single-target)
- Pour un heal de zone (`targetSide: 'ally'`), le caster compte lui-même comme cible valide (`includeSelf`), cohérent avec `GridSystem.getAoeTargets`
- Hors scope : `targetType: 'all'` (pas de notion de position) ; heal de zone avec `range > 0` non supporté — la règle `range: 0 = centré sur le caster` (voir `02_RULES.md`) s'applique strictement aux heals de zone, aucune origine alternative n'est recherchée

#### Cooldowns en tours
- `cooldownTurns: 0` → relançable chaque tour
- `cooldownTurns: N` → N tours d'attente après utilisation
- Cooldown initial actif dès le début du combat
- Tick en fin de tour, uniquement sur les skills non utilisés ce tour

#### Re-ciblage après kill
- Les cibles sont recalculées à chaque skill dans la chaîne
- Si la cible meurt pendant le multi-skill, le skill suivant cible un autre ennemi en range

#### Multi-hit
- `hits: N` sur un skill → N impacts échelonnés (`HIT_STAGGER = 120ms` entre chaque)
- Chaque coup émet son propre event `skill_used` avec `hitIndex` et `totalHits`

#### Skills ennemis
- Les ennemis disposent des mêmes primitives runtime que les héros via `CombatUnit` : `skills: Skill[]`, cooldowns en tours, `usedThisTurn` exclu du tick, `heal()`
- `CombatSystem` traite héros et ennemis avec un flux unique (`processUnitTurn`), sans distinction de code entre les deux camps
- Ennemis normaux : 2 skills équipés (`enemies.data.ts`) ; boss : 3 skills (dont un ulti)
- Preview AOE, multi-hit et re-ciblage après kill s'appliquent identiquement aux deux camps
- `applySkillImpact` et `handleDeath` sont génériques sur `CombatUnit`, aucune méthode dupliquée par camp

#### Effets de statut — Stun (premier effet implémenté)
- Infrastructure généralisée : champ `effects?: SkillEffectApplication[]` sur `SkillDefinition`/`SkillData`, référence `STATUS_EFFECTS_BY_ID`
- `CombatUnit.applyStatusEffect(def, durationOverride?)` — non-stackable + déjà présent → remplace (reset durée) ; stackable → nouvelle instance ajoutée
- `CombatUnit.tickStatusEffects(timing)` — tick uniquement les effets dont le `tickTiming` correspond, retire les expirés
- `CombatSystem` dispatch le comportement du stun : dans `processTurn()`, si l'unité courante a le statut `stun` actif, son tour est intégralement sauté (aucun skill, aucun mouvement), un event `unit_stunned` est émis, puis `endTurn()` est appelé directement — un seul chemin vers `finishTurn()`, cohérent avec `02_RULES.md`
- Les cooldowns tickent normalement pendant un tour stun (`tickSkillCooldowns` appelé même sans action)
- Le tick de durée du stun (`tickTiming: 'turn_end'`) se fait au même point que `tickSkillCooldowns`, dans `endTurn()` — donc `durationTurns: 1` bloque exactement 1 tour
- `useSkill()` applique les effets via `applySkillEffects()`, appelée indépendamment de la présence de `damage`/`heal` — un skill de statut pur (sans dégâts ni soin) applique son effet sans émettre de `skill_used`
- Catalogue : `stun` défini dans `statusEffects.data.ts` (`durationTurns: 1`, `tickTiming: 'turn_end'`, `stackable: false`)
- Skill de démo : `enemy_stunning_blow` (dégâts + stun), équipé sur `goblin`

**Statut** : seul le stun est concrètement branché. Poison, buff/debuff, shield, etc. restent à faire (voir `07_TODO.md`) — chacun nécessitera son propre dispatch dans `CombatSystem` selon son `type` et son `tickTiming`.

**Hors scope actuel** : feedback visuel (icône/indicateur de statut sur le sprite) — l'event `unit_stunned` existe côté logique mais `CombatScene` ne le traite pas encore.

### Système de grille

#### Grille partagée
- 8 colonnes × 6 lignes (configurable)
- Héros et ennemis se déplacent librement sur toutes les cases
- Une case = une unité maximum (collision gérée par `isCellFree`)
- Distance calculée en **Manhattan** : `|dx| + |dy|`

#### Portée par skill
- La range est définie sur chaque `SkillData`, pas sur l'unité
- `range: 0` = centré sur le caster (AOE autour de soi)
- `range: N` = cibles dans un rayon de N cases

#### Formes AOE
| Type | Description |
|---|---|
| `radius` | Cercle de rayon `value` (Manhattan) |
| `square` | Carré `(value*2+1) × (value*2+1)` centré sur l'origine |
| `cross` | Croix de longueur `value` dans les 4 directions |
| `line` | Ligne horizontale de longueur `value` dans les 2 sens |
| `all` | Toute la grille |

#### Types de ciblage
| `targetType` | Comportement |
|---|---|
| `single` | Première cible à portée `range` |
| `aoe` | Toutes les unités dans la zone AOE (centrée sur première cible ou sur caster si `range=0`) |
| `all` | Tous les ennemis vivants, sans contrainte de range |

#### Skills de soin
- `heal && !damage` → s'applique sur le caster directement, sans chercher de cibles ennemies

### Affichage et UI

#### Sprites animés
- 3 animations par unité : `idle` (boucle), `walk` (boucle, retour auto idle), `attack` (une fois, retour auto idle)
- Format : spritesheet 192×192 par frame, un fichier par animation
- `UnitAnimator` gère les transitions et évite les re-plays de la même animation
- Frame 0 affichée dès la création du sprite (évite le carré barré)

#### Terrain
- Tileset `Tilemap_color1.png` (64×64 par tile, 9 colonnes)
- Une tile répétée + overlay de grille subtil (contour blanc à 8% opacité + alternance sombre)

#### Timeline des tours
- Affichée en haut au centre
- Un cercle par unité, trié par ordre de jeu
- Unité active : cercle doré + flèche indicatrice
- Rafraîchissement à chaque `turn_start` et à chaque mort

#### Preview AOE
- 400ms avant l'impact, les cases touchées sont surlignées
- Couleur selon le type : orange (physical), violet (magic), vert (support)
- Légère pulsation via tween alpha
- Affiche les positions des cibles réellement résolues (`previewTargets`), pas la zone géométrique brute — donc une AOE avec peu de cibles dans la zone affiche peu de cases, pas la zone entière
- **Statut** : fonctionnalité dont le retrait est envisagé à terme (voir `07_TODO.md` — possible conservation en mode debug uniquement)

#### Floating damage numbers
- Style : italique, contour épais rouge/vert, rotation -8°, pop d'entrée + montée + fade
- Dégâts : blanc avec contour rouge
- Soins : vert avec contour vert foncé
- Multi-hit : décalage horizontal progressif (`offsetX = hitIndex * 14`)
- Position capturée au moment de l'event (pas au moment différé de l'affichage)

#### Barres HP
- Fond sombre + barre colorée (or pour héros, rouge-orange pour ennemis)
- Origine `(0, 0.5)` alignée à gauche — évite le décalage lors des mises à jour de largeur

#### UI Cooldowns skills
- Un slot par skill, par héros
- Overlay sombre + chiffre blanc quand en cooldown
- Icône à 40% d'opacité quand non disponible
- Mis à jour : après chaque `use()` (skill concerné uniquement) + fin de tour du héros (tous les skills)

#### Affichage des rounds
- `Round X / Y` en haut à gauche
- Mis à jour à chaque event `round_start`

### Phases de combat

#### Phase de préparation
- Overlay semi-transparent + texte + bouton "Combattre"
- Le `CombatSystem` ne tourne pas pendant cette phase
- Fade out au lancement du combat

#### Limite de rounds
- `maxRounds` configurable par niveau (défaut: 15)
- Si atteint sans victoire → event `combat_timeout`
- Résultat affiché : panel avec texte, couleur, sous-titre + bouton "Rejouer"
- 3 résultats : `won`, `lost`, `timeout`

#### Vitesse de combat
- Facteur x1/x2/x4, réglable en cours de combat (pas seulement à l'initialisation)
- `CombatSystem.setSpeed(multiplier)` divise tous les délais internes (`TURN_DELAY`, `PREVIEW_DELAY`, `HIT_STAGGER`, `TARGET_STAGGER`, `ATTACK_ANIM_DELAY`, `MOVE_ANIM_DELAY`) — `CombatSystem` reste indépendant de Phaser, aucune dépendance ajoutée
- `CombatScene` applique le même facteur à ses propres durées (tweens de déplacement/flash/mort, `UnitAnimator.playWalk`, délai du floating text) — synchronisation manuelle du même multiplicateur des deux côtés, pas d'état partagé
- Reset à x1 après un `scene.restart()` (resize ou rejouer), cohérent avec le reset des autres contrôles (pause)

#### Contrôles
- Bouton Pause (⏸/▶) — arrête/reprend `CombatSystem`
- Bouton Restart (↺) — `scene.restart()` complet
- Bouton Vitesse (x1/x2/x4) — cycle `CombatSystem.setSpeed()` + accélère uniformément les tweens Phaser (déplacement, flash, mort, floating text) du même facteur


### Données et progression

#### Catalogue de données
- **Skills** : `skills.data.ts` — tous les skills héros et ennemis avec `availableFor`
- **Héros** : `heroes.data.ts` — 4 classes avec stats de base et liste de skills disponibles
- **Ennemis** : `enemies.data.ts` — catalogue par zone avec stats et drops
- **Niveaux** : `levels.json` — éditable sans recompiler, ponté via `levels.data.ts`

#### Classes de héros
| Classe | Rôle | Range | Skills |
|---|---|---|---|
| `warrior` | Tank | 1 | Shield Bash, Whirlwind, Shockwave, Power Slash, War Cry |
| `monk` | Support/Soin | 3 | Heal, Holy Strike, Holy Cross, Meteor, Nova |
| `archer` | DPS distance | 4–7 | Quick Shot, Piercing Shot, Rain of Arrows, Multishot, Snipe |
| `lancer` | DPS corps à corps | 2–3 | Thrust, Sweep, Charge, Multi Thrust, Dragon Strike |

#### Système de puissance
- Formule : `power = hp*0.4 + attack*15 + defense*10 + (2000/speed)*5`
- `evaluateMatchup(heroStates, level)` → `strong / even / weak` + ratio numérique
- Bonus de skills équipés inclus dans le calcul héros
- Scalage ennemis via `scaleFactor` dans chaque `EnemySpawn`

#### Factory de combat
- `buildCombatSetup(level, heroStates)` → `{ heroes, enemies, heroUnits, enemyUnits, maxRounds }`
- Scalage des stats héros : `+8% par niveau` sur HP/ATK/DEF (vitesse inchangée)
- Scalage des stats ennemis : `baseStats * scaleFactor`
- Id unique par ennemi : `${enemyId}_${index}` (permet plusieurs goblins dans le même niveau)

## Features non implémentées (roadmap)

Voir `07_TODO.md` pour la liste complète et priorisée.
