/**
 * Boundary Snapper for Clip Candidates
 * Aligns clip start and end timestamps precisely to grammatical sentence boundaries
 * and speech pauses. Guarantees clips open on a strong hook and close on a complete thought.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";

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
}

/**
 * Splits words into natural sentence units using punctuation and speech pause cues.
 */
export function segmentIntoSentences(tokens: HinglishWordToken[]): SentenceUnit[] {
  if (!tokens || tokens.length === 0) return [];

  const sentences: SentenceUnit[] = [];
  let currentTokens: HinglishWordToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    currentTokens.push(token);

    const isLastToken = i === tokens.length - 1;
    const nextToken = !isLastToken ? tokens[i + 1] : null;

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
 * Snaps a candidate interval [targetStart, targetEnd] to the nearest clean sentence boundaries.
 */
export function snapToSentenceBoundaries(
  sentences: SentenceUnit[],
  targetStart: number,
  targetEnd: number,
  minDuration = 15,
  maxDuration = 90
): SnappedBoundary | null {
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

  const actualStart = sentences[startIdx].start;
  const actualEnd = sentences[endIdx].end;
  const duration = actualEnd - actualStart;

  if (duration < minDuration) {
    return null;
  }

  const selectedSentences = sentences.slice(startIdx, endIdx + 1);
  const allTokens = selectedSentences.flatMap((s) => s.tokens);
  const lastSentence = selectedSentences[selectedSentences.length - 1];

  return {
    start: actualStart,
    end: actualEnd,
    duration,
    sentenceUnits: selectedSentences,
    tokens: allTokens,
    isCompleteThought: lastSentence.hasSentenceEndPunctuation || lastSentence.duration > 1.0,
  };
}
