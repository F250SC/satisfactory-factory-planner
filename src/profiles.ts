import type { RecipeOverrides, ResourceConfig } from './engine'
import type { DesignerLayout } from './FactoryDesigner'

export interface PlannerSnapshot {
  target: string
  overrides: RecipeOverrides
  tier: number
  unlockedAlternates: string[]
  clockControlUnlocked: boolean
  productionShards: number
  resourceConfigs: Record<string, ResourceConfig>
  designerLayout: DesignerLayout
}

export interface SavedProfile {
  id: string
  name: string
  updatedAt: string
  state: PlannerSnapshot
}

const PROFILES_KEY = 'satisfactory-factory-planner:profiles:v1'
const ACTIVE_KEY = 'satisfactory-factory-planner:active-profile:v1'

const DEFAULT_LAYOUT: DesignerLayout = {
  nodes: [],
  floors: [{ id: 'floor-ground', name: 'EG', elevationM: 0 }],
  lifts: [],
  utilities: [],
  belts: [],
  sources: [],
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(objectRecord(value))) {
    if (typeof entry === 'string') result[key] = entry
  }
  return result
}

function normalizeLayout(value: unknown): DesignerLayout {
  const raw = objectRecord(value)
  const floors = Array.isArray(raw.floors) && raw.floors.length
    ? raw.floors
    : DEFAULT_LAYOUT.floors

  return {
    nodes: Array.isArray(raw.nodes) ? raw.nodes as DesignerLayout['nodes'] : [],
    floors: floors as DesignerLayout['floors'],
    lifts: Array.isArray(raw.lifts) ? raw.lifts as NonNullable<DesignerLayout['lifts']> : [],
    utilities: Array.isArray(raw.utilities) ? raw.utilities as NonNullable<DesignerLayout['utilities']> : [],
    belts: Array.isArray(raw.belts) ? raw.belts as NonNullable<DesignerLayout['belts']> : [],
    sources: Array.isArray(raw.sources) ? raw.sources as NonNullable<DesignerLayout['sources']> : [],
  }
}

function normalizeSnapshot(value: unknown): PlannerSnapshot {
  const raw = objectRecord(value)
  const tier = Number(raw.tier)
  const shards = Number(raw.productionShards)

  return {
    target: typeof raw.target === 'string' ? raw.target : '',
    overrides: stringRecord(raw.overrides),
    tier: Number.isFinite(tier) ? Math.max(0, Math.min(9, Math.floor(tier))) : 0,
    unlockedAlternates: Array.isArray(raw.unlockedAlternates)
      ? raw.unlockedAlternates.filter((entry): entry is string => typeof entry === 'string')
      : [],
    clockControlUnlocked: Boolean(raw.clockControlUnlocked),
    productionShards: Number.isFinite(shards)
      ? Math.max(0, Math.min(3, Math.floor(shards)))
      : 0,
    resourceConfigs: objectRecord(raw.resourceConfigs) as Record<string, ResourceConfig>,
    designerLayout: normalizeLayout(raw.designerLayout),
  }
}

function normalizeProfile(value: unknown): SavedProfile | null {
  const raw = objectRecord(value)
  if (typeof raw.id !== 'string' || !raw.id) return null

  return {
    id: raw.id,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name
        : 'Meine Welt',
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : new Date(0).toISOString(),
    state: normalizeSnapshot(raw.state),
  }
}

export function loadProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(normalizeProfile)
      .filter((entry): entry is SavedProfile => entry !== null)
  } catch {
    return []
  }
}

export function persistProfiles(profiles: SavedProfile[]) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
    return true
  } catch (error) {
    console.warn('Could not persist Satisfactory planner profiles.', error)
    return false
  }
}

export function loadActiveProfileId() {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function persistActiveProfileId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
    return true
  } catch (error) {
    console.warn('Could not persist active Satisfactory planner profile.', error)
    return false
  }
}

export function makeProfile(name: string, state: PlannerSnapshot): SavedProfile {
  const id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    name: name.trim() || 'Meine Welt',
    updatedAt: new Date().toISOString(),
    state,
  }
}

export function formatProfileDate(iso: string, lang: 'de' | 'en') {
  try {
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}
