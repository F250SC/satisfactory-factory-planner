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
  Zap,
} from 'lucide-react'
import { calculateProduction, minerOutput, type ResourceConfig } from './engine'
import {
  beltRates,
  itemNames,
  machineNames,
  machinePowerMW,
  targetItems,
  type BeltTier,
  type ItemId,
  type MinerTier,
  type Purity,
} from './data'

type Lang = 'de' | 'en'
type RawResource = 'iron-ore' | 'coal'

const text = {
  de: {
    planner: 'Produktionsplaner',
    hero: 'Was kann ich mit den Ressourcen bauen, die ich wirklich habe?',
    intro:
      'Starte mit deinen echten Rohstoffvorkommen, Minern und Förderbändern. Der Planner berechnet daraus automatisch, was deine Fabrik maximal produzieren kann.',
    target: 'Zielprodukt',
    resourceNode: 'Rohstoffvorkommen',
    purity: 'Reinheit',
    miner: 'Miner',
    belt: 'Förderband',
    mined: 'Gefördert',
    available: 'Nutzbar',
    beltLimit: 'Förderband limitiert',
    settings: 'Planung',
    overclock: 'Produktionsmaschinen übertakten',
    overclockHint: 'Bis maximal 250 % einplanen',
    maxProduction: 'Maximale Produktion',
    balanced: 'Ausgeglichen',
    surplus: 'Rohstoffüberschuss',
    limited: 'Förderband-Limit',
    productionChain: 'Benötigte Produktionsstufen',
    machines: 'Maschinen',
    machine: 'Maschine',
    clock: 'Takt',
    throughput: 'Ausgabe',
    basePower: 'Basisleistung',
    leftovers: 'Rohstoffbilanz',
    used: 'Verbraucht',
    left: 'Übrig',
    coming: 'Als Nächstes',
    designer: 'Factory Designer',
    designerText:
      'Maschinen auf Foundations ziehen, mehrere Etagen planen und Förderbänder sowie Lifts verbinden.',
    language: 'Sprache',
  },
  en: {
    planner: 'Production Planner',
    hero: 'What can I build with the resources I actually have?',
    intro:
      'Start with your real resource nodes, miners and conveyor belts. The planner automatically calculates the maximum production your factory can achieve.',
    target: 'Target product',
    resourceNode: 'Resource node',
    purity: 'Node purity',
    miner: 'Miner',
    belt: 'Conveyor belt',
    mined: 'Mined',
    available: 'Available',
    beltLimit: 'Belt limited',
    settings: 'Planning',
    overclock: 'Overclock production machines',
    overclockHint: 'Plan with up to 250% clock speed',
    maxProduction: 'Maximum production',
    balanced: 'Balanced',
    surplus: 'Resource surplus',
    limited: 'Belt limit',
    productionChain: 'Required production stages',
    machines: 'Machines',
    machine: 'Machine',
    clock: 'Clock',
    throughput: 'Output',
    basePower: 'Base power',
    leftovers: 'Resource balance',
    used: 'Used',
    left: 'Left',
    coming: 'Coming next',
    designer: 'Factory Designer',
    designerText:
      'Drag machines onto foundations, plan multiple floors and connect conveyor belts and lifts.',
    language: 'Language',
  },
} as const

const purityNames: Record<Purity, { de: string; en: string }> = {
  impure: { de: 'Unrein', en: 'Impure' },
  normal: { de: 'Normal', en: 'Normal' },
  pure: { de: 'Rein', en: 'Pure' },
}

function fmt(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.005) return Math.round(value).toString()
  return value.toFixed(2).replace(/\.00$/, '')
}

