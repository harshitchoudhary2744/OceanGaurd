import React from 'react';
import { X, Sparkles, FileText } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-4xl bg-[#1c1f2a] border border-[#00daf3]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#3b494c]/30 flex items-center justify-between bg-[#171b26]">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-[#93000a]/40 text-[#ffb4ab] font-mono text-xs font-bold border border-[#ffb4ab]/30">
              {spillId}
            </span>
            <h3 className="font-mono text-sm font-bold text-white uppercase">
              Forensic Satellite SAR Analysis • Indian Ocean & Arabian Sea Sector
            </h3>
          </div>
          <button onClick={onClose} className="text-[#849396] hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw SAR */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-[#3b494c]/30 relative flex flex-col justify-between h-56">
              <span className="font-mono text-xs font-bold text-white px-2 py-1 rounded bg-[#1c1f2a] self-start border border-[#3b494c]/40">
                1. RAW SENTINEL-1 C-BAND (MUMBAI HIGH SECTOR)
              </span>
              <svg className="w-full h-32 opacity-70" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="#0f1923" stroke="#00e5ff" strokeWidth="1" />
                <circle cx="140" cy="45" r="3" fill="#00daf3" />
                <line x1="140" y1="45" x2="100" y2="55" stroke="#00daf3" strokeDasharray="2 2" />
              </svg>
              <div className="text-[10px] font-mono text-[#849396] self-end">
                LAT: 19.050° N | LON: 72.150° E (Arabian Sea)
              </div>
            </div>

            {/* AI Segmentation */}
            <div className="bg-[#0a0e18] p-4 rounded-xl border border-[#ff3b30]/50 relative flex flex-col justify-between h-56">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1c1f2a] self-start border border-[#ff3b30]/40">
                <Sparkles className="w-3 h-3 text-[#ff3b30]" />
                <span className="font-mono text-xs font-bold text-[#ffb4ab]">2. U-NET PREDICTED MASK (98.8%)</span>
              </div>
              <svg className="w-full h-32" viewBox="0 0 200 100">
                <path d="M 30 60 Q 70 40 110 50 T 170 70 Q 140 85 90 75 T 40 70 Z" fill="rgba(255,59,48,0.4)" stroke="#ff3b30" strokeWidth="2" />
                <polygon points="140,40 145,50 135,50" fill="#00daf3" />
                <line x1="140" y1="45" x2="100" y2="55" stroke="#ff3b30" strokeDasharray="3 3" strokeWidth="1.5" />
              </svg>
              <div className="text-[10px] font-mono text-[#4ade80] font-bold self-end">
                CONFIDENCE: 98.8% | AREA: 5.40 sq km
              </div>
            </div>
          </div>

          {/* Suspect Target Details */}
          <div className="p-3.5 bg-[#171b26] rounded-xl border border-[#3b494c]/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#849396] block">ATTRIBUTED SHIP</span>
              <span className="font-bold text-white text-sm">MT DESH SHANTI</span>
            </div>
            <div>
              <span className="text-[10px] text-[#849396] block">MMSI IDENTIFIER</span>
              <span className="font-bold text-[#00daf3] text-sm">419000123</span>
            </div>
            <div>
              <span className="text-[10px] text-[#849396] block">FLAG / CLASS</span>
              <span className="font-bold text-white text-sm">India (VLCC Crude Tanker)</span>
            </div>
            <div>
              <span className="text-[10px] text-[#849396] block">PROXIMITY DELTA</span>
              <span className="font-bold text-[#ffb4ab] text-sm">110 m (Centroid Intercept)</span>
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
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#00e5ff] text-[#00363d] font-mono text-xs font-bold hover:bg-[#9cf0ff] transition-all"
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
