import React from 'react';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { ComponentType, type PdnEdge, type PdnNode } from './types/graph.types';

// IEEE 33-bus radial distribution test feeder (Baran & Wu, 1989) — the
// standard reference topology. Grid position for each bus approximates the
// usual single-line-diagram layout: a main feeder running left-to-right
// (buses 1–11, then zigzagging 11→18), with lateral branches peeling off
// north (5-6-26-27-28-29..33, 3-23-24-25) and south (2-19-20-21-22).
// [column, row] — row 0 is the topmost lateral, row 2 is the main feeder.
const BUS_GRID: Record<number, [col: number, row: number]> = {
  1: [0, 2],
  2: [1, 2],
  3: [2, 2],
  4: [3, 2],
  5: [3, 1],
  6: [4, 1],
  7: [4, 2],
  8: [5, 2],
  9: [6, 2],
  10: [7, 2],
  11: [8, 2],
  12: [8, 3],
  13: [9, 3],
  14: [9, 2],
  15: [10, 2],
  16: [10, 3],
  17: [11, 3],
  18: [11, 2],
  19: [1, 3],
  20: [2, 3],
  21: [3, 3],
  22: [4, 3],
  23: [2, 0],
  24: [3, 0],
  25: [4, 0],
  26: [5, 1],
  27: [6, 1],
  28: [7, 1],
  29: [7, 0],
  30: [8, 0],
  31: [9, 0],
  32: [10, 0],
  33: [11, 0],
};

// The 32 branches of the radial tree — standard IEEE 33-bus branch list.
const BRANCHES: [from: number, to: number][] = [
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18],
  [2, 19], [19, 20], [20, 21], [21, 22],
  [3, 23], [23, 24], [24, 25],
  [6, 26], [26, 27], [27, 28], [28, 29], [29, 30], [30, 31], [31, 32], [32, 33],
];

const COL_WIDTH = 110;
const ROW_HEIGHT = 130;
// 12.66 kV is the standard base voltage for this test feeder.
const BASE_VOLTAGE_KV = 12.66;

function buildDemoNodes(): PdnNode[] {
  return Object.entries(BUS_GRID).map(([busStr, [col, row]]) => {
    const bus = Number(busStr);
    const id = `bus${bus}`;
    const position = { x: col * COL_WIDTH, y: row * ROW_HEIGHT };

    if (bus === 1) {
      const node: PdnNode = {
        id,
        type: ComponentType.SUBSTATION,
        position,
        data: {
          label: '1',
          componentType: ComponentType.SUBSTATION,
          params: { baseVoltageKv: BASE_VOLTAGE_KV, isSlackBus: true },
        },
      };
      return node;
    }

    // Real P/Q demand per bus isn't hardcoded here — double-click any bus
    // to enter its actual load from your own data via the inspector.
    const node: PdnNode = {
      id,
      type: ComponentType.NODE,
      position,
      data: {
        label: String(bus),
        componentType: ComponentType.NODE,
        params: { baseVoltageKv: BASE_VOLTAGE_KV, activePowerMw: 0, reactivePowerMvar: 0 },
      },
    };
    return node;
  });
}

/** Picks which of the 4 side-handles each end of a branch should use,
 *  based on the two buses' relative grid position — so e.g. a horizontal
 *  branch like 7→8 connects right-to-left instead of routing through the
 *  top/bottom handles and bending unnecessarily. */
function pickHandles(
  from: [col: number, row: number],
  to: [col: number, row: number]
): { sourceHandle: string; targetHandle: string } {
  const [fromCol, fromRow] = from;
  const [toCol, toRow] = to;
  const dCol = toCol - fromCol;
  const dRow = toRow - fromRow;

  if (Math.abs(dCol) >= Math.abs(dRow)) {
    return dCol >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }
  return dRow >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}

function buildDemoEdges(): PdnEdge[] {
  return BRANCHES.map(([from, to]) => {
    const { sourceHandle, targetHandle } = pickHandles(BUS_GRID[from], BUS_GRID[to]);
    const edge: PdnEdge = {
      id: `edge-${from}-${to}`,
      source: `bus${from}`,
      target: `bus${to}`,
      sourceHandle,
      targetHandle,
      type: 'powerLine',
      // Placeholder R/X — edit per line via double-click once you have the
      // real branch impedance data for your feeder.
      data: { resistanceOhm: 0.05, reactanceOhm: 0.03, maxCurrentA: 400 },
    };
    return edge;
  });
}

const demoNodes: PdnNode[] = buildDemoNodes();
const demoEdges: PdnEdge[] = buildDemoEdges();

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      <header className="px-4 py-2 border-b border-slate-200 bg-white shadow-sm">
        <h1 className="text-sm font-semibold text-slate-800">
          Project-PDN{' '}
          <span className="text-slate-400 font-normal">
            — IEEE 33-bus radial test feeder (standalone demo)
          </span>
        </h1>
      </header>
      <main className="flex-1">
        <TopologyCanvas initialNodes={demoNodes} initialEdges={demoEdges} />
      </main>
    </div>
  );
};

export default App;
