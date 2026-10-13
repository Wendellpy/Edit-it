import type { WordToken } from "./timestampRefiner";

export const LOW_CONFIDENCE_THRESHOLD = 0.85;

export interface ConfidenceRating {
  level: "high" | "medium" | "low";
  score: number;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export function evaluateWordConfidence(confidence: number): ConfidenceRating {
  if (confidence >= 0.88) {
    return {
      level: "high",
      score: confidence,
      textColor: "text-emerald-400",
      bgColor: "bg-emerald-950/30",
      borderColor: "border-emerald-500/20",
    };
  } else if (confidence >= 0.75) {
    return {
      level: "medium",
      score: confidence,
      textColor: "text-amber-400",
      bgColor: "bg-amber-950/30",
      borderColor: "border-amber-500/20",
    };
  } else {
    return {
      level: "low",
      score: confidence,
      textColor: "text-rose-400",
      bgColor: "bg-rose-950/40",
      borderColor: "border-rose-500/40",
    };
  }
}

/**
 * Finds all token indices requiring manual creator review.
 */
export function getLowConfidenceWordIndices(
  words: WordToken[],
  threshold = LOW_CONFIDENCE_THRESHOLD
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].confidence < threshold) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Jumps to next low-confidence token in the sequence.
 */
export function getNextReviewIndex(
  currentWordIndex: number,
  lowConfidenceIndices: number[]
): number | null {
  if (lowConfidenceIndices.length === 0) return null;
  const next = lowConfidenceIndices.find((idx) => idx > currentWordIndex);
  return next !== undefined ? next : lowConfidenceIndices[0]; // Wrap around
}

/**
 * Jumps to previous low-confidence token in the sequence.
 */
export function getPrevReviewIndex(
  currentWordIndex: number,
  lowConfidenceIndices: number[]
): number | null {
  if (lowConfidenceIndices.length === 0) return null;
  const prev = [...lowConfidenceIndices].reverse().find((idx) => idx < currentWordIndex);
  return prev !== undefined ? prev : lowConfidenceIndices[lowConfidenceIndices.length - 1]; // Wrap around
}
