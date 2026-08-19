# Project-PDN — Frontend (standalone)

Interactive Power Distribution Network canvas. No backend required — "Run
Optimization" runs a client-side mock solver (`src/utils/mockSolver.ts`)
that approximates a radial power flow well enough to drive the overlay
coloring and result summary.

## Import / export

Click **Import / Export** (top-right) for a small modal:

- **Export** — download the current graph as a `.json` file, or copy it
  straight to the clipboard. Positions, parameters, colors — everything —
  goes with it; transient solve results are dropped since a saved file
  should represent the topology, not a stale solve snapshot.
- **Import** — pick a `.json` file, or paste JSON directly into the
  textarea. Either way it's validated before anything changes on screen
  (unknown component types, dangling edge references, duplicate ids, and
  plain malformed JSON all produce a specific error message instead of
  silently breaking the canvas). On success, the canvas is replaced,
  re-framed into view, and autosaved to `localStorage` — same as any other
  edit, no separate "save" step needed.

This doubles as the easiest way to hand a topology to a real backend later:
`src/utils/graphImportExport.ts` exports `serializeGraph(nodes, edges)`,
which is exactly the JSON shape a `POST /api/solve` body would need.

## Persistence

Every change to the canvas — nodes, connections, positions, colors, edited
parameters, the last solve result — is written to `localStorage` on the
fly (`src/utils/graphPersistence.ts`). Reload the page, close and reopen
the tab, whatever: it comes back exactly as you left it. Use the **Reset**
button (top-right, next to "Run Optimization") to clear the saved state and
go back to the built-in demo topology.

This is per-browser, client-side storage — it doesn't sync across devices
or browsers, and clearing site data / using a private window will lose it.

## Component types

| Type | Rendering | Key properties |
|---|---|---|
| **Substation** | **red vertical bar** (single-line-diagram convention) | base voltage, slack-bus flag, max import |
| Transformer | full card | rated power, primary/secondary voltage, impedance, tap ratio |
| Generator | full card | max/min P & Q, generation cost |
| Load | full card | active/reactive power demand, critical flag |
| Feeder | full card | base voltage only (plain junction) |
| **Node** | **small black circle, bus number inside it** | active power (P), reactive power (Q) |

`Node` is the one to reach for in dense networks — e.g. 30+ buses and
100+ lines — where rendering every point as a full labeled card makes the
canvas unreadable. It's a generic bus: hover it for a tooltip with its
label/voltage/P/Q, double-click it for the full inspector, same as any
other node — it just doesn't take up card-sized space on the canvas.

## Default demo topology

The canvas now loads with the **IEEE 33-bus radial distribution test
feeder** (Baran & Wu, 1989) — bus 1 is the substation (red bar), buses
2–33 are generic `Node` dots, wired with the standard 32-branch radial
tree (main feeder 1→11, a zigzag 11→18, and lateral branches at 2, 3, and
6). Bus numbers are shown right under each dot, same as the usual
single-line-diagram convention.

Real per-bus load (P/Q) and per-line impedance (R/X) aren't hardcoded —
each bus defaults to 0 MW/MVAr and each line to a placeholder R/X. Double-
click any bus or line to enter your actual data through the inspector.

If you already have a saved layout from before (persistence — see below),
reloading the page will keep showing *that*, not this new default. Hit
**Reset** (top-right) to switch to the 33-bus topology.

## Interacting with the canvas

- **Add a node** — click a type in the "Add node" panel (top-left) to arm
  it (the button highlights and a banner appears), then click anywhere on
  the canvas to drop the node there. Click the same button again, or press
  `Esc`, to cancel without placing anything.
- **Connect nodes** — drag from any of the 4 dots around a node (top,
  right, bottom, left) to any handle on another node. Connections aren't
  restricted to a fixed top-to-bottom direction — drag from whichever side
  is closest to the other node and it'll route that way, so horizontal
  chains connect right-to-left instead of bending unnecessarily through a
  fixed handle pair.
