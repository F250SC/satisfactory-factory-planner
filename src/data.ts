export type Purity = 'impure' | 'normal' | 'pure'
export type MinerTier = 'mk1' | 'mk2' | 'mk3'
export type BeltTier = 'mk1' | 'mk2' | 'mk3' | 'mk4' | 'mk5' | 'mk6'

export type ItemId =
  | 'iron-ore'
  | 'coal'
  | 'iron-ingot'
  | 'iron-plate'
  | 'iron-rod'
  | 'screw'
  | 'reinforced-iron-plate'
  | 'rotor'
  | 'modular-frame'
  | 'steel-ingot'
  | 'steel-beam'
  | 'steel-pipe'

export type MachineId = 'smelter' | 'constructor' | 'assembler' | 'foundry'

export interface Recipe {
  id: string
  output: ItemId
  outputRate: number
  machine: MachineId
  inputs: Array<{ item: ItemId; rate: number }>
}

export const rawResources: ItemId[] = ['iron-ore', 'coal']

export const itemNames: Record<ItemId, { de: string; en: string }> = {
  'iron-ore': { de: 'Eisenerz', en: 'Iron Ore' },
  coal: { de: 'Kohle', en: 'Coal' },
  'iron-ingot': { de: 'Eisenbarren', en: 'Iron Ingot' },
  'iron-plate': { de: 'Eisenplatte', en: 'Iron Plate' },
  'iron-rod': { de: 'Eisenstange', en: 'Iron Rod' },
  screw: { de: 'Schrauben', en: 'Screws' },
  'reinforced-iron-plate': { de: 'Verstärkte Eisenplatte', en: 'Reinforced Iron Plate' },
  rotor: { de: 'Rotor', en: 'Rotor' },
  'modular-frame': { de: 'Modularer Rahmen', en: 'Modular Frame' },
  'steel-ingot': { de: 'Stahlbarren', en: 'Steel Ingot' },
  'steel-beam': { de: 'Stahlträger', en: 'Steel Beam' },
  'steel-pipe': { de: 'Stahlrohr', en: 'Steel Pipe' },
}

export const targetItems: ItemId[] = [
  'iron-plate',
  'iron-rod',
  'screw',
  'reinforced-iron-plate',
  'rotor',
  'modular-frame',
  'steel-ingot',
  'steel-beam',
  'steel-pipe',
]

export const recipes: Recipe[] = [
  {
    id: 'iron-ingot',
    output: 'iron-ingot',
    outputRate: 30,
    machine: 'smelter',
    inputs: [{ item: 'iron-ore', rate: 30 }],
  },
  {
    id: 'iron-plate',
    output: 'iron-plate',
    outputRate: 20,
    machine: 'constructor',
    inputs: [{ item: 'iron-ingot', rate: 30 }],
  },
  {
    id: 'iron-rod',
    output: 'iron-rod',
    outputRate: 15,
    machine: 'constructor',
    inputs: [{ item: 'iron-ingot', rate: 15 }],
  },
  {
    id: 'screw',
    output: 'screw',
    outputRate: 40,
    machine: 'constructor',
    inputs: [{ item: 'iron-rod', rate: 10 }],
  },
  {
    id: 'reinforced-iron-plate',
    output: 'reinforced-iron-plate',
    outputRate: 5,
    machine: 'assembler',
    inputs: [
      { item: 'iron-plate', rate: 30 },
      { item: 'screw', rate: 60 },
    ],
  },
  {
    id: 'rotor',
    output: 'rotor',
    outputRate: 4,
    machine: 'assembler',
    inputs: [
      { item: 'iron-rod', rate: 20 },
      { item: 'screw', rate: 100 },
    ],
  },
  {
    id: 'modular-frame',
    output: 'modular-frame',
    outputRate: 2,
    machine: 'assembler',
    inputs: [
      { item: 'reinforced-iron-plate', rate: 3 },
      { item: 'iron-rod', rate: 12 },
    ],
  },
  {
    id: 'steel-ingot',
    output: 'steel-ingot',
    outputRate: 45,
    machine: 'foundry',
    inputs: [
      { item: 'iron-ore', rate: 45 },
      { item: 'coal', rate: 45 },
    ],
  },
  {
    id: 'steel-beam',
    output: 'steel-beam',
    outputRate: 15,
    machine: 'constructor',
    inputs: [{ item: 'steel-ingot', rate: 60 }],
  },
  {
    id: 'steel-pipe',
    output: 'steel-pipe',
    outputRate: 20,
    machine: 'constructor',
    inputs: [{ item: 'steel-ingot', rate: 30 }],
  },
]

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

export const machineNames: Record<MachineId, { de: string; en: string }> = {
  smelter: { de: 'Schmelzofen', en: 'Smelter' },
  constructor: { de: 'Konstruktor', en: 'Constructor' },
  assembler: { de: 'Assembler', en: 'Assembler' },
  foundry: { de: 'Gießerei', en: 'Foundry' },
}

export const machinePowerMW: Record<MachineId, number> = {
  smelter: 4,
  constructor: 4,
  assembler: 15,
  foundry: 16,
}
