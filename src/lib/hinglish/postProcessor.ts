import { HINGLISH_LEXICON } from "./lexicon";
import {
  isDevanagariWord,
  transliterateDevanagariWord,
} from "./transliterator";
import { lookupUserDictionary } from "./dictionaryDb";
import type { WordToken } from "../timestampRefiner";
import { censorCurseWord } from "../smart/audioCleanup";

export interface HinglishWordToken extends WordToken {
  romanText: string;
  devanagariText: string;
  isCodeMixedEnglish: boolean;
}

export type CaptionScriptMode = "roman" | "devanagari";

/**
 * Normalizes a single token to Roman Hinglish while preserving English loanwords
 * and censoring curse words with few letters + ** (e.g. "f**k", "s**t", "b***h").
 */
export function normalizeTokenToHinglish(rawToken: string): {
  roman: string;
  devanagari: string;
  isCodeMixedEnglish: boolean;
} {
  const trimmed = rawToken.trim();

  // 1. If token is in Latin script (e.g. "video", "upload", "template", "ready", "fuck")
  if (!isDevanagariWord(trimmed)) {
    const censored = censorCurseWord(trimmed);
    return {
      roman: censored,
      devanagari: censored, // keep as is for code-mix
      isCodeMixedEnglish: true,
    };
  }

  // Separate trailing punctuation (e.g. "किया," -> word: "किया", punct: ",")
  const match = trimmed.match(/^([^\u0900-\u097f]*)([\u0900-\u097f\u093c]+)([^\u0900-\u097f]*)$/);
  const prefix = match ? match[1] : "";
  const coreDev = match ? match[2] : trimmed;
  const suffix = match ? match[3] : "";

  // 2. Check User Custom Dictionary first (highest priority)
  let rawRoman = "";
  const userOverride = lookupUserDictionary(coreDev);
  if (userOverride) {
    rawRoman = userOverride;
  } else if (HINGLISH_LEXICON[coreDev]) {
    // 3. Check High-Frequency Curated Hinglish Lexicon
    rawRoman = HINGLISH_LEXICON[coreDev];
  } else {
    // 4. Fallback to Algorithmic Transliterator with Schwa Deletion
    rawRoman = transliterateDevanagariWord(coreDev);
  }

  const censoredRoman = censorCurseWord(prefix + rawRoman + suffix);
  return {
    roman: censoredRoman,
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
