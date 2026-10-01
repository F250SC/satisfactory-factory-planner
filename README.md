# Satisfactory Factory Planner

A resource-first production planner for **Satisfactory**.

Instead of starting with a desired output rate, the planner starts with the resource nodes, extractors and transport technology you actually have and calculates what production is possible.

## v0.3

- Complete automatable production dataset: **276 machine recipes**
- Standard and alternate recipes
- 152 production items
- Constructor, Smelter, Foundry, Assembler, Manufacturer, Refinery, Packager, Blender, Converter, Particle Accelerator and Quantum Encoder
- Dynamic target-product and target-recipe selection
- Recipe overrides for intermediate products
- Recursive production-chain calculation
- 13 node/extraction resources
- Miner Mk.1 / Mk.2 / Mk.3
- Conveyor Belt Mk.1 – Mk.6 limits
- Pipeline Mk.1 / Mk.2 limits
- Solid, oil, water and nitrogen extraction
- Configurable number of nodes/extractors
- Practical clock planning with selectable maximum clock: 100%, 150%, 200% or 250%
- Exact final-machine underclocking where needed
- Per-stage in-game clock setup (for example 1×100% + 1×33.33%)
- Estimated power calculation using Satisfactory's production-machine clock exponent
- Resource surplus and transport bottleneck status
- German / English interface
- Responsive web UI

## Clock-speed model

The selected clock value is a **maximum allowed clock per machine**, not a forced clock for every machine.

Example: if a production stage needs 133.33% of one machine at 100% capacity and the configured maximum is 100%, the planner recommends:

```
2 machines: 1×100% + 1×33.33%
```

If the configured maximum is 150%, the same stage can use:

```
1 machine: 1×133.33%
```

Satisfactory itself supports configurable clock speeds between 1% and 250%; the 100/150/200/250 choices in this planner are convenience limits for planning.

## Game data

The planner's production dataset is derived from Satisfactory's machine-readable CommunityResources/Docs game data. The current normalized snapshot contains 276 automatable machine recipes and 152 items.

The normalized snapshot used for v0.3 was imported from the public Satisfactory Workbench game-data snapshot, which itself documents its source as Satisfactory CommunityResources-derived data.

The game data is kept separate in `src/gameData.json` so it can be replaced when Satisfactory updates without rewriting the calculation engine.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist/` and deployed automatically via Cloudflare Pages.

## Architecture

- React + TypeScript + Vite
- Data-driven items / recipes / buildings
- Recursive reverse production solver
- Client-side deployment
- Static game-data snapshot

## Planned

- Save/load factories
- Recipe-unlock profiles
- Better by-product accounting and loop solving
- Satisfactory icon integration
- Factory Designer
- Real machine footprints
- Foundations and rotation
- Multiple floors
- Conveyor lifts and belt routing
- Automatic layout suggestions
- Optional 3D view
