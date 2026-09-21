import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlotlyChart } from '../analytics/PlotlyChart';
import {
  ROAD_TYPE_COLORS,
  ROAD_TYPE_LABELS,
  ROAD_TYPES,
  TIME_SLOTS,
  timeSlotToClock,
  trafficAt,
  type TrafficProfiles,
  type TransportRoad,
} from '../../types/transport.types';

interface Props {
  roads: TransportRoad[];
  trafficProfiles: TrafficProfiles;
  /** Road number to emphasize when opened from a selected road. */
  focusRoadNumber?: number | null;
  onClose: () => void;
}

/**
 * Modal analytics for transport traffic — 3D surface of vehicles over
 * (road number × 96 time slots), plus type-profile 2D curves and a scrubber.
 */
export const TrafficAnalyticsModal: React.FC<Props> = ({
  roads,
  trafficProfiles,
  focusRoadNumber = null,
  onClose,
}) => {
  const [tab, setTab] = useState<'3d' | '2d'>('3d');
  const [currentTimeStep, setCurrentTimeStep] = useState(48);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const playRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current != null) window.clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    const ms = 400 / playbackSpeed;
    playRef.current = window.setInterval(() => {
      setCurrentTimeStep((t) => (t >= TIME_SLOTS ? 1 : t + 1));
    }, ms);
    return () => {
      if (playRef.current != null) window.clearInterval(playRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const surface = useMemo(() => {
    const x = roadNumbers;
    const y = Array.from({ length: TIME_SLOTS }, (_, i) => i + 1);
    const z: number[][] = y.map((t) =>
      sortedRoads.map((road) => trafficAt(trafficProfiles, road.data?.roadType, t))
    );
    return { x, y, z };
  }, [roadNumbers, sortedRoads, trafficProfiles]);

  const chart3DData = useMemo(() => {
    if (sortedRoads.length === 0) return [];

    const traces: any[] = [
      {
        type: 'surface',
        x: surface.x,
        y: surface.y.map(timeSlotToClock),
        z: surface.z,
        customdata: surface.y.map((slot) => surface.x.map(() => slot)),
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

    // Active time-slice line across all roads showing current traffic at clockString
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
  }, [surface, focusRoadNumber, sortedRoads, trafficProfiles, currentTimeStep, clockString, roadNumbers]);

  const chart3DLayout = useMemo(
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

  const chart2DData = useMemo(() => {
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
  }, [trafficProfiles, focusRoadNumber, sortedRoads, currentTimeStep, clockString]);

  const chart2DLayout = useMemo(
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

  const snapshotAtTime = useMemo(() => {
    return sortedRoads.map((road) => ({
      roadNumber: road.data?.roadNumber ?? 0,
      roadType: road.data?.roadType ?? null,
      vehicles: trafficAt(trafficProfiles, road.data?.roadType, currentTimeStep),
    }));
  }, [sortedRoads, trafficProfiles, currentTimeStep]);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex flex-col w-[min(1100px,96vw)] h-[min(720px,92vh)] rounded-lg bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <div>
            <div className="text-sm font-semibold text-slate-800">Traffic Analytics</div>
            <div className="text-[11px] text-slate-500">
              Vehicles per road from type profiles (T1 / T2 / T3) · 96 × 15-min slots
              {focusRoadNumber != null ? ` · highlighting road ${focusRoadNumber}` : ''}
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

        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/80">
          {(['3d', '2d'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === '3d' ? '3D Surface' : 'Type Profiles'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={togglePlay}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value) as 1 | 2 | 4)}
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
                setIsPlaying(false);
                setCurrentTimeStep(Number(e.target.value));
              }}
              className="w-40 accent-indigo-600"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3">
          {sortedRoads.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <p className="text-sm font-medium text-slate-600">No roads in the network</p>
              <p className="text-xs text-slate-400">Connect nodes on the canvas to create roads and view traffic analytics.</p>
            </div>
          ) : tab === '3d' ? (
            <PlotlyChart data={chart3DData} layout={chart3DLayout} style={{ minHeight: '480px' }} />
          ) : (
            <div className="h-full flex flex-col gap-3">
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chart2DData} layout={chart2DLayout} style={{ minHeight: '320px' }} />
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
                    {snapshotAtTime.map((row) => (
                      <tr
                        key={row.roadNumber}
                        className={
                          row.roadNumber === focusRoadNumber
                            ? 'bg-indigo-50 text-indigo-900'
                            : 'text-slate-700'
                        }
                      >
                        <td className="px-2 py-0.5 font-medium">{row.roadNumber}</td>
                        <td className="px-2 py-0.5" style={{ color: row.roadType ? ROAD_TYPE_COLORS[row.roadType] : ROAD_TYPE_COLORS.default }}>
                          {row.roadType ?? '—'}
                        </td>
                        <td className="px-2 py-0.5 tabular-nums">{row.vehicles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
          {ROAD_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ROAD_TYPE_COLORS[t] }}
              />
              {ROAD_TYPE_LABELS[t]}
            </span>
          ))}
          <span className="ml-auto">{sortedRoads.length} roads</span>
        </div>
      </div>
    </div>
  );
};
