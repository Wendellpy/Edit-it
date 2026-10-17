/**
 * Unified Cache & Memory Management Service
 * Manages both Local Companion Helper Disk Cache (helper/cache/) and
 * Browser OPFS (Origin Private File System) Video Storage.
 */

import { localHelperClient } from "./helperClient";
import { opfsVideoStorage } from "./opfsVideoStorage";

export interface UnifiedCacheStats {
  helperBytes: number;
  helperMaxBytes: number;
  helperFileCount: number;
  opfsBytes: number;
  opfsFileCount: number;
  totalBytes: number;
  totalFormatted: string;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Retrieves total memory and disk usage across Helper cache and browser OPFS.
 */
export async function getUnifiedCacheStats(): Promise<UnifiedCacheStats> {
  const [helperStatus, opfsStats] = await Promise.all([
    localHelperClient.getStatus().catch(() => null),
    opfsVideoStorage.getStorageStats().catch(() => ({ totalBytes: 0, count: 0, available: false })),
  ]);

  const helperBytes = helperStatus?.cache?.totalBytes || 0;
  const helperMaxBytes = helperStatus?.cache?.maxBytes || 5 * 1024 * 1024 * 1024;
  const helperFileCount = helperStatus?.cache?.fileCount || 0;

  const opfsBytes = opfsStats?.totalBytes || 0;
  const opfsFileCount = opfsStats?.count || 0;

  const totalBytes = helperBytes + opfsBytes;

  return {
    helperBytes,
    helperMaxBytes,
    helperFileCount,
    opfsBytes,
    opfsFileCount,
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
  };
}

/**
 * Deletes a specific clip or video from both OPFS and Helper cache.
 */
export async function freeClipCache(params: {
  fileId?: string;
  clipFileName?: string;
}): Promise<{ success: boolean }> {
  const { fileId, clipFileName } = params;

  const promises: Promise<any>[] = [];

  if (fileId) {
    promises.push(opfsVideoStorage.removeVideo(fileId));
    promises.push(localHelperClient.cleanupCache({ fileId }));
  }

  if (clipFileName) {
    promises.push(opfsVideoStorage.removeVideo(clipFileName));
    promises.push(localHelperClient.deleteFile(clipFileName));
  }

  await Promise.allSettled(promises);
  return { success: true };
}

/**
 * Clears only exported clips and temporary render files from helper cache,
 * preserving the original downloaded source video for further clipping.
 */
export async function clearExportedClips(): Promise<{ success: boolean; stats: UnifiedCacheStats }> {
  await localHelperClient.cleanupCache({ onlyExports: true });
  const stats = await getUnifiedCacheStats();
  return { success: true, stats };
}

/**
 * Completely purges all cached videos, audio files, and exported clips
 * from both the companion helper disk and browser OPFS storage.
 */
export async function clearAllCache(): Promise<{ success: boolean; stats: UnifiedCacheStats }> {
  await Promise.allSettled([
    localHelperClient.cleanupCache(),
    opfsVideoStorage.clearAllClips(),
  ]);

  const stats = await getUnifiedCacheStats();
  return { success: true, stats };
}
