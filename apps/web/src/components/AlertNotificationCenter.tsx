import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Info,
  X,
  Volume2,
  VolumeX,
  Navigation,
  Clock,
  ExternalLink,
  CheckCircle2,
  Radio,
  ChevronRight,
  Filter,
  Eye
} from 'lucide-react';
import { DashboardAlert, MaritimeAssetCategory } from '../types';

interface AlertNotificationCenterProps {
  alerts: DashboardAlert[];
  isOpen: boolean;
  onClose: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onAcknowledgeAll: () => void;
  onAlertAction: (actionType: string, actionValue: any, alert: DashboardAlert) => void;
}

export const AlertNotificationCenter: React.FC<AlertNotificationCenterProps> = ({
  alerts,
  isOpen,
  onClose,
  onAcknowledgeAlert,
  onAcknowledgeAll,
  onAlertAction,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'ASSETS'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play synthesized emergency chime for new critical alerts
  const playAlertSound = (severity: 'CRITICAL' | 'WARNING' | 'INFO') => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (severity === 'CRITICAL') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Filtered alerts
  const filteredAlerts = alerts.filter((alt) => {
    if (selectedFilter === 'CRITICAL') return alt.severity === 'CRITICAL';
    if (selectedFilter === 'WARNING') return alt.severity === 'WARNING';
    if (selectedFilter === 'ASSETS') {
      return ['fishing_zone', 'fishing_harbour', 'aquaculture', 'coastal_community'].includes(alt.category);
    }
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.acknowledged).length;

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'fishing_zone':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">🟢 Fishing Zone</span>;
      case 'fishing_harbour':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-500/30">🔵 Fishing Harbour</span>;
      case 'aquaculture':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-400 border border-purple-500/30">🟣 Aquaculture</span>;
      case 'coastal_community':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950/80 text-orange-400 border border-orange-500/30">🟠 Coastal Community</span>;
      case 'oil_spill':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-500/30">🔴 Oil Spill</span>;
      case 'vessel_violation':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/30">🚨 AIS Breach</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">⚡ Alert</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#070b14]/95 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100 animate-slideLeft">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <Radio className="w-5 h-5 animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide text-white">Emergency Alert Broadcast</h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  LIVE FEED
                </span>
              </div>
              <p className="text-xs text-slate-400">Automated multi-hazard coastal and AIS breach notifications</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts"}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? "bg-slate-800/80 border-slate-700 text-cyan-400 hover:bg-slate-700"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills & Actions Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'CRITICAL', 'WARNING', 'ASSETS'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedFilter === filter
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {filter === 'ALL' && `All (${alerts.length})`}
                {filter === 'CRITICAL' && `🔴 Critical (${alerts.filter(a => a.severity === 'CRITICAL').length})`}
                {filter === 'WARNING' && `🟠 Warning (${alerts.filter(a => a.severity === 'WARNING').length})`}
                {filter === 'ASSETS' && `Assets (${alerts.filter(a => ['fishing_zone', 'fishing_harbour', 'aquaculture', 'coastal_community'].includes(a.category)).length})`}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onAcknowledgeAll}
              className="text-xs font-semibold text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-400" />
              <p className="text-sm font-medium">No active alerts for the selected filter.</p>
              <p className="text-xs text-slate-600 mt-1">All maritime sectors operating within normal baseline.</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isCritical = alert.severity === 'CRITICAL';
              const isWarning = alert.severity === 'WARNING';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    alert.acknowledged
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                      : isCritical
                      ? 'bg-red-950/20 border-red-500/40 shadow-lg shadow-red-950/30 ring-1 ring-red-500/20'
                      : isWarning
                      ? 'bg-orange-950/20 border-orange-500/30 shadow-md ring-1 ring-orange-500/20'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(alert.category)}
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isCritical
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : isWarning
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 text-xs shrink-0">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="font-mono text-[11px]">{alert.timestamp_ist}</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mb-1 leading-snug">{alert.title}</h3>
                  <p className="text-xs text-slate-300/90 leading-relaxed mb-3">{alert.message}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 gap-2">
                    <div className="flex items-center gap-2">
                      {alert.action_type && alert.action_label ? (
                        <button
                          onClick={() => {
                            onAlertAction(alert.action_type!, alert.action_value ?? alert.coordinates, alert);
                            onAcknowledgeAlert(alert.id);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all"
                        >
                          <Navigation className="w-3 h-3 text-cyan-400" />
                          {alert.action_label}
                        </button>
                      ) : alert.coordinates ? (
                        <button
                          onClick={() => {
                            onAlertAction('focus_map', alert.coordinates, alert);
                            onAcknowledgeAlert(alert.id);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all"
                        >
                          <Navigation className="w-3 h-3 text-cyan-400" />
                          Locate on Map
                        </button>
                      ) : null}
                    </div>

                    {!alert.acknowledged ? (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-600" />
                        Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Active Indian EEZ Surveillance • INCOIS / Coast Guard Sync</span>
          <span className="text-cyan-400 font-mono">IST (UTC+5:30)</span>
        </div>
      </div>
    </div>
  );
};

// Floating Emergency Alert Banner Component for Tactical Map HUD
interface FloatingAlertBannerProps {
  alert: DashboardAlert | null;
  onDismiss: () => void;
  onAction: (actionType: string, actionValue: any, alert: DashboardAlert) => void;
  onOpenDrawer: () => void;
}

export const FloatingAlertBanner: React.FC<FloatingAlertBannerProps> = ({
  alert,
  onDismiss,
  onAction,
  onOpenDrawer,
}) => {
  if (!alert) return null;

  const isCritical = alert.severity === 'CRITICAL';

  return (
    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 w-auto max-w-[92vw] sm:max-w-md md:max-w-lg select-none pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
      <div
        className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-2.5 sm:gap-3 transition-all ${
          isCritical
            ? 'bg-[#140609]/95 border-red-500/50 text-red-100 shadow-red-950/70 ring-1 ring-red-500/30'
            : 'bg-[#150e05]/95 border-amber-500/50 text-amber-100 shadow-amber-950/70 ring-1 ring-amber-500/30'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center ${
              isCritical
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 leading-none">
              <span
                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                  isCritical
                    ? 'bg-red-500/30 text-red-200 border border-red-500/40'
                    : 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                }`}
              >
                {alert.severity}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{alert.timestamp_ist}</span>
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-white truncate mt-0.5 max-w-[140px] xs:max-w-[200px] sm:max-w-xs leading-tight">
              {alert.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {alert.action_type && alert.action_label && (
            <button
              onClick={() => onAction(alert.action_type!, alert.action_value ?? alert.coordinates, alert)}
              className="px-2 py-1 rounded-md text-[10.5px] font-bold bg-white text-slate-950 hover:bg-slate-100 shadow-md transition-all flex items-center gap-1 active:scale-95 whitespace-nowrap"
            >
              <Navigation className="w-2.5 h-2.5 text-red-600 shrink-0" />
              <span>{alert.action_label}</span>
            </button>
          )}
          <button
            onClick={onOpenDrawer}
            title="View All Alerts"
            className="p-1 rounded-md bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white border border-white/10 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="p-1 rounded-md bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white border border-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
