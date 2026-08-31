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

import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges/PowerLineEdge';
import { NodePalette } from './NodePalette';
import { NodeInspectorPanel } from './NodeInspectorPanel';
import { EdgeInspectorPanel } from './EdgeInspectorPanel';
import { GraphIOPanel } from './GraphIOPanel';
import { validateGraph, type ValidationIssue } from '../../utils/graphValidation';
import { bfsSolve } from '../../utils/bfsSolver';
import { ResultsPanel } from './ResultsPanel';
import { defaultParamsFor, TYPE_LABELS } from '../../utils/nodeDefaults';
import { clearPersistedGraph, loadPersistedGraph, savePersistedGraph } from '../../utils/graphPersistence';
import {
  ComponentType,
  SolveStatus,
  type ComponentParams,
  type OptimizationResult,
  type PdnEdge,
  type PdnEdgeData,
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

/** Every node now exposes 4 side-handles (top/right/bottom/left, see
 *  FourSideHandles), each with its own id — so an edge that doesn't specify
 *  which handle it uses is ambiguous and may not render correctly. New
 *  connections drawn on the canvas always carry the specific handle the
 *  user dragged from/to, but edges coming from elsewhere (a localStorage
 *  save made before this change, or graph data provided by the parent)
 *  might not. This backfills a safe default so nothing silently breaks. */
function normalizeEdgeHandles(edge: PdnEdge): PdnEdge {
  return {
    ...edge,
    type: edge.type ?? 'powerLine',
    sourceHandle: edge.sourceHandle ?? 'bottom',
    targetHandle: edge.targetHandle ?? 'top',
  };
}

/** Which element (if any) the right-hand sidebar is currently showing. */
type InspectorTarget = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

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
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  // On first mount, prefer whatever was last saved to localStorage over the
  // demo topology passed in via props — that's what makes the canvas
  // survive a page reload. `initialNodes`/`initialEdges` only apply on a
  // genuinely fresh browser (nothing saved yet) or after an explicit Reset.
  const persisted = useMemo(() => loadPersistedGraph(), []);

  const [nodes, setNodes] = useState<PdnNode[]>(persisted?.nodes ?? initialNodes);
  const [edges, setEdges] = useState<PdnEdge[]>(
    (persisted?.edges ?? initialEdges).map(normalizeEdgeHandles)
  );
  const [isSolving, setIsSolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(null);
  // When set, the next click on empty canvas places a node of this type
  // instead of just deselecting everything.
  const [pendingNodeType, setPendingNodeType] = useState<ComponentType | null>(null);
  const [isIOPanelOpen, setIsIOPanelOpen] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as PdnNode[]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as PdnEdge[]),
    []
  );

  const onConnect = useCallback((connection: Connection) => {
    // Built manually with a guaranteed-unique id (rather than relying on
    // the `addEdge` helper's derived id) so multiple parallel lines between
    // the same two nodes — or several fanning out from one node — are
    // always added instead of silently deduped.
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
  // xyflow calls this with either a fresh `Connection` (mid-drag) or an
  // existing `PdnEdge` (re-validating), so the parameter type has to cover
  // both — narrowing it to just `Connection` fails the prop's type check.
  const isValidConnection = useCallback(
    (connection: Connection | PdnEdge) => connection.source !== connection.target,
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

  // Autosave: every change to the graph is written to localStorage so a
  // page reload (or reopening the tab later) picks up right where you left
  // off. Cheap enough at this scale to just save on every change rather
  // than debouncing.
  useEffect(() => {
    savePersistedGraph(nodes, edges);
  }, [nodes, edges]);

  const handleResetToDemo = useCallback(() => {
    const confirmed = window.confirm(
      'Reset the canvas to the default demo topology? This clears your saved layout.'
    );
    if (!confirmed) return;
    clearPersistedGraph();
    setNodes(initialNodes);
    setEdges(initialEdges.map(normalizeEdgeHandles));
    setInspectorTarget(null);
    setLastResult(null);
    setErrorMessage(null);
  }, [initialNodes, initialEdges]);

  /** Replaces the whole canvas with an imported graph. The imported data is
   *  already validated/normalized by GraphIOPanel before this runs — this
   *  just applies it and re-frames the view, since an imported layout can
   *  have wildly different coordinates than whatever was on screen before.
   *  Autosave (the effect below) picks it up automatically, same as any
   *  other edit — no separate "persist" step needed. */
  const handleImportGraph = useCallback(
    (importedNodes: PdnNode[], importedEdges: PdnEdge[]) => {
      setNodes(importedNodes);
      setEdges(importedEdges.map(normalizeEdgeHandles));
      setInspectorTarget(null);
      setLastResult(null);
      setErrorMessage(null);
      setPendingNodeType(null);
      // Let the new nodes commit to the DOM before asking React Flow to
      // measure and fit them into view.
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    },
    [fitView]
  );

  // The node/edge currently open in the sidebar, re-derived from live state
  // on every render so edits (and deletions) stay in sync automatically.
  const inspectorNode = useMemo(
    () =>
      inspectorTarget?.kind === 'node'
        ? nodes.find((n) => n.id === inspectorTarget.id) ?? null
        : null,
    [nodes, inspectorTarget]
  );

  const inspectorEdge = useMemo(
    () =>
      inspectorTarget?.kind === 'edge'
        ? edges.find((e) => e.id === inspectorTarget.id) ?? null
        : null,
    [edges, inspectorTarget]
  );

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: PdnNode) => {
    setInspectorTarget({ kind: 'node', id: node.id });
  }, []);

  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: PdnEdge) => {
    setInspectorTarget({ kind: 'edge', id: edge.id });
  }, []);

  const handleChangeNodeLabel = useCallback(
    (label: string) => {
      if (inspectorTarget?.kind !== 'node') return;
      const id = inspectorTarget.id;
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
    },
    [inspectorTarget]
  );

  const handleChangeNodeParam = useCallback(
    (key: string, value: number | boolean | undefined) => {
      if (inspectorTarget?.kind !== 'node') return;
      const id = inspectorTarget.id;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  params: { ...n.data.params, [key]: value } as ComponentParams,
                },
              }
            : n
        )
      );
    },
    [inspectorTarget]
  );

  const handleChangeEdgeLabel = useCallback(
    (label: string) => {
      if (inspectorTarget?.kind !== 'edge') return;
      const id = inspectorTarget.id;
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, label } as PdnEdgeData } : e))
      );
    },
    [inspectorTarget]
  );

  const handleChangeEdgeField = useCallback(
    (key: string, value: number | undefined) => {
      if (inspectorTarget?.kind !== 'edge') return;
      const id = inspectorTarget.id;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, [key]: value } as PdnEdgeData } : e
        )
      );
    },
    [inspectorTarget]
  );

  const handleChangeEdgeColor = useCallback(
    (color: string | undefined) => {
      if (inspectorTarget?.kind !== 'edge') return;
      const id = inspectorTarget.id;
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, color } as PdnEdgeData } : e))
      );
    },
    [inspectorTarget]
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
        data: { ...e.data, result: result.edgeResults[e.id] } as PdnEdgeData,
      }))
    );
  }, []);

  const handleSolve = useCallback(() => {
    setIsSolving(true);
    setErrorMessage(null);

    // setTimeout keeps the "Solving…" state visible for a beat even though
    // bfsSolve itself is synchronous — swap this for a real async call
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

        const result = bfsSolve(nodes, edges);
        setLastResult(result);
        applyResultOverlay(result);

        if (
          result.summary.status === SolveStatus.INFEASIBLE ||
          result.summary.status === SolveStatus.ERROR
        ) {
          setErrorMessage(result.summary.message ?? 'Solve did not complete successfully.');
        } else {
          setIsResultsPanelOpen(true);
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

  const inspectorEdgeSourceLabel = useMemo(() => {
    if (!inspectorEdge) return '';
    return nodes.find((n) => n.id === inspectorEdge.source)?.data.label ?? inspectorEdge.source;
  }, [inspectorEdge, nodes]);

  const inspectorEdgeTargetLabel = useMemo(() => {
    if (!inspectorEdge) return '';
    return nodes.find((n) => n.id === inspectorEdge.target)?.data.label ?? inspectorEdge.target;
  }, [inspectorEdge, nodes]);

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
        connectionMode={ConnectionMode.Loose}
        onSelectionChange={(sel) =>
          onSelectionChange?.({ nodes: sel.nodes as PdnNode[], edges: sel.edges as PdnEdge[] })
        }
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
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
          onClose={() => setInspectorTarget(null)}
          onChangeLabel={handleChangeNodeLabel}
          onChangeParam={handleChangeNodeParam}
        />
      )}

      {inspectorEdge && (
        <EdgeInspectorPanel
          edge={inspectorEdge}
          sourceLabel={inspectorEdgeSourceLabel}
          targetLabel={inspectorEdgeTargetLabel}
          onClose={() => setInspectorTarget(null)}
          onChangeLabel={handleChangeEdgeLabel}
          onChangeField={handleChangeEdgeField}
          onChangeColor={handleChangeEdgeColor}
        />
      )}

      {isIOPanelOpen && (
        <GraphIOPanel
          nodes={nodes}
          edges={edges}
          onImport={handleImportGraph}
          onClose={() => setIsIOPanelOpen(false)}
        />
      )}

      {isResultsPanelOpen && (
        <ResultsPanel
          nodes={nodes}
          edges={edges}
          result={lastResult}
          onClose={() => setIsResultsPanelOpen(false)}
          onFocusNode={(node) => {
            const offset = node.data.componentType === ComponentType.NODE ? 14 : 22;
            setCenter(node.position.x + offset, node.position.y + offset, { zoom: 2.0, duration: 300 });
          }}
          onFocusEdge={(edge) => {
            const sNode = nodes.find((n) => n.id === edge.source);
            const tNode = nodes.find((n) => n.id === edge.target);
            if (sNode && tNode) {
              const midX = (sNode.position.x + tNode.position.x) / 2;
              const midY = (sNode.position.y + tNode.position.y) / 2;
              setCenter(midX + 22, midY + 22, { zoom: 1.5, duration: 300 });
            }
          }}
        />
      )}

      {!errorMessage && (
        <div className="absolute bottom-4 left-4 max-w-xs rounded-md bg-white/90 border border-slate-200 shadow px-3 py-1.5 text-[11px] text-slate-500">
          Pick a type in "Add node" then click the canvas to place it · drag
          between dots to connect nodes · click a line to delete it ·
          double-click a node or line to edit its properties (including
          line color).
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {lastResult && (
            <button
              type="button"
              onClick={() => setIsResultsPanelOpen((p) => !p)}
              title="Show or hide the solver results panel"
              className={`rounded-md border px-2.5 py-2 text-xs font-medium shadow transition-colors ${
                isResultsPanelOpen
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600 hover:bg-indigo-100/50'
                  : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              📊 Results
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsIOPanelOpen(true)}
            title="Export the current graph to JSON, or load one in"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow hover:bg-slate-50 transition-colors"
          >
            Import / Export
          </button>
          <button
            type="button"
            onClick={handleResetToDemo}
            title="Clear saved layout and restore the default demo topology"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-500 shadow hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
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
        </div>
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
