import { describe, it, expect } from "vitest";
import { chunkAudio } from "../audioPipeline";

describe("audioPipeline - chunkAudio", () => {
  it("should chunk 65 seconds of audio into appropriate 30s overlapping segments", () => {
    const sampleRate = 16000;
    const totalSeconds = 65;
    const audioData = new Float32Array(totalSeconds * sampleRate);

    // Fill with simulated audio data
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = Math.sin(i / 100);
    }

    const chunks = chunkAudio(audioData, sampleRate, 30, 2);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].startSecond).toBe(0);
    expect(chunks[0].endSecond).toBe(30);
    expect(chunks[0].isLast).toBe(false);

    // Last chunk reaches the end
    const last = chunks[chunks.length - 1];
    expect(last.isLast).toBe(true);
    expect(last.endSecond).toBe(65);
  });
});
