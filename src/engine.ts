import {
  baseMinerRates,
  beltRates,
  purityMultiplier,
  rawResources,
  recipes,
  type BeltTier,
  type ItemId,
  type MinerTier,
  type Purity,
  type Recipe,
} from './data'

export interface ResourceConfig {
  purity: Purity
  miner: MinerTier
  belt: BeltTier
}

export interface ResourceRate {
  mined: number
  available: number
  beltLimited: boolean
}

export interface MachineStep {
  item: ItemId
  recipe: Recipe
  requiredRate: number
  exactMachines: number
  machines: number
  clock: number
}

function recipeFor(item: ItemId) {
  return recipes.find((recipe) => recipe.output === item)
}

export function minerOutput(config: ResourceConfig): ResourceRate {
  const mined = baseMinerRates[config.miner] * purityMultiplier[config.purity]
  const available = Math.min(mined, beltRates[config.belt])
  return {
    mined,
    available,
    beltLimited: available + 0.0001 < mined,
  }
}

export function rawRequirementPerUnit(item: ItemId): Partial<Record<ItemId, number>> {
  if (rawResources.includes(item)) {
    return { [item]: 1 }
  }

  const recipe = recipeFor(item)
  if (!recipe) {
    throw new Error(`No recipe configured for ${item}`)
  }

  const requirements: Partial<Record<ItemId, number>> = {}

  for (const input of recipe.inputs) {
    const inputPerOutput = input.rate / recipe.outputRate
    const nested = rawRequirementPerUnit(input.item)

    for (const [raw, amount] of Object.entries(nested) as Array<[ItemId, number]>) {
      requirements[raw] = (requirements[raw] ?? 0) + amount * inputPerOutput
    }
  }

  return requirements
}

function collectMachineRates(
  item: ItemId,
  requiredRate: number,
  accumulator: Partial<Record<ItemId, number>>,
) {
  if (rawResources.includes(item)) return

  const recipe = recipeFor(item)
  if (!recipe) {
    throw new Error(`No recipe configured for ${item}`)
  }

  accumulator[item] = (accumulator[item] ?? 0) + requiredRate

  for (const input of recipe.inputs) {
    const inputRate = requiredRate * (input.rate / recipe.outputRate)
    collectMachineRates(input.item, inputRate, accumulator)
  }
}

export function calculateProduction(
  target: ItemId,
  resourceAvailability: Partial<Record<ItemId, number>>,
  allowOverclock: boolean,
) {
  const rawPerUnit = rawRequirementPerUnit(target)
  const usedRaw = Object.entries(rawPerUnit) as Array<[ItemId, number]>

  const possibleRates = usedRaw.map(([resource, requirement]) => {
    const available = resourceAvailability[resource] ?? 0
    return requirement > 0 ? available / requirement : Number.POSITIVE_INFINITY
  })

  const output = possibleRates.length > 0 ? Math.min(...possibleRates) : 0
  const rawUsed: Partial<Record<ItemId, number>> = {}
  const leftovers: Partial<Record<ItemId, number>> = {}

  for (const [resource, requirement] of usedRaw) {
    const used = output * requirement
    const available = resourceAvailability[resource] ?? 0
    rawUsed[resource] = used
    leftovers[resource] = Math.max(0, available - used)
  }

  const machineRates: Partial<Record<ItemId, number>> = {}
  collectMachineRates(target, output, machineRates)

  const machineSteps: MachineStep[] = Object.entries(machineRates).map(([itemKey, requiredRate]) => {
    const item = itemKey as ItemId
    const recipe = recipeFor(item)!
    const exactMachines = requiredRate / recipe.outputRate
    const machines = allowOverclock
      ? Math.max(1, Math.ceil(exactMachines / 2.5))
      : Math.max(1, Math.ceil(exactMachines))
    const clock = (exactMachines / machines) * 100

    return {
      item,
      recipe,
      requiredRate,
      exactMachines,
      machines,
      clock,
    }
  })

  return {
    output,
    rawPerUnit,
    rawUsed,
    leftovers,
    requiredResources: usedRaw.map(([resource]) => resource),
    machineSteps,
  }
}
