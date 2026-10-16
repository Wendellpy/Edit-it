import { describe, it, expect } from "vitest";
import { decodePcmWav } from "../audioUtils";

describe("PCM WAV Decoder & RMS Energy Analyzer", () => {
  function createSyntheticWavBuffer(sampleRate = 16000, numSamples = 1600): ArrayBuffer {
    const byteLength = 44 + numSamples * 2;
    const buffer = new ArrayBuffer(byteLength);
    const view = new DataView(buffer);

    // "RIFF"
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
    view.setUint32(4, 36 + numSamples * 2, true);
    // "WAVE"
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);

    // "fmt "
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format = PCM (1)
    view.setUint16(22, 1, true); // Num channels = 1 (mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample = 16

    // "data"
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
    view.setUint32(40, numSamples * 2, true);

    // Generate sine wave samples: max amplitude 16384 (half scale = 0.5)
    for (let i = 0; i < numSamples; i++) {
      const sampleVal = Math.round(16384 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
      view.setInt16(44 + i * 2, sampleVal, true);
    }

    return buffer;
  }

  it("decodes a 16kHz mono PCM WAV into Float32Array accurately", () => {
    const wavBuffer = createSyntheticWavBuffer(16000, 3200); // 0.2s
    const result = decodePcmWav(wavBuffer);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sampleRate).toBe(16000);
    expect(result.durationSeconds).toBeCloseTo(0.2, 2);
    expect(result.audioBuffer.length).toBe(3200);

    // Verify peak amplitude is approximately 0.5 (16384 / 32768)
    let max = 0;
    for (let i = 0; i < result.audioBuffer.length; i++) {
      const abs = Math.abs(result.audioBuffer[i]);
      if (abs > max) max = abs;
    }
    expect(max).toBeCloseTo(0.5, 1);
  });

  it("calculates RMS energy envelope across 10ms windows", () => {
    const wavBuffer = createSyntheticWavBuffer(16000, 3200); // 20 windows of 160 samples (10ms)
    const result = decodePcmWav(wavBuffer);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.rmsPeaks.length).toBe(20);
    // For a sine wave of peak 0.5, RMS is ~0.5 / sqrt(2) ≈ 0.353
    expect(result.rmsPeaks[5]).toBeCloseTo(0.35, 1);
  });

  it("returns null safely for non-WAV data", () => {
    const garbage = new ArrayBuffer(100);
    const result = decodePcmWav(garbage);
    expect(result).toBeNull();
  });
});
