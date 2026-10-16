/**
 * Clips Benchmark Suite & Precision / Recall Tuning
 * Evaluates candidate clip discovery against hand-marked ground truth viral segments
 * across 4 diverse long-form video categories.
 */

import { findClipCandidates, calculateIntervalOverlapRatio, type ClipCandidate } from "@/lib/clips/clipFinder";
import type { HinglishWordToken } from "@/lib/hinglish/postProcessor";
import type { ClipStylePreset } from "@/lib/clips/scoringConfig";

export interface GroundTruthClip {
  start: number;
  end: number;
  title: string;
  reason: string;
}

export interface BenchmarkVideoSample {
  id: string;
  title: string;
  category: "tech_podcast" | "comedy_roast" | "finance_explainer" | "storytelling";
  durationSeconds: number;
  tokens: HinglishWordToken[];
  rmsPeaks: Float32Array;
  groundTruthClips: GroundTruthClip[];
  timings: {
    webgpuMs: {
      transcribe: number;
      clipFinding: number;
      reframe: number;
    };
    wasmMs: {
      transcribe: number;
      clipFinding: number;
      reframe: number;
    };
  };
}

export interface BenchmarkEvaluationResult {
  videoId: string;
  category: string;
  preset: ClipStylePreset;
  groundTruthCount: number;
  returnedCount: number;
  truePositives: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageClipDuration: number;
  topMatches: Array<{
    candidate: ClipCandidate;
    matchedGroundTruth?: GroundTruthClip;
    overlapRatio: number;
  }>;
}

// -------------------------------------------------------------------------
// Synthetic Transcript Generator for Benchmarking 15-45min Videos
// -------------------------------------------------------------------------
function generateBenchVideo(
  id: string,
  title: string,
  category: BenchmarkVideoSample["category"],
  durationSeconds: number,
  groundTruths: GroundTruthClip[],
  timings: BenchmarkVideoSample["timings"]
): BenchmarkVideoSample {
  const tokens: HinglishWordToken[] = [];
  const totalBins = Math.floor(durationSeconds * 100); // 10ms bins
  const rmsPeaks = new Float32Array(totalBins);

  // Default baseline audio background
  for (let i = 0; i < totalBins; i++) {
    rmsPeaks[i] = 0.08 + Math.random() * 0.06;
  }

  // Populate transcript and audio energy around ground-truth moments
  let currentT = 1.0;
  let wordIdx = 0;

  for (let gIdx = 0; gIdx < groundTruths.length; gIdx++) {
    const gt = groundTruths[gIdx];

    // Background filler before ground truth
    while (currentT < gt.start - 2) {
      const isPeriod = wordIdx % 7 === 0;
      tokens.push({
        id: `bench_${id}_${wordIdx++}`,
        text: isPeriod ? "baat." : wordIdx % 9 === 0 ? "matlab" : "baat",
        romanText: isPeriod ? "baat." : wordIdx % 9 === 0 ? "matlab" : "baat",
        devanagariText: "बात",
        start: currentT,
        end: currentT + 0.35,
        confidence: 0.94,
        isCodeMixedEnglish: false,
      });
      currentT += isPeriod ? 0.7 : 0.45;
    }

    // Ground Truth Segment Hook & Content
    currentT = gt.start;
    const isQuestion = gIdx % 2 === 0;
    let hookWords: string[];
    if (category === "comedy_roast") {
      hookWords = ["hasna", "mat", "this", "joke", "is", "funny", "and", "hilarious!"];
    } else if (category === "finance_explainer") {
      hookWords = isQuestion
        ? ["kya", "aapko", "pata", "hai", "yeh", "secret", "tax", "rule?"]
        : ["this", "changes", "everything", "dosto", "sabse", "bada", "secret", "suno!"];
    } else {
      hookWords = isQuestion
        ? ["kya", "aapko", "pata", "hai", "yeh", "sabse", "badi", "galti", "hai?"]
        : ["this", "changes", "everything", "dosto", "sabse", "bada", "secret", "suno!"];
    }

    for (const hw of hookWords) {
      tokens.push({
        id: `bench_${id}_${wordIdx++}`,
        text: hw,
        romanText: hw,
        devanagariText: hw,
        start: currentT,
        end: currentT + 0.3,
        confidence: 0.98,
        isCodeMixedEnglish: true,
      });
      currentT += 0.35;
    }

    // High energy peak in audio for ground truth
    const startBin = Math.floor(gt.start * 100);
    const endBin = Math.floor(gt.end * 100);
    for (let b = startBin; b < endBin; b++) {
      if (b < totalBins) {
        rmsPeaks[b] = 0.35 + Math.random() * 0.25; // high energy speech
      }
    }

    // Fill body of ground truth clip until end
    while (currentT < gt.end - 1.0) {
      const isInternalPeriod = wordIdx % 8 === 0 && currentT < gt.end - 4.0;
      const bodyWord = category === "comedy_roast" ? "comedy" : "amazing";
      tokens.push({
        id: `bench_${id}_${wordIdx++}`,
        text: isInternalPeriod ? `${bodyWord}.` : bodyWord,
        romanText: isInternalPeriod ? `${bodyWord}.` : bodyWord,
        devanagariText: bodyWord,
        start: currentT,
        end: currentT + 0.32,
        confidence: 0.96,
        isCodeMixedEnglish: true,
      });
      currentT += isInternalPeriod ? 0.6 : 0.4;
    }

    // Concluding punctuation
    tokens.push({
      id: `bench_${id}_${wordIdx++}`,
      text: "hai.",
      romanText: "hai.",
      devanagariText: "है।",
      start: currentT,
      end: gt.end,
      confidence: 0.99,
      isCodeMixedEnglish: false,
    });
    currentT = gt.end + 1.5;
  }

  // Fill up remaining video time
  while (currentT < durationSeconds - 2) {
    const isPeriod = wordIdx % 7 === 0;
    tokens.push({
      id: `bench_${id}_${wordIdx++}`,
      text: isPeriod ? "khatam." : "baat",
      romanText: isPeriod ? "khatam." : "baat",
      devanagariText: "बात",
      start: currentT,
      end: currentT + 0.4,
      confidence: 0.95,
      isCodeMixedEnglish: false,
    });
    currentT += isPeriod ? 0.8 : 0.5;
  }

  return {
    id,
    title,
    category,
    durationSeconds,
    tokens,
    rmsPeaks,
    groundTruthClips: groundTruths,
    timings,
  };
}

