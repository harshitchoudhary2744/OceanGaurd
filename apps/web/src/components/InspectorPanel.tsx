import React, { useState, useEffect } from 'react';
import {
  Radar,
  ShieldAlert,
  Database,
  FileDown,
  X,
  Wind,
  Waves,
  Ship,
  AlertTriangle,
  Target,
  TreePine,
  Fish,
  Sparkles,
  Compass,
  Activity,
  ChevronRight,
  MapPin,
  Clock,
  Layers,
  Navigation
} from 'lucide-react';
import { SuspectVessel, VectorMatch, SpillProperties, SpillGeoFeature, MetoceanData } from '../types';
import { downloadPdfReportUrl } from '../lib/api';
import { MUMBAI_INCIDENTS, calculateEnvironmentalThreat } from '../lib/simulationEngine';

export type InspectorTabType = 'overview' | 'sar_physics' | 'culprit' | 'metocean' | 'threats';

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
  onFocusLocation?: (coords: [number, number], title: string, category?: string) => void;
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
  onFocusLocation,
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
  const threat = calculateEnvironmentalThreat(incidentId, timeOffsetMinutes, metocean);
  const falsePositive = currentIncident.false_positive_analysis;

  // Active inspected vessel
  const activeVessel =
    suspects.find((s) => s.mmsi === selectedVesselMmsi) ||
    suspects.find((s) => s.mmsi === currentIncident.culpritMmsi) ||
    suspects.find((s) => s.probability_score > 70) ||
    suspects[0];

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

  const tabs: { id: InspectorTabType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'sar_physics', label: 'SAR AI', icon: <Sparkles className="w-3.5 h-3.5" />, badge: `${falsePositive.likely_oil_pct}%` },
    { id: 'culprit', label: 'Culprit', icon: <Ship className="w-3.5 h-3.5" />, badge: `${activeVessel?.probability_score || 98.4}` },
    { id: 'metocean', label: 'Metocean', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'threats', label: 'Threats', icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: `${threat.overall_severity_score}` },
  ];

  return (
    <div className="w-full h-full bg-[#111622] flex flex-col overflow-hidden select-none border-l border-slate-800 touch-pan-y">
      {/* Mobile Drawer Pull Indicator */}
      {isMobileModal && (
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2 shrink-0 lg:hidden" />
      )}

      {/* 1. Panel Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#111622]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 min-w-0">
          <Radar className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider truncate">
              {currentIncident.name}
            </h2>
            <span className="text-[10px] font-mono text-slate-400 block truncate">
              {currentIncident.sourceScene || currentIncident.id}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
            {incidentId}
          </span>
          {isMobileModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Close inspector panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="px-2 pt-2 pb-1.5 border-b border-slate-800/90 bg-slate-950/60 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isActive ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Component Tab Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3.5 pb-20 lg:pb-6">
        {activeTab === 'overview' && (
          <OverviewTab
            spill={spill}
            currentIncident={currentIncident}
            threat={threat}
            falsePositive={falsePositive}
            onExportPdf={handleDownloadPdf}
            isExporting={isExporting}
            onSwitchTab={setActiveTab}
          />
        )}

        {activeTab === 'sar_physics' && (
          <SarPhysicsTab
            currentIncident={currentIncident}
            falsePositive={falsePositive}
            spill={spill}
          />
        )}

        {activeTab === 'culprit' && (
          <CulpritTab
            activeVessel={activeVessel}
            suspects={suspects}
            onSelectVessel={onSelectVessel}
            currentIncident={currentIncident}
          />
        )}

        {activeTab === 'metocean' && (
          <MetoceanTab
            metocean={metocean}
            currentIncident={currentIncident}
            threat={threat}
          />
        )}

        {activeTab === 'threats' && (
          <ThreatsTab
            threat={threat}
            currentIncident={currentIncident}
            spill={spill}
            onFocusLocation={onFocusLocation}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TAB 1: OVERVIEW & SLICK GEOLOCATION
// ============================================================================
interface OverviewTabProps {
  spill?: SpillProperties;
  currentIncident: any;
  threat: any;
  falsePositive: any;
  onExportPdf: () => void;
  isExporting: boolean;
  onSwitchTab: (tab: InspectorTabType) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  spill,
  currentIncident,
  threat,
  falsePositive,
  onExportPdf,
  isExporting,
  onSwitchTab,
}) => {
  const centroidCoords = `${currentIncident.centroid[0].toFixed(4)}°N, ${currentIncident.centroid[1].toFixed(4)}°E`;
  const originCoords = `${currentIncident.originCoords[1].toFixed(4)}°N, ${currentIncident.originCoords[0].toFixed(4)}°E`;

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Top 3 KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center shadow-md">
          <span className="text-[9px] text-slate-400 block mb-0.5">SLICK AREA</span>
          <span className="font-bold text-rose-300 text-sm">
            {spill?.area_sq_km || currentIncident.baseAreaSqKm} <span className="text-[9px] text-slate-400 font-normal">km²</span>
          </span>
        </div>
        <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center shadow-md">
          <span className="text-[9px] text-slate-400 block mb-0.5">DICE SCORE</span>
          <span className="font-bold text-emerald-400 text-sm">
            {(currentIncident.segmentation_dice_score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-center shadow-md">
          <span className="text-[9px] text-slate-400 block mb-0.5">SEVERITY</span>
          <span className="font-bold text-rose-400 text-sm flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {threat.overall_severity_score}/100
          </span>
        </div>
      </div>

      {/* Primary Oil Slick Spec Card */}
      <div className="p-3 bg-slate-900/95 rounded-xl border border-slate-800 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <span className="text-[11px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            Slick Characterization
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 font-bold border border-rose-500/40 text-[9.5px]">
            {spill?.slick_type || "Confirmed Heavy Fuel Oil"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800/90 flex flex-col gap-0.5">
            <span className="text-slate-400 text-[9.5px]">Slick Centroid</span>
            <strong className="text-cyan-200">{centroidCoords}</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800/90 flex flex-col gap-0.5">
            <span className="text-slate-400 text-[9.5px]">Breach Origin</span>
            <strong className="text-rose-300">{originCoords}</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800/90 flex flex-col gap-0.5">
            <span className="text-slate-400 text-[9.5px]">Estimated Volume</span>
            <strong className="text-white">{currentIncident.estimatedVolumeLiters?.toLocaleString() || "51,000"} L</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800/90 flex flex-col gap-0.5">
            <span className="text-slate-400 text-[9.5px]">Coast Distance</span>
            <strong className="text-amber-300">{threat.coast_distance_km} km ({threat.eta_hours_to_landfall}h ETA)</strong>
          </div>
        </div>
      </div>

      {/* Quick Summary Teasers for other tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onSwitchTab('sar_physics')}
          className="p-2.5 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-cyan-500/30 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between text-cyan-300 text-[10.5px] font-bold mb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> SAR Analysis
            </span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-[10px] text-emerald-400 font-bold">Likely Oil: {falsePositive.likely_oil_pct}%</div>
          <div className="text-[9px] text-slate-400">Marangoni: 8.4 dB</div>
        </button>

        <button
          onClick={() => onSwitchTab('culprit')}
          className="p-2.5 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-rose-500/30 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between text-rose-300 text-[10.5px] font-bold mb-1">
            <span className="flex items-center gap-1">
              <Ship className="w-3 h-3 text-rose-400" /> Primary Culprit
            </span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-[10px] text-rose-400 font-bold">Anomaly: {currentIncident.culpritAnomalyScore || 98.4}/100</div>
          <div className="text-[9px] text-slate-400 truncate">{currentIncident.culpritName}</div>
        </button>
      </div>

      {/* Satellite Metadata Box */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[10px] flex flex-col gap-1.5 text-slate-400">
        <div className="text-slate-300 font-bold uppercase text-[9.5px] border-b border-slate-900 pb-1">
          Satellite Ingestion Metadata
        </div>
        <div className="flex justify-between">
          <span>Sensor Platform:</span>
          <strong className="text-white">Sentinel-1 C-SAR</strong>
        </div>
        <div className="flex justify-between">
          <span>Pass Time (IST):</span>
          <strong className="text-cyan-300">{currentIncident.satellite_pass_ist || "16:14:00 IST"}</strong>
        </div>
        <div className="flex justify-between">
          <span>Polarization:</span>
          <strong className="text-white">VV + VH (IW Mode)</strong>
        </div>
      </div>

      {/* PDF Export Button */}
      <button
        onClick={onExportPdf}
        disabled={isExporting}
        className="w-full mt-1 py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
      >
        <FileDown className="w-4 h-4" />
        <span>{isExporting ? 'Compiling Legal Report...' : 'Generate Legal Forensic PDF Dossier'}</span>
      </button>
    </div>
  );
};

// ============================================================================
// TAB 2: SAR PHYSICS & 6-CLASS FALSE-POSITIVE MODEL
// ============================================================================
interface SarPhysicsTabProps {
  currentIncident: any;
  falsePositive: any;
  spill?: SpillProperties;
}

const SarPhysicsTab: React.FC<SarPhysicsTabProps> = ({ falsePositive }) => {
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* 6-Class False Positive Header Card */}
      <div className="p-3 bg-slate-900/95 rounded-xl border border-cyan-500/30 flex flex-col gap-2.5 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-[11px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            6-Class Multi-Modal Classifier
          </span>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 font-bold border border-emerald-500/40 text-[9.5px]">
              Oil: {falsePositive.likely_oil_pct}%
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700 text-[9.5px]">
              Look-alike: {falsePositive.lookalike_pct}%
            </span>
          </div>
        </div>

        {/* 6 Classes */}
        <div className="flex flex-col gap-2 pt-1">
          {Object.entries(falsePositive.classes).map(([className, pct]) => {
            const isOil = className === 'Oil';
            const value = pct as number;
            return (
              <div key={className} className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/90 flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className={isOil ? 'text-rose-300 font-bold flex items-center gap-1' : 'text-slate-400'}>
                    {isOil && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                    {className}
                  </span>
                  <strong className={isOil ? 'text-emerald-400 font-bold text-xs' : 'text-slate-300'}>{value}%</strong>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOil ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-slate-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Physics Validation Metrics */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2">
        <span className="text-[10.5px] text-slate-300 font-bold uppercase border-b border-slate-800 pb-1 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          Marangoni Radar Backscatter Damping
        </span>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400 block">Damping Contrast:</span>
            <strong className="text-cyan-300 text-xs">8.4 dB Ratio</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400 block">Speckle Variance:</span>
            <strong className="text-emerald-400 text-xs">0.034 (Low Noise)</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400 block">Wind Range:</span>
            <strong className="text-white">3.0 – 12.0 m/s Validated</strong>
          </div>
          <div className="p-2 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400 block">Segmentation Dice:</span>
            <strong className="text-emerald-400 text-xs">98.8% Overlap</strong>
          </div>
        </div>

        <div className="text-[9.5px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800/80 mt-1">
          <span className="text-cyan-400 font-semibold">Radar Science: </span>
          {falsePositive.sar_physics_reasoning}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 3: CULPRIT & VESSEL ATTRIBUTION
// ============================================================================
interface CulpritTabProps {
  activeVessel?: SuspectVessel;
  suspects: SuspectVessel[];
  onSelectVessel: (mmsi: number) => void;
  currentIncident: any;
}

const CulpritTab: React.FC<CulpritTabProps> = ({ activeVessel, suspects, onSelectVessel }) => {
  if (!activeVessel) {
    return <div className="text-slate-400 text-center py-6 font-mono text-xs">No suspect vessels detected in EEZ corridor.</div>;
  }

  const anomalyScore = activeVessel.probability_score;

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Primary Culprit Card */}
      <div className="p-3 bg-slate-900/95 rounded-xl border border-rose-500/40 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Ship className="w-4 h-4 text-rose-400" />
            <div>
              <span className="text-white font-bold text-xs">{activeVessel.name}</span>
              <span className="text-[9.5px] text-slate-400 block">MMSI: {activeVessel.mmsi} • Flag: {activeVessel.flag}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block">ANOMALY SCORE</span>
            <span className="text-rose-400 font-bold text-sm">{anomalyScore} / 100</span>
          </div>
        </div>

        {/* Breakdown of Anomaly Factors */}
        <div className="flex flex-col gap-1.5 pt-1 text-[10.5px]">
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Kinematic Speed Drop:</span>
            <strong className="text-amber-300">14.8 kts → 5.2 kts (Δ 9.6 kts)</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">AIS Blackout Gap:</span>
            <strong className="text-rose-400">42 Minutes (Unnotified)</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Hindcast CPA to Origin:</span>
            <strong className="text-cyan-300">340 meters</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Vessel Class & Draught:</span>
            <strong className="text-white">{activeVessel.vessel_type} • 14.2m Draft</strong>
          </div>
        </div>

        {/* Evidence Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 text-[9.5px] font-bold border border-rose-500/50">
            🚨 Speed Deceleration Match
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 text-[9.5px] font-bold border border-amber-500/50">
            📡 AIS Dark Window
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 text-[9.5px] font-bold border border-cyan-500/50">
            📍 Origin Intercept CPA
          </span>
        </div>
      </div>

      {/* Correlated Fleet Traffic in Corridor */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
          Corridor Vessels Ranked by Anomaly Score ({suspects.length})
        </span>

        <div className="flex flex-col gap-1.5">
          {suspects.map((vessel) => {
            const isSelected = vessel.mmsi === activeVessel.mmsi;
            const isHighRisk = vessel.probability_score >= 70;

            return (
              <button
                key={vessel.mmsi}
                onClick={() => onSelectVessel(vessel.mmsi)}
                className={`p-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ship className={`w-3.5 h-3.5 ${isHighRisk ? 'text-rose-400' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-white font-bold text-[11px] block">{vessel.name}</span>
                    <span className="text-[9px] text-slate-400">{vessel.vessel_type} • {vessel.speed_knots} kts</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                      isHighRisk
                        ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Score: {vessel.probability_score}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 4: METOCEAN & HYDRODYNAMIC DRIFT
// ============================================================================
interface MetoceanTabProps {
  metocean?: MetoceanData;
  currentIncident: any;
  threat: any;
}

const MetoceanTab: React.FC<MetoceanTabProps> = ({ metocean, threat }) => {
  const windSpeed = metocean?.wind_speed_kts || 16.2;
  const windDir = metocean?.wind_direction_deg || 295;
  const windCard = metocean?.wind_cardinal || 'WNW';

  const curSpeed = metocean?.current_speed_kts || 1.1;
  const curDir = metocean?.current_direction_deg || 65;
  const curCard = metocean?.current_cardinal || 'ENE';

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Live Weather Vectors Card */}
      <div className="p-3 bg-slate-900/95 rounded-xl border border-slate-800 flex flex-col gap-2.5 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-[11px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
            Arabian Sea Metocean Vectors
          </span>
          <span className="text-[9.5px] text-emerald-400 font-bold">LIVE TELEMETRY</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex flex-col gap-1">
            <span className="text-slate-400 text-[9.5px] flex items-center gap-1">
              <Wind className="w-3 h-3 text-cyan-400" /> Surface Wind
            </span>
            <strong className="text-white text-xs">{windSpeed} kts @ {windDir}°</strong>
            <span className="text-[9px] text-cyan-300">{windCard} Flow</span>
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex flex-col gap-1">
            <span className="text-slate-400 text-[9.5px] flex items-center gap-1">
              <Waves className="w-3 h-3 text-cyan-300" /> Surface Current
            </span>
            <strong className="text-white text-xs">{curSpeed} kts @ {curDir}°</strong>
            <span className="text-[9px] text-cyan-300">{curCard} Advection</span>
          </div>
        </div>
      </div>

      {/* Fay Hydrodynamic Dispersion Model Card */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2">
        <span className="text-[10.5px] text-slate-300 font-bold uppercase border-b border-slate-800 pb-1 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          Fay +6h Hydrodynamic Forecast
        </span>

        <div className="flex flex-col gap-1.5 text-[10.5px]">
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Net Drift Speed:</span>
            <strong className="text-cyan-300">1.4 kts @ 72° ENE</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Radial Spread Rate:</span>
            <strong className="text-amber-300">+{threat.growth_rate_pct_per_hour}% / hour</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Evaporative Weathering:</span>
            <strong className="text-emerald-400">22.4% Mass Lost (12h)</strong>
          </div>
          <div className="flex justify-between p-1.5 bg-slate-950/70 rounded border border-slate-800">
            <span className="text-slate-400">Emulsification State:</span>
            <strong className="text-rose-300">18.2% Water Content</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 5: ENVIRONMENTAL THREATS & COASTAL ASSET IMPACT
// ============================================================================
interface ThreatsTabProps {
  threat: any;
  currentIncident: any;
  spill?: SpillProperties;
  onFocusLocation?: (coords: [number, number], title: string, category?: string) => void;
}

const ThreatsTab: React.FC<ThreatsTabProps> = ({ threat, currentIncident, onFocusLocation }) => {
  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* Overall Threat & Landfall Rating */}
      <div className="p-3 bg-slate-900/95 rounded-xl border border-rose-500/40 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-[11px] text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Coastal Multi-Hazard Threat Assessment
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-bold border border-rose-600/40 text-[9.5px]">
            {threat.overall_severity_level} ({threat.overall_severity_score}/100)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
          <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
            <span className="text-slate-400 block">Coastline Distance</span>
            <strong className="text-white text-xs">{threat.coast_distance_km} km</strong>
          </div>
          <div className="p-2 bg-slate-950/80 rounded border border-slate-800">
            <span className="text-slate-400 block">Landfall Arrival ETA</span>
            <strong className="text-amber-300 text-xs">{threat.predicted_arrival_hours || 11.5} Hours</strong>
          </div>
        </div>
      </div>

      {/* 🟢 1. Fishing Zones Impact */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-emerald-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10.5px] text-emerald-300 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm" />
            🟢 Fishing Zones Vulnerability
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            {threat.fishing_zone_risk || 'HIGH'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-[10.5px]">
          <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-white font-bold">
              <span>{threat.fishing_zone_name || 'Mumbai Pelagic Trawling Fairway'}</span>
              <span className="text-emerald-400 font-mono">420 Trawlers</span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Urgent broadcast alert issued. Standby advisory active for high-value pomfret and seerfish harvesting grounds.
            </p>
            {onFocusLocation && (
              <button
                onClick={() => onFocusLocation([72.18, 19.05], threat.fishing_zone_name || 'Mumbai Pelagic Fairway', 'fishing_zone')}
                className="mt-1 self-start px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
              >
                <Navigation className="w-3 h-3 text-emerald-400" />
                Locate Fishing Fairway on Map
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🔵 2. Fishing Harbours & Ports Impact */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-blue-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10.5px] text-blue-300 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
            🔵 Fishing Harbours at Risk
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
            {threat.fishing_harbour_risk || 'HIGH'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-[10.5px]">
          <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-white font-bold">
              <span>{threat.fishing_harbour_name || 'Sassoon Docks Fishery Terminal (41.5 km)'}</span>
              <span className="text-blue-400 font-mono">1,250 Vessels</span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Pre-position containment booms across harbor entrance. Evacuation alert ready for offshore landing berths.
            </p>
            {onFocusLocation && (
              <button
                onClick={() => onFocusLocation([72.8256, 18.9158], threat.fishing_harbour_name || 'Sassoon Docks Fishery Terminal', 'fishing_harbour')}
                className="mt-1 self-start px-2 py-1 rounded bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
              >
                <Navigation className="w-3 h-3 text-blue-400" />
                Locate Harbour on Map
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🟣 3. Aquaculture & Mariculture Impact */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-purple-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10.5px] text-purple-300 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shadow-sm" />
            🟣 Aquaculture Farms Exposure
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
            {threat.aquaculture_risk || 'HIGH'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-[10.5px]">
          <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-white font-bold">
              <span>{threat.aquaculture_name || 'Raigad Estuarine Mariculture Cages (35.0 km)'}</span>
              <span className="text-purple-400 font-mono">₹78.0 Cr Value</span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Emergency advisory issued to close intertidal water intake gates and deploy secondary skirt oil deflectors.
            </p>
            {onFocusLocation && (
              <button
                onClick={() => onFocusLocation([72.88, 18.72], threat.aquaculture_name || 'Raigad Estuarine Mariculture Cages', 'aquaculture')}
                className="mt-1 self-start px-2 py-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
              >
                <Navigation className="w-3 h-3 text-purple-400" />
                Locate Aquaculture Cages on Map
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🟠 4. Coastal Communities & Koliwadas Impact */}
      <div className="p-3 bg-slate-900/90 rounded-xl border border-orange-500/30 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10.5px] text-orange-300 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
            🟠 Coastal Communities & Koliwadas
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-950 text-orange-300 border border-orange-500/40">
            {threat.coastal_community_risk || 'HIGH'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-[10.5px]">
          <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-white font-bold">
              <span>{threat.coastal_community_name || 'Worli & Mahim Koliwada Settlements'}</span>
              <span className="text-orange-400 font-mono">30,700 Pop.</span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Shoreline response contingency activated. Village community coordinators on alert for potential beach tarball deposits.
            </p>
            {onFocusLocation && (
              <button
                onClick={() => onFocusLocation([72.8160, 19.0220], threat.coastal_community_name || 'Worli Koliwada Village', 'coastal_community')}
                className="mt-1 self-start px-2 py-1 rounded bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
              >
                <Navigation className="w-3 h-3 text-orange-400" />
                Locate Koliwada on Map
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Protection Advisories */}
      {threat.active_advisories && threat.active_advisories.length > 0 && (
        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2">
          <span className="text-[10.5px] text-cyan-300 font-bold uppercase border-b border-slate-800 pb-1">
            Active Coastal Protection Directives
          </span>
          <ul className="space-y-1 text-[10px] text-slate-300">
            {threat.active_advisories.map((adv: string, idx: number) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

