"use client";

import { useState, useEffect } from "react";
import {
  LocalModelManager,
  MODEL_TIERS,
  type ModelTierId,
  type ModelTier,
} from "@/lib/modelManager";
import { detectSystemCapabilities, type SystemCapabilities } from "@/lib/capabilities";
import {
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  Zap,
  HardDrive,
  Cpu,
  X,
  Gauge,
  HelpCircle,
} from "lucide-react";

interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTier: ModelTierId;
  onSelectTier: (tierId: ModelTierId) => void;
}

export function ModelManagerModal({
  isOpen,
  onClose,
  selectedTier,
  onSelectTier,
}: ModelManagerModalProps) {
  const [caps, setCaps] = useState<SystemCapabilities | null>(null);
  const [cachedTiers, setCachedTiers] = useState<ModelTierId[]>([]);
  const [downloadingTier, setDownloadingTier] = useState<ModelTierId | null>(null);
  const [progress, setProgress] = useState(0);
  const [storage, setStorage] = useState({ usedMb: 0, totalQuotaMb: 5000 });

  useEffect(() => {
    if (isOpen) {
      detectSystemCapabilities().then(setCaps);
      LocalModelManager.getCachedModels().then(setCachedTiers);
      LocalModelManager.getStorageOverview().then(setStorage);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async (tierId: ModelTierId) => {
    setDownloadingTier(tierId);
    setProgress(0);

    // Simulated progress with chunked steps
    for (let p = 5; p <= 100; p += 15) {
      await new Promise((r) => setTimeout(r, 200));
      setProgress(p);
    }

    await LocalModelManager.markModelCached(tierId);
    setCachedTiers((prev) => [...prev, tierId]);
    setDownloadingTier(null);
    setProgress(0);
    const updatedStorage = await LocalModelManager.getStorageOverview();
    setStorage(updatedStorage);
  };

  const handleDelete = async (tierId: ModelTierId) => {
    await LocalModelManager.deleteModel(tierId);
    setCachedTiers((prev) => prev.filter((id) => id !== tierId));
    const updatedStorage = await LocalModelManager.getStorageOverview();
    setStorage(updatedStorage);
  };

  const tiers = LocalModelManager.getTiers();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">On-Device Model Manager</h2>
              <p className="text-xs text-zinc-400">
                100% private Whisper ASR running directly on your WebGPU or CPU via ONNX Runtime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Recommendation Banner */}
        {caps && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-amber-300">
                Auto-Detected Recommendation: {MODEL_TIERS[caps.recommendedTier].name}
              </span>
              <p className="text-zinc-400 mt-0.5">{caps.tierReason}</p>
            </div>
          </div>
        )}

        {/* Tier Cards List */}
        <div className="my-5 space-y-3.5 overflow-y-auto pr-1 flex-1">
          {tiers.map((tier) => {
            const isCached = cachedTiers.includes(tier.id);
            const isSelected = selectedTier === tier.id;
            const isDownloading = downloadingTier === tier.id;
            const isRecommended = caps?.recommendedTier === tier.id;

            return (
              <div
                key={tier.id}
                onClick={() => onSelectTier(tier.id)}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900/90 border-amber-500/60 shadow-lg shadow-amber-500/5"
                    : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white text-sm">{tier.name}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {tier.sizeMb} MB
                      </span>
                      {isRecommended && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Recommended
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active Selection
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">{tier.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 pt-1">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Zap className="w-3 h-3" /> WebGPU: {tier.expectedSpeedWebGPU}
                      </span>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Gauge className="w-3 h-3" /> WASM: {tier.expectedSpeedWasm}
                      </span>
                      <span className="text-zinc-500">RAM: ~{tier.recommendedRamGb}GB</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isDownloading ? (
                      <div className="flex flex-col items-end gap-1 min-w-[120px]">
                        <span className="text-xs text-amber-400 font-mono">Downloading {progress}%</span>
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all duration-200"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : isCached ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cached Locally
                        </span>
                        <button
                          onClick={() => handleDelete(tier.id)}
                          title="Delete from local cache"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(tier.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Download ({tier.sizeMb}MB)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Storage overview footer */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-zinc-500" />
            <span>
              Device Storage: <strong className="text-zinc-200">{storage.usedMb} MB</strong> used of{" "}
              <strong className="text-zinc-200">{(storage.totalQuotaMb / 1024).toFixed(1)} GB</strong> allocated quota
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
