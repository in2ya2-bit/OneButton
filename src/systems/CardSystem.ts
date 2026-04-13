import Phaser from 'phaser';
import { DamageText } from '../objects/DamageText';
import { SoundManager } from '../data/SoundManager';
import { RelicPanel } from '../objects/RelicPanel';
import { ALL_SKILL_DEFS, CLASS_SKILL_POOLS, SkillDef } from '../data/skillDefs';
import { ClassDef } from '../data/classes';
import { INIT_MP, MAX_SLOTS, SLOT_XS, SLOT_Y } from '../config/constants';
import type { AutoAtkCardDef, CardDef, CardRarity, SynergyDef } from '../types/index';
import {
  STAT_CARDS,
  RARITY_COLORS,
  LEGENDARY_DESCS,
  SYNERGIES,
  AUTO_ATK_CARDS,
} from '../config/cardData';
import type { StageManager } from './StageManager';
import type { BattleSystem } from './BattleSystem';

function rollRarity(): CardRarity {
  const r = Math.random();
  if (r < 0.05) return 'legendary';
  if (r < 0.2) return 'rare';
  return 'normal';
}

function skillMult(id: string, level: number): number {
  if (level <= 0) return 0;
  const def = ALL_SKILL_DEFS[id];
  if (!def) return 0;
  return def.baseMult * (1 + 0.3 * (level - 1));
}

export interface ICardSceneContext extends Phaser.Scene {
  cardSelecting: boolean;
  overlayElements: Phaser.GameObjects.GameObject[];
  shopOpen: boolean;
  relicOpen: boolean;
  relicPanel: RelicPanel;
  level: number;
  pendingLevelUps: number;
  cardLevels: Record<string, number>;
  cardRarityBonus: Record<string, number>;
  legendaryEffects: Record<string, boolean>;
  activeSynergies: string[];
  equippedSkills: string[];
  skillLevels: Record<string, number>;
  selectedClass: ClassDef;
  mageStartRare: boolean;
  waitingFirstCard: boolean;
  restCardPending: boolean;
  autoAttackEnabled: boolean;
  relicLevels: Record<string, number>;
  playerHp: number;
  playerMaxHp: number;
  playerMp: number;
  playerMaxMp: number;
  battleSystem: BattleSystem;
  stageManager: StageManager;

  readonly baseMaxHp: number;
  gcv(id: string): number;
  hasSynergy(id: string): boolean;
  skillCdAt(id: string, level: number): number;

  closeOverlay(): void;
  drawPlayerHpBar(): void;
  drawMpBar(): void;
  updateUI(): void;
  updateBuffBar(): void;
  checkAchievements(): void;
  autoSave(): void;
  equipSkill(id: string, animate?: boolean): void;
  showAutoAttackBadge(): void;
  emitParticles(x: number, y: number, colors?: number[], count?: number): void;
}

export class CardSystem {
  private ctx: ICardSceneContext;
  synergyContainer?: Phaser.GameObjects.Container;

  constructor(scene: ICardSceneContext) {
    this.ctx = scene;
  }

  reset(): void {
    this.synergyContainer = undefined;
  }

