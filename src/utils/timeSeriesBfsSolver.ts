import { bfsSolve } from './bfsSolver';
import { ComponentType, type PdnEdge, type PdnNode } from '../types/graph.types';
import { type TimeSeriesDataPoint, timeIndexToClock } from '../data/defaultTimeSeriesData';

export type LoadClassType = 'Residential' | 'Industrial' | 'Commercial';

export interface TimeStepResult {
  timeIndex: number;
  timeLabel: string;
  multiplier: number;
  minVoltagePu: number;
  minVoltageNodeLabel: string;
  totalLossKw: number;
  totalLossKvar: number;
  // node id / label -> voltage magnitude in p.u.
  nodeVoltages: Record<string, number>;
}

export interface ClassTimeSeriesResult {
  classType: LoadClassType;
  timeSteps: TimeStepResult[];
  // Nodes in sorted display order
  orderedNodes: { id: string; label: string; busNum: number }[];
  // 2D matrix for 3D surface plotting: Z[time_index][node_index] = voltage p.u.
  surfaceZ: number[][];
  surfaceYTime: string[];
  surfaceXNodes: string[];
  // Overall metrics across 24h
  minVoltagePuOverall: number;
  minVoltageAtTime: string;
  minVoltageNodeLabel: string;
  totalEnergyLossKwh: number; // sum(LossKw * 0.25h)
  peakLossKw: number;
  peakLossTime: string;
}

export interface MultiplierFactors {
  kP: number; // Base scaling factor for active power (default: 1.0)
  kQ: number; // Base scaling factor for reactive power (default: 1.0)
}

/**
 * Executes 24-hour time-series BFS power flow across all 96 intervals
 * for Residential, Industrial, and Commercial profiles.
 */
export function solveTimeSeriesBfs(
  nodes: PdnNode[],
  edges: PdnEdge[],
  timeSeriesData: TimeSeriesDataPoint[],
  factors: MultiplierFactors = { kP: 1.0, kQ: 1.0 }
): Record<LoadClassType, ClassTimeSeriesResult> {
  const classes: LoadClassType[] = ['Residential', 'Industrial', 'Commercial'];

  // Order nodes by numerical label or id for clean sequential plotting along feeder
  const orderedNodes = [...nodes]
    .map((n) => {
      const parsedNum = parseInt(n.data.label.replace(/\D/g, ''), 10);
      return {
        id: n.id,
        label: n.data.label || n.id,
        busNum: isNaN(parsedNum) ? 9999 : parsedNum,
      };
    })
    .sort((a, b) => a.busNum - b.busNum);

  const surfaceXNodes = orderedNodes.map((n) => `Bus ${n.label}`);
  const surfaceYTime = timeSeriesData.map((d) => timeIndexToClock(d.Time));

  const results = {} as Record<LoadClassType, ClassTimeSeriesResult>;

  for (const c of classes) {
    const timeSteps: TimeStepResult[] = [];
    const surfaceZ: number[][] = [];

    let minVoltagePuOverall = 2.0;
    let minVoltageAtTime = '';
    let minVoltageNodeLabel = '';
    let peakLossKw = 0;
    let peakLossTime = '';
    let totalEnergyLossKwh = 0;

    for (let i = 0; i < timeSeriesData.length; i++) {
      const pt = timeSeriesData[i];
      const timeLabel = timeIndexToClock(pt.Time);

      let loadMultiplier = 1.0;
      if (c === 'Residential') loadMultiplier = pt.Rload;
      else if (c === 'Industrial') loadMultiplier = pt.Iload;
      else if (c === 'Commercial') loadMultiplier = pt.Cload;

      // Deep-clone nodes and apply multipliers to base active & reactive power
      const scaledNodes: PdnNode[] = nodes.map((node) => {
        const params = { ...(node.data.params as any) };

        if (node.data.componentType === ComponentType.LOAD) {
          if (typeof params.pDemandMw === 'number') {
            params.pDemandMw = params.pDemandMw * loadMultiplier * factors.kP;
          }
          if (typeof params.qDemandMvar === 'number') {
            params.qDemandMvar = params.qDemandMvar * loadMultiplier * factors.kQ;
          }
        } else if (node.data.componentType === ComponentType.NODE) {
          if (typeof params.activePowerMw === 'number') {
            params.activePowerMw = params.activePowerMw * loadMultiplier * factors.kP;
          }
          if (typeof params.reactivePowerMvar === 'number') {
            params.reactivePowerMvar = params.reactivePowerMvar * loadMultiplier * factors.kQ;
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

      // Execute BFS solver for this time interval
      const solveRes = bfsSolve(scaledNodes, edges);

      const nodeVoltages: Record<string, number> = {};
      const zRow: number[] = [];
      let minV = 2.0;
      let minNodeId = '';

      for (const on of orderedNodes) {
        const v = solveRes.nodeResults[on.id]?.voltagePu ?? 1.0;
        nodeVoltages[on.id] = v;
        zRow.push(Number(v.toFixed(5)));
        if (v < minV) {
          minV = v;
          minNodeId = on.id;
        }
      }
      surfaceZ.push(zRow);

      const minNode = nodes.find((n) => n.id === minNodeId);
      const minLabel = minNode?.data.label ?? minNodeId;

      // bfsSolver computes totalSystemLossMw
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
        multiplier: loadMultiplier,
        minVoltagePu: minV,
        minVoltageNodeLabel: minLabel,
        totalLossKw: lossKw,
        totalLossKvar: lossKvar,
        nodeVoltages,
      });
    }

    results[c] = {
      classType: c,
      timeSteps,
      orderedNodes,
      surfaceZ,
      surfaceYTime,
      surfaceXNodes,
      minVoltagePuOverall,
      minVoltageAtTime,
      minVoltageNodeLabel,
      totalEnergyLossKwh,
      peakLossKw,
      peakLossTime,
    };
  }

  return results;
}
