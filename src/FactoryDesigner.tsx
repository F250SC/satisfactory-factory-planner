import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  GitFork,
  Layers3,
  Maximize2,
  Merge,
  Plus,
  RotateCw,
  Trash2,
  Unplug,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  beltRates,
  extractorIconUrl,
  itemName,
  machineIconUrl,
  resourceMeta,
  type BeltTier,
  type MinerTier,
} from './data'
import {
  FOUNDATION_METERS,
  PIXELS_PER_METER,
  footprintFor,
  rotatedFootprint,
} from './buildingFootprints'
import { resourceOutput, type MachineStep, type ResourceConfig } from './engine'

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

export interface DesignerSource {
  id: string
  resourceId: string
  miner: MinerTier
  rate: number
  capacityRate?: number
  x: number
  y: number
  floorId: string
}

export interface DesignerUtility {
  id: string
  kind: 'splitter' | 'merger'
  x: number
  y: number
  floorId: string
  rotation: 0 | 90 | 180 | 270
}

export interface DesignerLift {
  id: string
  x: number
  y: number
  fromFloorId: string
  toFloorId: string
}

export interface DesignerEndpoint {
  kind: 'node' | 'utility' | 'source'
  id: string
  side?: 'input' | 'output'
  port?: number
}

export interface DesignerBeltWaypoint {
  x: number
  y: number
}

export interface DesignerBelt {
  id: string
  floorId: string
  from: DesignerEndpoint
  to: DesignerEndpoint
  tier: BeltTier
  materialId?: string
  waypoints?: DesignerBeltWaypoint[]
  routeStyle?: 'straight' | 'orthogonal' | 'smooth'
}

export interface DesignerLayout {
  floors?: DesignerFloor[]
  nodes: DesignerNode[]
  sources?: DesignerSource[]
  utilities?: DesignerUtility[]
  lifts?: DesignerLift[]
  belts?: DesignerBelt[]
}

interface PlannerResource {
  id: string
  config: ResourceConfig
  usedRate: number
}

interface Props {
  lang: 'de' | 'en'
  steps: MachineStep[]
  resources: PlannerResource[]
  maxBeltTier: BeltTier
  tier: number
  clockControlUnlocked: boolean
  onResourceChange: (id: string, config: ResourceConfig) => void
  layout: DesignerLayout
  onChange: (layout: DesignerLayout) => void
}

type Side = 'left' | 'right' | 'top' | 'bottom'

interface PortPoint {
  x: number
  y: number
  side: Side
}

const CELL_PX = FOUNDATION_METERS * PIXELS_PER_METER
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2
const AUTO_SEARCH_W = 180
const AUTO_SEARCH_H = 100
const DEFAULT_FLOOR_GAP_M = 16
const UTILITY_SIZE_M = 4
const PORT_SIZE = 10
const PORT_STUB = 18

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

function normalizeEndpoint(
  endpoint: DesignerEndpoint,
  fallbackSide: 'input' | 'output',
): DesignerEndpoint {
  return {
    ...endpoint,
    side: endpoint.side ?? fallbackSide,
    port: endpoint.port ?? 0,
  }
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
    sources: layout.sources ?? [],
    utilities: layout.utilities ?? [],
    lifts: layout.lifts ?? [],
    belts: (layout.belts ?? []).map((belt) => ({
      ...belt,
      from: normalizeEndpoint(belt.from, 'output'),
      to: normalizeEndpoint(belt.to, 'input'),
    })),
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

function sourceRect(source: DesignerSource) {
  return {
    left: source.x * FOUNDATION_METERS,
    top: source.y * FOUNDATION_METERS,
    right: source.x * FOUNDATION_METERS + FOUNDATION_METERS,
    bottom: source.y * FOUNDATION_METERS + FOUNDATION_METERS,
  }
}

function utilityRect(utility: DesignerUtility) {
  return {
    left: utility.x * FOUNDATION_METERS,
    top: utility.y * FOUNDATION_METERS,
    right: utility.x * FOUNDATION_METERS + UTILITY_SIZE_M,
    bottom: utility.y * FOUNDATION_METERS + UTILITY_SIZE_M,
  }
}

function overlaps(
  a: ReturnType<typeof rectFor>,
  b: ReturnType<typeof rectFor>,
) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}

function endpointKey(endpoint: DesignerEndpoint) {
  return `${endpoint.kind}:${endpoint.id}:${endpoint.side ?? ''}:${endpoint.port ?? 0}`
}

function sideFor(
  role: 'input' | 'output',
  rotation: 0 | 90 | 180 | 270,
): Side {
  const inputByRotation: Record<DesignerNode['rotation'], Side> = {
    0: 'left',
    90: 'top',
    180: 'right',
    270: 'bottom',
  }
  const outputByRotation: Record<DesignerNode['rotation'], Side> = {
    0: 'right',
    90: 'bottom',
    180: 'left',
    270: 'top',
  }
  return role === 'input'
    ? inputByRotation[rotation]
    : outputByRotation[rotation]
}

function rotateSide(side: Side, rotation: 0 | 90 | 180 | 270): Side {
  const order: Side[] = ['top', 'right', 'bottom', 'left']
  const index = order.indexOf(side)
  const steps = rotation / 90
  return order[(index + steps) % 4]
}

function utilityPortSide(
  kind: DesignerUtility['kind'],
  role: 'input' | 'output',
  index: number,
  rotation: DesignerUtility['rotation'],
): Side {
  const base: Side =
    kind === 'splitter'
      ? role === 'input'
        ? 'left'
        : (['top', 'right', 'bottom'] as Side[])[index] ?? 'right'
      : role === 'output'
        ? 'right'
        : (['top', 'left', 'bottom'] as Side[])[index] ?? 'left'

  return rotateSide(base, rotation)
}

