import { describe, it, expect } from "vitest";
import { refineWordTimestamps, type WordToken } from "../timestampRefiner";
import type { SpeechSegment } from "../vad";

describe("timestampRefiner", () => {
  it("should fix negative and zero-duration word tokens", () => {
    const rawWords: WordToken[] = [
      { id: "1", text: "Maine", start: 0.5, end: 0.5, confidence: 0.9 }, // Zero duration
      { id: "2", text: "video", start: 1.2, end: 1.0, confidence: 0.9 }, // Negative duration
    ];

    const refined = refineWordTimestamps(rawWords, []);
    expect(refined[0].end).toBeGreaterThan(refined[0].start);
    expect(refined[1].end).toBeGreaterThan(refined[1].start);
  });

  it("should enforce strict monotonic non-overlapping ordering", () => {
    const overlappingWords: WordToken[] = [
      { id: "1", text: "Maine", start: 0.1, end: 0.6, confidence: 0.9 },
      { id: "2", text: "upload", start: 0.4, end: 0.9, confidence: 0.9 }, // Overlaps with word 1
    ];

    const refined = refineWordTimestamps(overlappingWords, []);
    expect(refined[0].end).toBeLessThanOrEqual(refined[1].start);
  });

  it("should snap boundaries to VAD edges when within threshold", () => {
    const words: WordToken[] = [
      { id: "1", text: "Namaste", start: 0.45, end: 0.9, confidence: 0.9 },
    ];
    const vadSegments: SpeechSegment[] = [
      { start: 0.4, end: 0.95, confidence: 0.95 },
    ];

    const refined = refineWordTimestamps(words, vadSegments, {
      snapThresholdSeconds: 0.1,
    });

    // 0.45 is within 0.1s of 0.4, so it should snap to 0.4
    expect(refined[0].start).toBe(0.4);
    // 0.9 is within 0.1s of 0.95, so it should snap to 0.95
    expect(refined[0].end).toBe(0.95);
  });
});
