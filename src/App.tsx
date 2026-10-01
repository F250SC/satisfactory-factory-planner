import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  Factory,
  Gauge,
  Languages,
  Pickaxe,
  Plus,
  Save,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  calculateProduction,
  getRecipeFor,
  resourceOutput,
  type RecipeOverrides,
  type ResourceConfig,
} from './engine'
import {
  beltRates,
  buildings,
  dataMetadata,
  defaultRecipeFor,
  extractorIconUrl,
  itemIconUrl,
  itemName,
  machineGermanNames,
  machineIconUrl,
  pipeRates,
  recipeName,
  recipesForProduct,
  resourceMeta,
  targetItems,
  type BeltTier,
  type MinerTier,
  type PipeTier,
  type Purity,
} from './data'
import {
  alternateSchematics,
  availableRecipesForProduct,
  availableTargetItems,
  eligibleAlternates,
  type ProgressionProfile,
} from './progression'
import FactoryDesigner, { type DesignerLayout } from './FactoryDesigner'
import {
  formatProfileDate,
  loadActiveProfileId,
  loadProfiles,
  makeProfile,
  persistActiveProfileId,
  persistProfiles,
  type PlannerSnapshot,
  type SavedProfile,
} from './profiles'

type Lang = 'de' | 'en'

const ui = {
  de: {
    planner: 'Produktionsplaner',
    hero: 'Was kann ich mit den Ressourcen bauen, die ich wirklich habe?',
    intro: 'Wähle Produkt, Fortschritt und deine realen Rohstoffquellen. Der Planner löst daraus die komplette Produktionskette auf.',
    target: 'Zielprodukt',
    recipe: 'Zielrezept',
    progress: 'Fortschritt & Taktung',
    gameProgress: 'Mein Spielstand',
    profiles: 'Spielstandsprofile',
    profile: 'Aktives Profil',
    noProfile: 'Nicht gespeichert',
    newProfile: 'Neues Profil',
    profilePlaceholder: 'z. B. Seb Hauptwelt',
    createProfile: 'Profil anlegen',
    saveProfile: 'Jetzt speichern',
    deleteProfile: 'Profil löschen',
    autosaved: 'Änderungen werden automatisch im Browser gespeichert.',
    lastSaved: 'Zuletzt gespeichert',
    tier: 'Freigeschaltetes Tier',
    tierHint: 'Alle Meilensteine bis einschließlich dieses Tiers werden als abgeschlossen angenommen.',
    alternates: 'Freigeschaltete Alternate Recipes',
    alternatesHint: 'Markiere nur Rezepte, die du über Festplatten tatsächlich erhalten hast.',
    alternatesCount: 'Alternativrezepte aktiv',
    noAlternates: 'Noch keine Alternate Recipes ausgewählt.',
    clockUnlocked: 'Taktsteuerung erforscht',
    clockUnlockedHint: 'MAM: Power Slugs → „Overclock Production“. Erst dann sind Unter- und Übertakten möglich.',
    productionShards: 'Power Shards pro Produktionsmaschine',
    productionShardsHint: '0 = max. 100 %, 1 = 150 %, 2 = 200 %, 3 = 250 %.',
    resources: 'Benötigte Rohstoffe',
    purity: 'Reinheit',
    miner: 'Miner',
    belt: 'Förderband',
    pipe: 'Rohrleitung',
    count: 'Anzahl',
    available: 'Nutzbar',
    extracted: 'Gefördert',
    transportLimit: 'Transport limitiert',
    manualRate: 'Verfügbare Menge / min',
    extractorClock: 'Takt',
    extractorShards: 'Power Shards',
    lockedAt100: 'Noch nicht freigeschaltet → 100 %',
    maxProduction: 'Sauber dauerhaft versorgt',
    theoreticalMaximum: 'Rohstoffmaximum',
    intermittentMaximum: 'Mit wartenden Maschinen möglich',
    clockLimited: 'Ohne Taktung begrenzt',
    clockLimitedHint: 'Das Rohstoffmaximum ist nur erreichbar, wenn zusätzliche Maschinen zeitweise auf Material warten. Für einen dauerhaft voll versorgten Aufbau gilt der kleinere Wert.',
    intermediateSurplus: 'Überschuss',
    balanced: 'Ausgeglichen',
    surplus: 'Rohstoffüberschuss',
    limited: 'Transport-Limit',
    productionChain: 'Produktionskette',
    recipeChoices: 'Rezepte der Produktionskette',
    recipeChoicesHint: 'Für jede Zwischenstufe kannst du Standard- oder Alternate-Rezepte wählen.',
    machine: 'Maschine',
    machines: 'Maschinen',
    setup: 'Taktung im Spiel',
    power: 'Leistung',
    totalPower: 'Geschätzte Gesamtleistung',
    rawBalance: 'Rohstoffbilanz',
    used: 'Verbraucht',
    left: 'Übrig',
    recipesLoaded: 'Produktionsrezepte geladen',
    recipes: 'Rezepte',
    coming: 'Als Nächstes',
    designer: 'Factory Designer',
    designerText: 'Foundations, echte Maschinenabmessungen, Drag & Drop und mehrere Etagen.',
  },
  en: {
    planner: 'Production Planner',
    hero: 'What can I build with the resources I actually have?',
    intro: 'Choose a product, your progression state and your real resource sources. The planner resolves the full production chain.',
    target: 'Target product',
    recipe: 'Target recipe',
    progress: 'Progression & clock speed',
    gameProgress: 'My save progression',
    profiles: 'Save profiles',
    profile: 'Active profile',
    noProfile: 'Not saved',
    newProfile: 'New profile',
    profilePlaceholder: 'e.g. Seb main world',
    createProfile: 'Create profile',
    saveProfile: 'Save now',
    deleteProfile: 'Delete profile',
    autosaved: 'Changes are automatically saved in this browser.',
    lastSaved: 'Last saved',
    tier: 'Unlocked tier',
    tierHint: 'All milestones up to and including this tier are treated as completed.',
    alternates: 'Unlocked alternate recipes',
    alternatesHint: 'Select only recipes you have actually obtained from hard drives.',
    alternatesCount: 'alternate recipes active',
    noAlternates: 'No alternate recipes selected yet.',
    clockUnlocked: 'Clock control researched',
    clockUnlockedHint: 'MAM: Power Slugs → “Overclock Production”. Clock changes are unavailable before this research.',
    productionShards: 'Power Shards per production machine',
    productionShardsHint: '0 = max. 100%, 1 = 150%, 2 = 200%, 3 = 250%.',
    resources: 'Required resources',
    purity: 'Purity',
    miner: 'Miner',
    belt: 'Conveyor belt',
    pipe: 'Pipeline',
    count: 'Count',
    available: 'Available',
    extracted: 'Extracted',
    transportLimit: 'Transport limited',
    manualRate: 'Available amount / min',
    extractorClock: 'Clock speed',
    extractorShards: 'Power Shards',
    lockedAt100: 'Not researched yet → 100%',
    maxProduction: 'Continuously fully supplied',
    theoreticalMaximum: 'Resource maximum',
    intermittentMaximum: 'Possible with waiting machines',
    clockLimited: 'Limited without clock control',
    clockLimitedHint: 'The resource maximum is only achievable if extra machines periodically wait for materials. Use the lower value for a continuously fully supplied setup.',
    intermediateSurplus: 'Surplus',
    balanced: 'Balanced',
    surplus: 'Resource surplus',
    limited: 'Transport limit',
    productionChain: 'Production chain',
    recipeChoices: 'Recipes in this production chain',
    recipeChoicesHint: 'Choose standard or alternate recipes for every intermediate product.',
    machine: 'Machine',
    machines: 'Machines',
    setup: 'In-game clock setup',
    power: 'Power',
    totalPower: 'Estimated total power',
    rawBalance: 'Resource balance',
    used: 'Used',
    left: 'Left',
    recipesLoaded: 'production recipes loaded',
    recipes: 'recipes',
    coming: 'Coming next',
    designer: 'Factory Designer',
    designerText: 'Foundations, real machine footprints, drag & drop and multiple floors.',
  },
} as const

