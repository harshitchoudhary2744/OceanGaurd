import React, { useState, useEffect } from 'react';
import { Satellite, Upload, FileText, RefreshCw, Eye, Menu, X, Compass } from 'lucide-react';
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
  const [utcTime, setUtcTime] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setUtcTime(d.toUTCString().slice(17, 25) + ' UTC');
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
      <header className="h-16 tactical-glass border-b border-[#3b494c]/30 px-3 sm:px-6 flex items-center justify-between z-40 shrink-0 select-none">
        {/* Brand & Ticker */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/20 border border-[#00e5ff]/40 flex items-center justify-center text-[#00e5ff] shadow-sm shrink-0">
              <Satellite className="w-4 h-4" />
            </div>
            <span className="font-mono font-bold text-base sm:text-lg text-white tracking-wider">
              OCEANGUARD
            </span>
          </div>

          <span className="hidden xs:inline-block px-2 py-0.5 rounded bg-[#262a35] text-[#00daf3] border border-[#00daf3]/30 font-mono text-[11px] sm:text-xs font-semibold">
            INDIA EEZ
          </span>

          {/* Live Metocean Environmental Ticker */}
          <div className="hidden xl:flex items-center gap-2.5 ml-2 pl-3 border-l border-[#3b494c]/30 text-xs font-mono text-[#bac9cc]">
            <span className="text-[#00daf3]">💨 {metocean?.wind_speed_kts || 16.2} kts {metocean?.wind_cardinal || 'WSW'}</span>
            <span className="text-[#3b494c]">|</span>
            <span className="text-[#00e5ff]">🌊 {metocean?.current_speed_kts || 1.4} kts {metocean?.current_cardinal || 'ENE'}</span>
            <span className="text-[#3b494c]">|</span>
            <span className="text-[#ffb4ab]">🌡️ {metocean?.sea_surface_temp_c || 28.4}°C</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#bac9cc]">
            <span className="w-2 h-2 rounded-full bg-[#00daf3]"></span>
            <span>IN-AIS: 8,920 NODES</span>
          </div>
        </div>

        {/* Action Controls - Desktop */}
        <div className="hidden md:flex items-center gap-2.5 sm:gap-3">
          {/* India Scenario Switcher */}
          <div className="flex items-center bg-[#171b26] rounded-lg p-1 border border-[#3b494c]/40 text-xs font-mono">
            <button
              onClick={() => onScenarioChange('arabian_sea')}
              className={`px-2.5 py-1 rounded transition-all ${
                activeScenario === 'arabian_sea'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-sm'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              Mumbai Sector
            </button>
            <button
              onClick={() => onScenarioChange('bay_of_bengal')}
              className={`px-2.5 py-1 rounded transition-all ${
                activeScenario === 'bay_of_bengal'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-sm'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              Chennai Sector
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-[#1c1f2a] hover:bg-[#262a35] border border-[#3b494c]/30 text-[#bac9cc] hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00daf3]' : ''}`} />
          </button>

          {/* Forensic View Trigger */}
          <button
            onClick={onOpenForensicModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1f2a] hover:bg-[#262a35] border border-[#3b494c]/40 text-xs font-mono font-semibold text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#00daf3]" />
            <span>SAR Analysis</span>
          </button>

          {/* Upload SAR Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1c1f2a] hover:bg-[#262a35] border border-[#00daf3]/50 text-xs font-mono font-semibold text-[#00daf3] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload SAR</span>
          </button>

          {/* Forensic PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00e5ff] text-[#00363d] hover:bg-[#9cf0ff] font-mono text-xs font-bold transition-all shadow-sm disabled:opacity-70"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating...' : 'PDF Audit'}</span>
          </button>

          {/* Clock */}
          <div className="pl-3 border-l border-[#3b494c]/30 text-right font-mono">
            <div className="text-xs font-bold text-[#00daf3]">{utcTime}</div>
            <div className="text-[10px] text-[#849396]">LIVE RADAR</div>
          </div>
        </div>

        {/* Mobile Action Controls & Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {/* Quick PDF button on mobile */}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Download PDF Audit"
            className="p-2 rounded-lg bg-[#00e5ff] text-[#00363d] font-bold text-xs"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-[#1c1f2a] border border-[#3b494c]/30 text-[#bac9cc]"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00daf3]' : ''}`} />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#1c1f2a] border border-[#3b494c]/40 text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#ffb4ab]" /> : <Menu className="w-5 h-5 text-[#00daf3]" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer / Action Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-[#121622]/95 backdrop-blur-xl border-b border-[#3b494c]/40 p-4 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-top duration-200">
          {/* Sector Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-[#849396] uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#00daf3]" /> Target Maritime Sector:
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                onClick={() => {
                  onScenarioChange('arabian_sea');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center font-bold ${
                  activeScenario === 'arabian_sea'
                    ? 'bg-[#00e5ff] text-[#00363d] border-[#00e5ff]'
                    : 'bg-[#1c1f2a] text-[#bac9cc] border-[#3b494c]/30'
                }`}
              >
                Mumbai High (Arabian Sea)
              </button>
              <button
                onClick={() => {
                  onScenarioChange('bay_of_bengal');
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center font-bold ${
                  activeScenario === 'bay_of_bengal'
                    ? 'bg-[#00e5ff] text-[#00363d] border-[#00e5ff]'
                    : 'bg-[#1c1f2a] text-[#bac9cc] border-[#3b494c]/30'
                }`}
              >
                Chennai (Bay of Bengal)
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3b494c]/30 font-mono text-xs">
            <button
              onClick={() => {
                onOpenUploadModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#1c1f2a] border border-[#00daf3]/50 text-[#00daf3] font-bold"
            >
              <Upload className="w-4 h-4" />
              <span>Upload SAR</span>
            </button>

            <button
              onClick={() => {
                onOpenForensicModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#1c1f2a] border border-[#3b494c]/40 text-white font-bold"
            >
              <Eye className="w-4 h-4 text-[#00daf3]" />
              <span>SAR Analysis</span>
            </button>
          </div>

          {/* Time & Radar Node Info */}
          <div className="flex items-center justify-between pt-2 border-t border-[#3b494c]/30 text-xs font-mono text-[#849396]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse"></span>
              <span>Sentinel-1: ACTIVE</span>
            </div>
            <span className="font-bold text-[#00daf3]">{utcTime}</span>
          </div>
        </div>
      )}
    </>
  );
};
