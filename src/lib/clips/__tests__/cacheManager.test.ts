import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatBytes,
  getUnifiedCacheStats,
  freeClipCache,
  clearExportedClips,
  clearAllCache,
} from "../cacheManager";
import { localHelperClient } from "../helperClient";
import { opfsVideoStorage } from "../opfsVideoStorage";

describe("Unified Cache & Memory Manager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatBytes helper", () => {
    it("formats byte values appropriately", () => {
      expect(formatBytes(0)).toBe("0 MB");
      expect(formatBytes(512 * 1024)).toBe("512.0 KB");
      expect(formatBytes(25 * 1024 * 1024)).toBe("25.0 MB");
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
    });
  });

  describe("getUnifiedCacheStats", () => {
    it("aggregates helper disk cache and OPFS storage metrics", async () => {
      vi.spyOn(localHelperClient, "getStatus").mockResolvedValue({
        ok: true,
        version: "1.0.0",
        binaries: {
          ytdlp: { available: true, version: "2026.03.01" },
          ffmpeg: { available: true, version: "7.1" },
        },
        cache: {
          totalBytes: 150 * 1024 * 1024,
          maxBytes: 5 * 1024 * 1024 * 1024,
          fileCount: 4,
          cacheDir: "/cache",
        },
      });

      vi.spyOn(opfsVideoStorage, "getStorageStats").mockResolvedValue({
        count: 2,
        totalBytes: 50 * 1024 * 1024,
        available: true,
      });

      const stats = await getUnifiedCacheStats();
      expect(stats.helperBytes).toBe(150 * 1024 * 1024);
      expect(stats.opfsBytes).toBe(50 * 1024 * 1024);
      expect(stats.totalBytes).toBe(200 * 1024 * 1024);
      expect(stats.totalFormatted).toBe("200.0 MB");
      expect(stats.helperFileCount).toBe(4);
      expect(stats.opfsFileCount).toBe(2);
    });

    it("handles offline helper or unsupported OPFS gracefully", async () => {
      vi.spyOn(localHelperClient, "getStatus").mockRejectedValue(new Error("Network error"));
      vi.spyOn(opfsVideoStorage, "getStorageStats").mockResolvedValue({
        count: 0,
        totalBytes: 0,
        available: false,
      });

      const stats = await getUnifiedCacheStats();
      expect(stats.helperBytes).toBe(0);
      expect(stats.opfsBytes).toBe(0);
      expect(stats.totalBytes).toBe(0);
      expect(stats.totalFormatted).toBe("0 MB");
    });
  });

  describe("freeClipCache", () => {
    it("invokes removal on both OPFS and helper client", async () => {
      const opfsRemoveSpy = vi.spyOn(opfsVideoStorage, "removeVideo").mockResolvedValue(true);
      const helperCleanupSpy = vi.spyOn(localHelperClient, "cleanupCache").mockResolvedValue({ success: true });
      const helperDeleteSpy = vi.spyOn(localHelperClient, "deleteFile").mockResolvedValue({ success: true });

      const res = await freeClipCache({ fileId: "vid_123", clipFileName: "export_vid_123_c1.mp4" });
      expect(res.success).toBe(true);

      expect(opfsRemoveSpy).toHaveBeenCalledWith("vid_123");
      expect(opfsRemoveSpy).toHaveBeenCalledWith("export_vid_123_c1.mp4");
      expect(helperCleanupSpy).toHaveBeenCalledWith({ fileId: "vid_123" });
      expect(helperDeleteSpy).toHaveBeenCalledWith("export_vid_123_c1.mp4");
    });
  });

  describe("clearExportedClips", () => {
    it("requests helper to clean only export files", async () => {
      const helperCleanupSpy = vi.spyOn(localHelperClient, "cleanupCache").mockResolvedValue({ success: true });
      vi.spyOn(localHelperClient, "getStatus").mockResolvedValue({
        ok: true,
        version: "1.0.0",
        binaries: {
          ytdlp: { available: true, version: "1" },
          ffmpeg: { available: true, version: "1" },
        },
        cache: { totalBytes: 0, maxBytes: 5e9, fileCount: 0, cacheDir: "" },
      });
      vi.spyOn(opfsVideoStorage, "getStorageStats").mockResolvedValue({ count: 0, totalBytes: 0, available: true });

      const res = await clearExportedClips();
      expect(res.success).toBe(true);
      expect(helperCleanupSpy).toHaveBeenCalledWith({ onlyExports: true });
    });
  });

  describe("clearAllCache", () => {
    it("clears both helper cache and OPFS clips", async () => {
      const helperCleanupSpy = vi.spyOn(localHelperClient, "cleanupCache").mockResolvedValue({ success: true });
      const opfsClearSpy = vi.spyOn(opfsVideoStorage, "clearAllClips").mockResolvedValue();

      vi.spyOn(localHelperClient, "getStatus").mockResolvedValue({
        ok: true,
        version: "1.0.0",
        binaries: {
          ytdlp: { available: true, version: "1" },
          ffmpeg: { available: true, version: "1" },
        },
        cache: { totalBytes: 0, maxBytes: 5e9, fileCount: 0, cacheDir: "" },
      });
      vi.spyOn(opfsVideoStorage, "getStorageStats").mockResolvedValue({ count: 0, totalBytes: 0, available: true });

      const res = await clearAllCache();
      expect(res.success).toBe(true);
      expect(helperCleanupSpy).toHaveBeenCalledWith();
      expect(opfsClearSpy).toHaveBeenCalled();
    });
  });
});
