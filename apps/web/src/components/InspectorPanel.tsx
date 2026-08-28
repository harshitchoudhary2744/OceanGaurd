import React, { useState } from 'react';
import {
  Radar,
  ShieldAlert,
  Database,
  FileDown,
  Sparkles,
  ExternalLink,
  X,
  Wind,
  Waves,
  Thermometer,
  Activity,
  Gauge,
  Radio
} from 'lucide-react';
import { SuspectVessel, VectorMatch, SpillProperties, SpillGeoFeature, MetoceanData } from '../types';
import { downloadPdfReportUrl } from '../lib/api';

interface InspectorPanelProps {
  spill?: SpillProperties;
  spillFeature?: SpillGeoFeature | null;
  suspects: SuspectVessel[];
  vectorMatches: VectorMatch[];
  selectedVesselMmsi?: number;
  onSelectVessel: (mmsi: number) => void;
  onClose?: () => void;
  isMobileModal?: boolean;
  metocean?: MetoceanData;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  spill,
  spillFeature,
  suspects,
  vectorMatches,
  selectedVesselMmsi,
  onSelectVessel,
  onClose,
  isMobileModal,
  metocean,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      const url = await downloadPdfReportUrl(spill?.id || 'INC-IND-2024-01', spillFeature, suspects);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OceanGuard_Forensic_${spill?.id || 'INC-IND-2024-01'}.pdf`;
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
    <div className="w-full h-full bg-[#181c27] flex flex-col overflow-y-auto select-none">
      {/* Panel Header */}
      <div className="p-3 sm:p-4 border-b border-[#3b494c]/30 flex items-center justify-between sticky top-0 bg-[#181c27]/95 backdrop-blur-sm z-10">
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

        {/* 2. Real-Time Metocean & Weathering Hydrodynamics Card */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#00daf3]/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#00daf3]">
              <Wind className="w-4 h-4" />
              <h3 className="font-mono text-xs font-bold text-white uppercase">
                Metocean Hydrodynamics
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#4ade80] font-bold">NOAA GNOME</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {/* Wind */}
            <div className="p-2 bg-[#171b26] rounded-lg border border-[#3b494c]/20">
              <div className="flex items-center gap-1 text-[#849396] text-[10px]">
                <Wind className="w-3 h-3 text-[#00daf3]" />
                <span>10M WIND VECTOR</span>
              </div>
              <div className="font-bold text-white text-xs mt-1">
                {metocean?.wind_speed_kts || 16.2} kts
              </div>
              <div className="text-[10px] text-[#bac9cc] mt-0.5">
                {metocean?.wind_direction_deg || 245}° ({metocean?.wind_cardinal || 'WSW'})
              </div>
            </div>

            {/* Current */}
            <div className="p-2 bg-[#171b26] rounded-lg border border-[#3b494c]/20">
              <div className="flex items-center gap-1 text-[#849396] text-[10px]">
                <Waves className="w-3 h-3 text-[#00daf3]" />
                <span>OCEAN CURRENT</span>
              </div>
              <div className="font-bold text-white text-xs mt-1">
                {metocean?.current_speed_kts || 1.4} kts
              </div>
              <div className="text-[10px] text-[#bac9cc] mt-0.5">
                {metocean?.current_direction_deg || 65}° ({metocean?.current_cardinal || 'ENE'})
              </div>
            </div>

            {/* Sea Temp & Waves */}
            <div className="p-2 bg-[#171b26] rounded-lg border border-[#3b494c]/20">
              <div className="flex items-center gap-1 text-[#849396] text-[10px]">
                <Thermometer className="w-3 h-3 text-[#ffb4ab]" />
                <span>SEA SURFACE</span>
              </div>
              <div className="font-bold text-white text-xs mt-1">
                {metocean?.sea_surface_temp_c || 28.4}°C
              </div>
              <div className="text-[10px] text-[#bac9cc] mt-0.5">
                Wave: {metocean?.significant_wave_height_m || 1.8}m
              </div>
            </div>

            {/* Net Drift */}
            <div className="p-2 bg-[#171b26] rounded-lg border border-[#00daf3]/30">
              <div className="flex items-center gap-1 text-[#849396] text-[10px]">
                <Activity className="w-3 h-3 text-[#00e5ff]" />
                <span>NET SLICK ADVECTION</span>
              </div>
              <div className="font-bold text-[#00e5ff] text-xs mt-1">
                {metocean?.net_drift_speed_kts || 1.95} kts
              </div>
              <div className="text-[10px] text-[#bac9cc] mt-0.5">
                Heading: {metocean?.net_drift_direction_deg || 69.3}°
              </div>
            </div>
          </div>

          {/* Weathering & Emulsification Progress Bar */}
          <div className="p-2 bg-[#171b26] rounded-lg border border-[#3b494c]/20 flex flex-col gap-1 text-[10px] font-mono">
            <div className="flex justify-between text-[#bac9cc]">
              <span>Evaporation: <strong className="text-white">{metocean?.weathering_evaporation_pct || 22.5}%</strong></span>
              <span>Emulsification: <strong className="text-white">{metocean?.weathering_emulsification_pct || 34.0}%</strong></span>
            </div>
            <div className="w-full h-1.5 bg-[#262a35] rounded-full overflow-hidden flex">
              <div className="bg-[#00daf3] h-full" style={{ width: `${metocean?.weathering_evaporation_pct || 22.5}%` }} title="Evaporated Fraction" />
              <div className="bg-[#ffb4ab] h-full" style={{ width: `${metocean?.weathering_emulsification_pct || 34.0}%` }} title="Emulsified Fraction" />
            </div>
          </div>
        </div>

        {/* 3. Culprit Suspects Card */}
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

        {/* 4. Live AIS NMEA Telemetry Feed */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#3b494c]/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#4ade80] animate-pulse" />
              <h3 className="font-mono text-xs font-bold text-white uppercase">
                Live AIS NMEA Feed
              </h3>
            </div>
            <span className="text-[9px] font-mono text-[#4ade80] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-ping"></span>
              STREAMING
            </span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {suspects.map((s) => (
              <div key={s.mmsi} className="p-2 bg-[#171b26] rounded-lg border border-[#3b494c]/20 font-mono text-[10px]">
                <div className="flex items-center justify-between text-white font-bold">
                  <span className="truncate max-w-[160px]">{s.name}</span>
                  <span className="text-[#00daf3]">{s.speed_knots} kts @ {s.heading_degrees}°</span>
                </div>
                <div className="flex justify-between text-[#849396] text-[9px] mt-0.5">
                  <span>MMSI: {s.mmsi} {s.imo_number ? `| IMO: ${s.imo_number}` : ''}</span>
                  <span className="text-white">{s.last_lat.toFixed(3)}°N, {s.last_lon.toFixed(3)}°E</span>
                </div>
                {s.linked_spill && (
                  <div className="mt-1 pt-1 border-t border-[#ff3b30]/30 text-[9px] text-[#ffb4ab] font-bold flex justify-between">
                    <span>⚠️ Linked Detection:</span>
                    <span>{s.linked_spill.detection_date} • {s.linked_spill.detection_time_utc}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. Qdrant Historical Matches */}
        <div className="p-3 sm:p-3.5 bg-[#1c1f2a] rounded-xl border border-[#3b494c]/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#00daf3]" />
              <h3 className="font-mono text-xs font-bold text-white uppercase">
                Qdrant Historical Signatures
              </h3>
            </div>
            <span className="text-[10px] font-mono text-[#849396]">Cosine Match</span>
          </div>

          <div className="flex flex-col gap-2">
            {vectorMatches.map((m, idx) => (
              <div key={idx} className="p-2.5 bg-[#171b26] rounded-lg border border-[#3b494c]/20 flex flex-col gap-1 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white truncate max-w-[170px]">{m.title}</span>
                  <span className="text-[#00daf3] font-bold">{m.similarity_score}%</span>
                </div>
                <div className="text-[10px] text-[#849396]">{m.location} • {m.date}</div>
                {m.culprit_name && (
                  <div className="text-[10px] text-[#ffb4ab]">
                    Historical Culprit: <span className="font-bold">{m.culprit_name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