function materialColor(materialId?: string) {
  if (!materialId) return 'hsl(32 85% 55%)'
  let hash = 0
  for (let i = 0; i < materialId.length; i += 1) {
    hash = ((hash << 5) - hash + materialId.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 72% 58%)`
}

function sideCenterPoint(
  rectPx: { left: number; top: number; right: number; bottom: number },
  side: Side,
): PortPoint {
  if (side === 'left') return { x: rectPx.left, y: (rectPx.top + rectPx.bottom) / 2, side }
  if (side === 'right') return { x: rectPx.right, y: (rectPx.top + rectPx.bottom) / 2, side }
  if (side === 'top') return { x: (rectPx.left + rectPx.right) / 2, y: rectPx.top, side }
  return { x: (rectPx.left + rectPx.right) / 2, y: rectPx.bottom, side }
}

function distributedPoint(
  rectPx: { left: number; top: number; right: number; bottom: number },
  side: Side,
  index: number,
  count: number,
): PortPoint {
  const fraction = (index + 1) / (count + 1)
  if (side === 'left') {
    return {
      x: rectPx.left,
      y: rectPx.top + (rectPx.bottom - rectPx.top) * fraction,
      side,
    }
  }
  if (side === 'right') {
    return {
      x: rectPx.right,
      y: rectPx.top + (rectPx.bottom - rectPx.top) * fraction,
      side,
    }
  }
  if (side === 'top') {
    return {
      x: rectPx.left + (rectPx.right - rectPx.left) * fraction,
      y: rectPx.top,
      side,
    }
  }
  return {
    x: rectPx.left + (rectPx.right - rectPx.left) * fraction,
    y: rectPx.bottom,
    side,
  }
}

function pushPoint(point: PortPoint, distance: number) {
  if (point.side === 'left') return { x: point.x - distance, y: point.y }
  if (point.side === 'right') return { x: point.x + distance, y: point.y }
  if (point.side === 'top') return { x: point.x, y: point.y - distance }
  return { x: point.x, y: point.y + distance }
}

function pointsToPath(
  points: Array<{ x: number; y: number }>,
  smooth = false,
) {
  if (points.length < 2) return ''
  if (!smooth) {
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  d += ` T ${last.x} ${last.y}`
  return d
}

function routedPath(
  from: PortPoint,
  to: PortPoint,
  waypoints: DesignerBeltWaypoint[] | undefined,
  style: 'straight' | 'orthogonal' | 'smooth',
  laneOffset = 0,
) {
  if (style === 'straight' && !waypoints?.length) {
    return {
      d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelX: (from.x + to.x) / 2 + 5,
      labelY: (from.y + to.y) / 2 - 5,
    }
  }

  if (waypoints?.length) {
    const points = [
      { x: from.x, y: from.y },
      ...waypoints.map((point) => ({
        x: point.x * PIXELS_PER_METER,
        y: point.y * PIXELS_PER_METER,
      })),
      { x: to.x, y: to.y },
    ]
    return {
      d: pointsToPath(points, style === 'smooth'),
      labelX: points[Math.floor(points.length / 2)].x + 5,
      labelY: points[Math.floor(points.length / 2)].y - 5,
    }
  }

  const base = orthogonalPath(from, to)
  if (!laneOffset) return base

  const fromStub = pushPoint(from, PORT_STUB + laneOffset)
  const toStub = pushPoint(to, PORT_STUB + laneOffset)
  const horizontal = from.side === 'left' || from.side === 'right'

  if (horizontal) {
    const midX = (fromStub.x + toStub.x) / 2 + laneOffset
    return {
      d: `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} L ${midX} ${fromStub.y} L ${midX} ${toStub.y} L ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`,
      labelX: midX + 4,
      labelY: (fromStub.y + toStub.y) / 2 - 4,
    }
  }

  const midY = (fromStub.y + toStub.y) / 2 + laneOffset
  return {
    d: `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} L ${fromStub.x} ${midY} L ${toStub.x} ${midY} L ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`,
    labelX: (fromStub.x + toStub.x) / 2 + 4,
    labelY: midY - 4,
  }
}

function orthogonalPath(from: PortPoint, to: PortPoint) {
  const fromStub = pushPoint(from, PORT_STUB)
  const toStub = pushPoint(to, PORT_STUB)

  const fromHorizontal = from.side === 'left' || from.side === 'right'
  const toHorizontal = to.side === 'left' || to.side === 'right'

  if (fromHorizontal && toHorizontal) {
    const midX = (fromStub.x + toStub.x) / 2
    return {
      d: `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} L ${midX} ${fromStub.y} L ${midX} ${toStub.y} L ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`,
      labelX: midX + 5,
      labelY: (fromStub.y + toStub.y) / 2 - 5,
    }
  }

  if (!fromHorizontal && !toHorizontal) {
    const midY = (fromStub.y + toStub.y) / 2
    return {
      d: `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} L ${fromStub.x} ${midY} L ${toStub.x} ${midY} L ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`,
      labelX: (fromStub.x + toStub.x) / 2 + 5,
      labelY: midY - 5,
    }
  }

  return {
    d: `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} L ${toStub.x} ${fromStub.y} L ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`,
    labelX: (fromStub.x + toStub.x) / 2 + 5,
    labelY: fromStub.y - 5,
  }
}

function segmentIntersectsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: { left: number; top: number; right: number; bottom: number },
) {
  if (a.x === b.x) {
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    return a.x > rect.left && a.x < rect.right && y2 > rect.top && y1 < rect.bottom
  }
  if (a.y === b.y) {
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    return a.y > rect.top && a.y < rect.bottom && x2 > rect.left && x1 < rect.right
  }
  return false
}

function segmentsOverlap(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  const aVertical = a1.x === a2.x
  const bVertical = b1.x === b2.x
  if (aVertical !== bVertical) return false

  if (aVertical) {
    if (Math.abs(a1.x - b1.x) > 2) return false
    const aMin = Math.min(a1.y, a2.y)
    const aMax = Math.max(a1.y, a2.y)
    const bMin = Math.min(b1.y, b2.y)
    const bMax = Math.max(b1.y, b2.y)
    return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 4
  }

  if (Math.abs(a1.y - b1.y) > 2) return false
  const aMin = Math.min(a1.x, a2.x)
  const aMax = Math.max(a1.x, a2.x)
  const bMin = Math.min(b1.x, b2.x)
  const bMax = Math.max(b1.x, b2.x)
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 4
}

export default function FactoryDesigner({
  lang,
  steps,
  resources,
  maxBeltTier,
  tier,
  clockControlUnlocked,
  onResourceChange,
  layout,
  onChange,
}: Props) {
  const normalized = normalizeLayout(layout)
  const [activeFloorId, setActiveFloorId] = useState(normalized.floors[0].id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedUtilityId, setSelectedUtilityId] = useState<string | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedLiftId, setSelectedLiftId] = useState<string | null>(null)
  const [selectedBeltId, setSelectedBeltId] = useState<string | null>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<DesignerEndpoint | null>(null)
  const [beltToolActive, setBeltToolActive] = useState(false)
  const [defaultBeltTier, setDefaultBeltTier] = useState<BeltTier>('mk1')
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 48, y: 48 })
  const [isPanning, setIsPanning] = useState(false)
  const [panAnchor, setPanAnchor] = useState({ x: 0, y: 0 })
  const [fitAfterLayout, setFitAfterLayout] = useState(false)

  const activeFloor =
    normalized.floors.find((floor) => floor.id === activeFloorId) ??
    normalized.floors[0]

  useEffect(() => {
    if (!normalized.floors.some((floor) => floor.id === activeFloorId)) {
      setActiveFloorId(normalized.floors[0].id)
      setSelectedId(null)
      setSelectedUtilityId(null)
      setSelectedSourceId(null)
      setSelectedLiftId(null)
    }
  }, [layout, activeFloorId])

  const activeNodes = normalized.nodes.filter(
    (node) => (node.floorId ?? normalized.floors[0].id) === activeFloor.id,
  )
  const activeSources = normalized.sources.filter(
    (source) => source.floorId === activeFloor.id,
  )
  const activeUtilities = normalized.utilities.filter(
    (utility) => utility.floorId === activeFloor.id,
  )
  const activeBelts = normalized.belts.filter(
    (belt) => belt.floorId === activeFloor.id,
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
    utilities = normalized.utilities,
    belts = normalized.belts,
    sources = normalized.sources,
  ) => {
    onChange({ nodes, floors, lifts, utilities, belts, sources })
  }

  const stepForNode = (nodeId: string) => {
    const node = normalized.nodes.find((entry) => entry.id === nodeId)
    if (!node) return null
    return (
      steps.find(
        (step) =>
          step.item === node.itemId &&
          step.recipe.producedIn === node.machineId,
      ) ?? null
    )
  }

  const portCounts = (endpoint: DesignerEndpoint) => {
    if (endpoint.kind === 'source') return { input: 0, output: 1 }
    if (endpoint.kind === 'utility') {
      const utility = normalized.utilities.find((entry) => entry.id === endpoint.id)
      if (!utility) return { input: 1, output: 1 }
      return utility.kind === 'splitter'
        ? { input: 1, output: 3 }
        : { input: 3, output: 1 }
    }

    const step = stepForNode(endpoint.id)
    return {
      input: Math.max(1, step?.recipe.ingredients.length ?? 1),
      output: Math.max(1, step?.recipe.products.length ?? 1),
    }
  }

  const portPoint = (endpoint: DesignerEndpoint): PortPoint | null => {
    const role = endpoint.side ?? 'output'
    const counts = portCounts(endpoint)
    const portIndex = Math.max(
      0,
      Math.min((role === 'input' ? counts.input : counts.output) - 1, endpoint.port ?? 0),
    )

    if (endpoint.kind === 'source') {
      const source = normalized.sources.find((entry) => entry.id === endpoint.id)
      if (!source) return null
      const rect = sourceRect(source)
      const rectPx = {
        left: rect.left * PIXELS_PER_METER,
        top: rect.top * PIXELS_PER_METER,
        right: rect.right * PIXELS_PER_METER,
        bottom: rect.bottom * PIXELS_PER_METER,
      }
      return distributedPoint(rectPx, 'right', 0, 1)
    }

    if (endpoint.kind === 'node') {
      const node = normalized.nodes.find((entry) => entry.id === endpoint.id)
      if (!node) return null
      const rect = rectFor(node)
      const rectPx = {
        left: rect.left * PIXELS_PER_METER,
        top: rect.top * PIXELS_PER_METER,
        right: rect.right * PIXELS_PER_METER,
        bottom: rect.bottom * PIXELS_PER_METER,
      }
      const side = sideFor(role, node.rotation)
      return distributedPoint(
        rectPx,
        side,
        portIndex,
        role === 'input' ? counts.input : counts.output,
      )
    }

    const utility = normalized.utilities.find((entry) => entry.id === endpoint.id)
    if (!utility) return null
    const rect = utilityRect(utility)
    const rectPx = {
      left: rect.left * PIXELS_PER_METER,
      top: rect.top * PIXELS_PER_METER,
      right: rect.right * PIXELS_PER_METER,
      bottom: rect.bottom * PIXELS_PER_METER,
    }
    const side = utilityPortSide(
      utility.kind,
      role,
      portIndex,
      utility.rotation,
    )
    return sideCenterPoint(rectPx, side)
  }

  const fits = (
    candidate: DesignerNode,
    nodes = normalized.nodes,
    ignoreId?: string,
  ) => {
    const rect = rectFor(candidate)
    const machineCollision = nodes.some((node) => {
      if (node.id === ignoreId) return false
      if ((node.floorId ?? normalized.floors[0].id) !== candidate.floorId) return false
      return overlaps(rect, rectFor(node))
    })
    if (machineCollision) return false

    if (normalized.utilities.some((utility) => {
      if (utility.floorId !== candidate.floorId) return false
      return overlaps(rect, utilityRect(utility))
    })) return false

    return !normalized.sources.some((source) => {
      if (source.floorId !== candidate.floorId) return false
      return overlaps(rect, sourceRect(source))
    })
  }

  const utilityFits = (candidate: DesignerUtility, ignoreId?: string) => {
    const rect = utilityRect(candidate)
    const utilityCollision = normalized.utilities.some((utility) => {
      if (utility.id === ignoreId || utility.floorId !== candidate.floorId) return false
      return overlaps(rect, utilityRect(utility))
    })
    if (utilityCollision) return false

    if (normalized.nodes.some((node) => {
      if ((node.floorId ?? normalized.floors[0].id) !== candidate.floorId) return false
      return overlaps(rect, rectFor(node))
    })) return false

    return !normalized.sources.some((source) => {
      if (source.floorId !== candidate.floorId) return false
      return overlaps(rect, sourceRect(source))
    })
  }

  const findFreeSpot = (
    machineId: string,
    itemId: string,
    nodes: DesignerNode[],
    floorId: string,
    rotation: DesignerNode['rotation'] = 0,
  ) => {
    for (let y = 0; y < AUTO_SEARCH_H; y++) {
      for (let x = 0; x < AUTO_SEARCH_W; x++) {
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
    const spot = findFreeSpot(machineId, itemId, normalized.nodes, activeFloor.id)
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
    setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const addUtility = (kind: DesignerUtility['kind']) => {
    for (let y = 0; y < AUTO_SEARCH_H; y++) {
      for (let x = 0; x < AUTO_SEARCH_W; x++) {
        const utility: DesignerUtility = {
          id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind,
          x,
          y,
          floorId: activeFloor.id,
          rotation: 0,
        }
        if (!utilityFits(utility)) continue

        writeLayout(
          normalized.nodes,
          normalized.floors,
          normalized.lifts,
          [...normalized.utilities, utility],
        )
        setSelectedUtilityId(utility.id)
        setSelectedId(null)
        setPlacementError(null)
        return
      }
    }

    setPlacementError(
      lang === 'de'
        ? 'Kein freier Platz für dieses Förderobjekt.'
        : 'No free space for this conveyor object.',
    )
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
    setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const moveUtility = (id: string, x: number, y: number) => {
    const utility = normalized.utilities.find((entry) => entry.id === id)
    if (!utility) return
    const candidate = { ...utility, x, y, floorId: activeFloor.id }
    if (!utilityFits(candidate, id)) {
      setPlacementError(
        lang === 'de'
          ? 'Dort ist kein Platz für Splitter/Merger.'
          : 'There is no room for the splitter/merger there.',
      )
      return
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities.map((entry) => (entry.id === id ? candidate : entry)),
    )
    setSelectedUtilityId(id)
    setSelectedId(null)
    setPlacementError(null)
  }

  const removeSource = (id: string) => {
    const endpoint: DesignerEndpoint = { kind: 'source', id }
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      removeEndpointBelts(endpoint),
      normalized.sources.filter((source) => source.id !== id),
    )
    if (selectedSourceId === id) setSelectedSourceId(null)
    setPlacementError(null)
  }

  const moveSource = (id: string, x: number, y: number) => {
    const source = normalized.sources.find((entry) => entry.id === id)
    if (!source) return

    const candidate = { ...source, x, y, floorId: activeFloor.id }
    const rect = sourceRect(candidate)

    const blocked =
      normalized.nodes.some((node) =>
        (node.floorId ?? normalized.floors[0].id) === activeFloor.id &&
        overlaps(rect, rectFor(node))
      ) ||
      normalized.utilities.some((utility) =>
        utility.floorId === activeFloor.id &&
        overlaps(rect, utilityRect(utility))
      ) ||
      normalized.sources.some((entry) =>
        entry.id !== id &&
        entry.floorId === activeFloor.id &&
        overlaps(rect, sourceRect(entry))
      )

    if (blocked) {
      setPlacementError(
        lang === 'de'
          ? 'Dort ist kein freier Platz für die Mine.'
          : 'There is no free space for the miner there.',
      )
      return
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      normalized.belts,
      normalized.sources.map((entry) => entry.id === id ? candidate : entry),
    )
    setSelectedSourceId(id)
    setSelectedId(null)
    setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const moveLift = (id: string, x: number, y: number) => {
    const lift = normalized.lifts.find((entry) => entry.id === id)
    if (!lift) return

    const clampedX = x
    const clampedY = y

    const occupied = normalized.lifts.some(
      (entry) =>
        entry.id !== id &&
        entry.x === clampedX &&
        entry.y === clampedY &&
        (
          entry.fromFloorId === activeFloor.id ||
          entry.toFloorId === activeFloor.id
        ),
    )

    if (occupied) {
      setPlacementError(
        lang === 'de'
          ? 'An dieser Position befindet sich bereits ein Conveyor Lift.'
          : 'There is already a conveyor lift at this position.',
      )
      return
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts.map((entry) =>
        entry.id === id
          ? { ...entry, x: clampedX, y: clampedY }
          : entry,
      ),
    )
    setSelectedLiftId(id)
    setSelectedId(null)
    setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const removeLift = (id: string) => {
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts.filter((lift) => lift.id !== id),
      normalized.utilities,
      normalized.belts,
      normalized.sources,
    )
    if (selectedLiftId === id) setSelectedLiftId(null)
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

  const rotateUtility = (id: string) => {
    const utility = normalized.utilities.find((entry) => entry.id === id)
    if (!utility) return
    const rotation = ((utility.rotation + 90) % 360) as DesignerUtility['rotation']
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities.map((entry) =>
        entry.id === id ? { ...entry, rotation } : entry,
      ),
    )
  }

  const removeEndpointBelts = (endpoint: DesignerEndpoint) =>
    normalized.belts.filter(
      (belt) =>
        !(belt.from.kind === endpoint.kind && belt.from.id === endpoint.id) &&
        !(belt.to.kind === endpoint.kind && belt.to.id === endpoint.id),
    )

  const removeNode = (id: string) => {
    writeLayout(
      normalized.nodes.filter((node) => node.id !== id),
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      removeEndpointBelts({ kind: 'node', id }),
    )
    if (selectedId === id) setSelectedId(null)
    setPlacementError(null)
  }

  const removeUtility = (id: string) => {
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities.filter((utility) => utility.id !== id),
      removeEndpointBelts({ kind: 'utility', id }),
    )
    if (selectedUtilityId === id) setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const materialForEndpoint = (
    endpoint: DesignerEndpoint,
    visited = new Set<string>(),
  ): string | undefined => {
    const key = `${endpoint.kind}:${endpoint.id}`
    if (visited.has(key)) return undefined
    visited.add(key)

    if (endpoint.kind === 'source') {
      return normalized.sources.find((source) => source.id === endpoint.id)?.resourceId
    }

    if (endpoint.kind === 'node') {
      const node = normalized.nodes.find((entry) => entry.id === endpoint.id)
      if (!node) return undefined
      if ((endpoint.side ?? 'output') === 'output') return node.itemId

      const step = stepForNode(endpoint.id)
      return step?.recipe.ingredients[endpoint.port ?? 0]?.item
    }

    const incoming = normalized.belts.find(
      (belt) => belt.to.kind === 'utility' && belt.to.id === endpoint.id,
    )
    if (incoming?.materialId) return incoming.materialId
    if (incoming) return materialForEndpoint(incoming.from, visited)
    return undefined
  }

  const connectTo = (target: DesignerEndpoint) => {
    const normalizedTarget = normalizeEndpoint(
      target,
      connectFrom ? 'input' : 'output',
    )

    if (!connectFrom) {
      if (!beltToolActive && normalizedTarget.side !== 'output') {
        setBeltToolActive(true)
      }
      if (normalizedTarget.side !== 'output') {
        setPlacementError(
          lang === 'de'
            ? 'Eine Verbindung muss an einem Ausgang starten.'
            : 'A connection must start at an output port.',
        )
        return
      }
      setConnectFrom(normalizedTarget)
      setBeltToolActive(true)
      setPlacementError(null)
      return
    }

    if (normalizedTarget.side !== 'input') {
      setPlacementError(
        lang === 'de'
          ? 'Wähle jetzt einen Eingangs-Port als Ziel.'
          : 'Now choose an input port as the target.',
      )
      return
    }

    if (
      connectFrom.kind === normalizedTarget.kind &&
      connectFrom.id === normalizedTarget.id
    ) {
      setPlacementError(
        lang === 'de'
          ? 'Ein Objekt kann nicht mit sich selbst verbunden werden.'
          : 'An object cannot be connected to itself.',
      )
      return
    }

    const exists = normalized.belts.some(
      (belt) =>
        endpointKey(belt.from) === endpointKey(connectFrom) &&
        endpointKey(belt.to) === endpointKey(normalizedTarget),
    )

    if (exists) {
      setPlacementError(
        lang === 'de'
          ? 'Diese Port-Verbindung existiert bereits.'
          : 'This port connection already exists.',
      )
      setConnectFrom(null)
      return
    }

    const belt: DesignerBelt = {
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      floorId: activeFloor.id,
      from: connectFrom,
      to: normalizedTarget,
      tier: defaultBeltTier,
      materialId: materialForEndpoint(connectFrom),
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      [...normalized.belts, belt],
    )
    setConnectFrom(null)
    setBeltToolActive(false)
    setPlacementError(null)
  }

  const updateBelt = (id: string, patch: Partial<DesignerBelt>) => {
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      normalized.belts.map((belt) =>
        belt.id === id ? { ...belt, ...patch } : belt,
      ),
    )
  }

  const removeBelt = (id: string) => {
    writeLayout(
      normalized.nodes,
      normalized.floors,
      normalized.lifts,
      normalized.utilities,
      normalized.belts.filter((belt) => belt.id !== id),
    )
    if (selectedBeltId === id) setSelectedBeltId(null)
  }

  const addBeltWaypoint = (id: string) => {
    const belt = normalized.belts.find((entry) => entry.id === id)
    if (!belt) return
    const from = portPoint(belt.from)
    const to = portPoint(belt.to)
    if (!from || !to) return

    const existing = belt.waypoints ?? []
    const points = [
      { x: from.x / PIXELS_PER_METER, y: from.y / PIXELS_PER_METER },
      ...existing,
      { x: to.x / PIXELS_PER_METER, y: to.y / PIXELS_PER_METER },
    ]

    let longestIndex = 0
    let longestDistance = -1
    for (let i = 0; i < points.length - 1; i += 1) {
      const dx = points[i + 1].x - points[i].x
      const dy = points[i + 1].y - points[i].y
      const distance = Math.hypot(dx, dy)
      if (distance > longestDistance) {
        longestDistance = distance
        longestIndex = i
      }
    }

    const a = points[longestIndex]
    const b = points[longestIndex + 1]
    const waypoint = {
      x: Math.round(((a.x + b.x) / 2) * 2) / 2,
      y: Math.round(((a.y + b.y) / 2) * 2) / 2,
    }

    const next = [...existing]
    next.splice(longestIndex, 0, waypoint)
    updateBelt(id, { waypoints: next })
  }

  const moveBeltWaypoint = (
    beltId: string,
    index: number,
    x: number,
    y: number,
  ) => {
    const belt = normalized.belts.find((entry) => entry.id === beltId)
    if (!belt) return
    const next = [...(belt.waypoints ?? [])]
    if (!next[index]) return
    next[index] = {
      x: Math.round(x * 2) / 2,
      y: Math.round(y * 2) / 2,
    }
    updateBelt(beltId, { waypoints: next })
  }

  const removeBeltWaypoint = (beltId: string, index: number) => {
    const belt = normalized.belts.find((entry) => entry.id === beltId)
    if (!belt) return
    updateBelt(beltId, {
      waypoints: (belt.waypoints ?? []).filter((_, i) => i !== index),
    })
  }

  const generateFromPlan = () => {
    setPlacementError(null)

    const keepNodes = normalized.nodes.filter(
      (node) => (node.floorId ?? normalized.floors[0].id) !== activeFloor.id,
    )
    const keepSources = normalized.sources.filter(
      (source) => source.floorId !== activeFloor.id,
    )
    const keepUtilities = normalized.utilities.filter(
      (utility) => utility.floorId !== activeFloor.id,
    )
    const keepBelts = normalized.belts.filter(
      (belt) => belt.floorId !== activeFloor.id,
    )

    const generatedNodes: DesignerNode[] = []
    const generatedSources: DesignerSource[] = []
    const generatedUtilities: DesignerUtility[] = []
    const generatedBelts: DesignerBelt[] = []

    const maxBeltRank = Number(maxBeltTier.slice(2))
    const beltTierFor = (rate: number): BeltTier => {
      const tiers = (Object.keys(beltRates) as BeltTier[])
        .filter((tier) => Number(tier.slice(2)) <= maxBeltRank)
        .sort((a, b) => beltRates[a] - beltRates[b])
      return (
        tiers.find((tier) => beltRates[tier] + 0.001 >= rate) ??
        tiers[tiers.length - 1] ??
        'mk1'
      )
    }

    const addBelt = (
      from: DesignerEndpoint,
      to: DesignerEndpoint,
      rate: number,
      materialId: string,
    ) => {
      generatedBelts.push({
        id: `auto-belt-${generatedBelts.length}-${Date.now()}`,
        floorId: activeFloor.id,
        from,
        to,
        tier: beltTierFor(rate),
        materialId,
      })
    }

    const recipeOutputPerMinute = (step: MachineStep, machineIndex: number) => {
      const product =
        step.recipe.products.find((part) => part.item === step.item) ??
        step.recipe.products[0]
      if (!product || step.recipe.time <= 0) return 0
      const clock = step.clocks[machineIndex] ?? 100
      return product.amount * (60 / step.recipe.time) * (clock / 100)
    }

    const recipeInputPerMinute = (
      step: MachineStep,
      ingredientIndex: number,
      machineIndex: number,
    ) => {
      const ingredient = step.recipe.ingredients[ingredientIndex]
      if (!ingredient || step.recipe.time <= 0) return 0
      const clock = step.clocks[machineIndex] ?? 100
      return ingredient.amount * (60 / step.recipe.time) * (clock / 100)
    }

    const stepByItem = new Map(steps.map((step) => [step.item, step]))
    const depthMemo = new Map<string, number>()
    const depthFor = (itemId: string, trail = new Set<string>()): number => {
      if (depthMemo.has(itemId)) return depthMemo.get(itemId)!
      if (trail.has(itemId)) return 1
      const step = stepByItem.get(itemId)
      if (!step) return 0
      const nextTrail = new Set(trail)
      nextTrail.add(itemId)
      const upstream = step.recipe.ingredients.map((input) =>
        stepByItem.has(input.item) ? depthFor(input.item, nextTrail) : 0,
      )
      const depth = 1 + (upstream.length ? Math.max(...upstream) : 0)
      depthMemo.set(itemId, depth)
      return depth
    }

    const orderedSteps = [...steps].sort(
      (a, b) => depthFor(a.item) - depthFor(b.item),
    )

    // Sources form the left-most column and are centered vertically.
    const totalSources = resources.reduce(
      (sum, resource) => sum + Math.max(1, resource.config.count || 1),
      0,
    )
    let sourceCursor = -Math.floor(totalSources / 2)
    for (const resource of resources) {
      const count = Math.max(1, resource.config.count || 1)
      const perSource = resource.usedRate / count
      const output = resourceOutput(
        resource.id,
        { ...resource.config, count: 1 },
        clockControlUnlocked,
      )
      const capacityPerSource = output.available
      for (let i = 0; i < count; i += 1) {
        generatedSources.push({
          id: `source-${resource.id}-${i}-${Date.now()}`,
          resourceId: resource.id,
          miner: resource.config.miner,
          rate: perSource,
          capacityRate: capacityPerSource,
          x: 0,
          y: sourceCursor * 2,
          floorId: activeFloor.id,
        })
        sourceCursor += 1
      }
    }

    // Arrange each production depth as one clean vertical machine column.
    const stepsByDepth = new Map<number, MachineStep[]>()
    for (const step of orderedSteps) {
      const depth = depthFor(step.item)
      const list = stepsByDepth.get(depth) ?? []
      list.push(step)
      stepsByDepth.set(depth, list)
    }

    const nodeGroups = new Map<string, DesignerNode[]>()
    const machineIndexByNode = new Map<string, number>()

    for (const [depth, stageSteps] of [...stepsByDepth.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const descriptors: Array<{
        step: MachineStep
        machineIndex: number
        height: number
      }> = []

      for (const step of stageSteps) {
        for (let i = 0; i < step.machines; i += 1) {
          const size = footprintFor(step.recipe.producedIn)
          descriptors.push({
            step,
            machineIndex: i,
            height: Math.max(1, Math.ceil(size.lengthM / FOUNDATION_METERS)),
          })
        }
      }

      const totalHeight =
        descriptors.reduce((sum, entry) => sum + entry.height, 0) +
        Math.max(0, descriptors.length - 1)

      let yCursor = -Math.floor(totalHeight / 2)
      const x = 4 + (depth - 1) * 6

      for (const descriptor of descriptors) {
        const { step, machineIndex, height } = descriptor
        const node: DesignerNode = {
          id: `auto-${step.recipe.producedIn}-${step.item}-${machineIndex}-${Date.now()}`,
          machineId: step.recipe.producedIn,
          itemId: step.item,
          x,
          y: yCursor,
          floorId: activeFloor.id,
          rotation: 0,
        }
        generatedNodes.push(node)
        machineIndexByNode.set(node.id, machineIndex)
        const group = nodeGroups.get(step.item) ?? []
        group.push(node)
        nodeGroups.set(step.item, group)
        yCursor += height + 1
      }
    }

    const utilityFree = (candidate: DesignerUtility) => {
      const rect = utilityRect(candidate)
      if (generatedNodes.some((node) => overlaps(rect, rectFor(node)))) return false
      if (generatedSources.some((source) => overlaps(rect, sourceRect(source)))) return false
      return !generatedUtilities.some((utility) =>
        overlaps(rect, utilityRect(utility)),
      )
    }

    const addAutoUtilityNear = (
      kind: DesignerUtility['kind'],
      preferredX: number,
      preferredY: number,
    ) => {
      const offsets: Array<[number, number]> = [[0, 0]]
      for (let radius = 1; radius <= 8; radius += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          offsets.push([dx, -radius], [dx, radius])
        }
        for (let dy = -radius + 1; dy < radius; dy += 1) {
          offsets.push([-radius, dy], [radius, dy])
        }
      }

      for (const [dx, dy] of offsets) {
        const utility: DesignerUtility = {
          id: `auto-${kind}-${generatedUtilities.length}-${Date.now()}`,
          kind,
          x: Math.round(preferredX + dx),
          y: Math.round(preferredY + dy),
          floorId: activeFloor.id,
          rotation: 0,
        }
        if (!utilityFree(utility)) continue
        generatedUtilities.push(utility)
        return utility
      }
      return null
    }

    const centerOfEndpoint = (endpoint: DesignerEndpoint) => {
      if (endpoint.kind === 'source') {
        const source = generatedSources.find((entry) => entry.id === endpoint.id)
        return source
          ? { x: source.x + 0.5, y: source.y + 0.5 }
          : { x: 0, y: 0 }
      }
      if (endpoint.kind === 'node') {
        const node = generatedNodes.find((entry) => entry.id === endpoint.id)
        if (!node) return { x: 0, y: 0 }
        const size = footprintFor(node.machineId)
        return {
          x: node.x + size.widthM / FOUNDATION_METERS / 2,
          y: node.y + size.lengthM / FOUNDATION_METERS / 2,
        }
      }
      const utility = generatedUtilities.find((entry) => entry.id === endpoint.id)
      return utility
        ? { x: utility.x + 0.25, y: utility.y + 0.25 }
        : { x: 0, y: 0 }
    }

    type FlowPoint = {
      endpoint: DesignerEndpoint
      rate: number
    }

    type Allocation = {
      from: FlowPoint
      to: FlowPoint
      rate: number
      fromEndpoint?: DesignerEndpoint
    }

    const producersByItem = new Map<string, FlowPoint[]>()
    for (const source of generatedSources) {
      const list = producersByItem.get(source.resourceId) ?? []
      list.push({
        endpoint: {
          kind: 'source',
          id: source.id,
          side: 'output',
          port: 0,
        },
        rate: source.rate,
      })
      producersByItem.set(source.resourceId, list)
    }

    for (const [itemId, nodes] of nodeGroups) {
      const step = stepByItem.get(itemId)
      if (!step) continue
      const list: FlowPoint[] = []
      for (const node of nodes) {
        const index = machineIndexByNode.get(node.id) ?? 0
        list.push({
          endpoint: {
            kind: 'node',
            id: node.id,
            side: 'output',
            port: 0,
          },
          rate: recipeOutputPerMinute(step, index),
        })
      }
      producersByItem.set(itemId, list)
    }

    const consumersByItem = new Map<string, FlowPoint[]>()
    for (const step of orderedSteps) {
      const nodes = nodeGroups.get(step.item) ?? []
      for (const node of nodes) {
        const machineIndex = machineIndexByNode.get(node.id) ?? 0
        step.recipe.ingredients.forEach((ingredient, ingredientIndex) => {
          const list = consumersByItem.get(ingredient.item) ?? []
          list.push({
            endpoint: {
              kind: 'node',
              id: node.id,
              side: 'input',
              port: ingredientIndex,
            },
            rate: recipeInputPerMinute(
              step,
              ingredientIndex,
              machineIndex,
            ),
          })
          consumersByItem.set(ingredient.item, list)
        })
      }
    }

    const endpointObjectKey = (endpoint: DesignerEndpoint) =>
      `${endpoint.kind}:${endpoint.id}:${endpoint.side}:${endpoint.port ?? 0}`

    // Split one producer locally only when it really feeds multiple consumers.
    const buildSplitterOutputs = (
      source: FlowPoint,
      allocations: Allocation[],
      materialId: string,
    ) => {
      if (allocations.length === 1) {
        allocations[0].fromEndpoint = source.endpoint
        return
      }

      const sourcePos = centerOfEndpoint(source.endpoint)
      const averageTargetY =
        allocations.reduce(
          (sum, allocation) => sum + centerOfEndpoint(allocation.to.endpoint).y,
          0,
        ) / allocations.length

      const createTree = (
        input: DesignerEndpoint,
        batch: Allocation[],
        x: number,
        y: number,
        incomingRate: number,
      ) => {
        if (batch.length === 1) {
          batch[0].fromEndpoint = input
          return
        }

        const splitter = addAutoUtilityNear('splitter', x, y)
        if (!splitter) {
          batch.forEach((allocation) => {
            allocation.fromEndpoint = input
          })
          return
        }

        addBelt(
          input,
          { kind: 'utility', id: splitter.id, side: 'input', port: 0 },
          incomingRate,
          materialId,
        )

        if (batch.length <= 3) {
          batch.forEach((allocation, port) => {
            allocation.fromEndpoint = {
              kind: 'utility',
              id: splitter.id,
              side: 'output',
              port,
            }
          })
          return
        }

        batch.slice(0, 2).forEach((allocation, port) => {
          allocation.fromEndpoint = {
            kind: 'utility',
            id: splitter.id,
            side: 'output',
            port,
          }
        })

        const rest = batch.slice(2)
        createTree(
          {
            kind: 'utility',
            id: splitter.id,
            side: 'output',
            port: 2,
          },
          rest,
          x + 1,
          rest.reduce(
            (sum, allocation) => sum + centerOfEndpoint(allocation.to.endpoint).y,
            0,
          ) / rest.length,
          rest.reduce((sum, allocation) => sum + allocation.rate, 0),
        )
      }

      createTree(
        source.endpoint,
        allocations,
        sourcePos.x + 1.5,
        (sourcePos.y + averageTargetY) / 2,
        allocations.reduce((sum, allocation) => sum + allocation.rate, 0),
      )
    }

    // Merge locally only when one consumer genuinely needs multiple producers.
    const connectIntoConsumer = (
      consumer: FlowPoint,
      allocations: Allocation[],
      materialId: string,
    ) => {
      const valid = allocations.filter((allocation) => allocation.fromEndpoint)
      if (!valid.length) return

      if (valid.length === 1) {
        addBelt(
          valid[0].fromEndpoint!,
          consumer.endpoint,
          valid[0].rate,
          materialId,
        )
        return
      }

      const consumerPos = centerOfEndpoint(consumer.endpoint)

      const mergeBatch = (
        batch: Allocation[],
        x: number,
        y: number,
      ): { endpoint: DesignerEndpoint; rate: number } | null => {
        if (batch.length === 1) {
          return {
            endpoint: batch[0].fromEndpoint!,
            rate: batch[0].rate,
          }
        }

        const firstThree = batch.slice(0, 3)
        const merger = addAutoUtilityNear('merger', x, y)
        if (!merger) {
          return {
            endpoint: firstThree[0].fromEndpoint!,
            rate: firstThree[0].rate,
          }
        }

        firstThree.forEach((allocation, port) => {
          addBelt(
            allocation.fromEndpoint!,
            { kind: 'utility', id: merger.id, side: 'input', port },
            allocation.rate,
            materialId,
          )
        })

        const merged: Allocation = {
          from: {
            endpoint: {
              kind: 'utility',
              id: merger.id,
              side: 'output',
              port: 0,
            },
            rate: firstThree.reduce(
              (sum, allocation) => sum + allocation.rate,
              0,
            ),
          },
          to: consumer,
          rate: firstThree.reduce(
            (sum, allocation) => sum + allocation.rate,
            0,
          ),
          fromEndpoint: {
            kind: 'utility',
            id: merger.id,
            side: 'output',
            port: 0,
          },
        }

        if (batch.length <= 3) {
          return {
            endpoint: merged.fromEndpoint!,
            rate: merged.rate,
          }
        }

        return mergeBatch(
          [merged, ...batch.slice(3)],
          x + 1,
          y,
        )
      }

      const producerAverageX =
        valid.reduce(
          (sum, allocation) => sum + centerOfEndpoint(allocation.fromEndpoint!).x,
          0,
        ) / valid.length

      const merged = mergeBatch(
        valid,
        (producerAverageX + consumerPos.x) / 2,
        consumerPos.y,
      )

      if (merged) {
        addBelt(
          merged.endpoint,
          consumer.endpoint,
          merged.rate,
          materialId,
        )
      }
    }

    for (const [materialId, consumers] of consumersByItem) {
      const producers = producersByItem.get(materialId) ?? []
      if (!producers.length || !consumers.length) continue

      const sortedProducers = [...producers].sort(
        (a, b) => centerOfEndpoint(a.endpoint).y - centerOfEndpoint(b.endpoint).y,
      )
      const sortedConsumers = [...consumers].sort(
        (a, b) => centerOfEndpoint(a.endpoint).y - centerOfEndpoint(b.endpoint).y,
      )

      const producerRemaining = sortedProducers.map((point) => point.rate)
      const consumerRemaining = sortedConsumers.map((point) => point.rate)
      const allocations: Allocation[] = []

      let producerIndex = 0
      let consumerIndex = 0
      while (
        producerIndex < sortedProducers.length &&
        consumerIndex < sortedConsumers.length
      ) {
        const amount = Math.min(
          producerRemaining[producerIndex],
          consumerRemaining[consumerIndex],
        )

        if (amount > 0.0001) {
          allocations.push({
            from: sortedProducers[producerIndex],
            to: sortedConsumers[consumerIndex],
            rate: amount,
          })
          producerRemaining[producerIndex] -= amount
          consumerRemaining[consumerIndex] -= amount
        }

        if (producerRemaining[producerIndex] <= 0.0001) producerIndex += 1
        if (consumerRemaining[consumerIndex] <= 0.0001) consumerIndex += 1
      }

      const byProducer = new Map<string, Allocation[]>()
      for (const allocation of allocations) {
        const key = endpointObjectKey(allocation.from.endpoint)
        const list = byProducer.get(key) ?? []
        list.push(allocation)
        byProducer.set(key, list)
      }

      for (const producer of sortedProducers) {
        const group = byProducer.get(endpointObjectKey(producer.endpoint)) ?? []
        if (group.length) buildSplitterOutputs(producer, group, materialId)
      }

      const byConsumer = new Map<string, Allocation[]>()
      for (const allocation of allocations) {
        const key = endpointObjectKey(allocation.to.endpoint)
        const list = byConsumer.get(key) ?? []
        list.push(allocation)
        byConsumer.set(key, list)
      }

      for (const consumer of sortedConsumers) {
        const group = byConsumer.get(endpointObjectKey(consumer.endpoint)) ?? []
        if (group.length) connectIntoConsumer(consumer, group, materialId)
      }
    }

    writeLayout(
      [...keepNodes, ...generatedNodes],
      normalized.floors,
      normalized.lifts,
      [...keepUtilities, ...generatedUtilities],
      [...keepBelts, ...generatedBelts],
      [...keepSources, ...generatedSources],
    )

    const firstOnFloor = generatedNodes[0]
    setSelectedId(firstOnFloor?.id ?? null)
    setSelectedUtilityId(null)
    setSelectedSourceId(null)
    setSelectedLiftId(null)
    setConnectFrom(null)
    setBeltToolActive(false)
    setFitAfterLayout(true)
  }

  const addFloor = () => {
    const highest = Math.max(...normalized.floors.map((floor) => floor.elevationM))
    const id = `floor-${Date.now()}`
    const floor: DesignerFloor = {
      id,
      name: `Etage ${normalized.floors.length}`,
      elevationM: highest + DEFAULT_FLOOR_GAP_M,
    }

    writeLayout(normalized.nodes, [...normalized.floors, floor])
    setActiveFloorId(id)
    setSelectedId(null)
    setSelectedUtilityId(null)
    setPlacementError(null)
  }

  const deleteFloor = () => {
    if (normalized.floors.length <= 1) return
    const floor = activeFloor
    const remainingFloors = normalized.floors.filter((entry) => entry.id !== floor.id)
    const remainingNodes = normalized.nodes.filter((node) => node.floorId !== floor.id)
    const remainingUtilities = normalized.utilities.filter(
      (utility) => utility.floorId !== floor.id,
    )
    const remainingSources = normalized.sources.filter(
      (source) => source.floorId !== floor.id,
    )
    const remainingLifts = normalized.lifts.filter(
      (lift) =>
        lift.fromFloorId !== floor.id &&
        lift.toFloorId !== floor.id,
    )
    const remainingBelts = normalized.belts.filter(
      (belt) => belt.floorId !== floor.id,
    )

    writeLayout(
      remainingNodes,
      remainingFloors,
      remainingLifts,
      remainingUtilities,
      remainingBelts,
      remainingSources,
    )
    setActiveFloorId(remainingFloors[0].id)
    setSelectedId(null)
    setSelectedUtilityId(null)
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

    const lift: DesignerLift = {
      id: `lift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: 0,
      y: 0,
      fromFloorId: activeFloor.id,
      toFloorId: targetFloor.id,
    }

    writeLayout(
      normalized.nodes,
      normalized.floors,
      [...normalized.lifts, lift],
    )
  }

  const flowForEndpoint = (
    endpoint: DesignerEndpoint,
    visited = new Set<string>(),
  ): number => {
    const objectKey = `${endpoint.kind}:${endpoint.id}`
    if (visited.has(objectKey)) return 0
    visited.add(objectKey)

    if (endpoint.kind === 'source') {
      return normalized.sources.find((source) => source.id === endpoint.id)?.rate ?? 0
    }

    if (endpoint.kind === 'node') {
      const step = stepForNode(endpoint.id)
      return step ? step.actualOutputRate / Math.max(1, step.machines) : 0
    }

    const utility = normalized.utilities.find((entry) => entry.id === endpoint.id)
    if (!utility) return 0

    const incoming = normalized.belts.filter(
      (belt) =>
        belt.to.kind === 'utility' &&
        belt.to.id === utility.id,
    )
    const totalIn = incoming.reduce(
      (sum, belt) => sum + flowForEndpoint(belt.from, new Set(visited)),
      0,
    )

    if (utility.kind === 'merger') return totalIn

    const outgoingCount = Math.max(
      1,
      normalized.belts.filter(
        (belt) =>
          belt.from.kind === 'utility' &&
          belt.from.id === utility.id,
      ).length,
    )
    return totalIn / outgoingCount
  }

  const selected = normalized.nodes.find((node) => node.id === selectedId)
  const selectedUtility = normalized.utilities.find(
    (utility) => utility.id === selectedUtilityId,
  )
  const selectedSource =
    normalized.sources.find((source) => source.id === selectedSourceId) ?? null
  const selectedLift =
    normalized.lifts.find((lift) => lift.id === selectedLiftId) ?? null
  const selectedFootprint = selected ? footprintFor(selected.machineId) : null
  const selectedBelt =
    normalized.belts.find((belt) => belt.id === selectedBeltId) ?? null
  const hasSelection = Boolean(
    selected || selectedUtility || selectedSource || selectedLift || selectedBelt,
  )

  const endpointLabel = (endpoint: DesignerEndpoint) => {
    if (endpoint.kind === 'source') {
      const source = normalized.sources.find((entry) => entry.id === endpoint.id)
      if (!source) return 'Rohstoffquelle'
      return resourceMeta[source.resourceId]?.[lang] ?? itemName(source.resourceId, lang)
    }
    if (endpoint.kind === 'node') {
      const node = normalized.nodes.find((entry) => entry.id === endpoint.id)
      if (!node) return 'Maschine'
      return `${machineLabel(node.machineId)} · ${itemName(node.itemId, lang)}`
    }
    const utility = normalized.utilities.find((entry) => entry.id === endpoint.id)
    return utility?.kind === 'splitter' ? 'Splitter' : 'Merger'
  }

  const renderPorts = (
    endpointKind: DesignerEndpoint['kind'],
    id: string,
    rotation: DesignerNode['rotation'],
    rectM: { left: number; top: number; right: number; bottom: number },
  ) => {
    const counts = portCounts({ kind: endpointKind, id })
    const rectPx = {
      left: rectM.left * PIXELS_PER_METER,
      top: rectM.top * PIXELS_PER_METER,
      right: rectM.right * PIXELS_PER_METER,
      bottom: rectM.bottom * PIXELS_PER_METER,
    }

    return (
      <>
        {Array.from({ length: counts.input }).map((_, index) => {
          const utility = endpointKind === 'utility'
            ? normalized.utilities.find((entry) => entry.id === id)
            : undefined
          const point = utility
            ? sideCenterPoint(
                rectPx,
                utilityPortSide(utility.kind, 'input', index, rotation),
              )
            : distributedPoint(
                rectPx,
                sideFor('input', rotation),
                index,
                counts.input,
              )
          return (
            <i
              key={`in-${index}`}
              role="button"
              tabIndex={0}
              className="machine-port input-port"
              style={{
                left: point.x - rectPx.left - PORT_SIZE / 2,
                top: point.y - rectPx.top - PORT_SIZE / 2,
              }}
              title={`Input ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation()
                connectTo({
                  kind: endpointKind,
                  id,
                  side: 'input',
                  port: index,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  connectTo({
                    kind: endpointKind,
                    id,
                    side: 'input',
                    port: index,
                  })
                }
              }}
            ></i>
          )
        })}
        {Array.from({ length: counts.output }).map((_, index) => {
          const utility = endpointKind === 'utility'
            ? normalized.utilities.find((entry) => entry.id === id)
            : undefined
          const point = utility
            ? sideCenterPoint(
                rectPx,
                utilityPortSide(utility.kind, 'output', index, rotation),
              )
            : distributedPoint(
                rectPx,
                sideFor('output', rotation),
                index,
                counts.output,
              )
          const active =
            connectFrom &&
            endpointKey(connectFrom) ===
              endpointKey({
                kind: endpointKind,
                id,
                side: 'output',
                port: index,
              })

          return (
            <i
              key={`out-${index}`}
              role="button"
              tabIndex={0}
              className={`machine-port output-port ${active ? 'active' : ''}`}
              style={{
                left: point.x - rectPx.left - PORT_SIZE / 2,
                top: point.y - rectPx.top - PORT_SIZE / 2,
              }}
              title={`Output ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation()
                connectTo({
                  kind: endpointKind,
                  id,
                  side: 'output',
                  port: index,
                })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  connectTo({
                    kind: endpointKind,
                    id,
                    side: 'output',
                    port: index,
                  })
                }
              }}
            ></i>
          )
        })}
      </>
    )
  }


  const smartAutoRoutes = useMemo(() => {
    const result = new Map<string, ReturnType<typeof orthogonalPath>>()
    const occupied: Array<[
      { x: number; y: number },
      { x: number; y: number }
    ]> = []

    const obstacleRects = [
      ...activeNodes.map((node) => {
        const rect = rectFor(node)
        return {
          id: `node:${node.id}`,
          left: rect.left * PIXELS_PER_METER - 8,
          top: rect.top * PIXELS_PER_METER - 8,
          right: rect.right * PIXELS_PER_METER + 8,
          bottom: rect.bottom * PIXELS_PER_METER + 8,
        }
      }),
      ...activeSources.map((source) => {
        const rect = sourceRect(source)
        return {
          id: `source:${source.id}`,
          left: rect.left * PIXELS_PER_METER - 8,
          top: rect.top * PIXELS_PER_METER - 8,
          right: rect.right * PIXELS_PER_METER + 8,
          bottom: rect.bottom * PIXELS_PER_METER + 8,
        }
      }),
      ...activeUtilities.map((utility) => {
        const rect = utilityRect(utility)
        return {
          id: `utility:${utility.id}`,
          left: rect.left * PIXELS_PER_METER - 8,
          top: rect.top * PIXELS_PER_METER - 8,
          right: rect.right * PIXELS_PER_METER + 8,
          bottom: rect.bottom * PIXELS_PER_METER + 8,
        }
      }),
    ]

    for (const belt of activeBelts) {
      if (belt.waypoints?.length) continue
      const from = portPoint(belt.from)
      const to = portPoint(belt.to)
      if (!from || !to) continue

      const fromStub = pushPoint(from, PORT_STUB)
      const toStub = pushPoint(to, PORT_STUB)
      const baseX = (fromStub.x + toStub.x) / 2

      const candidates = [
        0, 18, -18, 36, -36, 54, -54, 72, -72, 96, -96, 128, -128,
      ].map((offset) => baseX + offset)

      let best:
        | {
            score: number
            route: ReturnType<typeof orthogonalPath>
            segments: Array<[
              { x: number; y: number },
              { x: number; y: number }
            ]>
          }
        | null = null

      for (const channelX of candidates) {
        const points = [
          { x: from.x, y: from.y },
          { x: fromStub.x, y: fromStub.y },
          { x: channelX, y: fromStub.y },
          { x: channelX, y: toStub.y },
          { x: toStub.x, y: toStub.y },
          { x: to.x, y: to.y },
        ]

        const segments = points.slice(0, -1).map(
          (point, index) =>
            [point, points[index + 1]] as [
              { x: number; y: number },
              { x: number; y: number },
            ],
        )

        let score = Math.abs(channelX - baseX) * 0.15

        const sourceKey = `${belt.from.kind}:${belt.from.id}`
        const targetKey = `${belt.to.kind}:${belt.to.id}`

        for (const segment of segments) {
          for (const rect of obstacleRects) {
            if (rect.id === sourceKey || rect.id === targetKey) continue
            if (segmentIntersectsRect(segment[0], segment[1], rect)) {
              score += 10000
            }
          }

          for (const used of occupied) {
            if (segmentsOverlap(segment[0], segment[1], used[0], used[1])) {
              score += 300
            }
          }
        }

        const route = {
          d: pointsToPath(points, false),
          labelX: channelX + 4,
          labelY: (fromStub.y + toStub.y) / 2 - 4,
        }

        if (!best || score < best.score) {
          best = { score, route, segments }
        }
      }

      if (best) {
        result.set(belt.id, best.route)
        occupied.push(...best.segments)
      }
    }

    return result
  }, [
    activeBelts,
    activeNodes,
    activeSources,
    activeUtilities,
    normalized.nodes,
    normalized.sources,
    normalized.utilities,
  ])

  const setZoomAround = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom))
    if (!viewport || clientX == null || clientY == null) {
      setZoom(clamped)
      return
    }

    const rect = viewport.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const worldX = (localX - pan.x) / zoom
    const worldY = (localY - pan.y) / zoom

    setPan({
      x: localX - worldX * clamped,
      y: localY - worldY * clamped,
    })
    setZoom(clamped)
  }

  const fitView = () => {
    const viewport = viewportRef.current
    if (!viewport) return

    const rects = [
      ...activeNodes.map(rectFor),
      ...activeSources.map(sourceRect),
      ...activeUtilities.map(utilityRect),
      ...floorLifts.map((lift) => ({
        left: lift.x * FOUNDATION_METERS,
        top: lift.y * FOUNDATION_METERS,
        right: lift.x * FOUNDATION_METERS + FOUNDATION_METERS,
        bottom: lift.y * FOUNDATION_METERS + FOUNDATION_METERS,
      })),
    ]

    if (!rects.length) {
      setZoom(0.8)
      setPan({ x: 48, y: 48 })
      return
    }

    const minX = Math.min(...rects.map((rect) => rect.left)) * PIXELS_PER_METER
    const minY = Math.min(...rects.map((rect) => rect.top)) * PIXELS_PER_METER
    const maxX = Math.max(...rects.map((rect) => rect.right)) * PIXELS_PER_METER
    const maxY = Math.max(...rects.map((rect) => rect.bottom)) * PIXELS_PER_METER
    const contentW = Math.max(CELL_PX, maxX - minX)
    const contentH = Math.max(CELL_PX, maxY - minY)
    const padding = 80

    const nextZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        1.25,
        (viewport.clientWidth - padding * 2) / contentW,
        (viewport.clientHeight - padding * 2) / contentH,
      ),
    )

    setZoom(nextZoom)
    setPan({
      x: (viewport.clientWidth - contentW * nextZoom) / 2 - minX * nextZoom,
      y: (viewport.clientHeight - contentH * nextZoom) / 2 - minY * nextZoom,
    })
  }

  const zoomLabel = `${Math.round(zoom * 100)}%`

  useEffect(() => {
    if (!fitAfterLayout) return
    const frame = requestAnimationFrame(() => {
      fitView()
      setFitAfterLayout(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [layout, fitAfterLayout])

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
                setSelectedUtilityId(null)
                setSelectedSourceId(null)
                setSelectedLiftId(null)
                setSelectedBeltId(null)
                setConnectFrom(null)
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

      <section className={`designer-shell ${hasSelection ? 'has-selection' : ''}`}>
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
          </div>

          <div className="conveyor-tools">
            <span className="eyebrow">
              {lang === 'de' ? 'Fördertechnik' : 'Conveyors'}
            </span>
            <div className="conveyor-tool-grid">
              <button
                className={`action-button ${beltToolActive ? 'tool-active' : ''}`}
                onClick={() => {
                  if (beltToolActive) {
                    setConnectFrom(null)
                    setBeltToolActive(false)
                  } else {
                    setConnectFrom(null)
                    setBeltToolActive(true)
                    setPlacementError(null)
                  }
                }}
              >
                <Unplug size={15} />
                {lang === 'de' ? 'Förderband setzen' : 'Place conveyor belt'}
              </button>
              <button className="action-button" onClick={() => addUtility('splitter')}>
                <GitFork size={15} /> Splitter
              </button>
              <button className="action-button" onClick={() => addUtility('merger')}>
                <Merge size={15} /> Merger
              </button>
              <button className="action-button" onClick={addLift}>
                <ArrowDownUp size={15} /> Lift
              </button>
            </div>
            <label>
              {lang === 'de' ? 'Neue Förderbänder' : 'New conveyor belts'}
              <select
                value={defaultBeltTier}
                onChange={(e) => setDefaultBeltTier(e.target.value as BeltTier)}
              >
                {(Object.keys(beltRates) as BeltTier[])
                  .filter((tier) => Number(tier.slice(2)) <= Number(maxBeltTier.slice(2)))
                  .map((tier) => (
                  <option key={tier} value={tier}>
                    Mk.{tier.slice(2)} · {beltRates[tier]}/min
                  </option>
                ))}
              </select>
            </label>

            {beltToolActive && (
              <div className="connect-mode">
                <Unplug size={15} />
                <span>
                  {connectFrom
                    ? (lang === 'de'
                      ? 'Ausgang gewählt – jetzt einen grünen Eingangs-Port anklicken.'
                      : 'Output selected – now click a green input port.')
                    : (lang === 'de'
                      ? 'Förderband-Modus aktiv – zuerst einen orangenen Ausgang anklicken.'
                      : 'Conveyor mode active – click an orange output port first.')}
                </span>
                <button
                  onClick={() => {
                    setConnectFrom(null)
                    setBeltToolActive(false)
                  }}
                >
                  ×
                </button>
              </div>
            )}
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

          {activeBelts.length > 0 && (
            <details className="belt-list belt-details">
              <summary>
                <span className="eyebrow">
                  {lang === 'de' ? 'Förderbänder' : 'Conveyor belts'}
                </span>
                <strong>{activeBelts.length}</strong>
                <small>
                  {activeBelts.filter((belt) => flowForEndpoint(belt.from) > beltRates[belt.tier] + 0.001).length}{' '}
                  {lang === 'de' ? 'überlastet' : 'overloaded'}
                </small>
              </summary>
              {activeBelts.map((belt) => {
                const flow = flowForEndpoint(belt.from)
                const overloaded = flow > beltRates[belt.tier] + 0.001
                return (
                  <div
                    className={`belt-list-item ${overloaded ? 'overloaded' : ''} ${selectedBeltId === belt.id ? 'selected' : ''}`}
                    key={belt.id}
                    onClick={() => {
                      setSelectedBeltId(belt.id)
                      setSelectedId(null)
                      setSelectedUtilityId(null)
                      setSelectedSourceId(null)
                      setSelectedLiftId(null)
                    }}
                  >
                    <div className="belt-material-info">
                      <span
                        className="belt-material-dot"
                        style={{ background: materialColor(belt.materialId) }}
                      />
                      <div>
                      <strong>
                        {belt.materialId ? `${itemName(belt.materialId, lang)} · ` : ''}
                        Mk.{belt.tier.slice(2)} ·{' '}
                        {Math.round(flow * 100) / 100}/min
                      </strong>
                      <small>
                        {lang === 'de' ? 'Kapazität' : 'Capacity'}:{' '}
                        {beltRates[belt.tier]}/min
                      </small>
                      </div>
                    </div>
                    {overloaded && <AlertTriangle size={14} />}
                    <button
                      className="icon-delete"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeBelt(belt.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </details>
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
                {lang === 'de'
                  ? 'Freie Blueprint-Fläche · Raster 8 × 8 m'
                  : 'Free blueprint workspace · 8 × 8 m grid'}
              </small>
            </div>
            <div className="designer-view-actions">
              <div className="zoom-controls">
                <button
                  title={lang === 'de' ? 'Rauszoomen' : 'Zoom out'}
                  onClick={() => setZoomAround(zoom - 0.1)}
                >
                  <ZoomOut size={15} />
                </button>
                <button className="zoom-value" onClick={() => { setZoom(1); setPan({ x: 48, y: 48 }) }}>
                  {zoomLabel}
                </button>
                <button
                  title={lang === 'de' ? 'Reinzoomen' : 'Zoom in'}
                  onClick={() => setZoomAround(zoom + 0.1)}
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  title={lang === 'de' ? 'Alles einpassen' : 'Fit all'}
                  onClick={fitView}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
              <div className="designer-count">
                {activeNodes.length} {lang === 'de' ? 'Maschinen' : 'machines'}
              </div>
            </div>
          </div>

          {placementError && (
            <div className="designer-error">
              <AlertTriangle size={16} />
              {placementError}
            </div>
          )}

          <div
            ref={viewportRef}
            className={`blueprint-viewport ${isPanning ? 'panning' : ''}`}
            style={{
              backgroundSize: `${CELL_PX * zoom}px ${CELL_PX * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
            onWheel={(e) => {
              e.preventDefault()
              const direction = e.deltaY > 0 ? -1 : 1
              setZoomAround(zoom + direction * 0.1, e.clientX, e.clientY)
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              const target = e.target as HTMLElement
              if (target.closest('.factory-node, .factory-source, .factory-utility, .factory-lift, .machine-port, .belt-waypoint, .belt-hit-path')) return
              setSelectedId(null)
              setSelectedUtilityId(null)
              setSelectedSourceId(null)
              setSelectedLiftId(null)
              setSelectedBeltId(null)
              setIsPanning(true)
              setPanAnchor({ x: e.clientX - pan.x, y: e.clientY - pan.y })
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!isPanning) return
              setPan({
                x: e.clientX - panAnchor.x,
                y: e.clientY - panAnchor.y,
              })
            }}
            onPointerUp={(e) => {
              if (!isPanning) return
              setIsPanning(false)
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
            }}
            onPointerCancel={() => setIsPanning(false)}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('application/x-satisfactory-object')
              if (!raw) return

              const payload = JSON.parse(raw) as {
                kind: 'node' | 'utility' | 'source' | 'lift' | 'waypoint'
                id: string
                offsetX: number
                offsetY: number
                beltId?: string
                waypointIndex?: number
              }

              const rect = e.currentTarget.getBoundingClientRect()
              const worldLeftPx =
                (e.clientX - rect.left - pan.x - payload.offsetX) / zoom
              const worldTopPx =
                (e.clientY - rect.top - pan.y - payload.offsetY) / zoom
              if (
                payload.kind === 'waypoint' &&
                payload.beltId != null &&
                payload.waypointIndex != null
              ) {
                moveBeltWaypoint(
                  payload.beltId,
                  payload.waypointIndex,
                  worldLeftPx / PIXELS_PER_METER,
                  worldTopPx / PIXELS_PER_METER,
                )
                return
              }

              const x = Math.round(worldLeftPx / CELL_PX)
              const y = Math.round(worldTopPx / CELL_PX)

              if (payload.kind === 'node') moveNode(payload.id, x, y)
              else if (payload.kind === 'utility') moveUtility(payload.id, x, y)
              else if (payload.kind === 'source') moveSource(payload.id, x, y)
              else moveLift(payload.id, x, y)
            }}
          >
            <div
              className="blueprint-world"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
            <svg
              className="belt-overlay"
              width="1"
              height="1"
            >
              <defs>
                <marker
                  id="belt-arrow"
                  markerWidth="5"
                  markerHeight="5"
                  refX="5"
                  refY="2.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L5,2.5 L0,5 z" fill="context-stroke" />
                </marker>
                <marker
                  id="belt-arrow-overloaded"
                  markerWidth="5"
                  markerHeight="5"
                  refX="5"
                  refY="2.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L5,2.5 L0,5 z" fill="context-stroke" />
                </marker>
              </defs>

              {activeBelts.map((belt, beltIndex) => {
                const from = portPoint(belt.from)
                const to = portPoint(belt.to)
                if (!from || !to) return null
                const flow = flowForEndpoint(belt.from)
                const overloaded = flow > beltRates[belt.tier] + 0.001
                const route = belt.waypoints?.length
                  ? routedPath(
                      from,
                      to,
                      belt.waypoints,
                      belt.routeStyle ?? 'orthogonal',
                      0,
                    )
                  : belt.routeStyle === 'straight'
                    ? routedPath(from, to, undefined, 'straight', 0)
                    : smartAutoRoutes.get(belt.id) ?? orthogonalPath(from, to)
                const selectedRoute = selectedBeltId === belt.id

                return (
                  <g key={belt.id}>
                    <path
                      className="belt-hit-path"
                      d={route.d}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedBeltId(belt.id)
                        setSelectedId(null)
                        setSelectedUtilityId(null)
                        setSelectedSourceId(null)
                        setSelectedLiftId(null)
                      }}
                    />
                    <path
                      className={`belt-path ${overloaded ? 'overloaded' : ''} ${selectedRoute ? 'selected' : ''}`}
                      d={route.d}
                      style={{ stroke: materialColor(belt.materialId) }}
                      markerEnd={
                        overloaded
                          ? 'url(#belt-arrow-overloaded)'
                          : 'url(#belt-arrow)'
                      }
                    />
                    {selectedRoute && (
                      <text
                        className="belt-label"
                        x={route.labelX}
                        y={route.labelY}
                      >
                        {belt.materialId
                          ? `${itemName(belt.materialId, lang)} · `
                          : ''}
                        Mk.{belt.tier.slice(2)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {selectedBelt?.waypoints?.map((waypoint, index) => (
              <button
                key={`waypoint-${selectedBelt.id}-${index}`}
                draggable
                className="belt-waypoint"
                style={{
                  left: waypoint.x * PIXELS_PER_METER - 7,
                  top: waypoint.y * PIXELS_PER_METER - 7,
                }}
                title={lang === 'de' ? 'Belt-Wegpunkt verschieben' : 'Move belt waypoint'}
                onDragStart={(e) => {
                  const elementRect = e.currentTarget.getBoundingClientRect()
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData(
                    'application/x-satisfactory-object',
                    JSON.stringify({
                      kind: 'waypoint',
                      id: `${selectedBelt.id}-${index}`,
                      beltId: selectedBelt.id,
                      waypointIndex: index,
                      offsetX: e.clientX - elementRect.left,
                      offsetY: e.clientY - elementRect.top,
                    }),
                  )
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  removeBeltWaypoint(selectedBelt.id, index)
                }}
              />
            ))}

            {floorLifts.map((lift) => (
              <button
                key={lift.id}
                draggable
                className={`factory-lift ${selectedLiftId === lift.id ? 'selected' : ''}`}
                style={{
                  left: lift.x * CELL_PX + CELL_PX / 2 - 12,
                  top: lift.y * CELL_PX + CELL_PX / 2 - 12,
                }}
                title={lang === 'de' ? 'Conveyor Lift verschieben' : 'Move conveyor lift'}
                onDragStart={(e) => {
                  const elementRect = e.currentTarget.getBoundingClientRect()
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData(
                    'application/x-satisfactory-object',
                    JSON.stringify({
                      kind: 'lift',
                      id: lift.id,
                      offsetX: e.clientX - elementRect.left,
                      offsetY: e.clientY - elementRect.top,
                    }),
                  )
                  setSelectedLiftId(lift.id)
                  setSelectedId(null)
                  setSelectedUtilityId(null)
                  setSelectedSourceId(null)
                  setSelectedBeltId(null)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedLiftId(lift.id)
                  setSelectedId(null)
                  setSelectedUtilityId(null)
                  setSelectedSourceId(null)
                  setSelectedBeltId(null)
                }}
              >
                <ArrowDownUp size={16} />
              </button>
            ))}

            {activeSources.map((source) => {
              const rect = sourceRect(source)
              const meta = resourceMeta[source.resourceId]
              const label = meta?.[lang] ?? itemName(source.resourceId, lang)
              return (
                <button
                  key={source.id}
                  draggable
                  className={`factory-source ${selectedSourceId === source.id ? 'selected' : ''}`}
                  style={{
                    left: source.x * CELL_PX,
                    top: source.y * CELL_PX,
                    width: CELL_PX,
                    height: CELL_PX,
                  }}
                  title={`${label} · Miner Mk.${source.miner.slice(2)} · ${Math.round(source.rate * 100) / 100}/min`}
                  onDragStart={(e) => {
                    const elementRect = e.currentTarget.getBoundingClientRect()
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(
                      'application/x-satisfactory-object',
                      JSON.stringify({
                        kind: 'source',
                        id: source.id,
                        offsetX: e.clientX - elementRect.left,
                        offsetY: e.clientY - elementRect.top,
                      }),
                    )
                    setSelectedSourceId(source.id)
                    setSelectedId(null)
                    setSelectedUtilityId(null)
                    setSelectedLiftId(null)
                    setSelectedBeltId(null)
                  }}
                  onClick={() => {
                    setSelectedSourceId(source.id)
                    setSelectedId(null)
                    setSelectedUtilityId(null)
                    setSelectedLiftId(null)
                    setSelectedBeltId(null)
                  }}
                >
                  <img
                    src={extractorIconUrl(meta?.kind ?? 'solid', source.miner) ?? ''}
                    alt=""
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <small>{label}</small>
                  {renderPorts('source', source.id, 0, rect)}
                </button>
              )
            })}

            {activeUtilities.map((utility) => {
              const rect = utilityRect(utility)
              return (
                <button
                  key={utility.id}
                  draggable
                  className={`factory-utility ${selectedUtilityId === utility.id ? 'selected' : ''}`}
                  style={{
                    left: utility.x * CELL_PX,
                    top: utility.y * CELL_PX,
                    width: UTILITY_SIZE_M * PIXELS_PER_METER,
                    height: UTILITY_SIZE_M * PIXELS_PER_METER,
                  }}
                  onDragStart={(e) => {
                    const elementRect = e.currentTarget.getBoundingClientRect()
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(
                      'application/x-satisfactory-object',
                      JSON.stringify({
                        kind: 'utility',
                        id: utility.id,
                        offsetX: e.clientX - elementRect.left,
                        offsetY: e.clientY - elementRect.top,
                      }),
                    )
                  }}
                  onClick={() => {
                    setSelectedUtilityId(utility.id)
                    setSelectedId(null)
                    setSelectedSourceId(null)
                    setSelectedLiftId(null)
                    setSelectedBeltId(null)
                  }}
                >
                  {utility.kind === 'splitter' ? (
                    <GitFork size={16} />
                  ) : (
                    <Merge size={16} />
                  )}
                  {renderPorts(
                    'utility',
                    utility.id,
                    utility.rotation,
                    rect,
                  )}
                </button>
              )
            })}

            {activeNodes.map((node) => {
              const size = rotatedFootprint(node.machineId, node.rotation)
              const rect = rectFor(node)
              return (
                <button
                  key={node.id}
                  draggable
                  onDragStart={(e) => {
                    const elementRect = e.currentTarget.getBoundingClientRect()
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(
                      'application/x-satisfactory-object',
                      JSON.stringify({
                        kind: 'node',
                        id: node.id,
                        offsetX: e.clientX - elementRect.left,
                        offsetY: e.clientY - elementRect.top,
                      }),
                    )
                    setSelectedId(node.id)
                    setSelectedUtilityId(null)
                    setSelectedSourceId(null)
                    setSelectedLiftId(null)
                    setSelectedBeltId(null)
                  }}
                  onClick={() => {
                    setSelectedId(node.id)
                    setSelectedUtilityId(null)
                    setSelectedSourceId(null)
                    setSelectedLiftId(null)
                    setSelectedBeltId(null)
                  }}
                  className={`factory-node ${selectedId === node.id ? 'selected' : ''}`}
                  style={{
                    left: node.x * CELL_PX,
                    top: node.y * CELL_PX,
                    width: size.widthM * PIXELS_PER_METER,
                    height: size.lengthM * PIXELS_PER_METER,
                  }}
                >
                  <img
                    src={machineIconUrl(node.machineId) ?? ''}
                    alt=""
                    style={{ transform: `rotate(${node.rotation}deg)` }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  {renderPorts(
                    'node',
                    node.id,
                    node.rotation,
                    rect,
                  )}
                </button>
              )
            })}
            </div>
          </div>
        </section>

        {hasSelection && (
          <aside className="selection-inspector card">
            {selected && selectedFootprint ? (
              <>
                <div className="selection-inspector-head">
                  <span className="eyebrow">
                    {lang === 'de' ? 'Ausgewählte Maschine' : 'Selected machine'}
                  </span>
                  <h2>{machineLabel(selected.machineId)}</h2>
                  <p>{itemName(selected.itemId, lang)}</p>
                </div>

                <div className="inspector-stat-grid">
                  <div>
                    <span>Ports</span>
                    <strong>
                      {portCounts({ kind: 'node', id: selected.id }).input} In ·{' '}
                      {portCounts({ kind: 'node', id: selected.id }).output} Out
                    </strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Rotation' : 'Rotation'}</span>
                    <strong>{selected.rotation}°</strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Grundfläche' : 'Footprint'}</span>
                    <strong>
                      {selectedFootprint.widthM} × {selectedFootprint.lengthM} m
                    </strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Höhe' : 'Height'}</span>
                    <strong>{selectedFootprint.heightM} m</strong>
                  </div>
                </div>

                <div className="belt-editor-section">
                  <button
                    className="action-button"
                    onClick={() => {
                      setBeltToolActive(true)
                      setConnectFrom({
                        kind: 'node',
                        id: selected.id,
                        side: 'output',
                        port: 0,
                      })
                      setPlacementError(null)
                    }}
                  >
                    <Unplug size={15} />
                    {lang === 'de' ? 'Verbindung starten' : 'Start connection'}
                  </button>
                  <button
                    className="action-button"
                    onClick={() => rotateNode(selected.id)}
                  >
                    <RotateCw size={15} />
                    {lang === 'de' ? '90° drehen' : 'Rotate 90°'}
                  </button>
                </div>

                <button
                  className="action-button danger inspector-delete"
                  onClick={() => removeNode(selected.id)}
                >
                  <Trash2 size={15} />
                  {lang === 'de' ? 'Maschine löschen' : 'Delete machine'}
                </button>
              </>
            ) : selectedSource ? (
              <>
                <div className="selection-inspector-head">
                  <span className="eyebrow">
                    {lang === 'de' ? 'Rohstoffquelle' : 'Resource source'}
                  </span>
                  <h2>
                    {resourceMeta[selectedSource.resourceId]?.[lang] ??
                      itemName(selectedSource.resourceId, lang)}
                  </h2>
                  <p>Miner Mk.{selectedSource.miner.slice(2)}</p>
                </div>

                <div className="inspector-stat-grid">
                  <div>
                    <span>{lang === 'de' ? 'Förderrate' : 'Rate'}</span>
                    <strong>{Math.round(selectedSource.rate * 100) / 100}/min</strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Position' : 'Position'}</span>
                    <strong>{selectedSource.x} / {selectedSource.y}</strong>
                  </div>
                </div>

                <div className="belt-editor-section">
                  <button
                    className="action-button"
                    onClick={() => {
                      setBeltToolActive(true)
                      setConnectFrom({
                        kind: 'source',
                        id: selectedSource.id,
                        side: 'output',
                        port: 0,
                      })
                      setPlacementError(null)
                    }}
                  >
                    <Unplug size={15} />
                    {lang === 'de' ? 'Verbindung starten' : 'Start connection'}
                  </button>
                </div>

                <button
                  className="action-button danger inspector-delete"
                  onClick={() => removeSource(selectedSource.id)}
                >
                  <Trash2 size={15} />
                  {lang === 'de' ? 'Rohstoffquelle löschen' : 'Delete source'}
                </button>
              </>
            ) : selectedUtility ? (
              <>
                <div className="selection-inspector-head">
                  <span className="eyebrow">
                    {lang === 'de' ? 'Fördertechnik' : 'Conveyor utility'}
                  </span>
                  <h2>
                    {selectedUtility.kind === 'splitter' ? 'Splitter' : 'Merger'}
                  </h2>
                  <p>
                    {selectedUtility.kind === 'splitter'
                      ? '1 Input · 3 Outputs'
                      : '3 Inputs · 1 Output'}
                  </p>
                </div>

                <div className="inspector-stat-grid">
                  <div>
                    <span>{lang === 'de' ? 'Rotation' : 'Rotation'}</span>
                    <strong>{selectedUtility.rotation}°</strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Position' : 'Position'}</span>
                    <strong>{selectedUtility.x} / {selectedUtility.y}</strong>
                  </div>
                </div>

                <div className="belt-editor-section">
                  <button
                    className="action-button"
                    onClick={() => {
                      setBeltToolActive(true)
                      setConnectFrom({
                        kind: 'utility',
                        id: selectedUtility.id,
                        side: 'output',
                        port: 0,
                      })
                      setPlacementError(null)
                    }}
                  >
                    <Unplug size={15} />
                    {lang === 'de' ? 'Verbindung starten' : 'Start connection'}
                  </button>
                  <button
                    className="action-button"
                    onClick={() => rotateUtility(selectedUtility.id)}
                  >
                    <RotateCw size={15} />
                    {lang === 'de' ? '90° drehen' : 'Rotate 90°'}
                  </button>
                </div>

                <button
                  className="action-button danger inspector-delete"
                  onClick={() => removeUtility(selectedUtility.id)}
                >
                  <Trash2 size={15} />
                  {lang === 'de' ? 'Element löschen' : 'Delete element'}
                </button>
              </>
            ) : selectedLift ? (
              <>
                <div className="selection-inspector-head">
                  <span className="eyebrow">Conveyor Lift</span>
                  <h2>{lang === 'de' ? 'Etagenverbindung' : 'Floor connection'}</h2>
                </div>

                <div className="belt-endpoints">
                  <div>
                    <span>{lang === 'de' ? 'Von' : 'From'}</span>
                    <strong>
                      {normalized.floors.find((floor) => floor.id === selectedLift.fromFloorId)?.name ?? '?'}
                    </strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Nach' : 'To'}</span>
                    <strong>
                      {normalized.floors.find((floor) => floor.id === selectedLift.toFloorId)?.name ?? '?'}
                    </strong>
                  </div>
                </div>

                <div className="inspector-stat-grid">
                  <div>
                    <span>{lang === 'de' ? 'Raster X' : 'Grid X'}</span>
                    <strong>{selectedLift.x}</strong>
                  </div>
                  <div>
                    <span>{lang === 'de' ? 'Raster Y' : 'Grid Y'}</span>
                    <strong>{selectedLift.y}</strong>
                  </div>
                </div>

                <button
                  className="action-button danger inspector-delete"
                  onClick={() => removeLift(selectedLift.id)}
                >
                  <Trash2 size={15} />
                  {lang === 'de' ? 'Lift löschen' : 'Delete lift'}
                </button>
              </>
            ) : selectedBelt ? (() => {
              const flow = flowForEndpoint(selectedBelt.from)
              const overloaded = flow > beltRates[selectedBelt.tier] + 0.001
              return (
                <>
                  <div className="selection-inspector-head">
                    <span className="eyebrow">
                      {lang === 'de' ? 'Ausgewähltes Förderband' : 'Selected conveyor'}
                    </span>
                    <h2>
                      {selectedBelt.materialId
                        ? itemName(selectedBelt.materialId, lang)
                        : (lang === 'de' ? 'Förderband' : 'Conveyor')}
                    </h2>
                    <div
                      className="inspector-material-line"
                      style={{ background: materialColor(selectedBelt.materialId) }}
                    />
                  </div>

                  <div className="inspector-stat-grid">
                    <div>
                      <span>{lang === 'de' ? 'Durchsatz' : 'Flow'}</span>
                      <strong>{Math.round(flow * 100) / 100}/min</strong>
                    </div>
                    <div className={overloaded ? 'danger-stat' : ''}>
                      <span>{lang === 'de' ? 'Kapazität' : 'Capacity'}</span>
                      <strong>{beltRates[selectedBelt.tier]}/min</strong>
                    </div>
                  </div>

                  <label>
                    {lang === 'de' ? 'Förderband' : 'Conveyor tier'}
                    <select
                      value={selectedBelt.tier}
                      onChange={(e) =>
                        updateBelt(selectedBelt.id, {
                          tier: e.target.value as BeltTier,
                        })
                      }
                    >
                      {(Object.keys(beltRates) as BeltTier[])
                        .filter(
                          (tier) =>
                            Number(tier.slice(2)) <= Number(maxBeltTier.slice(2)),
                        )
                        .map((tier) => (
                          <option key={tier} value={tier}>
                            Mk.{tier.slice(2)} · {beltRates[tier]}/min
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="belt-endpoints">
                    <div>
                      <span>{lang === 'de' ? 'Von' : 'From'}</span>
                      <strong>{endpointLabel(selectedBelt.from)}</strong>
                    </div>
                    <div>
                      <span>{lang === 'de' ? 'Nach' : 'To'}</span>
                      <strong>{endpointLabel(selectedBelt.to)}</strong>
                    </div>
                  </div>

                  <div className="belt-editor-section">
                    <span className="eyebrow">
                      {lang === 'de' ? 'Linienführung' : 'Routing'}
                    </span>
                    <div className="route-style-buttons">
                      <button
                        className={`action-button ${selectedBelt.routeStyle === 'straight' ? 'tool-active' : ''}`}
                        onClick={() =>
                          updateBelt(selectedBelt.id, { routeStyle: 'straight' })
                        }
                      >
                        {lang === 'de' ? 'Gerade' : 'Straight'}
                      </button>
                      <button
                        className={`action-button ${(selectedBelt.routeStyle ?? 'orthogonal') === 'orthogonal' ? 'tool-active' : ''}`}
                        onClick={() =>
                          updateBelt(selectedBelt.id, {
                            routeStyle: 'orthogonal',
                          })
                        }
                      >
                        {lang === 'de' ? 'Eckig' : 'Angular'}
                      </button>
                      <button
                        className={`action-button ${selectedBelt.routeStyle === 'smooth' ? 'tool-active' : ''}`}
                        onClick={() =>
                          updateBelt(selectedBelt.id, { routeStyle: 'smooth' })
                        }
                      >
                        {lang === 'de' ? 'Abgerundet' : 'Smooth'}
                      </button>
                    </div>

                    <button
                      className="action-button"
                      onClick={() => addBeltWaypoint(selectedBelt.id)}
                    >
                      <Plus size={15} />
                      {lang === 'de' ? 'Wegpunkt hinzufügen' : 'Add waypoint'}
                    </button>

                    {(selectedBelt.waypoints?.length ?? 0) > 0 && (
                      <>
                        <p className="inspector-help">
                          {lang === 'de'
                            ? 'Die runden Punkte im Blueprint kannst du frei ziehen. Doppelklick entfernt einen Wegpunkt.'
                            : 'Drag the round handles in the blueprint. Double-click removes a waypoint.'}
                        </p>
                        <button
                          className="action-button"
                          onClick={() =>
                            updateBelt(selectedBelt.id, { waypoints: [] })
                          }
                        >
                          {lang === 'de' ? 'Route zurücksetzen' : 'Reset route'}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    className="action-button danger inspector-delete"
                    onClick={() => removeBelt(selectedBelt.id)}
                  >
                    <Trash2 size={15} />
                    {lang === 'de' ? 'Förderband löschen' : 'Delete conveyor'}
                  </button>
                </>
              )
            })() : null}
          </aside>
        )}
      </section>
    </section>
  )
}
