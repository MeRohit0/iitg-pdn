import { bfsSolve } from './bfsSolver';
import { ComponentType, type CustomerType, type PdnEdge, type PdnNode } from '../types/graph.types';
import { type TimeSeriesDataPoint, timeIndexToClock } from '../data/defaultTimeSeriesData';

export type LoadClassType = 'Residential' | 'Industrial' | 'Commercial';

export interface OrderedNodeInfo {
  id: string;
  label: string;
  busNum: number;
  customerType: CustomerType;
  baseP: number;
  baseQ: number;
}

export interface TimeStepResult {
  timeIndex: number;
  timeLabel: string;
  minVoltagePu: number;
  minVoltageNodeLabel: string;
  totalLossKw: number;
  totalLossKvar: number;
  totalDemandKw: number;
  totalDemandKvar: number;
  // node id -> voltage magnitude in p.u.
  nodeVoltages: Record<string, number>;
  // active and reactive load at this time step per node id
  nodeActiveKw: Record<string, number>;
  nodeReactiveKvar: Record<string, number>;
  multipliers: {
    Residential: number;
    Industrial: number;
    Commercial: number;
  };
}

export interface NetworkTimeSeriesResult {
  timeSteps: TimeStepResult[];
  orderedNodes: OrderedNodeInfo[];
  // 2D matrix for 3D surface plotting: Z[time_index][node_index]
  surfaceZ: number[][]; // Voltage (p.u.)
  surfaceZVoltageDrop: number[][]; // Voltage Drop ΔV = 1 - V (p.u.)
  surfaceZActiveKw: number[][]; // Active Power Demand (kW)
  surfaceYTime: string[];
  surfaceXNodes: string[];
  // Overall metrics across 24h
  minVoltagePuOverall: number;
  minVoltageAtTime: string;
  minVoltageNodeLabel: string;
  totalEnergyLossKwh: number; // sum(LossKw * 0.25h)
  peakLossKw: number;
  peakLossTime: string;
  peakDemandKw: number;
  peakDemandTime: string;
  // Node ID -> array of 96 voltage values across 24h
  nodeVoltageHistory: Record<string, number[]>;
  customerCounts: {
    Residential: number;
    Industrial: number;
    Commercial: number;
    None: number;
  };
}

export interface MultiplierFactors {
  kP: number; // Base scaling factor for active power (default: 1.0)
  kQ: number; // Base scaling factor for reactive power (default: 1.0)
}

/**
 * Resolves the effective customer type for a given node.
 */
export function getNodeCustomerType(node: PdnNode): CustomerType {
  const params = node.data.params as any;
  if (params?.customerType) {
    return params.customerType as CustomerType;
  }
  if (node.data.componentType === ComponentType.SUBSTATION || params?.isSlackBus) {
    return 'None';
  }
  return 'Residential';
}

/**
 * Executes a 24-hour time-series BFS power flow across all 96 intervals.
 * For each interval, every node's base load is multiplied by its specific
 * customer type multiplier (Residential -> Rload, Industrial -> Iload, Commercial -> Cload).
 */
