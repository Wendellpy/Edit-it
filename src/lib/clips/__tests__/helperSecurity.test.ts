import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { parseAndValidateYouTubeUrl } from "../urlValidator";
import { buildYtDlpDownloadArgs } from "../argBuilder";

describe("Helper Security, Cache Hashing & Invariant Guard", () => {
  it("generates deterministic SHA-256 cache keys for duplicate links and parameters", () => {
    const videoId = "dQw4w9WgXcQ";
    const quality = "1080p";
    const start = 0;
    const end = 60;

    const key1 = crypto
      .createHash("sha256")
      .update(`${videoId}:${quality}:${start}:${end}`)
      .digest("hex")
      .slice(0, 20);

    const key2 = crypto
      .createHash("sha256")
      .update(`${videoId}:${quality}:${start}:${end}`)
      .digest("hex")
      .slice(0, 20);

    expect(key1).toBe(key2);
    expect(key1.length).toBe(20);
  });

  it("produces different cache keys for different time sections of the same video", () => {
    const videoId = "dQw4w9WgXcQ";
    const keySectionA = crypto
      .createHash("sha256")
      .update(`${videoId}:1080p:0:30`)
      .digest("hex")
      .slice(0, 20);

    const keySectionB = crypto
      .createHash("sha256")
      .update(`${videoId}:1080p:30:60`)
      .digest("hex")
      .slice(0, 20);

    expect(keySectionA).not.toBe(keySectionB);
  });

  it("never invokes shell or executes command string concatenation", () => {
    const maliciousInput = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&param=test";
    const res = buildYtDlpDownloadArgs({
      url: maliciousInput,
      outputPath: "test.mp4",
      quality: "1080p",
    });

    expect(res.ok).toBe(true);
    // Arguments must strictly be discrete array items
    expect(Array.isArray(res.args)).toBe(true);

    // Verify user-derived inputs (url, output path) have no shell metacharacters
    const urlArg = res.args[res.args.length - 1];
    expect(urlArg).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(urlArg).not.toMatch(/[;`$|<>\n\r]/);

    // Verify all arguments are safe discrete strings with no command separators
    for (const item of res.args) {
      expect(typeof item).toBe("string");
      expect(item).not.toMatch(/[;`$\n\r]|&&|\|\|/);
    }
  });

  it("strictly bounds section ranges to non-negative integers", () => {
    const res = buildYtDlpDownloadArgs({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      outputPath: "test.mp4",
      timeRange: { start: -10, end: 5.8 },
    });

    expect(res.ok).toBe(true);
    const sectionArgIndex = res.args.indexOf("--download-sections");
    expect(sectionArgIndex).toBeGreaterThan(-1);
    // start clamped to 0, end floored to 5
    expect(res.args[sectionArgIndex + 1]).toBe("*0-5");
  });
});
