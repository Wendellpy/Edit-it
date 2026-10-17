/**
 * Clip Candidate Discovery & Ranking Engine
 * Finds the highest-potential clip candidates, scores them transparently based on
 * presets, de-duplicates overlapping intervals (IoU < 0.25), and spreads the top N picks across the video.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import { segmentIntoSentences, snapToSentenceBoundaries, type SentenceUnit } from "./boundarySnapper";
import { extractSignalsForSegment, type ExtractedSignals, type ViralBreakdown } from "./signalExtractor";
import {
  SCORING_PRESETS,
  DEFAULT_CLIP_CONSTRAINTS,
  type ClipStylePreset,
  type ClipConstraints,
} from "./scoringConfig";

export interface ClipCandidate {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  score: number; // 0 to 100 ("Clip potential")
  rawScore: number;
  headline: string; // Hook phrase or first sentence
  firstSentence: string;
  lastSentence: string;
  reasons: string[];
  hookType: string;
  tokens: HinglishWordToken[];
  signals: ExtractedSignals;
  viralBreakdown?: ViralBreakdown;
  customTemplateId?: string;
  customEnableKeywords?: boolean;
  customEnableEmojis?: boolean;
  customRemoveFillers?: boolean;
  customReframeMode?: "9:16_auto" | "16:9_fit_blur" | "original";
}

export interface FindClipsOptions {
  tokens: HinglishWordToken[];
  durationSeconds: number;
  rmsPeaks?: Float32Array;
  preset?: ClipStylePreset;
  constraints?: Partial<ClipConstraints>;
}

/**
 * Calculates overlap ratio between two time intervals.
 */
export function calculateIntervalOverlapRatio(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  if (overlap === 0) return 0;

  const minDuration = Math.min(endA - startA, endB - startB);
  return overlap / minDuration;
}

/**
 * Discovers and ranks the top Shorts-ready clip moments in a video.
 */
