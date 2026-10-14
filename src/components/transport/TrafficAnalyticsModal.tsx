import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlotlyChart } from '../analytics/PlotlyChart';
import {
  HOURS_IN_DAY,
  ROAD_TYPE_COLORS,
  ROAD_TYPE_LABELS,
  ROAD_TYPES,
  TIME_SLOTS,
  timeSlotToClock,
  trafficAt,
  type TrafficProfiles,
  type TransportNode,
  type TransportRoad,
} from '../../types/transport.types';
import { computeEvChargingDistribution } from '../../data/defaultEvChargingData';

export type AnalyticsTab = 'ev-3d' | 'ev-ridge' | 'ev-2d' | 'traffic-3d' | 'traffic-2d';

interface Props {
  nodes?: TransportNode[];
  roads: TransportRoad[];
  trafficProfiles: TrafficProfiles;
  /** Road number to emphasize when opened from a selected road. */
  focusRoadNumber?: number | null;
  /** Initial tab to open */
  initialTab?: AnalyticsTab;
  onClose: () => void;
}

const STATION_PALETTE = [
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#4f46e5', // indigo
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Transportation and EV Analytics Modal —
 * 1. 3D Spatial-temporal surface of EV charging (Charging Station × Time in hours × No of charging EV)
 * 2. 2D/3D Ridgeline Plot (Joyplot & 3D Ribbons) across stations and 24 hours
 * 3. 2D EV Station individual curves & occupancy statistics
 * 4. 3D surface of road vehicles over (Road number × 96 time slots)
 * 5. 2D road type profiles
 */
export const TrafficAnalyticsModal: React.FC<Props> = ({
  nodes = [],
  roads,
  trafficProfiles,
  focusRoadNumber = null,
  initialTab = 'ev-3d',
  onClose,
}) => {
  const [tab, setTab] = useState<AnalyticsTab>(initialTab);

  // Ridgeline sub-mode ('2d' Joyplot or '3d' Ribbons)
  const [ridgeMode, setRidgeMode] = useState<'2d' | '3d'>('2d');
  const [ridgeOverlap, setRidgeOverlap] = useState<number>(0.65);

  // Road traffic time step (1 to 96 slots)
  const [currentTimeStep, setCurrentTimeStep] = useState(48);
  const [isTrafficPlaying, setIsTrafficPlaying] = useState(false);
  const [trafficPlaybackSpeed, setTrafficPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const trafficPlayRef = useRef<number | null>(null);

  // EV charging hour (1 to 24 hours)
  const [currentEvHour, setCurrentEvHour] = useState(12);
  const [isEvPlaying, setIsEvPlaying] = useState(false);
  const [evPlaybackSpeed, setEvPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const evPlayRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // EV Charging Data Engine
  // ---------------------------------------------------------------------------
  const evMatrix = useMemo(() => {
    return computeEvChargingDistribution(nodes);
  }, [nodes]);

  const evHourLabels = useMemo(() => {
    return Array.from({ length: HOURS_IN_DAY }, (_, i) => `${i + 1} h`);
  }, []);

  const currentEvHourLabel = `${currentEvHour} h`;
  const currentEvClock = `${String(currentEvHour).padStart(2, '0')}:00`;

  // EV Playback timer
  useEffect(() => {
    if (!isEvPlaying) {
      if (evPlayRef.current != null) window.clearInterval(evPlayRef.current);
      evPlayRef.current = null;
      return;
    }
    const ms = 700 / evPlaybackSpeed;
    evPlayRef.current = window.setInterval(() => {
      setCurrentEvHour((h) => (h >= HOURS_IN_DAY ? 1 : h + 1));
    }, ms);
    return () => {
      if (evPlayRef.current != null) window.clearInterval(evPlayRef.current);
    };
  }, [isEvPlaying, evPlaybackSpeed]);

  // ---------------------------------------------------------------------------
  // Road Traffic Data Engine
  // ---------------------------------------------------------------------------
  const sortedRoads = useMemo(() => {
    return [...roads].sort(
      (a, b) => (a.data?.roadNumber ?? 0) - (b.data?.roadNumber ?? 0)
    );
  }, [roads]);

  const roadNumbers = useMemo(
    () => sortedRoads.map((r) => r.data?.roadNumber ?? 0),
    [sortedRoads]
  );

  const clockString = timeSlotToClock(currentTimeStep);

  // Traffic Playback timer
  useEffect(() => {
    if (!isTrafficPlaying) {
      if (trafficPlayRef.current != null) window.clearInterval(trafficPlayRef.current);
      trafficPlayRef.current = null;
      return;
    }
    const ms = 400 / trafficPlaybackSpeed;
    trafficPlayRef.current = window.setInterval(() => {
      setCurrentTimeStep((t) => (t >= TIME_SLOTS ? 1 : t + 1));
    }, ms);
    return () => {
      if (trafficPlayRef.current != null) window.clearInterval(trafficPlayRef.current);
    };
  }, [isTrafficPlaying, trafficPlaybackSpeed]);

  const trafficSurface = useMemo(() => {
    const x = roadNumbers;
    const y = Array.from({ length: TIME_SLOTS }, (_, i) => i + 1);
    const z: number[][] = y.map((t) =>
      sortedRoads.map((road) => trafficAt(trafficProfiles, road.data?.roadType, t))
    );
    return { x, y, z };
  }, [roadNumbers, sortedRoads, trafficProfiles]);

  // ---------------------------------------------------------------------------
  // 1. 3D EV Charging Surface Plot
  // ---------------------------------------------------------------------------
  const chartEv3DData = useMemo(() => {
    if (tab !== 'ev-3d' || evMatrix.stations.length === 0) return [];

    const traces: any[] = [
      {
        type: 'surface',
        x: evMatrix.stationLabels,
        y: evHourLabels,
        z: evMatrix.zMatrix,
        customdata: evMatrix.hours.map((h) =>
          evMatrix.stationLabels.map(() => `${String(h).padStart(2, '0')}:00`)
        ),
        colorscale: 'Viridis',
        colorbar: {
          title: {
            text: 'Charging EVs',
            font: { size: 11, color: '#334155' },
            side: 'right',
          },
          len: 0.75,
          thickness: 16,
        },
        hovertemplate:
          'Charging Station: <b>%{x}</b><br>Time (in hours): <b>%{y}</b> (%{customdata})<br>No of charging ev: <b>%{z:.0f}</b><extra></extra>',
      },
    ];

    // Active time-slice cursor line across all charging stations at currentEvHour
    const currentHourZ = evMatrix.zMatrix[currentEvHour - 1] ?? [];
    traces.push({
      type: 'scatter3d',
      mode: 'lines+markers',
      name: `Hour: ${currentEvHour} h (${currentEvClock})`,
      x: evMatrix.stationLabels,
      y: Array.from({ length: evMatrix.stationLabels.length }, () => currentEvHourLabel),
      z: currentHourZ,
      line: { color: '#ef4444', width: 6 },
      marker: { size: 4, color: '#ef4444' },
      hovertemplate: `Charging Station: <b>%{x}</b><br>Time: <b>${currentEvHourLabel}</b> (${currentEvClock})<br>No of charging ev: <b>%{z:.0f}</b><extra>Active Hour</extra>`,
    });

    return traces;
  }, [tab, evMatrix, evHourLabels, currentEvHour, currentEvHourLabel, currentEvClock]);

  const chartEv3DLayout = useMemo(
    () => ({
      title: {
        text: `<b>Spatial-Temporal Distribution of EV Charging — ${evMatrix.stations.length} Stations × 24 Hours</b>`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      uirevision: 'constant',
      scene: {
        aspectmode: 'manual',
        aspectratio: { x: 2.2, y: 1.8, z: 1.0 },
        uirevision: 'constant',
        xaxis: {
          title: {
            text: 'Charging Station',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
        },
        yaxis: {
          title: {
            text: 'Time (in hours)',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
          nticks: 12,
        },
        zaxis: {
          title: {
            text: 'No of charging ev',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
        },
        camera: { eye: { x: 1.9, y: -2.0, z: 1.3 } },
      },
      margin: { l: 10, r: 10, t: 40, b: 20 },
      paper_bgcolor: 'transparent',
      showlegend: true,
    }),
    [evMatrix.stations.length]
  );

  // ---------------------------------------------------------------------------
  // 2. Ridgeline Plot Engine: 2D Joyplot
  // ---------------------------------------------------------------------------
  const chartRidge2DData = useMemo(() => {
    if (tab !== 'ev-ridge' || ridgeMode !== '2d' || evMatrix.stations.length === 0) return [];

    const stations = evMatrix.stations;
    const numStations = stations.length;

    let maxEv = 1;
    stations.forEach((s) => {
      s.hourlyChargingEvs.forEach((v) => {
        if (v > maxEv) maxEv = v;
      });
    });

    const spacing = Math.max(10, maxEv * ridgeOverlap);
    const traces: any[] = [];

    // Draw from top to bottom so bottom ridges naturally overlap in front
    for (let i = 0; i < numStations; i++) {
      const station = stations[i];
      // Index baseline: station 0 at top
      const baseline = (numStations - 1 - i) * spacing;
      const color = STATION_PALETTE[i % STATION_PALETTE.length];
      const fillColor = hexToRgba(color, 0.52);

      const xPoly = [...evHourLabels, evHourLabels[evHourLabels.length - 1], evHourLabels[0]];
      const yPoly = [
        ...station.hourlyChargingEvs.map((v) => baseline + v),
        baseline,
        baseline,
      ];

      const customData = [
        ...station.hourlyChargingEvs.map((v) => ({ evs: v, station: station.stationName })),
        { evs: 0, station: station.stationName },
        { evs: 0, station: station.stationName },
      ];

      // Filled area ridge
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: station.stationName,
        x: xPoly,
        y: yPoly,
        fill: 'toself',
        fillcolor: fillColor,
        line: { color, width: 2.2 },
        customdata: customData,
        hovertemplate:
          'Station: <b>%{customdata.station}</b><br>Time: <b>%{x}</b><br>No of charging ev: <b>%{customdata.evs}</b><extra></extra>',
      });

      // Baseline reference line
      traces.push({
        type: 'scatter',
        mode: 'lines',
        showlegend: false,
        x: evHourLabels,
        y: Array(HOURS_IN_DAY).fill(baseline),
        line: { color: '#cbd5e1', width: 1, dash: 'dot' },
        hoverinfo: 'skip',
      });

      // Current hour marker on ridge crest
      const curVal = station.hourlyChargingEvs[currentEvHour - 1] ?? 0;
      traces.push({
        type: 'scatter',
        mode: 'markers',
        showlegend: false,
        x: [currentEvHourLabel],
        y: [baseline + curVal],
        marker: { size: 8, color, line: { color: '#ffffff', width: 2 } },
        customdata: [{ evs: curVal, station: station.stationName }],
        hovertemplate: `Station: <b>${station.stationName}</b><br>Time: <b>%{x}</b> (${currentEvClock})<br>Charging EVs: <b>%{customdata.evs}</b><extra>Active Hour</extra>`,
      });
    }

    return traces;
  }, [
    tab,
    ridgeMode,
    evMatrix.stations,
    ridgeOverlap,
    evHourLabels,
    currentEvHour,
    currentEvHourLabel,
    currentEvClock,
  ]);

  const chartRidge2DLayout = useMemo(() => {
    const stations = evMatrix.stations;
    let maxEv = 1;
    stations.forEach((s) => {
      s.hourlyChargingEvs.forEach((v) => {
        if (v > maxEv) maxEv = v;
      });
    });
    const spacing = Math.max(10, maxEv * ridgeOverlap);

    const tickvals = stations.map((_, i) => (stations.length - 1 - i) * spacing);
    const ticktext = stations.map((s) => s.stationName);

    return {
      title: {
        text: `<b>2D Ridgeline Plot (Joyplot) — EV Charging across ${stations.length} Stations (24 Hours)</b>`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      xaxis: {
        title: 'Time (in hours)',
        gridcolor: '#e2e8f0',
        showgrid: true,
      },
      yaxis: {
        title: 'Charging Station',
        tickmode: 'array',
        tickvals,
        ticktext,
        gridcolor: '#f8fafc',
        zeroline: false,
        showgrid: true,
      },
      margin: { l: 140, r: 30, t: 45, b: 60 },
      legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#fafafa',
      shapes: [
        {
          type: 'line',
          x0: currentEvHourLabel,
          x1: currentEvHourLabel,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: '#ef4444', width: 1.5, dash: 'dash' },
        },
      ],
    };
  }, [evMatrix.stations, ridgeOverlap, currentEvHourLabel]);

  // ---------------------------------------------------------------------------
  // 3. Ridgeline Plot Engine: 3D Ribbon / Waterfall
  // ---------------------------------------------------------------------------
  const chartRidge3DData = useMemo(() => {
    if (tab !== 'ev-ridge' || ridgeMode !== '3d' || evMatrix.stations.length === 0) return [];

    const traces: any[] = [];
    const stations = evMatrix.stations;

    stations.forEach((station, i) => {
      const color = STATION_PALETTE[i % STATION_PALETTE.length];
      const halfWidth = 0.2; // ribbon thickness along station X axis

      const xCenter = i;
      const xLeft = xCenter - halfWidth;
      const xRight = xCenter + halfWidth;

      // 3D Ribbon Surface
      traces.push({
        type: 'surface',
        name: station.stationName,
        showscale: false,
        x: [xLeft, xRight],
        y: evHourLabels,
        z: [station.hourlyChargingEvs, station.hourlyChargingEvs],
        colorscale: [
          [0, color],
          [1, color],
        ],
        opacity: 0.9,
        lighting: { ambient: 0.85, diffuse: 0.8 },
        hovertemplate: `Station: <b>${station.stationName}</b><br>Time: <b>%{y}</b><br>No of charging ev: <b>%{z:.0f}</b><extra></extra>`,
      });

      // Ribbon Crest line
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        name: `${station.stationName} Crest`,
        showlegend: false,
        x: Array(HOURS_IN_DAY).fill(xCenter),
        y: evHourLabels,
        z: station.hourlyChargingEvs,
        line: { color, width: 5 },
        hoverinfo: 'skip',
      });

      // Vertical drop curtain to Z = 0
      traces.push({
        type: 'surface',
        name: `${station.stationName} Curtain`,
        showscale: false,
        showlegend: false,
        x: [xLeft, xLeft],
        y: evHourLabels,
        z: [station.hourlyChargingEvs, Array(HOURS_IN_DAY).fill(0)],
        colorscale: [
          [0, 'rgba(15, 23, 42, 0.05)'],
          [1, hexToRgba(color, 0.45)],
        ],
        opacity: 0.65,
        hoverinfo: 'skip',
      });
    });

    // Active hour cross-cut line across all ribbons
    traces.push({
      type: 'scatter3d',
      mode: 'lines+markers',
      name: `Hour: ${currentEvHourLabel}`,
      x: stations.map((_, i) => i),
      y: Array(stations.length).fill(currentEvHourLabel),
      z: stations.map((st) => st.hourlyChargingEvs[currentEvHour - 1] ?? 0),
      line: { color: '#ef4444', width: 6 },
      marker: { size: 5, color: '#ef4444' },
      hovertemplate: `Time: <b>${currentEvHourLabel}</b> (${currentEvClock})<br>No of charging ev: <b>%{z:.0f}</b><extra>Active Hour</extra>`,
    });

    return traces;
  }, [
    tab,
    ridgeMode,
    evMatrix.stations,
    evHourLabels,
    currentEvHour,
    currentEvHourLabel,
    currentEvClock,
  ]);

  const chartRidge3DLayout = useMemo(() => {
    const stations = evMatrix.stations;
    return {
      title: {
        text: `<b>3D Ribbon / Waterfall Ridgeline — ${stations.length} Stations × 24 Hours</b>`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      uirevision: 'constant',
      scene: {
        aspectmode: 'manual',
        aspectratio: { x: 2.2, y: 1.8, z: 1.0 },
        uirevision: 'constant',
        xaxis: {
          title: {
            text: 'Charging Station',
            font: { size: 12, color: '#1e293b' },
          },
          tickmode: 'array',
          tickvals: stations.map((_, i) => i),
          ticktext: stations.map((s) => s.stationName),
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
        },
        yaxis: {
          title: {
            text: 'Time (in hours)',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
          nticks: 12,
        },
        zaxis: {
          title: {
            text: 'No of charging ev',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
        },
        camera: { eye: { x: 1.85, y: -1.95, z: 1.25 } },
      },
      margin: { l: 10, r: 10, t: 40, b: 20 },
      paper_bgcolor: 'transparent',
      showlegend: true,
    };
  }, [evMatrix.stations]);

  // ---------------------------------------------------------------------------
  // 4. 2D EV Station Profiles Plot
  // ---------------------------------------------------------------------------
  const chartEv2DData = useMemo(() => {
    if (tab !== 'ev-2d' || evMatrix.stations.length === 0) return [];

    const traces: any[] = evMatrix.stations.map((station, i) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name: station.stationName,
      x: evHourLabels,
      y: station.hourlyChargingEvs,
      line: { color: STATION_PALETTE[i % STATION_PALETTE.length], width: 2.5 },
      marker: { size: 5 },
      hovertemplate: `Station: <b>${station.stationName}</b><br>Time: <b>%{x}</b><br>No of charging ev: <b>%{y}</b><extra></extra>`,
    }));

    return traces;
  }, [tab, evMatrix, evHourLabels]);

  const chartEv2DLayout = useMemo(
    () => ({
      title: {
        text: `<b>24-Hour EV Charging Profiles by Station</b> · Scrubber at Hour ${currentEvHour} (${currentEvClock})`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      xaxis: { title: 'Time (in hours)', gridcolor: '#e2e8f0' },
      yaxis: { title: 'No of charging ev', gridcolor: '#e2e8f0', zeroline: false },
      margin: { l: 55, r: 25, t: 45, b: 60 },
      legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#fafafa',
      shapes: [
        {
          type: 'line',
          x0: currentEvHourLabel,
          x1: currentEvHourLabel,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: '#ef4444', width: 1.5, dash: 'dot' },
        },
      ],
    }),
    [currentEvHour, currentEvClock, currentEvHourLabel]
  );

  // ---------------------------------------------------------------------------
  // 5. 3D Road Traffic Surface Plot
  // ---------------------------------------------------------------------------
  const chartTraffic3DData = useMemo(() => {
    if (tab !== 'traffic-3d' || sortedRoads.length === 0) return [];

    const traces: any[] = [
      {
        type: 'surface',
        x: trafficSurface.x,
        y: trafficSurface.y.map(timeSlotToClock),
        z: trafficSurface.z,
        customdata: trafficSurface.y.map((slot) => trafficSurface.x.map(() => slot)),
        colorscale: 'Viridis',
        colorbar: {
          title: {
            text: 'Traffic',
            font: { size: 11, color: '#334155' },
            side: 'right',
          },
          len: 0.75,
          thickness: 16,
        },
        hovertemplate:
          'Road number: <b>%{x}</b><br>Time: <b>%{y}</b> (Slot %{customdata}/96)<br>Traffic: <b>%{z:.0f} vehicles</b><extra></extra>',
        opacity: focusRoadNumber != null ? 0.85 : 1,
      },
    ];

    traces.push({
      type: 'scatter3d',
      mode: 'lines+markers',
      name: `Time: ${clockString}`,
      x: roadNumbers,
      y: Array.from({ length: roadNumbers.length }, () => clockString),
      z: sortedRoads.map((road) =>
        trafficAt(trafficProfiles, road.data?.roadType, currentTimeStep)
      ),
      line: { color: '#ef4444', width: 5 },
      marker: { size: 3, color: '#ef4444' },
      hovertemplate: `Road number: <b>%{x}</b><br>Time: <b>${clockString}</b> (Slot ${currentTimeStep}/96)<br>Traffic: <b>%{z:.0f} vehicles</b><extra>Current Time</extra>`,
    });

    if (focusRoadNumber != null) {
      const idx = sortedRoads.findIndex((r) => r.data?.roadNumber === focusRoadNumber);
      if (idx >= 0) {
        const road = sortedRoads[idx];
        const zs = Array.from({ length: TIME_SLOTS }, (_, i) =>
          trafficAt(trafficProfiles, road.data?.roadType, i + 1)
        );
        traces.push({
          type: 'scatter3d',
          mode: 'lines',
          name: `Road ${focusRoadNumber}`,
          x: Array.from({ length: TIME_SLOTS }, () => focusRoadNumber),
          y: Array.from({ length: TIME_SLOTS }, (_, i) => timeSlotToClock(i + 1)),
          z: zs,
          customdata: Array.from({ length: TIME_SLOTS }, (_, i) => i + 1),
          line: { color: '#4f46e5', width: 6 },
          hovertemplate: `Road number: <b>${focusRoadNumber}</b><br>Time: <b>%{y}</b> (Slot %{customdata}/96)<br>Traffic: <b>%{z:.0f} vehicles</b><extra>Road ${focusRoadNumber}</extra>`,
        });
      }
    }

    return traces;
  }, [
    tab,
    trafficSurface,
    focusRoadNumber,
    sortedRoads,
    trafficProfiles,
    currentTimeStep,
    clockString,
    roadNumbers,
  ]);

  const chartTraffic3DLayout = useMemo(
    () => ({
      title: {
        text: `<b>3D Traffic Surface — ${sortedRoads.length} Roads × 96 Time Intervals (24h)</b>`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      uirevision: 'constant',
      scene: {
        aspectmode: 'manual',
        aspectratio: { x: 2.2, y: 1.8, z: 1.0 },
        uirevision: 'constant',
        xaxis: {
          title: {
            text: 'Road number',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
          nticks: Math.min(sortedRoads.length, 14),
        },
        yaxis: {
          title: {
            text: 'Time (96 intervals / 24h)',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
          nticks: 12,
        },
        zaxis: {
          title: {
            text: 'Traffic',
            font: { size: 12, color: '#1e293b' },
          },
          gridcolor: '#cbd5e1',
          tickfont: { size: 10, color: '#475569' },
        },
        camera: { eye: { x: 1.9, y: -2.0, z: 1.3 } },
      },
      margin: { l: 10, r: 10, t: 40, b: 20 },
      paper_bgcolor: 'transparent',
      showlegend: true,
    }),
    [sortedRoads.length]
  );

  // ---------------------------------------------------------------------------
  // 6. 2D Road Traffic Profiles Plot
  // ---------------------------------------------------------------------------
  const chartTraffic2DData = useMemo(() => {
    if (tab !== 'traffic-2d') return [];
    const times = Array.from({ length: TIME_SLOTS }, (_, i) => timeSlotToClock(i + 1));
    const traces: any[] = ROAD_TYPES.map((t) => ({
      type: 'scatter',
      mode: 'lines',
      name: ROAD_TYPE_LABELS[t],
      x: times,
      y: trafficProfiles[t],
      line: { color: ROAD_TYPE_COLORS[t], width: 2.5 },
    }));

    if (focusRoadNumber != null) {
      const road = sortedRoads.find((r) => r.data?.roadNumber === focusRoadNumber);
      if (road?.data?.roadType) {
        const rt = road.data.roadType;
        const veh = trafficAt(trafficProfiles, rt, currentTimeStep);
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: `Road ${focusRoadNumber} (${ROAD_TYPE_LABELS[rt]} @ ${clockString})`,
          x: [clockString],
          y: [veh],
          marker: { size: 10, color: ROAD_TYPE_COLORS[rt], symbol: 'diamond' },
          hovertemplate: `Road ${focusRoadNumber} (${rt})<br>Time: %{x}<br>Vehicles: <b>%{y:.0f}</b><extra></extra>`,
        });
      }
    }

    return traces;
  }, [tab, trafficProfiles, focusRoadNumber, sortedRoads, currentTimeStep, clockString]);

  const chartTraffic2DLayout = useMemo(
    () => ({
      title: {
        text: `<b>Traffic profiles by road type</b> · scrubber at ${clockString}`,
        font: { size: 14, color: '#1e293b' },
      },
      autosize: true,
      xaxis: { title: 'Time of day', gridcolor: '#e2e8f0' },
      yaxis: { title: 'Vehicles', gridcolor: '#e2e8f0', zeroline: false },
      margin: { l: 55, r: 25, t: 45, b: 60 },
      legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#fafafa',
      shapes: [
        {
          type: 'line',
          x0: clockString,
          x1: clockString,
          y0: 0,
          y1: 1,
          yref: 'paper',
          line: { color: '#4f46e5', width: 1.5, dash: 'dot' },
        },
      ],
    }),
    [clockString]
  );

  const isEvMode = tab === 'ev-3d' || tab === 'ev-ridge' || tab === 'ev-2d';

  const togglePlay = useCallback(() => {
    if (isEvMode) {
      setIsEvPlaying((p) => !p);
    } else {
      setIsTrafficPlaying((p) => !p);
    }
  }, [isEvMode]);

  // Aggregate stats for EV at current hour
  const currentTotalEvs = useMemo(() => {
    if (evMatrix.stations.length === 0) return 0;
    const hourIdx = currentEvHour - 1;
    return evMatrix.stations.reduce(
      (sum, st) => sum + (st.hourlyChargingEvs[hourIdx] ?? 0),
      0
    );
  }, [evMatrix, currentEvHour]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex flex-col w-[min(1140px,96vw)] h-[min(760px,94vh)] rounded-lg bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 bg-white">
          <div>
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span>Transportation & EV Analytics</span>
              {isEvMode && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  EV Charging Suite
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {tab === 'ev-ridge'
                ? `Ridgeline Plot (${ridgeMode === '2d' ? '2D Joyplot' : '3D Ribbons'}) · Staggered distribution across stations and 24 hours`
                : isEvMode
                ? 'Spatial-temporal distribution of EV charging · 24-hour diurnal operational profiles'
                : 'Vehicles per road from type profiles (T1 / T2 / T3) · 96 × 15-min slots'}
              {focusRoadNumber != null && !isEvMode ? ` · highlighting road ${focusRoadNumber}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tab & Controls Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/90 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg mr-2">
            <button
              type="button"
              onClick={() => setTab('ev-3d')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'ev-3d'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80'
              }`}
            >
              ⚡ EV Surface (3D)
            </button>
            <button
              type="button"
              onClick={() => setTab('ev-ridge')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'ev-ridge'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80'
              }`}
            >
              🏔️ EV Ridgeline
            </button>
            <button
              type="button"
              onClick={() => setTab('ev-2d')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'ev-2d'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80'
              }`}
            >
              EV Profiles (2D)
            </button>
            <span className="h-4 w-[1px] bg-slate-300 mx-0.5" />
            <button
              type="button"
              onClick={() => setTab('traffic-3d')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'traffic-3d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80'
              }`}
            >
              Road Traffic (3D)
            </button>
            <button
              type="button"
              onClick={() => setTab('traffic-2d')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'traffic-2d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80'
              }`}
            >
              Type Profiles (2D)
            </button>
          </div>

          {/* Ridgeline Specific Sub-controls */}
          {tab === 'ev-ridge' && (
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 mr-1">
              <div className="flex items-center gap-0.5 bg-slate-200/90 p-0.5 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setRidgeMode('2d')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    ridgeMode === '2d'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2D Joyplot
                </button>
                <button
                  type="button"
                  onClick={() => setRidgeMode('3d')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    ridgeMode === '3d'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3D Ribbons
                </button>
              </div>

              {ridgeMode === '2d' && (
                <div className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Overlap:</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1.3}
                    step={0.05}
                    value={ridgeOverlap}
                    onChange={(e) => setRidgeOverlap(Number(e.target.value))}
                    className="w-16 accent-emerald-600 cursor-pointer"
                    title="Adjust vertical ridge overlap"
                  />
                  <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                    {Math.round(ridgeOverlap * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Time Scrubber Controls */}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            {isEvMode ? (
              <>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors"
                >
                  {isEvPlaying ? 'Pause' : 'Play 24h'}
                </button>
                <select
                  value={evPlaybackSpeed}
                  onChange={(e) => setEvPlaybackSpeed(Number(e.target.value) as 1 | 2 | 4)}
                  className="rounded-md border border-slate-300 bg-white px-1.5 py-1"
                >
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
                <span className="tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                  Hour {currentEvHour} <span className="text-[10px] text-slate-400 font-normal">({currentEvClock})</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={HOURS_IN_DAY}
                  value={currentEvHour}
                  onChange={(e) => {
                    setIsEvPlaying(false);
                    setCurrentEvHour(Number(e.target.value));
                  }}
                  className="w-36 accent-emerald-600"
                />
                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-800 tabular-nums">
                  Active EVs: <b>{currentTotalEvs}</b>
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 transition-colors"
                >
                  {isTrafficPlaying ? 'Pause' : 'Play'}
                </button>
                <select
                  value={trafficPlaybackSpeed}
                  onChange={(e) => setTrafficPlaybackSpeed(Number(e.target.value) as 1 | 2 | 4)}
                  className="rounded-md border border-slate-300 bg-white px-1.5 py-1"
                >
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
                <span className="tabular-nums font-medium text-indigo-700 whitespace-nowrap">
                  {clockString} <span className="text-[10px] text-slate-400 font-normal">(Slot {currentTimeStep}/{TIME_SLOTS})</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={TIME_SLOTS}
                  value={currentTimeStep}
                  onChange={(e) => {
                    setIsTrafficPlaying(false);
                    setCurrentTimeStep(Number(e.target.value));
                  }}
                  className="w-36 accent-indigo-600"
                />
              </>
            )}
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 min-h-0 p-3">
          {tab === 'ev-3d' ? (
            evMatrix.stations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <p className="text-sm font-medium text-slate-600">No EV charging stations active on canvas</p>
                <p className="text-xs text-slate-400">
                  Select a node on the canvas and check "EV charging station" in the inspector to view charging analytics.
                </p>
              </div>
            ) : (
              <PlotlyChart data={chartEv3DData} layout={chartEv3DLayout} style={{ minHeight: '480px' }} />
            )
          ) : tab === 'ev-ridge' ? (
            evMatrix.stations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <p className="text-sm font-medium text-slate-600">No EV charging stations active on canvas</p>
              </div>
            ) : ridgeMode === '2d' ? (
              <PlotlyChart data={chartRidge2DData} layout={chartRidge2DLayout} style={{ minHeight: '480px' }} />
            ) : (
              <PlotlyChart data={chartRidge3DData} layout={chartRidge3DLayout} style={{ minHeight: '480px' }} />
            )
          ) : tab === 'ev-2d' ? (
            evMatrix.stations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <p className="text-sm font-medium text-slate-600">No EV charging stations active on canvas</p>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-3">
                <div className="flex-1 min-h-0">
                  <PlotlyChart data={chartEv2DData} layout={chartEv2DLayout} style={{ minHeight: '320px' }} />
                </div>
                <div className="max-h-36 overflow-y-auto rounded border border-slate-200">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-1">Charging Station</th>
                        <th className="px-2 py-1">Voltage</th>
                        <th className="px-2 py-1">Power Draw</th>
                        <th className="px-2 py-1">Charging EVs @ Hour {currentEvHour}</th>
                        <th className="px-2 py-1">Peak EVs (24h)</th>
                        <th className="px-2 py-1">Total Daily Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evMatrix.stations.map((st, i) => {
                        const curEv = st.hourlyChargingEvs[currentEvHour - 1] ?? 0;
                        return (
                          <tr key={st.id} className="text-slate-700 hover:bg-slate-50 border-t border-slate-100">
                            <td className="px-2 py-1 font-medium flex items-center gap-1.5">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: STATION_PALETTE[i % STATION_PALETTE.length] }}
                              />
                              {st.stationName}
                            </td>
                            <td className="px-2 py-1 tabular-nums">{st.voltageKv} kV</td>
                            <td className="px-2 py-1 tabular-nums">{st.powerDrawKw} kW</td>
                            <td className="px-2 py-1 tabular-nums font-semibold text-emerald-700">{curEv} EVs</td>
                            <td className="px-2 py-1 tabular-nums">{st.peakChargingEvs} EVs</td>
                            <td className="px-2 py-1 tabular-nums text-slate-500">{st.totalDailySessions} EVs</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : tab === 'traffic-3d' ? (
            sortedRoads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <p className="text-sm font-medium text-slate-600">No roads in the network</p>
                <p className="text-xs text-slate-400">Connect nodes on the canvas to create roads and view traffic analytics.</p>
              </div>
            ) : (
              <PlotlyChart data={chartTraffic3DData} layout={chartTraffic3DLayout} style={{ minHeight: '480px' }} />
            )
          ) : (
            <div className="h-full flex flex-col gap-3">
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chartTraffic2DData} layout={chartTraffic2DLayout} style={{ minHeight: '320px' }} />
              </div>
              <div className="max-h-36 overflow-y-auto rounded border border-slate-200">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-1">Road</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Vehicles @ {clockString}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRoads.map((road) => {
                      const num = road.data?.roadNumber ?? 0;
                      const rt = road.data?.roadType ?? null;
                      const veh = trafficAt(trafficProfiles, rt, currentTimeStep);
                      return (
                        <tr
                          key={num}
                          className={
                            num === focusRoadNumber ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700'
                          }
                        >
                          <td className="px-2 py-0.5 font-medium">{num}</td>
                          <td
                            className="px-2 py-0.5"
                            style={{ color: rt ? ROAD_TYPE_COLORS[rt] : ROAD_TYPE_COLORS.default }}
                          >
                            {rt ?? '—'}
                          </td>
                          <td className="px-2 py-0.5 tabular-nums">{veh}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 bg-white">
          {isEvMode ? (
            <>
              <span className="font-medium text-slate-700">EV Stations:</span>
              {evMatrix.stations.map((st, i) => (
                <span key={st.id} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATION_PALETTE[i % STATION_PALETTE.length] }}
                  />
                  {st.stationName}
                </span>
              ))}
              <span className="ml-auto font-medium text-emerald-700">
                Total System EV Load: {currentTotalEvs} charging vehicles @ Hour {currentEvHour}
              </span>
            </>
          ) : (
            <>
              {ROAD_TYPES.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ROAD_TYPE_COLORS[t] }}
                  />
                  {ROAD_TYPE_LABELS[t]}
                </span>
              ))}
              <span className="ml-auto">{sortedRoads.length} roads in network</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
