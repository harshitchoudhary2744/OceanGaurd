import React, { useState } from 'react';
import {
  Radar,
  ShieldAlert,
  Database,
  FileDown,
  Sparkles,
  X,
  Wind,
  Waves,
  Thermometer,
  Activity,
  Radio,
  Ship,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
  Gauge,
  ZapOff,
  Navigation
} from 'lucide-react';
import { SuspectVessel, VectorMatch, SpillProperties, SpillGeoFeature, MetoceanData } from '../types';
import { downloadPdfReportUrl } from '../lib/api';
import { MUMBAI_INCIDENTS } from '../lib/simulationEngine';

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
  scenario?: string;
}

type TabType = 'overview' | 'suspects' | 'hindcast' | 'metocean' | 'intel';

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isExporting, setIsExporting] = useState(false);

  const incidentId = spill?.id || "INC-MUM-2024-01";
  const currentIncident = MUMBAI_INCIDENTS[incidentId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];

  // Primary suspect for active spill
  const primarySuspect = suspects.find(s => s.mmsi === currentIncident.culpritMmsi) ||
    suspects.find((s) => s.probability_score > 70) ||
    suspects[0];

  const interceptCoords = `${currentIncident.originCoords[1].toFixed(3)}° N, ${currentIncident.originCoords[0].toFixed(3)}° E`;

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      const url = await downloadPdfReportUrl(incidentId, spillFeature, suspects);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OceanGuard_Forensic_${incidentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const selectedVessel = suspects.find(s => s.mmsi === selectedVesselMmsi) || primarySuspect;

  return (
    <div className="w-full h-full bg-[#111622] flex flex-col overflow-y-auto select-none border-l border-slate-800">
      {/* 1. Panel Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#111622]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-cyan-400" />
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            Incident Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
            {incidentId}
          </span>
          {isMobileModal && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              aria-label="Close inspector panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-4 flex flex-col gap-3.5 pb-20 lg:pb-6">
        {/* 2. Top Key Metrics Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[9.5px] font-mono text-slate-400 block mb-0.5">SLICK AREA</span>
            <span className="font-mono font-bold text-rose-300 text-sm">{spill?.area_sq_km || currentIncident.baseAreaSqKm} <span className="text-[10px] text-slate-400 font-normal">km²</span></span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[9.5px] font-mono text-slate-400 block mb-0.5">EST. VOLUME</span>
            <span className="font-mono font-bold text-white text-sm">~{Math.round(currentIncident.volumeLiters / 1000)} <span className="text-[10px] text-slate-400 font-normal">kL</span></span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[9.5px] font-mono text-slate-400 block mb-0.5">ANOMALY RISK</span>
            <span className="font-mono font-bold text-rose-400 text-sm">{primarySuspect?.anomaly_score || primarySuspect?.probability_score || 98}%</span>
          </div>
        </div>

        {/* 3. Primary Suspect Spotlight Banner */}
        {primarySuspect && (
          <div className="p-3 bg-gradient-to-br from-rose-950/40 to-slate-900/90 rounded-xl border border-rose-500/40 shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-rose-300 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                PRIMARY CULPRIT MATCH
              </span>
              <span className="bg-rose-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                {primarySuspect.anomaly_score || primarySuspect.probability_score}% Anomaly
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white text-sm">{primarySuspect.name}</span>
              <span className="text-slate-300 text-[11px]">{primarySuspect.vessel_type}</span>
            </div>

            {/* Exact Intercept Date & Time Badge */}
            <div className="p-2 bg-slate-950/90 rounded-lg border border-rose-500/40 flex flex-col gap-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-rose-300 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-400" />
                  INCIDENT SECTOR:
                </span>
                <span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-600/60 shadow-sm">
                  {currentIncident.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[9.5px] pt-1 border-t border-slate-800/80">
                <span>BREACH GPS: <strong className="text-slate-200">{interceptCoords}</strong></span>
                <span className="text-cyan-400 font-semibold">T{currentIncident.dischargeOffsetMinutes}m Intercept</span>
              </div>
            </div>

            {/* Evidence Tags */}
            {primarySuspect.evidence_tags && primarySuspect.evidence_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {primarySuspect.evidence_tags.map((tag, i) => (
                  <span key={i} className="text-[9px] font-mono bg-rose-950/70 text-rose-200 px-2 py-0.5 rounded border border-rose-800/50">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1">
              <div>MMSI: <span className="text-white font-semibold">{primarySuspect.mmsi}</span></div>
              <div>Flag: <span className="text-white">{primarySuspect.flag}</span></div>
              <div>Speed: <span className="text-white">{primarySuspect.speed_knots} kts</span></div>
              <div>Heading: <span className="text-white">{primarySuspect.heading_degrees}°</span></div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="mt-1 w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generating Evidence Dossier...' : 'Export Legal Evidence PDF'}</span>
            </button>
          </div>
        )}

        {/* 4. Tab Navigation */}
        <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-[11px] font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('suspects')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'suspects' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Anomalies ({suspects.length})
          </button>
          <button
            onClick={() => setActiveTab('hindcast')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'hindcast' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Drift & Hindcast
          </button>
          <button
            onClick={() => setActiveTab('metocean')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'metocean' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Metocean
          </button>
          <button
            onClick={() => setActiveTab('intel')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'intel' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vectors
          </button>
        </div>

        {/* 5. Tab Content Area */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Incident Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">INCIDENT ID</span>
                  <span className="text-white font-semibold">{incidentId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RADAR SCENE</span>
                  <span className="text-white font-semibold truncate block" title={currentIncident.sourceScene}>
                    {currentIncident.sourceScene}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SLICK TYPE</span>
                  <span className="text-rose-300 font-semibold">{currentIncident.slickType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AI CONFIDENCE</span>
                  <span className="text-emerald-400 font-semibold">{(currentIncident.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Breach & Spill Location
              </span>
              <div className="text-[11px] text-slate-300 flex flex-col gap-1">
                <div>Location: <strong className="text-white">{currentIncident.locationName}</strong></div>
                <div>Origin GPS: <strong className="text-cyan-300">{interceptCoords}</strong></div>
                <div>Discharge Time: <strong className="text-rose-300">T{currentIncident.dischargeOffsetMinutes}m Before Real-Time</strong></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'suspects' && (
          <div className="flex flex-col gap-2 font-mono text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-1">
              Ranked Kinematic Suspects ({suspects.length})
            </span>
            {suspects.map((vessel) => {
              const isSelected = vessel.mmsi === selectedVessel?.mmsi;
              const isCulprit = vessel.probability_score > 70;
              return (
                <div
                  key={vessel.mmsi}
                  onClick={() => onSelectVessel(vessel.mmsi)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
                      : isCulprit
                      ? 'bg-slate-900/80 border-rose-500/40 hover:border-rose-400'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Ship className="w-3.5 h-3.5 text-slate-400" />
                      {vessel.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCulprit ? 'bg-rose-950 text-rose-300 border border-rose-600/50' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {vessel.probability_score}% Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                    <div>MMSI: <span className="text-slate-200">{vessel.mmsi}</span></div>
                    <div>Type: <span className="text-slate-200">{vessel.vessel_type}</span></div>
                    <div>Speed: <span className="text-slate-200">{vessel.speed_knots} kts</span></div>
                    <div>Origin CPA: <span className="text-slate-200">{vessel.distance_km || 0} km</span></div>
                  </div>

                  {vessel.anomaly_breakdown?.speed_drop_details && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[9.5px] text-rose-300/90 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                      <span>{vessel.anomaly_breakdown.speed_drop_details}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'hindcast' && (
          <div className="flex flex-col gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                -6h Hindcast Reverse Origin
              </span>
              <div className="text-[11px] text-slate-300 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Reconstructed Origin:</span>
                  <span className="text-white font-bold">{interceptCoords}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reverse Drift Vector:</span>
                  <span className="text-amber-300 font-bold">{metocean?.hindcast_direction_deg || 249.3}° @ {metocean?.net_drift_speed_kts || 1.95} kts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Vessel CPA:</span>
                  <span className="text-emerald-400 font-bold">0.00 km (Direct Hit)</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                +6h Fay Drift Dispersal
              </span>
              <div className="text-[11px] text-slate-300 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Advection Heading:</span>
                  <span className="text-cyan-300 font-bold">{metocean?.net_drift_direction_deg || 69.3}° ENE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Projected +6h Area:</span>
                  <span className="text-rose-300 font-bold">~{(currentIncident.baseAreaSqKm * 1.8).toFixed(1)} km²</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metocean' && (
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">10M WIND</span>
                  <span className="font-bold text-white">{metocean?.wind_speed_kts || 16.2} kts</span>
                  <span className="text-[10px] text-slate-400 block">{metocean?.wind_cardinal || 'WSW'} ({metocean?.wind_direction_deg || 245}°)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Waves className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">SURFACE CURRENT</span>
                  <span className="font-bold text-white">{metocean?.current_speed_kts || 1.4} kts</span>
                  <span className="text-[10px] text-slate-400 block">{metocean?.current_cardinal || 'ENE'} ({metocean?.current_direction_deg || 65}°)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Thermometer className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">SEA SURFACE TEMP</span>
                  <span className="font-bold text-white">{metocean?.sea_surface_temp_c || 28.4}°C</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">WAVE HEIGHT</span>
                  <span className="font-bold text-white">{metocean?.significant_wave_height_m || 1.8} m</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-1">
              Historical Fingerprint Vector Matches ({vectorMatches.length})
            </span>
            {vectorMatches.map((m, idx) => (
              <div key={idx} className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{m.title}</span>
                  <span className="text-cyan-400 font-bold text-xs">{m.similarity_score}%</span>
                </div>
                <div className="text-[10px] text-slate-400">{m.location} • {m.date}</div>
                <div className="text-[10px] text-slate-300 flex justify-between pt-1 border-t border-slate-800/80">
                  <span>Type: <strong className="text-rose-300">{m.oil_type}</strong></span>
                  <span>Area: <strong className="text-white">{m.area_sq_km} km²</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
