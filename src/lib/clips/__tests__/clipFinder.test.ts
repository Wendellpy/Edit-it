import { describe, it, expect } from "vitest";
import { findClipCandidates, calculateIntervalOverlapRatio } from "../clipFinder";
import type { HinglishWordToken } from "../../hinglish/postProcessor";

describe("Clip Finder Engine & Ranking", () => {
  function makeSentence(start: number, text: string, end: number): HinglishWordToken[] {
    const words = text.split(" ");
    const dur = (end - start) / words.length;
    return words.map((w, idx) => ({
      id: `tok_${start}_${idx}`,
      text: w,
      romanText: w,
      devanagariText: w,
      start: start + idx * dur,
      end: start + (idx + 1) * dur - 0.05,
      confidence: 0.98,
      isCodeMixedEnglish: true,
    }));
  }

  const mockTokens: HinglishWordToken[] = [
    // 0 - 25s: Boring intro with fillers
    ...makeSentence(0, "um basically matlab welcome everyone to today video.", 25),
    // 26 - 65s: Strong Question Hook
    ...makeSentence(26, "kya aapko pata hai how to grow on youtube fast in 2026.", 65),
    // 66 - 105s: High Energy Comedy Joke
    ...makeSentence(66, "hasna mat this joke is insane and funny and hilarious comedy story suno.", 105),
    // 106 - 150s: Dramatic warning
    ...makeSentence(106, "warning alert never do this biggest mistake in finance.", 150),
    // 151 - 200s: Outro
    ...makeSentence(151, "like and subscribe bye bye.", 200),
  ];

  it("calculates interval overlap ratio accurately", () => {
    // Exact overlap: [0, 40] and [0, 40] -> 1.0
    expect(calculateIntervalOverlapRatio(0, 40, 0, 40)).toBe(1.0);
    // Disjoint: [0, 20] and [30, 50] -> 0.0
    expect(calculateIntervalOverlapRatio(0, 20, 30, 50)).toBe(0.0);
    // Partial: [0, 30] and [15, 45] -> overlap 15 / min(30, 30) = 0.5
    expect(calculateIntervalOverlapRatio(0, 30, 15, 45)).toBe(0.5);
  });

  it("finds top clip candidates with transparent scores and reasons", () => {
    const candidates = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      preset: "balanced",
      constraints: { topN: 3 },
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(3);

    for (const cand of candidates) {
      expect(cand.score).toBeGreaterThanOrEqual(0);
      expect(cand.score).toBeLessThanOrEqual(100);
      expect(cand.duration).toBeGreaterThanOrEqual(15);
      expect(cand.duration).toBeLessThanOrEqual(90);
      expect(Array.isArray(cand.reasons)).toBe(true);
      expect(cand.reasons.length).toBeGreaterThan(0);
    }
  });

  it("de-duplicates overlapping candidate intervals (IoU < 0.25)", () => {
    const candidates = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      preset: "balanced",
      constraints: { topN: 6, maxOverlapIoU: 0.25 },
    });

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const overlap = calculateIntervalOverlapRatio(
          candidates[i].start,
          candidates[i].end,
          candidates[j].start,
          candidates[j].end
        );
        expect(overlap).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it("prioritizes comedy moments under 'funny' preset and warnings under 'dramatic'", () => {
    const funnyClips = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      preset: "funny",
      constraints: { topN: 2 },
    });

    const dramaticClips = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      preset: "dramatic",
      constraints: { topN: 2 },
    });

    // Funny preset should rank comedy/joke section highly
    const funnyText = funnyClips.map((c) => (c.headline + " " + c.firstSentence).toLowerCase()).join(" ");
    expect(funnyText).toMatch(/(hasna\s+mat|joke|funny|hilarious|comedy)/);

    // Dramatic preset should rank warning/mistake section highly
    const dramaticText = dramaticClips.map((c) => (c.headline + " " + c.firstSentence).toLowerCase()).join(" ");
    expect(dramaticText).toMatch(/(warning|mistake|changes)/);
  });
});
