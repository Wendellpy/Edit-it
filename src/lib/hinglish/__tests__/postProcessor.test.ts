import { describe, it, expect } from "vitest";
import {
  normalizeTokenToHinglish,
  processTranscriptHinglish,
  toggleTranscriptScript,
} from "../postProcessor";
import type { WordToken } from "@/lib/timestampRefiner";

describe("postProcessor - Hinglish Processing & Script Toggle", () => {
  it("should keep Latin-script English words completely untouched", () => {
    const videoToken = normalizeTokenToHinglish("video");
    expect(videoToken.roman).toBe("video");
    expect(videoToken.isCodeMixedEnglish).toBe(true);

    const uploadToken = normalizeTokenToHinglish("upload");
    expect(uploadToken.roman).toBe("upload");
    expect(uploadToken.isCodeMixedEnglish).toBe(true);
  });

  it("should normalize high-frequency Devanagari tokens using curated lexicon", () => {
    const kyaToken = normalizeTokenToHinglish("क्या");
    expect(kyaToken.roman).toBe("kya");

    const haiToken = normalizeTokenToHinglish("है");
    expect(haiToken.roman).toBe("hai");

    const maineToken = normalizeTokenToHinglish("मैंने");
    expect(maineToken.roman).toBe("maine");

    const kiyaToken = normalizeTokenToHinglish("किया,");
    expect(kiyaToken.roman).toBe("kiya,");
  });

  it("should transform tokens and allow instant script toggling without re-transcribing", () => {
    const rawTokens: WordToken[] = [
      { id: "1", text: "मैंने", start: 0.1, end: 0.4, confidence: 0.98 },
      { id: "2", text: "video", start: 0.5, end: 0.8, confidence: 0.99 },
      { id: "3", text: "अपलोड", start: 0.9, end: 1.2, confidence: 0.95 },
      { id: "4", text: "किया,", start: 1.3, end: 1.6, confidence: 0.99 },
    ];

    // Process to Roman
    const processed = processTranscriptHinglish(rawTokens, "roman");
    expect(processed[0].text).toBe("maine");
    expect(processed[1].text).toBe("video");
    expect(processed[3].text).toBe("kiya,");

    // Toggle to Devanagari
    const devanagari = toggleTranscriptScript(processed, "devanagari");
    expect(devanagari[0].text).toBe("मैंने");
    expect(devanagari[1].text).toBe("video"); // English kept untouched
    expect(devanagari[3].text).toBe("किया,");

    // Toggle back to Roman
    const romanAgain = toggleTranscriptScript(devanagari, "roman");
    expect(romanAgain[0].text).toBe("maine");
  });

  it("should accurately resolve full battery of creator expressions via lexicon", () => {
    const creatorLexiconCases: Array<[string, string]> = [
      ["आज", "aaj"],
      ["कल", "kal"],
      ["रात", "raat"],
      ["बात", "baat"],
      ["काम", "kaam"],
      ["पैसा", "paisa"],
      ["रुपये", "rupaye"],
      ["जुगाड़", "jugaad"],
      ["बढ़िया", "badhiya"],
      ["एकदम", "ekdum"],
      ["झकास", "jhakaas"],
      ["यार", "yaar"],
      ["दोस्त", "dost"],
      ["भाई", "bhai"],
      ["मतलब", "matlab"],
      ["शुरू", "shuru"],
      ["खत्म", "khatam"],
      ["नमस्ते", "namaste"],
    ];

    for (const [dev, expected] of creatorLexiconCases) {
      const res = normalizeTokenToHinglish(dev);
      expect(res.roman.toLowerCase()).toBe(expected.toLowerCase());
    }
  });
});