export function findClipCandidates(options: FindClipsOptions): ClipCandidate[] {
  const {
    tokens,
    durationSeconds,
    rmsPeaks,
    preset = "viral",
    constraints: customConstraints,
  } = options;

  if (!tokens || tokens.length === 0) return [];

  const constraints: ClipConstraints = {
    ...DEFAULT_CLIP_CONSTRAINTS,
    ...customConstraints,
  };

  const weights = SCORING_PRESETS[preset] || SCORING_PRESETS.viral || SCORING_PRESETS.balanced;
  const sentences = segmentIntoSentences(tokens);

  if (sentences.length === 0) return [];

  // Calculate audio track global baseline
  let videoMeanRms = 0.08;
  const audioHotspots: number[] = [];

  if (rmsPeaks && rmsPeaks.length > 0) {
    let sum = 0;
    for (let i = 0; i < rmsPeaks.length; i++) {
      sum += rmsPeaks[i];
    }
    videoMeanRms = sum / rmsPeaks.length;

    let varianceSum = 0;
    for (let i = 0; i < rmsPeaks.length; i++) {
      const diff = rmsPeaks[i] - videoMeanRms;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / rmsPeaks.length);
    const peakThreshold = Math.max(0.18, videoMeanRms + 1.2 * stdDev);

    // Find local maxima separated by at least 4 seconds (400 bins of 10ms)
    let lastHotspotBin = -400;
    for (let i = 50; i < rmsPeaks.length - 50; i++) {
      const val = rmsPeaks[i];
      if (val >= peakThreshold && val > rmsPeaks[i - 1] && val >= rmsPeaks[i + 1]) {
        if (i - lastHotspotBin >= 400) {
          audioHotspots.push(i / 100);
          lastHotspotBin = i;
        }
      }
    }
  }

  const rawCandidates: ClipCandidate[] = [];
  const evaluatedSpans = new Set<string>();

  // Helper to evaluate a candidate window [candidateStart, candidateEnd]
  const evaluateCandidateSpan = (candidateStart: number, candidateEnd: number) => {
    const snapped = snapToSentenceBoundaries(
      sentences,
      candidateStart,
      candidateEnd,
      constraints.minDurationSeconds,
      constraints.maxDurationSeconds
    );

    if (!snapped) return;

    const spanKey = `${Math.round(snapped.start * 10)}_${Math.round(snapped.end * 10)}`;
    if (evaluatedSpans.has(spanKey)) return;
    evaluatedSpans.add(spanKey);

    // Opening sentence signals
    const firstSentenceUnit = snapped.sentenceUnits[0];
    const startSignals = extractSignalsForSegment(
      firstSentenceUnit.tokens,
      firstSentenceUnit.start,
      firstSentenceUnit.end,
      rmsPeaks,
      videoMeanRms
    );

    // Multimodal signals for the full snapped clip
    const signals = extractSignalsForSegment(
      snapped.tokens,
      snapped.start,
      snapped.end,
      rmsPeaks,
      videoMeanRms
    );

    // Compute transparent weighted score
    let score = 30; // baseline

    // 1. Hook score
    if (startSignals.text.hookType !== "none") {
      score += 25; // Premium for opening directly on a hook!
      signals.reasons.push(`Direct hook opening ("${startSignals.text.hookPhrase || startSignals.text.hookType}")`);
    }

    if (signals.text.hookType === "bold_claim") {
      score += weights.boldClaim;
    } else if (signals.text.hookType === "question") {
      score += weights.questionOpener;
    } else if (signals.text.hookType === "number") {
      score += weights.numberHook;
    } else if (signals.text.hookType === "contrast") {
      score += weights.contrastHook;
    } else if (signals.text.hookType === "story") {
      score += weights.storyOpener;
    }

    // High first 3-second hook retention bonus
    if ((signals.text.hookRetentionScore ?? 0) >= 70) {
      score += ((signals.text.hookRetentionScore ?? 0) / 100) * (weights.hookRetention ?? 30);
    }

    // 2. Audio dynamics & vocal energy
    if (signals.audio.avgRms > 0.20 || signals.audio.peakRms > 0.35) {
      score += weights.audioLoudnessPeak;
      signals.reasons.push("High vocal confidence & energy");
    }
    if (signals.audio.dynamicRange > 2.0) {
      score += weights.audioLoudnessPeak * 0.4;
    }
    if (signals.audio.hasLaughterOrCheer) {
      score += weights.laughterOrCheer;
    }
    if ((signals.audio.sustainedEnergyRatio ?? 0) >= 0.35) {
      score += weights.sustainedEnergy ?? 25;
    }
    if ((signals.audio.energyCrescendoScore ?? 1.0) >= 1.25 && signals.audio.avgRms >= 0.12) {
      score += weights.energyCrescendo ?? 35;
    }

    // 3. Optimal speech cadence (140-190 WPM)
    if (signals.audio.speechPaceWpm >= 140 && signals.audio.speechPaceWpm <= 190) {
      score += weights.speechPaceOptimal;
    } else if (signals.audio.speechPaceWpm < 110) {
      score -= 8;
    }

    // 4. Content density & sentiment
    score += signals.text.keywordDensity * weights.keywordDensity;
    if (signals.text.sentimentIntensity > 0) {
      score += (signals.text.sentimentIntensity / 100) * weights.sentimentIntensity;
    }

    // 5. Complete thought & Payoff resolution bonus
    if (snapped.isCompleteThought) {
      score += 10;
      signals.reasons.push("Concludes on a complete thought");
    }
    if (signals.text.hasPayoff) {
      score += weights.payoffEnding ?? 35;
    }

    // 6. Duration sweet spot bonus
    if (
      snapped.duration >= constraints.preferredMinSeconds &&
      snapped.duration <= constraints.preferredMaxSeconds
    ) {
      score += 15;
      signals.reasons.push(`Optimal length (${Math.round(snapped.duration)}s)`);
    } else {
      score -= 10;
    }

    // 7. Dead air penalty
    if ((signals.audio.deadAirRatio ?? 0) > 0.15) {
      const deadPenalty = (signals.audio.deadAirRatio ?? 0) * 100 * (weights.deadAirPenaltyWeight ?? 1.5);
      score -= deadPenalty;
    }

    // 8. Filler word penalty
    const fillerPenalty = signals.text.fillerRatio * 100 * weights.fillerPenaltyWeight;
    score -= fillerPenalty;
    if (signals.text.fillerRatio > 0.08) {
      signals.reasons.push(`High filler ratio penalty (-${Math.round(fillerPenalty)})`);
    }

    // 9. Preset-specific multiplier boosts
    if (preset === "viral") {
      if (
        (signals.viralBreakdown?.retentionScore ?? 0) >= 75 ||
        Boolean(signals.viralBreakdown?.energyCrescendo) ||
        signals.text.hasPayoff ||
        signals.audio.hasLaughterOrCheer
      ) {
        score += 40;
      }
    } else if (preset === "funny") {
      if (
        signals.text.sentimentCategory === "funny" ||
        signals.reasons.some(
          (r) =>
            r.toLowerCase().includes("entertainment") ||
            r.toLowerCase().includes("burst") ||
            r.toLowerCase().includes("comedy")
        )
      ) {
        score += 35;
      }
    } else if (preset === "dramatic") {
      if (
        signals.text.sentimentCategory === "dramatic" ||
        signals.reasons.some(
          (r) =>
            r.toLowerCase().includes("dramatic") ||
            r.toLowerCase().includes("bold") ||
            r.toLowerCase().includes("warning")
        )
      ) {
        score += 35;
      }
    } else if (preset === "informative") {
      if (
        signals.text.hookType === "number" ||
        signals.text.hookType === "question" ||
        signals.text.keywordDensity > 0.22
      ) {
        score += 35;
      }
    }

    // Clamp score to [0, 100]
    const finalScore = Math.max(5, Math.min(100, Math.round(score)));

    const firstSentenceText = snapped.sentenceUnits[0]?.text || "";
    const lastSentenceText = snapped.sentenceUnits[snapped.sentenceUnits.length - 1]?.text || "";

    // Headline defaults to hook phrase or first 8 words of opener
    const rawHeadline = signals.text.hookPhrase
      ? signals.text.hookPhrase
      : firstSentenceText.split(" ").slice(0, 8).join(" ") + "...";

    const headline =
      rawHeadline
        .replace(/&gt;/gi, "")
        .replace(/>+/g, "")
        .replace(/^[\s,.-]+/, "")
        .trim() || "Short Clip";

    rawCandidates.push({
      id: `cand_${Math.round(snapped.start)}_${Math.round(snapped.end)}_${Date.now()}`,
      index: 0,
      start: snapped.start,
      end: snapped.end,
      duration: Math.round(snapped.duration * 10) / 10,
      score: finalScore,
      rawScore: score,
      headline,
      firstSentence: firstSentenceText,
      lastSentence: lastSentenceText,
      reasons: signals.reasons,
      hookType: signals.text.hookType,
      tokens: snapped.tokens,
      signals,
      viralBreakdown: signals.viralBreakdown,
    });
  };

  // -------------------------------------------------------------------------
  // Strategy 1: Audio Peak-Seeded Candidates
  // High-energy audio spikes (laughter, screaming, cheers, revelations)
  // are anchored into candidate windows so viral peaks are guaranteed to be evaluated!
  // -------------------------------------------------------------------------
  for (const hotspotSec of audioHotspots) {
    // Find sentence containing or directly following this hotspot
    let hotspotSentenceIdx = -1;
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].start <= hotspotSec && sentences[i].end >= hotspotSec) {
        hotspotSentenceIdx = i;
        break;
      } else if (sentences[i].start > hotspotSec) {
        hotspotSentenceIdx = Math.max(0, i - 1);
        break;
      }
    }

    if (hotspotSentenceIdx >= 0) {
      // Evaluate windows that start 0, 1, or 2 sentences before the peak
      for (let offset = 0; offset <= 2; offset++) {
        const startIdx = Math.max(0, hotspotSentenceIdx - offset);
        const candStart = sentences[startIdx].start;
        // Test durations: 20s, 30s, 42s
        for (const dur of [20, 30, 42]) {
          const candEnd = Math.min(durationSeconds, candStart + dur);
          evaluateCandidateSpan(candStart, candEnd);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Grammatical Sentence-Based Candidate Windows
  // Try multiple target durations: 20s, 30s, 42s, 58s
  // -------------------------------------------------------------------------
  const targetDurations = [20, 30, 42, 58];

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const startSentence = sentences[sIdx];
    const candidateStart = startSentence.start;

    // Check if the candidate's opening sentence has hook potential
    const startSignals = extractSignalsForSegment(
      startSentence.tokens,
      startSentence.start,
      startSentence.end,
      rmsPeaks,
      videoMeanRms
    );

    // Skip weak openers filled with filler words if better sentences exist
    const isWeakOpener =
      startSignals.text.hookType === "none" &&
      startSignals.text.fillerRatio > 0.12 &&
      !startSignals.audio.hasLaughterOrCheer &&
      startSignals.text.sentimentIntensity === 0;

    if (isWeakOpener && sentences.length > 5) {
      continue;
    }

    for (const targetDur of targetDurations) {
      const candidateEnd = Math.min(durationSeconds, candidateStart + targetDur);
      evaluateCandidateSpan(candidateStart, candidateEnd);
    }
  }

  // Sort by rawScore descending
  rawCandidates.sort((a, b) => b.rawScore - a.rawScore);

  // De-duplicate overlapping candidates (IoU / Overlap > 0.25)
  const deduplicated: ClipCandidate[] = [];

  for (const cand of rawCandidates) {
    let hasConflict = false;
    for (const chosen of deduplicated) {
      const overlapRatio = calculateIntervalOverlapRatio(
        cand.start,
        cand.end,
        chosen.start,
        chosen.end
      );
      if (overlapRatio > constraints.maxOverlapIoU) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      deduplicated.push(cand);
    }
  }

  const targetCount = constraints.topN;
  let selected: ClipCandidate[] = [];

  // For shorter videos (<= 300s), pick top-scoring candidates directly
  if (durationSeconds <= 300 || deduplicated.length <= targetCount) {
    selected = deduplicated.slice(0, targetCount);
  } else {
    // For long videos, spread candidates across temporal buckets while maintaining quality threshold
    const topScore = deduplicated[0]?.score || 100;
    const scoreThreshold = Math.max(45, topScore - 30);
    const qualified = deduplicated.filter((c) => c.score >= scoreThreshold);

    if (qualified.length <= targetCount) {
      selected = deduplicated.slice(0, targetCount);
    } else {
      const numBuckets = Math.max(1, targetCount);
      const bucketDuration = durationSeconds / numBuckets;
      const bucketed: ClipCandidate[][] = Array.from({ length: numBuckets }, () => []);

      for (const cand of qualified) {
        const bucketIdx = Math.min(numBuckets - 1, Math.floor(cand.start / bucketDuration));
        bucketed[bucketIdx].push(cand);
      }

      let added = 0;
      let round = 0;
      while (added < targetCount && round < 10) {
        let pickedInRound = false;
        for (let b = 0; b < numBuckets; b++) {
          if (bucketed[b].length > round && selected.length < targetCount) {
            selected.push(bucketed[b][round]);
            added++;
            pickedInRound = true;
          }
        }
        if (!pickedInRound) break;
        round++;
      }

      if (selected.length < targetCount) {
        for (const cand of deduplicated) {
          if (!selected.some((s) => s.id === cand.id)) {
            selected.push(cand);
            if (selected.length >= targetCount) break;
          }
        }
      }
    }
  }

  // Sort final selected clips chronologically by start time
  selected.sort((a, b) => a.start - b.start);

  return selected.map((c, i) => ({ ...c, index: i + 1 }));
}
