import { describe, it, expect } from "vitest";
import {
  determineOptimalTemplateId,
  selectCaptionTemplate,
  hasDevanagariContent,
} from "../templateSelector";
import type { ClipCandidate } from "../clipFinder";
import type { HinglishWordToken } from "../../hinglish/postProcessor";

function makeToken(
  text: string,
  start: number,
  end: number,
  devanagariText?: string
): HinglishWordToken {
  return {
    id: `tok_${Math.random().toString(36).substring(7)}`,
    text,
    start,
    end,
    confidence: 0.95,
    romanText: text,
    devanagariText: devanagariText || text,
    isCodeMixedEnglish: false,
  };
}

function createMockCandidate(overrides: Partial<ClipCandidate> = {}): ClipCandidate {
  const defaultTokens: HinglishWordToken[] = [
    makeToken("This", 0.0, 0.3),
    makeToken("is", 0.3, 0.5),
    makeToken("an", 0.5, 0.7),
    makeToken("insane", 0.7, 1.2),
    makeToken("secret", 1.2, 1.8),
  ];

  return {
    id: "clip_test_1",
    index: 0,
    start: 0,
    end: 10,
    duration: 10,
    score: 85,
    rawScore: 120,
    headline: "This is an insane secret",
    firstSentence: "This is an insane secret.",
    lastSentence: "You won't believe it.",
    reasons: ["Fast hook", "High loudness"],
    hookType: "bold_claim",
    tokens: defaultTokens,
    signals: {
      audio: {
        avgRms: 0.55,
        peakRms: 0.85,
        dynamicRange: 0.3,
        hasLaughterOrCheer: false,
        speechPaceWpm: 150,
        pauseCount: 1,
        totalSilenceSeconds: 0.2,
      },
      text: {
        hookType: "bold_claim",
        hookScore: 80,
        hookPhrase: "insane secret",
        keywordDensity: 0.4,
        sentimentIntensity: 0.8,
        sentimentCategory: "exciting",
        fillerRatio: 0.0,
        wordCount: 5,
      },
      reasons: ["Fast hook", "High loudness"],
    },
    ...overrides,
  };
}

describe("Caption Template Selector & Enricher", () => {
  describe("hasDevanagariContent", () => {
    it("detects Hindi Devanagari Unicode characters", () => {
      const tokens: HinglishWordToken[] = [
        makeToken("नमस्ते", 0, 1, "नमस्ते"),
      ];
      expect(hasDevanagariContent(tokens)).toBe(true);
    });

    it("returns false for purely Romanized Hinglish or English tokens", () => {
      const tokens: HinglishWordToken[] = [
        makeToken("Bhai", 0, 1),
        makeToken("kya", 1, 2),
      ];
      expect(hasDevanagariContent(tokens)).toBe(false);
    });
  });

  describe("determineOptimalTemplateId", () => {
    it("selects Royal Hindi Calligraphy for Devanagari script content", () => {
      const candidate = createMockCandidate({
        tokens: [
          makeToken("यह", 0, 0.5, "यह"),
          makeToken("सच", 0.5, 1.0, "सच"),
        ],
      });
      const res = determineOptimalTemplateId(candidate);
      expect(res.presetId).toBe("devanagari_calligraphy_bold");
    });

    it("selects MrBeast bold squash for rapid pacing (> 175 WPM) with bold claims", () => {
      const candidate = createMockCandidate({
        hookType: "bold_claim",
        signals: {
          ...createMockCandidate().signals,
          audio: {
            ...createMockCandidate().signals.audio,
            speechPaceWpm: 195,
          },
        },
      });
      const res = determineOptimalTemplateId(candidate);
      expect(res.presetId).toBe("mr_beast_bold");
    });

    it("selects Hormozi highlighter box for rapid pacing with questions", () => {
      const candidate = createMockCandidate({
        hookType: "question",
        signals: {
          ...createMockCandidate().signals,
          audio: {
            ...createMockCandidate().signals.audio,
            speechPaceWpm: 185,
          },
        },
      });
      const res = determineOptimalTemplateId(candidate);
      expect(res.presetId).toBe("alex_hormozi_punch");
    });

    it("selects Sunshine glowing impact for deliberate/slow pacing (< 130 WPM)", () => {
      const candidate = createMockCandidate({
        hookType: "none",
        signals: {
          ...createMockCandidate().signals,
          audio: {
            ...createMockCandidate().signals.audio,
            speechPaceWpm: 110,
          },
        },
      });
      const res = determineOptimalTemplateId(candidate);
      expect(res.presetId).toBe("sunshine_impact_yellow");
    });

    it("selects Die-cut sticker for comedy hooks", () => {
      const candidate = createMockCandidate({
        hookType: "comedy",
        signals: {
          ...createMockCandidate().signals,
          audio: {
            ...createMockCandidate().signals.audio,
            speechPaceWpm: 145,
          },
        },
      });
      const res = determineOptimalTemplateId(candidate);
      expect(res.presetId).toBe("die_cut_sticker");
    });

    it("respects explicit user vibe preferences", () => {
      const candidate = createMockCandidate();
      const res = determineOptimalTemplateId(candidate, "minimal");
      expect(res.presetId).toBe("clean_sub_inter");
    });
  });

  describe("selectCaptionTemplate enrichment", () => {
    it("applies smart keywords, emojis, and filler word filtering", () => {
      const tokensWithFillersAndPowerWords: HinglishWordToken[] = [
        makeToken("um", 0.0, 0.2), // filler
        makeToken("this", 0.2, 0.5),
        makeToken("viral", 0.5, 0.9), // power word -> should get emoji 🚀 & keyword
        makeToken("paisa", 0.9, 1.4), // Hinglish power word -> should get 💰
      ];

      const candidate = createMockCandidate({
        tokens: tokensWithFillersAndPowerWords,
      });

      const res = selectCaptionTemplate(candidate, {
        enableKeywords: true,
        enableEmojis: true,
        removeFillers: true,
      });

      expect(res.template).toBeDefined();
      expect(res.template.id).toBeDefined();
      expect(res.fillerWordsRemoved).toBe(1);
      // 'um' should be removed
      expect(res.styledTokens.some((t) => t.text.toLowerCase() === "um")).toBe(false);
      // 'viral' should have appended 🚀 emoji
      expect(res.styledTokens.some((t) => t.text.includes("🚀"))).toBe(true);
      // 'paisa' should have appended 💰 emoji
      expect(res.styledTokens.some((t) => t.text.includes("💰"))).toBe(true);
      // At least 1 token highlighted as keyword
      expect(res.highlightCount).toBeGreaterThan(0);
    });

    it("allows custom template ID overrides", () => {
      const candidate = createMockCandidate();
      const res = selectCaptionTemplate(candidate, {
        templateId: "behind_head_giant_word",
      });
      expect(res.template.id).toBe("behind_head_giant_word");
    });
  });
});
