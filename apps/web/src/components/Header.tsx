import React, { useState, useEffect } from 'react';
import { Satellite, Upload, FileText, RefreshCw, Eye, Menu, X, Compass, Radio } from 'lucide-react';
import { downloadPdfReportUrl } from '../lib/api';

import { SuspectVessel, SpillGeoFeature, MetoceanData } from '../types';

interface HeaderProps {
  selectedSpillId: string;
  spillFeature?: SpillGeoFeature | null;
  suspects?: SuspectVessel[];
  onOpenUploadModal: () => void;
  onOpenForensicModal: () => void;
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  metocean?: MetoceanData;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSpillId,
  spillFeature,
  suspects,
  onOpenUploadModal,
  onOpenForensicModal,
  activeScenario,
  onScenarioChange,
  onRefresh,
  isRefreshing,
  metocean
}) => {
  const [istTime, setIstTime] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setIstTime(d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const url = await downloadPdfReportUrl(selectedSpillId, spillFeature, suspects);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OceanGuard_Forensic_${selectedSpillId}.pdf`;
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
    <>
      <header className="h-16 tactical-glass border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between z-40 shrink-0 select-none">
        {/* Brand & Ticker */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
              <Satellite className="w-4 h-4" />
            </div>
            <span className="font-mono font-bold text-base sm:text-lg text-white tracking-wider">
              OCEANGUARD
            </span>
          </div>

          <span className="hidden xs:inline-block px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-cyan-500/30 font-mono text-[11px] sm:text-xs font-semibold">
            INDIA EEZ
          </span>

          {/* Live Environmental Ticker */}
          <div className="hidden xl:flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-800 text-xs font-mono text-slate-300">
            <span className="text-cyan-400">💨 {metocean?.wind_speed_kts || 16.2} kts {metocean?.wind_cardinal || 'WSW'}</span>
            <span className="text-slate-700">|</span>
            <span className="text-cyan-300">🌊 {metocean?.current_speed_kts || 1.4} kts {metocean?.current_cardinal || 'ENE'}</span>
            <span className="text-slate-700">|</span>
            <span className="text-rose-300">🌡️ {metocean?.sea_surface_temp_c || 28.4}°C</span>
          </div>
        </div>

        {/* Action Controls - Desktop */}
        <div className="hidden md:flex items-center gap-2.5 sm:gap-3">
          {/* Maritime Sector Switcher */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => onScenarioChange('arabian_sea')}
              className={`px-2.5 py-1 rounded transition-all ${
                activeScenario === 'arabian_sea'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mumbai Sector
            </button>
            <button
              onClick={() => onScenarioChange('bay_of_bengal')}
              className={`px-2.5 py-1 rounded transition-all ${
                activeScenario === 'bay_of_bengal'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chennai Sector
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Forensic SAR View */}
          <button
            onClick={onOpenForensicModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-semibold text-slate-200 hover:text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>SAR Analysis</span>
          </button>

          {/* Upload SAR Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/40 text-xs font-mono font-semibold text-cyan-400 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload SAR</span>
          </button>

          {/* Forensic PDF Report */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-mono text-xs font-bold transition-all shadow-md disabled:opacity-70"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating...' : 'PDF Audit'}</span>
          </button>

          {/* IST Clock */}
          <div className="pl-3 border-l border-slate-800 text-right font-mono">
            <div className="text-xs font-bold text-cyan-400">{istTime}</div>
            <div className="text-[9.5px] text-slate-500">LIVE IST RADAR</div>
          </div>
        </div>

        {/* Mobile Action Controls & Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {/* Quick PDF button on mobile */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Download PDF Audit"
            className="p-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer / Action Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 p-4 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-top duration-200">
          {/* Sector Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" /> Target Maritime Sector:
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                onClick={() => {
                  onScenarioChange('arabian_sea');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center font-bold ${
                  activeScenario === 'arabian_sea'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                Mumbai High
              </button>
              <button
                onClick={() => {
                  onScenarioChange('bay_of_bengal');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center font-bold ${
                  activeScenario === 'bay_of_bengal'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-500'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                Chennai Sector
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 font-mono text-xs">
            <button
              onClick={() => {
                onOpenUploadModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-cyan-500/40 text-cyan-400 font-bold"
            >
              <Upload className="w-4 h-4" />
              <span>Upload SAR</span>
            </button>

            <button
              onClick={() => {
                onOpenForensicModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-bold"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>SAR Analysis</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
