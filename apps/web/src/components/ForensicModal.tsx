import React from 'react';
import { X, Sparkles, FileText, History, ShieldAlert, Gauge, ZapOff, Navigation } from 'lucide-react';
import { downloadPdfReportUrl } from '../lib/api';

interface ForensicModalProps {
  isOpen: boolean;
  onClose: () => void;
  spillId: string;
}

export const ForensicModal: React.FC<ForensicModalProps> = ({ isOpen, onClose, spillId }) => {
  if (!isOpen) return null;

  const handleDownload = async () => {
    const url = await downloadPdfReportUrl(spillId);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OceanGuard_Forensic_${spillId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isEnnore = spillId.includes('02') || spillId.includes('2017');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-4xl bg-[#1c1f2a] border border-[#00daf3]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#3b494c]/30 flex items-center justify-between bg-[#171b26]">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-[#93000a]/40 text-[#ffb4ab] font-mono text-xs font-bold border border-[#ffb4ab]/30">
              {spillId}
            </span>
            <h3 className="font-mono text-sm font-bold text-white uppercase">
              Forensic SAR & Hydrodynamic Hindcast Audit • {isEnnore ? 'Bay of Bengal' : 'Arabian Sea'}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#849396] hover:text-white p-1" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw SAR */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-[#3b494c]/30 relative flex flex-col justify-between h-52">
              <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-[#1c1f2a] self-start border border-[#3b494c]/40">
                1. RAW SENTINEL-1 C-BAND ({isEnnore ? 'ENNORE SECTOR' : 'MUMBAI HIGH'})
              </span>
              <svg className="w-full h-28 opacity-70" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="#0f1923" stroke="#00e5ff" strokeWidth="1" />
                <circle cx="140" cy="45" r="3" fill="#00daf3" />
                <line x1="140" y1="45" x2="100" y2="55" stroke="#00daf3" strokeDasharray="2 2" />
              </svg>
              <div className="text-[10px] font-mono text-[#849396] self-end">
                {isEnnore ? 'LAT: 13.250° N | LON: 80.750° E' : 'LAT: 19.050° N | LON: 72.150° E'}
              </div>
            </div>

            {/* AI Segmentation & Hindcast Reverse Vector */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-[#ff3b30]/50 relative flex flex-col justify-between h-52">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1c1f2a] self-start border border-[#ff3b30]/40">
                <Sparkles className="w-3 h-3 text-[#ff3b30]" />
                <span className="font-mono text-xs font-bold text-[#ffb4ab]">2. U-NET SEGMENTATION + HINDCAST REVERSE VECTOR</span>
              </div>
              <svg className="w-full h-28" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="rgba(255,59,48,0.4)" stroke="#ff3b30" strokeWidth="2" />
                {/* Hindcast reverse vector arrow */}
                <line x1="100" y1="55" x2="40" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                <polygon points="40,60 48,56 46,64" fill="#f59e0b" />
                <circle cx="40" cy="60" r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
                <polygon points="140,40 145,50 135,50" fill="#00daf3" />
              </svg>
              <div className="text-[10px] font-mono text-[#f59e0b] font-bold self-end">
                HINDCAST ORIGIN: T-{isEnnore ? '60m' : '42m'} @ 0.00 km CPA
              </div>
            </div>
          </div>

          {/* Anomaly Breakdown Matrix */}
          <div className="p-3.5 bg-[#171b26] rounded-xl border border-rose-500/30 flex flex-col gap-2.5 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-1.5">
              <span className="text-rose-300 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                VESSEL ANOMALY & KINEMATIC MATRIX
              </span>
              <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                {isEnnore ? '96.8%' : '98.4%'} Composite Risk
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-amber-400" />
                  Speed Drop
                </span>
                <span className="text-rose-300 font-bold text-xs">{isEnnore ? '-8.4 kts' : '-9.6 kts'}</span>
                <span className="text-[9px] text-slate-500">Transit deceleration</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <ZapOff className="w-3 h-3 text-rose-400" />
                  AIS Blackout
                </span>
                <span className="text-rose-300 font-bold text-xs">{isEnnore ? '38.0 min' : '42.0 min'}</span>
                <span className="text-[9px] text-slate-500">Dark transponder</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  Hindcast CPA
                </span>
                <span className="text-emerald-400 font-bold text-xs">0.00 km</span>
                <span className="text-[9px] text-slate-500">Exact intercept</span>
              </div>
              <div className="p-2 bg-[#0a0e18] rounded border border-slate-800">
                <span className="text-slate-400 block flex items-center gap-1">
                  <History className="w-3 h-3 text-indigo-400" />
                  Cargo Type
                </span>
                <span className="text-amber-300 font-bold text-xs">Crude / HFO</span>
                <span className="text-[9px] text-slate-500">1.25x Risk multiplier</span>
              </div>
            </div>
          </div>

          {/* Suspect Target Details */}
          <div className="p-3.5 bg-[#171b26] rounded-xl border border-[#3b494c]/30 flex flex-col gap-3 text-xs font-mono">
            <div className="p-2 bg-[#0a0e18] rounded-lg border border-[#ff3b30]/40 flex items-center justify-between">
              <span className="text-[#ffb4ab] font-bold">🎯 EXACT INTERCEPT TIMESTAMP:</span>
              <span className="text-white font-bold bg-[#93000a]/50 px-2 py-0.5 rounded border border-[#ffb4ab]/40">
                {isEnnore ? '28 JAN 2017 • 03:45:00 IST (22:15 UTC)' : '14 AUG 2024 • 05:29:40 IST (T-42m)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-[#849396] block">ATTRIBUTED SHIP</span>
                <span className="font-bold text-white text-sm">{isEnnore ? 'MT DAWN KANCHEEPURAM' : 'MT DESH SHANTI'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#849396] block">MMSI IDENTIFIER</span>
                <span className="font-bold text-[#00daf3] text-sm">{isEnnore ? '419000789' : '419000123'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#849396] block">GPS COORDINATES</span>
                <span className="font-bold text-white text-sm">{isEnnore ? "13°14.2'N, 80°21.8'E" : "19°02.9'N, 72°08.7'E"}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#849396] block">PROXIMITY DELTA</span>
                <span className="font-bold text-[#4ade80] text-sm">0.00 m (Direct Intercept)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3b494c]/30 flex justify-between items-center bg-[#171b26]">
          <span className="text-[11px] font-mono text-[#849396]">
            Court-Admissible Evidence Dossier • Indian Coast Guard & Maritime Board (SIH26143)
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#849396] hover:text-white">
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00e5ff] text-[#00363d] font-mono text-xs font-bold hover:bg-[#9cf0ff] transition-all shadow-md"
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