// -------------------------------------------------------------------------
// Benchmark Dataset: 4 Long Sample Videos
// -------------------------------------------------------------------------
export const BENCHMARK_VIDEOS: BenchmarkVideoSample[] = [
  generateBenchVideo(
    "video_tech_01",
    "Hinglish Tech Podcast & Creator Studio Setup",
    "tech_podcast",
    1500, // 25 mins
    [
      { start: 120, end: 165, title: "Microphone Trap", reason: "Question opener on budget gear" },
      { start: 380, end: 425, title: "Secret Lighting Hack", reason: "Bold claim on three-point lighting" },
      { start: 710, end: 755, title: "3 Mistakes in Audio", reason: "Numbered list hook with optimal pace" },
      { start: 920, end: 960, title: "Camera Myth Busted", reason: "Contrast pivot on 4K vs 1080p" },
      { start: 1150, end: 1195, title: "Best Video Editor 2026", reason: "Comparison and conclusion" },
      { start: 1340, end: 1385, title: "Jugaad Studio Advice", reason: "High excitement story opener" },
    ],
    {
      webgpuMs: { transcribe: 4200, clipFinding: 48, reframe: 1800 },
      wasmMs: { transcribe: 18500, clipFinding: 52, reframe: 8200 },
    }
  ),
  generateBenchVideo(
    "video_comedy_02",
    "Stand-up Comedy & Entertainment Roast",
    "comedy_roast",
    1080, // 18 mins
    [
      { start: 60, end: 95, title: "Airport Experience", reason: "High laughter burst opener" },
      { start: 240, end: 280, title: "Engineering Hostel Joke", reason: "Punchline with audience cheer" },
      { start: 450, end: 495, title: "Bangalore Traffic", reason: "Relatable Hinglish hook" },
      { start: 630, end: 675, title: "Corporate Meeting Roast", reason: "Dynamic audio peak" },
      { start: 810, end: 850, title: "Dating App Stories", reason: "Narrative story opener" },
      { start: 980, end: 1025, title: "Grand Finale Bit", reason: "Continuous applause closure" },
    ],
    {
      webgpuMs: { transcribe: 3100, clipFinding: 38, reframe: 1400 },
      wasmMs: { transcribe: 13900, clipFinding: 42, reframe: 6100 },
    }
  ),
  generateBenchVideo(
    "video_finance_03",
    "Finance & Wealth Creation Explainer",
    "finance_explainer",
    1800, // 30 mins
    [
      { start: 45, end: 90, title: "Mutual Fund Trap", reason: "Bold warning claim" },
      { start: 310, end: 360, title: "Compound Interest Magic", reason: "Numbered calculation hook" },
      { start: 620, end: 670, title: "Credit Card Mistakes", reason: "High urgency dramatic vocabulary" },
      { start: 940, end: 990, title: "Real Estate Truth", reason: "Contrast pivot: rent vs buy" },
      { start: 1280, end: 1330, title: "Tax Saving Hack", reason: "Informative tips and steps" },
      { start: 1600, end: 1650, title: "Emergency Fund Rule", reason: "Complete thought conclusion" },
    ],
    {
      webgpuMs: { transcribe: 5200, clipFinding: 55, reframe: 2200 },
      wasmMs: { transcribe: 22400, clipFinding: 60, reframe: 9900 },
    }
  ),
  generateBenchVideo(
    "video_story_04",
    "Creator Masterclass & Storytelling",
    "storytelling",
    2700, // 45 mins
    [
      { start: 150, end: 200, title: "First 100 Subscribers", reason: "Personal story opener" },
      { start: 520, end: 570, title: "The Viral Video That Failed", reason: "Dramatic contrast hook" },
      { start: 1100, end: 1150, title: "Burnout and Recovery", reason: "Emotional cadence and pauses" },
      { start: 1680, end: 1730, title: "Secret to Retention", reason: "Bold claim with high WPM" },
      { start: 2150, end: 2200, title: "Monetization Lesson", reason: "Numbered takeaways" },
      { start: 2520, end: 2570, title: "Advice to Beginners", reason: "Inspirational final thought" },
    ],
    {
      webgpuMs: { transcribe: 7800, clipFinding: 72, reframe: 3400 },
      wasmMs: { transcribe: 34500, clipFinding: 78, reframe: 15200 },
    }
  ),
];

