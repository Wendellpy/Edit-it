import type { WordToken } from '@/lib/timestampRefiner';
import { highlightKeywords } from './keywordHighlighter';
import { applySmartEmojis } from './emojiTagging';
import { removeFillerWords, maskProfanity } from './audioCleanup';

export interface ViralModeResult<T extends WordToken = WordToken> {
  tokens: T[];
  recommendedTemplateId: string;
  wpm: number;
  paceCategory: 'slow' | 'optimal' | 'rapid';
  stats: {
    wordsOriginal: number;
    wordsCleaned: number;
    fillersRemoved: number;
    keywordsHighlighted: number;
  };
}

/**
 * Computes Words Per Minute from tokens and duration.
 */
export function calculateWpm(tokens: WordToken[], durationSeconds?: number): number {
  if (!tokens || tokens.length === 0) return 0;
  const effectiveDuration = durationSeconds || (tokens[tokens.length - 1].end - tokens[0].start);
  if (effectiveDuration <= 0) return 0;
  const minutes = effectiveDuration / 60;
  return Math.round(tokens.length / minutes);
}

/**
 * Synthesizes speech tempo, removes fillers, censors curse words, applies keywords & emojis,
 * and chooses the optimal viral template from the 72 presets.
 */
export function applyViralMode<T extends WordToken>(tokens: T[], durationSeconds?: number): ViralModeResult<T> {
  const wordsOriginal = tokens.length;

  // 1. Clean filler words and censor curse words
  const withoutFillers = removeFillerWords(tokens);
  const withCensored = maskProfanity(withoutFillers);
  const fillersRemoved = wordsOriginal - withoutFillers.length;

  // 2. Highlight high-impact keywords
  const withKeywords = highlightKeywords(withCensored, 0.22);
  const keywordsHighlighted = withKeywords.filter((t) => t.isKeyword).length;

  // 3. Apply contextual creator emojis
  const withEmojis = applySmartEmojis(withKeywords, 'append');

  // 4. Analyze pace & select optimal template
  const wpm = calculateWpm(withEmojis, durationSeconds);
  let paceCategory: 'slow' | 'optimal' | 'rapid' = 'optimal';
  let recommendedTemplateId = 'winner';

  if (wpm < 135) {
    paceCategory = 'slow';
    // Slower pacing needs high-energy visual punch to keep retention
    recommendedTemplateId = 'sunshine_impact_yellow';
  } else if (wpm > 185) {
    paceCategory = 'rapid';
    // Very fast pacing needs high-contrast behind-you display
    recommendedTemplateId = 'behind_you_white';
  } else {
    paceCategory = 'optimal';
    // Sweet spot 135-185 WPM: Winner podcast editorial style with giant punch & cursive script
    recommendedTemplateId = 'winner';
  }

  return {
    tokens: withEmojis,
    recommendedTemplateId,
    wpm,
    paceCategory,
    stats: {
      wordsOriginal,
      wordsCleaned: withEmojis.length,
      fillersRemoved,
      keywordsHighlighted,
    },
  };
}
