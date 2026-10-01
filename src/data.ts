export type Purity = 'impure' | 'normal' | 'pure'
export type MinerTier = 'mk1' | 'mk2' | 'mk3'

export const purityLabel: Record<Purity, string> = {
  impure: 'Impure',
  normal: 'Normal',
  pure: 'Pure',
}

export const minerLabel: Record<MinerTier, string> = {
  mk1: 'Miner Mk.1',
  mk2: 'Miner Mk.2',
  mk3: 'Miner Mk.3',
}

export const baseMinerRates: Record<MinerTier, number> = {
  mk1: 60,
  mk2: 120,
  mk3: 240,
}

export const purityMultiplier: Record<Purity, number> = {
  impure: 0.5,
  normal: 1,
  pure: 2,
}

export const steelRecipe = {
  name: 'Steel Ingot',
  machine: 'Foundry',
  ironPerMinute: 45,
  coalPerMinute: 45,
  outputPerMinute: 45,
  powerMW: 16,
}