- **Delete a node or connection** — select it (click) and press
  `Delete`/`Backspace`, or click a line and use the small delete button
  that appears at its midpoint.
- **Edit a node's properties** — double-click it to open the inspector
  sidebar (right side). Substation/Transformer/Generator/Load/Feeder show
  voltage plus every type-specific field (load MW/MVAr, generator P/Q
  limits and cost, transformer ratings, substation slack-bus flag, etc.).
  The generic **Node** shows just active power (P) and reactive power (Q)
  — no voltage field, kept intentionally minimal. See
  `src/components/canvas/NodeInspectorPanel.tsx` for the full field schema
  per component type. Edits write straight into `node.data.params`, which
  is exactly what `mockSolve` reads on the next "Run Optimization".
- **Edit a line's properties** — double-click it to open the same sidebar
  for that connection: resistance (R), reactance (X), and a **color**
  picker (preset swatches, a custom color input, or "A" to reset to
  automatic status coloring — green/amber/red from the last solve). See
  `src/components/canvas/EdgeInspectorPanel.tsx`. R/X are what `mockSolve`
  uses to compute voltage drop and loss; color is purely a manual visual
  override and never feeds into the solver, so recoloring a line for
  visual grouping doesn't touch its actual electrical parameters. Max
  current (I_max) still exists on every line behind the scenes (needed for
  the loading % calculation) but defaults to a fixed value and isn't
  exposed for editing here.

## What's different from the full-stack version

- **No API calls.** `pdnApi.ts` is gone. `TopologyCanvas` calls
  `validateGraph()` and `mockSolve()` locally instead of hitting
  `/api/validate` / `/api/solve`.
- **No MUI.** The solve button and error banner are plain Tailwind markup.
  This sidesteps the `Button`/`Alert`/`CircularProgress` "not a valid JSX
  component" errors, which are a classic symptom of a duplicated/mismatched
  `@types/react` version in `node_modules` rather than anything wrong with
  the component code itself. Removing the dependency removes the failure
  mode entirely.
- **`tsconfig.json` does not enable `exactOptionalPropertyTypes`.** That flag
  is stricter than the default Vite React-TS template and several
  third-party libraries (including `@xyflow/react`'s `BaseEdge`) aren't
  written against it — it was the direct cause of the `markerEnd`/`style`
  errors you hit.

When you're ready to wire this back up to a real backend, drop a
`src/api/pdnApi.ts` back in and swap the `validateGraph`/`mockSolve` calls
in `TopologyCanvas.tsx` for `pdnApi.validate` / `pdnApi.solve`.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). The canvas
loads with a small demo topology (substation → transformer → generator +
2 loads) — click **Run Optimization** to see the mock solve color the edges
and populate the summary chips.

## Files

```
src/
├── types/graph.types.ts        # shared node/edge/result types
├── utils/
│   ├── graphValidation.ts      # orphan/connectivity checks (client-side)
│   ├── mockSolver.ts           # BFS-based radial flow approximation
│   ├── nodeDefaults.ts         # per-type labels/icons/default params
│   ├── graphPersistence.ts     # localStorage save/load/clear
│   └── graphImportExport.ts    # JSON serialize + validated parse for import/export
├── components/
│   ├── nodes/                     # Substation (red bar), Node (dot), Transformer/Generator/Load/Feeder (cards)
│   │   └── FourSideHandles.tsx    # shared top/right/bottom/left connection handles
│   ├── edges/PowerLineEdge.tsx    # status-colored + user-recolorable line rendering
│   └── canvas/
│       ├── TopologyCanvas.tsx
│       ├── NodePalette.tsx         # "Add node" panel
│       ├── NodeInspectorPanel.tsx  # double-click-a-node sidebar
│       ├── EdgeInspectorPanel.tsx  # double-click-a-line sidebar (R, X only)
│       └── GraphIOPanel.tsx        # Import/Export modal
├── App.tsx                     # demo topology + page shell
└── main.tsx
```