function ResourceCard({
  resource,
  lang,
  icon,
  config,
  onChange,
}: {
  resource: RawResource
  lang: Lang
  icon: ReactNode
  config: ResourceConfig
  onChange: (config: ResourceConfig) => void
}) {
  const t = text[lang]
  const rate = minerOutput(config)

  return (
    <section className="card resource-card">
      <div className="card-title-row">
        <div className="icon-box">{icon}</div>
        <div>
          <span className="eyebrow">{t.resourceNode}</span>
          <h2>{itemNames[resource][lang]}</h2>
        </div>
        {rate.beltLimited && (
          <div className="warning-chip">
            <AlertTriangle size={14} />
            {t.beltLimit}
          </div>
        )}
      </div>

      <div className="field-grid">
        <label>
          {t.purity}
          <select
            value={config.purity}
            onChange={(e) => onChange({ ...config, purity: e.target.value as Purity })}
          >
            {(Object.keys(purityNames) as Purity[]).map((purity) => (
              <option key={purity} value={purity}>
                {purityNames[purity][lang]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.miner}
          <select
            value={config.miner}
            onChange={(e) => onChange({ ...config, miner: e.target.value as MinerTier })}
          >
            {(['mk1', 'mk2', 'mk3'] as MinerTier[]).map((miner) => (
              <option key={miner} value={miner}>Miner {miner.toUpperCase().replace('MK', 'Mk.')}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        {t.belt}
        <select
          value={config.belt}
          onChange={(e) => onChange({ ...config, belt: e.target.value as BeltTier })}
        >
          {(Object.keys(beltRates) as BeltTier[]).map((belt) => (
            <option key={belt} value={belt}>
              Mk.{belt.slice(2)} — {beltRates[belt]}/min
            </option>
          ))}
        </select>
      </label>

      <div className="resource-rates">
        <div>
          <span>{t.mined}</span>
          <strong>{fmt(rate.mined)} / min</strong>
        </div>
        <div>
          <span>{t.available}</span>
          <strong className={rate.beltLimited ? 'warn-text' : ''}>{fmt(rate.available)} / min</strong>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('de')
  const [target, setTarget] = useState<ItemId>('steel-ingot')
  const [allowOverclock, setAllowOverclock] = useState(true)
  const [ironConfig, setIronConfig] = useState<ResourceConfig>({
    purity: 'normal',
    miner: 'mk1',
    belt: 'mk1',
  })
  const [coalConfig, setCoalConfig] = useState<ResourceConfig>({
    purity: 'normal',
    miner: 'mk1',
    belt: 'mk1',
  })

  const t = text[lang]
  const ironRate = useMemo(() => minerOutput(ironConfig), [ironConfig])
  const coalRate = useMemo(() => minerOutput(coalConfig), [coalConfig])

  const result = useMemo(
    () =>
      calculateProduction(
        target,
        {
          'iron-ore': ironRate.available,
          coal: coalRate.available,
        },
        allowOverclock,
      ),
    [target, ironRate.available, coalRate.available, allowOverclock],
  )

  const rates: Record<RawResource, ReturnType<typeof minerOutput>> = {
    'iron-ore': ironRate,
    coal: coalRate,
  }

  const requiredResources = result.requiredResources.filter(
    (resource): resource is RawResource => resource === 'iron-ore' || resource === 'coal',
  )

  const hasBeltLimit = requiredResources.some((resource) => rates[resource].beltLimited)
  const hasSurplus = requiredResources.some((resource) => (result.leftovers[resource] ?? 0) > 0.01)
  const status = hasBeltLimit ? t.limited : hasSurplus ? t.surplus : t.balanced
  const statusClass = hasBeltLimit ? 'warning' : hasSurplus ? 'surplus' : ''

  const targetStep = result.machineSteps.find((step) => step.item === target)

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Factory size={24} /></div>
          <div>
            <strong>Satisfactory Factory Planner</strong>
            <span>Resource-first planning</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="language-button" onClick={() => setLang(lang === 'de' ? 'en' : 'de')}>
            <Languages size={15} />
            {lang === 'de' ? 'DE' : 'EN'}
          </button>
          <div className="version">v0.2</div>
        </div>
      </header>

      <div className="shell">
        <section className="hero">
          <span className="eyebrow">{t.planner}</span>
          <h1>{t.hero}</h1>
          <p>{t.intro}</p>
        </section>

        <section className="target card">
          <div className="target-select-wrap">
            <span className="eyebrow">{t.target}</span>
            <select
              className="target-select"
              value={target}
              onChange={(e) => setTarget(e.target.value as ItemId)}
            >
              {targetItems.map((item) => (
                <option key={item} value={item}>{itemNames[item][lang]}</option>
              ))}
            </select>
          </div>
          {targetStep && (
            <div className="recipe-chip">
              <Factory size={18} />
              {machineNames[targetStep.recipe.machine][lang]}
            </div>
          )}
        </section>

        <section className="planning-card card">
          <div className="planning-title">
            <Settings2 size={20} />
            <div>
              <span className="eyebrow">{t.settings}</span>
              <strong>{t.overclock}</strong>
            </div>
          </div>
          <div className="toggle-wrap">
            <span>{t.overclockHint}</span>
            <button
              className={`toggle ${allowOverclock ? 'active' : ''}`}
              onClick={() => setAllowOverclock(!allowOverclock)}
              aria-pressed={allowOverclock}
            >
              <span />
            </button>
          </div>
        </section>

        <div className={`resource-grid ${requiredResources.length === 1 ? 'single' : ''}`}>
          {requiredResources.includes('iron-ore') && (
            <ResourceCard
              resource="iron-ore"
              lang={lang}
              icon={<Mountain size={22} />}
              config={ironConfig}
              onChange={setIronConfig}
            />
          )}
          {requiredResources.includes('coal') && (
            <ResourceCard
              resource="coal"
              lang={lang}
              icon={<Pickaxe size={22} />}
              config={coalConfig}
              onChange={setCoalConfig}
            />
          )}
        </div>

        <section className="result-card">
          <div className="result-heading">
            <div>
              <span className="eyebrow">{t.maxProduction}</span>
              <h2>{fmt(result.output)} {itemNames[target][lang]} / min</h2>
            </div>
            <div className={`status ${statusClass}`}>{status}</div>
          </div>

          <div className="summary-strip">
            {requiredResources.map((resource) => (
              <div key={resource}>
                <span>{itemNames[resource][lang]}</span>
                <strong>{fmt(result.rawUsed[resource] ?? 0)} / {fmt(rates[resource].available)}</strong>
                <small>/ min</small>
              </div>
            ))}
            <div>
              <span>{itemNames[target][lang]}</span>
              <strong>{fmt(result.output)}</strong>
              <small>/ min</small>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <Boxes size={18} />
              <span>{t.productionChain}</span>
            </div>
          </div>

          <div className="machine-list">
            {[...result.machineSteps].reverse().map((step) => (
              <div className="machine-row" key={step.item}>
                <div className="machine-product">
                  <span>{itemNames[step.item][lang]}</span>
                  <strong>{fmt(step.requiredRate)} / min</strong>
                </div>
                <div className="machine-arrow">→</div>
                <div className="machine-info">
                  <div>
                    <span>{machineNames[step.recipe.machine][lang]}</span>
                    <strong>{step.machines}×</strong>
                  </div>
                  <div>
                    <span>{t.clock}</span>
                    <strong>{fmt(step.clock)}%</strong>
                  </div>
                  <div>
                    <span>{t.basePower}</span>
                    <strong>{machinePowerMW[step.recipe.machine]} MW</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-heading balance-heading">
            <div>
              <Gauge size={18} />
              <span>{t.leftovers}</span>
            </div>
          </div>

          <div className="stats">
            {requiredResources.map((resource) => (
              <div key={resource}>
                {resource === 'iron-ore' ? <Mountain size={18} /> : <Pickaxe size={18} />}
                <span>{itemNames[resource][lang]}</span>
                <strong>{t.used}: {fmt(result.rawUsed[resource] ?? 0)}/min</strong>
                <small>{t.left}: {fmt(result.leftovers[resource] ?? 0)}/min</small>
              </div>
            ))}
            <div>
              <Zap size={18} />
              <span>{t.overclock}</span>
              <strong>{allowOverclock ? 'ON · 250%' : 'OFF · 100%'}</strong>
              <small>{result.machineSteps.reduce((sum, step) => sum + step.machines, 0)} {t.machines}</small>
            </div>
          </div>
        </section>

        <section className="next-card">
          <span className="eyebrow">{t.coming}</span>
          <h2>{t.designer}</h2>
          <p>{t.designerText}</p>
          <div className="mock-grid" aria-label="Factory designer preview">
            <div className="mock-machine">Foundry</div>
            <div className="mock-belt">→</div>
            <div className="mock-machine small">Storage</div>
          </div>
        </section>
      </div>
    </main>
  )
}