  showCardSelection(skillOnly = false): void {
    if (this.ctx.cardSelecting && this.ctx.overlayElements.length > 0) return;
    this.ctx.cardSelecting = true;
    if (this.ctx.shopOpen) this.ctx.closeOverlay();
    if (this.ctx.relicPanel?.isOpen) {
      this.ctx.relicPanel.close();
      this.ctx.relicOpen = false;
    }
    const els = this.ctx.overlayElements;

    const bg = this.ctx.add.graphics().setDepth(300).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    const titleStr = skillOnly ? '⚔ 스킬을 선택하세요!' : '⬆ LEVEL UP!';
    const title = this.ctx.add
      .text(400, 90, titleStr, {
        fontSize: '36px',
        color: '#ffdd44',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(301)
      .setScale(0);
    els.push(title);
    this.ctx.tweens.add({
      targets: title,
      scale: 1,
      duration: 400,
      delay: 100,
      ease: 'Back.easeOut',
    });

    els.push(
      this.ctx.add
        .text(400, 125, skillOnly ? '스킬을 획득하세요' : '카드를 선택하세요', {
          fontSize: '16px',
          color: '#cccccc',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(301),
    );

    if (skillOnly) {
      this.showSkillCardPicks(els);
    } else {
      const showSkillsThisLevel = Math.random() < 0.5 && this.ctx.equippedSkills.length < MAX_SLOTS;
      if (showSkillsThisLevel) {
        this.showMixedCardPicks(els);
      } else {
        this.showStatCardPicks(els);
      }
    }
  }

  private shouldOfferAutoAtkCard(): boolean {
    if (this.ctx.autoAttackEnabled) return false;
    if (this.ctx.level < 3) return false;
    const chance = this.ctx.level >= 4 ? 0.66 : 0.33;
    return Math.random() < chance;
  }

  private showStatCardPicks(els: Phaser.GameObjects.GameObject[]): void {
    if (this.shouldOfferAutoAtkCard()) {
      this.showStatCardsWithAutoAtk(els);
      return;
    }

    const eligible = STAT_CARDS.filter(c => (this.ctx.cardLevels[c.id] ?? 0) < 4);
    const weights = this.ctx.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligible) {
      const w = weights[c.id] ?? 1;
      const count = Math.round(w * 10);
      for (let j = 0; j < count; j++) weighted.push(c);
    }
    const luckyBonus = this.ctx.relicLevels.lucky ?? 0;
    const numPicks = Math.min(eligible.length, 3 + luckyBonus);
    const seen = new Set<string>();
    const picks: CardDef[] = [];
    const shuffled = Phaser.Utils.Array.Shuffle([...weighted]);
    for (const c of shuffled) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      picks.push(c);
      if (picks.length >= numPicks) break;
    }
    const rarities = picks.map((_, idx) => {
      if (this.ctx.mageStartRare && idx === 0) return 'rare' as CardRarity;
      return rollRarity();
    });
    if (this.ctx.mageStartRare) this.ctx.mageStartRare = false;
    this.renderStatCards(picks, rarities, els);
  }

  private showStatCardsWithAutoAtk(els: Phaser.GameObjects.GameObject[]): void {
    const eligible = STAT_CARDS.filter(c => (this.ctx.cardLevels[c.id] ?? 0) < 4);
    const weights = this.ctx.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligible) {
      const w = weights[c.id] ?? 1;
      for (let j = 0; j < Math.round(w * 10); j++) weighted.push(c);
    }
    const seen = new Set<string>();
    const statPicks: CardDef[] = [];
    for (const c of Phaser.Utils.Array.Shuffle([...weighted])) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      statPicks.push(c);
      if (statPicks.length >= 2) break;
    }
    const rarities = statPicks.map(() => rollRarity());

    const autoCard = AUTO_ATK_CARDS[this.ctx.selectedClass.id];
    const total = statPicks.length + 1;
    const cw = 180,
      gap = 20;
    const totalW = total * cw + (total - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    const autoIdx = Phaser.Math.Between(0, total - 1);
    let statI = 0;
    for (let i = 0; i < total; i++) {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      if (i === autoIdx) {
        this.renderAutoAtkCard(cx, cy, cw, ch, autoCard, els);
      } else {
        const card = statPicks[statI];
        const rarity = rarities[statI];
        statI++;
        this.renderSingleStatCard(cx, cy, cw, ch, card, rarity, els, i, total);
      }
    }
  }

  private showSkillCardPicks(els: Phaser.GameObjects.GameObject[]): void {
    const pool = CLASS_SKILL_POOLS[this.ctx.selectedClass.id] ?? [];
    const eligible = pool.filter(s => {
      const lv = this.ctx.skillLevels[s.id] ?? 0;
      if (lv >= 4) return false;
      if (lv === 0 && this.ctx.equippedSkills.length >= MAX_SLOTS) return false;
      return true;
    });
    const numPicks = Math.min(eligible.length, 3);
    const picks = Phaser.Utils.Array.Shuffle([...eligible]).slice(0, numPicks);
    this.renderSkillCards(picks, els);
  }

  private showMixedCardPicks(els: Phaser.GameObjects.GameObject[]): void {
    const pool = CLASS_SKILL_POOLS[this.ctx.selectedClass.id] ?? [];
    const eligibleSkills = pool.filter(s => {
      const lv = this.ctx.skillLevels[s.id] ?? 0;
      if (lv >= 4) return false;
      if (lv === 0 && this.ctx.equippedSkills.length >= MAX_SLOTS) return false;
      return true;
    });
    const eligibleStats = STAT_CARDS.filter(c => (this.ctx.cardLevels[c.id] ?? 0) < 4);

    if (eligibleSkills.length === 0) {
      this.showStatCardPicks(els);
      return;
    }

    const skillPick = Phaser.Math.RND.pick(eligibleSkills);
    const weights = this.ctx.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligibleStats) {
      const w = weights[c.id] ?? 1;
      const count = Math.round(w * 10);
      for (let j = 0; j < count; j++) weighted.push(c);
    }
    const statPicks: CardDef[] = [];
    const seen = new Set<string>();
    const shuffled = Phaser.Utils.Array.Shuffle([...weighted]);
    for (const c of shuffled) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      statPicks.push(c);
      if (statPicks.length >= 2) break;
    }

