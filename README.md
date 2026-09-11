# Project-PDN

> Interactive Power Distribution Network canvas with client-side Backward-Forward Sweep (BFS) load flow and 24-hour time-series analytics — built for the IITG Predoc research programme.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&labelColor=20232a)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![React Flow](https://img.shields.io/badge/React_Flow-12-FF0072)](https://reactflow.dev)
[![Plotly.js](https://img.shields.io/badge/Plotly.js-2.35-3F4F75?logo=plotly&logoColor=white)](https://plotly.com/javascript/)

**Author:** [@merohit0](https://github.com/merohit0)

---

![Screenshot of frontend](image.png)

---

Draw a radial distribution network on an interactive drag-and-drop canvas, enter per-bus load ($P/Q$) and per-line impedance ($R/X$), and run client-side **BFS load flow** and **24-hour time-series analytics**. Results are overlaid directly on the canvas — buses show voltage, lines show loading percentage color-coded green → amber → red. No backend server required.

---

## Prerequisites

- **Node.js ≥ 18** — run `node -v` to check
- **npm** — bundled with Node

---

## Quick Start

```bash
cd pdn-frontend
npm install
npm run dev
```

Open the local URL (typically `http://localhost:5173`). The canvas loads with the **IEEE 33-bus radial distribution test feeder**.
- Click **Run Optimization** to execute the instantaneous BFS power flow.
- Click **Analytics** (📈 icon) to open the **24-Hour Time-Series BFS Analytics & Profiles** suite.

```bash
# Production build & verification
npm run build
npm run preview   # serve the dist/ folder locally
```

---

## Key Features

| Feature | Details |
|---|---|
| **Drag-and-Drop Canvas** | Pan, zoom, add / move / delete nodes and branches with 4-side orthogonal routing handles. |
| **6 Component Types** | Substation (slack bus), Transformer, Generator, Load, Feeder junction, and generic Node dots. |
| **Instantaneous BFS Solver** | Backward-Forward Sweep power flow calculating bus voltages ($p.u.$), line currents, power losses, and loading %. |
| **Dynamic Line Loading Colors** | Real-time color coding: Green (<85%), Amber (85–99%), Red (≥100% overload). Manual overrides supported. |
| **24-Hour Time-Series Engine** | Multi-interval BFS solver across 96 time-steps (15-min intervals) with per-node customer multipliers. |
| **2D Feeder & Bus Voltage Analytics** | Feeder voltage drop profiles with 24h scrubber, plus single-bus 24-hour voltage profiles with bus-navigation slider. |
| **3D Network Voltage Surface** | High-performance WebGL 3D surface plot ($X$: Bus, $Y$: Time, $Z$: Voltage) with interactive rotate, pan, and zoom. |
| **Energy Losses & Demand Profiles** | 24-hour cumulative energy loss ($kWh$), peak system losses ($kW$), and total network active/reactive demand curves. |
| **Multipliers & Data Manager** | Custom 96-interval JSON load curve upload/download and full 96-step simulation CSV export. |
| **Auto-Persistence** | Entire canvas topology, parameters, and colors automatically saved to `localStorage`. |

---

## 24-Hour Time-Series Analytics Suite

The analytics modal provides distribution engineers and researchers with time-series operational insights:

### 1. 2D Voltage Graphs
- **Feeder Profile Mode (Time $t$)**: Displays the voltage profile along the entire feeder from the substation to lateral branch ends at any 15-minute interval. Features:
  - Playback animation (`▶ Play 24h` / `⏸ Pause`) to watch voltage profiles fluctuate through daily load cycles.
  - Variable playback speeds (**1x**, **2x**, **4x**) with stable frame pacing.
  - Active customer multiplier indicators for Residential, Industrial, and Commercial classes.
- **Single Bus (24h) Profile Mode**: Displays the continuous 24-hour voltage curve for any individual bus against statutory limits (0.95 and 1.05 $p.u.$). Features:
  - Context-aware **Base Node Navigation Bar** with `◀ Prev Bus` and `Next Bus ▶` buttons.
  - **Bus Range Slider** for rapid scrubbing across all 33 network buses.
  - `⭐ Jump to Critical Bus` button to immediately focus on the bus with the lowest 24h voltage.
  - Real-time bus metadata badge: Customer Type, Base $P$ ($kW$), Base $Q$ ($kVAr$), and 24h minimum voltage.

### 2. 3D Network Voltage Surface
- Interactive WebGL surface mapping the entire network state across space and time:
  - **X-Axis**: Bus / Node Number (Bus 1 to Bus 33)
  - **Y-Axis**: Time of Day (00:15 to 24:00 across 96 intervals)
  - **Z-Axis**: Voltage Magnitude ($p.u.$)
- Rendered with standard **Viridis** colormap, depth contour projections, and hover tooltips showing bus, clock time, and exact voltage.

### 3. Daily Losses & Demand
- Plots active power losses ($kW$) over 24 hours and calculates cumulative energy loss ($kWh$).
- Dual-axis curve tracking aggregate customer active demand ($kW$) and reactive demand ($kVAr$) across the day.
- Highlights peak loss time and peak system demand intervals.

### 4. Multipliers & Results Data
- Integrated JSON editor to customize or inspect the 96 load multipliers ($R_{\text{load}}$, $I_{\text{load}}$, $C_{\text{load}}$).
- File upload/download for scenario files.
- **Export CSV Results**: Download complete per-bus voltage matrices, critical buses, and feeder metrics across all 96 intervals in a single click.

---

## Customer Load Modeling

Nodes are classified into customer classes reflecting realistic daily consumption patterns:
- **Residential**: Peaks in the evening (18:00–22:00) and early morning.
- **Commercial**: Peaks during business hours (09:00–18:00).
- **Industrial**: High base load during morning/afternoon production shifts.
- **Substation / Slack**: Zero self-demand; feeds the network at fixed 1.0 $p.u.$ reference voltage.

Each node's demand is scaled at interval $t$ by its customer class multiplier:
$$P_i(t) = P_{\text{base}, i} \times \text{Multiplier}_{\text{customer}, i}(t)$$
$$Q_i(t) = Q_{\text{base}, i} \times \text{Multiplier}_{\text{customer}, i}(t)$$

---

## Recent Updates & Progress

- [x] **Streamlined Top Toolbar**: Removed legacy manual scaling input fields to keep the UI clean, modern, and focused on essential network metrics.
- [x] **Context-Aware 2D Bottom Navigation**:
  - Automatically switches between **Time Scrubber** (in Feeder Profile mode) and **Base Node Scrubber & Controls** (in Single Bus mode).
  - Added Prev/Next bus buttons, a 1–33 bus range slider, and instant "Jump to Critical Bus" navigation.
- [x] **Smooth Animation Engine**:
  - Fixed animation playback speed controls (`1x`, `2x`, `4x`).
  - Implemented step-pacing at a stable 160 ms interval to eliminate Plotly redraw bottlenecks and UI lag.
- [x] **Refined 3D Graph**:
  - Removed clutter (extra metric/palette toggles) in favor of a clean, dedicated 3D voltage surface view.
  - Added explicit $X, Y, Z$ axis parameter tags and rotation tips.
- [x] **X-Axis Tick Formatting**: Cleaned up 24-hour time labels with 2-hour interval spacing (`nticks: 13`) to prevent text overlap.

---

## Component Types

| Type | Rendering | Key Properties |
|---|---|---|
| **Substation** | **Red vertical bar** (SLD convention) | Base voltage, slack-bus flag, max import capacity |
| **Node** | **Small dark circle with bus label** | Active power ($P$), reactive power ($Q$), customer class |
| **Transformer** | Component card | Rated power, primary/secondary voltage, impedance, tap ratio |
| **Generator** | Component card | Max/min $P$ and $Q$, generation cost |
| **Load** | Component card | Active/reactive demand, critical load flag |
| **Feeder** | Component card | Base voltage, junction descriptor |

`Node` is designed for dense topologies (e.g. 33+ buses and 32+ lines) where card-sized elements clutter the canvas. Hover over any node for a quick summary tooltip, or double-click to edit parameters in the Inspector.

---

## Default Demo Topology

The application initializes with the standard **IEEE 33-bus radial distribution test feeder** (Baran & Wu, 1989):
- **Bus 1**: Substation (red vertical bar at $(0, 2)$).
- **Buses 2–33**: Distribution nodes with 32 radial branches.
- **Main Feeder**: Buses 1 → 11 and 11 → 18.
- **Lateral Branches**: Peel off north (buses 5–6–26–33 and 3–23–25) and south (buses 2–19–22).
- **Customer Zoning**: Initialized with mixed Residential, Industrial, and Commercial bus assignments.

---

## Architecture

```
pdn-frontend/
├── src/
│   ├── types/
│   │   └── graph.types.ts            # Shared node, edge, and solver types
│   ├── utils/
│   │   ├── bfsSolver.ts              # Instantaneous BFS power flow solver
│   │   ├── timeSeriesBfsSolver.ts    # 24-hour multi-interval BFS solver engine
│   │   ├── graphValidation.ts        # Connectivity and radiality checks
│   │   ├── graphPersistence.ts       # LocalStorage auto-persistence
│   │   └── graphImportExport.ts      # JSON topology serialization & import
│   ├── data/
│   │   └── defaultTimeSeriesData.ts  # Standard 96-interval load profile dataset
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── PlotlyChart.tsx               # Reactive wrapper for Plotly 2D & WebGL 3D
│   │   │   └── TimeSeriesAnalyticsModal.tsx  # 2D/3D charts, loss analytics, data manager
│   │   ├── canvas/
│   │   │   ├── TopologyCanvas.tsx      # Main React Flow network canvas
│   │   │   ├── NodePalette.tsx         # Component creation tool palette
│   │   │   ├── NodeInspectorPanel.tsx  # Per-bus parameter inspector
│   │   │   ├── EdgeInspectorPanel.tsx  # Branch impedance ($R/X$) and color editor
│   │   │   ├── ResultsPanel.tsx        # Post-solve instantaneous metrics summary
│   │   │   └── GraphIOPanel.tsx        # JSON topology import / export modal
│   │   ├── nodes/                      # Custom node renderers (Substation, Node dot, cards)
│   │   └── edges/                      # Custom branch renderers (PowerLineEdge)
│   ├── App.tsx                         # IEEE 33-bus topology initialization & layout
│   └── main.tsx
```

---

## Research Progress & Roadmap

- [x] **Milestone 1**: Drag-and-drop radial distribution network builder with React Flow.
- [x] **Milestone 2**: Client-side Backward-Forward Sweep (BFS) power flow implementation.
- [x] **Milestone 3**: IEEE 33-bus benchmark topology integration with SLD layout.
- [x] **Milestone 4**: 24-hour time-series BFS solver with 96 discrete 15-minute intervals.
- [x] **Milestone 5**: 2D Feeder profile animations and Single-bus 24h curve inspection.
- [x] **Milestone 6**: 3D WebGL network voltage surface visualization.
- [x] **Milestone 7**: UI/UX refinement — context-aware bottom bar, stable speed controls, decluttered header.
- [ ] **Milestone 8** *(Upcoming)*: Distributed Energy Resource (DER) & Solar PV penetration curves.
- [ ] **Milestone 9** *(Upcoming)*: Electric Vehicle (EV) charging profile integration and stress analysis.
- [ ] **Milestone 10** *(Upcoming)*: Network reconfiguration (tie-switch optimization) for loss minimization.

---

## References

1. M. E. Baran and F. F. Wu, *"Network reconfiguration in distribution systems for load balancing,"* IEEE Transactions on Power Delivery, vol. 4, no. 2, pp. 1401–1407, Apr. 1989.
2. D. Shirmohammadi, H. W. Hong, A. Semlyen, and G. X. Luo, *"A compensation-based power flow approach for weakly meshed distribution and transmission networks,"* IEEE Transactions on Power Systems, vol. 3, no. 2, pp. 753–762, May 1988.

