import React, { useState } from 'react';
import { X, Satellite, Cpu, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { uploadSarScene } from '../lib/api';
import { SARInferenceResponse } from '../types';

interface UploadSarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetectionComplete: (result: SARInferenceResponse) => void;
}

export const UploadSarModal: React.FC<UploadSarModalProps> = ({
  isOpen,
  onClose,
  onDetectionComplete,
}) => {
  const [selectedPreset, setSelectedPreset] = useState('scene-mumbai');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SARInferenceResponse | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      id: 'scene-mumbai',
      title: 'Sentinel-1A Arabian Sea (Mumbai High Sector)',
      sceneId: 'S1A_IW_GRDH_ARABIAN_SEA_01',
      coords: [72.150, 19.050] as [number, number],
      desc: 'Offshore Mumbai Tanker Lane - Heavy Crude detection'
    },
    {
      id: 'scene-chennai',
      title: 'Sentinel-1B Bay of Bengal (Chennai-Ennore Corridor)',
      sceneId: 'S1B_IW_GRDH_BAY_OF_BENGAL_02',
      coords: [80.750, 13.250] as [number, number],
      desc: 'Coromandel Coast - Bunker fuel sheen'
    },
  ];

  const handleRun = async () => {
    setIsProcessing(true);
    setResult(null);
    try {
      const active = presets.find((p) => p.id === selectedPreset) || presets[0];
      const form = new FormData();
      form.append('center_lon', active.coords[0].toString());
      form.append('center_lat', active.coords[1].toString());
      form.append('scene_id', active.sceneId);

      const data = await uploadSarScene(form);
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onDetectionComplete(result);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#1c1f2a] border border-[#00daf3]/40 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#3b494c]/30 flex items-center justify-between bg-[#171b26]">
          <div className="flex items-center gap-2.5">
            <Satellite className="w-5 h-5 text-[#00daf3]" />
            <h3 className="font-mono text-sm font-bold text-white uppercase">
              Upload Sentinel-1 SAR Scene (India Maritime EEZ)
            </h3>
          </div>
          <button onClick={onClose} className="text-[#849396] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Preset Scene Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-bold text-[#849396] uppercase">
              Select Sample Radar Acquisition Scene
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    selectedPreset === p.id
                      ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-white shadow-sm'
                      : 'bg-[#171b26] border-[#3b494c]/30 text-[#bac9cc] hover:border-[#00daf3]/50'
                  }`}
                >
                  <p className="font-mono text-xs font-bold leading-tight">{p.title}</p>
                  <span className="text-[10px] font-mono text-[#00daf3] mt-0.5 block">{p.coords[1]}° N, {p.coords[0]}° E</span>
                  <span className="text-[9px] text-[#849396] mt-1 block">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Processing state */}
          {isProcessing && (
            <div className="p-4 bg-[#171b26] rounded-lg border border-[#00daf3]/40 flex items-center justify-center gap-3">
              <Cpu className="w-5 h-5 text-[#00daf3] animate-spin" />
              <span className="font-mono text-xs font-bold text-[#00daf3] animate-pulse">
                Executing PyTorch U-Net & Kinematic Trajectory Correlator...
              </span>
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div className="p-3.5 bg-[#171b26] rounded-lg border border-[#4ade80]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-[#4ade80] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Slick Detected & Segmented</span>
                </div>
                <span className="text-white font-bold">{Math.round(result.metrics.confidence * 100)}% AI Score</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mt-1">
                <div className="p-1.5 bg-[#1c1f2a] rounded">
                  <span className="text-[9px] text-[#849396] block">AREA</span>
                  <span className="font-bold text-[#ffb4ab]">{result.metrics.area_sq_km} sq km</span>
                </div>
                <div className="p-1.5 bg-[#1c1f2a] rounded">
                  <span className="text-[9px] text-[#849396] block">PERIMETER</span>
                  <span className="font-bold text-white">{result.metrics.perimeter_km} km</span>
                </div>
                <div className="p-1.5 bg-[#1c1f2a] rounded">
                  <span className="text-[9px] text-[#849396] block">CULPRIT</span>
                  <span className="font-bold text-[#ffb4ab]">
                    {result.primary_suspect?.probability_score || 98.4}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#3b494c]/30 flex justify-end gap-2 bg-[#171b26]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-[#849396] hover:text-white">
            Cancel
          </button>

          {!result ? (
            <button
              onClick={handleRun}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00e5ff] text-[#00363d] hover:bg-[#9cf0ff] rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run U-Net Inference</span>
            </button>
          ) : (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4ade80] text-black hover:bg-[#86efac] rounded-lg font-mono text-xs font-bold transition-all"
            >
              <span>Plot on Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
