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
  clockSpeed: number
  shards: number
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
  actualOutputRate: number
  surplusRate: number
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

export function resourceOutput(
  resourceId: string,
  config: ResourceConfig,
  clockControlUnlocked = true,
): ResourceRate {
  const meta = resourceMeta[resourceId]
  const count = Math.max(1, config.count || 1)

  if (!meta) {
    const manual = Math.max(0, config.manualRate ?? 0)
    return { extracted: manual, available: manual, transportLimited: false, unit: 'items' }
  }

  const maxClock = clockControlUnlocked
    ? 100 + Math.max(0, Math.min(3, config.shards)) * 50
    : 100
  const effectiveClock = clockControlUnlocked
    ? Math.max(1, Math.min(maxClock, config.clockSpeed || 100))
    : 100
  const clockFactor = effectiveClock / 100

  if (meta.kind === 'solid') {
    const perNode =
      baseMinerRates[config.miner] *
      purityMultiplier[config.purity] *
      clockFactor
    const perNodeAvailable = Math.min(perNode, beltRates[config.belt])
    return {
      extracted: perNode * count,
      available: perNodeAvailable * count,
      transportLimited: perNode > beltRates[config.belt] + 0.0001,
      unit: 'items',
    }
  }

  if (meta.kind === 'oil') {
    const perExtractor = 120 * purityMultiplier[config.purity] * clockFactor
    const perExtractorAvailable = Math.min(perExtractor, pipeRates[config.pipe])
    return {
      extracted: perExtractor * count,
      available: perExtractorAvailable * count,
      transportLimited: perExtractor > pipeRates[config.pipe] + 0.0001,
      unit: 'm³',
    }
  }

  if (meta.kind === 'water') {
    const perExtractor = 120 * clockFactor
    const perExtractorAvailable = Math.min(perExtractor, pipeRates[config.pipe])
    return {
      extracted: perExtractor * count,
      available: perExtractorAvailable * count,
      transportLimited: perExtractor > pipeRates[config.pipe] + 0.0001,
      unit: 'm³',
    }
  }

  const perExtractor = 60 * purityMultiplier[config.purity] * clockFactor
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
    return { [itemId]: 1 }
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

function clockPlan(
  exactMachinesAt100: number,
  productionShards: number,
) {
  const maxClock = 100 + Math.max(0, Math.min(3, productionShards)) * 50
  const capacityPerMachine = maxClock / 100
  const machines = Math.max(1, Math.ceil(exactMachinesAt100 / capacityPerMachine))
  let remainingPercent = exactMachinesAt100 * 100
  const clocks: number[] = []

  for (let i = 0; i < machines; i += 1) {
    const clock = Math.min(maxClock, remainingPercent)
    clocks.push(Math.max(1, Math.round(clock * 10000) / 10000))
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

interface LockedPlan {
  feasible: boolean
  output: number
  rawUsed: Record<string, number>
  machineSteps: MachineStep[]
}

/**
 * Build a continuously supplied plan with every production machine fixed at 100%.
 * Upstream machines are rounded up to whole machines and therefore may create
 * intermediate surplus. Their FULL 100% input consumption is propagated upstream.
 */
function buildLockedPlan(
  targetItem: string,
  targetMachines: number,
  availability: Record<string, number>,
  overrides: RecipeOverrides,
): LockedPlan {
  const targetRecipe = selectedRecipe(targetItem, overrides)
  if (!targetRecipe || targetMachines < 1) {
    return { feasible: false, output: 0, rawUsed: {}, machineSteps: [] }
  }

  const targetPerMachine = outputRate(targetRecipe, targetItem)
  if (targetPerMachine <= 0) {
    return { feasible: false, output: 0, rawUsed: {}, machineSteps: [] }
  }

  const demands = new Map<string, number>()
  const queue: string[] = [targetItem]
  const queued = new Set<string>([targetItem])
  const machineState = new Map<string, {
    item: string
    recipe: GameRecipe
    demand: number
    machines: number
    actualOutput: number
  }>()
  const edgeContributions = new Map<string, number>()

  demands.set(targetItem, targetMachines * targetPerMachine)

  let iterations = 0
  while (queue.length > 0 && iterations < 2000) {
    iterations += 1
    const itemId = queue.shift()!
    queued.delete(itemId)

    const hasOverride = Boolean(overrides[itemId])
    if (rawResources.includes(itemId) && !hasOverride) continue

    const recipe = selectedRecipe(itemId, overrides)
    if (!recipe) continue

    const perMachine = outputRate(recipe, itemId)
    if (perMachine <= 0) continue

    const demand = demands.get(itemId) ?? 0
    const machines =
      itemId === targetItem
        ? targetMachines
        : Math.max(1, Math.ceil((demand - 1e-9) / perMachine))
    const actualOutput = machines * perMachine

    machineState.set(itemId, {
      item: itemId,
      recipe,
      demand,
      machines,
      actualOutput,
    })

    const parentKey = `${itemId}::${recipe.className}`

    for (const ingredient of recipe.ingredients) {
      const contribution = machines * ingredientRate(recipe, ingredient.amount)
      const edgeKey = `${parentKey}->${ingredient.item}`
      const previous = edgeContributions.get(edgeKey) ?? 0
      const delta = contribution - previous

      if (Math.abs(delta) < 1e-9) continue

      edgeContributions.set(edgeKey, contribution)
      demands.set(
        ingredient.item,
        Math.max(0, (demands.get(ingredient.item) ?? 0) + delta),
      )

      if (!queued.has(ingredient.item)) {
        queue.push(ingredient.item)
        queued.add(ingredient.item)
      }
    }
  }

  if (iterations >= 2000) {
    return { feasible: false, output: 0, rawUsed: {}, machineSteps: [] }
  }

  const rawUsed: Record<string, number> = {}
  for (const [itemId, demand] of demands.entries()) {
    const hasOverride = Boolean(overrides[itemId])
    const recipe = selectedRecipe(itemId, overrides)
    const terminal =
      (rawResources.includes(itemId) && !hasOverride) ||
      !recipe

    if (terminal) {
      rawUsed[itemId] = demand
    }
  }

  const feasible = Object.entries(rawUsed).every(
    ([resource, demand]) => demand <= (availability[resource] ?? 0) + 1e-6,
  )

  const machineSteps: MachineStep[] = Array.from(machineState.values()).map((state) => {
    const clocks = Array.from({ length: state.machines }, () => 100)
    return {
      item: state.item,
      recipe: state.recipe,
      requiredRate: state.demand,
      actualOutputRate: state.actualOutput,
      surplusRate: Math.max(0, state.actualOutput - state.demand),
      exactMachinesAt100: state.demand / outputRate(state.recipe, state.item),
      machines: state.machines,
      clocks,
      totalPowerMW: machinePower(state.recipe, clocks),
    }
  })

  return {
    feasible,
    output: targetMachines * targetPerMachine,
    rawUsed,
    machineSteps,
  }
}

export function calculateProduction(
  targetItem: string,
  availability: Record<string, number>,
  clockControlUnlocked: boolean,
  productionShards: number,
  overrides: RecipeOverrides,
) {
  const rawPerUnit = rawRequirementPerUnit(targetItem, overrides)
  const rawEntries = Object.entries(rawPerUnit).filter(([, amount]) => amount > 0)

  const possibleRates = rawEntries.map(([resource, requirement]) => {
    const available = availability[resource] ?? 0
    return available / requirement
  })

  const theoreticalOutput =
    possibleRates.length > 0 && possibleRates.every(Number.isFinite)
      ? Math.max(0, Math.min(...possibleRates))
      : 0

  if (!clockControlUnlocked) {
    const targetRecipe = selectedRecipe(targetItem, overrides)
    const targetPerMachine = targetRecipe ? outputRate(targetRecipe, targetItem) : 0
    const maxTargetMachines =
      targetPerMachine > 0
        ? Math.max(0, Math.floor((theoreticalOutput + 1e-6) / targetPerMachine))
        : 0

    let lockedPlan: LockedPlan = {
      feasible: false,
      output: 0,
      rawUsed: {},
      machineSteps: [],
    }

    for (let machines = maxTargetMachines; machines >= 1; machines -= 1) {
      const candidate = buildLockedPlan(
        targetItem,
        machines,
        availability,
        overrides,
      )
      if (candidate.feasible) {
        lockedPlan = candidate
        break
      }
    }

    const rawUsed: Record<string, number> = {}
    const leftovers: Record<string, number> = {}

    for (const [resource] of rawEntries) {
      const used = lockedPlan.rawUsed[resource] ?? 0
      rawUsed[resource] = used
      leftovers[resource] = Math.max(0, (availability[resource] ?? 0) - used)
    }

    return {
      output: lockedPlan.output,
      theoreticalOutput,
      practicalClockLimited: lockedPlan.output + 1e-6 < theoreticalOutput,
      rawPerUnit,
      rawUsed,
      leftovers,
      requiredResources: rawEntries.map(([resource]) => resource),
      machineSteps: lockedPlan.machineSteps,
      totalPowerMW: lockedPlan.machineSteps.reduce(
        (sum, step) => sum + step.totalPowerMW,
        0,
      ),
    }
  }

  const rawUsed: Record<string, number> = {}
  const leftovers: Record<string, number> = {}

  for (const [resource, requirement] of rawEntries) {
    rawUsed[resource] = theoreticalOutput * requirement
    leftovers[resource] = Math.max(
      0,
      (availability[resource] ?? 0) - rawUsed[resource],
    )
  }

  const collected = new Map<string, { item: string; recipe: GameRecipe; rate: number }>()
  collectMachineRates(targetItem, theoreticalOutput, overrides, collected)

  const machineSteps: MachineStep[] = Array.from(collected.values()).map(
    ({ item, recipe, rate }) => {
      const perMachine = outputRate(recipe, item)
      const exactMachinesAt100 = perMachine > 0 ? rate / perMachine : 0
      const { machines, clocks } = clockPlan(
        exactMachinesAt100,
        productionShards,
      )
      const actualOutputRate = clocks.reduce(
        (sum, clock) => sum + perMachine * (clock / 100),
        0,
      )

      return {
        item,
        recipe,
        requiredRate: rate,
        actualOutputRate,
        surplusRate: Math.max(0, actualOutputRate - rate),
        exactMachinesAt100,
        machines,
        clocks,
        totalPowerMW: machinePower(recipe, clocks),
      }
    },
  )

  return {
    output: theoreticalOutput,
    theoreticalOutput,
    practicalClockLimited: false,
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
