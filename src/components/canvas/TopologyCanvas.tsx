import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges/PowerLineEdge';
import { NodePalette } from './NodePalette';
import { NodeInspectorPanel } from './NodeInspectorPanel';
import { validateGraph, type ValidationIssue } from '../../utils/graphValidation';
import { mockSolve } from '../../utils/mockSolver';
import { defaultParamsFor, TYPE_LABELS } from '../../utils/nodeDefaults';
import {
  ComponentType,
  SolveStatus,
  type OptimizationResult,
  type PdnEdge,
  type PdnNode,
} from '../../types/graph.types';

interface TopologyCanvasProps {
  initialNodes: PdnNode[];
  initialEdges: PdnEdge[];
  /** Bubbles the currently-selected element up to the Inspector Panel. */
  onSelectionChange?: (selection: { nodes: PdnNode[]; edges: PdnEdge[] }) => void;
}

/** Generates a short, collision-resistant id without pulling in a uuid dep. */
function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Interactive Topology Canvas (/canvas) — fully standalone.
 * No backend calls: "Run Optimization" runs `mockSolve` synchronously in
 * the browser so the canvas, overlay coloring, and result summary are all
 * demoable without a FastAPI/docplex server running.
 *
 * Wrapped in `ReactFlowProvider` (see the default export below) so the
 * click-to-place add-node flow can use `useReactFlow().screenToFlowPosition`
 * from a sibling of <ReactFlow>, not just from inside it.
 */
