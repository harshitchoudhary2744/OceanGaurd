import React from 'react';
import { X, Sparkles, FileText, History, ShieldAlert, Gauge, ZapOff, Navigation, MapPin } from 'lucide-react';
import { downloadPdfReportUrl } from '../lib/api';
import { INITIAL_SUSPECTS } from '../lib/mockData';
import { MUMBAI_INCIDENTS, calculateVesselKinematicAnomaly } from '../lib/simulationEngine';
import { SuspectVessel } from '../types';

interface ForensicModalProps {
  isOpen: boolean;
  onClose: () => void;
  spillId: string;
}

export const ForensicModal: React.FC<ForensicModalProps> = ({ isOpen, onClose, spillId }) => {
  if (!isOpen) return null;

  const currentIncident = MUMBAI_INCIDENTS[spillId] || MUMBAI_INCIDENTS["INC-MUM-2024-01"];
  const falsePositive = currentIncident.false_positive_analysis;
  const culprit: SuspectVessel = INITIAL_SUSPECTS.find((s: SuspectVessel) => s.mmsi === currentIncident.culpritMmsi) || INITIAL_SUSPECTS[0];
  const anomalyBreakdown = culprit?.anomaly_breakdown || calculateVesselKinematicAnomaly(culprit, currentIncident.originCoords, currentIncident.dischargeOffsetMinutes);

  const handleDownload = async () => {
    const url = await downloadPdfReportUrl(spillId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OceanGuard_Forensic_${spillId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-4xl bg-[#111622] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 font-mono text-xs font-bold border border-rose-500/30">
              {spillId}
            </span>
            <h3 className="font-mono text-sm font-bold text-white uppercase">
              Forensic SAR & Kinematic Trajectory Audit • Mumbai Maritime Corridor
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw SAR */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-slate-800 relative flex flex-col justify-between h-52">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-slate-900 self-start border border-slate-700">
                  1. RAW SENTINEL-1 C-BAND ({currentIncident.name.toUpperCase()})
                </span>
                <span className="text-[10px] font-mono text-cyan-300">
                  {currentIncident.acquisition_timestamp_ist || "2024-10-18 16:14:00 IST"}
                </span>
              </div>
              <svg className="w-full h-28 opacity-70" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="#0f1923" stroke="#06b6d4" strokeWidth="1" />
                <circle cx="140" cy="45" r="3" fill="#22d3ee" />
                <line x1="140" y1="45" x2="100" y2="55" stroke="#22d3ee" strokeDasharray="2 2" />
              </svg>
              <div className="text-[10px] font-mono text-slate-400 self-end flex justify-between w-full">
                <span>CENTROID: {currentIncident.centroid[0]}°N, {currentIncident.centroid[1]}°E</span>
                <span>DAMPING: {falsePositive.marangoni_damping_db} dB</span>
              </div>
            </div>

            {/* AI Segmentation & Hindcast Reverse Vector */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-rose-500/50 relative flex flex-col justify-between h-52">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 self-start border border-rose-500/40">
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span className="font-mono text-xs font-bold text-rose-300">2. U-NET SEGMENTATION & HINDCAST</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  Dice Score: {(currentIncident.segmentation_dice_score * 100).toFixed(1)}%
                </span>
              </div>
              <svg className="w-full h-28" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="rgba(244,63,94,0.4)" stroke="#f43f5e" strokeWidth="2" />
                <line x1="100" y1="55" x2="40" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                <polygon points="40,60 48,56 46,64" fill="#f59e0b" />
                <circle cx="40" cy="60" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                <polygon points="140,40 145,50 135,50" fill="#06b6d4" />
              </svg>
              <div className="text-[10px] font-mono text-amber-400 font-bold self-end">
                HINDCAST ORIGIN: T{currentIncident.dischargeOffsetMinutes}m @ 0.00 km CPA
              </div>
            </div>
          </div>

          {/* Look-Alike & False-Positive 6-Class Analysis Card */}
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-cyan-500/30 flex flex-col gap-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                SAR LOOK-ALIKE & FALSE-POSITIVE DISAMBIGUATION (6-CLASS MODEL)
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/40">
                  Likely Oil: {falsePositive.likely_oil_pct}%
                </span>
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700">
                  Look-alike: {falsePositive.lookalike_pct}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px]">
              {Object.entries(falsePositive.classes).map(([className, pct]) => {
                const isOil = className === 'Oil';
                return (
                  <div key={className} className="p-2 bg-[#0a0e18] rounded border border-slate-800 flex flex-col gap-0.5">
                    <span className={isOil ? 'text-rose-300 font-bold' : 'text-slate-400'}>{className}</span>
                    <span className={isOil ? 'text-emerald-400 font-bold text-xs' : 'text-slate-300 font-semibold'}>{pct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed bg-[#0a0e18] p-2 rounded border border-slate-800">
              <span className="text-cyan-400 font-semibold">Physics Verification: </span>
              {falsePositive.sar_physics_reasoning}
            </div>
          </div>

          {/* Anomaly Breakdown Matrix */}
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-rose-500/30 flex flex-col gap-2.5 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-rose-300 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                VESSEL KINEMATIC ANOMALY BREAKDOWN
              </span>
              <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                Weighted Anomaly Score: {anomalyBreakdown.composite_score.toFixed(1)} / 100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-amber-400" />
                  Speed Drop
                </span>
                <span className="text-rose-300 font-bold text-xs">
                  -{anomalyBreakdown.speed_drop_delta_kts.toFixed(1)} kts
                </span>
                <span className="text-[9px] text-slate-500">Transit deceleration</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <ZapOff className="w-3 h-3 text-rose-400" />
                  AIS Blackout
                </span>
                <span className="text-rose-300 font-bold text-xs">
                  {anomalyBreakdown.max_ais_gap_minutes.toFixed(1)} min
                </span>
                <span className="text-[9px] text-slate-500">Dark transponder</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  Hindcast CPA
                </span>
                <span className="text-emerald-400 font-bold text-xs">
                  {(anomalyBreakdown.hindcast_cpa_distance_km ?? 0.00).toFixed(2)} km
                </span>
                <span className="text-[9px] text-slate-500">Spatial intercept</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <History className="w-3 h-3 text-indigo-400" />
                  Cargo Type
                </span>
                <span className="text-amber-300 font-bold text-xs">{currentIncident.slickType.split(' ')[0]}</span>
                <span className="text-[9px] text-slate-500">High Risk Multiplier</span>
              </div>
            </div>
          </div>

          {/* Suspect Target Details */}
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-3 text-xs font-mono">
            <div className="p-2 bg-[#0a0e18] rounded-lg border border-rose-500/40 flex items-center justify-between">
              <span className="text-rose-300 font-bold">🎯 INTERCEPT LOCATION:</span>
              <span className="text-white font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/40">
                {currentIncident.locationName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block">ATTRIBUTED SHIP</span>
                <span className="font-bold text-white text-sm">{currentIncident.culpritName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">MMSI IDENTIFIER</span>
                <span className="font-bold text-cyan-400 text-sm">{currentIncident.culpritMmsi}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">GPS COORDINATES</span>
                <span className="font-bold text-white text-sm">{currentIncident.originCoords[1]}°N, {currentIncident.originCoords[0]}°E</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">EST. DISCHARGE</span>
                <span className="font-bold text-rose-400 text-sm">{currentIncident.volumeLiters.toLocaleString()} L</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/60">
          <span className="text-[11px] font-mono text-slate-400">
            Court-Admissible Evidence Dossier • Indian Coast Guard & Maritime Board (SIH26143)
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-white">
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-mono text-xs font-bold hover:bg-cyan-400 transition-all shadow-md"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Legal PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

