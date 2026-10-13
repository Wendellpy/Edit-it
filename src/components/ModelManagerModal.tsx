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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[6px_6px_0px_var(--border-main)] overflow-hidden max-h-[90vh] flex flex-col text-[var(--text-main)]">
        {/* Header */}
        <div className="p-5 border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-lime)] border-2 border-[var(--border-main)] flex items-center justify-center text-[#142218] shadow-[2px_2px_0px_var(--border-main)]">
              <Cpu className="w-5 h-5 text-[#142218]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
                  On-Device Model Manager
                </h2>
                <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] text-[9px] py-0.5 px-2">
                  100% Private WebGPU
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                Local Whisper speech-to-text models running in your browser sandbox with ONNX Runtime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer hover:bg-[var(--bg-panel)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* System Recommendation Banner */}
        {caps && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-start gap-3">
            <div className="p-1 rounded-md bg-[var(--accent-lime)] text-[#142218] shrink-0 mt-0.5 border border-[var(--border-main)]">
              <Sparkles className="w-3.5 h-3.5 text-[#142218]" />
            </div>
            <div className="text-xs">
              <span className="font-extrabold text-[var(--text-main)] block">
                Hardware Recommendation: {MODEL_TIERS[caps.recommendedTier].name}
              </span>
              <p className="text-[var(--text-muted)] mt-0.5 font-medium">{caps.tierReason}</p>
            </div>
          </div>
        )}

        {/* Tier Cards List */}
        <div className="my-4 px-5 space-y-3 overflow-y-auto flex-1">
          {tiers.map((tier) => {
            const isCached = cachedTiers.includes(tier.id);
            const isSelected = selectedTier === tier.id;
            const isDownloading = downloadingTier === tier.id;
            const isRecommended = caps?.recommendedTier === tier.id;

            return (
              <div
                key={tier.id}
                onClick={() => onSelectTier(tier.id)}
                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[var(--bg-panel)] border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                    : "bg-[var(--bg-card)] border-[var(--border-main)] hover:bg-[var(--bg-panel)]/50 shadow-[2px_2px_0px_var(--border-main)]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-fraunces italic font-bold text-[var(--text-main)] text-sm">
                        {tier.name}
                      </h3>
                      <span className="neo-pill bg-[var(--bg-panel)] text-[var(--text-main)] text-[10px] py-0 px-2">
                        {tier.sizeMb} MB
                      </span>
                      {isRecommended && (
                        <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] text-[10px] py-0 px-2 flex items-center gap-1 font-bold">
                          <Sparkles className="w-2.5 h-2.5" /> Recommended
                        </span>
                      )}
                      {isSelected && (
                        <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] text-[10px] py-0 px-2 font-black">
                          Active Tier
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-medium">{tier.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--text-muted)] pt-0.5">
                      <span className="flex items-center gap-1 text-[var(--text-main)] font-semibold">
                        <Zap className="w-3 h-3 text-[var(--accent-lime)] stroke-[3]" /> WebGPU: {tier.expectedSpeedWebGPU}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Gauge className="w-3 h-3 text-[var(--text-muted)]" /> WASM: {tier.expectedSpeedWasm}
                      </span>
                      <span className="font-mono text-[10px]">RAM: ~{tier.recommendedRamGb}GB</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isDownloading ? (
                      <div className="flex flex-col items-end gap-1.5 min-w-[130px]">
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--text-main)]">
                          <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] text-[9px] py-0 px-1.5">
                            {progress}%
                          </span>
                          <span>Downloading...</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border-main)] overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-[var(--accent-lime)] transition-all duration-200"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : isCached ? (
                      <div className="flex items-center gap-2">
                        <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] font-bold text-xs py-1 px-2.5 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" /> Cached Locally
                        </span>
                        <button
                          onClick={() => handleDelete(tier.id)}
                          title="Delete from local cache"
                          className="p-1.5 rounded-lg border-2 border-transparent hover:border-[var(--border-main)] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(tier.id)}
                        className="neo-btn text-xs px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#142218] stroke-[2.5]" /> Download ({tier.sizeMb}MB)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Storage overview footer */}
        <div className="p-4 border-t-2 border-[var(--border-main)] bg-[var(--bg-panel)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[var(--text-main)]" />
            <span>
              Device Storage: <strong className="text-[var(--text-main)] font-mono font-bold">{storage.usedMb} MB</strong> used of{" "}
              <strong className="text-[var(--text-main)] font-mono font-bold">{(storage.totalQuotaMb / 1024).toFixed(1)} GB</strong> allocated quota
            </span>
          </div>
          <button
            onClick={onClose}
            className="neo-btn-secondary px-4 py-1.5 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
