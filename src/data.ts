import gameData from './gameData.json'
import deTranslations from './deTranslations.json'

export type Purity = 'impure' | 'normal' | 'pure'
export type MinerTier = 'mk1' | 'mk2' | 'mk3'
export type BeltTier = 'mk1' | 'mk2' | 'mk3' | 'mk4' | 'mk5' | 'mk6'
export type PipeTier = 'mk1' | 'mk2'
export type ResourceKind = 'solid' | 'oil' | 'water' | 'nitrogen'

export interface GameItem {
  name: string
  liquid: boolean
  icon?: string
}

export interface GameRecipePart {
  item: string
  amount: number
}

export interface GameRecipe {
  className: string
  name: string
  alternate: boolean
  time: number
  ingredients: GameRecipePart[]
  products: GameRecipePart[]
  producedIn: string
  variablePower: boolean
  minPower: number
  maxPower: number
}

export interface GameBuilding {
  name: string
  power: number
}

export const items = gameData.items as Record<string, GameItem>
export const recipes = gameData.recipes as GameRecipe[]
export const buildings = gameData.buildings as Record<string, GameBuilding>
export const rawResources = gameData.resources as string[]
export const dataMetadata = gameData.metadata

export const purityMultiplier: Record<Purity, number> = {
  impure: 0.5,
  normal: 1,
  pure: 2,
}

export const baseMinerRates: Record<MinerTier, number> = {
  mk1: 60,
  mk2: 120,
  mk3: 240,
}

export const beltRates: Record<BeltTier, number> = {
  mk1: 60,
  mk2: 120,
  mk3: 270,
  mk4: 480,
  mk5: 780,
  mk6: 1200,
}

export const pipeRates: Record<PipeTier, number> = {
  mk1: 300,
  mk2: 600,
}

export const resourceMeta: Record<string, {
  de: string
  en: string
  kind: ResourceKind
}> = {
  Desc_OreIron_C: { de: 'Eisenerz', en: 'Iron Ore', kind: 'solid' },
  Desc_Coal_C: { de: 'Kohle', en: 'Coal', kind: 'solid' },
  Desc_Water_C: { de: 'Wasser', en: 'Water', kind: 'water' },
  Desc_NitrogenGas_C: { de: 'Stickstoffgas', en: 'Nitrogen Gas', kind: 'nitrogen' },
  Desc_Sulfur_C: { de: 'Schwefel', en: 'Sulfur', kind: 'solid' },
  Desc_SAM_C: { de: 'SAM', en: 'SAM', kind: 'solid' },
  Desc_OreBauxite_C: { de: 'Bauxit', en: 'Bauxite', kind: 'solid' },
  Desc_OreGold_C: { de: 'Cateriumerz', en: 'Caterium Ore', kind: 'solid' },
  Desc_OreCopper_C: { de: 'Kupfererz', en: 'Copper Ore', kind: 'solid' },
  Desc_RawQuartz_C: { de: 'Rohquarz', en: 'Raw Quartz', kind: 'solid' },
  Desc_Stone_C: { de: 'Kalkstein', en: 'Limestone', kind: 'solid' },
  Desc_OreUranium_C: { de: 'Uranerz', en: 'Uranium', kind: 'solid' },
  Desc_LiquidOil_C: { de: 'Rohöl', en: 'Crude Oil', kind: 'oil' },
}

export const machineGermanNames: Record<string, string> = {
  Desc_ConstructorMk1_C: 'Konstruktor',
  Desc_SmelterMk1_C: 'Schmelzofen',
  Desc_Blender_C: 'Blender',
  Desc_Packager_C: 'Verpacker',
  Desc_Converter_C: 'Konverter',
  Desc_HadronCollider_C: 'Partikelbeschleuniger',
  Desc_QuantumEncoder_C: 'Quanten-Encoder',
  Desc_OilRefinery_C: 'Raffinerie',
  Desc_ManufacturerMk1_C: 'Fabrikator',
  Desc_AssemblerMk1_C: 'Assembler',
  Desc_FoundryMk1_C: 'Gießerei',
}

export function itemName(id: string, lang: 'de' | 'en' = 'en') {
  if (lang === 'de') {
    return (deTranslations as Record<string, string>)[id] ?? items[id]?.name ?? id.replace(/^Desc_/, '').replace(/_C$/, '')
  }
  return items[id]?.name ?? id.replace(/^Desc_/, '').replace(/_C$/, '')
}

export function itemIconUrl(id: string) {
  const icon = items[id]?.icon
  if (!icon) return null
  return `https://raw.githubusercontent.com/ShortByte/satisfactory-workbench/develop/public/icons/items/${icon}.png`
}

export function machineIconUrl(id: string) {
  const name = buildings[id]?.name
  if (!name) return null
  return `https://satisfactory.wiki.gg/wiki/Special:Redirect/file/${encodeURIComponent(name)}.png`
}

export function recipesForProduct(itemId: string) {
  return recipes.filter((recipe) => recipe.products.some((product) => product.item === itemId))
}

export function primaryProduct(recipe: GameRecipe, itemId: string) {
  return recipe.products.find((product) => product.item === itemId)
}

export const targetItems = Array.from(
  new Set(recipes.flatMap((recipe) => recipe.products.map((product) => product.item)))
)
  .filter((id) => items[id])
  .sort((a, b) => itemName(a, 'en').localeCompare(itemName(b, 'en')))

export function defaultRecipeFor(itemId: string) {
  const candidates = recipesForProduct(itemId)
  return (
    candidates.find((recipe) =>
      !recipe.alternate &&
      recipe.products[0]?.item === itemId &&
      !/^Unpackage /i.test(recipe.name)
    ) ??
    candidates.find((recipe) => !recipe.alternate && recipe.products[0]?.item === itemId) ??
    candidates.find((recipe) => !recipe.alternate) ??
    candidates[0]
  )
}
