import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeCombatUnit, makeSkill, makeCombatSetup } from '../helpers/factories';
import { Skill } from '../../src/entities/Skill';

describe('CombatSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Séquence de base
  // -------------------------------------------------------------------------
  it('émet round_start puis turn_start pour la première unité au start()', () => {
    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);
    const { combat, events } = makeCombatSetup([hero], [enemy]);

    combat.start();

    expect(events[0]).toMatchObject({ type: 'round_start', round: 0 });

    vi.advanceTimersByTime(600); // TURN_DELAY
    expect(events.some(e => e.type === 'turn_start' && e.source === 'hero_1')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Skill sans cible → skill suivant, pas de fin de tour prématurée
  // -------------------------------------------------------------------------
  it("passe au skill suivant si le premier n'a pas de cible en portée, sans finir le tour", () => {
    const noTargetSkill = new Skill(makeSkill({
      id: 'no_target', damage: 10, range: 1, cooldownTurns: 0, targetType: 'single',
    }));
    const healSkill = new Skill(makeSkill({
      id: 'self_heal', heal: 20, range: 0, cooldownTurns: 0, targetType: 'single', type: 'support',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000, hp: 50, maxHp: 100 });
    hero.skills = [noTargetSkill, healSkill];

    // Ennemi placé hors de portée (moveRange 0 pour empêcher tout repositionnement)
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);
    const { combat, grid, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 7, row: 5 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600); // arrivée sur hero_1

    // heal se déclenche directement (auto-cible, pas de tentative de repositionnement)
    vi.advanceTimersByTime(400 + 700); // PREVIEW_DELAY + ATTACK_ANIM_DELAY
    expect(events.some(e => e.type === 'skill_used' && e.skillName === undefined)).toBe(false);
    expect(events.some(e => e.type === 'skill_used' && e.isHeal === true && e.target === 'hero_1')).toBe(true);

    // aucun event unit_moved (repositionnement) pour le skill sans cible
    expect(events.filter(e => e.type === 'unit_moved').length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Repositionnement single-target avec priorité
  // -------------------------------------------------------------------------
  it('se déplace vers la cible prioritaire (lowest_hp) plutôt que la plus proche', () => {
    const skill = new Skill(makeSkill({
      id: 'precise_strike', damage: 10, range: 1, cooldownTurns: 0,
      targetType: 'single', targetPriority: 'lowest_hp',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];

    const nearEnemy = makeCombatUnit({ id: 'enemy_near', speed: 900, hp: 100, maxHp: 100 }, false);
    const farEnemy = makeCombatUnit({ id: 'enemy_far', speed: 800, hp: 10, maxHp: 100 }, false);

    const { combat, grid, events } = makeCombatSetup([hero], [nearEnemy, farEnemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 5 },
        { id: 'enemy_near', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
        { id: 'enemy_far', isHero: false, pos: { col: 5, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);

    // le hero doit se déplacer vers enemy_far (lowest_hp) malgré enemy_near à portée immédiate
    vi.advanceTimersByTime(420); // MOVE_ANIM_DELAY
    const moved = events.find(e => e.type === 'unit_moved' && e.source === 'hero_1');
    expect(moved).toBeDefined();
    expect(grid.distance(grid.getUnit('hero_1')!.pos, grid.getUnit('enemy_far')!.pos)).toBeLessThanOrEqual(1);

    vi.advanceTimersByTime(400 + 700);
    expect(events.some(e => e.type === 'skill_used' && e.target === 'enemy_far')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Maximisation AOE
  // -------------------------------------------------------------------------
  it('se déplace vers la position qui maximise le nombre de cibles AOE', () => {
    const skill = new Skill(makeSkill({
      id: 'whirlwind', damage: 10, range: 0, cooldownTurns: 0,
      targetType: 'aoe', aoe: { type: 'radius', value: 1 },
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];

    // 3 ennemis groupés loin du hero, 1 isolé à côté du hero
    const e1 = makeCombatUnit({ id: 'e1', speed: 900 }, false);
    const e2 = makeCombatUnit({ id: 'e2', speed: 890 }, false);
    const e3 = makeCombatUnit({ id: 'e3', speed: 880 }, false);
    const eLone = makeCombatUnit({ id: 'e_lone', speed: 870 }, false);

    const { combat, grid, events } = makeCombatSetup([hero], [e1, e2, e3, eLone], {
    gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 5 },
        // groupe atteignable en 1 case (distance 3 du hero), 3 cibles en radius:1 depuis (3,0)
        { id: 'e1', isHero: false, pos: { col: 3, row: 0 }, moveRange: 0 },
        { id: 'e2', isHero: false, pos: { col: 4, row: 0 }, moveRange: 0 },
        { id: 'e3', isHero: false, pos: { col: 3, row: 1 }, moveRange: 0 },
        // isolé, hors radius:1 depuis la position de départ du hero
        { id: 'e_lone', isHero: false, pos: { col: 0, row: 3 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(420);

    const moved = events.find(e => e.type === 'unit_moved' && e.source === 'hero_1');
    expect(moved).toBeDefined();
    // le hero doit se rapprocher du groupe, pas rester près de e_lone
    const heroPos = grid.getUnit('hero_1')!.pos;
    const distToGroup = grid.distance(heroPos, { col: 4, row: 3 });
    const distToLone = grid.distance(heroPos, { col: 1, row: 0 });
    expect(distToGroup).toBeLessThan(distToLone);
  });

  // -------------------------------------------------------------------------
  // 5. Multi-hit
  // -------------------------------------------------------------------------
  it('émet un skill_used par coup avec hitIndex/totalHits corrects, espacés de HIT_STAGGER', () => {
    const skill = new Skill(makeSkill({
      id: 'multi_thrust', damage: 10, hits: 3, range: 1, cooldownTurns: 0, targetType: 'single',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000, hp: 1000, maxHp: 1000 }, false);

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(400); // PREVIEW_DELAY

    vi.advanceTimersByTime(0);
    const hits = () => events.filter(e => e.type === 'skill_used' && e.skillName === 'multi_thrust' || (e.type === 'skill_used' && e.value !== undefined && e.hitIndex !== undefined));

    vi.advanceTimersByTime(120); // hit 0
    vi.advanceTimersByTime(120); // hit 1
    vi.advanceTimersByTime(120); // hit 2

    const multiHits = events.filter(e => e.type === 'skill_used' && e.target === 'enemy_1');
    expect(multiHits.length).toBe(3);
    expect(multiHits.map(e => e.hitIndex)).toEqual([0, 1, 2]);
    expect(multiHits.every(e => e.totalHits === 3)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Cooldowns : use() puis tick en fin de tour, skill utilisé exclu
  // -------------------------------------------------------------------------
  it('applique use() au cast puis tick en fin de tour uniquement sur les skills non utilisés', () => {
    const usedSkill = new Skill(makeSkill({
      id: 'used_skill', damage: 10, range: 1, cooldownTurns: 3, targetType: 'single',
    }));
    usedSkill.tickCooldown(); usedSkill.tickCooldown(); usedSkill.tickCooldown(); // force ready (3 -> 0)

    const untouchedSkill = new Skill(makeSkill({
      id: 'untouched_skill', damage: 5, range: 1, cooldownTurns: 3, targetType: 'single',
    }));
    // reste à 3 (cooldown initial actif), donc jamais castée ce tour -> bon candidat pour vérifier le tick

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [usedSkill, untouchedSkill];
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000, hp: 1000, maxHp: 1000 }, false);

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(400);

    expect(usedSkill.getTurnsRemaining()).toBe(3); // vient d'être castée, use() -> repart à 3

    vi.advanceTimersByTime(700);

    expect(usedSkill.getTurnsRemaining()).toBe(3);       // exclu du tick
    expect(untouchedSkill.getTurnsRemaining()).toBe(2);  // tické normalement
    expect(events.some(e => e.type === 'cooldowns_updated' && e.source === 'hero_1')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Mort en cours de multi-hit → re-ciblage sur le skill suivant
  // -------------------------------------------------------------------------
  it('émet unit_died si une cible meurt en cours de multi-hit, et re-cible sur le skill suivant', () => {
    const killerSkill = new Skill(makeSkill({
      id: 'killer', damage: 100, hits: 3, range: 1, cooldownTurns: 0, targetType: 'single',
    }));
    const followUpSkill = new Skill(makeSkill({
      id: 'follow_up', damage: 10, range: 5, cooldownTurns: 0, targetType: 'single',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [killerSkill, followUpSkill];

    const weakEnemy = makeCombatUnit({ id: 'weak', speed: 900, hp: 50, maxHp: 50 }, false);
    const otherEnemy = makeCombatUnit({ id: 'other', speed: 800, hp: 500, maxHp: 500 }, false);

    const { combat, events } = makeCombatSetup([hero], [weakEnemy, otherEnemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        // seule 'weak' est en portée (range:1) du killerSkill
        { id: 'weak', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
        // 'other' hors de portée du killer (range:1) mais dans celle du follow_up (range:5)
        { id: 'other', isHero: false, pos: { col: 5, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(400); // preview -> killerSkill cible forcément 'weak' (seule en range:1)

    vi.advanceTimersByTime(120); // hit 0 : weak meurt (100 dmg sur 50 hp)
    expect(events.some(e => e.type === 'unit_died' && e.source === 'weak')).toBe(true);

    vi.advanceTimersByTime(120); // hit 1 : weak déjà morte, pas de nouveau dégât
    vi.advanceTimersByTime(120); // hit 2 idem

    const weakHits = events.filter(e => e.type === 'skill_used' && e.target === 'weak');
    expect(weakHits.length).toBe(1);

    vi.advanceTimersByTime(700); // ATTACK_ANIM_DELAY -> passage à follow_up
    vi.advanceTimersByTime(400); // PREVIEW_DELAY du follow_up

    expect(events.some(e => e.type === 'skill_used' && e.target === 'other')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Fin de combat : combat_won
  // -------------------------------------------------------------------------
  it('émet combat_won quand tous les ennemis sont morts', () => {
    const skill = new Skill(makeSkill({
      id: 'finisher', damage: 1000, range: 1, cooldownTurns: 0, targetType: 'single',
    }));
    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000, hp: 10, maxHp: 10 }, false);

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600 + 400 + 120); // turn_start + preview + hit unique

    expect(events.some(e => e.type === 'unit_died' && e.source === 'enemy_1')).toBe(true);
    expect(events.some(e => e.type === 'combat_won')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Fin de combat : combat_lost
  // -------------------------------------------------------------------------
  it('émet combat_lost quand tous les héros sont morts', () => {
    const skill = new Skill(makeSkill({
      id: 'enemy_finisher', damage: 1000, range: 1, cooldownTurns: 0, targetType: 'single',
    }));
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 2000 }, false);
    enemy.skills = [skill];
    const hero = makeCombatUnit({ id: 'hero_1', speed: 1000, hp: 10, maxHp: 10 });

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600 + 400 + 120);

    expect(events.some(e => e.type === 'unit_died' && e.source === 'hero_1')).toBe(true);
    expect(events.some(e => e.type === 'combat_lost')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 10. Fin de combat : combat_timeout
  // -------------------------------------------------------------------------
  it('émet combat_timeout quand maxRounds est atteint sans victoire', () => {
    // deux unités increvables, aucun skill ne peut trancher le combat
    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000, hp: 10000, maxHp: 10000 });
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000, hp: 10000, maxHp: 10000 }, false);
    // aucun skill équipé -> les tours passent sans action, endTurn direct

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      maxRounds: 2,
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    // 2 unités par round, TURN_DELAY = 600ms par tour, il faut dépasser maxRounds (2) pour déclencher le timeout
    vi.advanceTimersByTime(600 * 10);

    expect(events.some(e => e.type === 'combat_timeout')).toBe(true);
    expect(events.some(e => e.type === 'combat_won' || e.type === 'combat_lost')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 11. stop() interrompt proprement, aucun event après
  // -------------------------------------------------------------------------
  it("stop() empêche tout event ultérieur", () => {
    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);
    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600); // turn_start émis

    combat.stop();
    const countAtStop = events.length;

    vi.advanceTimersByTime(5000); // plus rien ne devrait se produire

    expect(events.length).toBe(countAtStop);
  });

  // -------------------------------------------------------------------------
  // 12. setSpeed() divise les délais internes
  // -------------------------------------------------------------------------
  it('setSpeed(2) fait apparaître turn_start deux fois plus vite', () => {
    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);
    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.setSpeed(2);
    combat.start();

    vi.advanceTimersByTime(300); // 600 / 2
    expect(events.some(e => e.type === 'turn_start' && e.source === 'hero_1')).toBe(true);
  });
  
  // -------------------------------------------------------------------------
  // 13. Stun : passe le tour, émet unit_stunned, aucun skill/mouvement
  // -------------------------------------------------------------------------
  it('unité stun : passe son tour, émet unit_stunned, aucun skill_used ni unit_moved', () => {
    const skill = new Skill(makeSkill({
      id: 'attack', damage: 10, range: 5, cooldownTurns: 0, targetType: 'single',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];
    hero.applyStatusEffect({
      id: 'stun', name: 'Stun', type: 'stun', polarity: 'negative',
      stackable: false, durationTurns: 1, tickTiming: 'turn_end',
    });

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600); // turn_start hero_1

    expect(events.some(e => e.type === 'unit_stunned' && e.source === 'hero_1')).toBe(true);
    expect(events.some(e => e.type === 'skill_used' && e.source === 'hero_1')).toBe(false);
    expect(events.some(e => e.type === 'unit_moved' && e.source === 'hero_1')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 14. Stun : les cooldowns tickent normalement pendant le tour raté
  // -------------------------------------------------------------------------
  it('unité stun : les cooldowns non utilisés tickent quand même en fin de tour', () => {
    const untouchedSkill = new Skill(makeSkill({
      id: 'untouched_skill', damage: 5, range: 1, cooldownTurns: 3, targetType: 'single',
    }));
    // cooldown initial actif à 3, jamais castée (unité stun) -> doit ticker à 2

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [untouchedSkill];
    hero.applyStatusEffect({
      id: 'stun', name: 'Stun', type: 'stun', polarity: 'negative',
      stackable: false, durationTurns: 1, tickTiming: 'turn_end',
    });

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000 }, false);

    const { combat } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);

    expect(untouchedSkill.getTurnsRemaining()).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 15. Stun : expire après le tour raté, l'unité rejoue normalement ensuite
  // -------------------------------------------------------------------------
  it('le stun expire après le tour raté, l\'unité agit normalement au tour suivant', () => {
    const skill = new Skill(makeSkill({
      id: 'attack', damage: 10, range: 5, cooldownTurns: 0, targetType: 'single',
    }));

    const hero = makeCombatUnit({ id: 'hero_1', speed: 2000 });
    hero.skills = [skill];
    hero.applyStatusEffect({
      id: 'stun', name: 'Stun', type: 'stun', polarity: 'negative',
      stackable: false, durationTurns: 1, tickTiming: 'turn_end',
    });

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 1000, hp: 1000, maxHp: 1000 }, false);

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600); // hero_1 : tour raté, stun consommé

    expect(hero.hasStatusEffect('stun')).toBe(false);

    vi.advanceTimersByTime(600); // enemy_1 joue (aucun skill équipé -> endTurn direct)
    vi.advanceTimersByTime(600); // hero_1 rejoue, plus stun

    vi.advanceTimersByTime(400 + 120); // PREVIEW_DELAY + hit

    expect(events.some(e => e.type === 'skill_used' && e.source === 'hero_1' && e.target === 'enemy_1')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 16. Un skill applique un effet de statut sur sa cible à l'impact
  // -------------------------------------------------------------------------
  it('un skill avec effects applique le statut correspondant sur la cible', () => {
    const stunningSkill = new Skill(makeSkill({
      id: 'stunning_blow', damage: 10, range: 1, cooldownTurns: 0, targetType: 'single',
      effects: [{ statusId: 'stun' }],
    }));

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 2000 }, false);
    enemy.skills = [stunningSkill];
    const hero = makeCombatUnit({ id: 'hero_1', speed: 1000, hp: 1000, maxHp: 1000 });

    const { combat } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600); // turn_start enemy_1
    vi.advanceTimersByTime(400); // PREVIEW_DELAY
    vi.advanceTimersByTime(120); // hit unique

    expect(hero.hasStatusEffect('stun')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 17. Un skill purement statut (sans damage/heal) applique quand même l'effet
  // -------------------------------------------------------------------------
  it('un skill sans damage ni heal, avec seulement effects, applique le statut', () => {
    const statusOnlySkill = new Skill(makeSkill({
      id: 'hex', range: 1, cooldownTurns: 0, targetType: 'single',
      effects: [{ statusId: 'stun' }],
    }));

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 2000 }, false);
    enemy.skills = [statusOnlySkill];
    const hero = makeCombatUnit({ id: 'hero_1', speed: 1000, hp: 1000, maxHp: 1000 });

    const { combat, events } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(400); // PREVIEW_DELAY, pas d'ATTACK_ANIM_DELAY à attendre pour les dégâts

    expect(hero.hasStatusEffect('stun')).toBe(true);
    expect(events.some(e => e.type === 'skill_used' && e.target === 'hero_1')).toBe(false); // pas de dégâts/heal émis
  });

  // -------------------------------------------------------------------------
  // 18. durationTurns override sur l'application d'effet
  // -------------------------------------------------------------------------
  it('effects[].durationTurns override la durée par défaut du catalogue', () => {
    const longStunSkill = new Skill(makeSkill({
      id: 'long_stun', damage: 5, range: 1, cooldownTurns: 0, targetType: 'single',
      effects: [{ statusId: 'stun', durationTurns: 2 }],
    }));

    const enemy = makeCombatUnit({ id: 'enemy_1', speed: 2000 }, false);
    enemy.skills = [longStunSkill];
    const hero = makeCombatUnit({ id: 'hero_1', speed: 1000, hp: 1000, maxHp: 1000 });

    const { combat } = makeCombatSetup([hero], [enemy], {
      gridUnits: [
        { id: 'hero_1', isHero: true, pos: { col: 0, row: 0 }, moveRange: 0 },
        { id: 'enemy_1', isHero: false, pos: { col: 1, row: 0 }, moveRange: 0 },
      ],
    });

    combat.start();
    vi.advanceTimersByTime(600 + 400 + 120); // stun appliqué avec durationTurns: 2

    hero.tickStatusEffects('turn_end'); // simulate 1 tick de fin de tour
    expect(hero.hasStatusEffect('stun')).toBe(true); // encore actif (2 -> 1)

    hero.tickStatusEffects('turn_end');
    expect(hero.hasStatusEffect('stun')).toBe(false); // expiré (1 -> 0)
  });
});