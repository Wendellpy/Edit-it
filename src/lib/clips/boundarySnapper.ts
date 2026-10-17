/**
 * Boundary Snapper & Temporal Deduplication for Clip Candidates
 * 
 * Aligns clip start and end timestamps precisely to grammatical sentence boundaries,
 * speech pauses, and setup/payoff context.
 * 
 * Key Capabilities:
 * - Pre-pads setup before a punchline/answer.
 * - Post-pads reaction after a payoff/revelation.
 * - Prevents cutting off words, handling speech pauses cleanly.
 * - Preserves original VOD timestamps & chunk offsets.
 * - Hybrid deduplication using temporal overlap + semantic Jaccard similarity.
 * - Timeline diversity ensuring highlights span the full video.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import { isArtifactWord, cleanCaptionWord } from "../smart/audioCleanup";

export interface SentenceUnit {
  index: number;
  tokens: HinglishWordToken[];
  start: number;
  end: number;
  duration: number;
  text: string;
  hasSentenceEndPunctuation: boolean;
}

export interface SnappedBoundary {
  start: number;
  end: number;
  duration: number;
  sentenceUnits: SentenceUnit[];
  tokens: HinglishWordToken[];
  isCompleteThought: boolean;
  paddedSetup?: boolean;
  paddedReaction?: boolean;
}

export interface ContextualSnapOptions {
  sentences: SentenceUnit[];
  targetStart: number;
  targetEnd: number;
  minDuration?: number; // Default: 15s
  maxDuration?: number; // Default: 90s
  hasPunchline?: boolean;
  isQuestionAnswer?: boolean;
  chunkOffsetSec?: number; // Offset when transcribing in video chunks
}

/**
 * Splits words into natural sentence units using punctuation and speech pause cues.
 */
export function segmentIntoSentences(tokens: HinglishWordToken[]): SentenceUnit[] {
  if (!tokens || tokens.length === 0) return [];

  // Filter artifact markers like >>, >>>, &gt;&gt;, [Music], etc.
  const cleanTokens = tokens
    .filter((t) => t && t.text && !isArtifactWord(t.text))
    .map((t) => {
      const cleaned = cleanCaptionWord(t.text);
      return cleaned && !isArtifactWord(cleaned) ? { ...t, text: cleaned } : null;
    })
    .filter((t): t is HinglishWordToken => t !== null);

  if (cleanTokens.length === 0) return [];

  const sentences: SentenceUnit[] = [];
  let currentTokens: HinglishWordToken[] = [];

  for (let i = 0; i < cleanTokens.length; i++) {
    const token = cleanTokens[i];
    currentTokens.push(token);

    const isLastToken = i === cleanTokens.length - 1;
    const nextToken = !isLastToken ? cleanTokens[i + 1] : null;

    // Boundary conditions:
    // 1. Punctuation at end of word (. ? ! । |)
    const hasPunctuation = /[.?!।|]$/.test(token.text.trim());

    // 2. Speech pause longer than 450ms before next word
    const pauseBeforeNext = nextToken ? nextToken.start - token.end : 0;
    const hasLongPause = pauseBeforeNext >= 0.45;

    // 3. Current sentence is getting sufficiently long (> 8 words) and there is a natural pause (> 300ms)
    const hasNaturalBreak = currentTokens.length >= 8 && pauseBeforeNext >= 0.3;

    if (hasPunctuation || hasLongPause || hasNaturalBreak || isLastToken) {
      const start = currentTokens[0].start;
      const end = currentTokens[currentTokens.length - 1].end;
      sentences.push({
        index: sentences.length,
        tokens: [...currentTokens],
        start,
        end,
        duration: Math.max(0.1, end - start),
        text: currentTokens.map((t) => t.text).join(" "),
        hasSentenceEndPunctuation: hasPunctuation,
      });
      currentTokens = [];
    }
  }

  return sentences;
}

/**
 * Standard boundary snap: Snaps a candidate interval [targetStart, targetEnd]
 * to the nearest clean sentence boundaries.
 */
export function snapToSentenceBoundaries(
  sentences: SentenceUnit[],
  targetStart: number,
  targetEnd: number,
  minDuration = 15,
  maxDuration = 90
): SnappedBoundary | null {
  return snapToContextualBoundaries({
    sentences,
    targetStart,
    targetEnd,
    minDuration,
    maxDuration,
  });
}

