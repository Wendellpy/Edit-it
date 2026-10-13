import { describe, it, expect } from "vitest";
import { renderCaptionFrame } from "../captionRenderer";
import { computeSubjectAwareLayout } from "../subjectAwareLayout";
import { CAPTION_PRESETS } from "../../templates/presets";
import type { WordToken } from "@/lib/timestampRefiner";
import type { SubjectMetrics } from "../../segmentation/types";

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
    measureText: (text: string) => ({ width: text.length * 20 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
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

describe("Phase 3: Part B Behind-the-Subject Styles & Subject-Aware Layout Suite", () => {
  const partBIds = [
    "behind_head_giant_word",
    "behind_cover_stack",
    "behind_outline_huge",
    "behind_depth_fade",
    "behind_sandwich_layer",
    "behind_curved_arc",
    "behind_vertical_sidetext",
    "behind_devanagari_calligraphy",
  ];

  const standardMetrics: SubjectMetrics = {
    hasSubject: true,
    confidence: 0.95,
    coveragePercent: 24.0,
    boundingBox: { x: 0.25, y: 0.18, width: 0.5, height: 0.78 },
    headRegion: { centerX: 0.5, centerY: 0.32, radiusX: 0.14, radiusY: 0.14 },
    subjectCount: 1,
    isLeavingFrame: false,
  };

  it("should verify all 8 Part B styles are defined with behindSubjectDepth enabled", () => {
    for (const id of partBIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id);
      expect(tmpl, `Part B template ${id} must exist`).toBeDefined();
      expect(tmpl!.layout.behindSubjectDepth).toBe(true);
    }
  });

  it("should auto-place giant single word behind head and scale it to peek out on both sides", () => {
    const tmpl = CAPTION_PRESETS.find((t) => t.id === "behind_head_giant_word")!;
    const layout = computeSubjectAwareLayout(
      tmpl,
      standardMetrics,
      720,
      1280,
      60,
      120, // narrow estimated width
      60
    );

    expect(layout.layoutMode).toBe("behind_head");
    // Center Y should match head center
    expect(layout.y).toBeCloseTo(0.32 * 1280, 0);
    // Should scale up font size so text peeks out beyond head width
    expect(layout.fontSize).toBeGreaterThan(60);
  });

  it("should place curved arc text with valid radial parameters hugging the subject head", () => {
    const tmpl = CAPTION_PRESETS.find((t) => t.id === "behind_curved_arc")!;
    const layout = computeSubjectAwareLayout(tmpl, standardMetrics, 720, 1280, 50, 200, 50);

    expect(layout.layoutMode).toBe("arc");
    expect(layout.arcParams).toBeDefined();
    expect(layout.arcParams?.radius).toBeGreaterThan(100);
    expect(layout.arcParams?.startAngleRad).toBeLessThan(layout.arcParams!.endAngleRad);
  });

  it("should place vertical side-text in open negative flank next to the subject shoulder", () => {
    const tmpl = CAPTION_PRESETS.find((t) => t.id === "behind_vertical_sidetext")!;
    const layout = computeSubjectAwareLayout(tmpl, standardMetrics, 720, 1280, 50, 100, 200);

    expect(layout.layoutMode).toBe("vertical_flank");
    // Subject is centered from 0.25 to 0.75; text should be placed in either flank
    expect(layout.x < 0.25 * 720 || layout.x > 0.75 * 720).toBe(true);
  });

  it("should detect when text is >50% occluded and auto-adjust position/scale", () => {
    const tmpl = CAPTION_PRESETS.find((t) => t.id === "behind_depth_fade")!;
    // Subject covering large center area directly behind text
    const wideSubjectMetrics: SubjectMetrics = {
      hasSubject: true,
      confidence: 0.98,
      coveragePercent: 45.0,
      boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.7 },
      headRegion: { centerX: 0.5, centerY: 0.45, radiusX: 0.2, radiusY: 0.2 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    const layout = computeSubjectAwareLayout(
      tmpl,
      wideSubjectMetrics,
      720,
      1280,
      50,
      300,
      100
    );

    // Occlusion check should trigger
    expect(layout.isOccludedWarning).toBe(true);
    expect(layout.fontSize).toBeGreaterThanOrEqual(50);
  });

  it("should fall back gracefully to front layer without crashing when no subject is detected", () => {
    const noSubjectMetrics: SubjectMetrics = {
      hasSubject: false,
      confidence: 0,
      coveragePercent: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      headRegion: { centerX: 0.5, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
      subjectCount: 0,
      isLeavingFrame: false,
    };

    for (const id of partBIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id)!;
      const layout = computeSubjectAwareLayout(tmpl, noSubjectMetrics, 720, 1280, 50, 200, 50);

      expect(layout.isFallback).toBe(true);
      expect(layout.y).toBeGreaterThan(0);
    }
  });

  it("should render real Hindi, Marathi, and Hinglish lines across all 8 Part B styles", () => {
    const bilingualTokens: WordToken[] = [
      { id: "1", text: "Viral", start: 0.1, end: 0.5, confidence: 1.0 },
      { id: "2", text: "शानदार", start: 0.5, end: 1.0, confidence: 1.0, script: "devanagari" },
      { id: "3", text: "मथळे", start: 1.0, end: 1.5, confidence: 1.0, script: "devanagari" },
    ];

    for (const id of partBIds) {
      const tmpl = CAPTION_PRESETS.find((t) => t.id === id)!;
      const ctx = createMockContext();

      renderCaptionFrame({
        ctx,
        canvasWidth: 720,
        canvasHeight: 1280,
        currentTime: 0.7,
        tokens: bilingualTokens,
        template: tmpl,
        subjectMetrics: standardMetrics,
      });

      const log = ctx.getLog();
      const textCalls = log.filter((l) => l.startsWith("fillText") || l.startsWith("strokeText"));
      expect(textCalls.length, `Expected text rendering for Part B style ${id}`).toBeGreaterThan(0);
    }
  });

  it("should correctly partition layers in Sandwich mode", () => {
    const tmpl = CAPTION_PRESETS.find((t) => t.id === "behind_sandwich_layer")!;
    expect(tmpl.layout.layerOrder).toBe("sandwich");

    const tokens: WordToken[] = [
      { id: "1", text: "Primary", start: 0.1, end: 0.5, confidence: 1.0 },
      { id: "2", text: "Keyword", start: 0.5, end: 1.0, confidence: 1.0 }, // Active word
      { id: "3", text: "Context", start: 1.0, end: 1.5, confidence: 1.0 },
    ];

    const ctx = createMockContext();
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.7, // Active word is 'Keyword'
      tokens,
      template: tmpl,
      subjectMetrics: standardMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = ctx.getLog();
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    // Should have text drawn BEFORE the cutout (behind layer) and AFTER the cutout (front layer)
    const textBeforeCutout = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    const textAfterCutout = log.slice(cutoutIdx).filter((l) => l.startsWith("fillText"));

    expect(textBeforeCutout.length).toBeGreaterThan(0);
    expect(textAfterCutout.length).toBeGreaterThan(0);
  });
});
