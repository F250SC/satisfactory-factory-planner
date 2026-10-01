import { baseMinerRates, purityMultiplier, steelRecipe, type MinerTier, type Purity } from './data'

export function minerOutput(miner: MinerTier, purity: Purity, clock = 100) {
  return baseMinerRates[miner] * purityMultiplier[purity] * (clock / 100)
}

export function calculateSteel(
  ironRate: number,
  coalRate: number,
  allowOverclock = true,
) {
  const limitingInput = Math.min(
    ironRate / steelRecipe.ironPerMinute,
    coalRate / steelRecipe.coalPerMinute,
  )

  const theoreticalOutput = limitingInput * steelRecipe.outputPerMinute

  if (allowOverclock && limitingInput <= 2.5) {
    const foundries = 1
    const clock = limitingInput * 100
    return {
      foundries,
      clock,
      output: theoreticalOutput,
      ironUsed: steelRecipe.ironPerMinute * limitingInput,
      coalUsed: steelRecipe.coalPerMinute * limitingInput,
    }
  }

  const foundries = Math.max(1, Math.ceil(limitingInput))
  const clock = (limitingInput / foundries) * 100
  return {
    foundries,
    clock,
    output: theoreticalOutput,
    ironUsed: steelRecipe.ironPerMinute * limitingInput,
    coalUsed: steelRecipe.coalPerMinute * limitingInput,
  }
}