/**
 * Contextual Boundary Snapper:
 * Pre-pads setup before a punchline/answer and post-pads reaction laughter/aftermath,
 * while respecting minimum and maximum durations and chunk offsets.
 */
export function snapToContextualBoundaries(
  options: ContextualSnapOptions
): SnappedBoundary | null {
  const {
    sentences,
    targetStart,
    targetEnd,
    minDuration = 15,
    maxDuration = 90,
    hasPunchline = false,
    isQuestionAnswer = false,
    chunkOffsetSec = 0,
  } = options;

  if (sentences.length === 0) return null;

  // Find start sentence index
  let startIdx = 0;
  let minStartDiff = Infinity;
  for (let i = 0; i < sentences.length; i++) {
    const diff = Math.abs(sentences[i].start - targetStart);
    if (diff < minStartDiff) {
      minStartDiff = diff;
      startIdx = i;
    }
  }

  // 1. Setup Pre-padding: If opening on an answer or punchline, look backward for setup
  let paddedSetup = false;
  if (isQuestionAnswer && startIdx > 0) {
    const prior = sentences[startIdx - 1];
    if (prior.text.includes("?") || /^(so|when|why|kya|jab)\b/i.test(prior.text.trim())) {
      const prospectiveDur = (sentences[startIdx].end - prior.start);
      if (prospectiveDur <= maxDuration) {
        startIdx--;
        paddedSetup = true;
      }
    }
  }

  // Find end sentence index
  let endIdx = startIdx;
  let accumulatedDuration = 0;

  for (let i = startIdx; i < sentences.length; i++) {
    const segDur = sentences[i].end - sentences[startIdx].start;
    if (segDur >= minDuration && segDur <= maxDuration) {
      endIdx = i;
      accumulatedDuration = segDur;
      // If we reached or passed targetEnd, stop here
      if (sentences[i].end >= targetEnd) {
        break;
      }
    } else if (segDur > maxDuration) {
      break;
    }
  }

  // 2. Reaction Post-padding: If ending on a punchline, capture reaction sentence if duration permits
  let paddedReaction = false;
  if (hasPunchline && endIdx < sentences.length - 1) {
    const nextSentence = sentences[endIdx + 1];
    const extendedDur = nextSentence.end - sentences[startIdx].start;
    // If the next sentence is short (< 4s) representing reaction/laughter/commentary
    if (extendedDur <= maxDuration && nextSentence.duration <= 4.0) {
      endIdx++;
      paddedReaction = true;
    }
  }

  // 3. Dangling conjunction check: avoid ending on "and", "but", "because", "lekin", etc.
  const DANGLING_CONJUNCTIONS = new Set([
    "and", "but", "because", "so", "or", "then", "which", "that",
    "lekin", "kyunki", "par", "aur", "agar", "toh", "jaise", "ki",
  ]);

  const getLastWord = (text: string) => {
    const parts = text.trim().split(/\s+/);
    return parts[parts.length - 1]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  };

  if (endIdx < sentences.length - 1) {
    const lastWord = getLastWord(sentences[endIdx].text);
    if (DANGLING_CONJUNCTIONS.has(lastWord)) {
      const extendedDur = sentences[endIdx + 1].end - sentences[startIdx].start;
      if (extendedDur <= maxDuration) {
        endIdx++;
      } else if (endIdx > startIdx && sentences[endIdx - 1].end - sentences[startIdx].start >= minDuration) {
        endIdx--;
      }
    }
  }

  const actualStart = sentences[startIdx].start + chunkOffsetSec;
  const actualEnd = sentences[endIdx].end + chunkOffsetSec;
  const duration = actualEnd - actualStart;

  if (duration < minDuration) {
    return null;
  }

  const selectedSentences = sentences.slice(startIdx, endIdx + 1);
  const allTokens = selectedSentences.flatMap((s) =>
    chunkOffsetSec === 0
      ? s.tokens
      : s.tokens.map((t) => ({ ...t, start: t.start + chunkOffsetSec, end: t.end + chunkOffsetSec }))
  );
  const lastSentence = selectedSentences[selectedSentences.length - 1];

  return {
    start: actualStart,
    end: actualEnd,
    duration,
    sentenceUnits: selectedSentences,
    tokens: allTokens,
    isCompleteThought: lastSentence.hasSentenceEndPunctuation || lastSentence.duration > 1.0,
    paddedSetup,
    paddedReaction,
  };
}

