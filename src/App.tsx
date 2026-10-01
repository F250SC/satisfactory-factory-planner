import { useMemo, useState } from 'react'
import { Factory, Gauge, Mountain, Pickaxe, Zap } from 'lucide-react'
import { calculateSteel, minerOutput } from './engine'
import {
  minerLabel,
  purityLabel,
  steelRecipe,
  type MinerTier,
  type Purity,
} from './data'

function fmt(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

function ResourceCard({
  title,
  icon,
  purity,
  miner,
  onPurity,
  onMiner,
  output,
}: {
  title: string
  icon: React.ReactNode
  purity: Purity
  miner: MinerTier
  onPurity: (value: Purity) => void
  onMiner: (value: MinerTier) => void
  output: number
}) {
  return (
    <section className="card resource-card">
      <div className="card-title-row">
        <div className="icon-box">{icon}</div>
        <div>
          <span className="eyebrow">Resource Node</span>
          <h2>{title}</h2>
        </div>
      </div>

      <label>
        Node purity
        <select value={purity} onChange={(e) => onPurity(e.target.value as Purity)}>
          {Object.entries(purityLabel).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>
      </label>

      <label>
        Miner
        <select value={miner} onChange={(e) => onMiner(e.target.value as MinerTier)}>
          {Object.entries(minerLabel).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>
      </label>

      <div className="rate-line">
        <span>Available</span>
        <strong>{fmt(output)} / min</strong>
      </div>
    </section>
  )
}

export default function App() {
  const [ironPurity, setIronPurity] = useState<Purity>('normal')
  const [coalPurity, setCoalPurity] = useState<Purity>('normal')
  const [ironMiner, setIronMiner] = useState<MinerTier>('mk1')
  const [coalMiner, setCoalMiner] = useState<MinerTier>('mk1')

  const ironRate = useMemo(() => minerOutput(ironMiner, ironPurity), [ironMiner, ironPurity])
  const coalRate = useMemo(() => minerOutput(coalMiner, coalPurity), [coalMiner, coalPurity])
  const result = useMemo(() => calculateSteel(ironRate, coalRate), [ironRate, coalRate])

  const ironLeft = Math.max(0, ironRate - result.ironUsed)
  const coalLeft = Math.max(0, coalRate - result.coalUsed)

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
        <div className="version">v0.1</div>
      </header>

      <div className="shell">
        <section className="hero">
          <span className="eyebrow">Production Planner</span>
          <h1>What can I build with the resources I actually have?</h1>
          <p>
            Start with your real resource nodes and miners. The planner calculates
            the production you can achieve instead of forcing you to guess a target rate first.
          </p>
        </section>

        <section className="target card">
          <div>
            <span className="eyebrow">Target product</span>
            <h2>{steelRecipe.name}</h2>
          </div>
          <div className="recipe-chip">
            <Factory size={18} />
            {steelRecipe.machine}
          </div>
        </section>

        <div className="resource-grid">
          <ResourceCard
            title="Iron Ore"
            icon={<Mountain size={22} />}
            purity={ironPurity}
            miner={ironMiner}
            onPurity={setIronPurity}
            onMiner={setIronMiner}
            output={ironRate}
          />
          <ResourceCard
            title="Coal"
            icon={<Pickaxe size={22} />}
            purity={coalPurity}
            miner={coalMiner}
            onPurity={setCoalPurity}
            onMiner={setCoalMiner}
            output={coalRate}
          />
        </div>

        <section className="result-card">
          <div className="result-heading">
            <div>
              <span className="eyebrow">Maximum production</span>
              <h2>{fmt(result.output)} Steel Ingots / min</h2>
            </div>
            <div className="status">Balanced</div>
          </div>

          <div className="flow">
            <div className="flow-node">
              <span>Iron Ore</span>
              <strong>{fmt(result.ironUsed)}/min</strong>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node machine">
              <span>{result.foundries}× Foundry</span>
              <strong>{fmt(result.clock)}%</strong>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node output">
              <span>Steel Ingot</span>
              <strong>{fmt(result.output)}/min</strong>
            </div>
            <div className="coal-feed">
              <span>Coal</span>
              <strong>{fmt(result.coalUsed)}/min</strong>
            </div>
          </div>

          <div className="stats">
            <div>
              <Gauge size={18} />
              <span>Foundry clock</span>
              <strong>{fmt(result.clock)}%</strong>
            </div>
            <div>
              <Zap size={18} />
              <span>Base machine power</span>
              <strong>{steelRecipe.powerMW} MW @ 100%</strong>
            </div>
            <div>
              <Mountain size={18} />
              <span>Iron left</span>
              <strong>{fmt(ironLeft)}/min</strong>
            </div>
            <div>
              <Pickaxe size={18} />
              <span>Coal left</span>
              <strong>{fmt(coalLeft)}/min</strong>
            </div>
          </div>
        </section>

        <section className="next-card">
          <span className="eyebrow">Coming next</span>
          <h2>Factory Designer</h2>
          <p>Drag machines onto foundations, plan multiple floors and connect belts and lifts.</p>
          <div className="mock-grid" aria-label="Preview of future factory layout">
            <div className="mock-machine">Foundry</div>
            <div className="mock-belt">→</div>
            <div className="mock-machine small">Storage</div>
          </div>
        </section>
      </div>
    </main>
  )
}
