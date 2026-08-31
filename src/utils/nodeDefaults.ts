import { ComponentType, type ComponentParams } from '../types/graph.types';

export const TYPE_LABELS: Record<ComponentType, string> = {
  [ComponentType.SUBSTATION]: 'Substation',
  [ComponentType.TRANSFORMER]: 'Transformer',
  [ComponentType.GENERATOR]: 'Generator',
  [ComponentType.LOAD]: 'Load',
  [ComponentType.FEEDER]: 'Feeder',
  [ComponentType.NODE]: 'Node',
};

export const TYPE_ICONS: Record<ComponentType, string> = {
  [ComponentType.SUBSTATION]: '⛨',
  [ComponentType.TRANSFORMER]: '⏚',
  [ComponentType.GENERATOR]: '⚡',
  [ComponentType.LOAD]: '🏠',
  [ComponentType.FEEDER]: '◆',
  [ComponentType.NODE]: '●',
};

/** Tailwind text/border color pairing, matches the accent used by each
 *  node's card border in `components/nodes/index.tsx`. */
export const TYPE_ACCENT_CLASS: Record<ComponentType, string> = {
  [ComponentType.SUBSTATION]: 'text-indigo-600 border-indigo-600',
  [ComponentType.TRANSFORMER]: 'text-amber-600 border-amber-500',
  [ComponentType.GENERATOR]: 'text-emerald-600 border-emerald-600',
  [ComponentType.LOAD]: 'text-rose-600 border-rose-500',
  [ComponentType.FEEDER]: 'text-slate-500 border-slate-400',
  [ComponentType.NODE]: 'text-slate-900 border-slate-900',
};

/** Sensible starting parameters for a freshly-dropped node of each type.
 *  The user can adjust these later from an inspector panel — for now they
 *  just need to be valid/non-crashing defaults for the mock solver. */
export function defaultParamsFor(type: ComponentType): ComponentParams {
  switch (type) {
    case ComponentType.SUBSTATION:
      return { baseVoltageKv: 11, isSlackBus: false, slackVoltagePu: 1.0, slackAngleDeg: 0.0 };
    case ComponentType.TRANSFORMER:
      return {
        baseVoltageKv: 11,
        ratedPowerMva: 5,
        primaryKv: 11,
        secondaryKv: 0.4,
        impedancePct: 5,
      };
    case ComponentType.GENERATOR:
      return { baseVoltageKv: 0.4, pMaxMw: 1, costPerMwh: 60 };
    case ComponentType.LOAD:
      return { baseVoltageKv: 0.4, pDemandMw: 1, qDemandMvar: 0.2 };
    case ComponentType.FEEDER:
      return { baseVoltageKv: 0.4 };
    case ComponentType.NODE:
      return { baseVoltageKv: 0.4, activePowerMw: 0, reactivePowerMvar: 0 };
    default:
      return { baseVoltageKv: 11 };
  }
}
