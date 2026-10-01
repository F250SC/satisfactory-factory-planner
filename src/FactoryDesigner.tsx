import { useMemo, useState } from 'react'
import { Factory, RotateCw, Trash2, WandSparkles } from 'lucide-react'
import { itemName, machineIconUrl } from './data'
import type { MachineStep } from './engine'

export interface DesignerNode {
  id: string
  machineId: string
  itemId: string
  x: number
  y: number
  rotation: 0 | 90 | 180 | 270
}

export interface DesignerLayout {
  nodes: DesignerNode[]
}

interface Props {
  lang: 'de' | 'en'
  steps: MachineStep[]
  layout: DesignerLayout
  onChange: (layout: DesignerLayout) => void
}

const GRID_W = 18
const GRID_H = 12

function machineLabel(machineId: string) {
  return machineId
    .replace(/^Desc_/, '')
    .replace(/Mk\d?_C$/, '')
    .replace(/_C$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

export default function FactoryDesigner({ lang, steps, layout, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const palette = useMemo(() => {
    const map = new Map<string, { machineId: string; itemId: string; count: number }>()
    for (const step of steps) {
      const key = `${step.recipe.producedIn}::${step.item}`
      const current = map.get(key)
      map.set(key, {
        machineId: step.recipe.producedIn,
        itemId: step.item,
        count: (current?.count ?? 0) + step.machines,
      })
    }
    return [...map.values()]
  }, [steps])

  const addNode = (machineId: string, itemId: string) => {
    const occupied = new Set(layout.nodes.map((n) => `${n.x},${n.y}`))
    let x = 0
    let y = 0
    outer: for (let yy = 0; yy < GRID_H; yy++) {
      for (let xx = 0; xx < GRID_W; xx++) {
        if (!occupied.has(`${xx},${yy}`)) {
          x = xx
          y = yy
          break outer
        }
      }
    }
    const node: DesignerNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      machineId,
      itemId,
      x,
      y,
      rotation: 0,
    }
    onChange({ nodes: [...layout.nodes, node] })
    setSelectedId(node.id)
  }

  const updateNode = (id: string, patch: Partial<DesignerNode>) => {
    onChange({
      nodes: layout.nodes.map((node) => node.id === id ? { ...node, ...patch } : node),
    })
  }

  const removeNode = (id: string) => {
    onChange({ nodes: layout.nodes.filter((node) => node.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  const generateFromPlan = () => {
    const nodes: DesignerNode[] = []
    let index = 0
    for (const step of steps) {
      for (let i = 0; i < step.machines; i++) {
        nodes.push({
          id: `auto-${step.recipe.producedIn}-${step.item}-${i}-${Date.now()}`,
          machineId: step.recipe.producedIn,
          itemId: step.item,
          x: index % GRID_W,
          y: Math.floor(index / GRID_W) % GRID_H,
          rotation: 0,
        })
        index += 1
      }
    }
    onChange({ nodes })
    setSelectedId(nodes[0]?.id ?? null)
  }

  const selected = layout.nodes.find((node) => node.id === selectedId)

  return (
    <section className="designer-shell">
      <aside className="designer-sidebar card">
        <div className="designer-sidebar-head">
          <div>
            <span className="eyebrow">{lang === 'de' ? 'Maschinenpalette' : 'Machine palette'}</span>
            <h2>{lang === 'de' ? 'Aktuelle Produktionskette' : 'Current production chain'}</h2>
          </div>
          <button className="action-button primary" onClick={generateFromPlan}>
            <WandSparkles size={15} />
            {lang === 'de' ? 'Aus Plan erzeugen' : 'Generate from plan'}
          </button>
        </div>

        <div className="designer-palette">
          {palette.map((entry) => (
            <button
              key={`${entry.machineId}-${entry.itemId}`}
              className="palette-item"
              onClick={() => addNode(entry.machineId, entry.itemId)}
            >
              <img
                src={machineIconUrl(entry.machineId) ?? ''}
                alt=""
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span>
                <strong>{machineLabel(entry.machineId)}</strong>
                <small>{entry.count}× · {itemName(entry.itemId, lang)}</small>
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="designer-inspector">
            <span className="eyebrow">{lang === 'de' ? 'Ausgewählt' : 'Selected'}</span>
            <h3>{machineLabel(selected.machineId)}</h3>
            <p>{itemName(selected.itemId, lang)}</p>
            <div className="inspector-actions">
              <button
                className="action-button"
                onClick={() => updateNode(selected.id, {
                  rotation: ((selected.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                })}
              >
                <RotateCw size={15} />
                {lang === 'de' ? '90° drehen' : 'Rotate 90°'}
              </button>
              <button className="action-button danger" onClick={() => removeNode(selected.id)}>
                <Trash2 size={15} />
                {lang === 'de' ? 'Löschen' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </aside>

      <section className="designer-canvas card">
        <div className="designer-toolbar">
          <div>
            <span className="eyebrow">Factory Designer</span>
            <h2>{lang === 'de' ? 'Foundation-Raster' : 'Foundation grid'}</h2>
          </div>
          <div className="designer-count">{layout.nodes.length} {lang === 'de' ? 'Maschinen' : 'machines'}</div>
        </div>

        <div
          className="factory-grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_W}, 56px)`,
            gridTemplateRows: `repeat(${GRID_H}, 56px)`,
          }}
        >
          {Array.from({ length: GRID_W * GRID_H }).map((_, index) => {
            const x = index % GRID_W
            const y = Math.floor(index / GRID_W)
            return (
              <div
                key={index}
                className="foundation-cell"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  if (!id) return
                  updateNode(id, { x, y })
                }}
                onClick={() => {
                  if (!selectedId) return
                  updateNode(selectedId, { x, y })
                }}
              />
            )
          })}

          {layout.nodes.map((node) => (
            <button
              key={node.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', node.id)}
              onClick={() => setSelectedId(node.id)}
              className={`factory-node ${selectedId === node.id ? 'selected' : ''}`}
              style={{
                gridColumnStart: node.x + 1,
                gridRowStart: node.y + 1,
                transform: `rotate(${node.rotation}deg)`,
              }}
              title={machineLabel(node.machineId)}
            >
              <img
                src={machineIconUrl(node.machineId) ?? ''}
                alt=""
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <span>{machineLabel(node.machineId)}</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}
