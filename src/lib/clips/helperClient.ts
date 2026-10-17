/**
 * Local Helper Browser Client
 * Connects directly to 127.0.0.1:4321 to probe, download, and stream media.
 * 100% local, zero-cloud.
 */

import type {
  HelperStatus,
  VideoProbeResult,
  DownloadRequest,
  DownloadProgressEvent,
} from "./types";

const HELPER_ORIGIN = "http://127.0.0.1:4321";

class HelperClient {
  private token: string | null = null;
  private sseSource: EventSource | null = null;
  private listeners: Set<(event: DownloadProgressEvent) => void> = new Set();

  /**
   * Performs initial handshake to verify helper connection and acquire session token.
   */
  async checkStatus(): Promise<HelperStatus | null> {
    try {
      const res = await fetch(`${HELPER_ORIGIN}/status`, {
        method: "GET",
        headers: this.token ? { "X-Helper-Token": this.token } : {},
      });

      if (!res.ok) return null;
      const data: HelperStatus = await res.json();
      if (data.token) {
        this.token = data.token;
      }
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Triggers yt-dlp self-update on the local machine.
   */
  async updateYtDlp(): Promise<{ success: boolean; message: string }> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/update-ytdlp`, {
      method: "POST",
    });
    return res.json();
  }

  /**
   * Probes video metadata (title, duration, qualities, subtitles) without downloading.
   */
  async probeVideo(url: string): Promise<VideoProbeResult> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Probe request failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Starts a download job on the local helper.
   */
  async startDownload(request: DownloadRequest): Promise<DownloadProgressEvent> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok && res.status !== 202) {
      const err = await res.json().catch(() => ({ error: "Download request failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Requests helper to extract 16kHz mono WAV via FFmpeg.
   */
  async extractAudio(fileId: string): Promise<{ audioFileId: string; path: string }> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/extract-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Audio extraction failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Pulls creator YouTube captions as hints for proper nouns and exact acoustic word timestamps.
   */
  async getCaptionsHint(url: string): Promise<{
    success: boolean;
    text: string;
    properNouns: string[];
    timedWords?: Array<{ text: string; start: number; end: number }>;
  }> {
    try {
      const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/captions-hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return { success: false, text: "", properNouns: [], timedWords: [] };
      return res.json();
    } catch {
      return { success: false, text: "", properNouns: [], timedWords: [] };
    }
  }

  /**
   * Alias for checkStatus()
   */
  async getStatus(): Promise<HelperStatus | null> {
    return this.checkStatus();
  }

  /**
   * Hardware cut and 9:16 reframing via companion helper FFmpeg.
   */
  async exportClipFfmpeg(params: {
    fileId: string;
    clipId: string;
    start: number;
    end: number;
    reframeMode?: "9:16_auto" | "16:9_fit_blur" | "original";
    crop?: { sx: number; sy: number; sw: number; sh: number };
    templateId?: string;
    srtContent?: string;
    assContent?: string;
    force?: boolean;
    noCache?: boolean;
  }): Promise<{ success: boolean; fileId: string; downloadUrl: string; cached?: boolean }> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/export-clip-ffmpeg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "FFmpeg export failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Fast hardware watermark removal via companion helper FFmpeg delogo filter.
   */
  async removeWatermarkFfmpeg(params: {
    fileId: string;
    rois: Array<{ x: number; y: number; width: number; height: number; isNormalized?: boolean }>;
    band?: number;
  }): Promise<{ success: boolean; fileId: string; downloadUrl: string; cached?: boolean }> {
    const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/remove-watermark-ffmpeg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "FFmpeg delogo request failed" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Subscribes to Server-Sent Events from the helper for real-time progress.
   */
  subscribeToProgress(onEvent: (event: DownloadProgressEvent) => void): () => void {
    this.listeners.add(onEvent);

    if (!this.sseSource && typeof window !== "undefined") {
      const url = new URL(`${HELPER_ORIGIN}/progress`);
      if (this.token) {
        url.searchParams.set("token", this.token);
      }
      this.sseSource = new EventSource(url.toString());

      this.sseSource.onmessage = (msg) => {
        try {
          const data: DownloadProgressEvent = JSON.parse(msg.data);
          for (const listener of this.listeners) {
            listener(data);
          }
        } catch {}
      };

      this.sseSource.onerror = () => {
        // SSE reconnection handles itself automatically
      };
    }

    return () => {
      this.listeners.delete(onEvent);
      if (this.listeners.size === 0 && this.sseSource) {
        this.sseSource.close();
        this.sseSource = null;
      }
    };
  }

  /**
   * Returns authenticated URL for streaming or downloading a file from helper cache.
   */
  getFileUrl(fileId: string, downloadName?: string): string {
    const url = new URL(`${HELPER_ORIGIN}/file/${encodeURIComponent(fileId)}`);
    if (this.token) {
      url.searchParams.set("token", this.token);
    }
    if (downloadName) {
      url.searchParams.set("download", "1");
      url.searchParams.set("name", downloadName);
    }
    return url.toString();
  }

  /**
   * Cleans managed cache files on companion helper.
   * Can clear all files, files for a specific video, only exported clips, or a specific file.
   */
  async cleanupCache(
    options?: string | { fileId?: string; fileName?: string; onlyExports?: boolean }
  ): Promise<{ success: boolean; cache?: { totalBytes: number; maxBytes: number; fileCount: number } }> {
    const payload = typeof options === "string" ? { fileId: options } : options || {};
    try {
      const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/cleanup`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { success: false };
      }
      return res.json().catch(() => ({ success: true }));
    } catch {
      return { success: false };
    }
  }

  /**
   * Deletes a specific clip or export file from companion helper cache.
   */
  async deleteFile(fileNameOrId: string): Promise<{ success: boolean }> {
    const cleanName = fileNameOrId.replace(/^\/file\//, "").split("?")[0];
    try {
      const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/file/${encodeURIComponent(cleanName)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return this.cleanupCache({ fileName: cleanName });
      }
      return res.json().catch(() => ({ success: true }));
    } catch {
      return this.cleanupCache({ fileName: cleanName });
    }
  }

  /**
   * Fetches latest cache statistics from companion helper.
   */
  async getCacheStats(): Promise<{ totalBytes: number; maxBytes: number; fileCount: number } | null> {
    try {
      const res = await this.fetchWithAuth(`${HELPER_ORIGIN}/cache`, { method: "GET" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.cache || null;
    } catch {
      return null;
    }
  }

  private async fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
    if (!this.token) {
      await this.checkStatus();
    }

    const headers = new Headers(init.headers || {});
    if (this.token) {
      headers.set("X-Helper-Token", this.token);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  }
}

export const localHelperClient = new HelperClient();