const TopologyCanvasInner: React.FC<TopologyCanvasProps> = ({
  initialNodes,
  initialEdges,
  onSelectionChange,
}) => {
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<PdnNode[]>(initialNodes);
  const [edges, setEdges] = useState<PdnEdge[]>(
    initialEdges.map((e) => ({ ...e, type: e.type ?? 'powerLine' }))
  );
  const [isSolving, setIsSolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null);
  // When set, the next click on empty canvas places a node of this type
  // instead of just deselecting everything.
  const [pendingNodeType, setPendingNodeType] = useState<ComponentType | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as PdnNode[]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as PdnEdge[]),
    []
  );

  const onConnect = useCallback((connection: Connection) => {
    // Build the edge manually with a guaranteed-unique id (rather than
    // relying on the `addEdge` helper's derived id) so multiple parallel
    // lines between the same two nodes — or several lines fanning out from
    // one node — are always added instead of silently deduped.
    const newEdge: PdnEdge = {
      id: makeId('edge'),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'powerLine',
      data: {
        resistanceOhm: 0.1,
        reactanceOhm: 0.1,
        maxCurrentA: 400,
      },
    };
    setEdges((eds) => [...eds, newEdge]);
  }, []);

  // Blocks a node from being wired to itself while dragging a new
  // connection; everything else — including multiple lines between the
  // same two nodes, or many lines fanning out of one node — is allowed.
  const isValidConnection = useCallback(
    (connection: Connection) => connection.source !== connection.target,
    []
  );

  /** Arms/disarms "click to place" mode for the given type. Clicking the
   *  already-armed type again cancels it. */
  const handleSelectPaletteType = useCallback((type: ComponentType) => {
    setPendingNodeType((current) => (current === type ? null : type));
  }, []);

  const addNodeAt = useCallback((type: ComponentType, position: { x: number; y: number }) => {
    setNodes((nds) => {
      const countOfType = nds.filter((n) => n.data.componentType === type).length;
      const newNode: PdnNode = {
        id: makeId(type),
        type,
        position,
        data: {
          label: `${TYPE_LABELS[type]} ${countOfType + 1}`,
          componentType: type,
          params: defaultParamsFor(type),
        },
      };
      return [...nds, newNode];
    });
  }, []);

  /** Click on empty canvas: if a palette type is armed, place a node there
   *  (converting the screen click position into canvas/flow coordinates);
   *  otherwise this is just a normal deselect-click. */
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingNodeType) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNodeAt(pendingNodeType, position);
      setPendingNodeType(null);
    },
    [pendingNodeType, screenToFlowPosition, addNodeAt]
  );

  // Esc cancels an armed placement without requiring a click on the canvas.
  useEffect(() => {
    if (!pendingNodeType) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingNodeType(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingNodeType]);

  // The node currently open in the inspector sidebar, re-derived from
  // `nodes` on every render so edits (and deletions) stay in sync — no
  // separate "editing copy" of the node to drift out of date.
  const inspectorNode = useMemo(
    () => nodes.find((n) => n.id === inspectorNodeId) ?? null,
    [nodes, inspectorNodeId]
  );

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: PdnNode) => {
    setInspectorNodeId(node.id);
  }, []);

  const handleChangeNodeLabel = useCallback(
    (label: string) => {
      if (!inspectorNodeId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === inspectorNodeId ? { ...n, data: { ...n.data, label } } : n))
      );
    },
    [inspectorNodeId]
  );

  const handleChangeNodeParam = useCallback(
    (key: string, value: number | boolean | undefined) => {
      if (!inspectorNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectorNodeId
            ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
            : n
        )
      );
    },
    [inspectorNodeId]
  );

  /** Merges an OptimizationResult into node/edge `data.result` so the
   *  overlay (colors, voltage labels) renders without a separate pass. */
  const applyResultOverlay = useCallback((result: OptimizationResult) => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, result: result.nodeResults[n.id] },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, result: result.edgeResults[e.id] },
      }))
    );
  }, []);

  const handleSolve = useCallback(() => {
    setIsSolving(true);
    setErrorMessage(null);

    // setTimeout keeps the "Solving…" state visible for a beat even though
    // mockSolve itself is synchronous — swap this for a real async call
    // (e.g. `await pdnApi.solve({ nodes, edges })`) once a backend exists.
    setTimeout(() => {
      try {
        const validation = validateGraph(nodes, edges);
        if (!validation.isValid) {
          const messages = validation.issues
            .filter((issue: ValidationIssue) => issue.severity === 'error')
            .map((issue: ValidationIssue) => issue.message);
          setErrorMessage(messages.join(' '));
          return;
        }

        const result = mockSolve(nodes, edges);
        setLastResult(result);
        applyResultOverlay(result);

        if (
          result.summary.status === SolveStatus.INFEASIBLE ||
          result.summary.status === SolveStatus.ERROR
        ) {
          setErrorMessage(result.summary.message ?? 'Solve did not complete successfully.');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unexpected error while solving.');
      } finally {
        setIsSolving(false);
      }
    }, 300);
  }, [nodes, edges, applyResultOverlay]);

  const summaryChips = useMemo(() => {
    if (!lastResult) return null;
    const { summary } = lastResult;
    return (
      <div className="flex gap-3 rounded-md bg-white/90 border border-slate-200 shadow px-3 py-1.5 text-xs text-slate-600">
        <span>Loss: {summary.totalSystemLossMw?.toFixed(3)} MW</span>
        <span>Gen: {summary.totalGenerationMw?.toFixed(2)} MW</span>
        <span>Demand: {summary.totalDemandMw?.toFixed(2)} MW</span>
        <span>Cost: ${summary.objectiveValue?.toFixed(2)}</span>
      </div>
    );
  }, [lastResult]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow<PdnNode, PdnEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={(sel) =>
          onSelectionChange?.({ nodes: sel.nodes as PdnNode[], edges: sel.edges as PdnEdge[] })
        }
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ cursor: pendingNodeType ? 'crosshair' : undefined }}
        fitView
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      <NodePalette activeType={pendingNodeType} onSelectType={handleSelectPaletteType} />

      {pendingNodeType && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-md bg-indigo-600 text-white shadow px-3 py-1.5 text-xs font-medium">
          Click on the canvas to place a {TYPE_LABELS[pendingNodeType]} · Esc to cancel
        </div>
      )}

      {inspectorNode && (
        <NodeInspectorPanel
          node={inspectorNode}
          onClose={() => setInspectorNodeId(null)}
          onChangeLabel={handleChangeNodeLabel}
          onChangeParam={handleChangeNodeParam}
        />
      )}

      {!errorMessage && (
        <div className="absolute bottom-4 left-4 max-w-xs rounded-md bg-white/90 border border-slate-200 shadow px-3 py-1.5 text-[11px] text-slate-500">
          Pick a type in "Add node" then click the canvas to place it · drag
          between dots to connect nodes (any node can have many connections)
          · click a line to recolor or delete it · double-click a node to
          edit its properties.
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleSolve}
          disabled={isSolving}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSolving && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {isSolving ? 'Solving…' : 'Run Optimization'}
        </button>
        {summaryChips}
      </div>

      {errorMessage && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 shadow">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-medium leading-none"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Public export — wraps the canvas in its own ReactFlowProvider so it can
 *  be dropped anywhere without the parent needing to set one up. If you
 *  already wrap your app in a ReactFlowProvider elsewhere, this nested one
 *  is harmless (xyflow supports nested providers). */
export const TopologyCanvas: React.FC<TopologyCanvasProps> = (props) => (
  <ReactFlowProvider>
    <TopologyCanvasInner {...props} />
  </ReactFlowProvider>
);
