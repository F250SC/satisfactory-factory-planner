# Satisfactory Factory Planner

A resource-first production planner and visual factory designer for **Satisfactory**.

Instead of forcing you to enter a target output rate first, the planner starts from the resource nodes, miners/extractors and transport technology you actually have. It calculates what can be supplied continuously and builds the production chain from those real constraints.

Current app version: **0.23.0**

## Production planner

- 276 automatable machine recipes from the current normalized game-data snapshot
- Standard and alternate recipes
- Tier-aware recipe and building progression
- Hard-drive alternate recipe selection
- Resource-first calculation
- Miner Mk.1 / Mk.2 / Mk.3
- Conveyor Belt Mk.1 – Mk.6
- Pipeline Mk.1 / Mk.2
- Solid, oil, water and nitrogen resource handling
- Impure / Normal / Pure node settings where applicable
- Configurable extractor count
- Clock control locked until the player marks the MAM research as completed
- Power Shard limits: 0/1/2/3 shards = 100/150/200/250% maximum
- Underclocking and overclocking
- Individual machine clock recommendations
- Whole-machine planning while clock control is locked
- Raw-resource maximum vs. continuously supplied production
- Intermediate surplus display
- Estimated production-machine power use
- Resource and transport bottleneck information
- German and English UI
- Named browser save profiles with automatic persistence

## Factory Designer

- Blueprint workspace with pan and zoom
- Effectively unbounded coordinates in all directions
- Real machine footprints and 90° rotation
- Multiple floors
- Conveyor lifts
- Resource sources / miners
- Splitters and mergers with game-like port orientation
- One connection per physical port
- Material-compatible manual connections
- Material-colored transport routes
- Selectable belts with a property inspector
- Manual belt waypoints
- Straight, orthogonal and smoothed route rendering
- Automatic starter-factory generation from the calculated plan
- Local splitter/merger generation based on machine flow
- Obstacle-aware automatic belt routing
- Per-machine input/output flow information
- Mine configuration from the Designer
- Shared resource/belt settings between Planner and Designer
- Detection when an automatically generated blueprint no longer matches the current production plan
- Factory layout saved inside browser profiles

## Calculation model

When clock control is available, the planner uses the selected number of Power Shards as the maximum allowed machine clock. It can underclock the final machine in a stage to match the required rate.

Example:

```
Required capacity: 133.3333% of one 100% machine
Maximum allowed clock: 100%

=> 2 machines:
   1 × 100%
   1 × 33.3333%
```

Before clock control is unlocked, production machines are fixed at 100%. Upstream machines are rounded to whole machines and their full input consumption is propagated upstream. This avoids presenting a nominal output that cannot actually be supplied continuously.

## Important current limitations

### By-products and closed loops

Recipes with by-products are represented at machine level, but the production solver does **not yet automatically feed by-products back into closed production loops**.

This matters especially for some oil, aluminum, nuclear and late-game chains. The planner can therefore report a conservative external raw-resource requirement for such chains.

The UI warns when the selected chain contains these recipes.

### Pipes in the Factory Designer

The production calculation supports liquid/gas rates and pipe limits. The Factory Designer does not yet model dedicated pipe/pipeline objects; fluid/gas connections are currently visual transport lines.

The UI warns when a selected factory contains fluids or gases.

### Conveyor lifts and cross-floor flow

Conveyor lifts can be placed, moved and shown on the connected floors, but they are not yet first-class material-flow endpoints in the routing graph. Cross-floor conveyor routing through a lift therefore still requires a dedicated implementation.

### Automatic layout

The auto-layout is intended to create a useful editable starting factory, not a guaranteed globally optimal building layout. Manual movement and routing remain part of the Designer workflow.

## Data integrity

The project includes build-time validation for:

- duplicate recipe IDs
- invalid recipe times and amounts
- unknown item references in production recipes
- unknown production buildings
- recipe/alternate metadata counts
- raw-resource references
- progression references
- explicit Factory Designer footprints for every production building

Run:

```bash
npm run check
```

## Build pipeline

Every push to `main` runs a GitHub Actions CI check with TypeScript compilation and game-data validation.

Cloudflare Pages then performs the production build.

```bash
npm install
npm run check
npm run build
```

The production build is written to `dist/`.

The build validates TypeScript and game data **before** downloading game icons, so code/data failures surface quickly.

## Game assets

Game imagery is synchronized during the production build from the configured public icon source. Missing external images do not stop the build; the UI has visual fallbacks where an asset is unavailable.

## Save data

Profiles are stored in the browser using Local Storage.

Saved profiles are normalized when loaded so older layouts remain compatible when newer Designer fields are introduced.

## Architecture

- React 19
- TypeScript
- Vite
- Static normalized Satisfactory game-data snapshot
- Recursive reverse production solver
- Client-side persistence
- Cloudflare Pages deployment
- GitHub Actions validation

## Main source files

- `src/engine.ts` — production calculation
- `src/data.ts` — normalized game data access and display helpers
- `src/progression.ts` — recipe/building unlock rules
- `src/technology.ts` — miner/belt/pipe tier unlock rules
- `src/FactoryDesigner.tsx` — visual factory editor
- `src/buildingFootprints.ts` — machine dimensions
- `src/profiles.ts` — browser save profiles
- `scripts/validate-data.mjs` — data integrity checks
- `scripts/sync-assets.mjs` — build-time image synchronization

## Next architectural milestones

- dedicated Pipe/Pipeline objects in the Factory Designer
- by-product-aware / loop-aware production solver
- stronger automatic route collision avoidance
- undo/redo history for Designer editing
- optional blueprint export/import
- automated calculation tests for representative recipe chains
