/**
 * Multimodal Signal Extractor for Clip Candidate Ranking
 * Extracts advanced audio dynamics (crescendos, bursts, sustained energy),
 * speech cadence, Hinglish/English viral hook patterns, climax payoffs,
 * and retention predictors without any external API calls.
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
  energyCrescendoScore?: number; // Ratio of 2nd half to 1st half RMS (>1.25 indicates buildup)
  sustainedEnergyRatio?: number; // Fraction of frames with vocal energy above baseline
  burstCount?: number; // Count of reaction/laughter/cheer peaks
  deadAirRatio?: number; // Fraction of frames in dead silence (<0.025 RMS)
  energyScore?: number; // Composite audio energy score (0 - 100)
}

export interface TextSignals {
  hookType: "question" | "bold_claim" | "number" | "contrast" | "story" | "none";
  hookScore: number;
  hookPhrase?: string;
  hookRetentionScore?: number; // 0 - 100 (rating the opening 3-5 seconds punch)
  keywordDensity: number;
  sentimentIntensity: number;
  sentimentCategory: "exciting" | "dramatic" | "funny" | "neutral";
  fillerRatio: number; // 0.0 to 1.0
  wordCount: number;
  hasPayoff?: boolean; // Ending punchline or clear lesson/takeaway
  payoffPhrase?: string;
  viralKeywordCount?: number;
}

export interface ViralBreakdown {
  hookStrength: number; // 0 - 100
  audioEnergy: number; // 0 - 100
  pacingMomentum: number; // 0 - 100
  climaxPayoff: number; // 0 - 100
  retentionScore: number; // 0 - 100
  energyCrescendo: boolean;
  hasPayoff: boolean;
  viralBadges: string[];
}

export interface ExtractedSignals {
  audio: AudioSignals;
  text: TextSignals;
  reasons: string[];
  viralBreakdown?: ViralBreakdown;
}

// -------------------------------------------------------------------------
// Hook Pattern Regexes (English & Hinglish)
// -------------------------------------------------------------------------
const QUESTION_HOOK_PATTERNS = [
  /^(kya\s+(aap|tum|apko|hum|ye|wo|hoga))/i,
  /^(how\s+(to|do|can|did|does|would))/i,
  /^(why\s+(do|does|did|is|are|people|nobody))/i,
  /^(what\s+(is|are|happens|if|makes))/i,
  /^(what\s+if\s+i\s+told\s+you)/i,
  /^(did\s+you\s+know)/i,
  /^(have\s+you\s+ever)/i,
  /^(kya\s+aapne\s+kabhi)/i,
  /^(ever\s+wondered)/i,
  /^(which\s+is\s+better)/i,
  /^(kaunsa\s+achha\s+hai)/i,
  /^(kaise\s+(karein|banaayein|kare))/i,
  /^(can\s+you\s+really)/i,
  /^(is\s+it\s+possible)/i,
];

const BOLD_CLAIM_PATTERNS = [
  /(this\s+changes\s+everything)/i,
  /(this\s+will\s+blow\s+your\s+mind)/i,
  /(biggest\s+mistake)/i,
  /(biggest\s+lie)/i,
  /(never\s+(do|buy|use|say)\s+this)/i,
  /(sabse\s+badi?\s+galti)/i,
  /(sabse\s+bada\s+secret)/i,
  /(game\s+changer)/i,
  /(nobody\s+(talks\s+about|knows))/i,
  /(kisi\s+ko\s+nahi\s+pata)/i,
  /(secret\s+trick)/i,
  /(secret\s+formula)/i,
  /(100%\s+(working|guaranteed))/i,
  /(100x|10x\s+rule)/i,
  /(asli\s+sach)/i,
  /(asli\s+secret)/i,
  /(don'?t\s+make\s+this)/i,
  /(cheat\s+code)/i,
  /(ye\s+sach\s+hai)/i,
];

const SHOCK_HOOK_PATTERNS = [
  /\b(i\s+couldn'?t\s+believe|can'?t\s+believe)\b/i,
  /\b(bro\s+(what|listen|look))\b/i,
  /\b(wait\s+(wait|what|listen))\b/i,
  /\b(no\s+way|listen\s+carefully|watch\s+till\s+the\s+end)\b/i,
  /\b(ye\s+(dekho|suno)|mera\s+dim[aa]+g\s+hil\s+gaya)\b/i,
  /\b(bhai\s+ye\s+kya\s+hua|sach\s+bata\s+raha\s+hu)\b/i,
  /\b(you\s+won'?t\s+believe|shocking\s+truth|omg|mind\s*blown)\b/i,
  /\b(kisi\s+ne\s+nahi\s+bataya|unreal)\b/i,
];

const SECRET_FOMO_HOOK_PATTERNS = [
  /\b(the\s+secret\s+(why|behind|to))\b/i,
  /\b(real\s+reason\s+(why|behind))\b/i,
  /\b(nobody\s+talks\s+about)\b/i,
  /\b(ye\s+trick\s+kisi\s+ko\s+nahi\s+pata)\b/i,
  /\b(hidden\s+(feature|secret|trick|hack))\b/i,
  /\b(dark\s+truth|here'?s\s+how|algorithm\s+doesn'?t\s+want\s+you)\b/i,
];

const URGENT_ADVICE_HOOK_PATTERNS = [
  /\b(stop\s+doing\s+this|never\s+do\s+this)\b/i,
  /\b(galti\s+se\s+bhi\s+mat\s+karna)\b/i,
  /\b(do\s+this\s+instead)\b/i,
  /\b(warning|ruko|rukiye|alert)\b/i,
  /\b(agar\s+aap\s+ye\s+kar\s+rahe\s+ho)\b/i,
  /\b(before\s+you\s+(buy|start|do))\b/i,
];

const NUMBER_HOOK_PATTERNS = [
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|top|pehla|dusra|teesra)\b.*\b(mistakes?|steps?|reasons?|ways?|tips?|hacks?|rules?|galti|cheez|upay|secrets?)\b/i,
  /\b(top\s+\d+)\b/i,
  /\b(number\s+one\s+rule)\b/i,
  /\b(\d+\s+(things?|habits?|tools?))\b/i,
];

const CONTRAST_HOOK_PATTERNS = [
  /\b(but\s+actually)\b/i,
  /\b(the\s+truth\s+is)\b/i,
  /\b(reality\s+yeh\s+hai)\b/i,
  /\b(instead\s+of\s+doing)\b/i,
  /\b(most\s+people\s+think.*but)\b/i,
  /\b(log\s+sochte\s+hai.*lekin)\b/i,
  /\b(plot\s+twist)\b/i,
  /\b(unpopular\s+opinion)\b/i,
  /\b(why\s+everyone\s+is\s+wrong)\b/i,
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
  /^(so\s+this\s+happened)/i,
];

const COMEDY_HOOK_PATTERNS = [
  /\b(hasna\s+mat)\b/i,
  /\b(funny\s+(baat|story|joke|moment))\b/i,
  /\b(hilarious|comedy\s+scene|comedy\s+story)\b/i,
  /\b(joke\s+(hai|suno|bataun))\b/i,
  /\b(wait\s+till\s+you\s+see)\b/i,
];

// Payoff / Punchline concluding markers (for clips that resolve definitively)
const PAYOFF_PATTERNS = [
  /\b((and\s+)?(that'?s|that\s+is)\s+(why|how|the\s+reason))\b/i,
  /\b(the\s+result\s+(was|is))\b/i,
  /\b(so\s+the\s+lesson\s+is)\b/i,
  /\b(moral\s+of\s+the\s+story)\b/i,
  /\b(and\s+boom)\b/i,
  /\b(never\s+again)\b/i,
  /\b(finally\s+it\s+worked)\b/i,
  /\b(that\s+changed\s+everything)\b/i,
  /\b(aur\s+fir\s+kya\s+hua)\b/i,
  /\b(toh\s+point\s+yeh\s+hai)\b/i,
  /\b(toh\s+seekh\s+yeh\s+hai)\b/i,
  /\b(isliye\s+kehte\s+hain)\b/i,
  /\b(aakhir\s+me(in)?)\b/i,
  /\b(yehi\s+hota\s+hai)\b/i,
  /\b(sach\s+samne\s+aa\s+gaya)\b/i,
  /\b(turn(ed)?\s+out\s+to\s+be)\b/i,
  /\b(the\s+bottom\s+line\s+is)\b/i,
  /\b(aur\s+(khel|baat)\s+khatam)\b/i,
];

// Sentiment lexicons
const EXCITING_WORDS = new Set([
  "insane", "crazy", "unbelievable", "epic", "amazing", "banger",
  "zabardast", "bawaal", "mast", "gazab", "fabulous", "awesome",
  "wild", "genius", "brilliant", "shandar", "superhit", "viral",
  "godlevel", "legendary", "cheatcode", "mindblowing", "gamechanger",
  "miracle", "impossible",
]);

const DRAMATIC_WORDS = new Set([
  "warning", "danger", "khatra", "shocking", "stop", "ruko",
  "rukiye", "disaster", "critical", "exposed", "scam", "dhokha",
  "trap", "crisis", "worst", "terrible", "urgent", "blunder",
  "blunders", "destroyed", "ruined", "fault",
]);

const FUNNY_WORDS = new Set([
  "funny", "hilarious", "laugh", "hasna", "haso", "joke",
  "mazaak", "comedy", "lmao", "lol", "pagal", "chutkula",
  "weird", "awkward", "ridiculous",
]);

const VIRAL_TRIGGER_WORDS = new Set([
  "secret", "hack", "trick", "trap", "mistake", "truth", "money",
  "algorithm", "crore", "lakh", "free", "viral", "warning", "exposed",
  "scam", "proof", "challenge", "formula", "galti", "formula", "rule",
  "million", "result", "busted",
]);

/**
 * Extracts audio and text signals for a clip candidate window.
 */