const purityNames: Record<Purity, { de: string; en: string }> = {
  impure: { de: 'Unrein', en: 'Impure' },
  normal: { de: 'Normal', en: 'Normal' },
  pure: { de: 'Rein', en: 'Pure' },
}

function fmt(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value - Math.round(value)) < 0.00005) return Math.round(value).toString()
  return value.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
}

function initialConfig(): ResourceConfig {
  return {
    purity: 'normal',
    miner: 'mk1',
    belt: 'mk1',
    pipe: 'mk1',
    count: 1,
    clockSpeed: 100,
    shards: 0,
    manualRate: 60,
  }
}

function configForTier(config: ResourceConfig, tier: number): ResourceConfig {
  const maxMiner: MinerTier = tier >= 8 ? 'mk3' : tier >= 4 ? 'mk2' : 'mk1'
  const maxBelt: BeltTier = tier >= 9 ? 'mk6' : tier >= 7 ? 'mk5' : tier >= 5 ? 'mk4' : tier >= 4 ? 'mk3' : tier >= 2 ? 'mk2' : 'mk1'
  const maxPipe: PipeTier = tier >= 6 ? 'mk2' : 'mk1'

  const minerRank: Record<MinerTier, number> = { mk1: 1, mk2: 2, mk3: 3 }
  const beltRank: Record<BeltTier, number> = { mk1: 1, mk2: 2, mk3: 3, mk4: 4, mk5: 5, mk6: 6 }
  const pipeRank: Record<PipeTier, number> = { mk1: 1, mk2: 2 }

  return {
    ...config,
    miner: minerRank[config.miner] > minerRank[maxMiner] ? maxMiner : config.miner,
    belt: beltRank[config.belt] > beltRank[maxBelt] ? maxBelt : config.belt,
    pipe: pipeRank[config.pipe] > pipeRank[maxPipe] ? maxPipe : config.pipe,
  }
}

