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

#### Contrôles
- Bouton Pause (⏸/▶) — arrête/reprend `CombatSystem`
- Bouton Restart (↺) — `scene.restart()` complet

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
