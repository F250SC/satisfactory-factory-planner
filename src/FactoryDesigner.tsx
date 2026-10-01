import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  Layers3,
  Plus,
  RotateCw,
  Trash2,
  WandSparkles,
} from 'lucide-react'
import { itemName, machineIconUrl } from './data'
import {
  FOUNDATION_METERS,
  PIXELS_PER_METER,
  footprintFor,
  rotatedFootprint,
} from './buildingFootprints'
import type { MachineStep } from './engine'

export interface DesignerFloor {
  id: string
  name: string
  elevationM: number
}

export interface DesignerNode {
  id: string
  machineId: string
  itemId: string
  x: number
  y: number
  floorId?: string
  rotation: 0 | 90 | 180 | 270
}

export interface DesignerLift {
  id: string
  x: number
  y: number
  fromFloorId: string
  toFloorId: string
}

export interface DesignerLayout {
  floors?: DesignerFloor[]
  nodes: DesignerNode[]
  lifts?: DesignerLift[]
}

interface Props {
  lang: 'de' | 'en'
  steps: MachineStep[]
  layout: DesignerLayout
  onChange: (layout: DesignerLayout) => void
}

const GRID_W = 18
const GRID_H = 12
const CELL_PX = FOUNDATION_METERS * PIXELS_PER_METER
const DEFAULT_FLOOR_GAP_M = 16

const DEFAULT_FLOOR: DesignerFloor = {
  id: 'floor-ground',
  name: 'EG',
  elevationM: 0,
}

