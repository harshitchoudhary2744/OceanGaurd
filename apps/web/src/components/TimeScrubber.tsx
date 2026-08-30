import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { MUMBAI_INCIDENTS } from '../lib/simulationEngine';

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
  const currentIncident = MUMBAI_INCIDENTS[activeSpillId] || MUMBAI_INCIDENTS['INC-MUM-2024-01'];
  const interceptMinutes = currentIncident.dischargeOffsetMinutes; // e.g. -42, -30, -25, -20
  const interceptPercent = Math.max(0, Math.min(100, ((interceptMinutes - -360) / 360) * 100));

  const baseDate = new Date();
  const currentDate = new Date(baseDate.getTime() + timeOffsetMinutes * 60 * 1000);
  const formattedTime = currentDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
  const dateStr = currentDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  const absMins = Math.abs(timeOffsetMinutes);
  const tMinusHours = Math.floor(absMins / 60);
  const tMinusMins = absMins % 60;
  const tMinusString = timeOffsetMinutes === 0
    ? 'LIVE (T-0)'
    : `T-${tMinusHours.toString().padStart(2, '0')}:${tMinusMins.toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-14 sm:bottom-6 left-1/2 -translate-x-1/2 w-[94%] sm:w-[90%] max-w-xl h-12 sm:h-14 tactical-glass rounded-full flex items-center px-3 sm:px-5 gap-2 sm:gap-3 z-30 shadow-2xl border border-slate-700/50 select-none">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 flex items-center justify-center transition-all shadow-md shrink-0"
        aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline playback'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />}
      </button>

      <button
        onClick={() => onChangeTimeOffset(-360)}
        className="p-1 sm:p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors shrink-0"
        title="Reset to -6h (T-360m)"
        aria-label="Reset timeline to -6 hours"
      >
        <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </button>

      {/* Slider */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <div className="relative flex items-center">
          <input
            type="range"
            min={-360}
            max={0}
            step={2}
            value={timeOffsetMinutes}
            onChange={(e) => onChangeTimeOffset(Number(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Time playback position in minutes from live"
          />
          {/* Discharge Intercept Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white pointer-events-none shadow-rose-500 shadow-sm"
            style={{ left: `${interceptPercent}%` }}
            title={`${currentIncident.name} Breach Intercept (T${interceptMinutes}m)`}
          />
        </div>

        <div className="flex justify-between font-mono text-[8px] sm:text-[9px] text-slate-400 overflow-hidden">
          <span>T-06:00</span>
          <span
            className="hidden xs:inline text-rose-300 font-semibold cursor-pointer hover:text-white transition-colors"
            onClick={() => onChangeTimeOffset(interceptMinutes)}
            title="Click to jump to breach discharge point"
          >
            🎯 Breach: T{interceptMinutes}m ({currentIncident.culpritName})
          </span>
          <span className="text-cyan-300 font-bold">{tMinusString}</span>
          <span className="cursor-pointer hover:text-cyan-300" onClick={() => onChangeTimeOffset(0)}>LIVE</span>
        </div>
      </div>

      {/* Time display */}
      <div className="hidden xs:block pl-1.5 sm:pl-2 border-l border-slate-700/50 text-right font-mono shrink-0">
        <span className="text-[9px] text-slate-400 block leading-tight">{dateStr}</span>
        <span className="text-[10px] sm:text-xs font-bold text-cyan-400 block leading-tight">{formattedTime}</span>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center bg-slate-900/90 rounded p-0.5 border border-slate-800 text-[9px] sm:text-[10px] font-mono shrink-0">
        {[1, 2, 5].map((s) => (
          <button
            key={s}
            onClick={() => onChangeSpeed(s)}
            className={`px-1.5 py-0.5 rounded transition-all ${
              playbackSpeed === s ? 'bg-cyan-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
