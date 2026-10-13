import { describe, it, expect } from "vitest";
import { renderCaptionFrame } from "../captionRenderer";
import { CAPTION_PRESETS } from "../../templates/presets";
import type { WordToken } from "@/lib/timestampRefiner";

function createMockContext() {
  const log: string[] = [];
  const ctx = {
    save: () => log.push("save"),
    restore: () => log.push("restore"),
    beginPath: () => log.push("beginPath"),
    closePath: () => log.push("closePath"),
    moveTo: (x: number, y: number) => log.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => log.push(`lineTo(${x},${y})`),
    quadraticCurveTo: () => log.push("quadraticCurveTo"),
    translate: (x: number, y: number) => log.push(`translate(${Math.round(x)},${Math.round(y)})`),
    rotate: (r: number) => log.push(`rotate(${r.toFixed(2)})`),
    scale: (x: number, y: number) => log.push(`scale(${x.toFixed(2)},${y.toFixed(2)})`),
    fill: () => log.push("fill"),
    stroke: () => log.push("stroke"),
    fillText: (text: string, x: number, y: number) =>
      log.push(`fillText("${text}",${Math.round(x)},${Math.round(y)})`),
    strokeText: (text: string, x: number, y: number) =>
      log.push(`strokeText("${text}",${Math.round(x)},${Math.round(y)})`),
    measureText: (text: string) => ({ width: text.length * 16 }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    globalAlpha: 1.0,
    getLog: () => log,
  };
  return ctx as unknown as CanvasRenderingContext2D & { getLog: () => string[] };
}

describe("Part A: 10 New Text Styles Verification Suite", () => {
  const newPartAIds = [
    "die_cut_sticker",
    "hollow_outline_fill",
    "chrome_metallic_3d",
    "neon_tube_flicker",
    "editorial_serif_luxury",
    "devanagari_calligraphy_bold",
    "brush_graffiti_paint",
    "hand_script_marker",
    "retro_80s_synth",
    "glitch_rgb_split",
  ];

  it("should verify that each of the 10 new styles exists and has valid typographic metadata", () => {
    for (const id of newPartAIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id);
      expect(tmpl, `Style ${id} must exist in CAPTION_PRESETS`).toBeDefined();
      expect(tmpl!.typography.primaryFont.length).toBeGreaterThan(0);
      expect(tmpl!.colors.primaryText.length).toBeGreaterThan(0);
      expect(tmpl!.colors.activeWordText.length).toBeGreaterThan(0);
    }
  });

  it("should render Hindi text with complex conjuncts without error across all 10 styles", () => {
    const hindiTokens: WordToken[] = [
      { id: "h1", text: "नमस्ते", start: 0.1, end: 0.5, confidence: 0.99, script: "devanagari" },
      { id: "h2", text: "शानदार", start: 0.5, end: 1.0, confidence: 0.99, script: "devanagari" },
      { id: "h3", text: "कैप्शन्स", start: 1.0, end: 1.5, confidence: 0.98, script: "devanagari" },
    ];

    for (const id of newPartAIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id)!;
      const ctx = createMockContext();

      renderCaptionFrame({
        ctx,
        canvasWidth: 720,
        canvasHeight: 1280,
        currentTime: 0.7, // Active word is 'शानदार'
        tokens: hindiTokens,
        template: tmpl,
      });

      const log = ctx.getLog();
      const fillCalls = log.filter((l) => l.startsWith("fillText"));
      expect(fillCalls.length, `Expected text rendering for style ${id}`).toBeGreaterThan(0);
    }
  });

  it("should render Marathi text with regional conjuncts without error across all 10 styles", () => {
    const marathiTokens: WordToken[] = [
      { id: "m1", text: "मराठी", start: 0.1, end: 0.5, confidence: 0.99, script: "devanagari" },
      { id: "m2", text: "भाषेतील", start: 0.5, end: 1.0, confidence: 0.99, script: "devanagari" },
      { id: "m3", text: "मथळे", start: 1.0, end: 1.5, confidence: 0.98, script: "devanagari" },
    ];

    for (const id of newPartAIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id)!;
      const ctx = createMockContext();

      renderCaptionFrame({
        ctx,
        canvasWidth: 720,
        canvasHeight: 1280,
        currentTime: 0.7,
        tokens: marathiTokens,
        template: tmpl,
      });

      const log = ctx.getLog();
      const fillCalls = log.filter((l) => l.startsWith("fillText"));
      expect(fillCalls.length, `Expected Marathi rendering for style ${id}`).toBeGreaterThan(0);
    }
  });

  it("should render Hinglish colloquial phrasing accurately across all 10 styles", () => {
    const hinglishTokens: WordToken[] = [
      { id: "hg1", text: "Viral", start: 0.1, end: 0.5, confidence: 0.99 },
      { id: "hg2", text: "Hinglish", start: 0.5, end: 1.0, confidence: 0.99 },
      { id: "hg3", text: "Video", start: 1.0, end: 1.5, confidence: 0.98 },
    ];

    for (const id of newPartAIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id)!;
      const ctx = createMockContext();

      renderCaptionFrame({
        ctx,
        canvasWidth: 720,
        canvasHeight: 1280,
        currentTime: 0.7,
        tokens: hinglishTokens,
        template: tmpl,
      });

      const log = ctx.getLog();
      const fillCalls = log.filter((l) => l.startsWith("fillText"));
      expect(fillCalls.length, `Expected Hinglish rendering for style ${id}`).toBeGreaterThan(0);
    }
  });

  it("should execute specific advanced visual passes for each Part A style", () => {
    const testTokens: WordToken[] = [
      { id: "1", text: "Bold", start: 0.1, end: 0.5, confidence: 1.0 },
      { id: "2", text: "Creator", start: 0.5, end: 1.0, confidence: 1.0 },
    ];

    // 1. Die-cut sticker should generate multi-stroke passes
    const stickerCtx = createMockContext();
    const stickerTmpl = CAPTION_PRESETS.find((t) => t.id === "die_cut_sticker")!;
    renderCaptionFrame({
      ctx: stickerCtx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.8,
      tokens: testTokens,
      template: stickerTmpl,
    });
    const stickerStrokeCalls = stickerCtx.getLog().filter((l) => l.startsWith("strokeText"));
    expect(stickerStrokeCalls.length).toBeGreaterThanOrEqual(2);

    // 2. Glitch RGB-split should draw chromatic split offset passes
    const glitchCtx = createMockContext();
    const glitchTmpl = CAPTION_PRESETS.find((t) => t.id === "glitch_rgb_split")!;
    renderCaptionFrame({
      ctx: glitchCtx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.8,
      tokens: testTokens,
      template: glitchTmpl,
    });
    const glitchFills = glitchCtx.getLog().filter((l) => l.startsWith("fillText"));
    // Expect 2 base words + 2 chromatic split passes for active word
    expect(glitchFills.length).toBeGreaterThanOrEqual(4);

    // 3. Hand-script marker should draw underline
    const markerCtx = createMockContext();
    const markerTmpl = CAPTION_PRESETS.find((t) => t.id === "hand_script_marker")!;
    renderCaptionFrame({
      ctx: markerCtx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.8,
      tokens: testTokens,
      template: markerTmpl,
    });
    const markerStrokes = markerCtx.getLog().filter((l) => l === "stroke");
    expect(markerStrokes.length).toBeGreaterThan(0);
  });
});
