/**
 * Smart Caption Template Selector & Enricher
 * 
 * Maps clip candidates to the optimal preset from the 70+ caption templates
 * based on speech pacing (WPM), Hinglish/Devanagari scripts, hook genre, and audio dynamics.
 * 
 * Also applies on-device smart keyword highlighting, contextual creator emojis,
 * and filler word cleanup without any cloud APIs.
 */

import type { ClipCandidate } from "./clipFinder";
import type { HinglishWordToken } from "../hinglish/postProcessor";
import { CAPTION_PRESETS } from "../templates/presets";
import type { CaptionTemplate, TemplateVibe } from "../templates/schema";
import { highlightKeywords } from "../smart/keywordHighlighter";
import { applySmartEmojis } from "../smart/emojiTagging";
import { removeFillerWords } from "../smart/audioCleanup";

export interface TemplateSelectionOptions {
  /** Override preferred template ID or vibe */
  templateId?: string;
  preferredVibe?: TemplateVibe;
  /** Whether to apply smart keyword highlighting (default: true) */
  enableKeywords?: boolean;
  /** Whether to append contextual creator emojis (default: true) */
  enableEmojis?: boolean;
  /** Whether to filter out filler words like 'um', 'matlab' (default: true) */
  removeFillers?: boolean;
}

export interface SelectedTemplateResult {
  template: CaptionTemplate;
  styledTokens: HinglishWordToken[];
  selectionReason: string;
  highlightCount: number;
  emojiCount: number;
  fillerWordsRemoved: number;
}

/**
 * Checks if tokens contain Devanagari script characters (U+0900 to U+097F).
 */
export function hasDevanagariContent(tokens: HinglishWordToken[]): boolean {
  return tokens.some(
    (t) =>
      /[\u0900-\u097F]/.test(t.text) ||
      (t.devanagariText && /[\u0900-\u097F]/.test(t.devanagariText))
  );
}

/**
 * Selects the optimal caption preset ID based on multi-signal analysis.
 */
export function determineOptimalTemplateId(
  candidate: ClipCandidate,
  preferredVibe?: TemplateVibe
): { presetId: string; reason: string } {
  const { signals, hookType, tokens } = candidate;
  const isDevanagari = hasDevanagariContent(tokens);
  const wpm = signals?.audio?.speechPaceWpm ?? 150;
  const peakRms = signals?.audio?.peakRms ?? 0.5;
  const pauseCount = signals?.audio?.pauseCount ?? 0;
  const hasLaughter = signals?.audio?.hasLaughterOrCheer ?? false;

  // 1. If tokens have Devanagari Hindi script, prioritize typography optimized for Indian scripts
  if (isDevanagari) {
    if (hookType === "comedy" || hasLaughter) {
      return {
        presetId: "bappi_disco_gold",
        reason: "Devanagari content with high energy / laughter burst detected",
      };
    }
    return {
      presetId: "devanagari_calligraphy_bold",
      reason: "Devanagari script detected — optimal Royal Hindi typography",
    };
  }

  // 2. Vibe override if specified
  if (preferredVibe === "minimal") {
    return {
      presetId: "clean_sub_inter",
      reason: "Minimal aesthetic preference selected",
    };
  }
  if (preferredVibe === "neon") {
    return {
      presetId: "winner",
      reason: "Neon aesthetic preference selected — Winner",
    };
  }
  if (preferredVibe === "bollywood") {
    return {
      presetId: "bappi_disco_gold",
      reason: "Bollywood aesthetic preference selected",
    };
  }

  // 3. Speech Pacing & Hook Dynamics
  // Fast Pacing (> 175 WPM): High-energy kinetic styles with instant word pop
  if (wpm >= 175) {
    if (hookType === "bold_claim" || hookType === "number") {
      return {
        presetId: "mr_beast_bold",
        reason: `Rapid pacing (${Math.round(wpm)} WPM) with high-stakes ${hookType} — MrBeast squash bounce`,
      };
    }
    if (hookType === "question") {
      return {
        presetId: "alex_hormozi_punch",
        reason: `Rapid pacing (${Math.round(wpm)} WPM) with question hook — Hormozi highlighter box`,
      };
    }
    return {
      presetId: "behind_you_white",
      reason: `Rapid pacing (${Math.round(wpm)} WPM) — High-contrast Clean White kinetic template`,
    };
  }

  // Slower / Deliberate Pacing (< 130 WPM): Emphasize punchy words and cinematic depth
  if (wpm < 130) {
    if (hookType === "story" || pauseCount >= 4) {
      return {
        presetId: "behind_head_giant_word",
        reason: `Deliberate pacing (${Math.round(wpm)} WPM) with pauses — Cinematic giant word behind head`,
      };
    }
    return {
      presetId: "sunshine_impact_yellow",
      reason: `Moderate/slow pacing (${Math.round(wpm)} WPM) — Sunshine Impact glowing serif`,
    };
  }

  // Moderate Pacing (130 - 175 WPM): Core viral creator territory
  if (hookType === "comedy") {
    return {
      presetId: "die_cut_sticker",
      reason: "Comedy/humor hook detected — Die-cut vinyl sticker with tilt bounce",
    };
  }

  if (hookType === "question") {
    return {
      presetId: "alex_hormozi_punch",
      reason: "Question hook detected — Hormozi highlighter box",
    };
  }

  if (peakRms >= 0.70) {
    return {
      presetId: "winner",
      reason: "High audio intensity with punchy vocal delivery — Winner editorial",
    };
  }

  // Default gold standard viral style
  return {
    presetId: "behind_you_white",
    reason: `Balanced viral engagement (${Math.round(wpm)} WPM) — Behind You Clean White`,
  };
}

/**
 * Automatically styles and enriches caption tokens for a clip candidate.
 */
export function selectCaptionTemplate(
  candidate: ClipCandidate,
  options: TemplateSelectionOptions = {}
): SelectedTemplateResult {
  const {
    templateId: customTemplateId,
    preferredVibe,
    enableKeywords = true,
    enableEmojis = true,
    removeFillers = true,
  } = options;

  // 1. Determine Preset
  let presetId: string;
  let selectionReason: string;

  if (customTemplateId) {
    presetId = customTemplateId;
    selectionReason = `Custom template '${customTemplateId}' selected`;
  } else {
    const determined = determineOptimalTemplateId(candidate, preferredVibe);
    presetId = determined.presetId;
    selectionReason = determined.reason;
  }

  // Find preset in library (fallback to first preset if ID not found)
  const template =
    CAPTION_PRESETS.find((p) => p.id === presetId) || CAPTION_PRESETS[0];

  // 2. Token Cleanup & Enrichment
  let processedTokens = [...candidate.tokens];
  let fillerWordsRemoved = 0;

  if (removeFillers) {
    const originalCount = processedTokens.length;
    processedTokens = removeFillerWords(processedTokens);
    fillerWordsRemoved = Math.max(0, originalCount - processedTokens.length);
  }

  let highlightCount = 0;
  if (enableKeywords) {
    processedTokens = highlightKeywords(processedTokens);
    highlightCount = processedTokens.filter((t) => t.isKeyword).length;
  }

  let emojiCount = 0;
  if (enableEmojis) {
    const beforeEmojis = processedTokens.map((t) => t.text);
    processedTokens = applySmartEmojis(processedTokens, "append");
    emojiCount = processedTokens.filter(
      (t, idx) => t.text !== beforeEmojis[idx]
    ).length;
  }

  return {
    template,
    styledTokens: processedTokens,
    selectionReason,
    highlightCount,
    emojiCount,
    fillerWordsRemoved,
  };
}
