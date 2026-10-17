import { describe, it, expect } from "vitest";
import { segmentIntoSentences, snapToSentenceBoundaries } from "../boundarySnapper";
import type { HinglishWordToken } from "../../hinglish/postProcessor";

describe("Boundary Snapper & Complete Thought Aligner", () => {
  const sampleTokens: HinglishWordToken[] = [
    // Sentence 1 (0.0 - 5.0)
    { id: "1", text: "Welcome", romanText: "Welcome", devanagariText: "Welcome", start: 0.0, end: 0.8, confidence: 0.99, isCodeMixedEnglish: true },
    { id: "2", text: "to", romanText: "to", devanagariText: "to", start: 0.9, end: 1.2, confidence: 0.99, isCodeMixedEnglish: true },
    { id: "3", text: "this", romanText: "this", devanagariText: "this", start: 1.3, end: 1.8, confidence: 0.99, isCodeMixedEnglish: true },
    { id: "4", text: "masterclass.", romanText: "masterclass.", devanagariText: "masterclass.", start: 1.9, end: 3.5, confidence: 0.99, isCodeMixedEnglish: true },

    // Pause 3.5 -> 4.5 (1.0s gap)

    // Sentence 2 (4.5 - 22.0)
    { id: "5", text: "Kya", romanText: "Kya", devanagariText: "क्या", start: 4.5, end: 5.0, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "6", text: "aapko", romanText: "aapko", devanagariText: "आपको", start: 5.1, end: 5.8, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "7", text: "pata", romanText: "pata", devanagariText: "पता", start: 5.9, end: 6.5, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "8", text: "hai", romanText: "hai", devanagariText: "है", start: 6.6, end: 7.2, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "9", text: "sabse", romanText: "sabse", devanagariText: "सबसे", start: 7.3, end: 8.0, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "10", text: "bada", romanText: "bada", devanagariText: "बड़ा", start: 8.1, end: 8.8, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "11", text: "secret?", romanText: "secret?", devanagariText: "secret?", start: 8.9, end: 22.0, confidence: 0.99, isCodeMixedEnglish: true },

    // Sentence 3 (22.5 - 35.0)
    { id: "12", text: "Yeh", romanText: "Yeh", devanagariText: "यह", start: 22.5, end: 23.5, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "13", text: "tarika", romanText: "tarika", devanagariText: "तरीका", start: 23.6, end: 25.0, confidence: 0.99, isCodeMixedEnglish: false },
    { id: "14", text: "hai.", romanText: "hai.", devanagariText: "है।", start: 25.1, end: 35.0, confidence: 0.99, isCodeMixedEnglish: false },
  ];

  it("segments tokens into distinct grammatical sentences by punctuation and pauses", () => {
    const sentences = segmentIntoSentences(sampleTokens);
    expect(sentences.length).toBe(3);
    expect(sentences[0].text).toBe("Welcome to this masterclass.");
    expect(sentences[1].text).toContain("Kya aapko pata hai");
    expect(sentences[2].text).toBe("Yeh tarika hai.");
  });

  it("snaps candidate interval to sentence bounds and preserves duration constraints", () => {
    const sentences = segmentIntoSentences(sampleTokens);
    // Request a window starting arbitrarily at 3.0s and ending at 30.0s
    const snapped = snapToSentenceBoundaries(sentences, 3.0, 30.0, 15, 60);

    expect(snapped).not.toBeNull();
    if (!snapped) return;

    // Must snap start to the nearest sentence (starts at 4.5s)
    expect(snapped.start).toBe(4.5);
    // Must end on complete thought sentence (ends at 35.0s)
    expect(snapped.end).toBe(35.0);
    expect(snapped.duration).toBeGreaterThanOrEqual(15);
    expect(snapped.isCompleteThought).toBe(true);
  });

  it("rejects intervals that cannot meet minimum clip duration", () => {
    const sentences = segmentIntoSentences(sampleTokens);
    // Request only Sentence 1 (duration 3.5s, which is < min 15s)
    const snapped = snapToSentenceBoundaries(sentences, 0.0, 3.5, 15, 60);
    // When snapped to 15s min, it must either expand to include sentences up to 15s or return null if impossible
    if (snapped) {
      expect(snapped.duration).toBeGreaterThanOrEqual(15);
    }
  });

  it("avoids ending on dangling conjunctions like 'and', 'because', 'lekin'", () => {
    const tokensWithDangling: HinglishWordToken[] = [
      // Sentence 1 (0.0 - 16.0)
      { id: "1", text: "First", start: 0.0, end: 5.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "First", devanagariText: "First" },
      { id: "2", text: "point.", start: 5.1, end: 16.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "point.", devanagariText: "point." },
      // Sentence 2 ends in dangling conjunction 'because' (16.5 - 25.0)
      { id: "3", text: "This", start: 16.5, end: 20.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "This", devanagariText: "This" },
      { id: "4", text: "happened", start: 20.1, end: 23.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "happened", devanagariText: "happened" },
      { id: "5", text: "because", start: 23.1, end: 25.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "because", devanagariText: "because" },
      // Sentence 3 resolves the thought (25.5 - 32.0)
      { id: "6", text: "we", start: 25.5, end: 28.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "we", devanagariText: "we" },
      { id: "7", text: "failed.", start: 28.1, end: 32.0, confidence: 0.99, isCodeMixedEnglish: true, romanText: "failed.", devanagariText: "failed." },
    ];

    const sentences = segmentIntoSentences(tokensWithDangling);
    // Request window targeting end at 25.0s (which is Sentence 2 ending in 'because')
    // With max duration 40s, snapper should automatically extend to include Sentence 3 ('we failed.')
    const snapped = snapToSentenceBoundaries(sentences, 0.0, 25.0, 15, 40);
    expect(snapped).not.toBeNull();
    if (!snapped) return;
    expect(snapped.end).toBe(32.0);
    expect(snapped.tokens[snapped.tokens.length - 1].text).toBe("failed.");
  });
});
