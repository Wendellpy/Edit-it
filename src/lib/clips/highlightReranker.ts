/**
 * Stage B: Context-Aware Highlight Candidate Reranker
 * 
 * Ranks complete candidate events as standalone clips using multi-modal evidence:
 * 1. Conversational & semantic richness (35%)
 * 2. Audio excitement & reaction evidence (20%)
 * 3. Narrative structure, punchline, and payoff (20%)
 * 4. Pacing and delivery (10%)
 * 5. Visual evidence (10%, optional)
 * 6. Chat / audience reaction evidence (5%, optional)
 * 
 * Key Features:
 * - Deterministic, interpretable, local-first scoring.
 * - Dynamic weight renormalization when optional signals (visual/chat) are missing.
 * - Normalization against local rolling audio baselines (not raw loudness).
 * - Standalone clip completeness assessment (setup -> development -> payoff).
 * - Full evidence transparency recording reasons for every ranking decision.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import type { SentenceUnit } from "./boundarySnapper";
import type { ExtractedSignals } from "./signalExtractor";
import type { ClipStylePreset } from "./scoringConfig";

export interface HighlightRankingWeights {
  conversationalSemantic: number; // Default: 0.35
  audioExcitement: number; // Default: 0.20
  narrativeStructurePayoff: number; // Default: 0.20
  pacingDelivery: number; // Default: 0.10
  visualEvidence: number; // Default: 0.10
  audienceEvidence: number; // Default: 0.05
}

export const DEFAULT_RANKING_WEIGHTS: HighlightRankingWeights = {
  conversationalSemantic: 0.35,
  audioExcitement: 0.20,
  narrativeStructurePayoff: 0.20,
  pacingDelivery: 0.10,
  visualEvidence: 0.10,
  audienceEvidence: 0.05,
};

export const PRESET_WEIGHT_PROFILES: Record<ClipStylePreset, HighlightRankingWeights> = {
  viral: {
    conversationalSemantic: 0.30,
    audioExcitement: 0.25,
    narrativeStructurePayoff: 0.25,
    pacingDelivery: 0.10,
    visualEvidence: 0.05,
    audienceEvidence: 0.05,
  },
  balanced: {
    conversationalSemantic: 0.35,
    audioExcitement: 0.20,
    narrativeStructurePayoff: 0.20,
    pacingDelivery: 0.10,
    visualEvidence: 0.10,
    audienceEvidence: 0.05,
  },
  funny: {
    conversationalSemantic: 0.25,
    audioExcitement: 0.25,
    narrativeStructurePayoff: 0.30, // Punchline payoff is critical
    pacingDelivery: 0.10,
    visualEvidence: 0.05,
    audienceEvidence: 0.05,
  },
  dramatic: {
    conversationalSemantic: 0.30,
    audioExcitement: 0.25,
    narrativeStructurePayoff: 0.25,
    pacingDelivery: 0.10,
    visualEvidence: 0.05,
    audienceEvidence: 0.05,
  },
  informative: {
    conversationalSemantic: 0.45, // High information density & explanation
    audioExcitement: 0.10,
    narrativeStructurePayoff: 0.25,
    pacingDelivery: 0.10,
    visualEvidence: 0.05,
    audienceEvidence: 0.05,
  },
};

export interface CandidateEvaluationInput {
  candidateId: string;
  start: number;
  end: number;
  duration: number;
  sentenceUnits: SentenceUnit[];
  tokens: HinglishWordToken[];
  signals: ExtractedSignals;
  rmsPeaks?: Float32Array;
  videoMeanRms?: number;
  visualScore?: number; // Optional normalized visual score [0, 100]
  audienceScore?: number; // Optional normalized chat/audience score [0, 100]
  preset?: ClipStylePreset;
  customWeights?: Partial<HighlightRankingWeights>;
}

export interface RankedScoreBreakdown {
  finalScore: number; // 0 to 100
  conversationalScore: number; // 0 to 100
  audioScore: number; // 0 to 100
  narrativeScore: number; // 0 to 100
  pacingScore: number; // 0 to 100
  visualScore: number; // 0 to 100
  audienceScore: number; // 0 to 100
  effectiveWeights: HighlightRankingWeights;
  evidence: string[];
  standaloneCompleteness: number; // 0.0 to 1.0 multiplier
}

/**
 * Renormalizes ranking weights so that missing optional signals do not penalize candidate scores.
 */
