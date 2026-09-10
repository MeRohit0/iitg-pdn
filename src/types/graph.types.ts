/**
 * Project-PDN — Core domain types for the Power Distribution Network canvas.
 * This is the single source of truth for the app's data shape: React state
 * in TopologyCanvas, localStorage persistence, and JSON import/export all
 * operate directly on PdnNode[]/PdnEdge[] as defined here.
 */

import type { Node, Edge } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ComponentType {
  SUBSTATION = 'substation',
  TRANSFORMER = 'transformer',
  FEEDER = 'feeder',
  GENERATOR = 'generator', // MEG / DG unit
  LOAD = 'load',
  NODE = 'node', // generic compact bus — rendered as a small dot, not a card
}

export enum LineStatus {
  IDLE = 'idle',       // not yet solved
  NORMAL = 'normal',   // within capacity, healthy
  WARNING = 'warning', // near capacity threshold (e.g. >85%)
  OVERLOADED = 'overloaded',
  DE_ENERGIZED = 'de_energized',
}

export enum SolveStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  RUNNING = 'running',
  OPTIMAL = 'optimal',
  FEASIBLE = 'feasible',
  INFEASIBLE = 'infeasible',
  ERROR = 'error',
}

export type CustomerType = 'Residential' | 'Industrial' | 'Commercial' | 'None';

// ---------------------------------------------------------------------------
// Node parameter payloads (per component type)
// ---------------------------------------------------------------------------

/** Shared electrical base parameters present on every network node. */
export interface BaseElectricalParams {
  baseVoltageKv: number; // nominal line-to-line voltage, kV
  minVoltagePu?: number; // default 0.95
  maxVoltagePu?: number; // default 1.05
  customerType?: CustomerType; // customer classification for time-series multipliers
}

export interface SubstationParams extends BaseElectricalParams {
  isSlackBus: boolean; // reference/swing bus for the solver
  maxImportMw?: number;
  slackVoltagePu?: number; // magnitude in p.u., default 1.0
  slackAngleDeg?: number;  // phase angle in degrees, default 0.0
}

export interface TransformerParams extends BaseElectricalParams {
  ratedPowerMva: number;
  primaryKv: number;
  secondaryKv: number;
  impedancePct: number; // short-circuit impedance, %
  tapRatio?: number; // default 1.0
}

export interface GeneratorParams extends BaseElectricalParams {
  pMaxMw: number;
  pMinMw?: number;
  qMaxMvar?: number;
  qMinMvar?: number;
  costPerMwh?: number; // used in objective function
}

export interface LoadParams extends BaseElectricalParams {
  pDemandMw: number;
  qDemandMvar: number;
  isCritical?: boolean; // priority flag for shedding constraints
}

export interface FeederParams extends BaseElectricalParams {
  // Feeders are junction points; usually no independent electrical params
  // beyond voltage limits, kept for extensibility.
}

/** Generic compact bus/junction — for dense networks where drawing every
 *  point as a full labeled card (Substation/Transformer/etc.) would make
 *  the canvas unreadable at scale (e.g. 30+ nodes). Rendered as a small
 *  dot; carries just net active/reactive power and voltage. */
export interface GenericNodeParams extends BaseElectricalParams {
  activePowerMw?: number; // net injection (+) or draw (-)
  reactivePowerMvar?: number; // net injection (+) or draw (-)
}

export type ComponentParams =
  | SubstationParams
  | TransformerParams
  | GeneratorParams
  | LoadParams
  | FeederParams
  | GenericNodeParams;

// ---------------------------------------------------------------------------
// Result payloads (populated after a solve, used to drive overlay styling)
// ---------------------------------------------------------------------------

export interface NodeResult {
  voltagePu?: number;
  voltageKv?: number;
  voltageAngleDeg?: number; // solved angle in degrees
  pInjectionMw?: number;
  qInjectionMvar?: number;
  isEnergized?: boolean;
}

export interface EdgeResult {
  status: LineStatus;
  currentA?: number;
  loadingPct?: number; // currentA / iMaxA * 100
  pFlowMw?: number;
  qFlowMvar?: number;
  lossMw?: number;
}

// ---------------------------------------------------------------------------
// React Flow node/edge data shapes
// ---------------------------------------------------------------------------

export interface PdnNodeData extends Record<string, unknown> {
  label: string;
  componentType: ComponentType;
  params: ComponentParams;
  result?: NodeResult;
}

export interface PdnEdgeData extends Record<string, unknown> {
  label?: string;
  resistanceOhm: number; // R
  reactanceOhm: number; // X
  maxCurrentA: number; // I_max
  lengthKm?: number;
  result?: EdgeResult;
  /** Manual color override set by the user, independent of solve status.
   *  When unset, the edge falls back to status-derived coloring. */
  color?: string;
}

export type PdnNode = Node<PdnNodeData, ComponentType>;
export type PdnEdge = Edge<PdnEdgeData>;

// ---------------------------------------------------------------------------
// Solve results
// ---------------------------------------------------------------------------

export interface SolveSummary {
  status: SolveStatus;
  objectiveValue?: number; // e.g. total cost
  totalSystemLossMw?: number;
  totalGenerationMw?: number;
  totalDemandMw?: number;
  solveTimeMs?: number;
  message?: string;
}

export interface OptimizationResult {
  summary: SolveSummary;
  nodeResults: Record<string, NodeResult>; // keyed by React Flow node id
  edgeResults: Record<string, EdgeResult>; // keyed by React Flow edge id
}
