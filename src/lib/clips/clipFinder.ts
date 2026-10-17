/**
 * Clip Candidate Discovery & Context-Aware Ranking Engine
 * 
 * Two-Stage Architecture:
 * - Stage A: High-Recall Multi-Scale Candidate Discovery (candidateGenerator.ts)
 *   Detects conversational exchanges, local audio anomalies, pacing shifts,
 *   questions, reveals, and storytelling arcs without hard filters.
 * - Stage B: Context-Aware Candidate Ranking (highlightReranker.ts)
 *   Ranks complete events as standalone clips using multi-modal evidence:
 *   35% Conversational & Semantic Interest
 *   20% Audio Excitement & Reaction Evidence
 *   20% Narrative Structure, Punchline & Payoff
 *   10% Pacing & Delivery
 *   10% Visual Evidence (optional)
 *   5%  Audience Evidence (optional)
 * 
 * Boundary Alignment & Deduplication (boundarySnapper.ts):
 * - Contextual setup pre-padding & reaction post-padding.
 * - Hybrid deduplication (temporal IoU + semantic Jaccard similarity).
 * - Timeline diversity ensuring representation across the full video.
 * 
 * 100% local-first, deterministic, zero mandatory paid APIs.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import {
  segmentIntoSentences,
  snapToContextualBoundaries,
  isDuplicateClip,
  selectTimelineDiverseHighlights,
  type SentenceUnit,
} from "./boundarySnapper";
import {
  extractSignalsForSegment,
  type ExtractedSignals,
  type ViralBreakdown,
} from "./signalExtractor";
import {
  generateCandidateSpans,
  type CandidateSpan,
} from "./candidateGenerator";
import {
  rankHighlightCandidate,
  type RankedScoreBreakdown,
  type HighlightRankingWeights,
} from "./highlightReranker";
import {
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
  rankBreakdown?: RankedScoreBreakdown;
  generatorSource?: string;
  paddedSetup?: boolean;
  paddedReaction?: boolean;
}

export interface FindClipsOptions {
  tokens: HinglishWordToken[];
  durationSeconds: number;
  rmsPeaks?: Float32Array;
  preset?: ClipStylePreset;
  constraints?: Partial<ClipConstraints>;
  visualScore?: number;
  audienceScore?: number;
  customWeights?: Partial<HighlightRankingWeights>;
  chunkOffsetSec?: number;
}

/**
 * Calculates overlap ratio between two time intervals.
 * (Preserved for backwards compatibility with existing benchmark & test suites)
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
 * Discovers and ranks the top Shorts-ready clip moments in a video using
 * the 2-stage High-Recall + Context-Aware Ranking architecture.
 */
