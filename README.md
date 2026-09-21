# Project-PDN — Coupled PDN & Transportation Network Simulator

> Interactive simulation of **coupled Active Power Distribution and Transportation Networks** with client-side BFS load flow, 24-hour time-series analytics, and road traffic modelling.
>
> **Predoc Research Project** — Department of Electronics and Electrical Engineering, IIT Guwahati

**Research Scholar:** Subhadarshini Panda  
**Supervisor:** Dr. Sanjib Ganguly  
**Research Developer:** @merohit0

---

## Reference Paper

> S. Panda and S. Ganguly, *"Optimal routing and scheduling of electric vehicles in coupled active power distribution and transportation networks using mixed integer programming,"* Sustainable Energy, Grids and Networks (Elsevier), 2026.

---

## What This Project Does

This tool is a **front-end visualisation and simulation platform** for the coupled-network framework described in the reference paper.

The paper formulates a **Mixed Integer Programming (MIP)** model that jointly optimises:

1. **EV routing** across a transportation network
2. **EV charging schedules** at stations that sit on both networks
3. **Power distribution** operation — minimising real power losses while respecting voltage (0.95–1.05 p.u.) and current limits

The two networks are **coupled**: when EVs charge at a transport node, that charging demand appears as additional load on the corresponding bus in the power distribution network. The tool currently implements both networks independently, with the co-simulation and MIP optimisation layers planned next.

---

## Quick Start

```bash
cd pdn-frontend
npm install
npm run dev          # → http://localhost:5173
```

```bash
npm run build        # production build
npm run preview      # preview production build
```

**Prerequisites:** Node.js ≥ 18, npm

---

## Module Overview

The application has **two independent simulation canvases** (switchable from the top bar), each corresponding to one side of the coupled-network formulation:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            App (Tab Switcher)                                │
│                         ┌─────────┐  ┌────────────────┐                      │
│                         │   PDN   │  │ Transportation │                      │
│                         └────┬────┘  └───────┬────────┘                      │
├──────────────────────────────┼───────────────┼───────────────────────────────┤
│                              │               │                               │
│  ┌───────────────────────────▼──┐  ┌────────▼───────────────────────────┐    │
│  │   Power Distribution Network │  │   Transportation Network           │    │
│  │                              │  │                                    │    │
│  │  • IEEE 33-bus test feeder   │  │  • 41-node / 140-road demo         │    │
│  │  • BFS load flow solver      │  │  • Road types: T1 / T2 / T3        │    │
│  │  • 96-step (24h) time-series │  │  • EV charging station nodes       │    │
│  │  • Voltage / loss analytics  │  │  • 96-step traffic profiles        │    │
│  │  • 2D + 3D visualisation     │  │  • 3D traffic surface + 2D plots   │    │
│  └──────────────────────────────┘  └────────────────────────────────────┘    │
│                              │               │                               │
│                              └───────┬───────┘                               │
│                                      │ (planned)                             │
│                         ┌────────────▼────────────┐                          │
│                         │  Co-Simulation / MIP    │                          │
│                         │  (EV demand → PDN load) │                          │
│                         └─────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Source Structure

