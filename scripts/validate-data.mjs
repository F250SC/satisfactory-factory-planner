import fs from 'node:fs/promises'
import gameData from '../src/gameData.json' with { type: 'json' }
import progressionData from '../src/progressionData.json' with { type: 'json' }

const errors = []
const warnings = []

const items = gameData.items ?? {}
const recipes = Array.isArray(gameData.recipes) ? gameData.recipes : []
const buildings = gameData.buildings ?? {}
const resources = Array.isArray(gameData.resources) ? gameData.resources : []

function error(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
}

const recipeIds = new Set()
for (const recipe of recipes) {
  if (!recipe?.className) {
    error('Recipe without className found.')
    continue
  }

  if (recipeIds.has(recipe.className)) {
    error(`Duplicate recipe id: ${recipe.className}`)
  }
  recipeIds.add(recipe.className)

  if (!(Number(recipe.time) > 0)) {
    error(`Recipe ${recipe.className} has invalid time: ${recipe.time}`)
  }

  if (!Array.isArray(recipe.products) || recipe.products.length === 0) {
    error(`Recipe ${recipe.className} has no products.`)
  }

  for (const part of [...(recipe.ingredients ?? []), ...(recipe.products ?? [])]) {
    if (!part?.item || !items[part.item]) {
      error(`Recipe ${recipe.className} references unknown item: ${part?.item ?? '<missing>'}`)
    }
    if (!(Number(part?.amount) > 0)) {
      error(`Recipe ${recipe.className} has invalid amount for ${part?.item ?? '<missing>'}: ${part?.amount}`)
    }
  }

  if (recipe.producedIn && !buildings[recipe.producedIn]) {
    error(`Recipe ${recipe.className} references unknown building: ${recipe.producedIn}`)
  }
}

for (const resource of resources) {
  if (!items[resource]) {
    error(`Raw resource references unknown item: ${resource}`)
  }
}

const metadataCount = Number(gameData.metadata?.recipeCount)
if (Number.isFinite(metadataCount) && metadataCount !== recipes.length) {
  error(
    `Metadata recipeCount (${metadataCount}) does not match recipes array (${recipes.length}).`,
  )
}

const alternateCount = recipes.filter((recipe) => recipe.alternate).length
const metadataAlternateCount = Number(gameData.metadata?.alternateCount)
if (
  Number.isFinite(metadataAlternateCount) &&
  metadataAlternateCount !== alternateCount
) {
  error(
    `Metadata alternateCount (${metadataAlternateCount}) does not match actual alternates (${alternateCount}).`,
  )
}

for (const [id, building] of Object.entries(buildings)) {
  if (!building?.name) warn(`Building ${id} has no display name.`)
  if (!Number.isFinite(Number(building?.power))) {
    error(`Building ${id} has invalid power value: ${building?.power}`)
  }
}

const schematics = Array.isArray(progressionData.schematics)
  ? progressionData.schematics
  : []
const schematicIds = new Set()

for (const schematic of schematics) {
  if (!schematic?.id) {
    error('Progression schematic without id found.')
    continue
  }
  if (schematicIds.has(schematic.id)) {
    error(`Duplicate progression schematic id: ${schematic.id}`)
  }
  schematicIds.add(schematic.id)

  for (const recipeId of schematic.recipes ?? []) {
    if (!recipeIds.has(recipeId)) {
      error(
        `Progression schematic ${schematic.id} references unknown recipe: ${recipeId}`,
      )
    }
  }

  for (const buildingId of schematic.buildings ?? []) {
    if (!buildings[buildingId]) {
      error(
        `Progression schematic ${schematic.id} references unknown building: ${buildingId}`,
      )
    }
  }
}

for (const schematic of schematics) {
  for (const requirement of schematic.requiredSchematics ?? []) {
    if (
      requirement.startsWith('Schematic_') &&
      !schematicIds.has(requirement)
    ) {
      warn(
        `Progression schematic ${schematic.id} references external/unknown prerequisite: ${requirement}`,
      )
    }
  }
}

const footprintSource = await fs.readFile(
  new URL('../src/buildingFootprints.ts', import.meta.url),
  'utf8',
)
const footprintIds = new Set(
  [...footprintSource.matchAll(/^\s*(Desc_[A-Za-z0-9_]+_C):\s*\{/gm)].map(
    (match) => match[1],
  ),
)

for (const buildingId of Object.keys(buildings)) {
  if (!footprintIds.has(buildingId)) {
    error(
      `Production building ${buildingId} has no explicit Factory Designer footprint.`,
    )
  }
}

console.log(
  `Validated ${recipes.length} recipes, ${Object.keys(items).length} items, ${Object.keys(buildings).length} buildings, ${resources.length} raw resources and ${schematics.length} progression schematics.`,
)

for (const message of warnings) console.warn(`WARN: ${message}`)

if (errors.length) {
  for (const message of errors) console.error(`ERROR: ${message}`)
  console.error(`Game-data validation failed with ${errors.length} error(s).`)
  process.exit(1)
}

console.log('Game-data validation passed.')
