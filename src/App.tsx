import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Boxes,
  Factory,
  Gauge,
  Languages,
  Mountain,
  Pickaxe,
  Settings2,
  Waves,
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
  itemName,
  machineGermanNames,
  pipeRates,
  recipesForProduct,
  resourceMeta,
  targetItems,
  type BeltTier,
  type MinerTier,
  type PipeTier,
  type Purity,
} from './data'

type Lang = 'de' | 'en'

const ui = {
  de: {
    planner: 'Produktionsplaner',
    hero: 'Was kann ich mit den Ressourcen bauen, die ich wirklich habe?',
    intro:
      'Wähle ein Produkt und deine vorhandenen Vorkommen. Der Planner löst die komplette Produktionskette auf und zeigt dir Maschinen, Taktraten und Engpässe.',
    target: 'Zielprodukt',
    recipe: 'Zielrezept',
    standard: 'Standard',
    alternate: 'Alternativ',
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
    planning: 'Maschinenplanung',
    maxClock: 'Maximaler Maschinentakt',
    maxClockHint: 'Der Planner nutzt nie mehr als diesen Takt pro Maschine.',
    maxProduction: 'Maximale Produktion',
    balanced: 'Ausgeglichen',
    surplus: 'Rohstoffüberschuss',
    limited: 'Transport-Limit',
    productionChain: 'Produktionskette',
    recipeChoices: 'Rezepte der Produktionskette',
    recipeChoicesHint: 'Hier kannst du für jede Zwischenstufe Standard- oder Alternate-Rezepte auswählen.',
    machine: 'Maschine',
    machines: 'Maschinen',
    setup: 'Einstellung im Spiel',
    power: 'Leistung',
    totalPower: 'Geschätzte Gesamtleistung',
    rawBalance: 'Rohstoffbilanz',
    used: 'Verbraucht',
    left: 'Übrig',
    recipesLoaded: 'Produktionsrezepte geladen',
    coming: 'Als Nächstes',
    designer: 'Factory Designer',
    designerText: 'Foundations, echte Maschinenabmessungen, Drag & Drop und mehrere Etagen.',
  },
  en: {
    planner: 'Production Planner',
    hero: 'What can I build with the resources I actually have?',
    intro:
      'Choose a product and your available resource nodes. The planner resolves the complete production chain and shows machines, clock speeds and bottlenecks.',
    target: 'Target product',
    recipe: 'Target recipe',
    standard: 'Standard',
    alternate: 'Alternate',
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
    planning: 'Machine planning',
    maxClock: 'Maximum machine clock',
    maxClockHint: 'The planner never exceeds this clock speed on any machine.',
    maxProduction: 'Maximum production',
    balanced: 'Balanced',
    surplus: 'Resource surplus',
    limited: 'Transport limit',
    productionChain: 'Production chain',
    recipeChoices: 'Recipes in this production chain',
    recipeChoicesHint: 'Choose standard or alternate recipes for each intermediate product.',
    machine: 'Machine',
    machines: 'Machines',
    setup: 'In-game setup',
    power: 'Power',
    totalPower: 'Estimated total power',
    rawBalance: 'Resource balance',
    used: 'Used',
    left: 'Left',
    recipesLoaded: 'production recipes loaded',
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

function fmt(value: number) {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value - Math.round(value)) < 0.005) return Math.round(value).toString()
  return value.toFixed(2).replace(/\.00$/, '')
}

function initialConfig(): ResourceConfig {
  return {
    purity: 'normal',
    miner: 'mk1',
    belt: 'mk1',
    pipe: 'mk1',
    count: 1,
    manualRate: 60,
  }
}

function displayResourceName(id: string, lang: Lang) {
  return resourceMeta[id]?.[lang] ?? itemName(id)
}

function machineName(id: string, lang: Lang) {
  if (lang === 'de') return machineGermanNames[id] ?? buildings[id]?.name ?? id
  return buildings[id]?.name ?? id
}

function clockSummary(clocks: number[]) {
  const grouped = new Map<string, number>()
  for (const clock of clocks) {
    const key = fmt(clock)
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }
  return Array.from(grouped.entries())
    .map(([clock, count]) => `${count}× ${clock}%`)
    .join(' + ')
}

