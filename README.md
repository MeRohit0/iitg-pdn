# Project-PDN — Frontend (standalone)

Interactive Power Distribution Network canvas. No backend required — "Run
Optimization" runs a client-side mock solver (`src/utils/mockSolver.ts`)
that approximates a radial power flow well enough to drive the overlay
coloring and result summary.

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
│   ├── edges/PowerLineEdge.tsx # status-colored line rendering
│   └── canvas/TopologyCanvas.tsx
├── App.tsx                     # demo topology + page shell
└── main.tsx
```
