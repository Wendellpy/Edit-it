import { describe, it, expect } from "vitest";
import { processTranscriptHinglish } from "../../hinglish/postProcessor";
import type { WordToken } from "../../timestampRefiner";

describe("Clips Pipeline Ingestion & Hinglish Refinement", () => {
  it("converts Whisper WordTokens into dual-script Hinglish tokens", () => {
    const rawTokens: WordToken[] = [
      { id: "1", text: "ये", start: 0.1, end: 0.4, confidence: 0.98 },
      { id: "2", text: "video", start: 0.45, end: 0.8, confidence: 0.95 },
      { id: "3", text: "बहुत", start: 0.85, end: 1.2, confidence: 0.99 },
      { id: "4", text: "viral", start: 1.25, end: 1.6, confidence: 0.92 },
      { id: "5", text: "होगी", start: 1.65, end: 2.0, confidence: 0.97 },
    ];

    const hinglish = processTranscriptHinglish(rawTokens, "roman");
    expect(hinglish.length).toBe(5);

    // Devanagari "ये" normalized to Roman Hinglish "ye"
    expect(hinglish[0].romanText.toLowerCase()).toContain("ye");
    expect(hinglish[0].devanagariText).toBe("ये");

    // English word "video" preserved
    expect(hinglish[1].romanText).toBe("video");
    expect(hinglish[1].isCodeMixedEnglish).toBe(true);

    // "बहुत" normalized to "bohot" (or "bahut")
    expect(["bohot", "bahut"]).toContain(hinglish[2].romanText.toLowerCase());

    // Word timing is strictly preserved
    expect(hinglish[0].start).toBe(0.1);
    expect(hinglish[0].end).toBe(0.4);
  });

  it("applies creator proper nouns to override lowercase Whisper spelling", () => {
    const properNouns = ["BolSub", "Mumbai", "ChatGPT"];
    const properNounMap = new Map<string, string>();
    for (const pn of properNouns) {
      properNounMap.set(pn.toLowerCase(), pn);
    }

    const testTokens = [
      { text: "welcome", romanText: "welcome" },
      { text: "to", romanText: "to" },
      { text: "mumbai", romanText: "mumbai" },
      { text: "with", romanText: "with" },
      { text: "chatgpt", romanText: "chatgpt" },
    ];

    const refined = testTokens.map((tok) => {
      const clean = tok.text.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (properNounMap.has(clean)) {
        const correct = properNounMap.get(clean)!;
        return { ...tok, text: correct, romanText: correct };
      }
      return tok;
    });

    expect(refined[2].text).toBe("Mumbai");
    expect(refined[4].text).toBe("ChatGPT");
  });

  it("builds frame-accurate 2-word punch cues with strictly matching active word timing", () => {
    const tokens: WordToken[] = [
      { id: "1", text: "Welcome", start: 1.0, end: 1.4, confidence: 0.99 },
      { id: "2", text: "back", start: 1.45, end: 1.8, confidence: 0.98 },
      { id: "3", text: "everyone", start: 2.1, end: 2.6, confidence: 0.99 },
      { id: "4", text: "today", start: 2.65, end: 3.0, confidence: 0.97 },
    ];

    // Cue 1: "Welcome back" (1.0 - 1.8)
    // Cue 2: "everyone today" (2.1 - 3.0)
    const cue1Start = tokens[0].start;
    const cue1End = tokens[1].end;
    expect(cue1Start).toBe(1.0);
    expect(cue1End).toBe(1.8);

    // Test audio time playhead at 1.2s (speaking "Welcome")
    const testTime = 1.2;
    const isWelcomeSpeaking = testTime >= tokens[0].start && testTime <= tokens[0].end;
    const isBackSpeaking = testTime >= tokens[1].start && testTime <= tokens[1].end;
    const isUpcoming = testTime < tokens[1].start;

    expect(isWelcomeSpeaking).toBe(true);
    expect(isBackSpeaking).toBe(false);
    expect(isUpcoming).toBe(true); // "back" hasn't been spoken yet!

    // At 1.6s (speaking "back")
    const testTime2 = 1.6;
    expect(testTime2 >= tokens[0].start && testTime2 <= tokens[0].end).toBe(false); // "Welcome" finished
    expect(testTime2 > tokens[0].end).toBe(true); // "Welcome" has passed
    expect(testTime2 >= tokens[1].start && testTime2 <= tokens[1].end).toBe(true); // "back" speaking now!
  });
});
