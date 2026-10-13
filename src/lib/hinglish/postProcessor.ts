import { HINGLISH_LEXICON } from "./lexicon";
import {
  isDevanagariWord,
  transliterateDevanagariWord,
} from "./transliterator";
import { lookupUserDictionary } from "./dictionaryDb";
import type { WordToken } from "../timestampRefiner";

export interface HinglishWordToken extends WordToken {
  romanText: string;
  devanagariText: string;
  isCodeMixedEnglish: boolean;
}

export type CaptionScriptMode = "roman" | "devanagari";

/**
 * Normalizes a single token to Roman Hinglish while preserving English loanwords.
 */
export function normalizeTokenToHinglish(rawToken: string): {
  roman: string;
  devanagari: string;
  isCodeMixedEnglish: boolean;
} {
  const trimmed = rawToken.trim();

  // 1. If token is in Latin script (e.g. "video", "upload", "template", "ready")
  if (!isDevanagariWord(trimmed)) {
    return {
      roman: trimmed,
      devanagari: trimmed, // keep as is for code-mix
      isCodeMixedEnglish: true,
    };
  }

  // Separate trailing punctuation (e.g. "किया," -> word: "किया", punct: ",")
  const match = trimmed.match(/^([^\u0900-\u097f]*)([\u0900-\u097f\u093c]+)([^\u0900-\u097f]*)$/);
  const prefix = match ? match[1] : "";
  const coreDev = match ? match[2] : trimmed;
  const suffix = match ? match[3] : "";

  // 2. Check User Custom Dictionary first (highest priority)
  const userOverride = lookupUserDictionary(coreDev);
  if (userOverride) {
    return {
      roman: prefix + userOverride + suffix,
      devanagari: trimmed,
      isCodeMixedEnglish: false,
    };
  }

  // 3. Check High-Frequency Curated Hinglish Lexicon
  if (HINGLISH_LEXICON[coreDev]) {
    return {
      roman: prefix + HINGLISH_LEXICON[coreDev] + suffix,
      devanagari: trimmed,
      isCodeMixedEnglish: false,
    };
  }

  // 4. Fallback to Algorithmic Transliterator with Schwa Deletion
  const algorithmic = transliterateDevanagariWord(coreDev);
  return {
    roman: prefix + algorithmic + suffix,
    devanagari: trimmed,
    isCodeMixedEnglish: false,
  };
}

/**
 * Transforms an array of raw Whisper WordTokens into dual-script HinglishWordTokens.
 */
export function processTranscriptHinglish(
  tokens: WordToken[],
  scriptMode: CaptionScriptMode = "roman"
): HinglishWordToken[] {
  return tokens.map((token) => {
    const { roman, devanagari, isCodeMixedEnglish } = normalizeTokenToHinglish(token.text);

    return {
      ...token,
      romanText: roman,
      devanagariText: devanagari,
      isCodeMixedEnglish,
      text: scriptMode === "roman" ? roman : devanagari,
      script: scriptMode,
    };
  });
}

/**
 * Instantly toggles transcript tokens between Roman Hinglish and Devanagari Hindi.
 * Zero latency, zero re-transcription overhead.
 */
export function toggleTranscriptScript(
  tokens: HinglishWordToken[],
  targetScript: CaptionScriptMode
): HinglishWordToken[] {
  return tokens.map((t) => ({
    ...t,
    text: targetScript === "roman" ? t.romanText : t.devanagariText,
    script: targetScript,
  }));
}
