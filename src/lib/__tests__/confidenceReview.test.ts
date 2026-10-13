import { describe, it, expect } from "vitest";
import {
  evaluateWordConfidence,
  getLowConfidenceWordIndices,
  getNextReviewIndex,
  getPrevReviewIndex,
} from "../confidenceReview";
import type { WordToken } from "../timestampRefiner";

describe("confidenceReview", () => {
  it("should categorize confidence into high, medium, low", () => {
    expect(evaluateWordConfidence(0.95).level).toBe("high");
    expect(evaluateWordConfidence(0.8).level).toBe("medium");
    expect(evaluateWordConfidence(0.6).level).toBe("low");
  });

  it("should extract low confidence word indices and navigate cyclically", () => {
    const words: WordToken[] = [
      { id: "1", text: "word1", start: 0, end: 0.5, confidence: 0.95 },
      { id: "2", text: "word2", start: 0.5, end: 1.0, confidence: 0.72 }, // Flagged index 1
      { id: "3", text: "word3", start: 1.0, end: 1.5, confidence: 0.98 },
      { id: "4", text: "word4", start: 1.5, end: 2.0, confidence: 0.65 }, // Flagged index 3
    ];

    const lowIndices = getLowConfidenceWordIndices(words, 0.85);
    expect(lowIndices).toEqual([1, 3]);

    // From word index 0, next flagged should be 1
    expect(getNextReviewIndex(0, lowIndices)).toBe(1);

    // From word index 1, next flagged should be 3
    expect(getNextReviewIndex(1, lowIndices)).toBe(3);

    // From word index 3, wrap around to 1
    expect(getNextReviewIndex(3, lowIndices)).toBe(1);

    // From word index 1, prev flagged should wrap to 3
    expect(getPrevReviewIndex(1, lowIndices)).toBe(3);
  });
});
