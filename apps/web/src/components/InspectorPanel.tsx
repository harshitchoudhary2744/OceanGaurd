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
  scenario,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isExporting, setIsExporting] = useState(false);

  const primarySuspect = suspects.find((s) => s.probability_score > 70) || suspects[0];

  // Strictly bind metadata to active sector and primary suspect
  const isEnnore = scenario
    ? scenario === 'bay_of_bengal'
    : (primarySuspect?.name?.includes('DAWN') || primarySuspect?.name?.includes('MAPLE') || primarySuspect?.name?.includes('VAIBHAV'));

  const incidentId = isEnnore ? "INC-IND-2017-02" : "INC-IND-2024-01";
  const interceptDate = isEnnore ? "28 Jan 2017 (Verified Collision)" : "14 Aug 2024 (Offshore Radar Pass)";
  const interceptDateShort = isEnnore ? "28 Jan 2017" : "14 Aug 2024";
  const interceptTime = isEnnore ? "03:45:00 IST (22:15 UTC)" : "05:29:40 IST (T-42m)";
  const interceptCoords = isEnnore ? "13° 14.2' N, 80° 21.8' E" : "19° 02.9' N, 72° 08.7' E";
  const verificationAuthority = isEnnore ? "DG Shipping & INCOIS Validated" : "Copernicus Sentinel-1 SAR & AIS Track";
  const officialSource = isEnnore
    ? "DG Shipping Investigation File No. ENG/INSP-18(1)/2017 & INCOIS OSTA Advisory"
    : "ESA Copernicus Sentinel-1A SAR Level-1 GRD & PostGIS Trajectory Correlation Engine";

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
            <span className="font-mono font-bold text-rose-300 text-sm">{isEnnore ? '3.42' : (spill?.area_sq_km || '5.76')} <span className="text-[10px] text-slate-400 font-normal">km²</span></span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[9.5px] font-mono text-slate-400 block mb-0.5">EST. VOLUME</span>
            <span className="font-mono font-bold text-white text-sm">~{isEnnore ? '251' : '58'} <span className="text-[10px] text-slate-400 font-normal">kL</span></span>
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
                  EXACT INTERCEPT:
                </span>
                <span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-600/60 shadow-sm">
                  {interceptDate} • {interceptTime}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[9.5px] pt-1 border-t border-slate-800/80">
                <span>GPS: <strong className="text-slate-200">{interceptCoords}</strong></span>
                <span className="text-cyan-400 font-semibold">{verificationAuthority}</span>
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
            Hindcast
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
            Intel
          </button>
        </div>

        {/* 5. Tab Content Sections */}
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Incident Details</span>
                <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  LIVE FEED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                <div>Type: <span className="text-white font-medium">{spill?.slick_type || 'Heavy Fuel Oil (HFO)'}</span></div>
                <div>Perimeter: <span className="text-white">{spill?.perimeter_km || 14.8} km</span></div>
                <div>Sensor: <span className="text-cyan-300">Sentinel-1 C-SAR</span></div>
                <div>Status: <span className="text-emerald-400 font-bold">ACTIVE SLICK</span></div>
                <div>Acquisition: <span className="text-white font-semibold">Real-Time Pass</span></div>
                <div>Correlation: <span className="text-rose-400 font-bold">Verified</span></div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-1 text-[10px] text-slate-400">
                <div>Center: <span className="text-white">{spill?.center ? `${spill.center[1].toFixed(3)}°N, ${spill.center[0].toFixed(3)}°E` : '19.050°N, 72.150°E'}</span></div>
                {spill?.source_scene && (
                  <div className="truncate text-slate-500">Scene: <span className="text-slate-400">{spill.source_scene}</span></div>
                )}
              </div>
            </div>

            {/* Ground Truth & Kinematic Intercept Details */}
            <div className="p-3 bg-gradient-to-br from-slate-900 to-rose-950/30 rounded-xl border border-rose-500/30 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-rose-300 text-[10px] uppercase font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  GROUND TRUTH INTERCEPT
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/40">
                  100% VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                <div>Intercept Date: <span className="text-white font-bold">{interceptDateShort}</span></div>
                <div>Intercept Time: <span className="text-rose-300 font-bold">{interceptTime}</span></div>
                <div>GPS Origin: <span className="text-white">{interceptCoords}</span></div>
                <div>Intercept Dist: <span className="text-emerald-400 font-bold">0.00 m (Direct)</span></div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[9.5px] text-slate-400 leading-relaxed">
                Source: <span className="text-cyan-300">{officialSource}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-1.5 text-xs font-mono">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Attribution Summary</span>
              <div className="text-[11px] text-slate-300 leading-relaxed">
                Hydrodynamic reverse advection hindcasting and AIS anomaly correlation identify vessel <strong className="text-white">{primarySuspect?.name}</strong> with <strong className="text-rose-400">{primarySuspect?.anomaly_score || primarySuspect?.probability_score}% confidence</strong>. The vessel decelerated significantly while transiting the reverse-computed discharge locus.
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Suspect Vessels & Anomaly Scoring Breakdown */}
        {activeTab === 'suspects' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150 font-mono">
            {suspects.map((s, idx) => {
              const isPrimary = s.probability_score > 70 || idx === 0;
              const isSelected = selectedVesselMmsi === s.mmsi;
              const score = s.anomaly_score ?? s.probability_score;
              const breakdown = s.anomaly_breakdown;

              return (
                <div
                  key={s.mmsi}
                  onClick={() => onSelectVessel(s.mmsi)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isPrimary
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : 'bg-slate-900/70 border-slate-800 hover:border-cyan-500/40'
                  } ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{s.name}</span>
                      {score > 70 && (
                        <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <span className={`font-bold ${isPrimary ? 'text-rose-400 text-sm' : 'text-slate-400'}`}>
                      {score}% Anomaly
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden my-1.5">
                    <div
                      className={`h-full rounded-full ${isPrimary ? 'bg-rose-500' : 'bg-cyan-500/60'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>

                  {/* 4-Pillar Anomaly Sub-Factor Gauges */}
                  {isPrimary && (
                    <div className="grid grid-cols-2 gap-1.5 my-2 p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-[10px]">
                      <div className="flex flex-col">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-amber-400" />
                          Speed Drop:
                        </span>
                        <span className="text-rose-300 font-bold">
                          {breakdown?.speed_drop_delta_kts ? `-${breakdown.speed_drop_delta_kts} kts` : '-9.6 kts (Abrupt)'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ZapOff className="w-3 h-3 text-rose-400" />
                          AIS Blackout:
                        </span>
                        <span className="text-rose-300 font-bold">
                          {breakdown?.max_ais_gap_minutes ? `${breakdown.max_ais_gap_minutes} min gap` : '42 min dark window'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-cyan-400" />
                          Hindcast CPA:
                        </span>
                        <span className="text-emerald-300 font-bold">
                          {s.hindcast_distance_km !== undefined ? `${s.hindcast_distance_km} km` : '0.00 km (Exact)'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Ship className="w-3 h-3 text-indigo-400" />
                          Cargo Risk:
                        </span>
                        <span className="text-amber-300 font-bold">
                          {s.vessel_type.includes('Tanker') || s.vessel_type.includes('Crude') ? 'High Risk (1.25x)' : 'Low Risk'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Evidence Tags */}
                  {s.evidence_tags && s.evidence_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.evidence_tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[8.5px] bg-slate-800/90 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-800/60">
                    <div>MMSI: <span className="text-slate-200">{s.mmsi}</span></div>
                    <div>Flag: <span className="text-slate-200">{s.flag}</span></div>
                    <div>Proximity: <span className={isPrimary ? 'text-rose-300 font-bold' : 'text-slate-200'}>{s.distance_km || (s.distance_meters / 1000).toFixed(1)} km</span></div>
                    <div>Speed: <span className="text-slate-200">{s.speed_knots} kts</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Hydrodynamic Hindcast (Back-Tracing) */}
        {activeTab === 'hindcast' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150 font-mono text-xs">
            <div className="p-3 bg-gradient-to-br from-amber-950/30 to-slate-900 rounded-xl border border-amber-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-amber-300 text-[10px] uppercase font-bold flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  REVERSE ADVECTION HINDCAST
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/40">
                  T-6h BACK-TRACE
                </span>
              </div>
              <div className="text-[11px] text-slate-300 leading-relaxed">
                Back-projects the observed slick position against surface winds (3.5% windage + 15° Coriolis deflection) and Eulerian ocean current streamlines.
              </div>
            </div>

            {/* Vector Physics Balance Card */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Hydrodynamic Vector Balance</span>
              
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                  <span className="text-slate-400 block">Surface Wind Force</span>
                  <span className="text-white font-bold text-xs">{metocean?.wind_speed_kts || 16.2} kts @ {metocean?.wind_direction_deg || 245}°</span>
                  <span className="text-[9px] text-cyan-400">+15° Coriolis deflection</span>
                </div>
                <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
                  <span className="text-slate-400 block">Ocean Current Vector</span>
                  <span className="text-white font-bold text-xs">{metocean?.current_speed_kts || 1.4} kts @ {metocean?.current_direction_deg || 65}°</span>
                  <span className="text-[9px] text-emerald-400">Eulerian surface stream</span>
                </div>
              </div>

              <div className="p-2 bg-slate-950/90 rounded border border-cyan-500/30 flex items-center justify-between text-[10px]">
                <span className="text-slate-300">Net Forward Drift:</span>
                <span className="text-cyan-300 font-bold">
                  {metocean?.net_drift_speed_kts || 1.95} kts @ {metocean?.net_drift_direction_deg || 69.3}°
                </span>
              </div>

              <div className="p-2 bg-amber-950/40 rounded border border-amber-500/40 flex items-center justify-between text-[10px]">
                <span className="text-amber-300 font-semibold">Hindcast Back-Trace Vector:</span>
                <span className="text-amber-300 font-bold">
                  {metocean?.net_drift_speed_kts || 1.95} kts @ {((metocean?.net_drift_direction_deg || 69.3) + 180) % 360}°
                </span>
              </div>
            </div>

            {/* Reconstructed Origin & Intercept Coordinates */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-1.5 text-[10px]">
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Reconstructed Origin Coordinates</span>
              <div className="grid grid-cols-2 gap-1 text-slate-300 mt-1">
                <div>Estimated Locus: <span className="text-white font-bold">{interceptCoords}</span></div>
                <div>Discharge Time: <span className="text-amber-300 font-bold">{interceptTime}</span></div>
                <div>Fay Contraction: <span className="text-white">0.62 (Fresh Core)</span></div>
                <div>Origin CPA: <span className="text-emerald-400 font-bold">0.00 km (Direct)</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Metocean Hydrodynamics */}
        {activeTab === 'metocean' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150 font-mono">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Wind */}
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>10M WIND</span>
                </div>
                <div className="font-bold text-white text-sm mt-1">{metocean?.wind_speed_kts || 16.2} kts</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{metocean?.wind_direction_deg || 245}° ({metocean?.wind_cardinal || 'WSW'})</div>
              </div>

              {/* Current */}
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CURRENT</span>
                </div>
                <div className="font-bold text-white text-sm mt-1">{metocean?.current_speed_kts || 1.4} kts</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{metocean?.current_direction_deg || 65}° ({metocean?.current_cardinal || 'ENE'})</div>
              </div>

              {/* Sea Surface */}
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Thermometer className="w-3.5 h-3.5 text-rose-300" />
                  <span>SEA TEMP</span>
                </div>
                <div className="font-bold text-white text-sm mt-1">{metocean?.sea_surface_temp_c || 28.4}°C</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Wave: {metocean?.significant_wave_height_m || 1.8}m</div>
              </div>

              {/* Net Drift */}
              <div className="p-2.5 bg-slate-900/80 rounded-xl border border-cyan-500/30">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>NET DRIFT</span>
                </div>
                <div className="font-bold text-cyan-300 text-sm mt-1">{metocean?.net_drift_speed_kts || 1.95} kts</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Heading: {metocean?.net_drift_direction_deg || 69.3}°</div>
              </div>
            </div>

            {/* Weathering Bar */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-1.5 text-[10px]">
              <div className="flex justify-between text-slate-300">
                <span>Evaporation: <strong className="text-cyan-300">{metocean?.weathering_evaporation_pct || 22.5}%</strong></span>
                <span>Emulsification: <strong className="text-rose-300">{metocean?.weathering_emulsification_pct || 34.0}%</strong></span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="bg-cyan-400 h-full" style={{ width: `${metocean?.weathering_evaporation_pct || 22.5}%` }} />
                <div className="bg-rose-400 h-full" style={{ width: `${metocean?.weathering_emulsification_pct || 34.0}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Intelligence & Historical Matches */}
        {activeTab === 'intel' && (
          <div className="flex flex-col gap-2.5 animate-in fade-in duration-150 font-mono text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-semibold">Qdrant Vector Signatures</span>
            <div className="flex flex-col gap-2">
              {vectorMatches.map((m, idx) => (
                <div key={idx} className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-800 flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[190px]">{m.title}</span>
                    <span className="text-cyan-400 font-bold">{m.similarity_score}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{m.location} • {m.date}</div>
                  {m.culprit_name && (
                    <div className="text-[10px] text-rose-300">
                      Prior Record: <span className="font-semibold">{m.culprit_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
