import { describe, it, expect } from 'vitest';
import type { WordToken } from '@/lib/timestampRefiner';
import { highlightKeywords, scoreToken } from '../keywordHighlighter';
import { applySmartEmojis, getEmojiForWord } from '../emojiTagging';
import { detectFillerWords, removeFillerWords, maskProfanity, censorCurseWord, findSilenceGaps } from '../audioCleanup';
import { applyViralMode, calculateWpm } from '../viralMode';

describe('Smart Features Engine', () => {
  const sampleTokens: WordToken[] = [
    { id: '1', text: 'Bhai', start: 0.1, end: 0.4, confidence: 0.95 },
    { id: '2', text: 'ye', start: 0.45, end: 0.65, confidence: 0.98 },
    { id: '3', text: 'umm', start: 0.7, end: 0.95, confidence: 0.92 },
    { id: '4', text: 'secret', start: 1.0, end: 1.4, confidence: 0.99 },
    { id: '5', text: 'video', start: 1.45, end: 1.85, confidence: 0.97 },
    { id: '6', text: 'matlab', start: 1.9, end: 2.2, confidence: 0.91 },
    { id: '7', text: '100%', start: 2.25, end: 2.6, confidence: 0.98 },
    { id: '8', text: 'viral', start: 2.65, end: 3.0, confidence: 0.99 },
    { id: '9', text: 'hogi', start: 3.05, end: 3.3, confidence: 0.96 },
  ];

  describe('Keyword Highlighter', () => {
    it('scores numbers and power words higher than stopwords', () => {
      const stopScore = scoreToken({ id: 's', text: 'hai', start: 0, end: 1, confidence: 1 });
      const numberScore = scoreToken({ id: 'n', text: '100%', start: 0, end: 1, confidence: 1 });
      const powerScore = scoreToken({ id: 'p', text: 'viral', start: 0, end: 1, confidence: 1 });

      expect(stopScore).toBe(0);
      expect(numberScore).toBeGreaterThan(3.0);
      expect(powerScore).toBeGreaterThan(2.0);
    });

    it('flags top scoring tokens with isKeyword', () => {
      const tagged = highlightKeywords(sampleTokens, 0.3);
      const keywords = tagged.filter((t) => t.isKeyword);
      expect(keywords.length).toBeGreaterThan(0);
      const keywordTexts = keywords.map((k) => k.text.toLowerCase());
      expect(keywordTexts.some((t) => t.includes('100%') || t.includes('viral') || t.includes('secret'))).toBe(true);
    });
  });

  describe('Emoji Tagging', () => {
    it('identifies contextual emojis for creator terms', () => {
      expect(getEmojiForWord('video')).toBe('🎥');
      expect(getEmojiForWord('paisa')).toBe('💰');
      expect(getEmojiForWord('viral')).toBe('🚀');
      expect(getEmojiForWord('unknownwordxyz')).toBeNull();
    });

    it('appends emojis to matching tokens', () => {
      const withEmojis = applySmartEmojis(sampleTokens, 'append');
      const videoToken = withEmojis.find((t) => t.text.includes('video'));
      expect(videoToken?.text).toBe('video 🎥');
    });
  });

  describe('Audio Cleanup', () => {
    it('detects and removes filler words', () => {
      const detected = detectFillerWords(sampleTokens);
      const fillers = detected.filter((t) => t.isFiller);
      expect(fillers.length).toBe(2); // 'umm', 'matlab'

      const cleaned = removeFillerWords(sampleTokens);
      expect(cleaned.length).toBe(sampleTokens.length - 2);
      expect(cleaned.some((t) => t.text.toLowerCase() === 'umm')).toBe(false);
      expect(cleaned.some((t) => t.text.toLowerCase() === 'matlab')).toBe(false);
    });

    it('masks profanities accurately', () => {
      const profTokens: WordToken[] = [
        { id: '1', text: 'saala', start: 0, end: 1, confidence: 0.9 },
        { id: '2', text: 'bhai', start: 1, end: 2, confidence: 0.9 },
      ];
      const masked = maskProfanity(profTokens, '*');
      expect(masked[0].text).toBe('s****');
      expect(masked[0].isProfanity).toBe(true);
      expect(masked[1].text).toBe('bhai');
    });

    it('censors curse words writing few letters and ** the rest', () => {
      expect(censorCurseWord('fuck')).toBe('f**k');
      expect(censorCurseWord('shit')).toBe('s**t');
      expect(censorCurseWord('bitch')).toBe('b***h');
      expect(censorCurseWord('damn')).toBe('d**n');
      expect(censorCurseWord('asshole')).toBe('a**hole');
      expect(censorCurseWord('fucking')).toBe('f***ing');
      expect(censorCurseWord('chutiya')).toBe('ch***ya');
      expect(censorCurseWord('bhenchod')).toBe('bh***hod');
      expect(censorCurseWord('FUCK!')).toBe('F**K!');
      expect(censorCurseWord('hello')).toBe('hello');
    });

    it('detects silence gaps between words', () => {
      const gapTokens: WordToken[] = [
        { id: '1', text: 'Hello', start: 0.0, end: 1.0, confidence: 1 },
        { id: '2', text: 'World', start: 2.2, end: 3.0, confidence: 1 }, // 1.2s gap
      ];
      const gaps = findSilenceGaps(gapTokens, 0.8);
      expect(gaps.length).toBe(1);
      expect(gaps[0].start).toBe(1.0);
      expect(gaps[0].end).toBe(2.2);
      expect(gaps[0].duration).toBe(1.2);
    });
  });

  describe('One-Click Viral Mode', () => {
    it('calculates WPM and applies all enhancements in one shot', () => {
      const result = applyViralMode(sampleTokens, 3.5);
      expect(result.stats.fillersRemoved).toBe(2);
      expect(result.stats.keywordsHighlighted).toBeGreaterThan(0);
      expect(result.tokens.some((t) => t.text.includes('🎥') || t.text.includes('🚀'))).toBe(true);
      expect(result.wpm).toBeGreaterThan(0);
      expect(['behind_you_white', 'neon_sticker_lime', 'sunshine_impact_yellow']).toContain(result.recommendedTemplateId);
    });
  });
});