function displayResourceName(id: string, lang: Lang) {
  return resourceMeta[id]?.[lang] ?? itemName(id, lang)
}

function machineName(id: string, lang: Lang) {
  if (lang === 'de') return machineGermanNames[id] ?? buildings[id]?.name ?? id
  return buildings[id]?.name ?? id
}

function clockSummary(clocks: number[], unlocked: boolean) {
  if (!unlocked) return `${clocks.length}× 100%`
  const grouped = new Map<string, number>()
  for (const clock of clocks) {
    const key = fmt(clock, 4)
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }
  return Array.from(grouped.entries()).map(([clock, count]) => `${count}× ${clock}%`).join(' + ')
}

function ItemThumb({ id, alt }: { id: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const src = itemIconUrl(id)
  if (!src || failed) return <div className="thumb-fallback"><Boxes size={18} /></div>
  return <img className="item-thumb" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

function MachineThumb({ id, alt }: { id: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const src = machineIconUrl(id)
  if (!src || failed) return <div className="thumb-fallback"><Factory size={18} /></div>
  return <img className="machine-thumb" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

function ResourceCard({
  resourceId,
  config,
  lang,
  clockControlUnlocked,
  tier,
  onChange,
}: {
  resourceId: string
  config: ResourceConfig
  lang: Lang
  clockControlUnlocked: boolean
  tier: number
  onChange: (config: ResourceConfig) => void
}) {
  const t = ui[lang]
  const meta = resourceMeta[resourceId]
  const safeConfig = configForTier(config, tier)
  const rate = resourceOutput(resourceId, safeConfig, clockControlUnlocked)
  const isManual = !meta
  const maxClock = 100 + safeConfig.shards * 50
  const minerOptions: MinerTier[] = tier >= 8 ? ['mk1','mk2','mk3'] : tier >= 4 ? ['mk1','mk2'] : ['mk1']
  const beltOptions: BeltTier[] = tier >= 7
    ? ['mk1','mk2','mk3','mk4','mk5']
    : tier >= 5
      ? ['mk1','mk2','mk3','mk4']
      : tier >= 4
        ? ['mk1','mk2','mk3']
        : tier >= 2
          ? ['mk1','mk2']
          : ['mk1']
  const pipeOptions: PipeTier[] = tier >= 6 ? ['mk1','mk2'] : ['mk1']

  return (
    <section className="card resource-card">
      <div className="card-title-row">
        <ItemThumb id={resourceId} alt={displayResourceName(resourceId, lang)} />
        <div>
          <span className="eyebrow">{t.resources}</span>
          <h2>{displayResourceName(resourceId, lang)}</h2>
        </div>
        {rate.transportLimited && (
          <div className="warning-chip"><AlertTriangle size={14} />{t.transportLimit}</div>
        )}
      </div>

      {isManual ? (
        <label>
          {t.manualRate}
          <input type="number" min="0" step="1" value={config.manualRate ?? 0}
            onChange={(e) => onChange({ ...config, manualRate: Math.max(0, Number(e.target.value)) })} />
        </label>
      ) : (
        <>
          <div className="field-grid">
            {meta.kind !== 'water' && (
              <label>
                {t.purity}
                <select value={safeConfig.purity} onChange={(e) => onChange({ ...config, purity: e.target.value as Purity })}>
                  {(Object.keys(purityNames) as Purity[]).map((purity) => <option key={purity} value={purity}>{purityNames[purity][lang]}</option>)}
                </select>
              </label>
            )}
            {meta.kind === 'solid' && (
              <label>
                {t.miner}
                <select value={safeConfig.miner} onChange={(e) => onChange({ ...config, miner: e.target.value as MinerTier })}>
                  {minerOptions.map((miner) => <option key={miner} value={miner}>Miner Mk.{miner.slice(2)}</option>)}
                </select>
              </label>
            )}
            <label>
              {t.count}
              <input type="number" min="1" step="1" value={safeConfig.count}
                onChange={(e) => onChange({ ...config, count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            </label>
          </div>

          {meta.kind === 'solid' ? (
            <label>
              {t.belt}
              <select value={safeConfig.belt} onChange={(e) => onChange({ ...config, belt: e.target.value as BeltTier })}>
                {beltOptions.map((belt) => <option key={belt} value={belt}>Mk.{belt.slice(2)} — {beltRates[belt]}/min</option>)}
              </select>
            </label>
          ) : (
            <label>
              {t.pipe}
              <select value={safeConfig.pipe} onChange={(e) => onChange({ ...config, pipe: e.target.value as PipeTier })}>
                {pipeOptions.map((pipe) => <option key={pipe} value={pipe}>Mk.{pipe.slice(2)} — {pipeRates[pipe]} m³/min</option>)}
              </select>
            </label>
          )}

          <div className="extractor-visual">
            {extractorIconUrl(meta.kind, safeConfig.miner) && (
              <img
                src={extractorIconUrl(meta.kind, safeConfig.miner) ?? ''}
                alt={meta.kind === 'solid' ? `Miner ${safeConfig.miner.toUpperCase()}` : displayResourceName(resourceId, lang)}
                loading="lazy"
                onError={(event) => { event.currentTarget.style.display = 'none' }}
              />
            )}
            <div>
              <span>{meta.kind === 'solid' ? t.miner : t.resources}</span>
              <strong>
                {meta.kind === 'solid'
                  ? `Miner Mk.${safeConfig.miner.slice(2)}`
                  : meta.kind === 'oil'
                    ? 'Oil Extractor'
                    : meta.kind === 'water'
                      ? 'Water Extractor'
                      : 'Resource Well Extractor'}
              </strong>
            </div>
          </div>

          <div className="clock-box">
            <div className="clock-title"><Gauge size={16} /><strong>{t.extractorClock}</strong></div>
            {!clockControlUnlocked ? (
              <div className="locked-clock">{t.lockedAt100}</div>
            ) : (
              <div className="clock-controls">
                <label>
                  {t.extractorShards}
                  <select value={safeConfig.shards} onChange={(e) => {
                    const shards = Number(e.target.value)
                    onChange({ ...config, shards, clockSpeed: Math.min(safeConfig.clockSpeed, 100 + shards * 50) })
                  }}>
                    {[0,1,2,3].map((n) => <option key={n} value={n}>{n} → max. {100 + n * 50}%</option>)}
                  </select>
                </label>
                <label>
                  {t.extractorClock}
                  <input type="number" min="1" max={maxClock} step="0.01" value={safeConfig.clockSpeed}
                    onChange={(e) => onChange({ ...config, clockSpeed: Math.max(1, Math.min(maxClock, Number(e.target.value) || 100)) })} />
                </label>
              </div>
            )}
          </div>
        </>
      )}

      <div className="resource-rates">
        <div><span>{t.extracted}</span><strong>{fmt(rate.extracted)} {rate.unit === 'm³' ? 'm³' : ''}/min</strong></div>
        <div><span>{t.available}</span><strong className={rate.transportLimited ? 'warn-text' : ''}>{fmt(rate.available)} {rate.unit === 'm³' ? 'm³' : ''}/min</strong></div>
      </div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('de')
  const [target, setTarget] = useState(() => targetItems.find((id) => itemName(id, 'en') === 'Steel Pipe') ?? targetItems[0])
  const initialTargetRecipe = defaultRecipeFor(target)
  const [overrides, setOverrides] = useState<RecipeOverrides>(initialTargetRecipe ? { [target]: initialTargetRecipe.className } : {})
  const [tier, setTier] = useState(3)
  const [unlockedAlternates, setUnlockedAlternates] = useState<string[]>([])
  const [clockControlUnlocked, setClockControlUnlocked] = useState(false)
  const [productionShards, setProductionShards] = useState(0)
  const [resourceConfigs, setResourceConfigs] = useState<Record<string, ResourceConfig>>({})
  const [designerLayout, setDesignerLayout] = useState<DesignerLayout>({ nodes: [] })
  const [activeView, setActiveView] = useState<'planner' | 'designer'>('planner')
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => loadProfiles())
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => loadActiveProfileId())
  const [newProfileName, setNewProfileName] = useState('')
  const [profileHydrated, setProfileHydrated] = useState(false)

  const t = ui[lang]

  const currentSnapshot = (): PlannerSnapshot => ({
    target,
    overrides,
    tier,
    unlockedAlternates,
    clockControlUnlocked,
    productionShards,
    resourceConfigs,
    designerLayout,
  })

  const applySnapshot = (snapshot: PlannerSnapshot) => {
    setTarget(snapshot.target)
    setOverrides(snapshot.overrides ?? {})
    setTier(snapshot.tier ?? 0)
    setUnlockedAlternates(snapshot.unlockedAlternates ?? [])
    setClockControlUnlocked(Boolean(snapshot.clockControlUnlocked))
    setProductionShards(snapshot.productionShards ?? 0)
    setResourceConfigs(snapshot.resourceConfigs ?? {})
    setDesignerLayout(snapshot.designerLayout ?? { nodes: [], floors: [{ id: 'floor-ground', name: 'EG', elevationM: 0 }], lifts: [] })
  }

  useEffect(() => {
    if (profileHydrated) return
    const stored = profiles.find((profile) => profile.id === activeProfileId)
    if (stored) applySnapshot(stored.state)
    else if (activeProfileId) setActiveProfileId(null)
    setProfileHydrated(true)
  }, [])

  useEffect(() => {
    persistActiveProfileId(activeProfileId)
  }, [activeProfileId])

  useEffect(() => {
    if (!profileHydrated || !activeProfileId) return
    const updated = profiles.map((profile) => profile.id === activeProfileId
      ? { ...profile, updatedAt: new Date().toISOString(), state: currentSnapshot() }
      : profile)
    setProfiles(updated)
    persistProfiles(updated)
  }, [target, overrides, tier, unlockedAlternates, clockControlUnlocked, productionShards, resourceConfigs, designerLayout, profileHydrated, activeProfileId])

  const createProfile = () => {
    const profile = makeProfile(newProfileName, currentSnapshot())
    const updated = [...profiles, profile]
    setProfiles(updated)
    persistProfiles(updated)
    setActiveProfileId(profile.id)
    persistActiveProfileId(profile.id)
    setNewProfileName('')
  }

  const selectProfile = (id: string) => {
    const profile = profiles.find((entry) => entry.id === id)
    if (!profile) {
      setActiveProfileId(null)
      return
    }
    applySnapshot(profile.state)
    setActiveProfileId(profile.id)
  }

  const saveActiveProfile = () => {
    if (!activeProfileId) return
    const updated = profiles.map((profile) => profile.id === activeProfileId
      ? { ...profile, updatedAt: new Date().toISOString(), state: currentSnapshot() }
      : profile)
    setProfiles(updated)
    persistProfiles(updated)
  }

  const deleteActiveProfile = () => {
    if (!activeProfileId) return
    const updated = profiles.filter((profile) => profile.id !== activeProfileId)
    setProfiles(updated)
    persistProfiles(updated)
    setActiveProfileId(null)
    persistActiveProfileId(null)
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)

  const progressionProfile = useMemo<ProgressionProfile>(() => ({ tier, unlockedAlternates }), [tier, unlockedAlternates])
  const unlockedTargets = useMemo(() => availableTargetItems(progressionProfile), [progressionProfile])
  const targetRecipes = useMemo(() => availableRecipesForProduct(target, progressionProfile), [target, progressionProfile])
  const selectableAlternates = useMemo(() => eligibleAlternates(progressionProfile), [progressionProfile])

  const progressionOverrides = useMemo<RecipeOverrides>(() => {
    const next: RecipeOverrides = {}
    for (const itemId of targetItems) {
      const choices = availableRecipesForProduct(itemId, progressionProfile)
      const standard = choices.find((recipe) => !recipe.alternate) ?? choices[0]
      if (standard) next[itemId] = standard.className
    }
    for (const [itemId, recipeId] of Object.entries(overrides)) {
      const allowed = availableRecipesForProduct(itemId, progressionProfile)
      if (allowed.some((recipe) => recipe.className === recipeId)) next[itemId] = recipeId
    }
    return next
  }, [progressionProfile, overrides])

  const selectedTargetRecipe = targetRecipes.find((recipe) => recipe.className === progressionOverrides[target]) ?? targetRecipes[0]

  useEffect(() => {
    if (unlockedTargets.includes(target)) return
    const nextTarget = unlockedTargets.find((id) => itemName(id, 'en') === 'Steel Pipe') ?? unlockedTargets[0]
    if (!nextTarget) return
    const recipe = availableRecipesForProduct(nextTarget, progressionProfile)[0]
    setTarget(nextTarget)
    setOverrides(recipe ? { [nextTarget]: recipe.className } : {})
  }, [tier, unlockedAlternates])

  const availability = useMemo(() => {
    const result: Record<string, number> = {}
    for (const [id, config] of Object.entries(resourceConfigs)) result[id] = resourceOutput(id, configForTier(config, tier), clockControlUnlocked).available
    return result
  }, [resourceConfigs, clockControlUnlocked, tier])

  const firstPass = useMemo(
    () => calculateProduction(target, availability, clockControlUnlocked, productionShards, progressionOverrides),
    [target, availability, clockControlUnlocked, productionShards, progressionOverrides],
  )

  const ensuredConfigs = useMemo(() => {
    const next = { ...resourceConfigs }
    let changed = false
    for (const resource of firstPass.requiredResources) {
      if (!next[resource]) { next[resource] = initialConfig(); changed = true }
    }
    return changed ? next : resourceConfigs
  }, [firstPass.requiredResources, resourceConfigs])

  const effectiveAvailability = useMemo(() => {
    const result: Record<string, number> = {}
    for (const [id, config] of Object.entries(ensuredConfigs)) result[id] = resourceOutput(id, configForTier(config, tier), clockControlUnlocked).available
    return result
  }, [ensuredConfigs, clockControlUnlocked, tier])

  const result = useMemo(
    () => calculateProduction(target, effectiveAvailability, clockControlUnlocked, productionShards, progressionOverrides),
    [target, effectiveAvailability, clockControlUnlocked, productionShards, progressionOverrides],
  )

  const changeTarget = (itemId: string) => {
    const recipe = availableRecipesForProduct(itemId, progressionProfile)[0]
    setTarget(itemId)
    setOverrides(recipe ? { [itemId]: recipe.className } : {})
  }

  const toggleAlternate = (schematicId: string) => {
    setUnlockedAlternates((current) => current.includes(schematicId)
      ? current.filter((id) => id !== schematicId)
      : [...current, schematicId])
  }

  const setResource = (id: string, config: ResourceConfig) => setResourceConfigs((current) => ({ ...current, [id]: config }))
  const setRecipe = (itemId: string, recipeId: string) => setOverrides((current) => ({ ...current, [itemId]: recipeId }))

  const resourceRates = result.requiredResources.map((id) => ({
    id,
    rate: resourceOutput(id, configForTier(ensuredConfigs[id] ?? initialConfig(), tier), clockControlUnlocked),
  }))

  const hasTransportLimit = resourceRates.some(({ rate }) => rate.transportLimited)
  const hasSurplus = result.requiredResources.some((id) => (result.leftovers[id] ?? 0) > 0.01)
  const hasIntermediateSurplus = result.machineSteps.some((step) => step.surplusRate > 0.01)
  const status = hasTransportLimit
    ? t.limited
    : result.practicalClockLimited
      ? t.clockLimited
      : (hasSurplus || hasIntermediateSurplus)
        ? t.surplus
        : t.balanced
  const statusClass = hasTransportLimit
    ? 'warning'
    : result.practicalClockLimited
      ? 'clock-limited'
      : (hasSurplus || hasIntermediateSurplus)
        ? 'surplus'
        : ''

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Factory size={24} /></div>
          <div><strong>Satisfactory Factory Planner</strong><span>{dataMetadata.recipeCount} {t.recipesLoaded}</span></div>
        </div>
        <div className="top-actions">
          <button className="language-button" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}><Languages size={15} /> {lang.toUpperCase()}</button>
          <div className="version">v0.19.1</div>
        </div>
      </header>

      <div className="shell">
        <nav className="main-tabs">
          <button className={activeView === 'planner' ? 'active' : ''} onClick={() => setActiveView('planner')}>Produktionsplaner</button>
          <button className={activeView === 'designer' ? 'active' : ''} onClick={() => setActiveView('designer')}>Factory Designer</button>
        </nav>

        {activeView === 'planner' ? <>
        <section className="hero">
          <span className="eyebrow">{t.planner}</span>
          <h1>{t.hero}</h1>
          <p>{t.intro}</p>
        </section>

        <section className="target card">
          <div className="target-product-preview"><ItemThumb id={target} alt={itemName(target, lang)} /></div>
          <div className="target-grid">
            <label>
              <span className="eyebrow">{t.target}</span>
              <select className="target-select" value={target} onChange={(e) => changeTarget(e.target.value)}>
                {unlockedTargets.map((item) => <option key={item} value={item}>{itemName(item, lang)}</option>)}
              </select>
            </label>
            <label>
              <span className="eyebrow">{t.recipe}</span>
              <select className="recipe-select" value={selectedTargetRecipe?.className ?? ''} onChange={(e) => setRecipe(target, e.target.value)}>
                {targetRecipes.map((recipe) => <option key={recipe.className} value={recipe.className}>{recipe.alternate ? '★ ' : ''}{recipeName(recipe, lang)}</option>)}
              </select>
            </label>
          </div>
          {selectedTargetRecipe && (
            <div className="recipe-chip">
              <MachineThumb id={selectedTargetRecipe.producedIn} alt={machineName(selectedTargetRecipe.producedIn, lang)} />
              {machineName(selectedTargetRecipe.producedIn, lang)}
            </div>
          )}
        </section>

        <section className="profiles-card card">
          <div className="profiles-head">
            <div>
              <span className="eyebrow">{t.profiles}</span>
              <h2>{activeProfile?.name ?? t.noProfile}</h2>
              <p>{t.autosaved}</p>
            </div>
            {activeProfile && (
              <div className="profile-meta">{t.lastSaved}: {formatProfileDate(activeProfile.updatedAt, lang)}</div>
            )}
          </div>
          <div className="profiles-grid">
            <label>
              {t.profile}
              <select value={activeProfileId ?? ''} onChange={(e) => selectProfile(e.target.value)}>
                <option value="">{t.noProfile}</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
            <div className="new-profile-row">
              <label>
                {t.newProfile}
                <input value={newProfileName} placeholder={t.profilePlaceholder} onChange={(e) => setNewProfileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createProfile() }} />
              </label>
              <button className="action-button primary" onClick={createProfile}><Plus size={15} />{t.createProfile}</button>
            </div>
          </div>
          {activeProfile && (
            <div className="profile-actions">
              <button className="action-button" onClick={saveActiveProfile}><Save size={15} />{t.saveProfile}</button>
              <button className="action-button danger" onClick={deleteActiveProfile}><Trash2 size={15} />{t.deleteProfile}</button>
            </div>
          )}
        </section>

        <section className="save-progress card">
          <div className="save-progress-head">
            <div>
              <span className="eyebrow">{t.gameProgress}</span>
              <h2>Tier {tier}</h2>
            </div>
            <div className="profile-badge">{unlockedAlternates.length} {t.alternatesCount}</div>
          </div>
          <div className="save-progress-grid">
            <label>
              {t.tier}
              <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                {[0,1,2,3,4,5,6,7,8,9].map((value) => <option key={value} value={value}>Tier {value}</option>)}
              </select>
              <small>{t.tierHint}</small>
            </label>
            <details className="alternate-picker">
              <summary>{t.alternates} ({unlockedAlternates.length})</summary>
              <p>{t.alternatesHint}</p>
              <div className="alternate-list">
                {selectableAlternates.length === 0 && <span className="muted">{t.noAlternates}</span>}
                {selectableAlternates.map((alt) => (
                  <label className="alternate-check" key={alt.id}>
                    <input type="checkbox" checked={unlockedAlternates.includes(alt.id)} onChange={() => toggleAlternate(alt.id)} />
                    <span>{alt.name.replace(/^Alternate:\s*/i, lang === 'de' ? 'Alternativ: ' : 'Alternate: ')}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </section>

        <section className="progress-card card">
          <div className="planning-title">
            <Settings2 size={20} />
            <div><span className="eyebrow">{t.progress}</span><strong>{t.clockUnlocked}</strong></div>
          </div>
          <div className="progress-controls">
            <div className="unlock-row">
              <div><strong>{t.clockUnlocked}</strong><span>{t.clockUnlockedHint}</span></div>
              <button className={`switch ${clockControlUnlocked ? 'on' : ''}`} onClick={() => setClockControlUnlocked(!clockControlUnlocked)}><span /></button>
            </div>
            <label className={!clockControlUnlocked ? 'disabled-field' : ''}>
              {t.productionShards}
              <select disabled={!clockControlUnlocked} value={productionShards} onChange={(e) => setProductionShards(Number(e.target.value))}>
                {[0,1,2,3].map((n) => <option key={n} value={n}>{n} → max. {100 + n * 50}%</option>)}
              </select>
              <small>{t.productionShardsHint}</small>
            </label>
          </div>
        </section>

        <div className="resource-grid">
          {result.requiredResources.map((resourceId) => (
            <ResourceCard key={resourceId} resourceId={resourceId} lang={lang}
              config={ensuredConfigs[resourceId] ?? initialConfig()} clockControlUnlocked={clockControlUnlocked} tier={tier}
              onChange={(config) => setResource(resourceId, config)} />
          ))}
        </div>

        <section className="result-card">
          <div className="result-heading">
            <div>
              <span className="eyebrow">{t.maxProduction}</span>
              <h2>{fmt(result.output)} {itemName(target, lang)} / min</h2>
              {!clockControlUnlocked && (
                <div className="result-comparison">
                  <div>
                    <span>{t.theoreticalMaximum}</span>
                    <strong>{fmt(result.theoreticalOutput)} {itemName(target, lang)} / min</strong>
                  </div>
                  <div>
                    <span>{t.intermittentMaximum}</span>
                    <strong>{fmt(result.theoreticalOutput)} {itemName(target, lang)} / min</strong>
                  </div>
                </div>
              )}
            </div>
            <div className={`status ${statusClass}`}>{status}</div>
          </div>
          {result.practicalClockLimited && (
            <div className="clock-limit-note">
              <AlertTriangle size={17} />
              <span>{t.clockLimitedHint}</span>
            </div>
          )}

          <div className="summary-strip">
            {resourceRates.map(({ id, rate }) => (
              <div key={id}><ItemThumb id={id} alt={displayResourceName(id, lang)} /><span>{displayResourceName(id, lang)}</span><strong>{fmt(result.rawUsed[id] ?? 0)} / {fmt(rate.available)}</strong><small>{rate.unit === 'm³' ? 'm³/min' : '/ min'}</small></div>
            ))}
            <div><ItemThumb id={target} alt={itemName(target, lang)} /><span>{itemName(target, lang)}</span><strong>{fmt(result.output)}</strong><small>/ min</small></div>
          </div>

          <div className="section-heading"><div><Boxes size={18} /><span>{t.productionChain}</span></div></div>
          <div className="machine-list">
            {[...result.machineSteps].reverse().map((step) => (
              <div className="machine-row" key={`${step.item}-${step.recipe.className}`}>
                <div className="machine-product">
                  <ItemThumb id={step.item} alt={itemName(step.item, lang)} />
                  <div>
                    <span>{itemName(step.item, lang)}</span>
                    <strong>{fmt(step.actualOutputRate)} / min</strong>
                    <small>{recipeName(step.recipe, lang)}</small>
                    {step.surplusRate > 0.01 && (
                      <small className="surplus-note">+ {fmt(step.surplusRate)} / min {t.intermediateSurplus}</small>
                    )}
                  </div>
                </div>
                <div className="machine-arrow">→</div>
                <div className="machine-info">
                  <div className="machine-cell with-thumb"><MachineThumb id={step.recipe.producedIn} alt={machineName(step.recipe.producedIn, lang)} /><div><span>{t.machine}</span><strong>{step.machines}× {machineName(step.recipe.producedIn, lang)}</strong></div></div>
                  <div><span>{t.setup}</span><strong>{clockSummary(step.clocks, clockControlUnlocked)}</strong></div>
                  <div><span>{t.power}</span><strong>{fmt(step.totalPowerMW)} MW</strong></div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-heading recipe-heading"><div><Settings2 size={18} /><span>{t.recipeChoices}</span></div></div>
          <p className="section-help">{t.recipeChoicesHint}</p>
          <div className="recipe-choice-list">
            {Array.from(new Set(result.machineSteps.map((step) => step.item))).map((itemId) => {
              const choices = availableRecipesForProduct(itemId, progressionProfile)
              const selected = choices.find((recipe) => recipe.className === progressionOverrides[itemId]) ?? choices[0]
              if (choices.length <= 1 || !selected) return null
              return (
                <div className="recipe-choice-row" key={itemId}>
                  <div className="choice-product"><ItemThumb id={itemId} alt={itemName(itemId, lang)} /><div><strong>{itemName(itemId, lang)}</strong><small>{choices.length} {t.recipes}</small></div></div>
                  <select value={selected.className} onChange={(e) => setRecipe(itemId, e.target.value)}>
                    {choices.map((recipe) => <option key={recipe.className} value={recipe.className}>{recipe.alternate ? '★ ' : ''}{recipeName(recipe, lang)}</option>)}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="section-heading balance-heading"><div><Gauge size={18} /><span>{t.rawBalance}</span></div></div>
          <div className="stats">
            {resourceRates.map(({ id, rate }) => (
              <div key={id}><Pickaxe size={18} /><span>{displayResourceName(id, lang)}</span><strong>{t.used}: {fmt(result.rawUsed[id] ?? 0)} {rate.unit === 'm³' ? 'm³' : ''}/min</strong><small>{t.left}: {fmt(result.leftovers[id] ?? 0)} {rate.unit === 'm³' ? 'm³' : ''}/min</small></div>
            ))}
            <div><Zap size={18} /><span>{t.totalPower}</span><strong>{fmt(result.totalPowerMW)} MW</strong><small>{result.machineSteps.reduce((sum, step) => sum + step.machines, 0)} {t.machines}</small></div>
          </div>
        </section>

        <section className="next-card">
          <span className="eyebrow">{t.coming}</span><h2>{t.designer}</h2><p>{t.designerText}</p>
          <button className="action-button primary" onClick={() => setActiveView('designer')}>Factory Designer öffnen</button>
        </section>
        </> : (
          <FactoryDesigner
            lang={lang}
            steps={result.machineSteps}
            resources={result.requiredResources.map((id) => ({
              id,
              config: configForTier(ensuredConfigs[id] ?? initialConfig(), tier),
              usedRate: result.rawUsed[id] ?? 0,
            }))}
            maxBeltTier={tier >= 9 ? 'mk6' : tier >= 7 ? 'mk5' : tier >= 5 ? 'mk4' : tier >= 4 ? 'mk3' : tier >= 2 ? 'mk2' : 'mk1'}
            layout={designerLayout}
            onChange={setDesignerLayout}
          />
        )}
      </div>
    </main>
  )
}
