import React, { useCallback, useRef, useState } from 'react';
import type { TrafficProfiles, TransportNode, TransportRoad } from '../../types/transport.types';
import { parseImportedTransport, serializeTransport } from '../../utils/transportImportExport';

interface Props {
  nodes: TransportNode[];
  roads: TransportRoad[];
  trafficProfiles: TrafficProfiles;
  onImport: (nodes: TransportNode[], roads: TransportRoad[], trafficProfiles: TrafficProfiles) => void;
  onClose: () => void;
}

export const TransportIOPanel: React.FC<Props> = ({
  nodes,
  roads,
  trafficProfiles,
  onImport,
  onClose,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJson = serializeTransport(nodes, roads, trafficProfiles);

  const handleDownload = useCallback(() => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transport-network-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [exportJson]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setError('Could not copy to clipboard — try Download instead.');
    }
  }, [exportJson]);

  const applyImport = useCallback(
    (raw: string) => {
      try {
        const parsed = parseImportedTransport(raw);
        onImport(parsed.nodes, parsed.roads, parsed.trafficProfiles);
        setError(null);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load that file.');
      }
    },
    [onImport, onClose]
  );

  const handleFileChosen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') applyImport(reader.result);
      };
      reader.onerror = () => setError('Could not read that file.');
      reader.readAsText(file);
      e.target.value = '';
    },
    [applyImport]
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[32rem] max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">Import / Export transport network</div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Export</h3>
            <p className="text-xs text-slate-500 mb-2">
              Saves {nodes.length} node(s), {roads.length} road(s), and 96-slot traffic profiles (T1/T2/T3).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copyStatus === 'copied' ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Import</h3>
            <p className="text-xs text-slate-500 mb-2">
              Replaces the whole network. Expects{' '}
              <code className="text-[10px] bg-slate-100 px-1 rounded">
                {'{ nodes, roads, trafficProfiles }'}
              </code>
              .
            </p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Choose JSON file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleFileChosen}
              />
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Or paste JSON here…"
              rows={8}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => applyImport(pasteText)}
              disabled={!pasteText.trim()}
              className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Load pasted JSON
            </button>
          </section>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