```
src/
│
├── types/                          ── Data Models ──
│   ├── graph.types.ts                 PDN: bus, branch, solver result types
│   └── transport.types.ts             Transport: road, traffic profile, EV node types
│
├── utils/                          ── Core Logic ──
│   ├── bfsSolver.ts                   Backward-Forward Sweep load flow (complex arithmetic)
│   ├── timeSeriesBfsSolver.ts         Runs BFS across 96 × 15-min intervals
│   ├── mockSolver.ts                  Simplified solver for UI testing
│   ├── graphValidation.ts             Radiality & connectivity checks (PDN)
│   ├── nodeDefaults.ts                Default parameters per component type
│   ├── graphPersistence.ts            Auto-save / restore canvas (PDN → localStorage)
│   ├── graphImportExport.ts           JSON serialisation & import (PDN)
│   ├── transportPersistence.ts        Auto-save / restore canvas (Transport → localStorage)
│   └── transportImportExport.ts       JSON serialisation & validated import (Transport)
│
├── data/                           ── Built-in Datasets ──
│   ├── defaultTimeSeriesData.ts       96-interval load multiplier curves (R / I / C)
│   ├── demoTransportNetwork.json      41-node / 140-road demo network + traffic profiles
│   └── demoTransportNetwork.ts        Loader & normaliser for the demo JSON
│
├── components/
│   ├── canvas/                     ── PDN Canvas ──
│   │   ├── TopologyCanvas.tsx         Main React Flow canvas for the distribution network
│   │   ├── NodePalette.tsx            Drag-to-add component palette
│   │   ├── NodeInspectorPanel.tsx      Per-bus parameter editor (P, Q, class, voltage)
│   │   ├── EdgeInspectorPanel.tsx      Branch editor (R, X, max current, color)
│   │   ├── ResultsPanel.tsx           Post-solve metrics summary
│   │   └── GraphIOPanel.tsx           JSON import / export modal
│   │
│   ├── analytics/                  ── PDN Analytics ──
│   │   ├── PlotlyChart.tsx            Reactive Plotly wrapper (2D + WebGL 3D)
│   │   └── TimeSeriesAnalyticsModal.tsx
│   │       ├─ 2D: Feeder voltage profile (animated) + single-bus 24h curve
│   │       ├─ 3D: Bus × Time × Voltage surface (Viridis, WebGL)
│   │       ├─ Losses & demand: 24h kW loss, cumulative kWh, P/Q demand
│   │       └─ Data manager: JSON multiplier editor, CSV export
│   │
│   ├── transport/                  ── Transportation Canvas & Analytics ──
│   │   ├── TransportCanvas.tsx        Main React Flow canvas for road network
│   │   ├── TransportNodeView.tsx      Node renderer (EV station = blue, junction = grey)
│   │   ├── TransportRoadEdge.tsx      Road renderer (color-coded by T1/T2/T3 type)
│   │   ├── TransportNodeInspector.tsx Node editor (EV flag, voltage kV, power kW)
│   │   ├── TransportRoadInspector.tsx Road editor (type, number, label)
│   │   ├── TransportIOPanel.tsx       JSON import / export modal
│   │   └── TrafficAnalyticsModal.tsx  3D traffic surface + 2D type-profile curves
│   │
│   ├── nodes/                      ── PDN Node Renderers ──
│   │   ├── SubstationBarNode.tsx      Red vertical bar (SLD substation symbol)
│   │   ├── DotNode.tsx                Compact circle for dense bus layouts
│   │   ├── BaseNode.tsx               Card-style node (Transformer, Generator, Load, Feeder)
│   │   ├── FourSideHandles.tsx        4-side connection handles (top/right/bottom/left)
│   │   └── index.tsx                  Node type registry
│   │
│   └── edges/                      ── PDN Edge Renderer ──
│       └── PowerLineEdge.tsx          Branch line with dynamic loading color
│
├── App.tsx                         App shell: IEEE 33-bus init + PDN / Transport tab switcher
└── main.tsx                        Entry point
```

---

## PDN Canvas — Key Capabilities

| Capability | Detail |
|---|---|
| **Network Builder** | Pan, zoom, drag-and-drop buses and branches with 4-side handles |
| **6 Component Types** | Substation, Transformer, Generator, Load, Feeder, compact Node dot |
| **BFS Load Flow** | Full complex-arithmetic Backward-Forward Sweep — voltages (p.u.), currents, losses, loading % |
| **Line Loading Colors** | Green (<85 %) · Amber (85–99 %) · Red (≥100 % overload) |
| **24h Time-Series** | 96 × 15-min BFS with Residential / Commercial / Industrial multipliers |
| **2D Analytics** | Feeder voltage profile (animated 1×/2×/4×) · Single-bus 24h voltage curve |
| **3D Surface** | Bus × Time × Voltage (p.u.) WebGL surface with Viridis colormap |
| **Loss & Demand** | 24h active loss (kW), energy loss (kWh), aggregate P + Q demand |
| **Data I/O** | JSON import/export · 96-slot multiplier editor · CSV simulation export |
| **Auto-Persistence** | Full canvas state saved to localStorage automatically |

### Default Topology — IEEE 33-Bus Test Feeder

Baran & Wu (1989) — 33 buses, 32 radial branches, 12.66 kV base voltage. Main feeder: 1 → 18. Laterals: north (3–25, 6–33) and south (2–22). Bus loads initialised with mixed Residential / Commercial / Industrial customer types.

