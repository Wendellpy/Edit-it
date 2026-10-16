import { describe, it, expect } from "vitest";
import {
  buildYtDlpProbeArgs,
  buildYtDlpDownloadArgs,
  buildFfmpegAudioExtractArgs,
  getFormatSelector,
} from "../argBuilder";

describe("Argument Builder for yt-dlp & FFmpeg", () => {
  it("builds probe args as a safe array", () => {
    const res = buildYtDlpProbeArgs({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.args)).toBe(true);
    expect(res.args).toContain("--dump-single-json");
    expect(res.args).toContain("--no-playlist");
    expect(res.args).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    // Ensure no argument contains concatenated shell characters
    for (const arg of res.args) {
      expect(arg).not.toContain(";");
      expect(arg).not.toContain("|");
    }
  });

  it("fails probe if url is invalid", () => {
    const res = buildYtDlpProbeArgs({ url: "https://malicious.com/watch?v=123" });
    expect(res.ok).toBe(false);
    expect(res.args.length).toBe(0);
  });

  it("builds download args with section download if timeRange provided", () => {
    const res = buildYtDlpDownloadArgs({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      outputPath: "C:/tmp/test.mp4",
      quality: "1080p",
      timeRange: { start: 10, end: 45 },
    });
    expect(res.ok).toBe(true);
    expect(res.args).toContain("--download-sections");
    expect(res.args).toContain("*10-45");
    expect(res.args).toContain("--no-playlist");
    expect(res.args).toContain("C:/tmp/test.mp4");
  });

  it("selects correct quality format strings", () => {
    expect(getFormatSelector("1080p")).toContain("height<=1080");
    expect(getFormatSelector("720p")).toContain("height<=720");
    expect(getFormatSelector("4k")).toContain("height<=2160");
    expect(getFormatSelector("source")).toBe("bestvideo+bestaudio/best");
  });

  it("builds FFmpeg 16kHz mono audio extraction arguments", () => {
    const args = buildFfmpegAudioExtractArgs("input.mp4", "output.wav");
    expect(args).toEqual([
      "-y",
      "-i",
      "input.mp4",
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "output.wav",
    ]);
  });
});
