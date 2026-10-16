import { describe, it, expect } from "vitest";
import { parseAndValidateYouTubeUrl } from "../urlValidator";

describe("YouTube URL Validator & Sanitizer", () => {
  it("accepts valid standard YouTube watch URLs", () => {
    const res = parseAndValidateYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe("dQw4w9WgXcQ");
    expect(res.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(res.hasPlaylist).toBe(false);
  });

  it("accepts short youtu.be links", () => {
    const res = parseAndValidateYouTubeUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe("dQw4w9WgXcQ");
  });

  it("accepts YouTube Shorts links", () => {
    const res = parseAndValidateYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe("dQw4w9WgXcQ");
  });

  it("accepts mobile youtube links (m.youtube.com)", () => {
    const res = parseAndValidateYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe("dQw4w9WgXcQ");
  });

  it("detects playlist parameter", () => {
    const res = parseAndValidateYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef");
    expect(res.isValid).toBe(true);
    expect(res.hasPlaylist).toBe(true);
    expect(res.playlistId).toBe("PL1234567890abcdef");
  });

  it("rejects non-YouTube domains", () => {
    const evil1 = parseAndValidateYouTubeUrl("https://vimeo.com/123456789");
    expect(evil1.isValid).toBe(false);
    expect(evil1.error).toContain("Unsupported domain");

    const evil2 = parseAndValidateYouTubeUrl("https://evil-site.com/watch?v=dQw4w9WgXcQ");
    expect(evil2.isValid).toBe(false);
  });

  it("strictly rejects shell injection characters", () => {
    const attacks = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ;rm -rf /",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ|whoami",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ`calc.exe`",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ$(notepad)",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&&cmd.exe",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ\nreboot",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ>file.txt",
    ];

    for (const attack of attacks) {
      const res = parseAndValidateYouTubeUrl(attack);
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    }
  });

  it("rejects invalid video ID lengths or characters", () => {
    const res = parseAndValidateYouTubeUrl("https://www.youtube.com/watch?v=tooshort");
    expect(res.isValid).toBe(false);
  });

  it("rejects non-http/https protocols", () => {
    const res = parseAndValidateYouTubeUrl("file:///C:/Users/test/video.mp4");
    expect(res.isValid).toBe(false);
  });
});
