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
      expect(cand.viralBreakdown).toBeDefined();
      expect(cand.viralBreakdown?.retentionScore).toBeGreaterThan(0);
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

  it("ranks viral high-energy moments highest under 'viral' preset with rich badges", () => {
    // 200s audio track with an explosive peak at 75s (during joke/story)
    const rmsPeaks = new Float32Array(20000);
    rmsPeaks.fill(0.08);
    // Peak energy burst at 75s (bin 7500)
    for (let b = 7400; b < 7600; b++) {
      rmsPeaks[b] = 0.55;
    }

    const viralClips = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      rmsPeaks,
      preset: "viral",
      constraints: { topN: 3 },
    });

    expect(viralClips.length).toBeGreaterThan(0);
    const topClip = viralClips[0];
    expect(topClip.score).toBeGreaterThanOrEqual(75);
    expect(topClip.viralBreakdown).toBeDefined();
    expect(topClip.viralBreakdown?.viralBadges).toBeDefined();
    expect(topClip.viralBreakdown?.viralBadges.length).toBeGreaterThan(0);
  });

  it("discovers clips using audio peak-seeded hotspots even in long videos", () => {
    // A long video where a massive reaction occurs at 130s
    const rmsPeaks = new Float32Array(20000);
    rmsPeaks.fill(0.06);
    // Huge peak at 130s
    for (let b = 12900; b < 13100; b++) {
      rmsPeaks[b] = 0.65;
    }

    const candidates = findClipCandidates({
      tokens: mockTokens,
      durationSeconds: 200,
      rmsPeaks,
      preset: "viral",
      constraints: { topN: 4 },
    });

    // One of the discovered candidates should span around 130s
    const hasHotspotClip = candidates.some((c) => c.start <= 130 && c.end >= 130);
    expect(hasHotspotClip).toBe(true);
  });
});
