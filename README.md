# Satisfactory Factory Planner

Resource-first production planner for **Satisfactory**.

Instead of starting with a desired output rate, the planner starts with the resource nodes and miner tiers you actually have and calculates what production is possible.

## v0.1

- Steel Ingot production
- Iron Ore and Coal node purity
- Miner Mk.1 / Mk.2 / Mk.3
- Live resource-rate calculation
- Foundry count and clock-speed recommendation
- Production leftovers
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

The production build is written to `dist/`, ready for Cloudflare Pages.

## Planned

- More items and recipes
- Alternate recipes
- Belt capacity checks
- Power calculations
- Saved factories
- Drag-and-drop factory designer
- Multiple floors
- Conveyor lifts and belt routing
- Automatic layout suggestions
