import React, { useState } from 'react';
import { Radar, FileDown, ShieldAlert, Sparkles, Database, X } from 'lucide-react';
import { SpillGeoFeature, SuspectVessel, VectorMatch } from '../types';
import { downloadPdfReportUrl } from '../lib/api';

interface InspectorPanelProps {
  selectedSpill: SpillGeoFeature | null;
  suspects: SuspectVessel[];
  vectorMatches: VectorMatch[];
  onSelectVessel: (mmsi: number) => void;
  selectedVesselMmsi?: number | null;
  onClose?: () => void;
  isMobileModal?: boolean;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedSpill,
  suspects,
  vectorMatches,
  onSelectVessel,
  selectedVesselMmsi,
  onClose,
  isMobileModal = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const spill = selectedSpill?.properties;

  const handleDownloadPdf = async () => {
    if (!spill) return;
    try {
      setIsExporting(true);
      const url = await downloadPdfReportUrl(spill.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OceanGuard_Forensic_${spill.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  return (
    <aside className="w-full h-full tactical-glass border-l border-[#3b494c]/30 flex flex-col overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#3b494c]/20 flex items-center justify-between sticky top-0 bg-[#181c27] z-10">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-[#00daf3]" />
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            Incident Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#93000a]/30 border border-[#ffb4ab]/30 text-[#ffb4ab] font-mono text-[10px] font-bold">
            {spill?.id || 'INC-IND-2024-01'}
          </span>
          {isMobileModal && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#262a35] text-[#bac9cc] hover:text-white"
              aria-label="Close inspector panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 pb-20 lg:pb-4">
        {/* 1. Incident Summary Card */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#3b494c]/30">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-xs font-bold text-white">SAR Satellite Incident</span>
            <div className="flex items-center gap-1 text-[11px] font-mono text-[#00daf3]">
              <Sparkles className="w-3 h-3" />
              <span>{Math.round((spill?.confidence_score || 0.988) * 100)}% AI Score</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-[#171b26] rounded-lg">
              <span className="text-[10px] text-[#849396] block">SPILL AREA</span>
              <span className="font-bold text-[#ffb4ab] text-sm">{spill?.area_sq_km || 5.40} sq km</span>
            </div>
            <div className="p-2 bg-[#171b26] rounded-lg">
              <span className="text-[10px] text-[#849396] block">EST. DISCHARGE</span>
              <span className="font-bold text-white text-sm">~{(spill?.estimated_discharge_liters || 58000).toLocaleString()} L</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#3b494c]/20 text-[10px] font-mono text-[#bac9cc] flex justify-between flex-wrap gap-1">
            <span>Sensor: Sentinel-1 C-Band</span>
            <span>{spill?.center ? `${spill.center[1]}° N, ${spill.center[0]}° E` : '19.050° N, 72.150° E'}</span>
          </div>
        </div>

        {/* 2. Culprit Suspects Card */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#3b494c]/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#ffb4ab]" />
              <h3 className="font-mono text-xs font-bold text-white uppercase">
                Vessel Attribution (PostGIS)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#849396]">ST_DWithin</span>
          </div>

          <div className="flex flex-col gap-2">
            {suspects.map((s, idx) => {
              const isPrimary = s.probability_score > 70 || idx === 0;
              const isSelected = selectedVesselMmsi === s.mmsi;

              return (
                <div
                  key={s.mmsi}
                  onClick={() => onSelectVessel(s.mmsi)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isPrimary
                      ? 'bg-[#93000a]/15 border-[#ffb4ab]/40 hover:border-[#ffb4ab]'
                      : 'bg-[#171b26] border-[#3b494c]/20 hover:border-[#00e5ff]/40'
                  } ${isSelected ? 'ring-2 ring-[#00e5ff]' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">{s.name}</span>
                    <span className={`font-bold ${isPrimary ? 'text-[#ffb4ab]' : 'text-[#849396]'}`}>
                      {s.probability_score}% Match
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-[#262a35] rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${isPrimary ? 'bg-[#ff3b30]' : 'bg-[#00daf3]/60'}`}
                      style={{ width: `${s.probability_score}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-[#bac9cc] mt-2">
                    <div>MMSI: <span className="text-white">{s.mmsi}</span></div>
                    <div>Flag: <span className="text-white">{s.flag}</span></div>
                    <div>Proximity: <span className={isPrimary ? 'text-[#ffb4ab] font-bold' : 'text-white'}>{s.distance_km || (s.distance_meters / 1000).toFixed(2)} km</span></div>
                    <div>Speed: <span className="text-white">{s.speed_knots} kts</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#00e5ff] text-[#00363d] hover:bg-[#9cf0ff] font-mono text-xs font-bold transition-all disabled:opacity-60 shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating PDF...' : 'Download Legal Evidence PDF'}</span>
          </button>
        </div>

        {/* 3. Qdrant Historical Matches */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#3b494c]/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#00daf3]" />
              <h3 className="font-mono text-xs font-bold text-white uppercase">
                Qdrant Historical Signatures
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#00daf3]">Cosine ANN</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {vectorMatches.map((m, i) => (
              <div key={m.id || i} className="p-2 bg-[#171b26] rounded-lg text-[11px] font-mono">
                <div className="flex justify-between font-bold">
                  <span className="text-[#00daf3] truncate max-w-[180px]">{m.title}</span>
                  <span className="text-[#4ade80]">{m.similarity_score}%</span>
                </div>
                <div className="text-[10px] text-[#849396] mt-0.5 flex justify-between">
                  <span>{m.location}</span>
                  <span>{m.date}</span>
                </div>
                {m.culprit_name && (
                  <div className="text-[10px] text-[#ffb4ab] mt-0.5">
                    Prior Offender: {m.culprit_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
