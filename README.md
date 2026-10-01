# Satisfactory Factory Planner

A resource-first production planner for **Satisfactory**.

Instead of starting with a desired output rate, the planner starts with the resource nodes, miner tiers and conveyor belts you actually have and calculates what production is possible.

## v0.2

- Dynamic target product selection
- Iron Plate
- Iron Rod
- Screws
- Reinforced Iron Plate
- Rotor
- Modular Frame
- Steel Ingot
- Steel Beam
- Steel Pipe
- Recursive production-chain calculation
- Automatic raw-resource requirement calculation
- Iron Ore and Coal node purity
- Miner Mk.1 / Mk.2 / Mk.3
- Conveyor Belt Mk.1 – Mk.6 limits
- Belt bottleneck warnings
- Optional production-machine overclocking up to 250%
- Consolidated machine requirements for branched recipes
- Resource surplus / balanced / belt-limit status
- German / English interface
- Responsive web UI

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
- Data-driven item and recipe definitions
- Recursive calculation engine
- Static client-side deployment

## Planned

- Alternate recipes and unlock management
- More Satisfactory resources and products
- Saved factories
- Per-line conveyor capacity checks
- More detailed power calculation
- Drag-and-drop factory designer
- Real machine footprints
- Foundations and rotation
- Multiple floors
- Conveyor lifts and belt routing
- Automatic layout suggestions
- Optional 3D view