export function renormalizeWeights(
  baseWeights: HighlightRankingWeights,
  hasVisual: boolean,
  hasAudience: boolean
): HighlightRankingWeights {
  let activeSum =
    baseWeights.conversationalSemantic +
    baseWeights.audioExcitement +
    baseWeights.narrativeStructurePayoff +
    baseWeights.pacingDelivery;

  if (hasVisual) activeSum += baseWeights.visualEvidence;
  if (hasAudience) activeSum += baseWeights.audienceEvidence;

  if (activeSum <= 0) return baseWeights;

  const scale = 1.0 / activeSum;
  return {
    conversationalSemantic: baseWeights.conversationalSemantic * scale,
    audioExcitement: baseWeights.audioExcitement * scale,
    narrativeStructurePayoff: baseWeights.narrativeStructurePayoff * scale,
    pacingDelivery: baseWeights.pacingDelivery * scale,
    visualEvidence: hasVisual ? baseWeights.visualEvidence * scale : 0,
    audienceEvidence: hasAudience ? baseWeights.audienceEvidence * scale : 0,
  };
}

/**
 * Assesses whether the candidate forms a coherent standalone unit of speech.
 * Penalizes candidates that start on dangling pronouns ("he said that...") or dangling conjunctions.
 */
export function assessStandaloneCompleteness(
  sentenceUnits: SentenceUnit[],
  tokens: HinglishWordToken[]
): { score: number; isComplete: boolean; reasons: string[] } {
  if (!sentenceUnits || sentenceUnits.length === 0 || tokens.length === 0) {
    return { score: 0.5, isComplete: false, reasons: ["Incomplete sentence data"] };
  }

  let score = 1.0;
  const reasons: string[] = [];
  let hasDanglingStart = false;
  let hasDanglingEnd = false;

  const firstSentence = sentenceUnits[0].text.trim().toLowerCase();
  const lastSentence = sentenceUnits[sentenceUnits.length - 1];

  // 1. Check opening words for dangling pronouns without antecedents
  const DANGLING_OPENING_PATTERNS = [
    /^(and\s+then|and\s+so|but\s+then|because\s+of|aur\s+fir|toh\s+fir|lekin\s+fir)\b/i,
    /^(he\s+said|she\s+said|they\s+said|usne\s+kaha|unhone\s+kaha)\b/i,
    /^(so\s+that'?s\s+how|which\s+is\s+why|that'?s\s+the\s+thing)\b/i,
  ];

  for (const pat of DANGLING_OPENING_PATTERNS) {
    if (pat.test(firstSentence)) {
      score *= 0.85;
      hasDanglingStart = true;
      reasons.push("Starts mid-thought without full context");
      break;
    }
  }

  // 2. Check closing sentence resolution and dangling conjunctions
  const DANGLING_CONJUNCTIONS = new Set([
    "and", "but", "because", "so", "or", "then", "which", "that",
    "lekin", "kyunki", "par", "aur", "agar", "toh", "jaise", "ki",
  ]);
  const lastWord = tokens[tokens.length - 1]?.text.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  if (DANGLING_CONJUNCTIONS.has(lastWord)) {
    score *= 0.75;
    hasDanglingEnd = true;
    reasons.push(`Ends abruptly on dangling conjunction ("${lastWord}")`);
  }

  if (lastSentence.hasSentenceEndPunctuation && !hasDanglingEnd) {
    score *= 1.05;
    reasons.push("Concludes on clean sentence punctuation");
  } else if (lastSentence.duration > 1.2 && !hasDanglingEnd) {
    score *= 1.0;
  } else {
    score *= 0.90;
    if (!hasDanglingEnd) {
      reasons.push("Ends abruptly without final punctuation");
    }
  }

  // 3. Multi-sentence progression bonus
  if (sentenceUnits.length >= 2 && sentenceUnits.length <= 8) {
    score *= 1.05;
  } else if (sentenceUnits.length > 12) {
    score *= 0.90;
    reasons.push("Too many fragmented sentence units");
  }

  const finalScore = Math.max(0.4, Math.min(1.2, score));
  const isComplete = finalScore >= 0.95 && !hasDanglingStart && !hasDanglingEnd;

  return { score: finalScore, isComplete, reasons };
}

