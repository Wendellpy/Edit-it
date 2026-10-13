import type { WordToken } from '@/lib/timestampRefiner';

/**
 * Common filler words across conversational Hinglish and English.
 */
export const FILLER_WORDS = new Set([
  'um', 'umm', 'uh', 'uhh', 'er', 'ah', 'ahh',
  'matlab', 'basically', 'like', 'actually', 'literally',
  'you know', 'sort of', 'kind of',
]);

/**
 * Common Indian / English abusive or profanity terms for optional bleeping/masking.
 */
export const PROFANITY_WORDS = new Set([
  'bc', 'mc', 'chutiya', 'saala', 'kamina', 'harami', 'fuck', 'shit', 'bitch', 'asshole',
]);

/**
 * Flags filler words in transcript.
 */
export function detectFillerWords<T extends WordToken>(tokens: T[]): T[] {
  return tokens.map((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isFiller = FILLER_WORDS.has(clean);
    return {
      ...token,
      isFiller,
    };
  });
}

/**
 * Removes all detected filler words from transcript while preserving timeline continuity.
 */
export function removeFillerWords<T extends WordToken>(tokens: T[]): T[] {
  return tokens.filter((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !FILLER_WORDS.has(clean);
  });
}

/**
 * Masks profanity words with asterisk or bleep symbols (e.g. "c******" or "****").
 */
export function maskProfanity<T extends WordToken>(tokens: T[], maskChar: string = '*'): T[] {
  return tokens.map((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PROFANITY_WORDS.has(clean)) {
      const masked = token.text.length > 2
        ? token.text[0] + maskChar.repeat(token.text.length - 1)
        : maskChar.repeat(token.text.length);
      return {
        ...token,
        text: masked,
        isProfanity: true,
      };
    }
    return token;
  });
}

/**
 * Detects silent gaps longer than maxSilenceSeconds (e.g. 0.8s) for jump-cut recommendation.
 */
export function findSilenceGaps(
  tokens: WordToken[],
  maxSilenceSeconds: number = 0.8
): Array<{ start: number; end: number; duration: number }> {
  const gaps: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];
    const gapDuration = next.start - current.end;

    if (gapDuration >= maxSilenceSeconds) {
      gaps.push({
        start: current.end,
        end: next.start,
        duration: Math.round(gapDuration * 100) / 100,
      });
    }
  }

  return gaps;
}
