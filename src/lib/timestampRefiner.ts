import type { SpeechSegment } from "./vad";

export interface WordToken {
  id: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  script?: "roman" | "devanagari";
  isFiller?: boolean;
  isProfanity?: boolean;
  isKeyword?: boolean;
}

export interface RefinementOptions {
  minWordDurationSeconds?: number;
  snapThresholdSeconds?: number;
  maxVideoDurationSeconds?: number;
}

/**
 * Enforces monotonic, non-overlapping, VAD-snapped word timings.
 * Guarantees zero negative durations and clamps bounds to video duration.
 */
export function refineWordTimestamps(
  words: WordToken[],
  speechSegments: SpeechSegment[] = [],
  options: RefinementOptions = {}
): WordToken[] {
  if (!words || words.length === 0) return [];

  const {
    minWordDurationSeconds = 0.08, // 80ms minimum audible token duration
    snapThresholdSeconds = 0.2,    // Snap to VAD boundary if within 200ms
    maxVideoDurationSeconds,
  } = options;

  // Clone words to prevent mutating inputs
  const refined: WordToken[] = words.map((w, index) => ({
    ...w,
    id: w.id || `word_${index}_${Date.now()}`,
    start: Math.max(0, w.start),
    end: Math.max(w.start + minWordDurationSeconds, w.end),
  }));

  // Sort by start time
  refined.sort((a, b) => a.start - b.start);

  // 1. Snap initial word of speech cluster and final word to VAD segments
  if (speechSegments.length > 0) {
    for (const seg of speechSegments) {
      // Find words in or near this segment
      const overlappingWords = refined.filter(
        (w) => w.start >= seg.start - snapThresholdSeconds && w.end <= seg.end + snapThresholdSeconds
      );

      if (overlappingWords.length > 0) {
        const first = overlappingWords[0];
        const last = overlappingWords[overlappingWords.length - 1];

        // Snap or clamp first word start so it aligns with audible speech
        if (Math.abs(first.start - seg.start) <= snapThresholdSeconds || first.start < seg.start) {
          first.start = seg.start;
        }

        // Snap last word end if close to VAD speech end
        if (Math.abs(last.end - seg.end) <= snapThresholdSeconds) {
          last.end = seg.end;
        }
      }
    }
  }

  // 2. Fix overlaps & enforce strict monotonicity: start[i] >= end[i-1]
  for (let i = 0; i < refined.length; i++) {
    const current = refined[i];

    // Ensure current word has valid minimum length
    if (current.end <= current.start) {
      current.end = current.start + minWordDurationSeconds;
    }

    if (i > 0) {
      const prev = refined[i - 1];

      // Overlap detected: prev.end > current.start
      if (prev.end > current.start) {
        // If there's enough room, split the boundary at midpoint
        const midpoint = (prev.end + current.start) / 2;

        if (midpoint - prev.start >= minWordDurationSeconds && current.end - midpoint >= minWordDurationSeconds) {
          prev.end = parseFloat(midpoint.toFixed(3));
          current.start = prev.end;
        } else {
          // Push current start to prev.end
          current.start = prev.end;
          if (current.end <= current.start) {
            current.end = current.start + minWordDurationSeconds;
          }
        }
      }
    }

    // Round to 3 decimal places (milliseconds precision)
    current.start = parseFloat(current.start.toFixed(3));
    current.end = parseFloat(current.end.toFixed(3));
  }

  // 3. Clamp to maximum video duration if provided
  if (typeof maxVideoDurationSeconds === "number" && maxVideoDurationSeconds > 0) {
    for (let i = refined.length - 1; i >= 0; i--) {
      const w = refined[i];
      if (w.start >= maxVideoDurationSeconds) {
        // Drop words starting past the end of the video
        refined.splice(i, 1);
      } else if (w.end > maxVideoDurationSeconds) {
        w.end = maxVideoDurationSeconds;
      }
    }
  }

  return refined;
}
