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

// ---------------------------------------------------------------------------
// Complex Number Helpers
// ---------------------------------------------------------------------------
interface Complex {
  re: number;
  im: number;
}

const cx = (re = 0, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const div = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
};
const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const mag = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);

// ---------------------------------------------------------------------------
// BFS Load Flow Solver
// ---------------------------------------------------------------------------
export function bfsSolve(nodes: PdnNode[], edges: PdnEdge[]): OptimizationResult {
  const solveStartTime = performance.now();

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, { edge: PdnEdge; neighborId: string }[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.source)?.push({ edge: e, neighborId: e.target });
    adjacency.get(e.target)?.push({ edge: e, neighborId: e.source });
  }

  // Find slack bus
  const slackNode = nodes.find(
    (n) =>
      n.data.componentType === ComponentType.SUBSTATION ||
      (n.data.params as any).isSlackBus === true
  );

  if (!slackNode) {
    return {
      summary: {
        status: SolveStatus.INFEASIBLE,
        message: 'No substation or slack bus found — cannot establish a reference voltage.',
      },
      nodeResults: {},
      edgeResults: {},
    };
  }

  const slackId = slackNode.id;

  // Build spanning tree using BFS from the slack bus
  const parentNode = new Map<string, string>(); // child -> parent
  const parentEdge = new Map<string, PdnEdge>(); // child -> edge connecting to parent
  const children = new Map<string, string[]>(); // parent -> children
  for (const n of nodes) children.set(n.id, []);

  const order: string[] = []; // topological order (root first)
  const visited = new Set<string>([slackId]);
  const queue = [slackId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    order.push(cur);

    for (const { edge, neighborId } of adjacency.get(cur) ?? []) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parentNode.set(neighborId, cur);
      parentEdge.set(neighborId, edge);
      children.get(cur)?.push(neighborId);
      queue.push(neighborId);
    }
  }

  // Heuristic: Check if parameters are in kW or MW.
  // In IEEE 33-bus, loads are 100, 90, 120 (which are kW, but keys are labeled Mw).
  // If max parameter value > 5.0, we treat them as kW and divide by 1000 for standard power calculations,
  // then multiply the resulting injections by 1000 to match the input scale.
  let maxParamVal = 0;
  for (const n of nodes) {
    const params = n.data.params;
    if (n.data.componentType === ComponentType.LOAD) {
      maxParamVal = Math.max(maxParamVal, Math.abs((params as any).pDemandMw ?? 0));
    } else if (n.data.componentType === ComponentType.NODE) {
      maxParamVal = Math.max(maxParamVal, Math.abs((params as any).activePowerMw ?? 0));
    } else if (n.data.componentType === ComponentType.GENERATOR) {
      maxParamVal = Math.max(maxParamVal, Math.abs((params as any).pMaxMw ?? 0));
    }
  }

  const isKwScale = maxParamVal > 5.0;
  const scale = isKwScale ? 0.001 : 1.0;
  const invScale = 1.0 / scale;

  // S_base = 1.0 MVA (or 1000 kVA if isKwScale)
  const Sbase = 1.0; // p.u. calculations based on Sbase = 1.0 MVA

  // Read custom slack voltage magnitude and phase angle (if specified)
  const slackParams = slackNode ? (slackNode.data.params as any) : {};
  const vSlackPu = slackParams.slackVoltagePu ?? 1.0;
  const thetaSlackDeg = slackParams.slackAngleDeg ?? 0.0;
  const thetaSlackRad = (thetaSlackDeg * Math.PI) / 180;
  const V_slack_val = cx(vSlackPu * Math.cos(thetaSlackRad), vSlackPu * Math.sin(thetaSlackRad));

  // Initialize node voltages (flat start based on slack bus voltage)
  const V: Record<string, Complex> = {};
  for (const id of nodes.map((n) => n.id)) {
    V[id] = { ...V_slack_val };
  }

  const TOL = 1e-6;
  const MAX_ITER = 100;
  let converged = false;
  let iterations = 0;
  let I_branch: Record<string, Complex> = {};

  // Run BFS Load Flow Loop
  for (iterations = 1; iterations <= MAX_ITER; iterations++) {
    const V_old: Record<string, Complex> = {};
    for (const id of order) {
      V_old[id] = { ...V[id] };
    }

    // Node currents mapping (outgoing load currents)
    const I_node: Record<string, Complex> = {};
    for (const id of order) {
      const n = nodeById.get(id)!;
      let pDemand = 0;
      let qDemand = 0;

      const params = n.data.params;
      if (n.data.componentType === ComponentType.LOAD) {
        pDemand = ((params as any).pDemandMw ?? 0) * scale;
        qDemand = ((params as any).qDemandMvar ?? 0) * scale;
      } else if (n.data.componentType === ComponentType.NODE) {
        pDemand = ((params as any).activePowerMw ?? 0) * scale;
        qDemand = ((params as any).reactivePowerMvar ?? 0) * scale;
      } else if (n.data.componentType === ComponentType.GENERATOR) {
        pDemand = -((params as any).pMaxMw ?? 0) * scale;
        qDemand = -((params as any).qMaxMvar ?? 0) * scale;
      }

      // S = P + jQ (in p.u. since Sbase = 1.0 MVA)
      const S = cx(pDemand, qDemand);
      // I = conj(S / V)
      I_node[id] = conj(div(S, V[id]));
    }

    // Backward Sweep: calculate branch currents
    I_branch = {}; // keyed by edgeId
    for (let i = order.length - 1; i > 0; i--) {
      const id = order[i];
      const edge = parentEdge.get(id)!;

      let I_sum = { ...I_node[id] };
      for (const childId of children.get(id) ?? []) {
        const childEdge = parentEdge.get(childId)!;
        I_sum = add(I_sum, I_branch[childEdge.id]);
      }
      I_branch[edge.id] = I_sum;
    }

    // Forward Sweep: update node voltages
    for (let i = 1; i < order.length; i++) {
      const id = order[i];
      const pId = parentNode.get(id)!;
      const edge = parentEdge.get(id)!;

      const edgeData = edge.data ?? { resistanceOhm: 0.1, reactanceOhm: 0.1 };
      const baseKv = (nodeById.get(id)!.data.params as any).baseVoltageKv ?? 12.66;

      // Zbase = Vbase^2 / Sbase.
      const Zbase = (baseKv * baseKv) / Sbase;
      const R_pu = edgeData.resistanceOhm / Zbase;
      const X_pu = edgeData.reactanceOhm / Zbase;
      const Z_pu = cx(R_pu, X_pu);

      const I_edge = I_branch[edge.id];
      // V_child = V_parent - I_edge * Z_pu
      V[id] = sub(V[pId], mul(I_edge, Z_pu));
    }

    // Check convergence
    let maxDiff = 0;
    for (const id of order) {
      const diff = Math.abs(mag(V[id]) - mag(V_old[id]));
      if (diff > maxDiff) maxDiff = diff;
    }

    if (maxDiff < TOL) {
      converged = true;
      break;
    }
  }

  // Post-process results
  const nodeResults: Record<string, NodeResult> = {};
  const edgeResults: Record<string, EdgeResult> = {};

  // Initialize all nodes and edges as de-energized
  for (const n of nodes) {
    nodeResults[n.id] = { isEnergized: false, voltagePu: 0, voltageKv: 0, pInjectionMw: 0, qInjectionMvar: 0 };
  }
  for (const e of edges) {
    edgeResults[e.id] = { status: LineStatus.DE_ENERGIZED, currentA: 0, loadingPct: 0, pFlowMw: 0, qFlowMvar: 0, lossMw: 0 };
  }

  let totalLossMw = 0;
  let totalDemandMw = 0;
  let totalGenerationMw = 0;

  // Process visited nodes
  for (const id of order) {
    const n = nodeById.get(id)!;
    const baseKv = (n.data.params as any).baseVoltageKv ?? 12.66;
    const V_node = V[id];
    const vPu = mag(V_node);
    const vKv = vPu * baseKv;

    let pDemand = 0;
    let qDemand = 0;
    const params = n.data.params;
    if (n.data.componentType === ComponentType.LOAD) {
      pDemand = (params as any).pDemandMw ?? 0;
      qDemand = (params as any).qDemandMvar ?? 0;
    } else if (n.data.componentType === ComponentType.NODE) {
      pDemand = (params as any).activePowerMw ?? 0;
      qDemand = (params as any).reactivePowerMvar ?? 0;
    } else if (n.data.componentType === ComponentType.GENERATOR) {
      pDemand = -((params as any).pMaxMw ?? 0);
      qDemand = -((params as any).qMaxMvar ?? 0);
    }

    // Only sum positive demands
    if (pDemand > 0) {
      totalDemandMw += pDemand;
    } else if (pDemand < 0) {
      totalGenerationMw += -pDemand;
    }

    // Calculate slack bus injection or standard injection
    let pInj = 0;
    let qInj = 0;

    if (id === slackId) {
      // In slack bus, injection equals sum of branch power flows leaving the slack bus
      let S_slack = cx(0, 0);
      for (const childId of children.get(slackId) ?? []) {
        const edge = parentEdge.get(childId)!;
        const I_edge = I_branch[edge.id];
        // S = V_slack * conj(I_edge)
        const S_branch = mul(V[slackId], conj(I_edge));
        S_slack = add(S_slack, S_branch);
      }
      // Convert injection back to original user scale
      pInj = S_slack.re * invScale;
      qInj = S_slack.im * invScale;
      totalGenerationMw += pInj;
    } else {
      // For other nodes, the injection is generator - load (negative of demand)
      pInj = -pDemand;
      qInj = -qDemand;
    }

    const angleDeg = (Math.atan2(V_node.im, V_node.re) * 180) / Math.PI;

    nodeResults[id] = {
      isEnergized: true,
      voltagePu: Math.round(vPu * 10000) / 10000,
      voltageKv: Math.round(vKv * 100) / 100,
      voltageAngleDeg: Math.round(angleDeg * 100) / 100,
      pInjectionMw: Math.round(pInj * 1000) / 1000,
      qInjectionMvar: Math.round(qInj * 1000) / 1000,
    };
  }

  // Process visited edges
  for (const id of order) {
    if (id === slackId) continue;
    const edge = parentEdge.get(id)!;
    const pId = parentNode.get(id)!;
    const I_edge = I_branch[edge.id];
    const iPu = mag(I_edge);

    const baseKv = (nodeById.get(id)!.data.params as any).baseVoltageKv ?? 12.66;
    // I_base = Sbase / (sqrt(3) * Vbase)
    // Sbase is in MVA, Vbase is in kV, so:
    // I_base (A) = (Sbase * 1e6) / (sqrt(3) * Vbase * 1e3) = (Sbase * 1000) / (sqrt(3) * Vbase)
    const I_base = (Sbase * 1000) / (Math.sqrt(3) * baseKv);
    const iAmps = iPu * I_base;

    // Power flow sending end: S = V_parent * conj(I_edge)
    const S_flow = mul(V[pId], conj(I_edge));
    const pFlow = S_flow.re * invScale;
    const qFlow = S_flow.im * invScale;

    // Loss = I_pu^2 * R_pu (in p.u. of Sbase)
    const edgeData = edge.data ?? { resistanceOhm: 0.1, reactanceOhm: 0.1, maxCurrentA: 400 };
    const Zbase = (baseKv * baseKv) / Sbase;
    const R_pu = edgeData.resistanceOhm / Zbase;
    const lossPu = iPu * iPu * R_pu;
    const lossMw = lossPu * invScale;
    totalLossMw += lossMw;

    const iMaxA = edgeData.maxCurrentA || 400;
    const loadingPct = Math.round((iAmps / iMaxA) * 1000) / 10;

    let status = LineStatus.NORMAL;
    if (loadingPct >= 100) status = LineStatus.OVERLOADED;
    else if (loadingPct >= 85) status = LineStatus.WARNING;

    edgeResults[edge.id] = {
      status,
      currentA: Math.round(iAmps * 100) / 100,
      loadingPct,
      pFlowMw: Math.round(pFlow * 1000) / 1000,
      qFlowMvar: Math.round(qFlow * 1000) / 1000,
      lossMw: Math.round(lossMw * 100000) / 100000,
    };
  }

  const solveEndTimeMs = performance.now() - solveStartTime;

  return {
    summary: {
      status: converged ? SolveStatus.OPTIMAL : SolveStatus.ERROR,
      objectiveValue: Math.round(totalGenerationMw * 50 * 100) / 100, // flat $50/MWh cost
      totalSystemLossMw: Math.round(totalLossMw * 100000) / 100000,
      totalGenerationMw: Math.round(totalGenerationMw * 1000) / 1000,
      totalDemandMw: Math.round(totalDemandMw * 1000) / 1000,
      solveTimeMs: Math.round(solveEndTimeMs * 10) / 10,
      message: converged
        ? `Backward-Forward Sweep load flow solved in ${iterations} iterations.`
        : `Backward-Forward Sweep solver failed to converge in ${MAX_ITER} iterations.`,
    },
    nodeResults,
    edgeResults,
  };
}
