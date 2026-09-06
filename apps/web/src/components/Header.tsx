import React, { useState, useEffect } from 'react';
import { Satellite, Upload, FileText, RefreshCw, Eye, Menu, X, ShieldAlert, Radio, ChevronDown, Bell } from 'lucide-react';
import { downloadPdfReportUrl } from '../lib/api';
import { SuspectVessel, SpillGeoFeature, MetoceanData } from '../types';
import { MUMBAI_INCIDENTS } from '../lib/simulationEngine';

interface HeaderProps {
  selectedSpillId: string;
  onSelectSpillId: (spillId: string) => void;
  spillFeature?: SpillGeoFeature | null;
  suspects?: SuspectVessel[];
  onOpenUploadModal: () => void;
  onOpenForensicModal: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  metocean?: MetoceanData;
  unreadAlertCount?: number;
  onOpenAlerts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSpillId,
  onSelectSpillId,
  spillFeature,
  suspects,
  onOpenUploadModal,
  onOpenForensicModal,
  onRefresh,
  isRefreshing,
  metocean,
  unreadAlertCount = 0,
  onOpenAlerts
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

  const currentIncident = MUMBAI_INCIDENTS[selectedSpillId] || MUMBAI_INCIDENTS["DARTIS-ow-0001"] || Object.values(MUMBAI_INCIDENTS)[0];

  return (
    <>
      <header className="h-16 tactical-glass border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between z-40 shrink-0 select-none">
        {/* Brand & Live Environmental Ticker */}
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
            EASTERN MEDITERRANEAN • CYPRUS LEVANTINE
          </span>

          {/* Live Environmental Ticker */}
          <div className="hidden xl:flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-800 text-xs font-mono text-slate-300">
            <span className="text-cyan-400">💨 {metocean?.wind_speed_kts || 16.2} kts {metocean?.wind_cardinal || 'WSW'}</span>
            <span className="text-slate-700">|</span>
            <span className="text-cyan-300">🌊 {metocean?.current_speed_kts || 1.4} kts {metocean?.current_cardinal || 'ENE'}</span>
          </div>
        </div>

        {/* Action Controls - Desktop */}
        <div className="hidden md:flex items-center gap-2.5 sm:gap-3">
          {/* Real-time Multi-Incident Selector */}
          <div className="relative flex items-center">
            <label htmlFor="incident-select" className="sr-only">Select Incident</label>
            <div className="flex items-center gap-2 bg-slate-900/90 rounded-lg px-2.5 py-1.5 border border-cyan-500/30 text-xs font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-slate-400 text-[11px] font-bold">INCIDENT:</span>
              <select
                id="incident-select"
                value={selectedSpillId}
                onChange={(e) => onSelectSpillId(e.target.value)}
                className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer pr-1 focus:text-white"
              >
                {Object.values(MUMBAI_INCIDENTS).map((inc) => (
                  <option key={inc.id} value={inc.id} className="bg-slate-900 text-slate-200">
                    {inc.name} ({inc.baseAreaSqKm} km²)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Sentinel-1 Stream Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-emerald-300 font-bold">S-1 STREAM:</span>
            <span className="text-white font-semibold">
              REAL-TIME (T{currentIncident.dischargeOffsetMinutes}m)
            </span>
          </div>

          {/* Emergency Alert Broadcast Bell */}
          <button
            onClick={onOpenAlerts}
            title="Emergency Broadcast Alerts"
            className={`relative p-2 rounded-lg border transition-all ${
              unreadAlertCount > 0
                ? 'bg-red-950/60 border-red-500/50 text-red-400 hover:bg-red-900/60 shadow-lg shadow-red-950/40'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Bell className={`w-4 h-4 ${unreadAlertCount > 0 ? 'animate-bounce' : ''}`} />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9.5px] font-extrabold text-white animate-pulse">
                {unreadAlertCount}
              </span>
            )}
          </button>

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
        <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
          {/* Mobile Alert Bell */}
          <button
            onClick={onOpenAlerts}
            title="Emergency Alerts"
            className="relative p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-red-400"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8.5px] font-bold text-white">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {/* Direct Incident Switcher on Mobile Header */}
          <select
            value={selectedSpillId}
            onChange={(e) => onSelectSpillId(e.target.value)}
            className="bg-slate-900 border border-cyan-500/40 text-cyan-300 font-bold text-[10.5px] font-mono px-2 py-1 rounded-lg outline-none max-w-[125px] truncate cursor-pointer"
            aria-label="Select incident on mobile"
          >
            {Object.values(MUMBAI_INCIDENTS).map((inc) => (
              <option key={inc.id} value={inc.id} className="bg-slate-900 text-slate-200">
                {inc.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Download PDF Audit"
            className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950/95 border-b border-slate-800 p-4 flex flex-col gap-3 font-mono text-xs z-30 animate-in slide-in-from-top-2">
          {/* Incident Selector on mobile */}
          <div className="flex flex-col gap-1">
            <span className="text-slate-400 font-bold">ACTIVE INCIDENT:</span>
            <select
              value={selectedSpillId}
              onChange={(e) => {
                onSelectSpillId(e.target.value);
                setMobileMenuOpen(false);
              }}
              className="bg-slate-900 border border-cyan-500/40 p-2 rounded text-cyan-300 font-bold"
            >
              {Object.values(MUMBAI_INCIDENTS).map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.name} ({inc.baseAreaSqKm} km²)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                onOpenForensicModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>SAR Analysis</span>
            </button>

            <button
              onClick={() => {
                onOpenUploadModal();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 p-2 rounded bg-slate-900 border border-cyan-500/40 text-cyan-400 font-bold"
            >
              <Upload className="w-4 h-4" />
              <span>Upload SAR</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 flex justify-between items-center">
            <span>CYPRUS EEZ: 14.2 kts W</span>
            <span className="text-cyan-400 font-bold">{istTime}</span>
          </div>
        </div>
      )}
    </>
  );
};
