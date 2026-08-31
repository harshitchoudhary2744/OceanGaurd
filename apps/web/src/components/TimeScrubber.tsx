import React, { useState, useMemo } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Radio, Navigation2, Satellite, Target, ChevronRight, ChevronLeft } from 'lucide-react';
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
  activeSpillId = 'INC-MUM-2024-01',
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineKeyEvent | null>(null);
  const currentIncident = MUMBAI_INCIDENTS[activeSpillId] || MUMBAI_INCIDENTS['INC-MUM-2024-01'];
  const events = currentIncident.events || [];

  // Base live timestamp reference
  const now = useMemo(() => new Date(), []);
  
  // Calculate formatted times for active scrubber position
  const activeDate = useMemo(() => new Date(now.getTime() + timeOffsetMinutes * 60 * 1000), [now, timeOffsetMinutes]);
  const activeTimeStr = activeDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
  const activeDateStr = activeDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  
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

  return (
    <div className="w-full max-w-[720px] mx-auto pointer-events-auto tactical-glass rounded-2xl flex flex-col p-2 sm:p-3 gap-1.5 shadow-2xl border border-slate-700/70 select-none backdrop-blur-md">
      
      {/* Top Status & Anomaly Event HUD Banner */}
      <div className="flex items-center justify-between px-1.5 sm:px-2 gap-2 text-xs font-mono border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-cyan-400 font-bold shrink-0 text-[11px] sm:text-xs">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{currentIncident.name}</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          {activeEvent && (
            <div className="flex items-center gap-1.5 truncate text-[10px] sm:text-[11px]">
              <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border ${getEventBadgeStyle(activeEvent.type)}`}>
                {activeEvent.icon} {activeEvent.label} ({activeEvent.tMinutes === 0 ? 'LIVE' : `T${activeEvent.tMinutes}m`})
              </span>
              <span className="text-slate-200 font-semibold truncate hidden md:inline">{activeEvent.title}</span>
              <span className="text-slate-400 text-[10px] hidden lg:inline">({activeEvent.speed.toFixed(1)} kts • {activeEvent.coordinates[1].toFixed(3)}°N, {activeEvent.coordinates[0].toFixed(3)}°E)</span>
            </div>
          )}
        </div>

        {/* Current Playback Real Timestamp Readout */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-[10px] sm:text-xs font-bold text-cyan-300 tracking-wider">
              {activeTimeStr}
            </div>
            <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium">
              {activeDateStr} • <span className="text-rose-400 font-bold">{tMinusString}</span>
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
            className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
            aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline playback'}
            title={isPlaying ? 'Pause' : 'Play Replay'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => onChangeTimeOffset(-360)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
            title="Reset to -6h start of track"
            aria-label="Reset timeline to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePrevEvent}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
            title="Jump to Previous Anomaly Event"
            aria-label="Previous Anomaly Event"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleNextEvent}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
            title="Jump to Next Anomaly Event"
            aria-label="Next Anomaly Event"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timeline Slider with Embedded Major Event Pins */}
        <div className="flex-1 flex flex-col gap-1 min-w-0 relative">
          <div className="relative flex items-center h-6">
            {/* Background Track with Gradient for Breach Zone */}
            <div className="absolute inset-x-0 h-1.5 bg-slate-900 rounded-full border border-slate-700/80 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-slate-700 via-amber-500/40 via-rose-500/80 to-cyan-400 transition-all"
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
              className="w-full h-4 opacity-0 z-20 cursor-pointer absolute inset-0"
              aria-label="Time playback position in minutes from live"
            />

            {/* Embedded Keyframe Event Markers on the Track */}
            {events.map((evt) => {
              const leftPercent = ((evt.tMinutes - -360) / 360) * 100;
              const isSelected = Math.abs(timeOffsetMinutes - evt.tMinutes) <= 3;
              const evtDate = new Date(now.getTime() + evt.tMinutes * 60 * 1000);
              const evtTimeStr = evtDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';

              return (
                <div
                  key={evt.tMinutes}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 group"
                  style={{ left: `${leftPercent}%` }}
                >
                  {/* Pin element */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeTimeOffset(evt.tMinutes);
                    }}
                    onMouseEnter={() => setHoveredEvent(evt)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    className={`rounded-full transition-transform cursor-pointer flex items-center justify-center ${getEventPinStyle(evt.type, isSelected)}`}
                    aria-label={`Jump to ${evt.title}`}
                  />

                  {/* Pulsing ring on Breach keyframe */}
                  {evt.type === 'breach' && (
                    <span className="absolute inset-0 -m-1 rounded-full border border-rose-500 animate-ping pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Keyframe Labels & Clickable Event Tags Underneath */}
          <div className="flex justify-between items-center font-mono text-[9px] text-slate-400 overflow-x-auto gap-1 py-0.5 no-scrollbar">
            {events.map((evt) => {
              const isCurrent = Math.abs(timeOffsetMinutes - evt.tMinutes) <= 8;
              return (
                <button
                  key={evt.tMinutes}
                  onClick={() => onChangeTimeOffset(evt.tMinutes)}
                  className={`px-1.5 py-0.5 rounded transition-all whitespace-nowrap flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-cyan-500/50 shadow-sm'
                      : 'hover:bg-slate-800/60 hover:text-slate-200 text-slate-400'
                  }`}
                  title={`${evt.title} (${evt.tMinutes === 0 ? 'LIVE' : `T${evt.tMinutes}m`})`}
                >
                  <span>{evt.icon}</span>
                  <span>{evt.label}</span>
                  <span className="text-[8px] opacity-75">
                    ({evt.tMinutes === 0 ? '0m' : `T${evt.tMinutes}m`})
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
              className={`px-2 py-1 rounded transition-all ${
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

      {/* Floating Detailed Keyframe Tooltip on Hover */}
      {hoveredEvent && (
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-cyan-500/60 rounded-xl p-2.5 shadow-2xl z-40 max-w-sm w-[90%] font-mono pointer-events-none backdrop-blur-md">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1 mb-1">
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <span>{hoveredEvent.icon}</span>
              <span>{hoveredEvent.title}</span>
            </span>
            <span className="text-rose-400 font-bold text-[10px]">
              {hoveredEvent.tMinutes === 0 ? 'LIVE' : `T${hoveredEvent.tMinutes}m`}
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

