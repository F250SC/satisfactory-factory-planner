import {
  baseMinerRates,
  beltRates,
  buildings,
  defaultRecipeFor,
  pipeRates,
  primaryProduct,
  purityMultiplier,
  rawResources,
  recipes,
  resourceMeta,
  type BeltTier,
  type GameRecipe,
  type MinerTier,
  type PipeTier,
  type Purity,
} from './data'

export interface ResourceConfig {
  purity: Purity
  miner: MinerTier
  belt: BeltTier
  pipe: PipeTier
  count: number
  manualRate?: number
}

export interface ResourceRate {
  extracted: number
  available: number
  transportLimited: boolean
  unit: 'items' | 'm³'
}

export interface MachineStep {
  item: string
  recipe: GameRecipe
  requiredRate: number
  exactMachinesAt100: number
  machines: number
  clocks: number[]
  totalPowerMW: number
}

export type RecipeOverrides = Record<string, string>

function selectedRecipe(itemId: string, overrides: RecipeOverrides) {
  const overrideId = overrides[itemId]
  if (overrideId) {
    const override = recipes.find((recipe) => recipe.className === overrideId)
    if (override?.products.some((product) => product.item === itemId)) return override
  }
  return defaultRecipeFor(itemId)
}

function outputRate(recipe: GameRecipe, itemId: string) {
  const product = primaryProduct(recipe, itemId)
  if (!product || recipe.time <= 0) return 0
  return product.amount * (60 / recipe.time)
}

function ingredientRate(recipe: GameRecipe, amount: number) {
  return amount * (60 / recipe.time)
}

export function resourceOutput(resourceId: string, config: ResourceConfig): ResourceRate {
  const meta = resourceMeta[resourceId]
  const count = Math.max(1, config.count || 1)

  if (!meta) {
    const manual = Math.max(0, config.manualRate ?? 0)
    return { extracted: manual, available: manual, transportLimited: false, unit: 'items' }
  }

  if (meta.kind === 'solid') {
    const perNode = baseMinerRates[config.miner] * purityMultiplier[config.purity]
    const perNodeAvailable = Math.min(perNode, beltRates[config.belt])
    return {
      extracted: perNode * count,
      available: perNodeAvailable * count,
      transportLimited: perNode > beltRates[config.belt] + 0.0001,
      unit: 'items',
    }
  }

  if (meta.kind === 'oil') {
    const perExtractor = 120 * purityMultiplier[config.purity]
    const perExtractorAvailable = Math.min(perExtractor, pipeRates[config.pipe])
    return {
      extracted: perExtractor * count,
      available: perExtractorAvailable * count,
      transportLimited: perExtractor > pipeRates[config.pipe] + 0.0001,
      unit: 'm³',
    }
  }

  if (meta.kind === 'water') {
    const perExtractor = 120
    const perExtractorAvailable = Math.min(perExtractor, pipeRates[config.pipe])
    return {
      extracted: perExtractor * count,
      available: perExtractorAvailable * count,
      transportLimited: perExtractor > pipeRates[config.pipe] + 0.0001,
      unit: 'm³',
    }
  }

  const perExtractor = 60 * purityMultiplier[config.purity]
  const perExtractorAvailable = Math.min(perExtractor, pipeRates[config.pipe])
  return {
    extracted: perExtractor * count,
    available: perExtractorAvailable * count,
    transportLimited: perExtractor > pipeRates[config.pipe] + 0.0001,
    unit: 'm³',
  }
}

function rawRequirementPerUnit(
  itemId: string,
  overrides: RecipeOverrides,
  stack: string[] = [],
): Record<string, number> {
  const hasOverride = Boolean(overrides[itemId])

  if (rawResources.includes(itemId) && !hasOverride) {
    return { [itemId]: 1 }
  }

  if (stack.includes(itemId)) {
    throw new Error(`Recipe cycle detected: ${[...stack, itemId].join(' -> ')}`)
  }

  const recipe = selectedRecipe(itemId, overrides)
  if (!recipe) {
    return { [itemId]: 1 }
  }

  const outRate = outputRate(recipe, itemId)
  if (outRate <= 0) return { [itemId]: 1 }

  const requirements: Record<string, number> = {}

  for (const input of recipe.ingredients) {
    const inRate = ingredientRate(recipe, input.amount)
    const inputPerOutput = inRate / outRate
    const nested = rawRequirementPerUnit(input.item, overrides, [...stack, itemId])

    for (const [raw, amount] of Object.entries(nested)) {
      requirements[raw] = (requirements[raw] ?? 0) + amount * inputPerOutput
    }
  }

  return requirements
}

