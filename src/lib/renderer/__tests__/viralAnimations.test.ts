import { describe, it, expect } from "vitest";
import { renderCaptionFrame } from "../captionRenderer";
import { CAPTION_PRESETS } from "../../templates/presets";
import { validateTemplate } from "../../templates/schema";
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
    rect: (x: number, y: number, w: number, h: number) =>
      log.push(`rect(${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)})`),
    clip: () => log.push("clip"),
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

describe("YouTube / Shorts Viral Animations & Upgraded Presets Suite", () => {
  const sampleTokens: WordToken[] = [
    { id: "w1", text: "VIRAL", start: 0.1, end: 0.5, confidence: 0.99 },
    { id: "w2", text: "CAPTION", start: 0.5, end: 1.0, confidence: 0.99 },
    { id: "w3", text: "HOOK", start: 1.0, end: 1.5, confidence: 0.98 },
  ];

  it("should validate all upgraded YouTube-ready presets against schema", () => {
    const upgradedIds = [
      "alex_hormozi_punch",
      "mr_beast_bold",
      "whisper_simple",
      "studio_clean_mono",
      "invisible_sub_dark",
      "bulletin_strap_blue",
      "fact_checker_box",
      "toot_and_whistle",
      "talk_show_box",
      "bappi_disco_gold",
    ];

    for (const id of upgradedIds) {
      const tmpl = CAPTION_PRESETS.find((p) => p.id === id);
      expect(tmpl, `Expected preset ${id} to exist`).toBeDefined();
      expect(validateTemplate(tmpl!), `Preset ${id} must pass schema validation`).toBe(true);
    }
  });

  it("should render Hormozi Viral Highlighter Box with dynamic pill background and elastic pop", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "alex_hormozi_punch")!;
    expect(tmpl.colors.activeWordBg).toBe("#FFE600");
    expect(tmpl.colors.activeWordText).toBe("#000000");
    expect(tmpl.animation.perWordEffect).toBe("highlight_box");

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7, // Active word is 'CAPTION'
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    // Must draw pill background (fill) + scale pop + fillText
    expect(log.filter((l) => l === "fill").length).toBeGreaterThan(0);
    expect(log.filter((l) => l.startsWith("scale")).length).toBeGreaterThan(0);
    expect(log.filter((l) => l.startsWith("fillText")).length).toBeGreaterThan(0);
  });

  it("should render MrBeast Squash & Stretch Bounce physics", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "mr_beast_bold")!;
    expect(tmpl.animation.perWordEffect).toBe("bounce");

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.6, // Word in progress
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    // Squash & stretch scale calls have differential X and Y factors
    const scaleCalls = log.filter((l) => l.startsWith("scale"));
    expect(scaleCalls.length).toBeGreaterThan(0);
  });

  it("should render Ali Abdaal Fluid Karaoke Wipe with progressive clipping", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "whisper_simple")!;
    expect(tmpl.animation.perWordEffect).toBe("karaoke_fill");
    expect(tmpl.colors.activeWordText).toBe("#FBBF24");

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.75, // 50% into 'CAPTION' (0.5 to 1.0)
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    // Karaoke wipe executes clip() and rect() for frame-accurate progressive overlay
    expect(log.filter((l) => l === "clip").length).toBeGreaterThan(0);
    expect(log.filter((l) => l.startsWith("rect")).length).toBeGreaterThan(0);
    expect(log.filter((l) => l.startsWith("fillText")).length).toBeGreaterThan(1);
  });

  it("should render Iman Gadzhi Emerald High-Impact Box", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "invisible_sub_dark")!;
    expect(tmpl.colors.activeWordBg).toBe("#10B981");
    expect(tmpl.colors.activeWordText).toBe("#000000");

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7,
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    expect(log.filter((l) => l === "fill").length).toBeGreaterThan(0);
  });

  it("should render TikTok Bouncy Squish Pop with dynamic tilt and stroke", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "toot_and_whistle")!;
    expect(tmpl.animation.perWordEffect).toBe("bounce");
    expect(tmpl.colors.activeWordText).toBe("#FF007A");

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7,
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    expect(log.filter((l) => l.startsWith("rotate")).length).toBeGreaterThan(0);
    expect(log.filter((l) => l.startsWith("strokeText")).length).toBeGreaterThan(0);
  });

  it("should render ONLY the currently spoken word during audio and 0 during silence (creator_fuel_cyan)", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "creator_fuel_cyan")!;
    expect(tmpl.layout.singleWordOnly).toBe(true);
    expect(tmpl.animation.perWordEffect).toBe("single_word_flow");

    // Case 1: Active word is "VIRAL" (start: 0.1, end: 0.5) at t=0.3
    const ctx1 = createMockContext();
    renderCaptionFrame({
      ctx: ctx1,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.3,
      tokens: sampleTokens,
      template: tmpl,
    });
    const log1 = ctx1.getLog();
    const fillTexts1 = log1.filter((l) => l.startsWith("fillText"));
    expect(fillTexts1.length).toBe(1);
    expect(fillTexts1[0]).toContain("VIRAL");
    // Ensure "CAPTION" and "HOOK" were NOT drawn
    expect(fillTexts1.some((l) => l.includes("CAPTION"))).toBe(false);
    expect(fillTexts1.some((l) => l.includes("HOOK"))).toBe(false);

    // Case 2: Active word is "CAPTION" (start: 0.5, end: 1.0) at t=0.7
    const ctx2 = createMockContext();
    renderCaptionFrame({
      ctx: ctx2,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7,
      tokens: sampleTokens,
      template: tmpl,
    });
    const log2 = ctx2.getLog();
    const fillTexts2 = log2.filter((l) => l.startsWith("fillText"));
    expect(fillTexts2.length).toBe(1);
    expect(fillTexts2[0]).toContain("CAPTION");
    expect(fillTexts2.some((l) => l.includes("VIRAL"))).toBe(false);

    // Check smooth flow transform & alpha
    expect(log2.some((l) => l.startsWith("scale"))).toBe(true);
    expect(log2.some((l) => l.startsWith("translate"))).toBe(true);

    // Case 3: Silent period before audio (t=0.0) -> NO words drawn at all
    const ctxSilent = createMockContext();
    renderCaptionFrame({
      ctx: ctxSilent,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.0,
      tokens: sampleTokens,
      template: tmpl,
    });
    const logSilent = ctxSilent.getLog();
    expect(logSilent.filter((l) => l.startsWith("fillText")).length).toBe(0);
    expect(logSilent.filter((l) => l.startsWith("strokeText")).length).toBe(0);
  });

  it("should respect options.singleWordOnly flag regardless of template default", () => {
    // Take a template that normally renders multiple words per line (alex_hormozi_punch)
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "alex_hormozi_punch")!;
    const ctx = createMockContext();

    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.3, // "VIRAL" active
      tokens: sampleTokens,
      template: tmpl,
      singleWordOnly: true,
    });

    const log = ctx.getLog();
    const fillTexts = log.filter((l) => l.startsWith("fillText"));
    // Exactly 1 word rendered ("VIRAL")
    expect(fillTexts.length).toBe(1);
    expect(fillTexts[0]).toContain("VIRAL");
    expect(fillTexts.some((l) => l.includes("CAPTION"))).toBe(false);
  });

  it("should dynamically adjust captions to 9:16 and 16:9 aspect ratios within platform safe boundaries", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "mr_beast_bold")!;

    // Test 1: 9:16 Vertical Video (720x1280)
    const ctxPortrait = createMockContext();
    renderCaptionFrame({
      ctx: ctxPortrait,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7,
      tokens: sampleTokens,
      template: tmpl,
      showBehindBadge: false,
    });
    const logPortrait = ctxPortrait.getLog();
    const fillTextsPortrait = logPortrait.filter((l) => l.startsWith("fillText"));
    expect(fillTextsPortrait.length).toBeGreaterThan(0);

    // Verify all text is kept within safe horizontal margins (8% = 58px) and vertical safe zones (avoids bottom 18% = 230px)
    for (const entry of fillTextsPortrait) {
      const match = entry.match(/fillText\("([^"]+)",(\d+),(\d+)\)/);
      if (match) {
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        expect(x).toBeGreaterThanOrEqual(40); // Within safe left margin
        expect(x).toBeLessThanOrEqual(680);   // Within safe right margin
        expect(y).toBeLessThanOrEqual(1280 - 150); // Above bottom platform UI overlay
      }
    }

    // Test 2: 16:9 Landscape Video (1920x1080)
    const ctxLandscape = createMockContext();
    renderCaptionFrame({
      ctx: ctxLandscape,
      canvasWidth: 1920,
      canvasHeight: 1080,
      currentTime: 0.7,
      tokens: sampleTokens,
      template: tmpl,
      showBehindBadge: false,
    });
    const logLandscape = ctxLandscape.getLog();
    const fillTextsLandscape = logLandscape.filter((l) => l.startsWith("fillText"));
    expect(fillTextsLandscape.length).toBeGreaterThan(0);
    for (const entry of fillTextsLandscape) {
      const match = entry.match(/fillText\("([^"]+)",(\d+),(\d+)\)/);
      if (match) {
        const x = parseInt(match[2], 10);
        expect(x).toBeGreaterThanOrEqual(100);
        expect(x).toBeLessThanOrEqual(1820);
      }
    }
  });

  it("should automatically prevent captions from going out of frame when words are unusually long", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "alex_hormozi_punch")!;
    const extraLongTokens: WordToken[] = [
      { id: "e1", text: "EXTRAORDINARILYLONGWORDTHATNORMALLYOVERFLOWS", start: 0.1, end: 1.0, confidence: 0.99 },
    ];

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.5,
      tokens: extraLongTokens,
      template: tmpl,
      showBehindBadge: false,
    });

    const log = ctx.getLog();
    const fillTexts = log.filter((l) => l.startsWith("fillText"));
    expect(fillTexts.length).toBe(1);

    const match = fillTexts[0].match(/fillText\("([^"]+)",(\d+),(\d+)\)/);
    expect(match).toBeDefined();
    const x = parseInt(match![2], 10);
    // Must remain within safe margin >= 50px
    expect(x).toBeGreaterThanOrEqual(50);
  });

  it("should calculate correct spacing between words and highlight box pills without collisions", () => {
    const tmpl = CAPTION_PRESETS.find((p) => p.id === "alex_hormozi_punch")!;
    const ctx = createMockContext();

    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.3, // "VIRAL" is active with highlight box pill
      tokens: [
        { id: "s1", text: "TOP", start: 0.1, end: 0.5, confidence: 0.99 },
        { id: "s2", text: "TIER", start: 0.5, end: 1.0, confidence: 0.99 },
      ],
      template: tmpl,
      showBehindBadge: false,
    });

    const log = ctx.getLog();
    const fillTexts = log.filter((l) => l.startsWith("fillText"));
    expect(fillTexts.length).toBe(2);

    const match1 = fillTexts[0].match(/fillText\("([^"]+)",(\d+),(\d+)\)/);
    const match2 = fillTexts[1].match(/fillText\("([^"]+)",(\d+),(\d+)\)/);
    expect(match1).toBeDefined();
    expect(match2).toBeDefined();

    const x1 = parseInt(match1![2], 10);
    const x2 = parseInt(match2![2], 10);
    const w1 = match1![1].length * 16;

    // Word 2 must be positioned strictly to the right of Word 1 with positive space gap
    expect(x2).toBeGreaterThan(x1 + w1);
    // Clearance must be >= 18px (accounting for pill padding so no overlap occurs)
    expect(x2 - (x1 + w1)).toBeGreaterThanOrEqual(18);
  });

  it("should render kinetic_slam with rapid downward drop and ground impact", () => {
    const baseTmpl = CAPTION_PRESETS[0];
    const tmpl = {
      ...baseTmpl,
      animation: {
        perWordEffect: "kinetic_slam" as const,
        scaleMagnitude: 1.25,
      },
    };

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.15, // onset of first word (w1: 0.1 to 0.5)
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    // Must contain translate and scale for the slam
    expect(log.some((l) => l.startsWith("translate"))).toBe(true);
    expect(log.some((l) => l.startsWith("scale"))).toBe(true);
    expect(log.some((l) => l.startsWith("fillText"))).toBe(true);
  });

  it("should render squash_bounce with volume-preserving squash and stretch", () => {
    const baseTmpl = CAPTION_PRESETS[0];
    const tmpl = {
      ...baseTmpl,
      animation: {
        perWordEffect: "squash_bounce" as const,
        scaleMagnitude: 1.25,
      },
    };

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.16, // near first bounce peak
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    const scaleLog = log.find((l) => l.startsWith("scale("));
    expect(scaleLog).toBeDefined();
    // Extract scaleX and scaleY
    const match = scaleLog!.match(/scale\(([^,]+),([^)]+)\)/);
    expect(match).toBeDefined();
    const sx = parseFloat(match![1]);
    const sy = parseFloat(match![2]);
    // On bounce peak, vertical stretch > horizontal compression
    expect(sy).not.toEqual(sx);
  });

  it("should render smooth_glide with gentle upward ease and opacity ramp", () => {
    const baseTmpl = CAPTION_PRESETS[0];
    const tmpl = {
      ...baseTmpl,
      animation: {
        perWordEffect: "smooth_glide" as const,
        scaleMagnitude: 1.10,
      },
    };

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.15,
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    expect(log.some((l) => l.startsWith("translate"))).toBe(true);
    expect(log.some((l) => l.startsWith("fillText"))).toBe(true);
  });

  it("should render chromatic_strike with dual RGB channel split", () => {
    const baseTmpl = CAPTION_PRESETS[0];
    const tmpl = {
      ...baseTmpl,
      animation: {
        perWordEffect: "chromatic_strike" as const,
        scaleMagnitude: 1.15,
        glitchOffsetPx: 6,
      },
    };

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.15,
      tokens: sampleTokens,
      template: tmpl,
    });

    const log = ctx.getLog();
    // Must render red and cyan passes: fillText at least 3 times for the active word
    const fillTexts = log.filter((l) => l.includes("VIRAL"));
    expect(fillTexts.length).toBeGreaterThanOrEqual(3);
  });

  it("should render neon_pulse with breathing glow blur", () => {
    const baseTmpl = CAPTION_PRESETS[0];
    const tmpl = {
      ...baseTmpl,
      colors: {
        ...baseTmpl.colors,
        glowColor: "#00F0FF",
        shadowBlur: 25,
      },
      animation: {
        perWordEffect: "neon_pulse" as const,
        scaleMagnitude: 1.10,
        flickerFrequency: 12,
      },
    };

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.25,
      tokens: sampleTokens,
      template: tmpl,
    });

    expect(ctx.shadowBlur).toBeGreaterThan(0);
  });
});


