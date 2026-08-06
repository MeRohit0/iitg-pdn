import React from 'react';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { ComponentType, type PdnEdge, type PdnNode } from './types/graph.types';

const demoNodes: PdnNode[] = [
  {
    id: 'sub1',
    type: ComponentType.SUBSTATION,
    position: { x: 250, y: 0 },
    data: {
      label: 'Main Substation',
      componentType: ComponentType.SUBSTATION,
      params: { baseVoltageKv: 11, isSlackBus: true },
    },
  },
  {
    id: 'tx1',
    type: ComponentType.TRANSFORMER,
    position: { x: 250, y: 120 },
    data: {
      label: 'T1',
      componentType: ComponentType.TRANSFORMER,
      params: {
        baseVoltageKv: 11,
        ratedPowerMva: 5,
        primaryKv: 11,
        secondaryKv: 0.4,
        impedancePct: 5,
      },
    },
  },
  {
    id: 'gen1',
    type: ComponentType.GENERATOR,
    position: { x: 50, y: 240 },
    data: {
      label: 'MEG-1',
      componentType: ComponentType.GENERATOR,
      params: { baseVoltageKv: 0.4, pMaxMw: 1.2, costPerMwh: 65 },
    },
  },
  {
    id: 'load1',
    type: ComponentType.LOAD,
    position: { x: 250, y: 240 },
    data: {
      label: 'Residential Block A',
      componentType: ComponentType.LOAD,
      params: { baseVoltageKv: 0.4, pDemandMw: 1.8, qDemandMvar: 0.4 },
    },
  },
  {
    id: 'load2',
    type: ComponentType.LOAD,
    position: { x: 450, y: 240 },
    data: {
      label: 'Residential Block B',
      componentType: ComponentType.LOAD,
      params: { baseVoltageKv: 0.4, pDemandMw: 1.1, qDemandMvar: 0.25 },
    },
  },
];

const demoEdges: PdnEdge[] = [
  {
    id: 'e-sub-tx',
    source: 'sub1',
    target: 'tx1',
    type: 'powerLine',
    data: { resistanceOhm: 0.05, reactanceOhm: 0.08, maxCurrentA: 800 },
  },
  {
    id: 'e-tx-gen',
    source: 'tx1',
    target: 'gen1',
    type: 'powerLine',
    data: { resistanceOhm: 0.2, reactanceOhm: 0.15, maxCurrentA: 300 },
  },
  {
    id: 'e-tx-load1',
    source: 'tx1',
    target: 'load1',
    type: 'powerLine',
    data: { resistanceOhm: 0.3, reactanceOhm: 0.2, maxCurrentA: 250 },
  },
  {
    id: 'e-tx-load2',
    source: 'tx1',
    target: 'load2',
    type: 'powerLine',
    data: { resistanceOhm: 0.35, reactanceOhm: 0.22, maxCurrentA: 200 },
  },
];

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      <header className="px-4 py-2 border-b border-slate-200 bg-white shadow-sm">
        <h1 className="text-sm font-semibold text-slate-800">
          Project-PDN <span className="text-slate-400 font-normal">— Topology Canvas (standalone demo)</span>
        </h1>
      </header>
      <main className="flex-1">
        <TopologyCanvas initialNodes={demoNodes} initialEdges={demoEdges} />
      </main>
    </div>
  );
};

export default App;
