import React, { useState, useEffect } from 'react';
import {
  Radar,
  ShieldAlert,
  Database,
  FileDown,
  X,
  Wind,
  Waves,
  Thermometer,
  Activity,
  Ship,
  AlertTriangle,
  History,
  Navigation,
  Target,
  Anchor,
  Fish,
  TreePine,
  ChevronRight,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  Layers,
  MapPin
} from 'lucide-react';
import { SuspectVessel, VectorMatch, SpillProperties, SpillGeoFeature, MetoceanData } from '../types';
import { downloadPdfReportUrl } from '../lib/api';
import { MUMBAI_INCIDENTS, calculateEnvironmentalThreat } from '../lib/simulationEngine';

export type InspectorTabType = 'overview' | 'false_positive' | 'threat' | 'suspects' | 'hindcast' | 'metocean' | 'intel';

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
  timeOffsetMinutes?: number;
  scenario?: string;
  initialTab?: InspectorTabType;
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
  timeOffsetMinutes = 0,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTabType>(initialTab);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const incidentId = spill?.id || "INC-MUM-2024-01";
  const currentIncident = MUMBAI_INCIDENTS[incidentId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];

  // Dynamic Environmental Threat & Coastal Impact
  const threat = calculateEnvironmentalThreat(incidentId, timeOffsetMinutes, metocean);

  // Active inspected vessel (priority: explicitly selected MMSI -> incident culprit -> highest match -> first)
  const activeVessel =
    suspects.find((s) => s.mmsi === selectedVesselMmsi) ||
    suspects.find((s) => s.mmsi === currentIncident.culpritMmsi) ||
    suspects.find((s) => s.probability_score > 70) ||
    suspects[0];

  const interceptCoords = `${currentIncident.originCoords[1].toFixed(3)}° N, ${currentIncident.originCoords[0].toFixed(3)}° E`;
  const centroidCoords = `${currentIncident.centroid[0].toFixed(3)}° N, ${currentIncident.centroid[1].toFixed(3)}° E`;
  const falsePositive = currentIncident.false_positive_analysis;

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

  return (
    <div className="w-full h-full bg-[#111622] flex flex-col overflow-y-auto select-none border-l border-slate-800 touch-pan-y">
      {/* Mobile Drawer Pull Indicator */}
      {isMobileModal && (
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2 shrink-0 lg:hidden" />
      )}

      {/* 1. Panel Header */}
      <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#111622]/95 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
          <div>
            <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
              Incident Inspector • Step 1–7 Pipeline
            </h2>
            <span className="text-[9.5px] font-mono text-slate-400 block sm:hidden">
              {currentIncident.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
            {incidentId}
          </span>
          {isMobileModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white"
              aria-label="Close inspector panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-3 pb-24 lg:pb-6">
        {/* 2. Top Key Metrics Row (Updated with Scientific Metrics) */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 sm:p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/90 text-center shadow-md">
            <span className="text-[8.5px] sm:text-[9.5px] font-mono text-slate-400 block mb-0.5">SLICK AREA</span>
            <span className="font-mono font-bold text-rose-300 text-xs sm:text-sm">
              {spill?.area_sq_km || currentIncident.baseAreaSqKm} <span className="text-[9px] text-slate-400 font-normal">km²</span>
            </span>
          </div>
          <div className="p-2 sm:p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/90 text-center shadow-md">
            <span className="text-[8.5px] sm:text-[9.5px] font-mono text-slate-400 block mb-0.5">DICE SCORE</span>
            <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
              {(currentIncident.segmentation_dice_score * 100).toFixed(1)}%
            </span>
          </div>
          <div className="p-2 sm:p-2.5 bg-slate-900/90 rounded-xl border border-slate-800/90 text-center shadow-md">
            <span className="text-[8.5px] sm:text-[9.5px] font-mono text-slate-400 block mb-0.5">SEVERITY INDEX</span>
            <span className="font-mono font-bold text-rose-400 text-xs sm:text-sm flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {threat.overall_severity_score}/100
            </span>
          </div>
        </div>

        {/* 3. SAR LOOK-ALIKE & FALSE-POSITIVE CLASSIFICATION BANNER */}
        <div className="p-3 bg-slate-900/95 rounded-xl border border-cyan-500/30 flex flex-col gap-2 font-mono text-xs shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-[10.5px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              SAR Look-Alike & False-Positive Analysis
            </span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/40 text-[9.5px]">
                Likely Oil: {falsePositive.likely_oil_pct}%
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700 text-[9.5px]">
                Look-alike: {falsePositive.lookalike_pct}%
              </span>
            </div>
          </div>

          {/* 6-Class Distribution Progress Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
            {Object.entries(falsePositive.classes).map(([className, pct]) => {
              const isOil = className === 'Oil';
              return (
                <div key={className} className="p-1.5 bg-slate-950/80 rounded border border-slate-800 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className={isOil ? 'text-rose-300 font-bold' : 'text-slate-400'}>{className}</span>
                    <strong className={isOil ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{pct}%</strong>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOil ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-slate-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* SAR Physics Validation Note */}
          <div className="text-[9.5px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/80">
            <span className="text-cyan-400 font-semibold">SAR Physics: </span>
            {falsePositive.sar_physics_reasoning}
          </div>
        </div>

        {/* 4. SPILL SEVERITY & COASTAL THREAT DUAL CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Card 1: SPILL SEVERITY */}
          <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-1.5 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
              <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                SPILL SEVERITY
              </span>
              <span className="bg-rose-950/80 text-rose-300 text-[9px] px-1.5 py-0.2 rounded font-bold border border-rose-600/40">
                {threat.overall_severity_level}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Area:</span>
                <strong className="text-white">{spill?.area_sq_km || currentIncident.baseAreaSqKm} km²</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Growth:</span>
                <strong className="text-amber-300">+{threat.growth_rate_pct_per_hour}% /h</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coast distance:</span>
                <strong className="text-white">{threat.coast_distance_km} km</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fishing zones:</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-600/40">
                  {threat.fishing_zone_risk} RISK
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Marine habitat:</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  threat.marine_habitat_risk === 'HIGH'
                    ? 'bg-rose-950 text-rose-300 border border-rose-600/40'
                    : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                }`}>
                  {threat.marine_habitat_risk} RISK
                </span>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Overall severity:</span>
              <span className="flex items-center gap-1 font-bold text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                {threat.overall_severity_score} / 100
              </span>
            </div>
          </div>

          {/* Card 2: COASTAL THREAT */}
          <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-1.5 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                COASTAL THREAT
              </span>
              <span className="bg-rose-950/80 text-rose-300 text-[9px] px-1.5 py-0.2 rounded font-bold border border-rose-600/40">
                {threat.coastal_threat_risk}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Current distance:</span>
                <strong className="text-white">{threat.coast_distance_km} km</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Predicted arrival:</span>
                <strong className="text-amber-300">{threat.predicted_arrival_hours} hours</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Impact Zone:</span>
                <span className="text-slate-200 text-[9.5px] truncate max-w-[120px]" title={threat.projected_impact_zone}>
                  {threat.projected_impact_zone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Drift Vector:</span>
                <strong className="text-cyan-300 text-[9.5px]">
                  {metocean?.net_drift_direction_deg || 69.3}° @ {metocean?.net_drift_speed_kts || 1.95} kts
                </strong>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Risk:</span>
              <span className="flex items-center gap-1.5 font-bold text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                {threat.coastal_threat_risk}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Active Inspected Suspect Spotlight Banner */}
        {activeVessel && (
          <div className="p-3 bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900/90 rounded-xl border border-rose-500/40 shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-rose-300 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                {activeVessel.mmsi === currentIncident.culpritMmsi ? 'PRIMARY CULPRIT MATCH' : 'CORRELATED ANOMALY FOCUS'}
              </span>
              <span className="bg-rose-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shrink-0">
                Weighted Anomaly Score: {activeVessel.anomaly_score || activeVessel.probability_score} / 100
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                <Ship className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">{activeVessel.name}</span>
              </span>
              <span className="text-slate-300 text-[10px] bg-slate-800/80 px-2 py-0.5 rounded shrink-0">
                {activeVessel.vessel_type}
              </span>
            </div>

            {/* Exact Intercept / Sector Info */}
            <div className="p-2 bg-slate-950/90 rounded-lg border border-rose-500/40 flex flex-col gap-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-rose-300 font-bold flex items-center gap-1">
                  <Target className="w-3 h-3 text-rose-400 shrink-0" />
                  INCIDENT SECTOR:
                </span>
                <span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-600/60 shadow-sm text-[9.5px]">
                  {currentIncident.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[9.5px] pt-1 border-t border-slate-800/80">
                <span>BREACH GPS: <strong className="text-slate-200">{interceptCoords}</strong></span>
                <span className="text-cyan-400 font-semibold">T{currentIncident.dischargeOffsetMinutes}m Intercept</span>
              </div>
            </div>

            {/* Evidence Tags */}
            {activeVessel.evidence_tags && activeVessel.evidence_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {activeVessel.evidence_tags.map((tag, i) => (
                  <span key={i} className="text-[9px] font-mono bg-rose-950/70 text-rose-200 px-2 py-0.5 rounded border border-rose-800/50">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1">
              <div>MMSI: <span className="text-white font-semibold">{activeVessel.mmsi}</span></div>
              <div>Flag: <span className="text-white">{activeVessel.flag}</span></div>
              <div>Speed: <span className="text-white">{activeVessel.speed_knots} kts</span></div>
              <div>Heading: <span className="text-white">{activeVessel.heading_degrees}°</span></div>
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

        {/* 6. Tab Navigation */}
        <div className="flex items-center bg-slate-900/95 rounded-lg p-1 border border-slate-800 text-[11px] font-mono overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview (Step 1)
          </button>
          <button
            onClick={() => setActiveTab('threat')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'threat' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Threat (Step 6)
          </button>
          <button
            onClick={() => setActiveTab('suspects')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'suspects' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Anomalies (Step 4)
          </button>
          <button
            onClick={() => setActiveTab('hindcast')}
            className={`flex-1 py-1.5 px-2 rounded-md text-center transition-all whitespace-nowrap ${
              activeTab === 'hindcast' ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hindcast (Step 2–3)
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
            Fingerprint (Step 5)
          </button>
        </div>

        {/* 7. Tab Content Area */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            {/* Step 1 Geolocation & Acquisition Stage */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  Step 1: Geolocation & Acquisition Data
                </span>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                  GeoJSON PostGIS Ready
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9.5px]">ACQUISITION TIMESTAMP</span>
                  <span className="text-white font-semibold">{currentIncident.acquisition_timestamp_utc}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">SPILL CENTROID</span>
                  <span className="text-cyan-300 font-semibold">{centroidCoords}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">SEGMENTATION DICE SCORE</span>
                  <span className="text-emerald-400 font-semibold">{(currentIncident.segmentation_dice_score * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">OIL LIKELIHOOD SCORE</span>
                  <span className="text-cyan-300 font-semibold">{(currentIncident.oil_likelihood_score * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Incident Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9.5px]">INCIDENT ID</span>
                  <span className="text-white font-semibold">{incidentId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">RADAR SCENE</span>
                  <span className="text-white font-semibold truncate block" title={currentIncident.sourceScene}>
                    {currentIncident.sourceScene}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">SLICK TYPE</span>
                  <span className="text-rose-300 font-semibold">{currentIncident.slickType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9.5px]">EST. DISCHARGE</span>
                  <span className="text-white font-semibold">~{currentIncident.volumeLiters.toLocaleString()} L</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
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

        {activeTab === 'threat' && (
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Ecological Impact & Protected Habitats
              </span>
              <div className="flex flex-col gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-950/80 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                    <Fish className="w-3 h-3 text-cyan-400" />
                    Commercial Fishery Sector:
                  </span>
                  <strong className="text-white text-xs">{threat.fishing_zone_name}</strong>
                  <span className="text-rose-400 block font-bold text-[10px] mt-0.5">Status: {threat.fishing_zone_risk} RISK</span>
                </div>

                <div className="p-2.5 bg-slate-950/80 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                    <TreePine className="w-3 h-3 text-emerald-400" />
                    Sensitive Marine Habitat:
                  </span>
                  <strong className="text-white text-xs">{threat.marine_habitat_name}</strong>
                  <span className="text-rose-400 block font-bold text-[10px] mt-0.5">Status: {threat.marine_habitat_risk} RISK</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                Coastline Threat & Containment Priority
              </span>
              <div className="text-[11px] text-slate-300 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Shoreline Distance:</span>
                  <strong className="text-white">{threat.coast_distance_km} km</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Landfall Time:</span>
                  <strong className="text-amber-300">{threat.predicted_arrival_hours} hours</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Coastal Corridor:</span>
                  <strong className="text-rose-300">{threat.projected_impact_zone}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Spill Growth Velocity:</span>
                  <strong className="text-cyan-300">+{threat.growth_rate_pct_per_hour}% /h</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'suspects' && (
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Ranked Kinematic Suspects ({suspects.length})
              </span>
              <span className="text-[9px] text-cyan-400">Click to switch focus & map</span>
            </div>
            {suspects.map((vessel) => {
              const isSelected = vessel.mmsi === activeVessel?.mmsi;
              const isCulprit = vessel.probability_score > 70;
              return (
                <div
                  key={vessel.mmsi}
                  onClick={() => onSelectVessel(vessel.mmsi)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900/95 border-cyan-400 shadow-xl ring-2 ring-cyan-400/50 scale-[1.01]'
                      : isCulprit
                      ? 'bg-slate-900/80 border-rose-500/40 hover:border-rose-400 hover:bg-slate-900'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Ship className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      {vessel.name}
                      {isSelected && (
                        <span className="text-[8.5px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded font-bold">
                          ACTIVE
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCulprit ? 'bg-rose-950 text-rose-300 border border-rose-600/50' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Score: {vessel.probability_score} / 100
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
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                -6h Hindcast Reverse Origin (Step 3)
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

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" />
                +6h Fay Drift Dispersal (Step 2)
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
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[9.5px] text-slate-400 block">10M WIND</span>
                  <span className="font-bold text-white">{metocean?.wind_speed_kts || 16.2} kts</span>
                  <span className="text-[9.5px] text-slate-400 block">{metocean?.wind_cardinal || 'WSW'} ({metocean?.wind_direction_deg || 245}°)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Waves className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[9.5px] text-slate-400 block">SURFACE CURRENT</span>
                  <span className="font-bold text-white">{metocean?.current_speed_kts || 1.4} kts</span>
                  <span className="text-[9.5px] text-slate-400 block">{metocean?.current_cardinal || 'ENE'} ({metocean?.current_direction_deg || 65}°)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Thermometer className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <span className="text-[9.5px] text-slate-400 block">SEA SURFACE TEMP</span>
                  <span className="font-bold text-white">{metocean?.sea_surface_temp_c || 28.4}°C</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[9.5px] text-slate-400 block">WAVE HEIGHT</span>
                  <span className="font-bold text-white">{metocean?.significant_wave_height_m || 1.8} m</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="flex flex-col gap-2.5 font-mono text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold px-1">
              Historical Fingerprint Vector Matches (Step 5) ({vectorMatches.length})
            </span>
            {vectorMatches.map((m, idx) => (
              <div key={idx} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
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

