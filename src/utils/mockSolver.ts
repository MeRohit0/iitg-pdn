import {
  ComponentType,
  LineStatus,
  SolveStatus,
  type EdgeResult,
  type NodeResult,
  type OptimizationResult,
  type PdnEdge,
  type PdnNode,
} from '../types/graph.types';

const WARNING_LOADING_PCT = 85;
const OVERLOAD_LOADING_PCT = 100;

function statusFromLoading(loadingPct: number): LineStatus {
  if (loadingPct >= OVERLOAD_LOADING_PCT) return LineStatus.OVERLOADED;
  if (loadingPct >= WARNING_LOADING_PCT) return LineStatus.WARNING;
  return LineStatus.NORMAL;
}

/**
 * Approximates a radial power flow entirely in the browser: for each branch,
 * sums the demand of every downstream load reachable through it (BFS from
 * the slack/substation bus), then derives a loading % against the branch's
 * declared current capacity and a per-branch voltage drop.
 *
 * This is a *demo* stand-in for the real docplex MILP solve on the backend —
 * good enough to make the canvas, overlay, and result cards interactive
 * without any server, but not a substitute for an actual OPF.
 */
export function mockSolve(nodes: PdnNode[], edges: PdnEdge[]): OptimizationResult {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, { edgeId: string; neighborId: string }[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.source)?.push({ edgeId: e.id, neighborId: e.target });
    adjacency.get(e.target)?.push({ edgeId: e.id, neighborId: e.source });
  }

  const slackIds = nodes
    .filter((n) => n.data.componentType === ComponentType.SUBSTATION)
    .map((n) => n.id);

  const nodeResults: Record<string, NodeResult> = {};
  const edgeResults: Record<string, EdgeResult> = {};

  if (slackIds.length === 0) {
    return {
      summary: {
        status: SolveStatus.INFEASIBLE,
        message: 'No substation/slack bus found — cannot establish a reference voltage.',
      },
      nodeResults: {},
      edgeResults: {},
    };
  }

  // BFS from the first slack bus, tracking cumulative voltage drop and the
  // set of downstream loads reachable through each traversed edge.
  const parentEdge = new Map<string, string>(); // nodeId -> edgeId used to reach it
  const parentNode = new Map<string, string>();
  const order: string[] = [];
  const visited = new Set<string>([slackIds[0]]);
  const queue = [slackIds[0]];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const { edgeId, neighborId } of adjacency.get(cur) ?? []) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parentEdge.set(neighborId, edgeId);
      parentNode.set(neighborId, cur);
      queue.push(neighborId);
    }
  }

  // Downstream demand per node (sum of this node's own demand + all descendants).
  const downstreamDemandMw = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const n = nodeById.get(id)!;
    const ownDemand =
      n.data.componentType === ComponentType.LOAD
        ? (n.data.params as { pDemandMw?: number }).pDemandMw ?? 0
        : 0;
    let total = ownDemand;
    for (const { neighborId } of adjacency.get(id) ?? []) {
      if (parentNode.get(neighborId) === id) {
        total += downstreamDemandMw.get(neighborId) ?? 0;
      }
    }
    downstreamDemandMw.set(id, total);
  }

  let totalLossMw = 0;
  let totalDemandMw = 0;
  const voltagePu = new Map<string, number>();
  voltagePu.set(slackIds[0], 1.0);

  for (const id of order) {
    const n = nodeById.get(id)!;
    const baseKv = (n.data.params as { baseVoltageKv?: number }).baseVoltageKv ?? 11;
    const edgeId = parentEdge.get(id);
    const parentId = parentNode.get(id);

    if (n.data.componentType === ComponentType.LOAD) {
      totalDemandMw += (n.data.params as { pDemandMw?: number }).pDemandMw ?? 0;
    }

    if (edgeId && parentId) {
      const edge = edges.find((e) => e.id === edgeId)!;
      const flowMw = downstreamDemandMw.get(id) ?? 0;
      const iMaxA = edge.data?.maxCurrentA ?? 400;
      const resistanceOhm = edge.data?.resistanceOhm ?? 0;
      
      const capacityMw = (Math.sqrt(3) * baseKv * iMaxA) / 1000;
      const loadingPct = capacityMw > 0 ? Math.round((flowMw / capacityMw) * 1000) / 10 : 0;
      const currentA = (flowMw * 1000) / (Math.sqrt(3) * baseKv || 1);
      const lossMw = (currentA * currentA * resistanceOhm) / 1_000_000;
      totalLossMw += lossMw;

      const parentVoltage = voltagePu.get(parentId) ?? 1.0;
      const voltageDropPu = (resistanceOhm * flowMw) / (baseKv * baseKv || 1) * 0.02;
      const thisVoltage = Math.max(0.85, parentVoltage - voltageDropPu);
      voltagePu.set(id, thisVoltage);

      edgeResults[edgeId] = {
        status: statusFromLoading(loadingPct),
        currentA: Math.round(currentA * 100) / 100,
        loadingPct,
        pFlowMw: Math.round(flowMw * 1000) / 1000,
        qFlowMvar: 0,
        lossMw: Math.round(lossMw * 100000) / 100000,
      };
    } else {
      voltagePu.set(id, 1.0);
    }

    nodeResults[id] = {
      voltagePu: Math.round((voltagePu.get(id) ?? 1) * 1000) / 1000,
      voltageKv: Math.round((voltagePu.get(id) ?? 1) * baseKv * 100) / 100,
      pInjectionMw:
        n.data.componentType === ComponentType.SUBSTATION
          ? Math.round((downstreamDemandMw.get(id) ?? 0) * 1000) / 1000
          : n.data.componentType === ComponentType.GENERATOR
          ? (n.data.params as { pMaxMw?: number }).pMaxMw ?? 0
          : 0,
      qInjectionMvar: 0,
      isEnergized: true,
    };
  }

  // Any node unreachable from the slack bus (shouldn't happen if validation
  // passed) is marked de-energized rather than silently omitted.
  for (const n of nodes) {
    if (!nodeResults[n.id]) {
      nodeResults[n.id] = { isEnergized: false };
    }
  }
  for (const e of edges) {
    if (!edgeResults[e.id]) {
      edgeResults[e.id] = { status: LineStatus.DE_ENERGIZED };
    }
  }

  return {
    summary: {
      status: SolveStatus.OPTIMAL,
      objectiveValue: Math.round(totalDemandMw * 50 * 1000) / 1000, // flat $50/MWh mock cost
      totalSystemLossMw: Math.round(totalLossMw * 100000) / 100000,
      totalGenerationMw: Math.round(totalDemandMw * 1000) / 1000,
      totalDemandMw: Math.round(totalDemandMw * 1000) / 1000,
      solveTimeMs: 5,
      message: 'Mock client-side solve — no backend connected.',
    },
    nodeResults,
    edgeResults,
  };
}