/**
 * Calculates temporal Intersection over Union (IoU) between two time intervals.
 */
export function calculateIntervalOverlapIoU(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  if (overlap === 0) return 0;

  const union = Math.max(endA, endB) - Math.min(startA, startB);
  return union > 0 ? overlap / union : 0;
}

/**
 * Calculates Jaccard token similarity between two clips' transcript text.
 * Values range from 0.0 (completely distinct words) to 1.0 (identical words).
 */
export function calculateSemanticJaccardSimilarity(
  tokensA: HinglishWordToken[],
  tokensB: HinglishWordToken[]
): number {
  if (!tokensA || !tokensB || tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(
    tokensA.map((t) => t.text.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((s) => s.length > 2)
  );
  const setB = new Set(
    tokensB.map((t) => t.text.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((s) => s.length > 2)
  );

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount++;
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * Hybrid conflict check: Two candidates conflict if and only if they share
 * substantial temporal overlap AND substantial transcript overlap.
 * This prevents discarding distinct adjacent highlights that share a brief transitional phrase.
 */
export function isDuplicateClip(
  candA: { start: number; end: number; tokens: HinglishWordToken[] },
  candB: { start: number; end: number; tokens: HinglishWordToken[] },
  maxIoU = 0.35,
  maxJaccard = 0.40
): boolean {
  const iou = calculateIntervalOverlapIoU(candA.start, candA.end, candB.start, candB.end);
  if (iou <= 0.15) return false; // Minimal temporal overlap -> distinct clips

  // If temporal overlap is heavy (> 65%), they are duplicates regardless of minor edits
  if (iou >= 0.65) return true;

  // For moderate temporal overlap (15% to 65%), check semantic similarity
  const jaccard = calculateSemanticJaccardSimilarity(candA.tokens, candB.tokens);
  return iou > maxIoU && jaccard > maxJaccard;
}

/**
 * Distributes top candidates across timeline buckets for maximum diversity.
 */
export function selectTimelineDiverseHighlights<T extends { start: number; score: number; id: string }>(
  rankedCandidates: T[],
  targetCount: number,
  totalDurationSeconds: number
): T[] {
  if (rankedCandidates.length <= targetCount) {
    return rankedCandidates;
  }

  // If video is short (<= 300s), return top scores directly
  if (totalDurationSeconds <= 300) {
    return rankedCandidates.slice(0, targetCount);
  }

  const topScore = rankedCandidates[0]?.score || 100;
  const scoreThreshold = Math.max(40, topScore - 35);
  const qualified = rankedCandidates.filter((c) => c.score >= scoreThreshold);

  if (qualified.length <= targetCount) {
    return rankedCandidates.slice(0, targetCount);
  }

  const numBuckets = Math.max(1, targetCount);
  const bucketDuration = totalDurationSeconds / numBuckets;
  const bucketed: T[][] = Array.from({ length: numBuckets }, () => []);

  for (const cand of qualified) {
    const bucketIdx = Math.min(numBuckets - 1, Math.floor(cand.start / bucketDuration));
    bucketed[bucketIdx].push(cand);
  }

  const selected: T[] = [];
  const selectedIds = new Set<string>();

  // Round-robin pick from each timeline bucket
  let round = 0;
  while (selected.length < targetCount && round < 10) {
    let pickedInRound = false;
    for (let b = 0; b < numBuckets; b++) {
      if (bucketed[b].length > round && selected.length < targetCount) {
        const cand = bucketed[b][round];
        if (!selectedIds.has(cand.id)) {
          selected.push(cand);
          selectedIds.add(cand.id);
          pickedInRound = true;
        }
      }
    }
    if (!pickedInRound) break;
    round++;
  }

  // Fill any remaining slots with highest remaining scores
  if (selected.length < targetCount) {
    for (const cand of rankedCandidates) {
      if (!selectedIds.has(cand.id)) {
        selected.push(cand);
        selectedIds.add(cand.id);
        if (selected.length >= targetCount) break;
      }
    }
  }

  // Sort selected clips chronologically
  selected.sort((a, b) => a.start - b.start);
  return selected;
}
