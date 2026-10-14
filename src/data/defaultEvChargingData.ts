import type {
  EvChargingSpatialTemporalMatrix,
  EvChargingStationInfo,
  TransportNode,
} from '../types/transport.types';
import { HOURS_IN_DAY } from '../types/transport.types';

/**
 * Calibrated 24-hour EV charging load profiles (hourly counts of charging EVs)
 * for the 6 benchmark charging stations from Panda & Ganguly (2026),
 * located at nodes 2, 9, 19, 26, 32, 40 of the 41-node transportation test network.
 *
 * Each profile has 24 entries corresponding to Hours 1 to 24 (01:00 to 24:00).
 */
export const BENCHMARK_EV_PROFILES: Record<string, number[]> = {
  // CS 1 (Node 2) — Mixed Commercial/Residential gateway
  '2': [
    1, 1, 0, 0, 1, 3, 7, 12, 16, 14, 11, 13, 15, 12, 10, 11, 14, 18, 20, 17, 13, 8, 4, 2,
  ],
  // CS 2 (Node 9) — Commercial shopping & business district (midday peak)
  '9': [
    0, 0, 0, 0, 1, 2, 5, 9, 15, 19, 22, 24, 21, 23, 20, 18, 16, 14, 11, 8, 5, 3, 1, 1,
  ],
  // CS 3 (Node 19) — High-throughput arterial hub
  '19': [
    2, 1, 1, 1, 2, 4, 8, 14, 18, 17, 16, 18, 19, 17, 16, 18, 21, 23, 22, 19, 15, 10, 6, 3,
  ],
  // CS 4 (Node 26) — Industrial / logistics shift terminal
  '26': [
    3, 2, 2, 2, 4, 8, 14, 10, 8, 9, 11, 14, 16, 12, 9, 12, 16, 13, 9, 8, 10, 12, 7, 4,
  ],
  // CS 5 (Node 32) — Highway bypass / corridor interchange
  '32': [
    1, 1, 0, 0, 1, 3, 6, 11, 14, 13, 15, 17, 16, 15, 14, 16, 19, 21, 18, 15, 11, 7, 3, 2,
  ],
  // CS 6 (Node 40) — Residential residential sector (evening/night peak)
  '40': [
    4, 3, 2, 2, 2, 3, 4, 6, 8, 7, 6, 7, 8, 7, 8, 10, 14, 19, 23, 25, 22, 18, 12, 7,
  ],
};

/** Generic template for custom user-added EV charging stations */
const DEFAULT_EV_CURVE = [
  1, 1, 0, 0, 1, 3, 6, 10, 14, 15, 16, 18, 17, 16, 15, 16, 19, 21, 20, 17, 12, 8, 4, 2,
];

/**
 * Computes the 3D spatial-temporal EV charging distribution matrix for all active
 * EV charging station nodes on the transportation canvas.
 *
 * @param nodes Active canvas nodes
 * @returns Spatial-temporal matrix with X = charging stations, Y = hours 1..24, Z = number of charging EVs
 */
export function computeEvChargingDistribution(
  nodes: TransportNode[]
): EvChargingSpatialTemporalMatrix {
  // Filter nodes designated as EV charging stations
  const evNodes = nodes
    .filter((n) => Boolean(n.data?.isEvChargingStation))
    .sort((a, b) => {
      const numA = parseInt(a.data?.label ?? a.id, 10);
      const numB = parseInt(b.data?.label ?? b.id, 10);
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return (a.data?.label ?? a.id).localeCompare(b.data?.label ?? b.id);
    });

  const hours = Array.from({ length: HOURS_IN_DAY }, (_, i) => i + 1);

  const stations: EvChargingStationInfo[] = evNodes.map((node, index) => {
    const rawLabel = String(node.data?.label ?? node.id);
    const stationName = `CS ${index + 1} (Node ${rawLabel})`;
    const powerKw = typeof node.data?.powerDrawKw === 'number' && node.data.powerDrawKw > 0
      ? node.data.powerDrawKw
      : 50;
    const voltageKv = typeof node.data?.voltageKv === 'number' ? node.data.voltageKv : 0.4;

    // Scale profile if power draw differs from nominal 50 kW benchmark
    const scaleFactor = Math.max(0.2, powerKw / 50);

    const baseProfile =
      BENCHMARK_EV_PROFILES[rawLabel] ||
      BENCHMARK_EV_PROFILES[node.id] ||
      DEFAULT_EV_CURVE;

    const hourlyChargingEvs = baseProfile.map((count) =>
      Math.max(0, Math.round(count * scaleFactor))
    );

    const peakChargingEvs = Math.max(...hourlyChargingEvs, 0);
    const totalDailySessions = hourlyChargingEvs.reduce((sum, v) => sum + v, 0);

    return {
      id: node.id,
      label: rawLabel,
      stationName,
      voltageKv,
      powerDrawKw: powerKw,
      hourlyChargingEvs,
      peakChargingEvs,
      totalDailySessions,
    };
  });

  const stationLabels = stations.map((s) => s.stationName);

  // Build Z matrix: rows = hours (1..24), columns = stations (0..stations.length - 1)
  const zMatrix: number[][] = hours.map((hour) => {
    const hourIdx = hour - 1;
    return stations.map((st) => st.hourlyChargingEvs[hourIdx] ?? 0);
  });

  return {
    stationLabels,
    hours,
    zMatrix,
    stations,
  };
}