export function extractSignalsForSegment(
  tokens: HinglishWordToken[],
  segmentStart: number,
  segmentEnd: number,
  rmsPeaks?: Float32Array,
  videoBaselineRms?: number
): ExtractedSignals {
  const segmentTokens = tokens.filter((t) => t.start >= segmentStart && t.end <= segmentEnd);
  const reasons: string[] = [];

  // -------------------------------------------------------------------------
  // 1. Audio Signal Extraction (Dynamics, Crescendos, Energy Bursts)
  // -------------------------------------------------------------------------
  let avgRms = 0.05;
  let peakRms = 0.1;
  let dynamicRange = 1.0;
  let hasLaughterOrCheer = false;
  let energyCrescendoScore = 1.0;
  let sustainedEnergyRatio = 0.0;
  let burstCount = 0;
  let deadAirRatio = 0.0;

  if (rmsPeaks && rmsPeaks.length > 0) {
    const startIdx = Math.max(0, Math.floor(segmentStart * 100)); // 100 bins per sec (10ms)
    const endIdx = Math.min(rmsPeaks.length, Math.ceil(segmentEnd * 100));
    const totalBins = Math.max(1, endIdx - startIdx);

    let sum = 0;
    let max = 0;
    let min = 1.0;

    let firstHalfSum = 0;
    let firstHalfCount = 0;
    let secondHalfSum = 0;
    let secondHalfCount = 0;
    const midIdx = Math.floor((startIdx + endIdx) / 2);

    const sustainedThreshold = Math.max(0.12, (videoBaselineRms || 0.08) * 1.4);
    let sustainedBins = 0;
    let deadAirBins = 0;
    let lastBurstIdx = -100;

    for (let i = startIdx; i < endIdx; i++) {
      const val = rmsPeaks[i];
      sum += val;
      if (val > max) max = val;
      if (val < min) min = val;

      if (i < midIdx) {
        firstHalfSum += val;
        firstHalfCount++;
      } else {
        secondHalfSum += val;
        secondHalfCount++;
      }

      if (val >= sustainedThreshold) {
        sustainedBins++;
      }
      if (val < 0.025) {
        deadAirBins++;
      }

      // Detect reaction/laughter/cheer burst (separated by at least 0.5s / 50 bins)
      if (val > 0.25 && (val > avgRms * 2.2 || val > (videoBaselineRms || 0.08) * 2.5)) {
        if (i - lastBurstIdx > 50) {
          burstCount++;
          lastBurstIdx = i;
        }
      }
    }

    if (totalBins > 0) {
      avgRms = sum / totalBins;
      peakRms = max;
      dynamicRange = min > 0 ? max / min : max;
      sustainedEnergyRatio = Math.round((sustainedBins / totalBins) * 100) / 100;
      deadAirRatio = Math.round((deadAirBins / totalBins) * 100) / 100;

      const firstHalfAvg = firstHalfCount > 0 ? firstHalfSum / firstHalfCount : 0.05;
      const secondHalfAvg = secondHalfCount > 0 ? secondHalfSum / secondHalfCount : 0.05;

      if (firstHalfAvg > 0.02) {
        energyCrescendoScore = Math.round((secondHalfAvg / firstHalfAvg) * 100) / 100;
      }

      if (burstCount > 0 || (max > avgRms * 2.5 && max > 0.25)) {
        hasLaughterOrCheer = true;
        reasons.push(
          burstCount > 1
            ? `Multiple high energy audio bursts (${burstCount}x reactions)`
            : "High energy audio burst (applause/reaction)"
        );
      }

      if (energyCrescendoScore >= 1.25 && secondHalfAvg >= 0.15) {
        reasons.push("Climax energy crescendo (volume & momentum buildup)");
      }

      if (sustainedEnergyRatio >= 0.38) {
        reasons.push("High sustained vocal energy");
      }
    }
  }

  // Calculate Speech Cadence (WPM)
  const durationMinutes = Math.max(0.01, (segmentEnd - segmentStart) / 60);
  const speechPaceWpm = Math.round(segmentTokens.length / durationMinutes);

  if (speechPaceWpm >= 140 && speechPaceWpm <= 185) {
    reasons.push(`Optimal speech cadence (${speechPaceWpm} WPM)`);
  } else if (speechPaceWpm > 185 && speechPaceWpm <= 220) {
    reasons.push(`Fast kinetic delivery (${speechPaceWpm} WPM)`);
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

  // Composite Audio Energy Score (0 - 100)
  let energyScore = 30;
  energyScore += Math.min(30, (peakRms / 0.5) * 30);
  energyScore += sustainedEnergyRatio * 25;
  if (energyCrescendoScore >= 1.2) energyScore += 15;
  if (hasLaughterOrCheer) energyScore += Math.min(20, (burstCount || 1) * 10);
  if (deadAirRatio > 0.2) energyScore -= Math.min(20, deadAirRatio * 35);
  const finalEnergyScore = Math.max(5, Math.min(100, Math.round(energyScore)));

  const audioSignals: AudioSignals = {
    avgRms,
    peakRms,
    dynamicRange,
    hasLaughterOrCheer,
    speechPaceWpm,
    pauseCount,
    totalSilenceSeconds: Math.round(totalSilenceSeconds * 100) / 100,
    energyCrescendoScore,
    sustainedEnergyRatio,
    burstCount,
    deadAirRatio,
    energyScore: finalEnergyScore,
  };

  // -------------------------------------------------------------------------
  // 2. Text Signal Extraction (Hinglish + English)
  // -------------------------------------------------------------------------
  const first15Words = segmentTokens.slice(0, 15).map((t) => t.text).join(" ");
  const first8Words = segmentTokens.slice(0, 8).map((t) => t.text).join(" ");

  let hookType: TextSignals["hookType"] = "none";
  let hookScore = 0;
  let hookPhrase: string | undefined = undefined;

  // 1. Check Shock Hooks (High viral potency)
  for (const pat of SHOCK_HOOK_PATTERNS) {
    const m = first15Words.match(pat);
    if (m) {
      hookType = "bold_claim";
      hookScore = 98;
      hookPhrase = m[0];
      reasons.push(`Shock & disbelief hook ("${m[0]}")`);
      break;
    }
  }

  // 2. Check Bold Claim Hooks
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

  // 3. Check Secret & FOMO Hooks
  if (hookType === "none") {
    for (const pat of SECRET_FOMO_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "bold_claim";
        hookScore = 92;
        hookPhrase = m[0];
        reasons.push(`Secret / curiosity hook ("${m[0]}")`);
        break;
      }
    }
  }

  // 4. Check Urgent Advice / Mistake Hooks
  if (hookType === "none") {
    for (const pat of URGENT_ADVICE_HOOK_PATTERNS) {
      const m = first15Words.match(pat);
      if (m) {
        hookType = "bold_claim";
        hookScore = 92;
        hookPhrase = m[0];
        reasons.push(`Urgent warning hook ("${m[0]}")`);
        break;
      }
    }
  }

  // 5. Check Question Opener
  if (hookType === "none") {
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
  }

  // 6. Check Number Hook
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

  // 7. Check Contrast Hook
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

  // 8. Check Story Hook
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

  // 9. Check Comedy Hook
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

  // Check Payoff / Resolution in closing sentence
  const last15Words = segmentTokens.slice(-15).map((t) => t.text).join(" ");
  let hasPayoff = false;
  let payoffPhrase: string | undefined = undefined;

  for (const pat of PAYOFF_PATTERNS) {
    const m = last15Words.match(pat);
    if (m) {
      hasPayoff = true;
      payoffPhrase = m[0];
      reasons.push(`Punchline / payoff takeaway ("${m[0]}")`);
      break;
    }
  }

  // Filler words ratio & Viral keywords
  let fillerCount = 0;
  let excitingCount = 0;
  let dramaticCount = 0;
  let funnyCount = 0;
  let viralKeywordCount = 0;

  for (const tok of segmentTokens) {
    const clean = tok.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FILLER_WORDS.has(clean)) fillerCount++;
    if (EXCITING_WORDS.has(clean)) excitingCount++;
    if (DRAMATIC_WORDS.has(clean)) dramaticCount++;
    if (FUNNY_WORDS.has(clean)) funnyCount++;
    if (VIRAL_TRIGGER_WORDS.has(clean)) viralKeywordCount++;
  }

  const wordCount = Math.max(1, segmentTokens.length);
  const fillerRatio = fillerCount / wordCount;

  if (fillerRatio <= 0.04) {
    reasons.push("Clean delivery (minimal filler words)");
  }

  // Calculate First 3-Seconds Hook Retention Score
  const firstTokens = segmentTokens.slice(0, 8);
  let hookRetentionScore = 40; // baseline
  if (hookType !== "none") hookRetentionScore += 35;
  const earlyFillers = firstTokens.filter((t) =>
    FILLER_WORDS.has(t.text.toLowerCase().replace(/[^a-z0-9]/g, ""))
  ).length;
  if (earlyFillers === 0 && firstTokens.length >= 3) hookRetentionScore += 15;
  if (speechPaceWpm >= 140) hookRetentionScore += 10;
  hookRetentionScore = Math.min(100, hookRetentionScore);

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
    hookRetentionScore,
    keywordDensity,
    sentimentIntensity,
    sentimentCategory,
    fillerRatio,
    wordCount,
    hasPayoff,
    payoffPhrase,
    viralKeywordCount,
  };

  // -------------------------------------------------------------------------
  // 3. Composite Viral Breakdown & Badges
  // -------------------------------------------------------------------------
  const hookStrength = hookType !== "none" ? Math.max(hookScore, hookRetentionScore) : hookRetentionScore;
  const audioEnergy = finalEnergyScore;
  const pacingMomentum =
    speechPaceWpm >= 145 && speechPaceWpm <= 190
      ? 95
      : speechPaceWpm >= 125 && speechPaceWpm <= 210
      ? 75
      : 50;
  const climaxPayoff = hasPayoff ? 90 : energyCrescendoScore >= 1.2 ? 75 : 55;

  const retentionScore = Math.max(
    10,
    Math.min(
      100,
      Math.round(
        hookStrength * 0.35 +
          audioEnergy * 0.35 +
          pacingMomentum * 0.15 +
          climaxPayoff * 0.15
      )
    )
  );

  const viralBadges: string[] = [];
  if (energyCrescendoScore >= 1.25 && avgRms >= 0.12) {
    viralBadges.push("📈 Climax Crescendo");
  }
  if (hasLaughterOrCheer || burstCount > 0) {
    viralBadges.push("⚡ High Energy Burst");
  }
  if (peakRms >= 0.35) {
    viralBadges.push("🔥 Intense Vocal");
  }
  if (hookStrength >= 85) {
    viralBadges.push("🎣 10/10 Hook");
  }
  if (hasPayoff) {
    viralBadges.push("💬 Punchline Payoff");
  }
  if (pacingMomentum >= 85) {
    viralBadges.push("⚡ Rapid Pace");
  }
  if (retentionScore >= 80) {
    viralBadges.push("🚀 Viral Potential");
  }

  const viralBreakdown: ViralBreakdown = {
    hookStrength,
    audioEnergy,
    pacingMomentum,
    climaxPayoff,
    retentionScore,
    energyCrescendo: energyCrescendoScore >= 1.25,
    hasPayoff,
    viralBadges,
  };

  return {
    audio: audioSignals,
    text: textSignals,
    reasons,
    viralBreakdown,
  };
}