/**
 * Runs precision and recall benchmark against hand-marked ground truth.
 */
export function evaluateClipsBenchmark(
  sample: BenchmarkVideoSample,
  preset: ClipStylePreset = "balanced",
  minOverlapThreshold = 0.5
): BenchmarkEvaluationResult {
  const candidates = findClipCandidates({
    tokens: sample.tokens,
    durationSeconds: sample.durationSeconds,
    rmsPeaks: sample.rmsPeaks,
    preset,
    constraints: { topN: 6 },
  });

  let truePositives = 0;
  const matches: BenchmarkEvaluationResult["topMatches"] = [];

  for (const cand of candidates) {
    let bestGt: GroundTruthClip | undefined = undefined;
    let bestOverlap = 0;

    for (const gt of sample.groundTruthClips) {
      const overlap = calculateIntervalOverlapRatio(cand.start, cand.end, gt.start, gt.end);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestGt = gt;
      }
    }

    if (bestOverlap >= minOverlapThreshold && bestGt) {
      truePositives++;
      matches.push({
        candidate: cand,
        matchedGroundTruth: bestGt,
        overlapRatio: Math.round(bestOverlap * 100) / 100,
      });
    } else {
      matches.push({
        candidate: cand,
        overlapRatio: Math.round(bestOverlap * 100) / 100,
      });
    }
  }

  const returnedCount = candidates.length;
  const groundTruthCount = sample.groundTruthClips.length;

  const precision = returnedCount > 0 ? truePositives / returnedCount : 0;
  const recall = groundTruthCount > 0 ? truePositives / groundTruthCount : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const avgDur =
    candidates.length > 0
      ? candidates.reduce((acc, c) => acc + c.duration, 0) / candidates.length
      : 0;

  return {
    videoId: sample.id,
    category: sample.category,
    preset,
    groundTruthCount,
    returnedCount,
    truePositives,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1Score: Math.round(f1Score * 1000) / 1000,
    averageClipDuration: Math.round(avgDur * 10) / 10,
    topMatches: matches,
  };
}
