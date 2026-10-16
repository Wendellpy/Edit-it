import { describe, it, expect } from "vitest";
import { extractSignalsForSegment } from "../signalExtractor";
import type { HinglishWordToken } from "../../hinglish/postProcessor";

describe("Signal Extractor (Audio & Hinglish Hooks)", () => {
  it("detects question hook in English and Hinglish", () => {
    const tokens: HinglishWordToken[] = [
      { id: "1", text: "kya", romanText: "kya", devanagariText: "क्या", start: 0.1, end: 0.4, confidence: 0.99, isCodeMixedEnglish: false },
      { id: "2", text: "aapko", romanText: "aapko", devanagariText: "आपको", start: 0.42, end: 0.8, confidence: 0.99, isCodeMixedEnglish: false },
      { id: "3", text: "pata", romanText: "pata", devanagariText: "पता", start: 0.82, end: 1.1, confidence: 0.99, isCodeMixedEnglish: false },
      { id: "4", text: "hai", romanText: "hai", devanagariText: "है", start: 1.12, end: 1.4, confidence: 0.99, isCodeMixedEnglish: false },
      { id: "5", text: "yeh?", romanText: "yeh?", devanagariText: "यह?", start: 1.42, end: 1.8, confidence: 0.99, isCodeMixedEnglish: false },
    ];

    const signals = extractSignalsForSegment(tokens, 0, 2);
    expect(signals.text.hookType).toBe("question");
    expect(signals.text.hookScore).toBeGreaterThanOrEqual(80);
    expect(signals.reasons.some((r) => r.includes("question opener"))).toBe(true);
  });

  it("detects bold claim hook", () => {
    const tokens: HinglishWordToken[] = [
      { id: "1", text: "this", romanText: "this", devanagariText: "this", start: 0.1, end: 0.4, confidence: 0.99, isCodeMixedEnglish: true },
      { id: "2", text: "changes", romanText: "changes", devanagariText: "changes", start: 0.42, end: 0.8, confidence: 0.99, isCodeMixedEnglish: true },
      { id: "3", text: "everything", romanText: "everything", devanagariText: "everything", start: 0.82, end: 1.2, confidence: 0.99, isCodeMixedEnglish: true },
    ];

    const signals = extractSignalsForSegment(tokens, 0, 2);
    expect(signals.text.hookType).toBe("bold_claim");
    expect(signals.text.hookScore).toBeGreaterThanOrEqual(90);
  });

  it("detects laughter / reaction burst in audio RMS peaks", () => {
    const tokens: HinglishWordToken[] = [
      { id: "1", text: "joke", romanText: "joke", devanagariText: "joke", start: 0, end: 2, confidence: 0.95, isCodeMixedEnglish: true },
    ];

    // 2 seconds = 200 bins of 10ms
    const rmsPeaks = new Float32Array(200);
    rmsPeaks.fill(0.08); // average 0.08
    // Sudden reaction burst at 1s
    rmsPeaks[100] = 0.45;
    rmsPeaks[101] = 0.50;
    rmsPeaks[102] = 0.42;

    const signals = extractSignalsForSegment(tokens, 0, 2, rmsPeaks);
    expect(signals.audio.hasLaughterOrCheer).toBe(true);
    expect(signals.reasons.some((r) => r.includes("High energy audio burst"))).toBe(true);
  });

  it("calculates filler word ratio accurately", () => {
    const tokens: HinglishWordToken[] = [
      { id: "1", text: "matlab", romanText: "matlab", devanagariText: "मतलब", start: 0.1, end: 0.4, confidence: 0.95, isCodeMixedEnglish: false },
      { id: "2", text: "basically", romanText: "basically", devanagariText: "basically", start: 0.5, end: 0.8, confidence: 0.95, isCodeMixedEnglish: true },
      { id: "3", text: "creator", romanText: "creator", devanagariText: "creator", start: 0.9, end: 1.2, confidence: 0.95, isCodeMixedEnglish: true },
      { id: "4", text: "video", romanText: "video", devanagariText: "video", start: 1.3, end: 1.6, confidence: 0.95, isCodeMixedEnglish: true },
    ];

    const signals = extractSignalsForSegment(tokens, 0, 2);
    // 2 fillers out of 4 words = 50%
    expect(signals.text.fillerRatio).toBe(0.5);
  });
});
