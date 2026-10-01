export interface BuildingFootprint {
  widthM: number
  lengthM: number
  heightM: number
}

export const buildingFootprints: Record<string, BuildingFootprint> = {
  Desc_SmelterMk1_C: { widthM: 5, lengthM: 10, heightM: 8.5 },
  Desc_ConstructorMk1_C: { widthM: 8, lengthM: 10, heightM: 8.5 },
  Desc_FoundryMk1_C: { widthM: 10, lengthM: 10, heightM: 9 },
  Desc_AssemblerMk1_C: { widthM: 9, lengthM: 16, heightM: 11 },
  Desc_ManufacturerMk1_C: { widthM: 18, lengthM: 20, heightM: 12 },
  Desc_OilRefinery_C: { widthM: 10, lengthM: 22, heightM: 30 },
  Desc_Packager_C: { widthM: 8, lengthM: 8, heightM: 12 },
  Desc_Blender_C: { widthM: 18, lengthM: 16, heightM: 15 },
  Desc_Converter_C: { widthM: 16, lengthM: 16, heightM: 18 },
  Desc_HadronCollider_C: { widthM: 24, lengthM: 38, heightM: 32 },
  Desc_QuantumEncoder_C: { widthM: 22, lengthM: 50, heightM: 18 },
}

export const FOUNDATION_METERS = 8
export const PIXELS_PER_METER = 7

export function footprintFor(machineId: string): BuildingFootprint {
  return buildingFootprints[machineId] ?? { widthM: 8, lengthM: 8, heightM: 8 }
}

export function rotatedFootprint(
  machineId: string,
  rotation: 0 | 90 | 180 | 270,
): BuildingFootprint {
  const footprint = footprintFor(machineId)
  if (rotation === 90 || rotation === 270) {
    return {
      widthM: footprint.lengthM,
      lengthM: footprint.widthM,
      heightM: footprint.heightM,
    }
  }
  return footprint
}
