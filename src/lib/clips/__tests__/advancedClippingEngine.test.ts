import { describe, it, expect, beforeEach } from "vitest";
import { generateCandidateSpans, getLocalAudioStats } from "../candidateGenerator";
import {
  segmentIntoSentences,
  snapToContextualBoundaries,
  calculateIntervalOverlapIoU,
  calculateSemanticJaccardSimilarity,
  isDuplicateClip,
  selectTimelineDiverseHighlights,
} from "../boundarySnapper";
import {
  extractLightweightVisualSignals,
  detectCanvasFrameSceneCut,
} from "../visualSignalExtractor";
import {
  recordClipFeedback,
  loadClipFeedbackRecords,
  clearClipFeedbackRecords,
  calculateEvaluationMetrics,
} from "../feedbackStore";
import type { HinglishWordToken } from "../../hinglish/postProcessor";

describe("Advanced Clipping Engine Pipeline (Stage A + Boundaries + Visual + Feedback)", () => {
  beforeEach(() => {
    clearClipFeedbackRecords();
  });

  function makeTokenSentence(start: number, text: string, end: number): HinglishWordToken[] {
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
      isCodeMixedEnglish: false,
    }));
  }

  const sampleTokens: HinglishWordToken[] = [
    ...makeTokenSentence(0, "welcome back to another episode of our podcast.", 15),
    ...makeTokenSentence(15.5, "kya aapko pata hai how AI is actually trained?", 35),
    ...makeTokenSentence(35.5, "the truth is nobody understands the deep weights completely.", 55),
    ...makeTokenSentence(55.5, "ek baar ek researcher ne experiment kiya tha and the result was insane.", 85),
    ...makeTokenSentence(85.5, "toh aakhir me learning yeh hai to always check fundamentals.", 115),
    ...makeTokenSentence(115.5, "thank you guys for watching and see you next time.", 140),
  ];

  it("Stage A: generates multi-scale candidate spans without hard filters", () => {
    const sentences = segmentIntoSentences(sampleTokens);
    expect(sentences.length).toBeGreaterThanOrEqual(5);

    const spans = generateCandidateSpans({
      tokens: sampleTokens,
      sentences,
      durationSeconds: 140,
      minDurationSeconds: 15,
      maxDurationSeconds: 90,
    });

    expect(spans.length).toBeGreaterThan(0);

    // Should include question_and_answer
    const hasQA = spans.some((s) => s.generatorSource === "question_and_answer");
    expect(hasQA).toBe(true);

    // Should include narrative_arc
    const hasNarrative = spans.some((s) => s.generatorSource === "narrative_arc");
    expect(hasNarrative).toBe(true);

    // Should include multi_scale_sweep
    const hasSweep = spans.some((s) => s.generatorSource === "multi_scale_sweep");
    expect(hasSweep).toBe(true);
  });

  it("Stage A: calculates local rolling audio statistics for anomaly detection", () => {
    const rms = new Float32Array(10000); // 100 seconds
    rms.fill(0.05); // low baseline
    // Spike at 40s (bins 3900 to 4100)
    for (let i = 3900; i < 4100; i++) {
      rms[i] = 0.45;
    }

    const baselineStats = getLocalAudioStats(rms, 10, 10);
    expect(baselineStats.localMean).toBeCloseTo(0.05, 2);
    expect(baselineStats.localPeak).toBeCloseTo(0.05, 2);

    const spikeStats = getLocalAudioStats(rms, 40, 10);
    expect(spikeStats.localPeak).toBeCloseTo(0.45, 2);
    expect(spikeStats.localMean).toBeGreaterThan(0.05);
    expect(spikeStats.localStdDev).toBeGreaterThan(0.05);
  });

  it("Boundaries: pre-pads setup context and preserves chunk offsets", () => {
    const sentences = segmentIntoSentences(sampleTokens);

    // Snap to answer sentence (sentence index 2: 35.5 - 55.5) with chunk offset of 1000s
    const snapped = snapToContextualBoundaries({
      sentences,
      targetStart: 35.5,
      targetEnd: 55.5,
      minDuration: 15,
      maxDuration: 60,
      isQuestionAnswer: true,
      chunkOffsetSec: 1000,
    });

    expect(snapped).not.toBeNull();
    // Start should be padded back to sentence index 1 (15.5) + chunk offset (1000) = 1015.5
    expect(snapped!.start).toBeCloseTo(1015.5, 1);
    expect(snapped!.paddedSetup).toBe(true);
    // End timestamp should preserve the 1000s offset
    expect(snapped!.end).toBeGreaterThan(1050);
  });

  it("Boundaries: hybrid deduplication distinguishes adjacent events sharing common words", () => {
    const tokensA = makeTokenSentence(10, "in this first story we discovered how AI works amazingly.", 35);
    const tokensB = makeTokenSentence(36, "in this second story we discovered how finance works amazingly.", 60);

    // Disjoint in time
    const iou = calculateIntervalOverlapIoU(10, 35, 36, 60);
    expect(iou).toBe(0);

    // Jaccard similarity is moderate (~0.5) because of shared phrasing
    const jaccard = calculateSemanticJaccardSimilarity(tokensA, tokensB);
    expect(jaccard).toBeGreaterThan(0.2);

    // Hybrid check must recognize them as distinct clips because temporal overlap is 0
    const isDup = isDuplicateClip(
      { start: 10, end: 35, tokens: tokensA },
      { start: 36, end: 60, tokens: tokensB }
    );
    expect(isDup).toBe(false);
  });

  it("Boundaries: timeline diversity selects highlights across video sectors", () => {
    // 6 candidates across a 600s video
    const candidates = [
      { id: "c1", start: 20, score: 90 },
      { id: "c2", start: 30, score: 88 },
      { id: "c3", start: 40, score: 86 },
      { id: "c4", start: 250, score: 82 },
      { id: "c5", start: 450, score: 79 },
      { id: "c6", start: 520, score: 78 },
    ];

    // Pick top 3 with timeline diversity
    const diverse = selectTimelineDiverseHighlights(candidates, 3, 600);
    expect(diverse.length).toBe(3);

    // Rather than picking c1, c2, c3 (all within first 40s), it should distribute across timeline
    const starts = diverse.map((c) => c.start);
    expect(starts.some((s) => s < 100)).toBe(true);
    expect(starts.some((s) => s >= 200)).toBe(true);
  });

  it("Visual: provides graceful fallback when visual extraction is unsupported", async () => {
    // Video element is undefined
    const result = await extractLightweightVisualSignals(undefined as any, 10, 30);
    expect(result.visualScore).toBeUndefined();
    expect(result.sceneCutCount).toBe(0);
    expect(result.cameraMotionRatio).toBe(0);
  });

  it("Visual: detects scene cuts between disparate RGB canvas frames", () => {
    // Frame 1: Pure black
    const frameA = new Uint8ClampedArray(100 * 100 * 4);
    frameA.fill(0);
    for (let i = 3; i < frameA.length; i += 4) frameA[i] = 255;

    // Frame 2: Pure white
    const frameB = new Uint8ClampedArray(100 * 100 * 4);
    frameB.fill(255);

    const isCut = detectCanvasFrameSceneCut(frameA, frameB, 0.25);
    expect(isCut).toBe(true);

    // Frame 3: Identical to Frame 2 -> Not a scene cut
    const isNotCut = detectCanvasFrameSceneCut(frameB, frameB, 0.25);
    expect(isNotCut).toBe(false);
  });

  it("Feedback & Evaluation: saves records and computes Precision@K, Recall@K, and diversity metrics", () => {
    recordClipFeedback({
      videoId: "vid_test_1",
      clipStart: 15,
      clipEnd: 45,
      rating: "good_clip",
      comment: "Super funny moment",
    });

    recordClipFeedback({
      videoId: "vid_test_1",
      clipStart: 60,
      clipEnd: 85,
      rating: "bad_clip",
      comment: "Boring talking head",
    });

    recordClipFeedback({
      videoId: "vid_test_1",
      clipStart: 120,
      clipEnd: 150,
      rating: "missed_highlight",
      comment: "Missed the crazy twist",
    });

    recordClipFeedback({
      videoId: "vid_test_1",
      clipStart: 200,
      clipEnd: 240,
      rating: "bad_boundaries",
      actualBestStart: 195,
      actualBestEnd: 235,
      comment: "Cut off the opening joke",
    });

    const records = loadClipFeedbackRecords();
    expect(records.length).toBe(4);

    const discoveredClips = [
      { start: 15, end: 45 },
      { start: 60, end: 85 },
      { start: 200, end: 240 },
    ];

    const metrics = calculateEvaluationMetrics("vid_test_1", discoveredClips, 300);

    expect(metrics.totalFeedbackCount).toBe(4);
    expect(metrics.precisionAtK).toBeCloseTo(0.67, 1); // 2 good/usable out of 3
    expect(metrics.meanBoundaryDeltaSeconds).toBeGreaterThan(0);
    expect(metrics.timelineDiversityIndex).toBeGreaterThan(0);
  });
});
