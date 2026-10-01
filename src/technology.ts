import type { BeltTier, MinerTier, PipeTier } from './data'

const minerOrder: MinerTier[] = ['mk1', 'mk2', 'mk3']
const beltOrder: BeltTier[] = ['mk1', 'mk2', 'mk3', 'mk4', 'mk5', 'mk6']
const pipeOrder: PipeTier[] = ['mk1', 'mk2']

export function maxMinerForTier(tier: number): MinerTier {
  if (tier >= 8) return 'mk3'
  if (tier >= 4) return 'mk2'
  return 'mk1'
}

export function maxBeltForTier(tier: number): BeltTier {
  if (tier >= 9) return 'mk6'
  if (tier >= 7) return 'mk5'
  if (tier >= 5) return 'mk4'
  if (tier >= 4) return 'mk3'
  if (tier >= 2) return 'mk2'
  return 'mk1'
}

export function maxPipeForTier(tier: number): PipeTier {
  return tier >= 6 ? 'mk2' : 'mk1'
}

export function unlockedMiners(tier: number): MinerTier[] {
  const max = maxMinerForTier(tier)
  return minerOrder.slice(0, minerOrder.indexOf(max) + 1)
}

export function unlockedBelts(tier: number): BeltTier[] {
  const max = maxBeltForTier(tier)
  return beltOrder.slice(0, beltOrder.indexOf(max) + 1)
}

export function unlockedPipes(tier: number): PipeTier[] {
  const max = maxPipeForTier(tier)
  return pipeOrder.slice(0, pipeOrder.indexOf(max) + 1)
}

export function clampMinerToTier(miner: MinerTier, tier: number): MinerTier {
  const allowed = unlockedMiners(tier)
  return allowed.includes(miner) ? miner : allowed[allowed.length - 1]
}

export function clampBeltToTier(belt: BeltTier, tier: number): BeltTier {
  const allowed = unlockedBelts(tier)
  return allowed.includes(belt) ? belt : allowed[allowed.length - 1]
}

export function clampPipeToTier(pipe: PipeTier, tier: number): PipeTier {
  const allowed = unlockedPipes(tier)
  return allowed.includes(pipe) ? pipe : allowed[allowed.length - 1]
}
