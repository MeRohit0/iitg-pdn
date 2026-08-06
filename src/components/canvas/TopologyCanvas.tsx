import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges/PowerLineEdge';
import { validateGraph, type ValidationIssue } from '../../utils/graphValidation';
import { mockSolve } from '../../utils/mockSolver';
import {
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

/**
 * Interactive Topology Canvas (/canvas) — fully standalone.
 * No backend calls: "Run Optimization" runs `mockSolve` synchronously in
 * the browser so the canvas, overlay coloring, and result summary are all
 * demoable without a FastAPI/docplex server running.
 */
export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  initialNodes,
  initialEdges,
  onSelectionChange,
}) => {
  const [nodes, setNodes] = useState<PdnNode[]>(initialNodes);
  const [edges, setEdges] = useState<PdnEdge[]>(
    initialEdges.map((e) => ({ ...e, type: e.type ?? 'powerLine' }))
  );
  const [isSolving, setIsSolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OptimizationResult | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as PdnNode[]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as PdnEdge[]),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges(
        (eds) =>
          addEdge(
            {
              ...connection,
              type: 'powerLine',
              data: {
                resistanceOhm: 0.1,
                reactanceOhm: 0.1,
                maxCurrentA: 400,
              },
            },
            eds
          ) as PdnEdge[]
      ),
    []
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
        onSelectionChange={(sel) =>
          onSelectionChange?.({ nodes: sel.nodes as PdnNode[], edges: sel.edges as PdnEdge[] })
        }
        fitView
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

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
