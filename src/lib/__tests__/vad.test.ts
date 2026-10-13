import { describe, it, expect } from "vitest";
import { detectSpeechSegments } from "../vad";

describe("VAD - detectSpeechSegments", () => {
  it("should detect active speech regions and skip silence", () => {
    const sampleRate = 16000;
    // 3 seconds total: 0-1s silence, 1-2s speech, 2-3s silence
    const audioData = new Float32Array(3 * sampleRate);

    // Inject speech in the middle second (samples 16000 to 32000)
    for (let i = 16000; i < 32000; i++) {
      audioData[i] = 0.5 * Math.sin(i / 10);
    }

    const segments = detectSpeechSegments(audioData, {
      sampleRate,
      energyThreshold: 0.05,
      padBeforeSeconds: 0.08,
      padAfterSeconds: 0.12,
    });

    expect(segments.length).toBe(1);
    // Speech started at 1.0s, with 80ms padBefore it should be around 0.92s
    expect(segments[0].start).toBeLessThanOrEqual(1.0);
    expect(segments[0].start).toBeGreaterThanOrEqual(0.8);
    // Speech ended at 2.0s, with 120ms padAfter it should be around 2.12s
    expect(segments[0].end).toBeGreaterThanOrEqual(2.0);
    expect(segments[0].end).toBeLessThanOrEqual(2.3);
  });
});
