import React, { useState, useMemo, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Radio,
  Navigation2,
  Satellite,
  Target,
  ChevronRight,
  ChevronLeft,
  ListOrdered,
  Clock,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Gauge,
  ZapOff,
  X
} from 'lucide-react';
import { MUMBAI_INCIDENTS, TimelineKeyEvent } from '../lib/simulationEngine';

interface TimeScrubberProps {
  timeOffsetMinutes: number; // -360 to 0
  onChangeTimeOffset: (offset: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  activeSpillId?: string;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  timeOffsetMinutes,
  onChangeTimeOffset,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  activeSpillId = 'DARTIS-ow-0001',
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineKeyEvent | null>(null);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState<boolean>(false);
  const currentIncident = MUMBAI_INCIDENTS[activeSpillId] || MUMBAI_INCIDENTS['DARTIS-ow-0001'] || Object.values(MUMBAI_INCIDENTS)[0];
  const events = currentIncident?.events || [];

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTimelineDrawer) {
        setShowTimelineDrawer(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTimelineDrawer]);

  // Base live timestamp reference
  const now = useMemo(() => new Date(), []);
  
  // Calculate formatted times for active scrubber position
  const activeDate = useMemo(() => new Date(now.getTime() + timeOffsetMinutes * 60 * 1000), [now, timeOffsetMinutes]);
  const activeTimeStr = activeDate.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC';
  
  const absMins = Math.abs(timeOffsetMinutes);
  const tMinusHours = Math.floor(absMins / 60);
  const tMinusMins = absMins % 60;
  const tMinusString = timeOffsetMinutes === 0
    ? 'LIVE (T-0)'
    : `T-${tMinusHours.toString().padStart(2, '0')}:${tMinusMins.toString().padStart(2, '0')}`;

  // Find current phase / event at or closest prior to scrubber position
  const activeEvent = useMemo(() => {
    const passed = events.filter((e) => timeOffsetMinutes >= e.tMinutes);
    if (passed.length > 0) return passed[passed.length - 1];
    return events[0];
  }, [events, timeOffsetMinutes]);

  // Jump to next/prev major anomaly keyframe
  const handlePrevEvent = () => {
    const prior = events.filter((e) => e.tMinutes < timeOffsetMinutes);
    if (prior.length > 0) {
      onChangeTimeOffset(prior[prior.length - 1].tMinutes);
    } else {
      onChangeTimeOffset(-360);
    }
  };

  const handleNextEvent = () => {
    const future = events.filter((e) => e.tMinutes > timeOffsetMinutes);
    if (future.length > 0) {
      onChangeTimeOffset(future[0].tMinutes);
    } else {
      onChangeTimeOffset(0);
    }
  };

  const getEventBadgeStyle = (type: TimelineKeyEvent['type']) => {
    switch (type) {
      case 'breach':
        return 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/30';
      case 'sar_detection':
        return 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/30';
      case 'anomaly_onset':
        return 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30';
      case 'live':
        return 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30';
      default:
        return 'bg-slate-800/80 border-slate-600 text-slate-300';
    }
  };

  const getEventPinStyle = (type: TimelineKeyEvent['type'], isSelected: boolean) => {
    switch (type) {
      case 'breach':
        return isSelected
          ? 'w-4 h-4 bg-rose-500 border-2 border-white shadow-[0_0_12px_#f43f5e] scale-125'
          : 'w-3 h-3 bg-rose-500 border border-white shadow-md hover:scale-125';
      case 'sar_detection':
        return isSelected
          ? 'w-3.5 h-3.5 bg-cyan-400 border-2 border-white shadow-[0_0_10px_#22d3ee] scale-125'
          : 'w-2.5 h-2.5 bg-cyan-400 border border-slate-900 shadow-md hover:scale-125';
      case 'anomaly_onset':
        return isSelected
          ? 'w-3.5 h-3.5 bg-amber-400 border-2 border-white shadow-[0_0_10px_#fbbf24] scale-125'
          : 'w-2.5 h-2.5 bg-amber-400 border border-slate-900 shadow-md hover:scale-125';
      case 'live':
        return isSelected
          ? 'w-3.5 h-3.5 bg-emerald-400 border-2 border-white shadow-[0_0_10px_#34d399] scale-125'
          : 'w-2.5 h-2.5 bg-emerald-400 border border-slate-900 shadow-md hover:scale-125';
      default:
        return 'w-2.5 h-2.5 bg-slate-500 border border-slate-800 hover:scale-125';
    }
  };

