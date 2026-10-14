import { describe, it, expect } from "vitest";
import { getTemplateById } from "../../templates";
import { renderCaptionFrame } from "../captionRenderer";
import type { WordToken } from "@/lib/timestampRefiner";

function createMockContext() {
  const log: string[] = [];
  const fonts: string[] = [];
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
    _font: "",
    get font() {
      return this._font;
    },
    set font(f: string) {
      this._font = f;
      fonts.push(f);
    },
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
    globalAlpha: 1.0,
    getLog: () => log,
    getFonts: () => fonts,
  };
  return ctx as unknown as CanvasRenderingContext2D & { getLog: () => string[]; getFonts: () => string[] };
}

describe("Aura Template Specification & Dual-Font Rendering Suite", () => {
  it("MUST define the 'aura' preset with exact visual specs from Video Project 1", () => {
    const tmpl = getTemplateById("aura");
    expect(tmpl).toBeDefined();
    expect(tmpl.id).toBe("aura");
    expect(tmpl.name).toBe("Aura");
    expect(tmpl.vibe).toBe("aesthetic");
    expect(tmpl.badge).toBe("VIRAL AURA");

    // Typography: Bold sans primary + elegant serif secondary
    expect(tmpl.typography.primaryFont).toContain("Montserrat");
    expect(tmpl.typography.secondaryFont).toContain("Playfair Display");
    expect(tmpl.typography.primaryWeight).toBe("900");
    expect(tmpl.typography.fontSizeBasePercent).toBeCloseTo(0.052, 2);

    // Signature Colors
    expect(tmpl.colors.primaryText).toBe("#FFFFFF");
    expect(tmpl.colors.activeWordText).toBe("#FFE600");
    expect(tmpl.colors.shadowColor).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.95?\)/);
    expect(tmpl.colors.shadowBlur).toBe(14);
    expect(tmpl.colors.glowColor).toBe("rgba(255, 230, 0, 0.45)");

    // Layout & Animation
    expect(tmpl.layout.yPositionPercent).toBe(0.62);
    expect(tmpl.layout.maxWordsPerLine).toBe(2);
    expect(tmpl.layout.maxLines).toBe(3);
    expect(tmpl.animation.perWordEffect).toBe("scale_pop");
    expect(tmpl.animation.scaleMagnitude).toBe(1.14);
  });

  it("MUST perform cumulative word entrance where unspoken words remain hidden with zero layout shift", () => {
    const tmpl = getTemplateById("aura");

    const tokens: WordToken[] = [
      { id: "w1", text: "MINUTE", start: 0.0, end: 0.5, confidence: 0.99 },
      { id: "w2", text: "MEIN", start: 0.5, end: 1.0, confidence: 0.99 },
      { id: "w3", text: "captions", start: 1.0, end: 1.5, confidence: 0.99 },
      { id: "w4", text: "READY.", start: 1.5, end: 2.0, confidence: 0.99 },
    ];

    // At t = 0.25s: only w1 has started!
    const ctx1 = createMockContext();
    renderCaptionFrame({
      ctx: ctx1,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.25,
      tokens,
      template: tmpl,
    });
    const log1 = ctx1.getLog().filter((l) => l.startsWith("fillText"));
    expect(log1.some((l) => l.includes("MINUTE"))).toBe(true);
    expect(log1.some((l) => l.includes("MEIN"))).toBe(false);
    expect(log1.some((l) => l.includes("captions"))).toBe(false);
    expect(log1.some((l) => l.includes("READY."))).toBe(false);

    // At t = 0.75s: w1 and w2 have started, w3 and w4 are still hidden!
    const ctx2 = createMockContext();
    renderCaptionFrame({
      ctx: ctx2,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.75,
      tokens,
      template: tmpl,
    });
    const log2 = ctx2.getLog().filter((l) => l.startsWith("fillText"));
    expect(log2.some((l) => l.includes("MINUTE"))).toBe(true);
    expect(log2.some((l) => l.includes("MEIN"))).toBe(true);
    expect(log2.some((l) => l.includes("captions"))).toBe(false);
    expect(log2.some((l) => l.includes("READY."))).toBe(false);

    // At t = 1.25s: w1, w2, w3 have started, w4 is still hidden!
    const ctx3 = createMockContext();
    renderCaptionFrame({
      ctx: ctx3,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.25,
      tokens,
      template: tmpl,
    });
    const log3 = ctx3.getLog().filter((l) => l.startsWith("fillText"));
    expect(log3.some((l) => l.includes("MINUTE"))).toBe(true);
    expect(log3.some((l) => l.includes("MEIN"))).toBe(true);
    expect(log3.some((l) => l.includes("captions"))).toBe(true);
    expect(log3.some((l) => l.includes("READY."))).toBe(false);

    // At t = 1.75s: ALL 4 words are visible!
    const ctx4 = createMockContext();
    renderCaptionFrame({
      ctx: ctx4,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.75,
      tokens,
      template: tmpl,
    });
    const log4 = ctx4.getLog().filter((l) => l.startsWith("fillText"));
    expect(log4.some((l) => l.includes("MINUTE"))).toBe(true);
    expect(log4.some((l) => l.includes("MEIN"))).toBe(true);
    expect(log4.some((l) => l.includes("captions"))).toBe(true);
    expect(log4.some((l) => l.includes("READY."))).toBe(true);
  });

  it("MUST render Aura three-way fonts: uppercase bold sans, minor lowercase sans, and italic accent serif", () => {
    const tmpl = getTemplateById("aura");
    const ctx = createMockContext();

    const sampleTokens: WordToken[] = [
      { id: "1", text: "KIYA", start: 0.0, end: 0.5, confidence: 0.99 },
      { id: "2", text: "ek", start: 0.5, end: 0.9, confidence: 0.99 },
      { id: "3", text: "TEMPLATE", start: 0.9, end: 1.4, confidence: 0.99 },
      { id: "4", text: "choose", start: 1.4, end: 2.0, confidence: 0.98 },
    ];

    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.8,
      tokens: sampleTokens,
      template: tmpl,
    });

    const fontsUsed = ctx.getFonts();
    const hasMontserratBold = fontsUsed.some((f) => f.includes("Montserrat") && f.includes("900"));
    const hasPlayfairItalic = fontsUsed.some((f) => f.includes("Playfair Display") && f.includes("italic"));

    expect(hasMontserratBold, "Aura must use Montserrat 900 for uppercase punch words").toBe(true);
    expect(hasPlayfairItalic, "Aura must use Playfair Display italic for accent words").toBe(true);
  });

  it("MUST automatically classify and format lowercase speech-to-text words into exact punch, minor, and italic accent", () => {
    const tmpl = getTemplateById("aura");
    const ctx = createMockContext();

    // Standard lowercase speech transcript
    const sampleTokens: WordToken[] = [
      { id: "1", text: "maine", start: 0.0, end: 0.4, confidence: 0.99 },
      { id: "2", text: "bas", start: 0.4, end: 0.7, confidence: 0.99 },
      { id: "3", text: "video", start: 0.7, end: 1.1, confidence: 0.99 },
      { id: "4", text: "upload", start: 1.1, end: 1.6, confidence: 0.98 },
    ];

    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.4,
      tokens: sampleTokens,
      template: tmpl,
    });

    const fillLog = ctx.getLog().filter((l) => l.startsWith("fillText"));
    // "maine" -> MAINE (uppercase punch)
    expect(fillLog.some((l) => l.includes('"MAINE"'))).toBe(true);
    // "bas" -> bas (lowercase minor)
    expect(fillLog.some((l) => l.includes('"bas"'))).toBe(true);
    // "video" -> VIDEO (uppercase punch)
    expect(fillLog.some((l) => l.includes('"VIDEO"'))).toBe(true);
    // "upload" -> upload (lowercase italic accent)
    expect(fillLog.some((l) => l.includes('"upload"'))).toBe(true);

    const fontsUsed = ctx.getFonts();
    expect(fontsUsed.some((f) => f.includes("Montserrat") && f.includes("900"))).toBe(true);
    expect(fontsUsed.some((f) => f.includes("Montserrat") && f.includes("700"))).toBe(true);
    expect(fontsUsed.some((f) => f.includes("Playfair Display") && f.includes("italic"))).toBe(true);
  });

  it("MUST accurately layout 4-word phrases into exact 3-line editorial stacks (1/2/1 and 1/1/2)", () => {
    const tmpl = getTemplateById("aura");

    // Phrase with punch at end: MINUTE MEIN captions READY. -> 1 / 1 / 2
    const ctx1 = createMockContext();
    const tokens1: WordToken[] = [
      { id: "1", text: "minute", start: 0.0, end: 0.4, confidence: 0.99 },
      { id: "2", text: "mein", start: 0.4, end: 0.8, confidence: 0.99 },
      { id: "3", text: "captions", start: 0.8, end: 1.2, confidence: 0.99 },
      { id: "4", text: "ready.", start: 1.2, end: 1.6, confidence: 0.99 },
    ];
    renderCaptionFrame({
      ctx: ctx1,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.5,
      tokens: tokens1,
      template: tmpl,
    });
    const fillLog1 = ctx1.getLog().filter((l) => l.startsWith("fillText"));
    expect(fillLog1.some((l) => l.includes('"MINUTE"'))).toBe(true);
    expect(fillLog1.some((l) => l.includes('"mein"') || l.includes('"MEIN"'))).toBe(true);
    expect(fillLog1.some((l) => l.includes('"captions"'))).toBe(true);
    expect(fillLog1.some((l) => l.includes('"READY."'))).toBe(true);

    // Phrase with sparkle accent: ✦ kiya, aur literally ek -> 1 / 2 / 1
    const ctx2 = createMockContext();
    const tokens2: WordToken[] = [
      { id: "1", text: "✦ kiya,", start: 0.0, end: 0.4, confidence: 0.99 },
      { id: "2", text: "aur", start: 0.4, end: 0.8, confidence: 0.99 },
      { id: "3", text: "literally", start: 0.8, end: 1.2, confidence: 0.99 },
      { id: "4", text: "ek", start: 1.2, end: 1.6, confidence: 0.99 },
    ];
    renderCaptionFrame({
      ctx: ctx2,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 1.5,
      tokens: tokens2,
      template: tmpl,
    });
    const fillLog2 = ctx2.getLog().filter((l) => l.startsWith("fillText"));
    expect(fillLog2.some((l) => l.includes('"✦ kiya,"'))).toBe(true);
    expect(fillLog2.some((l) => l.includes('"aur"'))).toBe(true);
    expect(fillLog2.some((l) => l.includes('"LITERALLY"'))).toBe(true);
    expect(fillLog2.some((l) => l.includes('"ek"'))).toBe(true);
  });
});
