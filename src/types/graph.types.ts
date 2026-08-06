/**
 * Project-PDN — Core domain types for the Power Distribution Network canvas.
 * These types mirror (and must stay in sync with) the backend Pydantic
 * models in `backend/app/models/schemas.py`.
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

// ---------------------------------------------------------------------------
// Node parameter payloads (per component type)
// ---------------------------------------------------------------------------

/** Shared electrical base parameters present on every network node. */
export interface BaseElectricalParams {
  baseVoltageKv: number; // nominal line-to-line voltage, kV
  minVoltagePu?: number; // default 0.95
  maxVoltagePu?: number; // default 1.05
}

export interface SubstationParams extends BaseElectricalParams {
  isSlackBus: boolean; // reference/swing bus for the solver
  maxImportMw?: number;
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

export type ComponentParams =
  | SubstationParams
  | TransformerParams
  | GeneratorParams
  | LoadParams
  | FeederParams;

// ---------------------------------------------------------------------------
// Result payloads (populated after a solve, used to drive overlay styling)
// ---------------------------------------------------------------------------

export interface NodeResult {
  voltagePu?: number;
  voltageKv?: number;
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
}

export type PdnNode = Node<PdnNodeData, ComponentType>;
export type PdnEdge = Edge<PdnEdgeData>;

// ---------------------------------------------------------------------------
// API payload contracts
// ---------------------------------------------------------------------------

export interface GraphPayload {
  scenarioName?: string;
  nodes: PdnNode[];
  edges: PdnEdge[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string; // e.g. "ORPHAN_NODE", "NO_SLACK_BUS"
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResponse {
  isValid: boolean;
  issues: ValidationIssue[];
}

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

// ---------------------------------------------------------------------------
// Scenario persistence
// ---------------------------------------------------------------------------

export interface ScenarioSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Scenario extends ScenarioSummary {
  graph: GraphPayload;
  lastResult?: OptimizationResult;
}
