import React, { useState, useMemo } from 'react';
import { ComponentType, LineStatus, type PdnEdge, type PdnNode, type OptimizationResult } from '../../types/graph.types';
import { TYPE_ICONS } from '../../utils/nodeDefaults';

interface ResultsPanelProps {
  nodes: PdnNode[];
  edges: PdnEdge[];
  result: OptimizationResult | null;
  onClose: () => void;
  onFocusNode: (node: PdnNode) => void;
  onFocusEdge: (edge: PdnEdge) => void;
}

type TabType = 'nodes' | 'edges';

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  nodes,
  edges,
  result,
  onClose,
  onFocusNode,
  onFocusEdge,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('nodes');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = result?.summary;
  const nodeResults = result?.nodeResults ?? {};
  const edgeResults = result?.edgeResults ?? {};

  // Filter and sort nodes: lowest voltage p.u. first (so problem nodes are at the top)
  const sortedNodesList = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const list = nodes.filter((n) => {
      const label = n.data.label.toLowerCase();
      const id = n.id.toLowerCase();
      const type = n.data.componentType.toLowerCase();
      return label.includes(query) || id.includes(query) || type.includes(query);
    });

    return [...list].sort((a, b) => {
      const vA = nodeResults[a.id]?.voltagePu ?? 1.0;
      const vB = nodeResults[b.id]?.voltagePu ?? 1.0;
      // Sort de-energized to the bottom, otherwise lowest voltage first
      const eA = nodeResults[a.id]?.isEnergized ? 1 : 0;
      const eB = nodeResults[b.id]?.isEnergized ? 1 : 0;
      if (eA !== eB) return eB - eA;
      return vA - vB;
    });
  }, [nodes, nodeResults, searchQuery]);

  // Filter and sort edges: highest loading % first (so critical lines are at the top)
  const sortedEdgesList = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const list = edges.filter((e) => {
      const label = (e.data?.label ?? '').toLowerCase();
      const id = e.id.toLowerCase();
      const source = e.source.toLowerCase();
      const target = e.target.toLowerCase();
      return label.includes(query) || id.includes(query) || source.includes(query) || target.includes(query);
    });

    return [...list].sort((a, b) => {
      const lA = edgeResults[a.id]?.loadingPct ?? 0;
      const lB = edgeResults[b.id]?.loadingPct ?? 0;
      return lB - lA;
    });
  }, [edges, edgeResults, searchQuery]);

  if (!result) {
    return (
      <div className="absolute top-4 left-4 bottom-4 w-80 z-20 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white shadow-xl p-6 text-center">
        <span className="text-3xl mb-2">📊</span>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">No solve data</h3>
        <p className="text-xs text-slate-400">Run the optimization first to view network results.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Close Panel
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 bottom-4 w-80 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Solve Results</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          aria-label="Close results panel"
        >
          ×
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="p-3 bg-slate-50/50 border-b border-slate-200 text-[11px] text-slate-600 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-slate-200 rounded p-1.5 shadow-sm">
              <span className="block text-slate-400 text-[9px] uppercase font-semibold">Total Loss</span>
              <span className="text-sm font-bold text-indigo-600">
                {summary.totalSystemLossMw != null ? `${summary.totalSystemLossMw.toFixed(3)} MW` : 'N/A'}
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded p-1.5 shadow-sm">
              <span className="block text-slate-400 text-[9px] uppercase font-semibold">Total Cost</span>
              <span className="text-sm font-bold text-emerald-600">
                {summary.objectiveValue != null ? `$${summary.objectiveValue.toFixed(2)}` : 'N/A'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400">Total Generation:</span>{' '}
              <span className="font-semibold text-slate-700">{summary.totalGenerationMw?.toFixed(2)} MW</span>
            </div>
            <div>
              <span className="text-slate-400">Total Demand:</span>{' '}
              <span className="font-semibold text-slate-700">{summary.totalDemandMw?.toFixed(2)} MW</span>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 flex items-center justify-between">
            <span>Status: {summary.status}</span>
            <span>Solved in {summary.solveTimeMs ?? 0}ms</span>
          </div>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="border-b border-slate-200 p-2 space-y-2">
        <div className="flex rounded-md bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('nodes');
              setSearchQuery('');
            }}
            className={`flex-1 rounded py-1 text-center text-xs font-semibold transition-all ${
              activeTab === 'nodes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Buses ({nodes.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('edges');
              setSearchQuery('');
            }}
            className={`flex-1 rounded py-1 text-center text-xs font-semibold transition-all ${
              activeTab === 'edges' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Lines ({edges.length})
          </button>
        </div>
        <input
          type="text"
          placeholder={activeTab === 'nodes' ? 'Search buses...' : 'Search lines...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
        {activeTab === 'nodes' ? (
          <div className="space-y-1.5">
            {sortedNodesList.map((node) => {
              const res = nodeResults[node.id];
              const isEnergized = res?.isEnergized;
              const vPu = res?.voltagePu ?? 1.0;
              const vKv = res?.voltageKv ?? 0;
              const pInj = res?.pInjectionMw ?? 0;

              // Color classes based on voltage drop
              let voltColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              if (!isEnergized) {
                voltColor = 'text-slate-400 bg-slate-100 border-slate-200';
              } else if (vPu < 0.95) {
                voltColor = 'text-rose-600 bg-rose-50 border-rose-100 animate-pulse';
              } else if (vPu < 0.98) {
                voltColor = 'text-amber-600 bg-amber-50 border-amber-100';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => onFocusNode(node)}
                  title="Click to center canvas on this bus"
                  className="flex items-center justify-between border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 cursor-pointer rounded-lg p-2 transition-all shadow-sm group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] leading-none opacity-70 shrink-0">
                        {TYPE_ICONS[node.data.componentType]}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">
                        Bus {node.data.label}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">({node.id})</span>
                    </div>
                    {isEnergized ? (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        P load: {Math.max(0, -pInj).toFixed(1)} MW
                      </div>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">De-energized</span>
                    )}
                  </div>

                  {isEnergized && (
                    <div className={`border rounded px-1.5 py-0.5 text-right font-mono shrink-0 ${voltColor}`}>
                      <div className="text-xs font-bold">
                        {vPu.toFixed(3)} pu
                        {res?.voltageAngleDeg != null ? ` ∠${res.voltageAngleDeg.toFixed(1)}°` : ''}
                      </div>
                      <div className="text-[9px] leading-none opacity-80">{vKv.toFixed(2)} kV</div>
                    </div>
                  )}
                </div>
              );
            })}
            {sortedNodesList.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">No buses match query.</div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedEdgesList.map((edge) => {
              const res = edgeResults[edge.id];
              const loading = res?.loadingPct ?? 0;
              const current = res?.currentA ?? 0;
              const pFlow = res?.pFlowMw ?? 0;
              const loss = res?.lossMw ?? 0;

              let loadColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              if (res?.status === LineStatus.DE_ENERGIZED) {
                loadColor = 'text-slate-400 bg-slate-100 border-slate-200';
              } else if (loading >= 100) {
                loadColor = 'text-rose-600 bg-rose-50 border-rose-100 animate-pulse font-bold';
              } else if (loading >= 85) {
                loadColor = 'text-amber-600 bg-amber-50 border-amber-100';
              }

              // Retrieve source and target labels for readability
              const sNode = nodes.find((n) => n.id === edge.source);
              const tNode = nodes.find((n) => n.id === edge.target);
              const sName = sNode?.data.label ?? edge.source;
              const tName = tNode?.data.label ?? edge.target;

              return (
                <div
                  key={edge.id}
                  onClick={() => onFocusEdge(edge)}
                  title="Click to center canvas on this line"
                  className="flex items-center justify-between border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 cursor-pointer rounded-lg p-2 transition-all shadow-sm group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                      {edge.data?.label ? `${edge.data.label} (${sName}→${tName})` : `Line ${sName} → ${tName}`}
                    </div>
                    {res?.status !== LineStatus.DE_ENERGIZED ? (
                      <div className="text-[9px] text-slate-500 space-y-0.5 mt-0.5 font-mono">
                        <div>Flow: {pFlow.toFixed(3)} MW</div>
                        <div>Loss: {loss.toFixed(5)} MW</div>
                        <div>R: {edge.data?.resistanceOhm}Ω | X: {edge.data?.reactanceOhm}Ω</div>
                      </div>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">De-energized</span>
                    )}
                  </div>

                  {res?.status !== LineStatus.DE_ENERGIZED && (
                    <div className={`border rounded px-1.5 py-0.5 text-right font-mono shrink-0 ${loadColor}`}>
                      <div className="text-xs font-bold">{loading.toFixed(1)}%</div>
                      <div className="text-[9px] leading-none opacity-85">{current.toFixed(1)} A</div>
                    </div>
                  )}
                </div>
              );
            })}
            {sortedEdgesList.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">No lines match query.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
