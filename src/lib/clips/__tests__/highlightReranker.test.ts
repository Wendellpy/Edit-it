import { describe, it, expect } from "vitest";
import {
  rankHighlightCandidate,
  renormalizeWeights,
  DEFAULT_RANKING_WEIGHTS,
  PRESET_WEIGHT_PROFILES,
  calculateSemanticRichness,
  assessStandaloneCompleteness,
} from "../highlightReranker";
import { extractSignalsForSegment } from "../signalExtractor";
import type { HinglishWordToken } from "../../hinglish/postProcessor";
import type { SentenceUnit } from "../boundarySnapper";

describe("Highlight Reranker (Stage B Context-Aware Ranking)", () => {
  function makeTokens(words: string[], startTime = 0, wordDur = 0.35): HinglishWordToken[] {
    return words.map((w, i) => ({
      id: `w_${i}`,
      text: w,
      romanText: w,
      devanagariText: w,
      start: startTime + i * wordDur,
      end: startTime + (i + 1) * wordDur - 0.05,
      confidence: 0.98,
      isCodeMixedEnglish: false,
    }));
  }

  function makeSentences(specs: Array<{ text: string; start: number; end: number }>): SentenceUnit[] {
    return specs.map((s, idx) => ({
      index: idx,
      text: s.text,
      start: s.start,
      end: s.end,
      duration: s.end - s.start,
      tokens: makeTokens(s.text.split(" "), s.start, (s.end - s.start) / s.text.split(" ").length),
      hasSentenceEndPunctuation: /[.?!।]$/.test(s.text),
    }));
  }

  it("renormalizes weights correctly when optional visual & audience signals are missing", () => {
    // Both missing: only conversational (0.35), audio (0.20), narrative (0.20), pacing (0.10) active
    const renormalized = renormalizeWeights(DEFAULT_RANKING_WEIGHTS, false, false);

    expect(renormalized.visualEvidence).toBe(0);
    expect(renormalized.audienceEvidence).toBe(0);

    const totalWeight =
      renormalized.conversationalSemantic +
      renormalized.audioExcitement +
      renormalized.narrativeStructurePayoff +
      renormalized.pacingDelivery;

    expect(totalWeight).toBeCloseTo(1.0, 4);

    // Conversational should scale up proportionally
    expect(renormalized.conversationalSemantic).toBeGreaterThan(DEFAULT_RANKING_WEIGHTS.conversationalSemantic);
  });

  it("renormalizes weights correctly when visual is present but audience is missing", () => {
    const renormalized = renormalizeWeights(DEFAULT_RANKING_WEIGHTS, true, false);

    expect(renormalized.visualEvidence).toBeGreaterThan(0);
    expect(renormalized.audienceEvidence).toBe(0);

    const totalWeight =
      renormalized.conversationalSemantic +
      renormalized.audioExcitement +
      renormalized.narrativeStructurePayoff +
      renormalized.pacingDelivery +
      renormalized.visualEvidence;

    expect(totalWeight).toBeCloseTo(1.0, 4);
  });

  it("prioritizes quiet, clever jokes over loud but uninteresting repetitive audio", () => {
    // 1. Quiet conversational joke (subtle audio, rich narrative payoff)
    const jokeWords = "one time a programmer went to the store and his wife said buy bread and if they have eggs buy ten. he returned with ten breads.".split(" ");
    const jokeTokens = makeTokens(jokeWords, 10, 0.3);
    const jokeSentences = makeSentences([
      { text: "one time a programmer went to the store.", start: 10, end: 14 },
      { text: "his wife said buy bread and if they have eggs buy ten.", start: 14, end: 19 },
      { text: "he returned with ten breads.", start: 19, end: 23 },
    ]);

    // Flat, low-volume audio (0.07 RMS)
    const quietRms = new Float32Array(5000);
    quietRms.fill(0.07);

    const jokeSignals = extractSignalsForSegment(jokeTokens, 10, 23, quietRms, 0.07);

    const jokeRank = rankHighlightCandidate({
      candidateId: "cand_joke",
      start: 10,
      end: 23,
      duration: 13,
      sentenceUnits: jokeSentences,
      tokens: jokeTokens,
      signals: jokeSignals,
      rmsPeaks: quietRms,
      videoMeanRms: 0.07,
      preset: "funny",
    });

    // 2. Loud but repetitive/boring audio (screaming "aaaa" / mic blowing with empty text)
    const boringWords = "um matlab basically aah aah screaming loud noise testing testing.".split(" ");
    const boringTokens = makeTokens(boringWords, 30, 0.35);
    const boringSentences = makeSentences([
      { text: "um matlab basically aah aah screaming loud noise testing testing.", start: 30, end: 40 },
    ]);

    // Very loud audio (0.50 RMS)
    const loudRms = new Float32Array(5000);
    loudRms.fill(0.10);
    for (let i = 3000; i < 4000; i++) loudRms[i] = 0.50;

    const boringSignals = extractSignalsForSegment(boringTokens, 30, 40, loudRms, 0.15);

    const boringRank = rankHighlightCandidate({
      candidateId: "cand_boring_loud",
      start: 30,
      end: 40,
      duration: 10,
      sentenceUnits: boringSentences,
      tokens: boringTokens,
      signals: boringSignals,
      rmsPeaks: loudRms,
      videoMeanRms: 0.15,
      preset: "funny",
    });

    // Semantic humor & punchline structure must outscore empty loudness
    expect(jokeRank.finalScore).toBeGreaterThan(boringRank.finalScore);
    expect(jokeRank.narrativeScore).toBeGreaterThan(boringRank.narrativeScore);
  });

  it("scores Hinglish content without explicit trigger words based on semantic density and delivery", () => {
    // Rich natural Hinglish explanation without sensational trigger words
    const naturalHinglish = "dosto agar aap consistency maintain karoge toh compounding ka result do saal baad clearly dikhai dega.".split(" ");
    const tokens = makeTokens(naturalHinglish, 0, 0.32);
    const sentences = makeSentences([
      { text: naturalHinglish.join(" "), start: 0, end: naturalHinglish.length * 0.32 },
    ]);

    const rms = new Float32Array(2000);
    rms.fill(0.09);

    const signals = extractSignalsForSegment(tokens, 0, 20, rms, 0.08);

    const rank = rankHighlightCandidate({
      candidateId: "cand_hinglish_natural",
      start: 0,
      end: 20,
      duration: 20,
      sentenceUnits: sentences,
      tokens,
      signals,
      preset: "informative",
    });

    expect(rank.finalScore).toBeGreaterThanOrEqual(55);
    expect(rank.conversationalScore).toBeGreaterThanOrEqual(60);
  });

  it("prevents isolated trigger words in low-substance contexts from artificially dominating", () => {
    // Isolated trigger word with empty filler
    const hollowTriggerWords = "um matlab basically viral insane secret bhai.".split(" ");
    const tokens = makeTokens(hollowTriggerWords, 0, 0.4);
    const sentences = makeSentences([
      { text: hollowTriggerWords.join(" "), start: 0, end: 10 },
    ]);

    const signals = extractSignalsForSegment(tokens, 0, 10);
    const rank = rankHighlightCandidate({
      candidateId: "cand_hollow_trigger",
      start: 0,
      end: 10,
      duration: 10,
      sentenceUnits: sentences,
      tokens,
      signals,
      preset: "viral",
    });

    // Score should be kept moderate due to filler penalties and low substantive depth
    expect(rank.finalScore).toBeLessThan(75);
  });

  it("evaluates standalone completeness: penalizes dangling conjunctions and rewards complete thoughts", () => {
    const danglingTokens = makeTokens(["we", "were", "planning", "everything", "and", "because"]);
    const danglingSentences = makeSentences([
      { text: "we were planning everything and because", start: 0, end: 5 },
    ]);

    const danglingEval = assessStandaloneCompleteness(danglingSentences, danglingTokens);
    expect(danglingEval.isComplete).toBe(false);
    expect(danglingEval.score).toBeLessThanOrEqual(0.85);

    const completeTokens = makeTokens(["we", "finally", "launched", "the", "product", "and", "it", "succeeded."]);
    const completeSentences = makeSentences([
      { text: "we finally launched the product and it succeeded.", start: 0, end: 5 },
    ]);

    const completeEval = assessStandaloneCompleteness(completeSentences, completeTokens);
    expect(completeEval.isComplete).toBe(true);
    expect(completeEval.score).toBeGreaterThanOrEqual(0.95);
  });
});
