export type ModelTierId = "fast" | "balanced" | "best";

export interface ModelTier {
  id: ModelTierId;
  name: string;
  subTitle: string;
  hfModelId: string;
  sizeMb: number;
  expectedSpeedWebGPU: string;
  expectedSpeedWasm: string;
  recommendedRamGb: number;
  hinglishRating: "Good" | "High" | "Master";
  description: string;
  recommendedFor: string;
}

export interface DownloadProgress {
  tierId: ModelTierId;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  speedMbps: number;
  status: "idle" | "downloading" | "paused" | "verifying" | "ready" | "error";
  errorMessage?: string;
}

export const MODEL_TIERS: Record<ModelTierId, ModelTier> = {
  fast: {
    id: "fast",
    name: "Whisper Tiny",
    subTitle: "Instant Tier",
    hfModelId: "onnx-community/whisper-tiny",
    sizeMb: 39,
    expectedSpeedWebGPU: "15x real-time",
    expectedSpeedWasm: "4x real-time",
    recommendedRamGb: 2,
    hinglishRating: "Good",
    description: "Ultra-fast transcription ideal for quick reels, clear spoken audio, and budget hardware.",
    recommendedFor: "Older laptops, phones, quick edits",
  },
  balanced: {
    id: "balanced",
    name: "Whisper Base",
    subTitle: "Balanced Tier",
    hfModelId: "onnx-community/whisper-base",
    sizeMb: 145,
    expectedSpeedWebGPU: "10x - 14x real-time",
    expectedSpeedWasm: "3x real-time",
    recommendedRamGb: 4,
    hinglishRating: "High",
    description: "Solid transcription for standard spoken content with moderate accuracy.",
    recommendedFor: "Older hardware, quick draft edits",
  },
  best: {
    id: "best",
    name: "Whisper Small",
    subTitle: "High Accuracy Tier (Default & Recommended)",
    hfModelId: "onnx-community/whisper-small",
    sizeMb: 465,
    expectedSpeedWebGPU: "5x - 7x real-time",
    expectedSpeedWasm: "1.5x real-time",
    recommendedRamGb: 8,
    hinglishRating: "Master",
    description: "Industry-leading accuracy on nuanced Indian accents, regional dialects, and fast speech with frame-accurate word timestamps.",
    recommendedFor: "All creators, podcast clips, reels, frame-accurate synchronization",
  },
};

const STORAGE_KEY_PREFIX = "bolsub_model_";

export class LocalModelManager {
  private static cacheName = "bolsub-models-cache-v1";

  static getTiers(): ModelTier[] {
    return Object.values(MODEL_TIERS);
  }

  static getTier(id: ModelTierId): ModelTier {
    return MODEL_TIERS[id];
  }

  static async isModelCached(tierId: ModelTierId): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      // Check localStorage flag or Cache API
      const flag = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tierId}`);
      if (flag === "ready") return true;

      if ("caches" in window) {
        const cache = await caches.open(this.cacheName);
        const match = await cache.match(`/models/${tierId}/status`);
        return !!match;
      }
      return false;
    } catch {
      return false;
    }
  }

  static async getCachedModels(): Promise<ModelTierId[]> {
    const cached: ModelTierId[] = [];
    for (const key of Object.keys(MODEL_TIERS) as ModelTierId[]) {
      if (await this.isModelCached(key)) {
        cached.push(key);
      }
    }
    return cached;
  }

  static async markModelCached(tierId: ModelTierId): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tierId}`, "ready");
      if ("caches" in window) {
        const cache = await caches.open(this.cacheName);
        await cache.put(
          `/models/${tierId}/status`,
          new Response(JSON.stringify({ tierId, cachedAt: Date.now() }), {
            headers: { "Content-Type": "application/json" },
          })
        );
      }
    } catch (err) {
      console.warn("Error marking model as cached:", err);
    }
  }

  static async deleteModel(tierId: ModelTierId): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tierId}`);
      if ("caches" in window) {
        const cache = await caches.open(this.cacheName);
        await cache.delete(`/models/${tierId}/status`);
      }
    } catch (err) {
      console.warn("Error deleting model cache:", err);
    }
  }

  static async getStorageOverview(): Promise<{ usedMb: number; totalQuotaMb: number }> {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usedMb: Math.round((estimate.usage || 0) / (1024 * 1024)),
        totalQuotaMb: Math.round((estimate.quota || 0) / (1024 * 1024)),
      };
    }
    return { usedMb: 0, totalQuotaMb: 5000 };
  }
}