---

## Transportation Canvas — Key Capabilities

| Capability | Detail |
|---|---|
| **Road Network Builder** | Pan, zoom, add / move / delete transport nodes and road edges |
| **3 Road Types** | T1 (green) · T2 (amber) · T3 (red) — each with a 96-slot daily vehicle profile |
| **EV Charging Stations** | Any node can be marked as a charging station with voltage (kV) and power draw (kW) |
| **3D Traffic Surface** | Road × Time × Vehicle count (WebGL) |
| **2D Profiles** | Per-type 24h traffic curves with animated playback scrubber |
| **Data I/O** | JSON import/export with strict schema validation |
| **Auto-Persistence** | Canvas + traffic profiles auto-saved to localStorage |

### Default Topology — 41-Node Demo Network

41 transport nodes (intersections and EV stations), 140 roads with T1/T2/T3 type assignments, and pre-loaded 96-slot traffic profiles. EV station nodes represent the **coupling points** where transport-side charging demand will map to PDN bus loads in the co-simulation.

---

## BFS Load Flow — How It Works

The solver (`bfsSolver.ts`) implements the standard Backward-Forward Sweep for radial distribution networks:

**Backward sweep** — leaf → substation: accumulate complex current injections at each bus

$$I_k = \frac{P_k - jQ_k}{V_k^*}$$

**Forward sweep** — substation → leaves: update voltages using branch impedances

$$V_{k+1} = V_k - Z_{k,k+1} \cdot I_{k,k+1}$$

**Convergence**: $\|V^{(n+1)} - V^{(n)}\|_\infty < \varepsilon$

**Line loss**: $P_{\text{loss},k} = |I_{k,k+1}|^2 \cdot R_{k,k+1}$

The 24h engine (`timeSeriesBfsSolver.ts`) runs this independently at each of the 96 slots, scaling bus demand by the per-class multiplier:

$$P_i(t) = P_{\text{base},i} \times m_{\text{class}(i)}(t)$$

---

## Customer Load Classes

| Class | Peak Pattern |
|---|---|
| **Residential** | Evening (18:00–22:00) and early morning |
| **Commercial** | Business hours (09:00–18:00) |
| **Industrial** | Sustained load during production shifts |
| **Substation** | Slack bus — zero demand, fixed 1.0 p.u. reference |

---

## Progress & Roadmap

### Completed

- [x] **M1** — Drag-and-drop PDN canvas with React Flow
- [x] **M2** — BFS load flow solver (complex arithmetic)
- [x] **M3** — IEEE 33-bus test feeder topology
- [x] **M4** — 24-hour time-series BFS engine (96 × 15-min intervals)
- [x] **M5** — 2D voltage analytics: feeder profile animation + single-bus 24h curve
- [x] **M6** — 3D WebGL voltage surface
- [x] **M7** — UI/UX polish: context-aware nav, playback speed, decluttered toolbar
- [x] **M8** — Transportation canvas: road network, T1/T2/T3 types, EV stations, traffic analytics, JSON I/O

### Upcoming

- [ ] **M9** — EV charging demand coupling: transport-layer EV power draw → PDN bus loads → re-run BFS
- [ ] **M10** — MIP co-optimisation solver (per the reference paper): joint EV routing + charging schedule + PDN constraints + SOC dynamics
- [ ] **M11** — DER / Solar PV injection profiles on PDN buses
- [ ] **M12** — Network reconfiguration (tie-switch optimisation for loss minimisation)
- [ ] **M13** — Results dashboard: before/after comparison under MIP-optimal vs. uncoordinated baseline

---

## References

1. S. Panda and S. Ganguly, *"Optimal routing and scheduling of electric vehicles in coupled active power distribution and transportation networks using mixed integer programming,"* Sustainable Energy, Grids and Networks, Elsevier, 2026.
2. M. E. Baran and F. F. Wu, *"Network reconfiguration in distribution systems for load balancing,"* IEEE Trans. Power Delivery, vol. 4, no. 2, pp. 1401–1407, 1989.
3. D. Shirmohammadi et al., *"A compensation-based power flow approach for weakly meshed distribution and transmission networks,"* IEEE Trans. Power Systems, vol. 3, no. 2, pp. 753–762, 1988.