function ResourceIcon({ kind }: { kind?: string }) {
  if (kind === 'water' || kind === 'oil' || kind === 'nitrogen') return <Waves size={21} />
  return <Mountain size={21} />
}

function ResourceCard({
  resourceId,
  config,
  lang,
  onChange,
}: {
  resourceId: string
  config: ResourceConfig
  lang: Lang
  onChange: (config: ResourceConfig) => void
}) {
  const t = ui[lang]
  const meta = resourceMeta[resourceId]
  const rate = resourceOutput(resourceId, config)
  const isManual = !meta

  return (
    <section className="card resource-card">
      <div className="card-title-row">
        <div className="icon-box"><ResourceIcon kind={meta?.kind} /></div>
        <div>
          <span className="eyebrow">{t.resources}</span>
          <h2>{displayResourceName(resourceId, lang)}</h2>
        </div>
        {rate.transportLimited && (
          <div className="warning-chip">
            <AlertTriangle size={14} />
            {t.transportLimit}
          </div>
        )}
      </div>

      {isManual ? (
        <label>
          {t.manualRate}
          <input
            type="number"
            min="0"
            step="1"
            value={config.manualRate ?? 0}
            onChange={(e) => onChange({ ...config, manualRate: Math.max(0, Number(e.target.value)) })}
          />
        </label>
      ) : (
        <>
          <div className="field-grid">
            {meta.kind !== 'water' && (
              <label>
                {t.purity}
                <select
                  value={config.purity}
                  onChange={(e) => onChange({ ...config, purity: e.target.value as Purity })}
                >
                  {(Object.keys(purityNames) as Purity[]).map((purity) => (
                    <option key={purity} value={purity}>{purityNames[purity][lang]}</option>
                  ))}
                </select>
              </label>
            )}

            {meta.kind === 'solid' && (
              <label>
                {t.miner}
                <select
                  value={config.miner}
                  onChange={(e) => onChange({ ...config, miner: e.target.value as MinerTier })}
                >
                  {(['mk1', 'mk2', 'mk3'] as MinerTier[]).map((miner) => (
                    <option key={miner} value={miner}>
                      Miner Mk.{miner.slice(2)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              {t.count}
              <input
                type="number"
                min="1"
                step="1"
                value={config.count}
                onChange={(e) => onChange({ ...config, count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              />
            </label>
          </div>

          {meta.kind === 'solid' ? (
            <label>
              {t.belt}
              <select
                value={config.belt}
                onChange={(e) => onChange({ ...config, belt: e.target.value as BeltTier })}
              >
                {(Object.keys(beltRates) as BeltTier[]).map((belt) => (
                  <option key={belt} value={belt}>Mk.{belt.slice(2)} — {beltRates[belt]}/min</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              {t.pipe}
              <select
                value={config.pipe}
                onChange={(e) => onChange({ ...config, pipe: e.target.value as PipeTier })}
              >
                {(Object.keys(pipeRates) as PipeTier[]).map((pipe) => (
                  <option key={pipe} value={pipe}>Mk.{pipe.slice(2)} — {pipeRates[pipe]} m³/min</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      <div className="resource-rates">
        <div>
          <span>{t.extracted}</span>
          <strong>{fmt(rate.extracted)} {rate.unit === 'm³' ? 'm³' : ''}/min</strong>
        </div>
        <div>
          <span>{t.available}</span>
          <strong className={rate.transportLimited ? 'warn-text' : ''}>
            {fmt(rate.available)} {rate.unit === 'm³' ? 'm³' : ''}/min
          </strong>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('de')
  const [target, setTarget] = useState(() => targetItems.find((id) => itemName(id) === 'Steel Pipe') ?? targetItems[0])
  const initialTargetRecipe = defaultRecipeFor(target)
  const [overrides, setOverrides] = useState<RecipeOverrides>(
    initialTargetRecipe ? { [target]: initialTargetRecipe.className } : {},
  )
  const [maxClock, setMaxClock] = useState(100)
  const [resourceConfigs, setResourceConfigs] = useState<Record<string, ResourceConfig>>({})

  const t = ui[lang]
  const targetRecipes = recipesForProduct(target)
  const selectedTargetRecipe = getRecipeFor(target, overrides)

  const availability = useMemo(() => {
    const result: Record<string, number> = {}
    for (const [id, config] of Object.entries(resourceConfigs)) {
      result[id] = resourceOutput(id, config).available
    }
    return result
  }, [resourceConfigs])

  const firstPass = useMemo(
    () => calculateProduction(target, availability, maxClock, overrides),
    [target, availability, maxClock, overrides],
  )

  const ensuredConfigs = useMemo(() => {
    const next = { ...resourceConfigs }
    let changed = false
    for (const resource of firstPass.requiredResources) {
      if (!next[resource]) {
        next[resource] = initialConfig()
        changed = true
      }
    }
    return changed ? next : resourceConfigs
  }, [firstPass.requiredResources, resourceConfigs])

  const effectiveAvailability = useMemo(() => {
    const result: Record<string, number> = {}
    for (const [id, config] of Object.entries(ensuredConfigs)) {
      result[id] = resourceOutput(id, config).available
    }
    return result
  }, [ensuredConfigs])

  const result = useMemo(
    () => calculateProduction(target, effectiveAvailability, maxClock, overrides),
    [target, effectiveAvailability, maxClock, overrides],
  )

  const changeTarget = (itemId: string) => {
    const recipe = defaultRecipeFor(itemId)
    setTarget(itemId)
    setOverrides(recipe ? { [itemId]: recipe.className } : {})
  }

  const setResource = (id: string, config: ResourceConfig) => {
    setResourceConfigs((current) => ({ ...current, [id]: config }))
  }

  const setRecipe = (itemId: string, recipeId: string) => {
    setOverrides((current) => ({ ...current, [itemId]: recipeId }))
  }

  const resourceRates = result.requiredResources.map((id) => ({
    id,
    rate: resourceOutput(id, ensuredConfigs[id] ?? initialConfig()),
  }))

  const hasTransportLimit = resourceRates.some(({ rate }) => rate.transportLimited)
  const hasSurplus = result.requiredResources.some((id) => (result.leftovers[id] ?? 0) > 0.01)
  const status = hasTransportLimit ? t.limited : hasSurplus ? t.surplus : t.balanced
  const statusClass = hasTransportLimit ? 'warning' : hasSurplus ? 'surplus' : ''

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Factory size={24} /></div>
          <div>
            <strong>Satisfactory Factory Planner</strong>
            <span>{dataMetadata.recipeCount} {t.recipesLoaded}</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="language-button" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}>
            <Languages size={15} /> {lang.toUpperCase()}
          </button>
          <div className="version">v0.3</div>
        </div>
      </header>

      <div className="shell">
        <section className="hero">
          <span className="eyebrow">{t.planner}</span>
          <h1>{t.hero}</h1>
          <p>{t.intro}</p>
        </section>

        <section className="target card">
          <div className="target-grid">
            <label>
              <span className="eyebrow">{t.target}</span>
              <select className="target-select" value={target} onChange={(e) => changeTarget(e.target.value)}>
                {targetItems.map((item) => (
                  <option key={item} value={item}>{itemName(item)}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="eyebrow">{t.recipe}</span>
              <select
                className="recipe-select"
                value={selectedTargetRecipe?.className ?? ''}
                onChange={(e) => setRecipe(target, e.target.value)}
              >
                {targetRecipes.map((recipe) => (
                  <option key={recipe.className} value={recipe.className}>
                    {recipe.alternate ? '★ ' : ''}{recipe.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedTargetRecipe && (
            <div className="recipe-chip">
              <Factory size={18} />
              {machineName(selectedTargetRecipe.producedIn, lang)}
            </div>
          )}
        </section>

        <section className="planning-card card">
          <div className="planning-title">
            <Settings2 size={20} />
            <div>
              <span className="eyebrow">{t.planning}</span>
              <strong>{t.maxClock}</strong>
            </div>
          </div>
          <div className="clock-choice">
            <span>{t.maxClockHint}</span>
            <div className="segmented">
              {[100, 150, 200, 250].map((clock) => (
                <button
                  key={clock}
                  className={maxClock === clock ? 'active' : ''}
                  onClick={() => setMaxClock(clock)}
                >
                  {clock}%
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="resource-grid">
          {result.requiredResources.map((resourceId) => (
            <ResourceCard
              key={resourceId}
              resourceId={resourceId}
              lang={lang}
              config={ensuredConfigs[resourceId] ?? initialConfig()}
              onChange={(config) => setResource(resourceId, config)}
            />
          ))}
        </div>

        <section className="result-card">
          <div className="result-heading">
            <div>
              <span className="eyebrow">{t.maxProduction}</span>
              <h2>{fmt(result.output)} {itemName(target)} / min</h2>
            </div>
            <div className={`status ${statusClass}`}>{status}</div>
          </div>

          <div className="summary-strip">
            {resourceRates.map(({ id, rate }) => (
              <div key={id}>
                <span>{displayResourceName(id, lang)}</span>
                <strong>{fmt(result.rawUsed[id] ?? 0)} / {fmt(rate.available)}</strong>
                <small>{rate.unit === 'm³' ? 'm³/min' : '/ min'}</small>
              </div>
            ))}
            <div>
              <span>{itemName(target)}</span>
              <strong>{fmt(result.output)}</strong>
              <small>/ min</small>
            </div>
          </div>

          <div className="section-heading">
            <div><Boxes size={18} /><span>{t.productionChain}</span></div>
          </div>

          <div className="machine-list">
            {[...result.machineSteps].reverse().map((step) => (
              <div className="machine-row" key={`${step.item}-${step.recipe.className}`}>
                <div className="machine-product">
                  <span>{itemName(step.item)}</span>
                  <strong>{fmt(step.requiredRate)} / min</strong>
                  <small>{step.recipe.name}</small>
                </div>
                <div className="machine-arrow">→</div>
                <div className="machine-info">
                  <div>
                    <span>{t.machine}</span>
                    <strong>{step.machines}× {machineName(step.recipe.producedIn, lang)}</strong>
                  </div>
                  <div>
                    <span>{t.setup}</span>
                    <strong>{clockSummary(step.clocks)}</strong>
                  </div>
                  <div>
                    <span>{t.power}</span>
                    <strong>{fmt(step.totalPowerMW)} MW</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-heading recipe-heading">
            <div><Settings2 size={18} /><span>{t.recipeChoices}</span></div>
          </div>
          <p className="section-help">{t.recipeChoicesHint}</p>

          <div className="recipe-choice-list">
            {Array.from(new Set(result.machineSteps.map((step) => step.item))).map((itemId) => {
              const choices = recipesForProduct(itemId)
              const selected = getRecipeFor(itemId, overrides)
              if (choices.length <= 1 || !selected) return null

              return (
                <div className="recipe-choice-row" key={itemId}>
                  <div>
                    <strong>{itemName(itemId)}</strong>
                    <small>{choices.length} Rezepte</small>
                  </div>
                  <select value={selected.className} onChange={(e) => setRecipe(itemId, e.target.value)}>
                    {choices.map((recipe) => (
                      <option key={recipe.className} value={recipe.className}>
                        {recipe.alternate ? '★ ' : ''}{recipe.name}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="section-heading balance-heading">
            <div><Gauge size={18} /><span>{t.rawBalance}</span></div>
          </div>

          <div className="stats">
            {resourceRates.map(({ id, rate }) => (
              <div key={id}>
                <Pickaxe size={18} />
                <span>{displayResourceName(id, lang)}</span>
                <strong>{t.used}: {fmt(result.rawUsed[id] ?? 0)} {rate.unit === 'm³' ? 'm³' : ''}/min</strong>
                <small>{t.left}: {fmt(result.leftovers[id] ?? 0)} {rate.unit === 'm³' ? 'm³' : ''}/min</small>
              </div>
            ))}
            <div>
              <Zap size={18} />
              <span>{t.totalPower}</span>
              <strong>{fmt(result.totalPowerMW)} MW</strong>
              <small>{result.machineSteps.reduce((sum, step) => sum + step.machines, 0)} {t.machines}</small>
            </div>
          </div>
        </section>

        <section className="next-card">
          <span className="eyebrow">{t.coming}</span>
          <h2>{t.designer}</h2>
          <p>{t.designerText}</p>
          <div className="mock-grid">
            <div className="mock-machine">Foundry</div>
            <div className="mock-belt">→</div>
            <div className="mock-machine small">Storage</div>
          </div>
        </section>
      </div>
    </main>
  )
}
