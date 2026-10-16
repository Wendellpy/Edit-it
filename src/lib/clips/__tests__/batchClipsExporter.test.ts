import { describe, it, expect, vi } from "vitest";
import {
  normalizeTokensForClip,
  sanitizeClipFilename,
  generateClipSubtitleSidecars,
  exportBatchClips,
} from "../batchClipsExporter";
import type { HinglishWordToken } from "../../hinglish/postProcessor";
import type { ClipCandidate } from "../clipFinder";

function makeToken(text: string, start: number, end: number): HinglishWordToken {
  return {
    id: `tok_${Math.random()}`,
    text,
    start,
    end,
    confidence: 0.95,
    romanText: text,
    devanagariText: text,
    isCodeMixedEnglish: false,
  };
}

describe("Batch Hardware Export Pipeline", () => {
  describe("normalizeTokensForClip", () => {
    const rawTokens: HinglishWordToken[] = [
      makeToken("Outside", 10.0, 11.0),
      makeToken("ClipStart", 20.0, 20.5),
      makeToken("Middle", 21.0, 21.8),
      makeToken("ClipEnd", 24.5, 25.0),
      makeToken("Later", 35.0, 36.0),
    ];

    it("filters tokens strictly within the clip time window and shifts timestamps to 0", () => {
      const normalized = normalizeTokensForClip(rawTokens, 20.0, 25.0);

      expect(normalized.length).toBe(3);
      expect(normalized[0].text).toBe("ClipStart");
      expect(normalized[0].start).toBe(0.0);
      expect(normalized[0].end).toBe(0.5);

      expect(normalized[1].text).toBe("Middle");
      expect(normalized[1].start).toBe(1.0);
      expect(normalized[1].end).toBe(1.8);

      expect(normalized[2].text).toBe("ClipEnd");
      expect(normalized[2].start).toBe(4.5);
      expect(normalized[2].end).toBe(5.0);
    });

    it("returns empty array when no tokens overlap the clip interval", () => {
      const normalized = normalizeTokensForClip(rawTokens, 50.0, 60.0);
      expect(normalized.length).toBe(0);
    });
  });

  describe("sanitizeClipFilename", () => {
    it("formats clean filename with zero-padded clip index", () => {
      const filename = sanitizeClipFilename("Why You Should Never Give Up!", 1);
      expect(filename).toBe("Clip-01_Why_You_Should_Never_Give_Up");
    });

    it("removes dangerous shell and filesystem metacharacters", () => {
      const filename = sanitizeClipFilename("Hacks & Tricks / 100% Free: Secrets?", 3);
      expect(filename).toBe("Clip-03_Hacks_Tricks_100_Free_Secrets");
    });
  });

  describe("generateClipSubtitleSidecars", () => {
    const tokens: HinglishWordToken[] = [
      makeToken("Zero", 30.0, 31.0),
      makeToken("Second", 31.0, 32.0),
    ];

    it("generates synchronized .srt and .vtt sidecars with 0-based timecodes", () => {
      const { srt, vtt } = generateClipSubtitleSidecars(tokens, 30.0, 35.0);

      // SRT should start at 00:00:00,000
      expect(srt).toContain("00:00:00,000 --> 00:00:02,000");
      expect(srt).toContain("Zero Second");

      // VTT should start at 00:00:00.000
      expect(vtt).toContain("WEBVTT");
      expect(vtt).toContain("00:00:00.000 --> 00:00:02.000");
    });
  });

  describe("exportBatchClips", () => {
    const mockClip1: ClipCandidate = {
      id: "c1",
      index: 1,
      start: 10,
      end: 20,
      duration: 10,
      score: 90,
      rawScore: 100,
      headline: "Clip One",
      firstSentence: "Start 1.",
      lastSentence: "End 1.",
      reasons: ["High pace"],
      hookType: "bold_claim",
      tokens: [makeToken("First", 10, 11)],
      signals: {
        audio: {
          avgRms: 0.5,
          peakRms: 0.8,
          dynamicRange: 0.3,
          hasLaughterOrCheer: false,
          speechPaceWpm: 150,
          pauseCount: 0,
          totalSilenceSeconds: 0,
        },
        text: {
          hookType: "bold_claim",
          hookScore: 80,
          keywordDensity: 0.5,
          sentimentIntensity: 0.5,
          sentimentCategory: "exciting",
          fillerRatio: 0,
          wordCount: 1,
        },
        reasons: [],
      },
    };

    it("reports progress and gracefully handles mock helper export", async () => {
      // Mock localHelperClient.exportClipFfmpeg
      const helperMock = vi.fn().mockResolvedValue({
        success: true,
        fileId: "export_c1.mp4",
        downloadUrl: "/file/export_c1.mp4",
      });

      const { localHelperClient } = await import("../helperClient");
      const origMethod = localHelperClient.exportClipFfmpeg;
      localHelperClient.exportClipFfmpeg = helperMock;

      try {
        const progressEvents: number[] = [];
        const result = await exportBatchClips({
          clips: [mockClip1],
          fileId: "test_vid",
          preferEngine: "ffmpeg",
          onProgress: (p) => {
            progressEvents.push(p.overallPercent);
          },
        });

        expect(result.successCount).toBe(1);
        expect(result.results.length).toBe(1);
        expect(result.results[0].engineUsed).toBe("ffmpeg");
        expect(result.results[0].srtContent).toBeDefined();
        expect(result.results[0].vttContent).toBeDefined();
        expect(progressEvents[progressEvents.length - 1]).toBe(100);
      } finally {
        localHelperClient.exportClipFfmpeg = origMethod;
      }
    });

    it("respects abort signal to cleanly cancel ongoing batch export", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await exportBatchClips({
        clips: [mockClip1],
        fileId: "test_vid",
        signal: controller.signal,
      });

      expect(result.results.length).toBe(0);
      expect(result.successCount).toBe(0);
    });
  });
});
