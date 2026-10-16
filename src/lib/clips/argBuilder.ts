/**
 * Local yt-dlp & FFmpeg Argument Builder
 * GUARANTEE: Never concatenates shell commands as strings. Produces strictly typed string arrays
 * suitable for child_process.spawn(binary, args, { shell: false }).
 */

import { parseAndValidateYouTubeUrl } from "./urlValidator";
import type { DownloadRequest } from "./types";

export interface ProbeArgsOptions {
  url: string;
}

export interface DownloadArgsOptions extends DownloadRequest {
  outputPath: string;
  ffmpegPath?: string;
}

/**
 * Builds array arguments for yt-dlp to probe video metadata as JSON.
 */
export function buildYtDlpProbeArgs(options: ProbeArgsOptions): { ok: boolean; args: string[]; error?: string } {
  const parsed = parseAndValidateYouTubeUrl(options.url);
  if (!parsed.isValid || !parsed.normalizedUrl) {
    return { ok: false, args: [], error: parsed.error || "Invalid YouTube URL" };
  }

  const args: string[] = [
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--extractor-args",
    "youtube:player_client=android,web",
    "--socket-timeout",
    "20",
    parsed.normalizedUrl,
  ];

  return { ok: true, args };
}

/**
 * Maps quality string to yt-dlp format selector.
 */
export function getFormatSelector(quality: DownloadRequest["quality"] = "1080p"): string {
  switch (quality) {
    case "4k":
      return "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]/best";
    case "1440p":
      return "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]/best";
    case "720p":
      return "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best";
    case "source":
      return "bestvideo+bestaudio/best";
    case "1080p":
    default:
      return "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";
  }
}

/**
 * Builds array arguments for yt-dlp download.
 */
export function buildYtDlpDownloadArgs(options: DownloadArgsOptions): { ok: boolean; args: string[]; error?: string } {
  const parsed = parseAndValidateYouTubeUrl(options.url);
  if (!parsed.isValid || !parsed.normalizedUrl) {
    return { ok: false, args: [], error: parsed.error || "Invalid YouTube URL" };
  }

  const args: string[] = [
    "--newline",
    "--progress",
    "--progress-template",
    "download:[%(progress._percent_str)s] speed:[%(progress._speed_str)s] eta:[%(progress._eta_str)s] downloaded:[%(progress.downloaded_bytes)s] total:[%(progress.total_bytes)s]",
    "-f",
    getFormatSelector(options.quality),
    "--merge-output-format",
    "mp4",
    "--retries",
    "5",
    "--fragment-retries",
    "5",
    "--socket-timeout",
    "30",
    "--extractor-args",
    "youtube:player_client=android,web",
    "-o",
    options.outputPath,
  ];

  if (options.ffmpegPath) {
    args.push("--ffmpeg-location", options.ffmpegPath);
  }

  // Playlist protection
  if (!options.allowPlaylist) {
    args.push("--no-playlist");
  }

  // Time range section download (e.g. *15-75)
  if (options.timeRange) {
    const start = Math.max(0, Math.floor(options.timeRange.start));
    const end = Math.max(start + 1, Math.floor(options.timeRange.end));
    args.push("--download-sections", `*${start}-${end}`);
    args.push("--force-keyframes-at-cuts");
  }

  args.push(parsed.normalizedUrl);

  return { ok: true, args };
}

/**
 * Builds array arguments for FFmpeg audio extraction to 16kHz mono WAV (for Whisper).
 */
export function buildFfmpegAudioExtractArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputPath,
  ];
}
