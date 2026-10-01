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

export function loadProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistProfiles(profiles: SavedProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function loadActiveProfileId() {
  return localStorage.getItem(ACTIVE_KEY)
}

export function persistActiveProfileId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
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
