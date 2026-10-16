/**
 * Multimodal Signal Extractor for Clip Candidate Ranking
 * Extracts audio dynamics, speech cadence, Hinglish/English hook patterns,
 * sentiment intensity, and filler word penalties without any external API calls.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import { FILLER_WORDS } from "../smart/audioCleanup";

export interface AudioSignals {
  avgRms: number;
  peakRms: number;
  dynamicRange: number;
  hasLaughterOrCheer: boolean;
  speechPaceWpm: number;
  pauseCount: number;
  totalSilenceSeconds: number;
}

export interface TextSignals {
  hookType: "question" | "bold_claim" | "number" | "contrast" | "story" | "none";
  hookScore: number;
  hookPhrase?: string;
  keywordDensity: number;
  sentimentIntensity: number;
  sentimentCategory: "exciting" | "dramatic" | "funny" | "neutral";
  fillerRatio: number; // 0.0 to 1.0
  wordCount: number;
}

export interface ExtractedSignals {
  audio: AudioSignals;
  text: TextSignals;
  reasons: string[];
}

// -------------------------------------------------------------------------
// Hook Pattern Regexes (English & Hinglish)
// -------------------------------------------------------------------------
const QUESTION_HOOK_PATTERNS = [
  /^(kya\s+(aap|tum|apko|hum|ye|wo|hoga))/i,
  /^(how\s+(to|do|can|did|does|would))/i,
  /^(why\s+(do|does|did|is|are|people))/i,
  /^(what\s+(is|are|happens|if|makes))/i,
  /^(did\s+you\s+know)/i,
  /^(have\s+you\s+ever)/i,
  /^(kya\s+aapne\s+kabhi)/i,
  /^(ever\s+wondered)/i,
  /^(which\s+is\s+better)/i,
  /^(kaunsa\s+achha\s+hai)/i,
];

const BOLD_CLAIM_PATTERNS = [
  /(this\s+changes\s+everything)/i,
  /(biggest\s+mistake)/i,
  /(never\s+(do|buy|use|say)\s+this)/i,
  /(sabse\s+badi?\s+galti)/i,
  /(sabse\s+bada\s+secret)/i,
  /(game\s+changer)/i,
  /(nobody\s+(talks\s+about|knows))/i,
  /(kisi\s+ko\s+nahi\s+pata)/i,
  /(secret\s+trick)/i,
  /(100%\s+(working|guaranteed))/i,
  /(asli\s+sach)/i,
  /(don'?t\s+make\s+this)/i,
];

const NUMBER_HOOK_PATTERNS = [
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|top|pehla|dusra|teesra)\b.*\b(mistakes?|steps?|reasons?|ways?|tips?|hacks?|rules?|galti|cheez|upay)\b/i,
  /\b(top\s+\d+)\b/i,
  /\b(number\s+one\s+rule)\b/i,
];

const CONTRAST_HOOK_PATTERNS = [
  /\b(but\s+actually)\b/i,
  /\b(the\s+truth\s+is)\b/i,
  /\b(reality\s+yeh\s+hai)\b/i,
  /\b(instead\s+of\s+doing)\b/i,
  /\b(most\s+people\s+think.*but)\b/i,
  /\b(log\s+sochte\s+hai.*lekin)\b/i,
  /\b(plot\s+twist)\b/i,
];

const STORY_HOOK_PATTERNS = [
  /^(ek\s+baar)/i,
  /^(story\s+suno)/i,
  /^(listen\s+to\s+this)/i,
  /^(jab\s+maine)/i,
  /^(so\s+yesterday)/i,
  /^(when\s+i\s+started)/i,
  /^(last\s+year)/i,
  /^(ek\s+din\s+kya\s+hua)/i,
  /^(mujhe\s+laga\s+tha)/i,
];

const COMEDY_HOOK_PATTERNS = [
  /\b(hasna\s+mat)\b/i,
  /\b(funny\s+(baat|story|joke|moment))\b/i,
  /\b(hilarious|comedy\s+scene|comedy\s+story)\b/i,
  /\b(joke\s+(hai|suno|bataun))\b/i,
];

// Sentiment lexicons
const EXCITING_WORDS = new Set([
  "insane", "crazy", "unbelievable", "epic", "amazing", "banger",
  "zabardast", "bawaal", "mast", "gazab", "fabulous", "awesome",
  "wild", "genius", "brilliant", "shandar", "superhit", "viral",
]);

const DRAMATIC_WORDS = new Set([
  "warning", "danger", "khatra", "shocking", "stop", "ruko",
  "rukiye", "disaster", "critical", "exposed", "scam", "dhokha",
  "trap", "crisis", "worst", "terrible", "urgent", "blunder",
]);

const FUNNY_WORDS = new Set([
  "funny", "hilarious", "laugh", "hasna", "haso", "joke",
  "mazaak", "comedy", "lmao", "lol", "pagal", "chutkula",
  "weird", "awkward", "ridiculous",
]);

/**
 * Extracts audio and text signals for a clip candidate window.
 */
