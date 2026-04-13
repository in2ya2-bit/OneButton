export interface CardDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  baseValue: number;
  rareValue: number;
  legendValue: number;
  descFn: (v: number) => string;
  isSkill?: boolean;
}

export type CardRarity = 'normal' | 'rare' | 'legendary';

export interface PotionDef {
  healAmount: number;
  bgColor: number;
  borderColor: number;
  label: string;
}

export interface ShopItemDef {
  name: string;
  desc: string;
  cost: number;
  icon: string;
  kind: 'potion' | 'buff';
  potionLv?: number;
  buffType?: string;
}

export interface DoorDef {
  type: string;
  icon: string;
  name: string;
  desc: string;
  color: number;
}

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  effect: string;
}

export interface SynergyDef {
  id: string;
  name: string;
  icon: string;
  requires: string[];
  desc: string;
}

export interface AutoAtkCardDef {
  classId: string;
  name: string;
  icon: string;
  desc: string;
  color: number;
}

export interface QuickSlotData {
  potionLv: number;
  count: number;
}
