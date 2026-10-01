import progressionData from './progressionData.json'
import { buildings, recipes, recipesForProduct } from './data'

export interface ProgressionProfile {
  tier: number
  unlockedAlternates: string[]
}

interface Schematic {
  id: string
  name: string
  type: string
  tier: number
  recipes: string[]
  buildings: string[]
  requiredSchematics: string[]
}

const schematics = progressionData.schematics as Schematic[]

const STARTING_RECIPES = new Set([
  'Recipe_IngotIron_C',
  'Recipe_IronPlate_C',
  'Recipe_IronRod_C',
])

export const milestoneSchematics = schematics
  .filter((s) => s.type === 'EST_Milestone')
  .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))

export const tutorialSchematics = schematics
  .filter((s) => s.type === 'EST_Tutorial')

export const alternateSchematics = schematics
  .filter((s) => s.type === 'EST_Alternate')
  .sort((a, b) => a.name.localeCompare(b.name))

export function unlockState(profile: ProgressionProfile) {
  const recipeIds = new Set<string>(STARTING_RECIPES)
  const buildingIds = new Set<string>()
  const purchasedSchematics = new Set<string>()

  for (const s of tutorialSchematics) {
    purchasedSchematics.add(s.id)
    s.recipes.forEach((id) => recipeIds.add(id))
    s.buildings.forEach((id) => buildingIds.add(id))
  }

  for (const s of milestoneSchematics) {
    if (s.tier <= profile.tier) {
      purchasedSchematics.add(s.id)
      s.recipes.forEach((id) => recipeIds.add(id))
      s.buildings.forEach((id) => buildingIds.add(id))
    }
  }

  for (const id of profile.unlockedAlternates) {
    const s = alternateSchematics.find((entry) => entry.id === id)
    if (!s) continue
    purchasedSchematics.add(s.id)
    s.recipes.forEach((recipeId) => recipeIds.add(recipeId))
  }

  return { recipeIds, buildingIds, purchasedSchematics }
}

export function isRecipeUsable(recipeId: string, producedIn: string, profile: ProgressionProfile) {
  const state = unlockState(profile)
  return state.recipeIds.has(recipeId) && (!producedIn || state.buildingIds.has(producedIn) || !buildings[producedIn])
}

export function availableRecipesForProduct(itemId: string, profile: ProgressionProfile) {
  const state = unlockState(profile)
  return recipesForProduct(itemId).filter((recipe) =>
    state.recipeIds.has(recipe.className) &&
    (!recipe.producedIn || state.buildingIds.has(recipe.producedIn) || !buildings[recipe.producedIn])
  )
}

export function availableTargetItems(profile: ProgressionProfile) {
  const ids = new Set<string>()
  for (const recipe of recipes) {
    if (!recipe.products.length) continue
    if (!isRecipeUsable(recipe.className, recipe.producedIn, profile)) continue
    for (const product of recipe.products) ids.add(product.item)
  }
  return [...ids]
}

export function eligibleAlternates(profile: ProgressionProfile) {
  const state = unlockState({ ...profile, unlockedAlternates: [] })

  return alternateSchematics.filter((alt) => {
    const tierRequirement = alt.tier || 0
    if (tierRequirement > profile.tier) return false

    return alt.requiredSchematics.every((req) => {
      if (req.startsWith('Schematic_')) return state.purchasedSchematics.has(req)
      // MAM dependencies are not auto-assumed yet; keep the alternate visible
      // so the player can explicitly mark a discovered hard-drive recipe.
      return true
    })
  })
}