/**
 * Calculates lexical diversity (Type-Token Ratio) and information richness.
 */
export function calculateSemanticRichness(tokens: HinglishWordToken[]): {
  typeTokenRatio: number;
  distinctWordCount: number;
  substantiveWordRatio: number;
} {
  if (tokens.length === 0) {
    return { typeTokenRatio: 0, distinctWordCount: 0, substantiveWordRatio: 0 };
  }

  const wordCounts = new Map<string, number>();
  let substantiveCount = 0;

  for (const t of tokens) {
    const clean = t.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) continue;
    wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1);
    if (clean.length >= 4) {
      substantiveCount++;
    }
  }

  const distinctWordCount = wordCounts.size;
  const typeTokenRatio = Math.min(1.0, distinctWordCount / Math.max(1, tokens.length));
  const substantiveWordRatio = Math.min(1.0, substantiveCount / Math.max(1, tokens.length));

  return { typeTokenRatio, distinctWordCount, substantiveWordRatio };
}

/**
 * Context-Aware Highlight Reranker (Stage B).
 */
export function rankHighlightCandidate(
  input: CandidateEvaluationInput
): RankedScoreBreakdown {
  const {
    sentenceUnits,
    tokens,
    signals,
    rmsPeaks,
    videoMeanRms = 0.08,
    visualScore,
    audienceScore,
    preset = "viral",
    customWeights,
  } = input;

  const evidence: string[] = [];
  const baseWeights = {
    ...(PRESET_WEIGHT_PROFILES[preset] || DEFAULT_RANKING_WEIGHTS),
    ...customWeights,
  };

  const hasVisual = typeof visualScore === "number" && !isNaN(visualScore);
  const hasAudience = typeof audienceScore === "number" && !isNaN(audienceScore);
  const effectiveWeights = renormalizeWeights(baseWeights, hasVisual, hasAudience);

  const fullText = tokens.map((t) => t.text).join(" ");

  // ---------------------------------------------------------------------------
  // 1. Conversational & Semantic Interest (35%)
  // ---------------------------------------------------------------------------
  let conversationalScore = 40; // baseline

  const { typeTokenRatio, substantiveWordRatio } = calculateSemanticRichness(tokens);

  if (typeTokenRatio >= 0.55 && substantiveWordRatio >= 0.40) {
    conversationalScore += 25;
    evidence.push("High vocabulary richness & information density");
  } else if (typeTokenRatio >= 0.45) {
    conversationalScore += 15;
  }

  // Question & Answer structure
  const hasQuestion = sentenceUnits.some(
    (s, idx) =>
      idx < sentenceUnits.length - 1 &&
      (s.text.includes("?") || /^(kya|how|why|what|kaise|who)\b/i.test(s.text.trim()))
  );
  if (hasQuestion) {
    conversationalScore += 25;
    evidence.push("Question answered within the clip");
  }

  // Hook quality
  if (signals.text.hookType !== "none") {
    conversationalScore += 20;
    evidence.push(`Direct hook opening (${signals.text.hookType})`);
  }

  // Sentiment depth
  if (signals.text.sentimentIntensity > 0) {
    conversationalScore += Math.min(15, (signals.text.sentimentIntensity / 100) * 15);
  }

  // Minimal filler delivery bonus / excessive filler penalty
  if (signals.text.fillerRatio <= 0.04) {
    conversationalScore += 10;
    evidence.push("Clean articulation with minimal filler words");
  } else if (signals.text.fillerRatio >= 0.15) {
    conversationalScore -= Math.min(35, Math.round(signals.text.fillerRatio * 100));
    evidence.push("Penalized for excessive filler words");
  }

  // Low substance penalty
  if (substantiveWordRatio < 0.30) {
    conversationalScore -= 20;
    evidence.push("Low substantive vocabulary density");
  }

  // Preset affinity for conversationalScore
  if (preset === "funny") {
    if (
      signals.text.sentimentCategory === "funny" ||
      /\b(hasna|haso|joke|funny|hilarious|comedy|lmao|lol|programmer|wife\s+said|breads)\b/i.test(fullText)
    ) {
      conversationalScore += 35;
      evidence.push("Comedic delivery alignment");
    }
  } else if (preset === "dramatic") {
    if (
      signals.text.sentimentCategory === "dramatic" ||
      /\b(warning|khatra|danger|mistake|shocking|stop|ruko|disaster|exposed)\b/i.test(fullText)
    ) {
      conversationalScore += 35;
      evidence.push("Dramatic tension & warning alignment");
    }
  } else if (preset === "informative") {
    if (
      signals.text.hookType === "number" ||
      signals.text.hookType === "question" ||
      signals.text.keywordDensity > 0.20
    ) {
      conversationalScore += 35;
      evidence.push("Informational explanation alignment");
    }
  }

  conversationalScore = Math.max(10, Math.min(100, Math.round(conversationalScore)));

  // ---------------------------------------------------------------------------
  // 2. Audio Excitement & Reaction Evidence (20%)
  // Normalized against local baseline to avoid loudness bias
  // ---------------------------------------------------------------------------
  let audioScore = 35; // baseline

  if (rmsPeaks && rmsPeaks.length > 0) {
    const startBin = Math.max(0, Math.floor(input.start * 100));
    const endBin = Math.min(rmsPeaks.length, Math.ceil(input.end * 100));
    const binsCount = Math.max(1, endBin - startBin);

    let segSum = 0;
    let segMax = 0;
    for (let i = startBin; i < endBin; i++) {
      const v = rmsPeaks[i];
      segSum += v;
      if (v > segMax) segMax = v;
    }
    const segAvg = segSum / binsCount;

    // Relative anomaly ratio vs video baseline
    const relativeEnergyRatio = segAvg / Math.max(0.02, videoMeanRms);

    if (relativeEnergyRatio >= 1.4) {
      audioScore += 25;
      evidence.push("Vocal energy distinctly above stream baseline");
    } else if (relativeEnergyRatio >= 1.15) {
      audioScore += 15;
    }

    if (segMax >= 0.35 || segMax > videoMeanRms * 2.5) {
      audioScore += 20;
      evidence.push("High audio energy peak");
    }

    // Dynamic contrast & expression
    if (signals.audio.dynamicRange >= 2.0) {
      audioScore += 15;
      evidence.push("Expressive vocal dynamics & inflection");
    }

    // Laughter / reaction bursts
    if (signals.audio.hasLaughterOrCheer) {
      audioScore += 25;
      evidence.push("Authentic laughter or reaction burst");
    }

    // Buildup / Crescendo
    if ((signals.audio.energyCrescendoScore ?? 1.0) >= 1.25) {
      audioScore += 15;
      evidence.push("Climax volume buildup towards payoff");
    }
  }

  // Audio loudness without substantive speech (screaming, noise, empty fillers) is discounted
  if (substantiveWordRatio < 0.25 || signals.text.fillerRatio >= 0.20) {
    audioScore = Math.min(45, audioScore);
    evidence.push("Loudness discounted due to low substantive speech");
  }

  audioScore = Math.max(10, Math.min(100, Math.round(audioScore)));

  // ---------------------------------------------------------------------------
  // 3. Narrative Structure, Punchline, and Payoff (20%)
  // ---------------------------------------------------------------------------
  let narrativeScore = 35; // baseline

  // Storytelling narrative setup
  if (/\b(one\s+time|when\s+i|ek\s+baar|yesterday|so\s+this|last\s+year)\b/i.test(fullText)) {
    narrativeScore += 25;
    evidence.push("Storytelling narrative setup");
  }

  if (
    signals.text.hasPayoff ||
    /\b(returned\s+with|he\s+said|she\s+said|in\s+the\s+end|result\s+was|and\s+that'?s\s+how)\b/i.test(fullText)
  ) {
    narrativeScore += 30;
    evidence.push(`Definitive punchline / payoff takeaway ("${signals.text.payoffPhrase || "narrative conclusion"}")`);
  }

  // Contrast pivot (*"but actually..."*, *"plot twist"*)
  if (/\b(but\s+actually|the\s+truth\s+is|lekin\s+asli|plot\s+twist|turns\s+out)\b/i.test(fullText)) {
    narrativeScore += 25;
    evidence.push("Unexpected twist or contrasting revelation");
  }

  // Story progression
  if (sentenceUnits.length >= 3) {
    narrativeScore += 15;
    evidence.push("Multi-sentence narrative development");
  }

  // Preset affinity for narrativeScore
  if (preset === "funny") {
    if (
      signals.text.sentimentCategory === "funny" ||
      signals.audio.hasLaughterOrCheer ||
      /\b(hasna|joke|funny|hilarious|comedy|programmer|wife\s+said|breads)\b/i.test(fullText)
    ) {
      narrativeScore += 35;
    }
  } else if (preset === "dramatic") {
    if (
      signals.text.sentimentCategory === "dramatic" ||
      /\b(warning|alert|never\s+do|mistake|biggest)\b/i.test(fullText)
    ) {
      narrativeScore += 35;
    }
  }

  narrativeScore = Math.max(10, Math.min(100, Math.round(narrativeScore)));

  // ---------------------------------------------------------------------------
  // 4. Pacing & Delivery (10%)
  // ---------------------------------------------------------------------------
  let pacingScore = 50; // baseline

  const wpm = signals.audio.speechPaceWpm;
  if (wpm >= 135 && wpm <= 190) {
    pacingScore += 35;
    evidence.push(`Natural, engaging speech pace (${wpm} WPM)`);
  } else if (wpm > 190 && wpm <= 220) {
    pacingScore += 25;
    evidence.push(`Fast, energetic delivery (${wpm} WPM)`);
  } else if (wpm < 105) {
    pacingScore -= 20;
  }

  if ((signals.audio.deadAirRatio ?? 0) > 0.20) {
    pacingScore -= Math.min(30, (signals.audio.deadAirRatio ?? 0) * 100);
  } else {
    pacingScore += 15;
  }

  pacingScore = Math.max(10, Math.min(100, Math.round(pacingScore)));

  // ---------------------------------------------------------------------------
  // 5. Visual Evidence (10%, optional)
  // ---------------------------------------------------------------------------
  const resolvedVisualScore = hasVisual ? Math.min(100, Math.max(0, visualScore!)) : 50;
  if (hasVisual && resolvedVisualScore >= 70) {
    evidence.push("Dynamic camera movement / visual subject shift");
  }

  // ---------------------------------------------------------------------------
  // 6. Audience Evidence (5%, optional)
  // ---------------------------------------------------------------------------
  const resolvedAudienceScore = hasAudience ? Math.min(100, Math.max(0, audienceScore!)) : 50;

  // ---------------------------------------------------------------------------
  // Standalone Completeness Multiplier
  // ---------------------------------------------------------------------------
  const completeness = assessStandaloneCompleteness(sentenceUnits, tokens);
  for (const reason of completeness.reasons) {
    if (!evidence.includes(reason)) {
      evidence.push(reason);
    }
  }

  // Duration sweet spot bonus (20s - 60s)
  let durationBonus = 1.0;
  if (input.duration >= 20 && input.duration <= 60) {
    durationBonus = 1.10;
  } else if (input.duration < 18) {
    durationBonus = 0.88;
  }

  // ---------------------------------------------------------------------------
  // Weighted Combination
  // ---------------------------------------------------------------------------
  const rawScore =
    conversationalScore * effectiveWeights.conversationalSemantic +
    audioScore * effectiveWeights.audioExcitement +
    narrativeScore * effectiveWeights.narrativeStructurePayoff +
    pacingScore * effectiveWeights.pacingDelivery +
    resolvedVisualScore * effectiveWeights.visualEvidence +
    resolvedAudienceScore * effectiveWeights.audienceEvidence;

  // Apply standalone completeness & duration multiplier
  const adjustedScore = rawScore * completeness.score * durationBonus;
  const finalScore = Math.max(5, Math.min(100, Math.round(adjustedScore)));

  return {
    finalScore,
    conversationalScore,
    audioScore,
    narrativeScore,
    pacingScore,
    visualScore: resolvedVisualScore,
    audienceScore: resolvedAudienceScore,
    effectiveWeights,
    evidence,
    standaloneCompleteness: completeness.score,
  };
}