    const rarities = statPicks.map(() => rollRarity());
    this.renderMixedCards(statPicks, rarities, [skillPick], els);
  }

  private renderStatCards(
    picks: CardDef[],
    rarities: CardRarity[],
    els: Phaser.GameObjects.GameObject[],
  ): void {
    const synergyCompletingIds = new Set<string>();
    for (const syn of SYNERGIES) {
      if (this.ctx.activeSynergies.includes(syn.id)) continue;
      const missing = syn.requires.filter(r => (this.ctx.cardLevels[r] ?? 0) === 0);
      if (missing.length === 1) synergyCompletingIds.add(missing[0]);
    }

    const cw = picks.length <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = picks.length * cw + (picks.length - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    picks.forEach((card, i) => {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      const rarity = rarities[i];
      const rc = RARITY_COLORS[rarity];
      const curLv = this.ctx.cardLevels[card.id] ?? 0;
      const perPick =
        rarity === 'legendary'
          ? card.legendValue
          : rarity === 'rare'
            ? card.rareValue
            : card.baseValue;
      const isNew = curLv === 0;
      const completesSynergy = synergyCompletingIds.has(card.id) && curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: card.icon,
          name: card.name,
          color: card.color,
          desc: card.descFn(perPick),
          rarity,
          rc,
          isNew,
          isSkill: false,
          curLv,
          legendaryDesc:
            rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
          cdText: null,
          synergyName: completesSynergy
            ? (SYNERGIES.find(
                s =>
                  s.requires.includes(card.id) &&
                  s.requires.filter(r => (this.ctx.cardLevels[r] ?? 0) === 0).length === 1,
              )?.name ?? null)
            : null,
        },
        els,
        i,
        picks.length,
      );

      const zone = this.ctx.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.ctx.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.ctx.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
      els.push(zone);
    });
  }

  private renderSingleStatCard(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    card: CardDef,
    rarity: CardRarity,
    els: Phaser.GameObjects.GameObject[],
    i: number,
    total: number,
  ): void {
    const rc = RARITY_COLORS[rarity];
    const curLv = this.ctx.cardLevels[card.id] ?? 0;
    const perPick =
      rarity === 'legendary'
        ? card.legendValue
        : rarity === 'rare'
          ? card.rareValue
          : card.baseValue;
    const isNew = curLv === 0;
    const synergyCompletingIds = new Set<string>();
    for (const syn of SYNERGIES) {
      if (this.ctx.activeSynergies.includes(syn.id)) continue;
      const missing = syn.requires.filter(r => (this.ctx.cardLevels[r] ?? 0) === 0);
      if (missing.length === 1) synergyCompletingIds.add(missing[0]);
    }
    const completesSynergy = synergyCompletingIds.has(card.id) && curLv === 0;
    const allParts = this.drawCardUI(
      cx,
      cy,
      cw,
      ch,
      {
        icon: card.icon,
        name: card.name,
        color: card.color,
        desc: card.descFn(perPick),
        rarity,
        rc,
        isNew,
        isSkill: false,
        curLv,
        legendaryDesc:
          rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
        cdText: null,
        synergyName: completesSynergy
          ? (SYNERGIES.find(
              s =>
                s.requires.includes(card.id) &&
                s.requires.filter(r => (this.ctx.cardLevels[r] ?? 0) === 0).length === 1,
            )?.name ?? null)
          : null,
      },
      els,
      i,
      total,
    );
    const zone = this.ctx.add
      .zone(cx, cy, cw, ch)
      .setInteractive({ useHandCursor: true })
      .setDepth(303);
    zone.on('pointerover', () =>
      this.ctx.tweens.add({
        targets: [...allParts, zone],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      }),
    );
    zone.on('pointerout', () =>
      this.ctx.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
    );
    zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
    els.push(zone);
  }

  private renderAutoAtkCard(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    card: AutoAtkCardDef,
    els: Phaser.GameObjects.GameObject[],
  ): void {
    const g = this.ctx.add.graphics().setDepth(301);
    g.fillStyle(0x0a1a10, 0.95);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    g.lineStyle(3, 0x44ff66, 0.9);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    els.push(g);

    const glow = this.ctx.add.graphics().setDepth(300);
    glow.fillStyle(0x44ff66, 0.08);
    glow.fillRoundedRect(cx - cw / 2 - 4, cy - ch / 2 - 4, cw + 8, ch + 8, 16);
    this.ctx.tweens.add({ targets: glow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    els.push(glow);

    const icon = this.ctx.add
      .text(cx, cy - 70, card.icon, { fontSize: '32px' })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(icon);
    const name = this.ctx.add
      .text(cx, cy - 38, card.name, {
        fontSize: '15px',
        color: '#44ff66',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(name);
    const label = this.ctx.add
      .text(cx, cy - 18, '🔄 자동공격', {
        fontSize: '11px',
        color: '#88ffaa',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(label);

    const desc = this.ctx.add
      .text(cx, cy + 10, card.desc, {
        fontSize: '11px',
        color: '#ccddcc',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: cw - 20 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(302);
    els.push(desc);

    const hint = this.ctx.add
      .text(cx, cy + ch / 2 - 20, '기본 공격이 자동 발동!', {
        fontSize: '10px',
        color: '#66dd88',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(hint);

    const zone = this.ctx.add
      .zone(cx, cy, cw, ch)
      .setInteractive({ useHandCursor: true })
      .setDepth(303);
    const parts = [g, glow, icon, name, label, desc, hint];
    zone.on('pointerover', () =>
      this.ctx.tweens.add({ targets: [...parts, zone], scaleX: 1.05, scaleY: 1.05, duration: 100 }),
    );
    zone.on('pointerout', () =>
      this.ctx.tweens.add({ targets: [...parts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
    );
    zone.on('pointerdown', () => this.pickAutoAtkCard());
    els.push(zone);
  }

  private pickAutoAtkCard(): void {
    SoundManager.sfxCardSelect();
    this.ctx.autoAttackEnabled = true;
    this.ctx.showAutoAttackBadge();
    DamageText.show(this.ctx, 400, 200, '🔄 자동공격 활성화!', '#44ff66', '28px');
    this.ctx.cameras.main.flash(300, 68, 255, 102);
    this.ctx.emitParticles(SLOT_XS[0], SLOT_Y, [0x44ff66, 0x88ffaa, 0xffffff], 12);
    this.finishCardPick();
  }

  private renderSkillCards(picks: SkillDef[], els: Phaser.GameObjects.GameObject[]): void {
    const cw = picks.length <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = picks.length * cw + (picks.length - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    picks.forEach((skill, i) => {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      const curLv = this.ctx.skillLevels[skill.id] ?? 0;
      const nextLv = curLv + 1;
      const nextMult = skillMult(skill.id, nextLv);
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: skill.icon,
          name: skill.name,
          color: skill.color,
          desc: skill.descFn(nextMult),
          rarity: 'normal',
          rc: {
            border: skill.color,
            text: '#' + skill.color.toString(16).padStart(6, '0'),
            label: skill.category,
            bg: 0x111122,
          },
          isNew,
          isSkill: true,
          curLv,
          legendaryDesc: null,
          cdText: `CD: ${this.ctx.skillCdAt(skill.id, nextLv).toFixed(1)}s`,
          synergyName: null,
        },
        els,
        i,
        picks.length,
      );

      const zone = this.ctx.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.ctx.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.ctx.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickSkillCard(skill.id));
      els.push(zone);
    });
  }

  private renderMixedCards(
    statPicks: CardDef[],
    statRarities: CardRarity[],
    skillPicks: SkillDef[],
    els: Phaser.GameObjects.GameObject[],
  ): void {
    const all = statPicks.length + skillPicks.length;
    const cw = all <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = all * cw + (all - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;
    let idx = 0;

    statPicks.forEach((card, i) => {
      const cx = startX + idx * (cw + gap),
        cy = 280,
        ch = 240;
      const rarity = statRarities[i];
      const rc = RARITY_COLORS[rarity];
      const curLv = this.ctx.cardLevels[card.id] ?? 0;
      const perPick =
        rarity === 'legendary'
          ? card.legendValue
          : rarity === 'rare'
            ? card.rareValue
            : card.baseValue;
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: card.icon,
          name: card.name,
          color: card.color,
          desc: card.descFn(perPick),
          rarity,
          rc,
          isNew,
          isSkill: false,
          curLv,
          legendaryDesc:
            rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
          cdText: null,
          synergyName: null,
        },
        els,
        idx,
        all,
      );

      const zone = this.ctx.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.ctx.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.ctx.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
      els.push(zone);
      idx++;
    });

    skillPicks.forEach(skill => {
      const cx = startX + idx * (cw + gap),
        cy = 280,
        ch = 240;
      const curLv = this.ctx.skillLevels[skill.id] ?? 0;
      const nextLv = curLv + 1;
      const nextMult = skillMult(skill.id, nextLv);
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: skill.icon,
          name: skill.name,
          color: skill.color,
          desc: skill.descFn(nextMult),
          rarity: 'normal',
          rc: {
            border: skill.color,
            text: '#' + skill.color.toString(16).padStart(6, '0'),
            label: skill.category,
            bg: 0x111122,
          },
          isNew,
          isSkill: true,
          curLv,
          legendaryDesc: null,
          cdText: `CD: ${this.ctx.skillCdAt(skill.id, nextLv).toFixed(1)}s`,
          synergyName: null,
        },
        els,
        idx,
        all,
      );

      const zone = this.ctx.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.ctx.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.ctx.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickSkillCard(skill.id));
      els.push(zone);
      idx++;
    });
  }

  private drawCardUI(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    opts: {
      icon: string;
      name: string;
      color: number;
      desc: string;
      rarity: CardRarity;
      rc: { border: number; text: string; label: string; bg: number };
      isNew: boolean;
      isSkill: boolean;
      curLv: number;
      legendaryDesc: string | null;
      cdText: string | null;
      synergyName: string | null;
    },
    els: Phaser.GameObjects.GameObject[],
    i: number,
    total: number,
  ): Phaser.GameObjects.GameObject[] {
    const { rarity, rc } = opts;

    const g = this.ctx.add.graphics().setDepth(301);
    g.fillStyle(rc.bg, 0.95);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    const borderW = rarity === 'legendary' ? 4 : 3;
    g.lineStyle(borderW, rc.border, rarity === 'normal' ? 0.6 : 1);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);

    if (rarity === 'legendary') {
      const glow = this.ctx.add.graphics().setDepth(300).setAlpha(0.25);
      glow.fillStyle(0xffd700, 0.12);
      glow.fillRoundedRect(cx - cw / 2 - 4, cy - ch / 2 - 4, cw + 8, ch + 8, 16);
      this.ctx.tweens.add({ targets: glow, alpha: 0.08, duration: 600, yoyo: true, repeat: -1 });
      els.push(glow);
    }

    const topBar = this.ctx.add.graphics().setDepth(301);
    topBar.fillStyle(opts.color, 0.3);
    topBar.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, 50, { tl: 14, tr: 14, bl: 0, br: 0 });

    const rarityLabel = this.ctx.add
      .text(cx - cw / 2 + 8, cy - ch / 2 + 6, rc.label, {
        fontSize: '9px',
        color: rc.text,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(303);

    const iconSize = total <= 3 ? '36px' : '28px';
    const nameSize = total <= 3 ? '16px' : '13px';
    const icon = this.ctx.add
      .text(cx, cy - 90, opts.icon, { fontSize: iconSize })
      .setOrigin(0.5)
      .setDepth(302);
    const name = this.ctx.add
      .text(cx, cy - 50, opts.name, {
        fontSize: nameSize,
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);

    if (opts.isSkill) {
      els.push(
        this.ctx.add
          .text(cx + cw / 2 - 8, cy - ch / 2 + 8, 'SKILL', {
            fontSize: '9px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            backgroundColor: '#ff4400',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(1, 0)
          .setDepth(303),
      );
    }

    const desc = this.ctx.add
      .text(cx, cy - 5, opts.desc, {
        fontSize: '12px',
        color: '#aaddff',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: cw - 16 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(302);

    let legendaryDescT: Phaser.GameObjects.Text | null = null;
    if (opts.legendaryDesc) {
      legendaryDescT = this.ctx.add
        .text(cx, cy + 12, `★ ${opts.legendaryDesc}`, {
          fontSize: '9px',
          color: '#ffd700',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
          wordWrap: { width: cw - 16 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(302);
    }

    let cdLine: Phaser.GameObjects.Text | null = null;
    if (opts.cdText) {
      const cdY = legendaryDescT ? cy + 30 : cy + 14;
      cdLine = this.ctx.add
        .text(cx, cdY, opts.cdText, {
          fontSize: '11px',
          color: '#99bbdd',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(302);
    }

    const badgeY = cdLine ? cy + 46 : legendaryDescT ? cy + 40 : opts.isSkill ? cy + 35 : cy + 28;
    const bdg = this.ctx.add
      .text(
        cx,
        badgeY,
        opts.isNew ? (opts.isSkill ? '✦ 스킬 획득' : '✦ NEW') : `강화 Lv.${opts.curLv + 1}`,
        {
          fontSize: '13px',
          color: opts.isNew ? '#44ff44' : '#ffaa44',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    const starsT = this.ctx.add
      .text(
        cx,
        badgeY + 18,
        opts.isNew ? '' : '★'.repeat(opts.curLv) + '☆'.repeat(4 - opts.curLv),
        {
          fontSize: '14px',
          color: '#ffcc00',
          fontFamily: 'Arial',
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    let synergyHint: Phaser.GameObjects.Text | null = null;
    if (opts.synergyName) {
      synergyHint = this.ctx.add
        .text(cx, cy + ch / 2 - 28, `🔗 ${opts.synergyName}`, {
          fontSize: '10px',
          color: '#44ffaa',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(303);
      this.ctx.tweens.add({
        targets: synergyHint,
        alpha: 0.4,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    const hintT = this.ctx.add
      .text(cx, cy + ch / 2 - 14, '클릭하여 선택', {
        fontSize: '10px',
        color: '#555577',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setDepth(302);

    const allParts: Phaser.GameObjects.GameObject[] = [
      g,
      topBar,
      rarityLabel,
      icon,
      name,
      desc,
      bdg,
      starsT,
      hintT,
    ];
    if (cdLine) allParts.push(cdLine);
    if (legendaryDescT) allParts.push(legendaryDescT);
    if (synergyHint) allParts.push(synergyHint);
    els.push(...allParts);

    const fadeTarget = allParts as Phaser.GameObjects.GameObject[];
    fadeTarget.forEach(p => {
      const go = p as Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => void };
      go.setAlpha?.(0);
    });
    const textEls: Phaser.GameObjects.Text[] = [icon, name, desc, bdg, starsT, hintT, rarityLabel];
    if (cdLine) textEls.push(cdLine);
    if (legendaryDescT) textEls.push(legendaryDescT);
    if (synergyHint) textEls.push(synergyHint);
    textEls.forEach(t => {
      t.y += 30;
    });
    this.ctx.tweens.add({ targets: allParts, alpha: 1, duration: 280, delay: 350 + i * 120 });
    this.ctx.tweens.add({
      targets: textEls,
      y: '-=30',
      duration: 350,
      delay: 350 + i * 120,
      ease: 'Back.easeOut',
    });

    if (rarity === 'legendary') {
      this.ctx.time.delayedCall(350 + i * 120, () => {
        this.ctx.emitParticles(cx, cy, [0xffd700, 0xffaa00, 0xffcc44], 8);
        this.ctx.cameras.main.flash(80, 255, 215, 0);
      });
    }
    return allParts;
  }

  private pickStatCard(id: string, rarity: CardRarity = 'normal'): void {
    SoundManager.sfxCardSelect();
    const card = STAT_CARDS.find(c => c.id === id)!;
    const oldMax = this.ctx.playerMaxHp;
    this.ctx.cardLevels[id] = (this.ctx.cardLevels[id] ?? 0) + 1;

    const rarityExtra =
      rarity === 'legendary'
        ? card.legendValue - card.baseValue
        : rarity === 'rare'
          ? card.rareValue - card.baseValue
          : 0;
    if (rarityExtra > 0) {
      this.ctx.cardRarityBonus[id] = (this.ctx.cardRarityBonus[id] ?? 0) + rarityExtra;
    }

    if (rarity === 'legendary' && LEGENDARY_DESCS[id] && !this.ctx.legendaryEffects[id]) {
      this.ctx.legendaryEffects[id] = true;
      this.showLegendaryActivation(card);
    }

    const synIron = this.ctx.hasSynergy('iron_guard') ? 30 : 0;
    this.ctx.playerMaxHp = this.ctx.baseMaxHp + Math.floor(this.ctx.gcv('hp')) + synIron;
    if (this.ctx.playerMaxHp > oldMax) {
      this.ctx.playerHp = Math.min(
        this.ctx.playerHp + (this.ctx.playerMaxHp - oldMax),
        this.ctx.playerMaxHp,
      );
    }
    const newMaxMp = INIT_MP + Math.floor(this.ctx.gcv('mp'));
    if (newMaxMp > this.ctx.playerMaxMp) {
      this.ctx.playerMp = Math.min(this.ctx.playerMp + (newMaxMp - this.ctx.playerMaxMp), newMaxMp);
    }
    this.ctx.playerMaxMp = newMaxMp;
    this.ctx.drawMpBar();
    this.finishCardPick();
  }

  private pickSkillCard(id: string): void {
    SoundManager.sfxCardSelect();
    const curLv = this.ctx.skillLevels[id] ?? 0;
    if (curLv === 0) {
      this.ctx.skillLevels[id] = 1;
      this.ctx.equipSkill(id);
    } else {
      this.ctx.skillLevels[id] = Math.min(curLv + 1, 4);
    }
    this.finishCardPick();
  }

  private finishCardPick(): void {
    this.ctx.drawPlayerHpBar();
    this.ctx.updateUI();
    this.ctx.cameras.main.flash(200, 255, 255, 100);
    this.ctx.closeOverlay();
    this.checkSynergies();
    this.ctx.updateBuffBar();
    this.ctx.checkAchievements();
    this.ctx.autoSave();

    this.ctx.pendingLevelUps--;
    if (this.ctx.pendingLevelUps > 0) {
      this.ctx.time.delayedCall(500, () => this.showCardSelection());
    } else {
      this.ctx.cardSelecting = false;
      if (this.ctx.waitingFirstCard) {
        this.ctx.waitingFirstCard = false;
        this.ctx.stageManager.startStage();
        return;
      }
      if (this.ctx.stageManager.pendingStageClear) {
        this.ctx.stageManager.pendingStageClear = false;
        const boss = this.ctx.stageManager.pendingStageClearBoss;
        this.ctx.stageManager.pendingStageClearBoss = false;
        this.ctx.time.delayedCall(200, () => this.ctx.stageManager.onStageClear(boss));
      } else if (this.ctx.restCardPending) {
        this.ctx.restCardPending = false;
        this.ctx.stageManager.advanceToNextStage();
      }
    }
  }

  showLevelUpEffect(): void {
    const ring1 = this.ctx.add.graphics().setDepth(95).setAlpha(0.8);
    ring1.lineStyle(4, 0xffd700, 1);
    ring1.strokeCircle(400, 300, 20);
    ring1.fillStyle(0xffd700, 0.12);
    ring1.fillCircle(400, 300, 20);
    this.ctx.tweens.add({
      targets: ring1,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => ring1.destroy(),
    });
    const ring2 = this.ctx.add.graphics().setDepth(95).setAlpha(0.5);
    ring2.lineStyle(2, 0xffaa00, 1);
    ring2.strokeCircle(400, 300, 12);
    this.ctx.tweens.add({
      targets: ring2,
      scaleX: 10,
      scaleY: 10,
      alpha: 0,
      duration: 900,
      delay: 100,
      ease: 'Quad.easeOut',
      onComplete: () => ring2.destroy(),
    });
    SoundManager.sfxLevelUp();
    const lvText = this.ctx.add
      .text(400, 280, 'LEVEL UP!', {
        fontSize: '42px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(96)
      .setScale(0.3)
      .setAlpha(0);
    this.ctx.tweens.add({
      targets: lvText,
      scale: 1.2,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.ctx.tweens.add({
          targets: lvText,
          scale: 1.5,
          alpha: 0,
          y: 230,
          duration: 600,
          delay: 500,
          ease: 'Quad.easeIn',
          onComplete: () => lvText.destroy(),
        });
      },
    });
    this.ctx.emitParticles(400, 300, [0xffd700, 0xffaa00, 0xffcc44, 0xffffff], 14);
    this.ctx.cameras.main.flash(250, 255, 210, 0);
  }

  checkSynergies(): void {
    const prevActive = [...this.ctx.activeSynergies];
    this.ctx.activeSynergies = [];
    for (const syn of SYNERGIES) {
      const allMet = syn.requires.every(r => (this.ctx.cardLevels[r] ?? 0) >= 1);
      if (allMet) this.ctx.activeSynergies.push(syn.id);
    }
    for (const id of this.ctx.activeSynergies) {
      if (!prevActive.includes(id)) {
        const syn = SYNERGIES.find(s => s.id === id)!;
        this.showSynergyActivation(syn);
      }
    }
    this.updateSynergyDisplay();
  }

  private showSynergyActivation(syn: SynergyDef): void {
    const txt = this.ctx.add
      .text(400, 200, `🔗 시너지 발동! ${syn.icon}\n${syn.name}`, {
        fontSize: '28px',
        color: '#44ffaa',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0)
      .setScale(0.5);
    const sub = this.ctx.add
      .text(400, 248, syn.desc, {
        fontSize: '16px',
        color: '#aaffcc',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
    this.ctx.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.ctx.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 100 });
    this.ctx.emitParticles(400, 220, [0x44ffaa, 0x88ffcc, 0x22cc88], 12);
    this.ctx.cameras.main.flash(200, 68, 255, 170);
    this.ctx.time.delayedCall(2000, () => {
      this.ctx.tweens.add({
        targets: [txt, sub],
        alpha: 0,
        y: '-=30',
        duration: 400,
        onComplete: () => {
          txt.destroy();
          sub.destroy();
        },
      });
    });
  }

  createSynergyDisplay(): void {
    this.synergyContainer = this.ctx.add.container(730, 130).setDepth(50);
  }

  updateSynergyDisplay(): void {
    if (!this.synergyContainer) return;
    this.synergyContainer.removeAll(true);
    this.ctx.activeSynergies.forEach((id, i) => {
      const syn = SYNERGIES.find(s => s.id === id)!;
      const y = i * 28;
      const bg = this.ctx.add.graphics();
      bg.fillStyle(0x112233, 0.7);
      bg.fillRoundedRect(-60, y - 10, 120, 24, 6);
      bg.lineStyle(1, 0x44ffaa, 0.5);
      bg.strokeRoundedRect(-60, y - 10, 120, 24, 6);
      this.synergyContainer!.add(bg);
      const txt = this.ctx.add
        .text(0, y, `${syn.icon} ${syn.name}`, {
          fontSize: '10px',
          color: '#44ffaa',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.synergyContainer!.add(txt);
    });
  }

  private showLegendaryActivation(card: CardDef): void {
    const txt = this.ctx.add
      .text(400, 160, `★ 전설 발동! ★\n${card.icon} ${card.name}`, {
        fontSize: '32px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0)
      .setScale(0.3);
    const desc = this.ctx.add
      .text(400, 215, LEGENDARY_DESCS[card.id] ?? '', {
        fontSize: '18px',
        color: '#ffee88',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
    this.ctx.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.ctx.tweens.add({ targets: desc, alpha: 1, duration: 300, delay: 200 });
    this.ctx.emitParticles(400, 180, [0xffd700, 0xffaa00, 0xffffff, 0xffcc44], 18);
    this.ctx.cameras.main.flash(300, 255, 215, 0);

    const ring = this.ctx.add.graphics().setDepth(399).setAlpha(0.8);
    ring.lineStyle(3, 0xffd700, 1);
    ring.strokeCircle(400, 180, 15);
    this.ctx.tweens.add({
      targets: ring,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    this.ctx.time.delayedCall(2200, () => {
      this.ctx.tweens.add({
        targets: [txt, desc],
        alpha: 0,
        y: '-=40',
        duration: 500,
        onComplete: () => {
          txt.destroy();
          desc.destroy();
        },
      });
    });
  }
}