function collectMachineRates(
  itemId: string,
  requiredRate: number,
  overrides: RecipeOverrides,
  accumulator: Map<string, { item: string; recipe: GameRecipe; rate: number }>,
  stack: string[] = [],
) {
  const hasOverride = Boolean(overrides[itemId])
  if (rawResources.includes(itemId) && !hasOverride) return
  if (stack.includes(itemId)) return

  const recipe = selectedRecipe(itemId, overrides)
  if (!recipe) return

  const key = `${itemId}::${recipe.className}`
  const current = accumulator.get(key)
  accumulator.set(key, {
    item: itemId,
    recipe,
    rate: (current?.rate ?? 0) + requiredRate,
  })

  const outRate = outputRate(recipe, itemId)
  if (outRate <= 0) return

  for (const ingredient of recipe.ingredients) {
    const needed =
      requiredRate *
      (ingredientRate(recipe, ingredient.amount) / outRate)
    collectMachineRates(
      ingredient.item,
      needed,
      overrides,
      accumulator,
      [...stack, itemId],
    )
  }
}

function clockPlan(exactMachinesAt100: number, maxClock: number) {
  const capacityPerMachine = maxClock / 100
  const machines = Math.max(1, Math.ceil(exactMachinesAt100 / capacityPerMachine))
  let remainingPercent = exactMachinesAt100 * 100
  const clocks: number[] = []

  for (let i = 0; i < machines; i += 1) {
    const clock = Math.min(maxClock, remainingPercent)
    clocks.push(Math.max(1, clock))
    remainingPercent -= clock
  }

  return { machines, clocks }
}

function machinePower(recipe: GameRecipe, clocks: number[]) {
  const building = buildings[recipe.producedIn]
  if (!building) return 0

  if (recipe.variablePower && recipe.maxPower > recipe.minPower) {
    return clocks.reduce((sum, clock) => {
      const factor = clock / 100
      const average = (recipe.minPower + recipe.maxPower) / 2
      return sum + average * Math.pow(factor, 1.321928)
    }, 0)
  }

  return clocks.reduce(
    (sum, clock) => sum + building.power * Math.pow(clock / 100, 1.321928),
    0,
  )
}

export function calculateProduction(
  targetItem: string,
  availability: Record<string, number>,
  maxClock: number,
  overrides: RecipeOverrides,
) {
  const rawPerUnit = rawRequirementPerUnit(targetItem, overrides)
  const rawEntries = Object.entries(rawPerUnit).filter(([, amount]) => amount > 0)

  const possibleRates = rawEntries.map(([resource, requirement]) => {
    const available = availability[resource] ?? 0
    return available / requirement
  })

  const output =
    possibleRates.length > 0 && possibleRates.every(Number.isFinite)
      ? Math.max(0, Math.min(...possibleRates))
      : 0

  const rawUsed: Record<string, number> = {}
  const leftovers: Record<string, number> = {}

  for (const [resource, requirement] of rawEntries) {
    rawUsed[resource] = output * requirement
    leftovers[resource] = Math.max(0, (availability[resource] ?? 0) - rawUsed[resource])
  }

  const collected = new Map<string, { item: string; recipe: GameRecipe; rate: number }>()
  collectMachineRates(targetItem, output, overrides, collected)

  const machineSteps: MachineStep[] = Array.from(collected.values()).map(({ item, recipe, rate }) => {
    const perMachine = outputRate(recipe, item)
    const exactMachinesAt100 = perMachine > 0 ? rate / perMachine : 0
    const { machines, clocks } = clockPlan(exactMachinesAt100, maxClock)

    return {
      item,
      recipe,
      requiredRate: rate,
      exactMachinesAt100,
      machines,
      clocks,
      totalPowerMW: machinePower(recipe, clocks),
    }
  })

  return {
    output,
    rawPerUnit,
    rawUsed,
    leftovers,
    requiredResources: rawEntries.map(([resource]) => resource),
    machineSteps,
    totalPowerMW: machineSteps.reduce((sum, step) => sum + step.totalPowerMW, 0),
  }
}

export function getRecipeFor(itemId: string, overrides: RecipeOverrides) {
  return selectedRecipe(itemId, overrides)
}
