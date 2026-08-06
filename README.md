# Project-PDN — Frontend (standalone)

Interactive Power Distribution Network canvas. No backend required — "Run
Optimization" runs a client-side mock solver (`src/utils/mockSolver.ts`)
that approximates a radial power flow well enough to drive the overlay
coloring and result summary.

## Interacting with the canvas

- **Add a node** — click a type in the "Add node" panel (top-left) to arm
  it (the button highlights and a banner appears), then click anywhere on
  the canvas to drop the node there. Click the same button again, or press
  `Esc`, to cancel without placing anything.
- **Connect nodes** — drag from the dot on one node to the dot on another.
  Every node has both a source and target handle, so any node can send to,
  or receive from, any number of other nodes — substations, loads, and
  everything in between can all be wired together freely, including
  multiple parallel lines between the same two nodes.
- **Delete a node or connection** — select it (click) and press
  `Delete`/`Backspace`.
- **Recolor a connection** — click it to open its inline toolbar: pick a
  preset color, use the custom color swatch, or hit "A" to go back to
  automatic status coloring (green/amber/red from the last solve).
- **Edit a node's properties** — double-click it to open the inspector
  sidebar (right side). Shows/edits base voltage, voltage limits, and every
  type-specific field (load MW/MVAr, generator P/Q limits and cost,
  transformer ratings, substation slack-bus flag, etc.) — see
  `src/components/canvas/NodeInspectorPanel.tsx` for the full field schema
  per component type. Edits write straight into `node.data.params`, which
  is exactly what `mockSolve` reads on the next "Run Optimization".

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
│   └── mockSolver.ts           # BFS-based radial flow approximation
├── components/
│   ├── nodes/                  # Substation, Transformer, Generator, Load, Feeder
│   ├── edges/PowerLineEdge.tsx # status-colored + user-recolorable line rendering
│   └── canvas/
│       ├── TopologyCanvas.tsx
│       ├── NodePalette.tsx        # "Add node" panel
│       └── NodeInspectorPanel.tsx # double-click sidebar (edit properties)
├── App.tsx                     # demo topology + page shell
└── main.tsx
```
