import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PlotlyChart } from './PlotlyChart';
import {
  solveTimeSeriesBfs,
  type NetworkTimeSeriesResult,
  type MultiplierFactors,
} from '../../utils/timeSeriesBfsSolver';
import {
  DEFAULT_TIME_SERIES_DATA,
  type TimeSeriesDataPoint,
  timeIndexToClock,
} from '../../data/defaultTimeSeriesData';
import type { CustomerType, PdnEdge, PdnNode } from '../../types/graph.types';

interface TimeSeriesAnalyticsModalProps {
  nodes: PdnNode[];
  edges: PdnEdge[];
  onClose: () => void;
}

type TabMode = '2d' | '3d' | 'losses' | 'data';
type TwoDViewMode = 'feeder' | 'singleNode';
type LossViewMode = 'loss' | 'demand';

const CUSTOMER_COLORS: Record<CustomerType, string> = {
  Residential: '#2563eb', // blue
  Industrial: '#ea580c',  // orange
  Commercial: '#059669',  // emerald
  None: '#64748b',        // slate
};

export const TimeSeriesAnalyticsModal: React.FC<TimeSeriesAnalyticsModalProps> = ({
  nodes,
  edges,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('2d');
  const [twoDMode, setTwoDMode] = useState<TwoDViewMode>('feeder');
  const [lossMode, setLossMode] = useState<LossViewMode>('loss');

  // Fixed nominal factors (scaling controls removed for a cleaner UI)
  const factors = useMemo<MultiplierFactors>(() => ({ kP: 1.0, kQ: 1.0 }), []);

  // Time-series load profiles (default 96 points)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>(DEFAULT_TIME_SERIES_DATA);

  // Time scrubber state (1 to length)
  const [currentTimeStep, setCurrentTimeStep] = useState<number>(48); // default to mid-day (12:00)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1); // 1x, 2x, 4x speed multiplier

  // Selected single node for 24h curve
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  // JSON Import/Export state
  const [jsonInputText, setJsonInputText] = useState<string>(
    JSON.stringify(DEFAULT_TIME_SERIES_DATA, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute time-series BFS results whenever nodes, edges, or timeSeriesData change
  const results: NetworkTimeSeriesResult = useMemo(() => {
    return solveTimeSeriesBfs(nodes, edges, timeSeriesData, factors);
  }, [nodes, edges, timeSeriesData, factors]);

  // Set default selected node to the critical bus with minimum voltage
  useEffect(() => {
    if (results.orderedNodes.length > 0 && !selectedNodeId) {
      const minBus = results.orderedNodes.find(
        (n) => n.label === results.minVoltageNodeLabel || n.id === results.minVoltageNodeLabel
      );
      setSelectedNodeId(minBus ? minBus.id : results.orderedNodes[results.orderedNodes.length - 1].id);
    }
  }, [results, selectedNodeId]);

  // Node navigation helpers for Single Bus mode
  const selectedNodeIndex = useMemo(() => {
    const idx = results.orderedNodes.findIndex((n) => n.id === selectedNodeId);
    return idx >= 0 ? idx : 0;
  }, [results.orderedNodes, selectedNodeId]);

  const selectedNode = results.orderedNodes[selectedNodeIndex] || results.orderedNodes[0];

  const selectedNodeMinVoltage = useMemo(() => {
    const hist = results.nodeVoltageHistory[selectedNode?.id || ''];
    if (!hist || hist.length === 0) return 1.0;
    return Math.min(...hist);
  }, [results.nodeVoltageHistory, selectedNode]);

  const handlePrevNode = useCallback(() => {
    if (selectedNodeIndex > 0) {
      setSelectedNodeId(results.orderedNodes[selectedNodeIndex - 1].id);
    }
  }, [selectedNodeIndex, results.orderedNodes]);

  const handleNextNode = useCallback(() => {
    if (selectedNodeIndex < results.orderedNodes.length - 1) {
      setSelectedNodeId(results.orderedNodes[selectedNodeIndex + 1].id);
    }
  }, [selectedNodeIndex, results.orderedNodes]);

  const handleSelectMinVoltageNode = useCallback(() => {
    const minNode = results.orderedNodes.find(
      (n) => n.label === results.minVoltageNodeLabel || n.id === results.minVoltageNodeLabel
    );
    if (minNode) setSelectedNodeId(minNode.id);
  }, [results]);

  // Handle animation playback with stable frame pacing (1x, 2x, 4x)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTimeStep((prev) => {
        const next = prev + playbackSpeed;
        if (next > timeSeriesData.length) return 1;
        return next;
      });
    }, 160);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeSeriesData.length]);

  // Current step details
  const stepIndex = Math.max(0, Math.min(currentTimeStep - 1, timeSeriesData.length - 1));
  const currentDataPoint = timeSeriesData[stepIndex] || timeSeriesData[0];
  const clockString = timeIndexToClock(currentDataPoint.Time);
  const currentStepResult = results.timeSteps[stepIndex] || results.timeSteps[0];

  // ---------------------------------------------------------------------------
  // 2D Chart Configuration: Feeder Profile vs Single Node 24h Profile
  // ---------------------------------------------------------------------------
  const chart2DData = useMemo(() => {
    if (!currentStepResult) return [];

    if (twoDMode === 'feeder') {
      // Single composite network voltage profile across all buses
      const xLabels = results.orderedNodes.map((n) => n.label);
      const yVoltages = results.orderedNodes.map((n) => currentStepResult.nodeVoltages[n.id] ?? 1.0);
      const markerColors = results.orderedNodes.map((n) => CUSTOMER_COLORS[n.customerType] || '#64748b');

      const customHover = results.orderedNodes.map((n) => {
        const v = currentStepResult.nodeVoltages[n.id] ?? 1.0;
        const p = currentStepResult.nodeActiveKw[n.id] ?? 0;
        const q = currentStepResult.nodeReactiveKvar[n.id] ?? 0;
        return `<b>Bus ${n.label}</b> (${n.customerType})<br>Voltage: <b>${v.toFixed(4)} p.u.</b><br>Active: ${p.toFixed(1)} kW<br>Reactive: ${q.toFixed(1)} kVAr`;
      });

      const traces: any[] = [
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: `Feeder Profile (${clockString})`,
          x: xLabels,
          y: yVoltages,
          line: { color: '#4f46e5', width: 2.5 },
          marker: {
            size: 8,
            color: markerColors,
            line: { color: '#ffffff', width: 1.5 },
          },
          text: customHover,
          hoverinfo: 'text',
        },
        // Reference limit line: 0.95 p.u.
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Min Limit (0.95 p.u.)',
          x: xLabels,
          y: xLabels.map(() => 0.95),
          line: { color: '#ef4444', width: 1.5, dash: 'dash' },
          hoverinfo: 'skip',
        },
        // Reference limit line: 1.05 p.u.
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Max Limit (1.05 p.u.)',
          x: xLabels,
          y: xLabels.map(() => 1.05),
          line: { color: '#94a3b8', width: 1.5, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ];

      return traces;
    } else {
      // Single node 24-hour voltage curve
      const targetNode = results.orderedNodes.find((n) => n.id === selectedNodeId) || results.orderedNodes[0];
      const timeLabels = timeSeriesData.map((d) => timeIndexToClock(d.Time));
      const voltages = results.nodeVoltageHistory[targetNode?.id || ''] || [];

      const custType = targetNode?.customerType || 'Residential';
      const lineColor = CUSTOMER_COLORS[custType] || '#4f46e5';

      const traces: any[] = [
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: `Bus ${targetNode?.label || ''} (${custType})`,
          x: timeLabels,
          y: voltages,
          line: { color: lineColor, width: 2.5 },
          marker: { size: 4, color: lineColor },
          hovertemplate: `<b>Time: %{x}</b><br>Voltage: <b>%{y:.4f} p.u.</b><extra>Bus ${targetNode?.label}</extra>`,
        },
        // Current scrubber marker
        {
          type: 'scatter',
          mode: 'markers',
          name: `Current (${clockString})`,
          x: [clockString],
          y: [voltages[stepIndex] ?? 1.0],
          marker: { size: 10, color: '#dc2626', symbol: 'diamond' },
          hoverinfo: 'skip',
        },
        // Reference limit line: 0.95 p.u.
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Min Limit (0.95 p.u.)',
          x: timeLabels,
          y: timeLabels.map(() => 0.95),
          line: { color: '#ef4444', width: 1.5, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ];

      return traces;
    }
  }, [currentStepResult, twoDMode, results, clockString, selectedNodeId, timeSeriesData, stepIndex]);

  const chart2DLayout = useMemo(() => {
    if (twoDMode === 'feeder') {
      return {
        title: {
          text: `<b>Network Voltage Profile along Feeder at ${clockString} (Interval #${currentDataPoint.Time})</b>`,
          font: { size: 14, color: '#1e293b' },
        },
        xaxis: {
          title: 'Bus / Node Number',
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
      };
    } else {
      const targetNode = results.orderedNodes.find((n) => n.id === selectedNodeId);
      return {
        title: {
          text: `<b>24-Hour Voltage Profile for Bus ${targetNode?.label || ''} (${targetNode?.customerType || ''})</b>`,
          font: { size: 14, color: '#1e293b' },
        },
        xaxis: {
          title: 'Time of Day (24h)',
          gridcolor: '#f1f5f9',
          zeroline: false,
          nticks: 13,
          tickangle: 0,
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
      };
    }
  }, [twoDMode, clockString, currentDataPoint.Time, results.orderedNodes, selectedNodeId]);

  // ---------------------------------------------------------------------------
  // 3D Surface Configuration (X: Bus Number, Y: Time, Z: Voltage)
  // ---------------------------------------------------------------------------
  const chart3DData = useMemo(() => {
    return [
      {
        type: 'surface',
        x: results.surfaceXNodes,
        y: results.surfaceYTime,
        z: results.surfaceZ,
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
  }, [results]);

  const chart3DLayout = useMemo(() => ({
    title: {
      text: '<b>3D Network Voltage Surface across All 33 Buses & 96 Intervals (24h)</b>',
      font: { size: 14, color: '#1e293b' },
    },
    autosize: true,
    scene: {
      xaxis: { title: 'X: Bus / Node Number', gridcolor: '#cbd5e1' },
      yaxis: { title: 'Y: Time of Day (24h)', gridcolor: '#cbd5e1' },
      zaxis: { title: 'Z: Voltage Magnitude (p.u.)', gridcolor: '#cbd5e1' },
      camera: {
        eye: { x: 1.6, y: -1.7, z: 1.2 },
      },
    },
    margin: { l: 10, r: 10, t: 40, b: 20 },
    paper_bgcolor: 'transparent',
  }), []);

  // ---------------------------------------------------------------------------
  // Losses & Demand Chart Configuration
  // ---------------------------------------------------------------------------
  const chartLossesData = useMemo(() => {
    const times = timeSeriesData.map((d) => timeIndexToClock(d.Time));

    if (lossMode === 'loss') {
      return [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Network Active Power Loss (kW)',
          x: times,
          y: results.timeSteps.map((s) => s.totalLossKw),
          line: { color: '#dc2626', width: 2.5 },
          fill: 'tozeroy',
          fillcolor: 'rgba(220, 38, 38, 0.1)',
          hovertemplate: '<b>%{x}</b><br>Loss: <b>%{y:.2f} kW</b><extra></extra>',
        },
      ];
    } else {
      return [
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Total Active Demand (kW)',
          x: times,
          y: results.timeSteps.map((s) => s.totalDemandKw),
          line: { color: '#4f46e5', width: 2.5 },
          hovertemplate: '<b>%{x}</b><br>Active Demand: <b>%{y:.1f} kW</b><extra></extra>',
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Total Reactive Demand (kVAr)',
          x: times,
          y: results.timeSteps.map((s) => s.totalDemandKvar),
          line: { color: '#059669', width: 2, dash: 'dot' },
          hovertemplate: '<b>%{x}</b><br>Reactive Demand: <b>%{y:.1f} kVAr</b><extra></extra>',
        },
      ];
    }
  }, [timeSeriesData, results, lossMode]);

  const chartLossesLayout = useMemo(() => ({
    title: {
      text:
        lossMode === 'loss'
          ? '<b>System Active Power Losses (kW) across 24 Hours (96 Intervals)</b>'
          : '<b>Total Feeder Customer Demand (Active & Reactive) over 24 Hours</b>',
      font: { size: 14, color: '#1e293b' },
    },
    xaxis: { title: 'Time of Day', gridcolor: '#f1f5f9' },
    yaxis: {
      title: lossMode === 'loss' ? 'System Loss (kW)' : 'Total Demand',
      gridcolor: '#e2e8f0',
    },
    margin: { l: 55, r: 25, t: 45, b: 60 },
    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#fafafa',
  }), [lossMode]);

  // ---------------------------------------------------------------------------
  // JSON Import / Export & CSV Export
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

  const handleDownloadCsvResults = useCallback(() => {
    const headers = [
      'Interval',
      'Time',
      'Rload',
      'Iload',
      'Cload',
      'TotalDemand_kW',
      'TotalDemand_kVAr',
      'MinVoltage_pu',
      'CriticalBus',
      'TotalLoss_kW',
      ...results.orderedNodes.map((n) => `Bus_${n.label}_pu`),
    ];

    const rows = results.timeSteps.map((s) => {
      return [
        s.timeIndex,
        s.timeLabel,
        s.multipliers.Residential.toFixed(4),
        s.multipliers.Industrial.toFixed(4),
        s.multipliers.Commercial.toFixed(4),
        s.totalDemandKw.toFixed(2),
        s.totalDemandKvar.toFixed(2),
        s.minVoltagePu.toFixed(4),
        s.minVoltageNodeLabel,
        s.totalLossKw.toFixed(3),
        ...results.orderedNodes.map((n) => (s.nodeVoltages[n.id] ?? 1.0).toFixed(4)),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-series-bfs-results-96steps.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [results]);

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
        className="w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📈</span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                24-Hour Time-Series BFS Analytics & Profiles
              </h2>
              <p className="text-xs text-slate-500">
                Unified Network Power Flow across {timeSeriesData.length} intervals (15-min) with per-node customer multipliers
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

        {/* Global Toolbar: Customer Zoning & Quick Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Distribution Nodes:</span>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              {results.customerCounts.Residential} Residential
            </span>
            <span className="rounded bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
              {results.customerCounts.Industrial} Industrial
            </span>
            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {results.customerCounts.Commercial} Commercial
            </span>
            {results.customerCounts.None > 0 && (
              <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {results.customerCounts.None} Substation
              </span>
            )}
          </div>

          {/* Quick 24h Metrics Chips */}
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] text-rose-700">
              Min V (24h): <b>{results.minVoltagePuOverall.toFixed(4)} p.u.</b> (Bus {results.minVoltageNodeLabel} @ {results.minVoltageAtTime})
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] text-amber-800">
              Daily Loss: <b>{results.totalEnergyLossKwh.toFixed(2)} kWh</b> (Peak: {results.peakLossKw.toFixed(1)} kW)
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
              📊 2D Voltage Graphs
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
              🌐 3D Voltage Surface
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
              ⚡ Daily Losses & Demand
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
              📁 Multipliers & Results Data
            </button>
          </div>

          {/* Tab-specific subcontrols */}
          {activeTab === '2d' && (
            <div className="flex items-center gap-2 py-1.5">
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTwoDMode('feeder')}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    twoDMode === 'feeder'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Feeder Profile (Time t)
                </button>
                <button
                  type="button"
                  onClick={() => setTwoDMode('singleNode')}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    twoDMode === 'singleNode'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Single Bus (24h)
                </button>
              </div>

              {twoDMode === 'singleNode' && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Bus:</span>
                  <select
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {results.orderedNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        Bus {n.label} ({n.customerType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTab === 'losses' && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs py-1.5">
              <button
                type="button"
                onClick={() => setLossMode('loss')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  lossMode === 'loss'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                System Losses (kW)
              </button>
              <button
                type="button"
                onClick={() => setLossMode('demand')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  lossMode === 'demand'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Total Demand (kW & kVAr)
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Content Body */}
        <div className="flex-1 overflow-hidden p-4 bg-slate-50/30 flex flex-col">
          {/* TAB 1: 2D Voltage Graphs */}
          {activeTab === '2d' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chart2DData} layout={chart2DLayout} />
              </div>

              {/* Legend for Customer Types in Feeder Profile */}
              {twoDMode === 'feeder' && (
                <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" /> Residential Node
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" /> Industrial Node
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600" /> Commercial Node
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500" /> Substation / Slack
                  </span>
                </div>
              )}

              {/* Context-Aware Bottom Control Bar: Feeder Time Scrubber vs Single Bus Node Navigation */}
              {twoDMode === 'feeder' ? (
                <div className="mt-2 border-t border-slate-100 pt-2.5 px-2 flex flex-col gap-2 bg-slate-50/80 rounded-md p-2">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
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
                        Time: <span className="font-mono text-indigo-600 font-bold">{clockString}</span> (Interval {currentDataPoint.Time} / {timeSeriesData.length})
                      </span>
                    </div>

                    {/* Current Active Multipliers Readout */}
                    <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                      <span>Res: <b className="text-blue-600">{currentDataPoint.Rload.toFixed(4)}x</b></span>
                      <span>Ind: <b className="text-orange-600">{currentDataPoint.Iload.toFixed(4)}x</b></span>
                      <span>Com: <b className="text-emerald-600">{currentDataPoint.Cload.toFixed(4)}x</b></span>
                    </div>

                    {/* Playback speed selector */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="font-medium">Speed:</span>
                      {([1, 2, 4] as const).map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`rounded px-2 py-0.5 font-medium transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {spd}x
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
              ) : (
                <div className="mt-2 border-t border-slate-100 pt-2.5 px-3 flex flex-col gap-2 bg-slate-50/80 rounded-md p-2">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Base Node:</span>
                      <button
                        type="button"
                        onClick={handlePrevNode}
                        disabled={selectedNodeIndex <= 0}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ◀ Prev Bus
                      </button>
                      <button
                        type="button"
                        onClick={handleNextNode}
                        disabled={selectedNodeIndex >= results.orderedNodes.length - 1}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next Bus ▶
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectMinVoltageNode}
                        className="rounded bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                        title="Jump to critical bus with lowest voltage"
                      >
                        ⭐ Jump to Critical (Bus {results.minVoltageNodeLabel})
                      </button>
                    </div>

                    {/* Selected Node Details Badge */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                        Bus {selectedNode?.label} ({selectedNode?.customerType})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        Base P: <b>{(selectedNode.baseP * 1000).toFixed(0)} kW</b>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        Base Q: <b>{(selectedNode.baseQ * 1000).toFixed(0)} kVAr</b>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                        24h Min V: <b>{selectedNodeMinVoltage.toFixed(4)} p.u.</b>
                      </span>
                    </div>
                  </div>

                  {/* Bus Range Scrubber */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-slate-500 min-w-[40px]">
                      Bus {results.orderedNodes[0]?.label || '1'}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={results.orderedNodes.length - 1}
                      value={selectedNodeIndex}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10);
                        if (results.orderedNodes[idx]) {
                          setSelectedNodeId(results.orderedNodes[idx].id);
                        }
                      }}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                    <span className="text-[11px] font-medium text-slate-500 min-w-[45px] text-right">
                      Bus {results.orderedNodes[results.orderedNodes.length - 1]?.label || '33'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 3D Voltage Surface */}
          {activeTab === '3d' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              {/* 3D Axis Parameters & Info Bar */}
              <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">
                    💡 <b>Tip:</b> Click and drag to rotate in 3D. Scroll to zoom. Right-click and drag to pan.
                  </span>
                </div>

                {/* Explicit X, Y, Z Axis Badges */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600">
                    <b>X:</b> Bus (1–{results.orderedNodes.length})
                  </span>
                  <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600">
                    <b>Y:</b> Time (00:15–24:00)
                  </span>
                  <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-indigo-700 font-medium">
                    <b>Z:</b> Voltage Magnitude (p.u.)
                  </span>
                  <span className="text-slate-400 border-l border-slate-200 pl-2">
                    Global Min: <b className="text-rose-600">{results.minVoltagePuOverall.toFixed(4)} p.u.</b> (Bus {results.minVoltageNodeLabel} @ {results.minVoltageAtTime})
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 pt-2">
                <PlotlyChart data={chart3DData} layout={chart3DLayout} />
              </div>
            </div>
          )}

          {/* TAB 3: Daily Losses & Demand */}
          {activeTab === 'losses' && (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-around border-b border-slate-100 pb-2.5 mb-2 text-xs gap-3">
                <div className="rounded bg-slate-50 border border-slate-200 px-3 py-1.5">
                  <span className="text-slate-500">24-Hour Energy Losses:</span>{' '}
                  <b className="font-mono text-rose-600 text-sm">{results.totalEnergyLossKwh.toFixed(2)} kWh</b>
                </div>
                <div className="rounded bg-slate-50 border border-slate-200 px-3 py-1.5">
                  <span className="text-slate-500">Peak System Loss:</span>{' '}
                  <b className="font-mono text-amber-700">{results.peakLossKw.toFixed(2)} kW</b>{' '}
                  <span className="text-[11px] text-slate-400">(@ {results.peakLossTime})</span>
                </div>
                <div className="rounded bg-slate-50 border border-slate-200 px-3 py-1.5">
                  <span className="text-slate-500">Peak Total Demand:</span>{' '}
                  <b className="font-mono text-indigo-600">{results.peakDemandKw.toFixed(1)} kW</b>{' '}
                  <span className="text-[11px] text-slate-400">(@ {results.peakDemandTime})</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <PlotlyChart data={chartLossesData} layout={chartLossesLayout} />
              </div>
            </div>
          )}

          {/* TAB 4: Multipliers & Results Data */}
          {activeTab === 'data' && (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-y-auto">
              {/* Left Column: Multipliers Editor & Import/Export */}
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Time-Series Load Multipliers ({timeSeriesData.length} Intervals)
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      📁 Upload
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
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      💾 Download
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      ↺ Reset
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mb-2">
                  Edit or paste time-varying load multipliers for Residential (<code>Rload</code>), Industrial (<code>Iload</code>), and Commercial (<code>Cload</code>).
                </p>

                <textarea
                  value={jsonInputText}
                  onChange={(e) => setJsonInputText(e.target.value)}
                  className="flex-1 min-h-[220px] font-mono text-[11px] p-2.5 rounded border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 resize-none text-slate-800"
                  spellCheck={false}
                />

                {jsonError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    ⚠️ {jsonError}
                  </div>
                )}
                {jsonSuccess && (
                  <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded p-2">
                    ✓ {jsonSuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleApplyJson}
                  className="mt-3 w-full rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                >
                  Apply Multipliers & Re-Solve Network
                </button>
              </div>

              {/* Right Column: 96-Step Results Summary & CSV Download */}
              <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Solved 24-Hour Simulation Results
                  </h3>
                  <button
                    type="button"
                    onClick={handleDownloadCsvResults}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    📊 Export 96-Step CSV
                  </button>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 rounded text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-1.5">#</th>
                        <th className="p-1.5">Time</th>
                        <th className="p-1.5">Demand (kW)</th>
                        <th className="p-1.5">Min V (pu)</th>
                        <th className="p-1.5">Crit Bus</th>
                        <th className="p-1.5">Loss (kW)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {results.timeSteps.map((s) => (
                        <tr
                          key={s.timeIndex}
                          className={s.timeIndex === currentDataPoint.Time ? 'bg-indigo-50 font-bold' : 'hover:bg-slate-50'}
                        >
                          <td className="p-1.5">{s.timeIndex}</td>
                          <td className="p-1.5 text-slate-800">{s.timeLabel}</td>
                          <td className="p-1.5">{s.totalDemandKw.toFixed(1)}</td>
                          <td className="p-1.5 text-indigo-700">{s.minVoltagePu.toFixed(4)}</td>
                          <td className="p-1.5 text-slate-600">Bus {s.minVoltageNodeLabel}</td>
                          <td className="p-1.5 text-rose-600">{s.totalLossKw.toFixed(2)}</td>
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
