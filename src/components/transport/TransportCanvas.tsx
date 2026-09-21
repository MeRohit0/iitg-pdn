import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { transportNodeTypes } from './TransportNodeView';
import { transportEdgeTypes } from './TransportRoadEdge';
import { TransportNodeInspector } from './TransportNodeInspector';
import { TransportRoadInspector } from './TransportRoadInspector';
import { TransportIOPanel } from './TransportIOPanel';
import { TrafficAnalyticsModal } from './TrafficAnalyticsModal';
import { getDemoTransportNetwork, normalizeRoadHandles } from '../../data/demoTransportNetwork';
import {
  clearPersistedTransport,
  loadPersistedTransport,
  savePersistedTransport,
} from '../../utils/transportPersistence';
import {
  ROAD_TYPE_COLORS,
  ROAD_TYPE_LABELS,
  ROAD_TYPES,
  type TrafficProfiles,
  type TransportNode,
  type TransportRoad,
} from '../../types/transport.types';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type InspectorTarget = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

const TransportCanvasInner: React.FC = () => {
  const { screenToFlowPosition, fitView } = useReactFlow();

  const persisted = useMemo(() => loadPersistedTransport(), []);
  const demo = useMemo(() => getDemoTransportNetwork(), []);

  const [nodes, setNodes] = useState<TransportNode[]>(persisted?.nodes ?? demo.nodes);
  const [roads, setRoads] = useState<TransportRoad[]>(
    (persisted?.roads ?? demo.roads).map(normalizeRoadHandles)
  );
  const [trafficProfiles, setTrafficProfiles] = useState<TrafficProfiles>(
    persisted?.trafficProfiles ?? demo.trafficProfiles
  );
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  const [pendingPlaceNode, setPendingPlaceNode] = useState(false);
  const [isIOPanelOpen, setIsIOPanelOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [focusRoadNumber, setFocusRoadNumber] = useState<number | null>(null);
  const [selectedRoadNumber, setSelectedRoadNumber] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      savePersistedTransport(nodes, roads, trafficProfiles);
    }, 400);
    return () => clearTimeout(timer);
  }, [nodes, roads, trafficProfiles]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as TransportNode[]);
      const removedIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id)
      );
      if (removedIds.size > 0) {
        setInspectorTarget((target) => (target?.kind === 'node' && removedIds.has(target.id) ? null : target));
      }
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRoads((eds) => applyEdgeChanges(changes, eds) as TransportRoad[]);
      const removedIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id)
      );
      if (removedIds.size > 0) {
        setInspectorTarget((target) => (target?.kind === 'edge' && removedIds.has(target.id) ? null : target));
      }
    },
    []
  );

  const nextNodeLabel = useCallback(() => {
    const used = nodes
      .map((n) => parseInt(n.data?.label, 10))
      .filter((n) => Number.isFinite(n));
    return String((used.length ? Math.max(...used) : 0) + 1);
  }, [nodes]);

  const nextRoadNumber = useCallback(() => {
    const used = roads.map((r) => r.data?.roadNumber ?? 0);
    return (used.length ? Math.max(...used) : 0) + 1;
  }, [roads]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const roadNumber = nextRoadNumber();
      const newRoad: TransportRoad = {
        id: makeId('road'),
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'transportRoad',
        data: {
          roadNumber,
          roadType: null,
          label: `R${roadNumber}`,
        },
      };
      setRoads((eds) => [...eds, newRoad]);
    },
    [nextRoadNumber]
  );

  const isValidConnection = useCallback(
    (connection: Connection | TransportRoad) => connection.source !== connection.target,
    []
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingPlaceNode) {
        setInspectorTarget(null);
        return;
      }
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = makeId('node');
      const label = nextNodeLabel();
      const newNode: TransportNode = {
        id,
        type: 'transportNode',
        position,
        data: {
          label,
          isEvChargingStation: false,
          voltageKv: 0.4,
          powerDrawKw: 0,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setPendingPlaceNode(false);
      setInspectorTarget({ kind: 'node', id });
    },
    [pendingPlaceNode, screenToFlowPosition, nextNodeLabel]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingPlaceNode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNodeDoubleClick = useCallback((_e: React.MouseEvent, node: TransportNode) => {
    setInspectorTarget({ kind: 'node', id: node.id });
  }, []);

  const handleEdgeDoubleClick = useCallback((_e: React.MouseEvent, edge: TransportRoad) => {
    setInspectorTarget({ kind: 'edge', id: edge.id });
    setSelectedRoadNumber(edge.data?.roadNumber ?? null);
  }, []);

  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: TransportRoad) => {
    setSelectedRoadNumber(edge.data?.roadNumber ?? null);
  }, []);

  const inspectorNode = useMemo(() => {
    if (inspectorTarget?.kind !== 'node') return null;
    return nodes.find((n) => n.id === inspectorTarget.id) ?? null;
  }, [inspectorTarget, nodes]);

  const inspectorRoad = useMemo(() => {
    if (inspectorTarget?.kind !== 'edge') return null;
    return roads.find((r) => r.id === inspectorTarget.id) ?? null;
  }, [inspectorTarget, roads]);

  const inspectorRoadSourceLabel = useMemo(() => {
    if (!inspectorRoad) return '';
    return nodes.find((n) => n.id === inspectorRoad.source)?.data.label ?? inspectorRoad.source;
  }, [inspectorRoad, nodes]);

  const inspectorRoadTargetLabel = useMemo(() => {
    if (!inspectorRoad) return '';
    return nodes.find((n) => n.id === inspectorRoad.target)?.data.label ?? inspectorRoad.target;
  }, [inspectorRoad, nodes]);

  const handleChangeNode = useCallback(
    (patch: Partial<TransportNode['data']>) => {
      if (!inspectorNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectorNode.id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      );
    },
    [inspectorNode]
  );

  const handleChangeRoad = useCallback(
    (patch: Partial<TransportRoad['data']>) => {
      if (!inspectorRoad) return;
      setRoads((eds) =>
        eds.map((e) =>
          e.id === inspectorRoad.id
            ? { ...e, data: { ...e.data!, ...patch } }
            : e
        )
      );
    },
    [inspectorRoad]
  );

  const handleImport = useCallback(
    (importedNodes: TransportNode[], importedRoads: TransportRoad[], profiles: TrafficProfiles) => {
      setNodes(importedNodes);
      setRoads(importedRoads.map(normalizeRoadHandles));
      setTrafficProfiles(profiles);
      setInspectorTarget(null);
      setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50);
    },
    [fitView]
  );

  const handleResetToDemo = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the transportation network to default demo topology? This clears your saved layout and edits.'
    );
    if (!confirmed) return;
    clearPersistedTransport();
    const fresh = getDemoTransportNetwork();
    setNodes(fresh.nodes);
    setRoads(fresh.roads);
    setTrafficProfiles(fresh.trafficProfiles);
    setInspectorTarget(null);
    setSelectedRoadNumber(null);
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50);
  }, [fitView]);

  const openAnalytics = useCallback(() => {
    setFocusRoadNumber(selectedRoadNumber);
    setIsAnalyticsOpen(true);
  }, [selectedRoadNumber]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow<TransportNode, TransportRoad>
        nodes={nodes}
        edges={roads}
        nodeTypes={transportNodeTypes}
        edgeTypes={transportEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ cursor: pendingPlaceNode ? 'crosshair' : undefined }}
        fitView
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {/* Palette */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setPendingPlaceNode((p) => !p)}
          className={`rounded-md border px-3 py-2 text-xs font-medium shadow transition-colors ${
            pendingPlaceNode
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {pendingPlaceNode ? 'Click canvas to place…' : 'Add node'}
        </button>

        <div className="rounded-md border border-slate-200 bg-white/95 shadow px-3 py-2 text-[11px] text-slate-600 space-y-1.5">
          <div className="font-semibold text-slate-700 uppercase tracking-wide text-[10px]">Legend</div>
          {ROAD_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-6 rounded"
                style={{ backgroundColor: ROAD_TYPE_COLORS[t] }}
              />
              {ROAD_TYPE_LABELS[t]} ({t})
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-6 rounded"
              style={{ backgroundColor: ROAD_TYPE_COLORS.default }}
            />
            Unset
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-[7px] font-black text-white">
              EV
            </span>
            Charging station
          </div>
        </div>
      </div>

      {pendingPlaceNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-md bg-indigo-600 text-white shadow px-3 py-1.5 text-xs font-medium">
          Click on the canvas to place a node · Esc to cancel
        </div>
      )}

      {inspectorNode && (
        <TransportNodeInspector
          node={inspectorNode}
          onClose={() => setInspectorTarget(null)}
          onChange={handleChangeNode}
        />
      )}

      {inspectorRoad && (
        <TransportRoadInspector
          road={inspectorRoad}
          sourceLabel={inspectorRoadSourceLabel}
          targetLabel={inspectorRoadTargetLabel}
          onClose={() => setInspectorTarget(null)}
          onChange={handleChangeRoad}
        />
      )}

      {isIOPanelOpen && (
        <TransportIOPanel
          nodes={nodes}
          roads={roads}
          trafficProfiles={trafficProfiles}
          onImport={handleImport}
          onClose={() => setIsIOPanelOpen(false)}
        />
      )}

      {isAnalyticsOpen && (
        <TrafficAnalyticsModal
          roads={roads}
          trafficProfiles={trafficProfiles}
          focusRoadNumber={focusRoadNumber}
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}

      <div className="absolute bottom-4 left-4 max-w-xs rounded-md bg-white/90 border border-slate-200 shadow px-3 py-1.5 text-[11px] text-slate-500">
        Add / drag nodes · connect to create roads · double-click to edit · roads colored by
        type (T1 green, T2 orange, T3 red).
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={openAnalytics}
          title="Open 3D traffic surface and type profiles"
          className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2.5 py-2 text-xs font-medium text-indigo-700 shadow hover:bg-indigo-100 transition-colors"
        >
          Traffic Analytics
        </button>
        <button
          type="button"
          onClick={() => setIsIOPanelOpen(true)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow hover:bg-slate-50 transition-colors"
        >
          Import / Export
        </button>
        <button
          type="button"
          onClick={handleResetToDemo}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow hover:bg-slate-50 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export const TransportCanvas: React.FC = () => (
  <ReactFlowProvider>
    <TransportCanvasInner />
  </ReactFlowProvider>
);