export function extractSignalsForSegment(
  tokens: HinglishWordToken[],
  segmentStart: number,
  segmentEnd: number,
  rmsPeaks?: Float32Array
): ExtractedSignals {
  const segmentTokens = tokens.filter((t) => t.start >= segmentStart && t.end <= segmentEnd);
  const reasons: string[] = [];

  // -------------------------------------------------------------------------
  // 1. Audio Signal Extraction
  // -------------------------------------------------------------------------
  let avgRms = 0.05;
  let peakRms = 0.1;
  let dynamicRange = 1.0;
  let hasLaughterOrCheer = false;

  if (rmsPeaks && rmsPeaks.length > 0) {
    const startIdx = Math.max(0, Math.floor(segmentStart * 100)); // 100 bins per sec (10ms)
    const endIdx = Math.min(rmsPeaks.length, Math.ceil(segmentEnd * 100));

    let sum = 0;
    let count = 0;
    let max = 0;
    let min = 1.0;

    for (let i = startIdx; i < endIdx; i++) {
      const val = rmsPeaks[i];
      sum += val;
      count++;
      if (val > max) max = val;
      if (val < min) min = val;
    }

    if (count > 0) {
      avgRms = sum / count;
      peakRms = max;
      dynamicRange = min > 0 ? max / min : max;

      // Burst heuristic: brief peak > 2.5x segment average indicates laughter/applause/cheer
      if (max > avgRms * 2.5 && max > 0.25) {
        hasLaughterOrCheer = true;
        reasons.push("High energy audio burst (applause/reaction)");
      }
    }
  }

  // Calculate Speech Cadence (WPM)
  const durationMinutes = Math.max(0.01, (segmentEnd - segmentStart) / 60);
  const speechPaceWpm = Math.round(segmentTokens.length / durationMinutes);

  if (speechPaceWpm >= 140 && speechPaceWpm <= 185) {
    reasons.push(`Optimal speech cadence (${speechPaceWpm} WPM)`);
  }

  // Detect pause lengths
  let pauseCount = 0;
  let totalSilenceSeconds = 0;
  for (let i = 0; i < segmentTokens.length - 1; i++) {
    const gap = segmentTokens[i + 1].start - segmentTokens[i].end;
    if (gap >= 0.35) {
      pauseCount++;
      totalSilenceSeconds += gap;
    }
  }

  const audioSignals: AudioSignals = {
    avgRms,
    peakRms,
    dynamicRange,
    hasLaughterOrCheer,
    speechPaceWpm,
    pauseCount,
    totalSilenceSeconds: Math.round(totalSilenceSeconds * 100) / 100,
  };

  // -------------------------------------------------------------------------
  // 2. Text Signal Extraction (Hinglish + English)
  // -------------------------------------------------------------------------
  const fullText = segmentTokens.map((t) => t.text).join(" ");
  const first15Words = segmentTokens.slice(0, 15).map((t) => t.text).join(" ");

  let hookType: TextSignals["hookType"] = "none";
  let hookScore = 0;
  let hookPhrase: string | undefined = undefined;

  // Check Question Opener
  for (const pat of QUESTION_HOOK_PATTERNS) {
    const m = first15Words.match(pat);
    if (m) {
      hookType = "question";
      hookScore = 90;
      hookPhrase = m[0];
      reasons.push(`Strong question opener ("${m[0]}")`);
      break;
    }
  }

  // Check Bold Claim
  if (hookType === "none") {
    for (const pat of BOLD_CLAIM_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "bold_claim";
        hookScore = 95;
        hookPhrase = m[0];
        reasons.push(`Bold hook claim ("${m[0]}")`);
        break;
      }
    }
  }

  // Check Number Hook
  if (hookType === "none") {
    for (const pat of NUMBER_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "number";
        hookScore = 85;
        hookPhrase = m[0];
        reasons.push(`Numbered list opener ("${m[0]}")`);
        break;
      }
    }
  }

  // Check Contrast Hook
  if (hookType === "none") {
    for (const pat of CONTRAST_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "contrast";
        hookScore = 80;
        hookPhrase = m[0];
        reasons.push(`Contrast/Curiosity pivot ("${m[0]}")`);
        break;
      }
    }
  }

  // Check Story Hook
  if (hookType === "none") {
    for (const pat of STORY_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "story";
        hookScore = 80;
        hookPhrase = m[0];
        reasons.push(`Narrative story hook ("${m[0]}")`);
        break;
      }
    }
  }

  // Check Comedy Hook
  if (hookType === "none") {
    for (const pat of COMEDY_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "story";
        hookScore = 85;
        hookPhrase = m[0];
        reasons.push(`Entertainment/Comedy opener ("${m[0]}")`);
        break;
      }
    }
  }

  // Filler words ratio
  let fillerCount = 0;
  let excitingCount = 0;
  let dramaticCount = 0;
  let funnyCount = 0;

  for (const tok of segmentTokens) {
    const clean = tok.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FILLER_WORDS.has(clean)) fillerCount++;
    if (EXCITING_WORDS.has(clean)) excitingCount++;
    if (DRAMATIC_WORDS.has(clean)) dramaticCount++;
    if (FUNNY_WORDS.has(clean)) funnyCount++;
  }

  const wordCount = Math.max(1, segmentTokens.length);
  const fillerRatio = fillerCount / wordCount;

  if (fillerRatio <= 0.04) {
    reasons.push("Clean delivery (minimal filler words)");
  }

  // Sentiment category & intensity
  let sentimentCategory: TextSignals["sentimentCategory"] = "neutral";
  let sentimentIntensity = 0;

  if (excitingCount >= dramaticCount && excitingCount >= funnyCount && excitingCount > 0) {
    sentimentCategory = "exciting";
    sentimentIntensity = Math.min(100, excitingCount * 25);
    reasons.push("High energy emotional keywords");
  } else if (dramaticCount >= excitingCount && dramaticCount >= funnyCount && dramaticCount > 0) {
    sentimentCategory = "dramatic";
    sentimentIntensity = Math.min(100, dramaticCount * 25);
    reasons.push("Dramatic urgency vocabulary");
  } else if (funnyCount > 0) {
    sentimentCategory = "funny";
    sentimentIntensity = Math.min(100, funnyCount * 30);
    reasons.push("Comedic and entertaining wording");
  }

  // Keyword density (words > 4 chars, not filler)
  const contentWords = segmentTokens.filter((t) => {
    const c = t.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    return c.length > 4 && !FILLER_WORDS.has(c);
  });
  const keywordDensity = contentWords.length / wordCount;

  const textSignals: TextSignals = {
    hookType,
    hookScore,
    hookPhrase,
    keywordDensity,
    sentimentIntensity,
    sentimentCategory,
    fillerRatio,
    wordCount,
  };

  return {
    audio: audioSignals,
    text: textSignals,
    reasons,
  };
}
