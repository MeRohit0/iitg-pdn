import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PlotlyChart } from './PlotlyChart';
import {
  solveTimeSeriesBfs,
  type ClassTimeSeriesResult,
  type LoadClassType,
  type MultiplierFactors,
} from '../../utils/timeSeriesBfsSolver';
import {
  DEFAULT_TIME_SERIES_DATA,
  type TimeSeriesDataPoint,
  timeIndexToClock,
} from '../../data/defaultTimeSeriesData';
import type { PdnEdge, PdnNode } from '../../types/graph.types';

interface TimeSeriesAnalyticsModalProps {
  nodes: PdnNode[];
  edges: PdnEdge[];
  onClose: () => void;
}

type TabMode = '2d' | '3d' | 'losses' | 'data';

export const TimeSeriesAnalyticsModal: React.FC<TimeSeriesAnalyticsModalProps> = ({
  nodes,
  edges,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('2d');
  const [selectedClass, setSelectedClass] = useState<LoadClassType | 'Compare'>('Compare');
  const [selected3DClass, setSelected3DClass] = useState<LoadClassType>('Residential');

  // Multiplier scaling factors
  const [factors, setFactors] = useState<MultiplierFactors>({ kP: 1.0, kQ: 1.0 });

  // Time-series load profiles (default 96 points)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>(DEFAULT_TIME_SERIES_DATA);

  // Time scrubber state (1 to length)
  const [currentTimeStep, setCurrentTimeStep] = useState<number>(48); // default to mid-day (12:00)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(200); // ms per step

  // JSON Import/Export state
  const [jsonInputText, setJsonInputText] = useState<string>(
    JSON.stringify(DEFAULT_TIME_SERIES_DATA, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute time-series BFS results whenever nodes, edges, timeSeriesData, or factors change
  const results = useMemo(() => {
    return solveTimeSeriesBfs(nodes, edges, timeSeriesData, factors);
  }, [nodes, edges, timeSeriesData, factors]);

  // Handle animation playback
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTimeStep((prev) => {
        if (prev >= timeSeriesData.length) return 1;
        return prev + 1;
      });
    }, playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeSeriesData.length]);

  // Current step details
  const stepIndex = Math.max(0, Math.min(currentTimeStep - 1, timeSeriesData.length - 1));
  const currentDataPoint = timeSeriesData[stepIndex] || timeSeriesData[0];
  const clockString = timeIndexToClock(currentDataPoint.Time);

  // ---------------------------------------------------------------------------
  // 2D Chart Configuration (Node vs Voltage p.u.)
  // ---------------------------------------------------------------------------
  const chart2DData = useMemo(() => {
    const traces: any[] = [];
    const classColors: Record<LoadClassType, string> = {
      Residential: '#2563eb', // blue
      Industrial: '#ea580c',  // orange
      Commercial: '#059669',  // emerald green
    };

    const targetClasses: LoadClassType[] =
      selectedClass === 'Compare'
        ? ['Residential', 'Industrial', 'Commercial']
        : [selectedClass];

    for (const c of targetClasses) {
      const classRes = results[c];
      const stepRes = classRes.timeSteps[stepIndex];
      if (!stepRes) continue;

      const x = classRes.orderedNodes.map((n) => n.label);
      const y = classRes.orderedNodes.map((n) => stepRes.nodeVoltages[n.id] ?? 1.0);

      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: `${c} (${stepRes.multiplier.toFixed(3)}x)`,
        x,
        y,
        line: { color: classColors[c], width: 2.5 },
        marker: { size: 6, color: classColors[c] },
        hovertemplate: `<b>Bus %{x}</b><br>Voltage: <b>%{y:.4f} p.u.</b><extra>${c}</extra>`,
      });
    }

    // Reference limit line: 0.95 p.u.
    if (results.Residential.orderedNodes.length > 0) {
      const allX = results.Residential.orderedNodes.map((n) => n.label);
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: 'Min Limit (0.95 p.u.)',
        x: allX,
        y: allX.map(() => 0.95),
        line: { color: '#ef4444', width: 1.5, dash: 'dash' },
        hoverinfo: 'skip',
      });
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: 'Max Limit (1.05 p.u.)',
        x: allX,
        y: allX.map(() => 1.05),
        line: { color: '#94a3b8', width: 1.5, dash: 'dash' },
        hoverinfo: 'skip',
      });
    }

    return traces;
  }, [results, selectedClass, stepIndex]);

  const chart2DLayout = useMemo(() => ({
    title: {
      text: `<b>Voltage Profile along Feeder at ${clockString} (Interval #${currentDataPoint.Time})</b>`,
      font: { size: 14, color: '#1e293b' },
    },
    xaxis: {
      title: 'Node / Bus Number',
      tickangle: -45,
      gridcolor: '#f1f5f9',
      zeroline: false,
    },
    yaxis: {
      title: 'Voltage Magnitude (p.u.)',
      range: [0.88, 1.06],
      gridcolor: '#e2e8f0',
      zeroline: false,
    },
    margin: { l: 55, r: 25, t: 45, b: 60 },
    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#fafafa',
  }), [clockString, currentDataPoint.Time]);

  // ---------------------------------------------------------------------------
  // 3D Surface Configuration (Node × Time × Voltage)
  // ---------------------------------------------------------------------------
  const chart3DData = useMemo(() => {
    const classRes = results[selected3DClass];
    if (!classRes) return [];

    return [
      {
        type: 'surface',
        x: classRes.surfaceXNodes,
        y: classRes.surfaceYTime,
        z: classRes.surfaceZ,
        colorscale: 'Viridis',
        contours: {
          z: {
            show: true,
            usecolormap: true,
            highlightcolor: '#ff1493',
            project: { z: true },
          },
        },
        colorbar: {
          title: 'Voltage (p.u.)',
          len: 0.75,
          thickness: 16,
        },
        hovertemplate: '<b>%{x}</b><br>Time: %{y}<br>Voltage: <b>%{z:.4f} p.u.</b><extra></extra>',
      },
    ];
  }, [results, selected3DClass]);

  const chart3DLayout = useMemo(() => ({
    title: {
      text: `<b>3D Voltage Surface — ${selected3DClass} Load Profile (24h)</b>`,
      font: { size: 14, color: '#1e293b' },
    },
    autosize: true,
    scene: {
      xaxis: { title: 'Node Number', gridcolor: '#cbd5e1' },
      yaxis: { title: 'Time (24h)', gridcolor: '#cbd5e1' },
      zaxis: { title: 'Voltage (p.u.)', gridcolor: '#cbd5e1' },
      camera: {
        eye: { x: 1.6, y: -1.7, z: 1.2 },
      },
    },
    margin: { l: 10, r: 10, t: 40, b: 20 },
    paper_bgcolor: 'transparent',
  }), [selected3DClass]);

  // ---------------------------------------------------------------------------
  // Losses Chart Configuration (kW over 24h)
  // ---------------------------------------------------------------------------
  const chartLossesData = useMemo(() => {
    const times = timeSeriesData.map((d) => timeIndexToClock(d.Time));
    return [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Residential Loss (kW)',
        x: times,
        y: results.Residential.timeSteps.map((s) => s.totalLossKw),
        line: { color: '#2563eb', width: 2 },
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Industrial Loss (kW)',
        x: times,
        y: results.Industrial.timeSteps.map((s) => s.totalLossKw),
        line: { color: '#ea580c', width: 2 },
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Commercial Loss (kW)',
        x: times,
        y: results.Commercial.timeSteps.map((s) => s.totalLossKw),
        line: { color: '#059669', width: 2 },
      },
    ];
  }, [timeSeriesData, results]);

  const chartLossesLayout = useMemo(() => ({
    title: {
      text: '<b>System Total Active Power Losses (kW) over 24 Hours</b>',
      font: { size: 14, color: '#1e293b' },
    },
    xaxis: { title: 'Time of Day', gridcolor: '#f1f5f9' },
    yaxis: { title: 'Loss (kW)', gridcolor: '#e2e8f0' },
    margin: { l: 55, r: 25, t: 45, b: 60 },
    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#fafafa',
  }), []);

  // ---------------------------------------------------------------------------
  // JSON Import / Export Handlers
  // ---------------------------------------------------------------------------
  const handleApplyJson = useCallback(() => {
    setJsonError(null);
    setJsonSuccess(null);
    try {
      const parsed = JSON.parse(jsonInputText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('JSON data must be a non-empty array of objects.');
      }
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (
          typeof item.Time !== 'number' ||
          typeof item.Rload !== 'number' ||
          typeof item.Iload !== 'number' ||
          typeof item.Cload !== 'number'
        ) {
          throw new Error(
            `Item at index ${i} is missing required fields (Time, Rload, Iload, Cload as numbers).`
          );
        }
      }
      setTimeSeriesData(parsed);
      setCurrentTimeStep(1);
      setJsonSuccess(`Successfully loaded ${parsed.length} time-series points!`);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON format.');
    }
  }, [jsonInputText]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonInputText(reader.result);
        try {
          const parsed = JSON.parse(reader.result);
          if (Array.isArray(parsed)) {
            setTimeSeriesData(parsed);
            setCurrentTimeStep(1);
            setJsonSuccess(`Imported ${parsed.length} intervals from file ${file.name}`);
            setJsonError(null);
          }
        } catch (err: any) {
          setJsonError(`Could not parse ${file.name}: ${err.message}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleDownloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(timeSeriesData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-series-loads-${timeSeriesData.length}pts.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [timeSeriesData]);

  const handleResetToDefault = useCallback(() => {
    setTimeSeriesData(DEFAULT_TIME_SERIES_DATA);
    setJsonInputText(JSON.stringify(DEFAULT_TIME_SERIES_DATA, null, 2));
    setCurrentTimeStep(1);
    setJsonSuccess('Reset to default 96-interval data.');
    setJsonError(null);
  }, []);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📈</span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                24-Hour Time-Series Analytics & Profiles
              </h2>
              <p className="text-xs text-slate-500">
                Backward-Forward Sweep (BFS) across {timeSeriesData.length} time intervals (15-min step) for R, I, C customer classes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Global Toolbar: Multipliers & Key KPIs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-700">Active Multiplier ($k_P$):</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={factors.kP}
                onChange={(e) => setFactors((f) => ({ ...f, kP: parseFloat(e.target.value) || 0 }))}
                className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-mono text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-700">Reactive Multiplier ($k_Q$):</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={factors.kQ}
                onChange={(e) => setFactors((f) => ({ ...f, kQ: parseFloat(e.target.value) || 0 }))}
                className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-mono text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] text-blue-700">
              Res Min V: <b>{results.Residential.minVoltagePuOverall.toFixed(4)} p.u.</b> ({results.Residential.minVoltageAtTime})
            </div>
            <div className="rounded-md bg-orange-50 border border-orange-200 px-2.5 py-1 text-[11px] text-orange-700">
              Ind Min V: <b>{results.Industrial.minVoltagePuOverall.toFixed(4)} p.u.</b> ({results.Industrial.minVoltageAtTime})
            </div>
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] text-emerald-700">
              Com Min V: <b>{results.Commercial.minVoltagePuOverall.toFixed(4)} p.u.</b> ({results.Commercial.minVoltageAtTime})
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('2d')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === '2d'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📊 2D Voltage Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('3d')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === '3d'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              🌐 3D Surface Graph
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('losses')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'losses'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              ⚡ Daily Losses (kW)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'data'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📁 Time-Series JSON Import / Export
            </button>
          </div>

          {/* Tab-specific subcontrols */}
          {activeTab === '2d' && (
            <div className="flex items-center gap-1.5 py-1.5">
              <span className="text-xs text-slate-500 mr-1">Class:</span>
              {(['Compare', 'Residential', 'Industrial', 'Commercial'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectedClass(mode)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    selectedClass === mode
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {activeTab === '3d' && (
            <div className="flex items-center gap-1.5 py-1.5">
              <span className="text-xs text-slate-500 mr-1">Surface:</span>
              {(['Residential', 'Industrial', 'Commercial'] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelected3DClass(cls)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    selected3DClass === cls
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-hidden p-4 bg-slate-50/30 flex flex-col">
          {/* TAB 1: 2D Voltage Profile */}
          {activeTab === '2d' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chart2DData} layout={chart2DLayout} />
              </div>

              {/* 24-Hour Time Slider & Player Control Bar */}
              <div className="mt-2 border-t border-slate-100 pt-3 px-2 flex flex-col gap-2 bg-slate-50/60 rounded-md p-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPlaying((p) => !p)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      <span>{isPlaying ? '⏸ Pause' : '▶ Play 24h'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTimeStep(1)}
                      title="Reset to 00:15"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      ⏮ 00:15
                    </button>
                    <span className="font-semibold text-slate-700 ml-2">
                      Time: <span className="font-mono text-indigo-600">{clockString}</span> (Step {currentDataPoint.Time} / {timeSeriesData.length})
                    </span>
                  </div>

                  {/* Current Multipliers Readout */}
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                    <span>R: <b className="text-blue-600">{currentDataPoint.Rload.toFixed(4)}</b></span>
                    <span>I: <b className="text-orange-600">{currentDataPoint.Iload.toFixed(4)}</b></span>
                    <span>C: <b className="text-emerald-600">{currentDataPoint.Cload.toFixed(4)}</b></span>
                  </div>

                  {/* Playback speed selector */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Speed:</span>
                    {[300, 150, 75].map((ms) => (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => setPlaybackSpeed(ms)}
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          playbackSpeed === ms ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ms === 300 ? '1x' : ms === 150 ? '2x' : '4x'}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={timeSeriesData.length}
                  value={currentTimeStep}
                  onChange={(e) => setCurrentTimeStep(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* TAB 2: 3D Surface Graph */}
          {activeTab === '3d' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500">
                <span>
                  💡 <b>Tip:</b> Click and drag to rotate in 3D. Scroll to zoom. Right-click and drag to pan.
                </span>
                <span className="font-mono text-slate-600">
                  Surface: <b>{selected3DClass}</b> | Min: {results[selected3DClass].minVoltagePuOverall.toFixed(4)} p.u. at {results[selected3DClass].minVoltageAtTime}
                </span>
              </div>
              <div className="flex-1 min-h-0 pt-2">
                <PlotlyChart data={chart3DData} layout={chart3DLayout} />
              </div>
            </div>
          )}

          {/* TAB 3: Losses over 24h */}
          {activeTab === 'losses' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center justify-around border-b border-slate-100 pb-2.5 mb-2 text-xs">
                <div>
                  <span className="text-slate-500">Residential Daily Energy Loss:</span>{' '}
                  <b className="font-mono text-blue-600">{results.Residential.totalEnergyLossKwh.toFixed(2)} kWh</b>
                  <span className="text-[11px] text-slate-400 ml-1.5">(Peak: {results.Residential.peakLossKw.toFixed(2)} kW @ {results.Residential.peakLossTime})</span>
                </div>
                <div>
                  <span className="text-slate-500">Industrial Daily Energy Loss:</span>{' '}
                  <b className="font-mono text-orange-600">{results.Industrial.totalEnergyLossKwh.toFixed(2)} kWh</b>
                  <span className="text-[11px] text-slate-400 ml-1.5">(Peak: {results.Industrial.peakLossKw.toFixed(2)} kW @ {results.Industrial.peakLossTime})</span>
                </div>
                <div>
                  <span className="text-slate-500">Commercial Daily Energy Loss:</span>{' '}
                  <b className="font-mono text-emerald-600">{results.Commercial.totalEnergyLossKwh.toFixed(2)} kWh</b>
                  <span className="text-[11px] text-slate-400 ml-1.5">(Peak: {results.Commercial.peakLossKw.toFixed(2)} kW @ {results.Commercial.peakLossTime})</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chartLossesData} layout={chartLossesLayout} />
              </div>
            </div>
          )}

          {/* TAB 4: JSON Import / Export & Raw Data */}
          {activeTab === 'data' && (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto">
              {/* Left Column: JSON Editor & Import/Export Actions */}
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Time-Series JSON Data (Array of {timeSeriesData.length} Points)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      📁 Upload JSON
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      💾 Download JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      ↺ Default 96 pts
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-2">
                  Each object must specify <code className="text-indigo-600 font-mono">Time</code> (1..N),{' '}
                  <code className="text-indigo-600 font-mono">Rload</code>,{' '}
                  <code className="text-indigo-600 font-mono">Iload</code>, and{' '}
                  <code className="text-indigo-600 font-mono">Cload</code> multipliers.
                </p>

                <textarea
                  value={jsonInputText}
                  onChange={(e) => setJsonInputText(e.target.value)}
                  rows={15}
                  className="flex-1 w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none bg-slate-50 resize-none"
                  placeholder='[ { "Time": 1, "Rload": 0.32768, "Iload": 0.549451, "Cload": 0.283801 }, ... ]'
                />

                {jsonError && (
                  <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">
                    {jsonError}
                  </div>
                )}
                {jsonSuccess && (
                  <div className="mt-2 rounded bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700">
                    {jsonSuccess}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyJson}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                  >
                    Apply JSON to Simulation
                  </button>
                </div>
              </div>

              {/* Right Column: Tabular Preview */}
              <div className="w-full lg:w-96 flex flex-col bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Data Table Preview ({timeSeriesData.length} records)
                </h3>
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-2 py-1.5">Time</th>
                        <th className="px-2 py-1.5">Clock</th>
                        <th className="px-2 py-1.5">Rload</th>
                        <th className="px-2 py-1.5">Iload</th>
                        <th className="px-2 py-1.5">Cload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {timeSeriesData.map((pt) => (
                        <tr
                          key={pt.Time}
                          className={pt.Time === currentDataPoint.Time ? 'bg-indigo-50 font-semibold' : 'hover:bg-slate-50'}
                        >
                          <td className="px-2 py-1 text-slate-500">{pt.Time}</td>
                          <td className="px-2 py-1 text-slate-700">{timeIndexToClock(pt.Time)}</td>
                          <td className="px-2 py-1 text-blue-600">{pt.Rload.toFixed(3)}</td>
                          <td className="px-2 py-1 text-orange-600">{pt.Iload.toFixed(3)}</td>
                          <td className="px-2 py-1 text-emerald-600">{pt.Cload.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