  // Dynamically extract top milestone points from active incident events in IST
  const trackMilestones = useMemo(() => {
    return events.map((evt) => ({
      tMinutes: evt.tMinutes,
      ist: evt.timestamp_ist || (evt.tMinutes === 0 ? '16:30 IST' : `T${evt.tMinutes}m`),
      label: evt.type === 'breach' ? 'BREACH' : evt.type === 'live' ? 'LIVE' : evt.label,
      isBreach: evt.type === 'breach',
      isLive: evt.type === 'live',
    }));
  }, [events]);

  return (
    <div className="w-full max-w-4xl mx-auto pointer-events-auto tactical-glass rounded-2xl flex flex-col p-2.5 sm:p-3.5 gap-2 shadow-2xl border border-slate-700/80 select-none backdrop-blur-md relative">
      
      {/* Top Status & Anomaly Event HUD Banner */}
      <div className="flex items-center justify-between px-1.5 sm:px-2 gap-2 text-xs font-mono border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold shrink-0 text-[11px] sm:text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden xs:inline">{currentIncident.name}</span>
            <span className="xs:hidden">Live Replay</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          {activeEvent && (
            <div className="flex items-center gap-1.5 truncate text-[10px] sm:text-[11px]">
              <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border ${getEventBadgeStyle(activeEvent.type)}`}>
                {activeEvent.icon} {activeEvent.action_headline || activeEvent.label}
              </span>
              <span className="text-slate-200 font-semibold truncate hidden md:inline">{activeEvent.title}</span>
              <span className="text-cyan-300 font-mono text-[10px] hidden lg:inline">({activeEvent.timestamp_ist || `${activeEvent.tMinutes}m`})</span>
            </div>
          )}
        </div>

        {/* Action Timeline Toggle Button & Current Playback Real Timestamp Readout */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Action Timeline Flow Button */}
          <button
            onClick={() => setShowTimelineDrawer(!showTimelineDrawer)}
            className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-mono font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
              showTimelineDrawer
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md ring-2 ring-cyan-500/30'
                : 'bg-slate-900/90 text-cyan-300 hover:text-white border-cyan-500/40 hover:bg-slate-800'
            }`}
            title="Toggle step-by-step Action Timeline with exact timestamps"
            aria-label="Toggle action timeline flow"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timeline</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-cyan-300 text-[9px] border border-cyan-500/30 font-mono">
              {events.length}
            </span>
            {showTimelineDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="text-right">
            <div className="text-[11px] sm:text-xs font-bold text-cyan-300 tracking-wider">
              {activeTimeStr}
            </div>
            <div className="text-[8.5px] sm:text-[9.5px] text-slate-400 font-medium">
              <span className="text-slate-300 font-mono">Indian Standard Time</span> • <span className="text-rose-400 font-bold">{tMinusString}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls & Interactive Keyframe Timeline Bar */}
      <div className="flex items-center gap-2 sm:gap-3 px-1">
        {/* Play/Pause & Reset Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
            aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline playback'}
            title={isPlaying ? 'Pause' : 'Play Replay'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => onChangeTimeOffset(-360)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            title="Reset to -6h start of track"
            aria-label="Reset timeline to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePrevEvent}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
            title="Jump to Previous Anomaly Event"
            aria-label="Previous Anomaly Event"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleNextEvent}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
            title="Jump to Next Anomaly Event"
            aria-label="Next Anomaly Event"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timeline Slider with Dedicated Visible Timestamps Directly Along the Bar */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 relative">
          {/* Top Timestamps Row Directly on the Bar Track - DYNAMICALLY ALIGNED WITH INCIDENT IN IST */}
          <div className="flex justify-between items-center text-[9.5px] font-mono text-slate-400 font-bold px-1 select-none overflow-x-auto no-scrollbar gap-1">
            {trackMilestones.map((m) => (
              <button
                key={m.tMinutes}
                onClick={() => onChangeTimeOffset(m.tMinutes)}
                className={`px-1.5 py-0.5 rounded border shadow-sm transition-all whitespace-nowrap cursor-pointer ${
                  m.isBreach
                    ? 'text-rose-300 bg-rose-950/90 border-rose-500/60 font-bold animate-pulse'
                    : m.isLive
                    ? 'text-cyan-300 bg-cyan-950/90 border-cyan-500/60 font-bold'
                    : 'text-slate-400 bg-slate-900/90 border-slate-800 hover:text-white'
                }`}
                title={`Jump to ${m.ist} (${m.label})`}
              >
                {m.ist} <span className="text-[8.5px] opacity-80">({m.label})</span>
              </button>
            ))}
          </div>

          <div className="relative flex items-center h-7">
            {/* Background Track with Gradient for Breach Zone */}
            <div className="absolute inset-x-0 h-2 bg-slate-900/95 rounded-full border border-slate-700/80 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-slate-700 via-amber-500/60 via-rose-500/90 to-cyan-400 transition-all shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                style={{ width: `${((timeOffsetMinutes - -360) / 360) * 100}%` }}
              />
            </div>

            {/* Native Slider Input for Scrubbing */}
            <input
              type="range"
              min={-360}
              max={0}
              step={1}
              value={timeOffsetMinutes}
              onChange={(e) => onChangeTimeOffset(Number(e.target.value))}
              className="w-full h-6 opacity-0 z-20 cursor-pointer absolute inset-0"
              aria-label="Time playback position in minutes from live"
            />

            {/* Embedded Keyframe Event Markers on the Track */}
            {events.map((evt) => {
              const leftPercent = ((evt.tMinutes - -360) / 360) * 100;
              const isSelected = Math.abs(timeOffsetMinutes - evt.tMinutes) <= 4;

              return (
                <div
                  key={evt.tMinutes}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group pointer-events-none"
                  style={{ left: `${leftPercent}%` }}
                >
                  {/* Pin element */}
                  <div
                    className={`rounded-full transition-transform flex items-center justify-center ${getEventPinStyle(evt.type, isSelected)}`}
                  />

                  {/* Pulsing ring on Breach keyframe */}
                  {evt.type === 'breach' && (
                    <span className="absolute inset-0 -m-1.5 rounded-full border border-rose-500 animate-ping pointer-events-none" />
                  )}
                </div>
              );
            })}

            {/* Floating Current Time Marker Needle Follower */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center -translate-x-1/2 transition-all duration-75"
              style={{ left: `${((timeOffsetMinutes - -360) / 360) * 100}%` }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#22d3ee] mt-1.5 scale-110" />
            </div>
          </div>

          {/* Keyframe Labels & Clickable Exact-Timestamp Event Chips Underneath */}
          <div className="flex justify-between items-center font-mono text-[9.5px] text-slate-400 overflow-x-auto gap-1 py-0.5 no-scrollbar">
            {events.map((evt) => {
              const isCurrent = Math.abs(timeOffsetMinutes - evt.tMinutes) <= 6;
              return (
                <button
                  key={evt.tMinutes}
                  onClick={() => onChangeTimeOffset(evt.tMinutes)}
                  className={`px-2 py-0.5 rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400 shadow-md scale-105 ring-1 ring-cyan-400/40'
                      : 'hover:bg-slate-800/80 hover:text-slate-200 text-slate-400 bg-slate-900/60 border border-slate-800'
                  }`}
                  title={`${evt.title} (${evt.timestamp_ist || `T${evt.tMinutes}m`})`}
                >
                  <span>{evt.icon}</span>
                  <span className="font-semibold">{evt.action_headline || evt.label}</span>
                  <span className="text-[8.5px] text-cyan-400 font-mono font-bold">
                    {evt.timestamp_ist ? evt.timestamp_ist : (evt.tMinutes === 0 ? 'LIVE' : `T${evt.tMinutes}m`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Speed Selector (1x, 2x, 5x) */}
        <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-[10px] font-mono shrink-0 gap-0.5">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                playbackSpeed === s
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* EXPANDABLE ACTION TIMELINE FLOW DRAWER (EXACT TIMESTAMPS & FLOW) */}
      {/* ============================================================== */}
      {showTimelineDrawer && (
        <div className="mt-2 pt-2 border-t border-slate-800/90 flex flex-col gap-2 font-mono animate-in fade-in slide-in-from-top-2">
          {/* Drawer Header with Prominent Close Button */}
          <div className="flex items-center justify-between px-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
              <span>ACTION TIMELINE FLOW • EXACT CHRONOLOGY (IST)</span>
            </span>
            <button
              onClick={() => setShowTimelineDrawer(false)}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Close Timeline Drawer (Esc)"
              aria-label="Close Timeline Drawer"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Close Timeline</span>
            </button>
          </div>

          {/* Scrollable Event Node Chain */}
          <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 shadow-inner max-h-[360px] overflow-y-auto pr-1">
            {events.map((evt, idx) => {
              const isCurrent = Math.abs(timeOffsetMinutes - evt.tMinutes) <= 6;
              const isBreach = evt.type === 'breach';
              const isSar = evt.type === 'sar_detection';

              return (
                <React.Fragment key={evt.tMinutes}>
                  {/* Event Card Node */}
                  <div
                    onClick={() => onChangeTimeOffset(evt.tMinutes)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 relative ${
                      isCurrent
                        ? 'bg-slate-900 border-cyan-400 shadow-lg ring-2 ring-cyan-400/40 scale-[1.01]'
                        : isBreach
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/40'
                        : isSar
                        ? 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {/* Header Row: Timestamp + Action Headline + Type Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {/* Glowing Active Indicator */}
                        <div className="flex items-center justify-center shrink-0">
                          {isCurrent ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                          ) : (
                            <span className="text-base">{evt.icon}</span>
                          )}
                        </div>

                        {/* Exact Timestamps in IST */}
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-white text-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            timeline {evt.timestamp_ist || `${Math.abs(evt.tMinutes)}m ago`}
                          </span>
                        </div>

                        {/* Action Headline */}
                        <span className="font-bold text-cyan-200 text-xs truncate">
                          {evt.action_headline}
                        </span>
                      </div>

                      {/* Right Tag / Speed Indicator */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-300 font-semibold hidden sm:inline">
                          {evt.speed.toFixed(1)} kts
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9.5px] font-bold border ${getEventBadgeStyle(
                            evt.type
                          )}`}
                        >
                          {evt.label}
                        </span>
                      </div>
                    </div>

                    {/* Subtext & Details */}
                    <div className="text-[10px] text-slate-300 pl-6 leading-relaxed flex items-center justify-between">
                      <span>{evt.details}</span>
                      <span className="text-[9px] text-slate-400 font-mono hidden md:inline shrink-0 ml-2">
                        GPS: {evt.coordinates[1].toFixed(3)}°N, {evt.coordinates[0].toFixed(3)}°E
                      </span>
                    </div>
                  </div>

                  {/* Downward Connecting Flow Arrow (↓) between steps */}
                  {idx < events.length - 1 && (
                    <div className="flex items-center justify-center py-0.5 text-cyan-400/80">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-400/70">
                        <span>↓</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Bottom Close Button in Drawer */}
            <div className="flex justify-center pt-2 pb-1 border-t border-slate-800/80 mt-1">
              <button
                onClick={() => setShowTimelineDrawer(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-mono text-[11px] font-bold border border-slate-700 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Close Timeline Drawer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Detailed Keyframe Tooltip on Hover */}
      {hoveredEvent && !showTimelineDrawer && (
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-cyan-500/60 rounded-xl p-2.5 shadow-2xl z-40 max-w-sm w-[90%] font-mono pointer-events-none backdrop-blur-md">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1 mb-1">
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <span>{hoveredEvent.icon}</span>
              <span>{hoveredEvent.action_headline || hoveredEvent.title}</span>
            </span>
            <span className="text-rose-400 font-bold text-[10px]">
              {hoveredEvent.timestamp_ist || `T${hoveredEvent.tMinutes}m`}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 leading-tight">
            {hoveredEvent.details}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 pt-1 mt-1 border-t border-slate-900">
            <span>Speed: {hoveredEvent.speed.toFixed(1)} kts</span>
            <span>GPS: {hoveredEvent.coordinates[1].toFixed(3)}°N, {hoveredEvent.coordinates[0].toFixed(3)}°E</span>
          </div>
        </div>
      )}
    </div>
  );
};



