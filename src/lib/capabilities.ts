export interface SystemCapabilities {
  webGpu: boolean;
  gpuRenderer?: string;
  webCodecs: boolean;
  webCodecsH264: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  opfs: boolean;
  deviceMemoryGb: number;
  cpuCores: number;
  storageQuotaMb: number;
  storageUsedMb: number;
  recommendedTier: "fast" | "balanced" | "best";
  tierReason: string;
}

export async function detectSystemCapabilities(): Promise<SystemCapabilities> {
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) {
    return {
      webGpu: false,
      webCodecs: false,
      webCodecsH264: false,
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      opfs: false,
      deviceMemoryGb: 8,
      cpuCores: 8,
      storageQuotaMb: 10000,
      storageUsedMb: 0,
      recommendedTier: "balanced",
      tierReason: "Default server environment estimation",
    };
  }

  // 1. WebGPU Detection
  let webGpu = false;
  let gpuRenderer: string | undefined = undefined;
  try {
    const nav = navigator as unknown as {
      gpu?: {
        requestAdapter: () => Promise<{
          requestAdapterInfo?: () => Promise<{
            vendor?: string;
            architecture?: string;
            description?: string;
          }>;
        } | null>;
      };
      deviceMemory?: number;
    };

    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        webGpu = true;
        try {
          if (typeof adapter.requestAdapterInfo === "function") {
            const info = await adapter.requestAdapterInfo();
            if (info) {
              gpuRenderer = `${info.vendor || ""} ${info.architecture || ""} ${info.description || ""}`.trim();
            }
          }
        } catch {
          gpuRenderer = "WebGPU Hardware Accelerator";
        }
      }
    }
  } catch (err) {
    console.warn("WebGPU capability check error:", err);
  }

  // 2. WebCodecs
  const webCodecs = typeof window.VideoEncoder !== "undefined" && typeof window.VideoDecoder !== "undefined";
  let webCodecsH264 = false;
  if (webCodecs) {
    try {
      const support = await window.VideoEncoder.isConfigSupported({
        codec: "avc1.4d002a", // H.264 Main Profile Level 4.2 (1080p60)
        width: 1080,
        height: 1920,
        bitrate: 5_000_000,
        framerate: 30,
      });
      webCodecsH264 = !!support.supported;
    } catch {
      webCodecsH264 = false;
    }
  }

  // 3. Multithreading / SAB
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const crossOriginIsolated = window.crossOriginIsolated === true;

  // 4. OPFS
  let opfs = false;
  try {
    opfs = typeof navigator.storage?.getDirectory === "function";
  } catch {
    opfs = false;
  }

  // 5. Hardware Specs
  const deviceMemoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const cpuCores = navigator.hardwareConcurrency || 4;

  // 6. Storage Quota
  let storageQuotaMb = 0;
  let storageUsedMb = 0;
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      storageQuotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
      storageUsedMb = Math.round((estimate.usage || 0) / (1024 * 1024));
    }
  } catch {
    storageQuotaMb = 5000;
  }

  // 7. Tier recommendation algorithm
  let recommendedTier: "fast" | "balanced" | "best" = "fast";
  let tierReason = "";

  if (webGpu && deviceMemoryGb >= 8 && cpuCores >= 8) {
    recommendedTier = "best";
    tierReason = "High-performance GPU detected with ample memory. Optimal for whisper-large-v3-turbo.";
  } else if (webGpu || (deviceMemoryGb >= 4 && cpuCores >= 4)) {
    recommendedTier = "balanced";
    tierReason = "WebGPU or solid multi-core CPU detected. Recommended for whisper-small (ideal Hinglish balance).";
  } else {
    recommendedTier = "fast";
    tierReason = "Lightweight hardware profile detected. Whisper-tiny/base will deliver fastest transcription.";
  }

  return {
    webGpu,
    gpuRenderer,
    webCodecs,
    webCodecsH264,
    sharedArrayBuffer,
    crossOriginIsolated,
    opfs,
    deviceMemoryGb,
    cpuCores,
    storageQuotaMb,
    storageUsedMb,
    recommendedTier,
    tierReason,
  };
}