export function solveTimeSeriesBfs(
  nodes: PdnNode[],
  edges: PdnEdge[],
  timeSeriesData: TimeSeriesDataPoint[],
  factors: MultiplierFactors = { kP: 1.0, kQ: 1.0 }
): NetworkTimeSeriesResult {
  // Order nodes by numerical label or id for sequential plotting along the feeder
  const orderedNodes: OrderedNodeInfo[] = [...nodes]
    .map((n) => {
      const parsedNum = parseInt(n.data.label.replace(/\D/g, ''), 10);
      const params = (n.data.params as any) ?? {};
      const baseP =
        n.data.componentType === ComponentType.LOAD
          ? (params.pDemandMw ?? 0)
          : (params.activePowerMw ?? 0);
      const baseQ =
        n.data.componentType === ComponentType.LOAD
          ? (params.qDemandMvar ?? 0)
          : (params.reactivePowerMvar ?? 0);

      return {
        id: n.id,
        label: n.data.label || n.id,
        busNum: isNaN(parsedNum) ? 9999 : parsedNum,
        customerType: getNodeCustomerType(n),
        baseP,
        baseQ,
      };
    })
    .sort((a, b) => a.busNum - b.busNum);

  const surfaceXNodes = orderedNodes.map((n) => `Bus ${n.label}`);
  const surfaceYTime = timeSeriesData.map((d) => timeIndexToClock(d.Time));

  const customerCounts = {
    Residential: 0,
    Industrial: 0,
    Commercial: 0,
    None: 0,
  };

  for (const n of orderedNodes) {
    if (n.customerType === 'Residential') customerCounts.Residential++;
    else if (n.customerType === 'Industrial') customerCounts.Industrial++;
    else if (n.customerType === 'Commercial') customerCounts.Commercial++;
    else customerCounts.None++;
  }

  const timeSteps: TimeStepResult[] = [];
  const surfaceZ: number[][] = [];
  const surfaceZVoltageDrop: number[][] = [];
  const surfaceZActiveKw: number[][] = [];
  const nodeVoltageHistory: Record<string, number[]> = {};
  for (const on of orderedNodes) {
    nodeVoltageHistory[on.id] = [];
  }

  let minVoltagePuOverall = 2.0;
  let minVoltageAtTime = '';
  let minVoltageNodeLabel = '';
  let peakLossKw = 0;
  let peakLossTime = '';
  let totalEnergyLossKwh = 0;
  let peakDemandKw = 0;
  let peakDemandTime = '';

  for (let i = 0; i < timeSeriesData.length; i++) {
    const pt = timeSeriesData[i];
    const timeLabel = timeIndexToClock(pt.Time);

    let stepTotalDemandKw = 0;
    let stepTotalDemandKvar = 0;
    const nodeActiveKw: Record<string, number> = {};
    const nodeReactiveKvar: Record<string, number> = {};

    // Scale each node based on its own assigned customer type
    const scaledNodes: PdnNode[] = nodes.map((node) => {
      const params = { ...(node.data.params as any) };
      const custType = getNodeCustomerType(node);

      let loadMultiplier = 1.0;
      if (custType === 'Residential') loadMultiplier = pt.Rload;
      else if (custType === 'Industrial') loadMultiplier = pt.Iload;
      else if (custType === 'Commercial') loadMultiplier = pt.Cload;
      else if (custType === 'None') loadMultiplier = 1.0;

      if (node.data.componentType === ComponentType.LOAD) {
        if (typeof params.pDemandMw === 'number') {
          const scaledP = params.pDemandMw * loadMultiplier * factors.kP;
          params.pDemandMw = scaledP;
          nodeActiveKw[node.id] = scaledP;
          stepTotalDemandKw += Math.max(0, scaledP);
        }
        if (typeof params.qDemandMvar === 'number') {
          const scaledQ = params.qDemandMvar * loadMultiplier * factors.kQ;
          params.qDemandMvar = scaledQ;
          nodeReactiveKvar[node.id] = scaledQ;
          stepTotalDemandKvar += Math.max(0, scaledQ);
        }
      } else if (node.data.componentType === ComponentType.NODE) {
        if (typeof params.activePowerMw === 'number') {
          const scaledP = params.activePowerMw * loadMultiplier * factors.kP;
          params.activePowerMw = scaledP;
          nodeActiveKw[node.id] = scaledP;
          stepTotalDemandKw += Math.max(0, scaledP);
        }
        if (typeof params.reactivePowerMvar === 'number') {
          const scaledQ = params.reactivePowerMvar * loadMultiplier * factors.kQ;
          params.reactivePowerMvar = scaledQ;
          nodeReactiveKvar[node.id] = scaledQ;
          stepTotalDemandKvar += Math.max(0, scaledQ);
        }
      }

      return {
        ...node,
        data: {
          ...node.data,
          params,
        },
      };
    });

    if (stepTotalDemandKw > peakDemandKw) {
      peakDemandKw = stepTotalDemandKw;
      peakDemandTime = timeLabel;
    }

    // Solve BFS power flow for this scaled network at interval t
    const solveRes = bfsSolve(scaledNodes, edges);

    const nodeVoltages: Record<string, number> = {};
    const zRow: number[] = [];
    const zDropRow: number[] = [];
    const zActiveRow: number[] = [];
    let minV = 2.0;
    let minNodeId = '';

    for (const on of orderedNodes) {
      const v = solveRes.nodeResults[on.id]?.voltagePu ?? 1.0;
      const vRounded = Number(v.toFixed(5));
      const vDrop = Number((1.0 - v).toFixed(5));
      const pKw = Number((nodeActiveKw[on.id] ?? 0).toFixed(2));

      nodeVoltages[on.id] = v;
      zRow.push(vRounded);
      zDropRow.push(vDrop);
      zActiveRow.push(pKw);
      nodeVoltageHistory[on.id].push(vRounded);

      if (v < minV) {
        minV = v;
        minNodeId = on.id;
      }
    }
    surfaceZ.push(zRow);
    surfaceZVoltageDrop.push(zDropRow);
    surfaceZActiveKw.push(zActiveRow);

    const minNode = nodes.find((n) => n.id === minNodeId);
    const minLabel = minNode?.data.label ?? minNodeId;

    const lossMw = solveRes.summary.totalSystemLossMw ?? 0;
    const lossKw = lossMw * 1000;
    const lossKvar = 0;

    // 15-minute interval = 0.25 hours
    totalEnergyLossKwh += lossKw * 0.25;

    if (lossKw > peakLossKw) {
      peakLossKw = lossKw;
      peakLossTime = timeLabel;
    }

    if (minV < minVoltagePuOverall) {
      minVoltagePuOverall = minV;
      minVoltageAtTime = timeLabel;
      minVoltageNodeLabel = minLabel;
    }

    timeSteps.push({
      timeIndex: pt.Time,
      timeLabel,
      minVoltagePu: minV,
      minVoltageNodeLabel: minLabel,
      totalLossKw: lossKw,
      totalLossKvar: lossKvar,
      totalDemandKw: stepTotalDemandKw,
      totalDemandKvar: stepTotalDemandKvar,
      nodeVoltages,
      nodeActiveKw,
      nodeReactiveKvar,
      multipliers: {
        Residential: pt.Rload,
        Industrial: pt.Iload,
        Commercial: pt.Cload,
      },
    });
  }

  return {
    timeSteps,
    orderedNodes,
    surfaceZ,
    surfaceZVoltageDrop,
    surfaceZActiveKw,
    surfaceYTime,
    surfaceXNodes,
    minVoltagePuOverall,
    minVoltageAtTime,
    minVoltageNodeLabel,
    totalEnergyLossKwh,
    peakLossKw,
    peakLossTime,
    peakDemandKw,
    peakDemandTime,
    nodeVoltageHistory,
    customerCounts,
  };
}
