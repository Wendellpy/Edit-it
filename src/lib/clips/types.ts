/**
 * Types for the Clips (Auto Shorts) pipeline and local companion helper.
 * 100% local, zero token costs.
 */

export interface HelperBinaryStatus {
  available: boolean;
  version: string | null;
  path?: string | null;
  installCommand?: string;
  error?: string;
}

export interface HelperStatus {
  ok: boolean;
  version: string;
  token?: string;
  binaries: {
    ytdlp: HelperBinaryStatus;
    ffmpeg: HelperBinaryStatus;
  };
  cache: {
    totalBytes: number;
    maxBytes: number;
    fileCount: number;
    cacheDir: string;
  };
}

export interface VideoProbeResult {
  id: string;
  url: string;
  title: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader?: string;
  description?: string;
  isLive: boolean;
  isAgeRestricted: boolean;
  availableQualities: string[];
  subtitlesAvailable: string[];
  warning?: string;
}

export interface DownloadRequest {
  url: string;
  quality?: "720p" | "1080p" | "1440p" | "4k" | "source";
  timeRange?: {
    start: number;
    end: number;
  };
  allowPlaylist?: boolean;
}

export interface DownloadProgressEvent {
  jobId: string;
  videoId: string;
  status: "queued" | "probing" | "downloading" | "merging" | "ready" | "error";
  progressPercent: number;
  speed?: string;
  eta?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  cached?: boolean;
  error?: string;
}

export interface HelperErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}
