import { Skill, SkillData } from './Skill';

export interface HeroData {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;         // intervalle d'attaque en ms
    skills: SkillData[];
}

export class Hero {
    data: HeroData;
    skills: Skill[];
    currentHp: number;
    lastAttack: number = 0;

    constructor(data: HeroData) {
        this.data = { ...data };
        this.currentHp = data.maxHp;
        this.skills = data.skills.map(s => new Skill(s));
    }

    isAlive(): boolean {
        return this.currentHp > 0;
    }

    takeDamage(amount: number): number {
        const dmg = Math.max(1, amount - this.data.defense);
        this.currentHp = Math.max(0, this.currentHp - dmg);
        return dmg;
    }

    heal(amount: number): void {
        this.currentHp = Math.min(this.data.maxHp, this.currentHp + amount);
    }

    canAttack(now: number): boolean {
        return now - this.lastAttack >= this.data.speed;
    }

    attack(now: number): number {
        this.lastAttack = now;
        return this.data.attack;
    }

    // Retourne le premier skill prêt
    getReadySkill(): Skill | null {
        return this.skills.find(s => s.isReady()) ?? null;
    }

    // Appelé à chaque fois que CE héros termine son tour
    tickSkillCooldowns(usedSkillIds: Set<string> | null): void {
        for (const skill of this.skills) {
            if (usedSkillIds?.has(skill.data.id)) continue; // ✅ skip tous les skills castés ce tour
            skill.tickCooldown();
        }
    }
}