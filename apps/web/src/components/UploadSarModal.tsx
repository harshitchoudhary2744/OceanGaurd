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
  const [selectedPreset, setSelectedPreset] = useState('scene-mumbai-alpha');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SARInferenceResponse | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      id: 'scene-mumbai-alpha',
      title: 'Sentinel-1A Mumbai High Sector Alpha',
      sceneId: 'S1A_IW_GRDH_1SDV_MUMBAI_HIGH_ALPHA',
      coords: [72.150, 19.050] as [number, number],
      desc: 'Offshore Tanker Fairway - Heavy Crude discharge detection'
    },
    {
      id: 'scene-jnpt-channel',
      title: 'Sentinel-1A JNPT Access Channel Approach',
      sceneId: 'S1A_IW_GRDH_1SDV_JNPT_CHANNEL',
      coords: [72.870, 18.895] as [number, number],
      desc: 'Deep Water Approach - Bilge sludge flush'
    },
    {
      id: 'scene-prongs-reef',
      title: 'Sentinel-1A Mumbai Outer Anchorage / Prongs Reef',
      sceneId: 'S1A_IW_GRDH_1SDV_PRONGS_REEF',
      coords: [72.795, 18.905] as [number, number],
      desc: 'Anchorage Bunkering Zone - Intermediate Fuel Oil breach'
    },
  ];

  const handleRun = async () => {
    setIsProcessing(true);
    setResult(null);

    const preset = presets.find((p) => p.id === selectedPreset) || presets[0];
    const formData = new FormData();
    formData.append('center_lon', preset.coords[0].toString());
    formData.append('center_lat', preset.coords[1].toString());
    formData.append('scene_id', preset.sceneId);

    try {
      const res = await uploadSarScene(formData);
      setResult(res);
      onDetectionComplete(res);
    } catch (e) {
      console.error("Upload error", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#111622] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Satellite className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-white">SAR Satellite Oil Slick Detection</h3>
              <p className="text-[11px] text-slate-400 font-mono">PyTorch U-Net Dark-Spot Semantic Segmentation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 font-mono text-xs">
          <div>
            <label className="text-slate-300 font-bold block mb-2">Select Mumbai Sentinel-1 Acquisition Pass:</label>
            <div className="flex flex-col gap-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset === preset.id
                      ? 'bg-slate-900 border-cyan-400 shadow-md ring-1 ring-cyan-400/30'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white text-xs">{preset.title}</span>
                    <span className="text-[10px] text-cyan-400 font-bold">{preset.coords[1]}°N, {preset.coords[0]}°E</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{preset.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Results View */}
          {result && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Detection & Segmentation Succeeded!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div>Spill ID: <strong className="text-white">{result.spill?.id}</strong></div>
                <div>Area: <strong className="text-rose-300">{result.spill?.area_sq_km} km²</strong></div>
                <div>Confidence: <strong className="text-emerald-400">{(result.spill?.confidence_score * 100).toFixed(1)}%</strong></div>
                <div>Primary Culprit: <strong className="text-white">{result.primary_suspect?.name || 'Correlating...'}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                <span>Running U-Net Inference...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze SAR Image</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