export function findClipCandidates(options: FindClipsOptions): ClipCandidate[] {
  const {
    tokens,
    durationSeconds,
    rmsPeaks,
    preset = "viral",
    constraints: customConstraints,
    visualScore,
    audienceScore,
    customWeights,
    chunkOffsetSec = 0,
  } = options;

  if (!tokens || tokens.length === 0) return [];

  const constraints: ClipConstraints = {
    ...DEFAULT_CLIP_CONSTRAINTS,
    ...customConstraints,
  };

  // 1. Grammatical sentence segmentation with pause detection
  const sentences = segmentIntoSentences(tokens);
  if (sentences.length === 0) return [];

  // Calculate audio track global baseline
  let videoMeanRms = 0.08;
  if (rmsPeaks && rmsPeaks.length > 0) {
    let sum = 0;
    for (let i = 0; i < rmsPeaks.length; i++) {
      sum += rmsPeaks[i];
    }
    videoMeanRms = sum / rmsPeaks.length;
  }

  // ---------------------------------------------------------------------------
  // STAGE A: High-Recall Multi-Scale Candidate Discovery
  // Generates broad candidates across conversational exchanges, relative audio
  // anomalies, pacing shifts, question-answers, and storytelling arcs.
  // ---------------------------------------------------------------------------
  const rawSpans = generateCandidateSpans({
    tokens,
    sentences,
    durationSeconds,
    rmsPeaks,
    minDurationSeconds: constraints.minDurationSeconds,
    maxDurationSeconds: constraints.maxDurationSeconds,
  });

  const evaluatedCandidates: ClipCandidate[] = [];
  const evaluatedIntervalKeys = new Set<string>();

  for (const span of rawSpans) {
    // -------------------------------------------------------------------------
    // Boundary Snapping: Contextual Setup Pre-Padding & Reaction Post-Padding
    // -------------------------------------------------------------------------
    const snapped = snapToContextualBoundaries({
      sentences,
      targetStart: span.start,
      targetEnd: span.end,
      minDuration: constraints.minDurationSeconds,
      maxDuration: constraints.maxDurationSeconds,
      hasPunchline: span.generatorSource === "narrative_arc" || span.generatorSource === "emotional_reaction",
      isQuestionAnswer: span.generatorSource === "question_and_answer",
      chunkOffsetSec,
    });

    if (!snapped) continue;

    const intervalKey = `${Math.round(snapped.start * 10)}_${Math.round(snapped.end * 10)}`;
    if (evaluatedIntervalKeys.has(intervalKey)) continue;
    evaluatedIntervalKeys.add(intervalKey);

    // Multimodal Signal Extraction for the full snapped clip
    const signals = extractSignalsForSegment(
      snapped.tokens,
      snapped.start,
      snapped.end,
      rmsPeaks,
      videoMeanRms
    );

    // -------------------------------------------------------------------------
    // STAGE B: Context-Aware Candidate Ranking (highlightReranker.ts)
    // -------------------------------------------------------------------------
    const rankBreakdown = rankHighlightCandidate({
      candidateId: span.id,
      start: snapped.start,
      end: snapped.end,
      duration: snapped.duration,
      sentenceUnits: snapped.sentenceUnits,
      tokens: snapped.tokens,
      signals,
      rmsPeaks,
      videoMeanRms,
      visualScore,
      audienceScore,
      preset,
      customWeights,
    });

    const firstSentenceText = snapped.sentenceUnits[0]?.text || "";
    const lastSentenceText = snapped.sentenceUnits[snapped.sentenceUnits.length - 1]?.text || "";

    // Headline generation: hook phrase or punchy opening words
    const rawHeadline = signals.text.hookPhrase
      ? signals.text.hookPhrase
      : firstSentenceText.split(" ").slice(0, 8).join(" ") + "...";

    const headline =
      rawHeadline
        .replace(/&gt;/gi, "")
        .replace(/>+/g, "")
        .replace(/^[\s,.-]+/, "")
        .trim() || "Short Clip";

    // Combine granular evidence reasons
    const combinedReasons = Array.from(new Set([...signals.reasons, ...rankBreakdown.evidence]));

    evaluatedCandidates.push({
      id: `cand_${Math.round(snapped.start)}_${Math.round(snapped.end)}_${Date.now()}_${span.generatorSource}`,
      index: 0,
      start: snapped.start,
      end: snapped.end,
      duration: Math.round(snapped.duration * 10) / 10,
      score: rankBreakdown.finalScore,
      rawScore: rankBreakdown.finalScore,
      headline,
      firstSentence: firstSentenceText,
      lastSentence: lastSentenceText,
      reasons: combinedReasons,
      hookType: signals.text.hookType,
      tokens: snapped.tokens,
      signals,
      viralBreakdown: signals.viralBreakdown,
      rankBreakdown,
      generatorSource: span.generatorSource,
      paddedSetup: snapped.paddedSetup,
      paddedReaction: snapped.paddedReaction,
    });
  }

  // Sort by final score descending
  evaluatedCandidates.sort((a, b) => b.score - a.score);

  // ---------------------------------------------------------------------------
  // Hybrid Deduplication: Temporal IoU + Semantic Jaccard Similarity
  // Prevents discarding distinct adjacent highlights that share a transitional word
  // ---------------------------------------------------------------------------
  const deduplicated: ClipCandidate[] = [];

  for (const cand of evaluatedCandidates) {
    let hasConflict = false;
    for (const chosen of deduplicated) {
      if (isDuplicateClip(cand, chosen, constraints.maxOverlapIoU, 0.40)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      deduplicated.push(cand);
    }
  }

  // ---------------------------------------------------------------------------
  // Timeline Diversity: Distribute picks across video sectors
  // ---------------------------------------------------------------------------
  const targetCount = constraints.topN;
  const diversePicks = selectTimelineDiverseHighlights(
    deduplicated,
    targetCount,
    durationSeconds
  );

  return diversePicks.map((c, i) => ({ ...c, index: i + 1 }));
}
