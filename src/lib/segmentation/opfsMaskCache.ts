import type { SegmentationMaskFrame, SubjectMetrics } from "./types";

interface SerializedHeader {
  timestamp: number;
  width: number;
  height: number;
  metrics: SubjectMetrics;
}

export class OpfsMaskCache {
  private static instance: OpfsMaskCache;
  private memoryFallback: Map<string, SegmentationMaskFrame> = new Map();
  private rootDir: any = null;
  private isOpfsSupported: boolean = false;

  private constructor() {
    this.checkOpfsSupport();
  }

  static getInstance(): OpfsMaskCache {
    if (!OpfsMaskCache.instance) {
      OpfsMaskCache.instance = new OpfsMaskCache();
    }
    return OpfsMaskCache.instance;
  }

  private async checkOpfsSupport(): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.getDirectory === "function") {
      try {
        this.rootDir = await navigator.storage.getDirectory();
        this.isOpfsSupported = true;
        return true;
      } catch {
        this.isOpfsSupported = false;
        return false;
      }
    }
    this.isOpfsSupported = false;
    return false;
  }

  private makeKey(videoHash: string, timestamp: number): string {
    // Quantize timestamp to 2 decimal places (~10ms precision)
    const quant = Math.round(timestamp * 100) / 100;
    return `${videoHash}_t${quant.toFixed(2)}`;
  }

  /**
   * Saves a processed segmentation mask frame into OPFS or in-memory fallback.
   */
  async saveMask(videoHash: string, frame: SegmentationMaskFrame): Promise<void> {
    const key = this.makeKey(videoHash, frame.timestamp);

    // Keep in memory fallback for instant L1 cache
    this.memoryFallback.set(key, frame);

    if (!this.isOpfsSupported || !this.rootDir) {
      return;
    }

    try {
      const masksDir = await this.rootDir.getDirectoryHandle("bolsub_masks", { create: true });
      const videoDir = await masksDir.getDirectoryHandle(videoHash, { create: true });
      const fileHandle = await videoDir.getFileHandle(`${key}.bin`, { create: true });
      const writable = await fileHandle.createWritable();

      const header: SerializedHeader = {
        timestamp: frame.timestamp,
        width: frame.width,
        height: frame.height,
        metrics: frame.metrics,
      };

      const headerJson = JSON.stringify(header);
      const headerBytes = new TextEncoder().encode(headerJson);
      const headerLenBuffer = new Uint32Array([headerBytes.length]);

      // Layout: [4 bytes header length] + [header json bytes] + [mask alpha Uint8Array]
      await writable.write(new Uint8Array(headerLenBuffer.buffer));
      await writable.write(headerBytes);
      await writable.write(frame.maskData);
      await writable.close();
    } catch (e) {
      // Graceful fallback to memory
      console.warn("OPFS write error, using memory cache:", e);
    }
  }

  /**
   * Retrieves a cached segmentation mask frame.
   */
  async getMask(
    videoHash: string,
    timestamp: number,
    toleranceSeconds = 0.05
  ): Promise<SegmentationMaskFrame | null> {
    const primaryKey = this.makeKey(videoHash, timestamp);

    // 1. Check L1 Memory cache first
    if (this.memoryFallback.has(primaryKey)) {
      return this.memoryFallback.get(primaryKey)!;
    }

    // Check near timestamps within tolerance
    for (const [key, frame] of this.memoryFallback.entries()) {
      if (key.startsWith(videoHash) && Math.abs(frame.timestamp - timestamp) <= toleranceSeconds) {
        return frame;
      }
    }

    // 2. Check OPFS disk storage
    if (!this.isOpfsSupported || !this.rootDir) {
      return null;
    }

    try {
      const masksDir = await this.rootDir.getDirectoryHandle("bolsub_masks");
      const videoDir = await masksDir.getDirectoryHandle(videoHash);
      const fileHandle = await videoDir.getFileHandle(`${primaryKey}.bin`);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      const headerLen = new Uint32Array(buffer.slice(0, 4))[0];
      const headerBytes = new Uint8Array(buffer.slice(4, 4 + headerLen));
      const headerJson = new TextDecoder().decode(headerBytes);
      const header: SerializedHeader = JSON.parse(headerJson);

      const maskData = new Uint8Array(buffer.slice(4 + headerLen));

      const frame: SegmentationMaskFrame = {
        timestamp: header.timestamp,
        width: header.width,
        height: header.height,
        maskData,
        metrics: header.metrics,
      };

      // Populate L1 cache
      this.memoryFallback.set(primaryKey, frame);
      return frame;
    } catch {
      return null;
    }
  }

  /**
   * Checks whether masks for a given time window are already cached.
   */
  async hasMasksForRange(
    videoHash: string,
    startSec: number,
    endSec: number,
    stepSec = 0.2
  ): Promise<boolean> {
    for (let t = startSec; t <= endSec; t += stepSec) {
      const mask = await this.getMask(videoHash, t, 0.1);
      if (!mask) return false;
    }
    return true;
  }

  /**
   * Clears cached mask frames for a specific video.
   */
  async clearCacheForVideo(videoHash: string): Promise<void> {
    for (const key of Array.from(this.memoryFallback.keys())) {
      if (key.startsWith(videoHash)) {
        this.memoryFallback.delete(key);
      }
    }

    if (!this.isOpfsSupported || !this.rootDir) return;

    try {
      const masksDir = await this.rootDir.getDirectoryHandle("bolsub_masks");
      await masksDir.removeEntry(videoHash, { recursive: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  /**
   * Reports memory and storage usage metrics.
   */
  async getCacheStats(): Promise<{ frameCount: number; memoryBytes: number }> {
    let memoryBytes = 0;
    for (const frame of this.memoryFallback.values()) {
      memoryBytes += frame.maskData.length + 256;
    }
    return {
      frameCount: this.memoryFallback.size,
      memoryBytes,
    };
  }
}

export const opfsMaskCache = OpfsMaskCache.getInstance();
