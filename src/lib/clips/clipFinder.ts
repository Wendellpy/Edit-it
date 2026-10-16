/**
 * Clip Candidate Discovery & Ranking Engine
 * Finds the highest-potential clip candidates, scores them transparently based on
 * presets, de-duplicates overlapping intervals (IoU < 0.25), and spreads the top N picks across the video.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import { segmentIntoSentences, snapToSentenceBoundaries } from "./boundarySnapper";
import { extractSignalsForSegment, type ExtractedSignals } from "./signalExtractor";
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
    preset = "balanced",
    constraints: customConstraints,
  } = options;

  if (!tokens || tokens.length === 0) return [];

  const constraints: ClipConstraints = {
    ...DEFAULT_CLIP_CONSTRAINTS,
    ...customConstraints,
  };

  const weights = SCORING_PRESETS[preset] || SCORING_PRESETS.balanced;
  const sentences = segmentIntoSentences(tokens);

  if (sentences.length === 0) return [];

  const rawCandidates: ClipCandidate[] = [];

  // Generate candidate starting points based on sentence beginnings
  // Try multiple target durations: 30s, 45s, 60s
  const targetDurations = [25, 35, 45, 60];

  for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
    const startSentence = sentences[sIdx];
    const candidateStart = startSentence.start;

    // Check if the candidate's opening sentence has hook potential
    const startSignals = extractSignalsForSegment(
      startSentence.tokens,
      startSentence.start,
      startSentence.end,
      rmsPeaks
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

      const snapped = snapToSentenceBoundaries(
        sentences,
        candidateStart,
        candidateEnd,
        constraints.minDurationSeconds,
        constraints.maxDurationSeconds
      );

      if (!snapped) continue;

      // Extract multimodal signals
      const signals = extractSignalsForSegment(
        snapped.tokens,
        snapped.start,
        snapped.end,
        rmsPeaks
      );

      // Compute transparent weighted score
      let score = 35; // baseline

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

      // 2. Audio dynamics
      if (signals.audio.avgRms > 0.20) {
        score += weights.audioLoudnessPeak;
        signals.reasons.push("High vocal confidence & energy");
      }
      if (signals.audio.dynamicRange > 2.0) {
        score += weights.audioLoudnessPeak * 0.5;
      }
      if (signals.audio.hasLaughterOrCheer) {
        score += weights.laughterOrCheer;
      }

      // 3. Optimal speech cadence (140-185 WPM)
      if (signals.audio.speechPaceWpm >= 140 && signals.audio.speechPaceWpm <= 185) {
        score += weights.speechPaceOptimal;
      } else if (signals.audio.speechPaceWpm < 110) {
        score -= 5;
      }

      // 4. Content density & sentiment
      score += signals.text.keywordDensity * weights.keywordDensity;
      if (signals.text.sentimentIntensity > 0) {
        score += (signals.text.sentimentIntensity / 100) * weights.sentimentIntensity;
      }

      // 5. Complete thought bonus
      if (snapped.isCompleteThought) {
        score += 10;
        signals.reasons.push("Concludes on a complete thought");
      }

      // 6. Duration sweet spot bonus (20s - 60s)
      if (
        snapped.duration >= constraints.preferredMinSeconds &&
        snapped.duration <= constraints.preferredMaxSeconds
      ) {
        score += 15;
        signals.reasons.push(`Optimal length (${Math.round(snapped.duration)}s)`);
      } else {
        score -= 10;
      }

      // 7. Filler word penalty
      const fillerPenalty = signals.text.fillerRatio * 100 * weights.fillerPenaltyWeight;
      score -= fillerPenalty;
      if (signals.text.fillerRatio > 0.08) {
        signals.reasons.push(`High filler ratio penalty (-${Math.round(fillerPenalty)})`);
      }

      // 8. Preset-specific multiplier boosts
      if (preset === "funny") {
        if (
          signals.text.sentimentCategory === "funny" ||
          signals.reasons.some((r) => r.toLowerCase().includes("entertainment") || r.toLowerCase().includes("burst") || r.toLowerCase().includes("comedy"))
        ) {
          score += 35;
        }
      } else if (preset === "dramatic") {
        if (
          signals.text.sentimentCategory === "dramatic" ||
          signals.reasons.some((r) => r.toLowerCase().includes("dramatic") || r.toLowerCase().includes("bold"))
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
      const headline = signals.text.hookPhrase
        ? signals.text.hookPhrase
        : firstSentenceText.split(" ").slice(0, 8).join(" ") + "...";

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
      });
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