function machineLabel(machineId: string) {
  return machineId
    .replace(/^Desc_/, '')
    .replace(/Mk\d?_C$/, '')
    .replace(/_C$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

function normalizeLayout(layout: DesignerLayout): Required<DesignerLayout> {
  const floors = layout.floors?.length ? layout.floors : [DEFAULT_FLOOR]
  const groundId = floors[0].id

  return {
    floors,
    nodes: layout.nodes.map((node) => ({
      ...node,
      floorId: node.floorId ?? groundId,
    })),
    lifts: layout.lifts ?? [],
  }
}

function rectFor(node: DesignerNode) {
  const size = rotatedFootprint(node.machineId, node.rotation)
  return {
    left: node.x * FOUNDATION_METERS,
    top: node.y * FOUNDATION_METERS,
    right: node.x * FOUNDATION_METERS + size.widthM,
    bottom: node.y * FOUNDATION_METERS + size.lengthM,
  }
}

function overlaps(a: ReturnType<typeof rectFor>, b: ReturnType<typeof rectFor>) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}

export default function FactoryDesigner({ lang, steps, layout, onChange }: Props) {
  const normalized = normalizeLayout(layout)
  const [activeFloorId, setActiveFloorId] = useState(normalized.floors[0].id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)

  const activeFloor =
    normalized.floors.find((floor) => floor.id === activeFloorId) ??
    normalized.floors[0]

  useEffect(() => {
    if (!normalized.floors.some((floor) => floor.id === activeFloorId)) {
      setActiveFloorId(normalized.floors[0].id)
      setSelectedId(null)
    }
  }, [layout, activeFloorId])

  const activeNodes = normalized.nodes.filter(
    (node) => (node.floorId ?? normalized.floors[0].id) === activeFloor.id,
  )

  const floorLifts = normalized.lifts.filter(
    (lift) =>
      lift.fromFloorId === activeFloor.id ||
      lift.toFloorId === activeFloor.id,
  )

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

  const writeLayout = (
    nodes = normalized.nodes,
    floors = normalized.floors,
    lifts = normalized.lifts,
  ) => {
    onChange({ nodes, floors, lifts })
  }

  const fits = (
    candidate: DesignerNode,
    nodes = normalized.nodes,
    ignoreId?: string,
  ) => {
    const rect = rectFor(candidate)
    const maxWidthM = GRID_W * FOUNDATION_METERS
    const maxLengthM = GRID_H * FOUNDATION_METERS

    if (
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > maxWidthM ||
      rect.bottom > maxLengthM
    ) return false

    return !nodes.some((node) => {
      if (node.id === ignoreId) return false
      if ((node.floorId ?? normalized.floors[0].id) !== candidate.floorId) return false
      return overlaps(rect, rectFor(node))
    })
  }

  const findFreeSpot = (
    machineId: string,
    itemId: string,
    nodes: DesignerNode[],
    floorId: string,
    rotation: DesignerNode['rotation'] = 0,
  ) => {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const candidate: DesignerNode = {
          id: 'probe',
          machineId,
          itemId,
          x,
          y,
          floorId,
          rotation,
        }
        if (fits(candidate, nodes)) return { x, y }
      }
    }
    return null
  }

  const addNode = (machineId: string, itemId: string) => {
    const spot = findFreeSpot(
      machineId,
      itemId,
      normalized.nodes,
      activeFloor.id,
    )

    if (!spot) {
      setPlacementError(
        lang === 'de'
          ? 'Für diese Maschine ist auf der aktiven Etage kein freier Platz mehr.'
          : 'There is no free space for this machine on the active floor.',
      )
      return
    }

    const node: DesignerNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      machineId,
      itemId,
      x: spot.x,
      y: spot.y,
      floorId: activeFloor.id,
      rotation: 0,
    }

    writeLayout([...normalized.nodes, node])
    setSelectedId(node.id)
    setPlacementError(null)
  }

  const moveNode = (id: string, x: number, y: number) => {
    const node = normalized.nodes.find((entry) => entry.id === id)
    if (!node) return

    const candidate = { ...node, x, y, floorId: activeFloor.id }
    if (!fits(candidate, normalized.nodes, id)) {
      setPlacementError(
        lang === 'de'
          ? 'Dort passt die Maschine nicht: Kollision oder außerhalb der Foundation-Fläche.'
          : 'The machine does not fit there: collision or outside the foundation area.',
      )
      return
    }

    writeLayout(
      normalized.nodes.map((entry) => (entry.id === id ? candidate : entry)),
    )
    setSelectedId(id)
    setPlacementError(null)
  }

  const rotateNode = (id: string) => {
    const node = normalized.nodes.find((entry) => entry.id === id)
    if (!node) return

    const rotation = ((node.rotation + 90) % 360) as DesignerNode['rotation']
    const candidate = { ...node, rotation }

    if (!fits(candidate, normalized.nodes, id)) {
      setPlacementError(
        lang === 'de'
          ? 'Zum Drehen ist auf dieser Etage nicht genug freier Platz.'
          : 'There is not enough free space on this floor to rotate the machine.',
      )
      return
    }

    writeLayout(
      normalized.nodes.map((entry) => (entry.id === id ? candidate : entry)),
    )
    setPlacementError(null)
  }

  const removeNode = (id: string) => {
    writeLayout(normalized.nodes.filter((node) => node.id !== id))
    if (selectedId === id) setSelectedId(null)
    setPlacementError(null)
  }

  const generateFromPlan = () => {
    const nodes = normalized.nodes.filter(
      (node) => (node.floorId ?? normalized.floors[0].id) !== activeFloor.id,
    )

    for (const step of steps) {
      for (let i = 0; i < step.machines; i++) {
        const spot = findFreeSpot(
          step.recipe.producedIn,
          step.item,
          nodes,
          activeFloor.id,
        )

        if (!spot) {
          setPlacementError(
            lang === 'de'
              ? 'Die komplette Produktionskette passt nicht auf die aktive Etage.'
              : 'The complete production chain does not fit on the active floor.',
          )
          writeLayout(nodes)
          return
        }

        nodes.push({
          id: `auto-${step.recipe.producedIn}-${step.item}-${i}-${Date.now()}`,
          machineId: step.recipe.producedIn,
          itemId: step.item,
          x: spot.x,
          y: spot.y,
          floorId: activeFloor.id,
          rotation: 0,
        })
      }
    }

    writeLayout(nodes)
    const firstOnFloor = nodes.find((node) => node.floorId === activeFloor.id)
    setSelectedId(firstOnFloor?.id ?? null)
    setPlacementError(null)
  }

  const addFloor = () => {
    const highest = Math.max(...normalized.floors.map((floor) => floor.elevationM))
    const id = `floor-${Date.now()}`
    const floor: DesignerFloor = {
      id,
      name: `Etage ${normalized.floors.length}`,
      elevationM: highest + DEFAULT_FLOOR_GAP_M,
    }

    writeLayout(normalized.nodes, [...normalized.floors, floor], normalized.lifts)
    setActiveFloorId(id)
    setSelectedId(null)
    setPlacementError(null)
  }

  const deleteFloor = () => {
    if (normalized.floors.length <= 1) {
      setPlacementError(
        lang === 'de'
          ? 'Die letzte Etage kann nicht gelöscht werden.'
          : 'The final floor cannot be deleted.',
      )
      return
    }

    const floor = activeFloor
    const remainingFloors = normalized.floors.filter((entry) => entry.id !== floor.id)
    const remainingNodes = normalized.nodes.filter((node) => node.floorId !== floor.id)
    const remainingLifts = normalized.lifts.filter(
      (lift) =>
        lift.fromFloorId !== floor.id &&
        lift.toFloorId !== floor.id,
    )

    writeLayout(remainingNodes, remainingFloors, remainingLifts)
    setActiveFloorId(remainingFloors[0].id)
    setSelectedId(null)
    setPlacementError(null)
  }

  const addLift = () => {
    const currentIndex = normalized.floors.findIndex(
      (floor) => floor.id === activeFloor.id,
    )

    const targetFloor =
      normalized.floors[currentIndex + 1] ??
      normalized.floors[currentIndex - 1]

    if (!targetFloor) {
      setPlacementError(
        lang === 'de'
          ? 'Lege zuerst eine zweite Etage an.'
          : 'Create a second floor first.',
      )
      return
    }

    const occupied = new Set(
      normalized.lifts
        .filter(
          (lift) =>
            lift.fromFloorId === activeFloor.id ||
            lift.toFloorId === activeFloor.id,
        )
        .map((lift) => `${lift.x},${lift.y}`),
    )

    let spot: { x: number; y: number } | null = null
    for (let y = 0; y < GRID_H && !spot; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (!occupied.has(`${x},${y}`)) {
          spot = { x, y }
          break
        }
      }
    }

    if (!spot) {
      setPlacementError(
        lang === 'de'
          ? 'Kein freier Lift-Punkt auf dieser Etage.'
          : 'No free lift position is available on this floor.',
      )
      return
    }

    const lift: DesignerLift = {
      id: `lift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: spot.x,
      y: spot.y,
      fromFloorId: activeFloor.id,
      toFloorId: targetFloor.id,
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      [...normalized.lifts, lift],
    )
    setPlacementError(null)
  }

  const removeLift = (id: string) => {
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts.filter((lift) => lift.id !== id),
    )
  }

  const selected = normalized.nodes.find((node) => node.id === selectedId)
  const selectedFootprint = selected ? footprintFor(selected.machineId) : null

  return (
    <section className="designer-page">
      <div className="floor-tabs">
        <div className="floor-tab-list">
          {normalized.floors.map((floor) => (
            <button
              key={floor.id}
              className={floor.id === activeFloor.id ? 'active' : ''}
              onClick={() => {
                setActiveFloorId(floor.id)
                setSelectedId(null)
                setPlacementError(null)
              }}
            >
              <Layers3 size={14} />
              <span>{floor.name}</span>
              <small>{floor.elevationM} m</small>
            </button>
          ))}
        </div>
        <div className="floor-actions">
          <button className="action-button" onClick={addFloor}>
            <Plus size={15} />
            {lang === 'de' ? 'Etage hinzufügen' : 'Add floor'}
          </button>
          <button
            className="action-button danger"
            onClick={deleteFloor}
            disabled={normalized.floors.length <= 1}
          >
            <Trash2 size={15} />
            {lang === 'de' ? 'Etage löschen' : 'Delete floor'}
          </button>
        </div>
      </div>

      <section className="designer-shell">
        <aside className="designer-sidebar card">
          <div className="designer-sidebar-head">
            <div>
              <span className="eyebrow">
                {lang === 'de' ? 'Maschinenpalette' : 'Machine palette'}
              </span>
              <h2>
                {lang === 'de'
                  ? 'Aktuelle Produktionskette'
                  : 'Current production chain'}
              </h2>
            </div>
            <button className="action-button primary" onClick={generateFromPlan}>
              <WandSparkles size={15} />
              {lang === 'de' ? 'Aus Plan erzeugen' : 'Generate from plan'}
            </button>
            <button className="action-button" onClick={addLift}>
              <ArrowDownUp size={15} />
              {lang === 'de' ? 'Conveyor Lift hinzufügen' : 'Add conveyor lift'}
            </button>
          </div>

          <div className="designer-palette">
            {palette.map((entry) => {
              const size = footprintFor(entry.machineId)
              return (
                <button
                  key={`${entry.machineId}-${entry.itemId}`}
                  className="palette-item"
                  onClick={() => addNode(entry.machineId, entry.itemId)}
                >
                  <img
                    src={machineIconUrl(entry.machineId) ?? ''}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <span>
                    <strong>{machineLabel(entry.machineId)}</strong>
                    <small>
                      {entry.count}× · {itemName(entry.itemId, lang)}
                    </small>
                    <small>
                      {size.widthM} × {size.lengthM} m
                    </small>
                  </span>
                </button>
              )
            })}
          </div>

          {selected && selectedFootprint && (
            <div className="designer-inspector">
              <span className="eyebrow">
                {lang === 'de' ? 'Ausgewählt' : 'Selected'}
              </span>
              <h3>{machineLabel(selected.machineId)}</h3>
              <p>{itemName(selected.itemId, lang)}</p>
              <div className="footprint-info">
                <span>{lang === 'de' ? 'Grundfläche' : 'Footprint'}</span>
                <strong>
                  {selectedFootprint.widthM} × {selectedFootprint.lengthM} m
                </strong>
                <small>
                  {lang === 'de' ? 'Höhe' : 'Height'}:{' '}
                  {selectedFootprint.heightM} m · {selected.rotation}°
                </small>
                <small>
                  {lang === 'de' ? 'Etage' : 'Floor'}: {activeFloor.name} ·{' '}
                  {activeFloor.elevationM} m
                </small>
              </div>
              <div className="inspector-actions">
                <button
                  className="action-button"
                  onClick={() => rotateNode(selected.id)}
                >
                  <RotateCw size={15} />
                  {lang === 'de' ? '90° drehen' : 'Rotate 90°'}
                </button>
                <button
                  className="action-button danger"
                  onClick={() => removeNode(selected.id)}
                >
                  <Trash2 size={15} />
                  {lang === 'de' ? 'Löschen' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {floorLifts.length > 0 && (
            <div className="lift-list">
              <span className="eyebrow">Conveyor Lifts</span>
              {floorLifts.map((lift) => {
                const from = normalized.floors.find(
                  (floor) => floor.id === lift.fromFloorId,
                )
                const to = normalized.floors.find(
                  (floor) => floor.id === lift.toFloorId,
                )
                return (
                  <div className="lift-list-item" key={lift.id}>
                    <ArrowDownUp size={15} />
                    <div>
                      <strong>
                        {from?.name ?? '?'} ↔ {to?.name ?? '?'}
                      </strong>
                      <small>
                        Foundation {lift.x + 1}/{lift.y + 1}
                      </small>
                    </div>
                    <button
                      className="icon-delete"
                      onClick={() => removeLift(lift.id)}
                      title={lang === 'de' ? 'Lift löschen' : 'Delete lift'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        <section className="designer-canvas card">
          <div className="designer-toolbar">
            <div>
              <span className="eyebrow">Factory Designer</span>
              <h2>
                {activeFloor.name} · {activeFloor.elevationM} m
              </h2>
              <small>
                {GRID_W} × {GRID_H} Foundations ·{' '}
                {GRID_W * FOUNDATION_METERS} × {GRID_H * FOUNDATION_METERS} m
              </small>
            </div>
            <div className="designer-count">
              {activeNodes.length}{' '}
              {lang === 'de' ? 'Maschinen' : 'machines'}
            </div>
          </div>

          {placementError && (
            <div className="designer-error">
              <AlertTriangle size={16} />
              {placementError}
            </div>
          )}

          <div
            className="factory-grid"
            style={{
              width: GRID_W * CELL_PX,
              height: GRID_H * CELL_PX,
              gridTemplateColumns: `repeat(${GRID_W}, ${CELL_PX}px)`,
              gridTemplateRows: `repeat(${GRID_H}, ${CELL_PX}px)`,
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const raw = e.dataTransfer.getData(
                'application/x-satisfactory-node',
              )
              if (!raw) return

              const { id, offsetX, offsetY } = JSON.parse(raw) as {
                id: string
                offsetX: number
                offsetY: number
              }

              const grid = e.currentTarget
              const rect = grid.getBoundingClientRect()
              const leftPx =
                e.clientX - rect.left + grid.scrollLeft - offsetX
              const topPx =
                e.clientY - rect.top + grid.scrollTop - offsetY
              const x = Math.max(
                0,
                Math.min(GRID_W - 1, Math.round(leftPx / CELL_PX)),
              )
              const y = Math.max(
                0,
                Math.min(GRID_H - 1, Math.round(topPx / CELL_PX)),
              )

              moveNode(id, x, y)
            }}
          >
            {Array.from({ length: GRID_W * GRID_H }).map((_, index) => (
              <div key={index} className="foundation-cell" />
            ))}

            {floorLifts.map((lift) => (
              <div
                key={lift.id}
                className="factory-lift"
                style={{
                  left: lift.x * CELL_PX + CELL_PX / 2 - 12,
                  top: lift.y * CELL_PX + CELL_PX / 2 - 12,
                }}
                title={lang === 'de' ? 'Conveyor Lift' : 'Conveyor lift'}
              >
                <ArrowDownUp size={16} />
              </div>
            ))}

            {activeNodes.map((node) => {
              const size = rotatedFootprint(node.machineId, node.rotation)
              return (
                <button
                  key={node.id}
                  draggable
                  onDragStart={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(
                      'application/x-satisfactory-node',
                      JSON.stringify({
                        id: node.id,
                        offsetX: e.clientX - rect.left,
                        offsetY: e.clientY - rect.top,
                      }),
                    )
                    setSelectedId(node.id)
                  }}
                  onClick={() => setSelectedId(node.id)}
                  className={`factory-node ${
                    selectedId === node.id ? 'selected' : ''
                  }`}
                  style={{
                    left: node.x * CELL_PX,
                    top: node.y * CELL_PX,
                    width: size.widthM * PIXELS_PER_METER,
                    height: size.lengthM * PIXELS_PER_METER,
                  }}
                  title={`${machineLabel(node.machineId)} · ${size.widthM}×${size.lengthM}m`}
                >
                  <img
                    src={machineIconUrl(node.machineId) ?? ''}
                    alt=""
                    style={{ transform: `rotate(${node.rotation}deg)` }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <span>{machineLabel(node.machineId)}</span>
                </button>
              )
            })}
          </div>
        </section>
      </section>
    </section>
  )
}
