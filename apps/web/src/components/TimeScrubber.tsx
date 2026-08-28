import React, { useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimeScrubberProps {
  timeOffsetMinutes: number; // -360 to 0
  onChangeTimeOffset: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  timeOffsetMinutes,
  onChangeTimeOffset,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}) => {
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onChangeTimeOffset((prev) => {
        if (prev >= 0) return -360;
        return Math.min(0, prev + 2 * playbackSpeed);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, onChangeTimeOffset]);

  const baseDate = new Date();
  const currentDate = new Date(baseDate.getTime() + timeOffsetMinutes * 60 * 1000);
  const formattedTime = currentDate.toUTCString().slice(17, 25) + ' UTC';

  const tMinusHours = Math.abs(Math.floor(timeOffsetMinutes / 60));
  const tMinusMins = Math.abs(timeOffsetMinutes % 60);
  const tMinusString = timeOffsetMinutes === 0
    ? 'T-00:00 (LIVE)'
    : `T-${tMinusHours.toString().padStart(2, '0')}:${tMinusMins.toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xl h-14 tactical-glass rounded-full flex items-center px-5 gap-3 z-30 shadow-2xl border border-[#00e5ff]/30 select-none">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="w-8 h-8 rounded-full bg-[#00e5ff] text-[#00363d] hover:bg-[#9cf0ff] flex items-center justify-center transition-all shadow-sm shrink-0"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <button
        onClick={() => onChangeTimeOffset(-360)}
        className="p-1.5 hover:bg-[#262a35] rounded-full text-[#849396] hover:text-white transition-colors shrink-0"
        title="Reset to -6h"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Slider */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={-360}
            max={0}
            step={5}
            value={timeOffsetMinutes}
            onChange={(e) => onChangeTimeOffset(Number(e.target.value))}
            className="w-full h-1 bg-[#262a35] rounded-lg appearance-none cursor-pointer accent-[#00e5ff]"
          />
          {/* Centroid Intercept Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#ff3b30] pointer-events-none"
            style={{ left: `${((-60 - -360) / 360) * 100}%` }}
            title="Estimated Spill Intercept"
          />
        </div>

        <div className="flex justify-between font-mono text-[9px] text-[#849396]">
          <span>T-06:00</span>
          <span className="text-[#ffb4ab] font-semibold">Intercept 22:45 UTC</span>
          <span className="text-[#00daf3] font-bold">{tMinusString}</span>
          <span>LIVE</span>
        </div>
      </div>

      {/* Time display */}
      <div className="pl-2 border-l border-[#3b494c]/30 text-right font-mono shrink-0">
        <span className="text-xs font-bold text-[#00daf3] block">{formattedTime}</span>
      </div>

      {/* Speed */}
      <div className="flex items-center bg-[#171b26] rounded p-0.5 border border-[#3b494c]/30 text-[10px] font-mono shrink-0">
        {[1, 2, 5].map((s) => (
          <button
            key={s}
            onClick={() => onChangeSpeed(s)}
            className={`px-1.5 py-0.5 rounded transition-all ${
              playbackSpeed === s ? 'bg-[#00e5ff] text-[#00363d] font-bold' : 'text-[#849396] hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
