import fs from 'node:fs/promises'
import path from 'node:path'
import gameData from '../src/gameData.json' with { type: 'json' }

const outDir = path.resolve('public/assets/game')
const sourceBase = 'https://raw.githubusercontent.com/rois2coeurs/SatisGraphtory/main/public/icons'

const extraDescriptorIds = [
  'Desc_MinerMk1_C',
  'Desc_MinerMk2_C',
  'Desc_MinerMk3_C',
  'Desc_OilPump_C',
  'Desc_WaterPump_C',
  'Desc_FrackingExtractor_C',
  'Desc_FrackingSmasher_C',
  'Desc_ConveyorBeltMk1_C',
  'Desc_ConveyorBeltMk2_C',
  'Desc_ConveyorBeltMk3_C',
  'Desc_ConveyorBeltMk4_C',
  'Desc_ConveyorBeltMk5_C',
  'Desc_ConveyorBeltMk6_C',
  'Desc_Pipeline_C',
  'Desc_PipelineMk2_C',
]

const ids = new Set([
  ...Object.keys(gameData.items),
  ...Object.keys(gameData.buildings),
  ...extraDescriptorIds,
])

await fs.rm(outDir, { recursive: true, force: true })
await fs.mkdir(outDir, { recursive: true })

const missing = []
let downloaded = 0

async function download(id) {
  const url = `${sourceBase}/${id}.png`

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'F250SC/satisfactory-factory-planner' },
      })

      if (response.status === 404) {
        missing.push(id)
        return
      }

      if (!response.ok) {
        if (attempt === 3) {
          missing.push(id)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
        continue
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('image')) {
        if (attempt === 3) {
          missing.push(id)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
        continue
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      if (!bytes.length) {
        if (attempt === 3) {
          missing.push(id)
          return
        }
        continue
      }

      await fs.writeFile(path.join(outDir, `${id}.png`), bytes)
      downloaded += 1
      return
    } catch {
      if (attempt === 3) {
        missing.push(id)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 250))
    }
  }
}

const list = [...ids]
const concurrency = 12
for (let index = 0; index < list.length; index += concurrency) {
  await Promise.all(list.slice(index, index + concurrency).map(download))
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: 'rois2coeurs/SatisGraphtory public/icons',
  downloaded,
  requested: list.length,
  missing,
}

await fs.writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8',
)

console.log(`Satisfactory assets: ${downloaded}/${list.length} downloaded`)
if (missing.length) {
  console.warn(`Missing assets (${missing.length}): ${missing.join(', ')}`)
}
