# Recycle Rush: Idle Factory

Playable H5 vertical slice for a light idle-management game. The first release is deliberately packaged as one self-contained HTML page so it can be reviewed and uploaded to browser-game portals without dependency installation or asset-path failures.

## Implemented

- Portrait-first factory interface matching the approved navy, cream, green, blue, and orange visual direction.
- Animated Canvas recycling plant with six production zones, workers, trucks, conveyors, materials, and dirty-to-clean progression.
- Bottleneck-driven economy, station upgrades, employee automation, orders, daily missions, research, collection, factory stars, and certification/prestige resets.
- Community recycling factory, harbor metal factory, and locked e-waste preview.
- Autosave, save migration, capped offline progress, offline double reward, profit boost, and fast transport reward placements.
- CrazyGames Basic, Full, and Standalone build profiles.
- Chinese/English UI and responsive desktop/mobile layouts.

## Run

```bash
npm run dev
```

Open `http://localhost:4173`.

## Validate and build

```bash
npm run validate
```

Outputs:

- `dist/basic/index.html`
- `dist/full/index.html`
- `dist/standalone/index.html`

## Visual fidelity

The game recreates the concept mockup's composition and interaction hierarchy with live DOM/Canvas rendering. It does not use the concept screenshot as a fake gameplay background. Exact production sprites and animation sheets remain a later art pass after retention and monetization metrics are validated.
