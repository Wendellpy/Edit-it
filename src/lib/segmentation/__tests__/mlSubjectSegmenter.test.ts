import { describe, it, expect, beforeEach } from "vitest";
import { mlSubjectSegmenter } from "../mlSubjectSegmenter";
import { KinematicSubjectTracker } from "../subjectTrackingModel";
import { renderCaptionFrame } from "@/lib/renderer/captionRenderer";
import { CAPTION_PRESETS } from "@/lib/templates/presets";
import type { WordToken } from "@/lib/timestampRefiner";

function createMockCanvasContext() {
  const commandLog: string[] = [];

  const ctx = {
    save: () => commandLog.push("save"),
    restore: () => commandLog.push("restore"),
    beginPath: () => commandLog.push("beginPath"),
    closePath: () => commandLog.push("closePath"),
    moveTo: (x: number, y: number) => commandLog.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => commandLog.push(`lineTo(${x},${y})`),
    quadraticCurveTo: () => commandLog.push("quadraticCurveTo"),
    translate: (x: number, y: number) => commandLog.push(`translate(${Math.round(x)},${Math.round(y)})`),
    rotate: (rad: number) => commandLog.push(`rotate(${rad.toFixed(2)})`),
    scale: (x: number, y: number) => commandLog.push(`scale(${x.toFixed(2)},${y.toFixed(2)})`),
    fill: () => commandLog.push("fill"),
    fillText: (text: string, x: number, y: number) =>
      commandLog.push(`fillText("${text}",${Math.round(x)},${Math.round(y)})`),
    strokeText: (text: string, x: number, y: number) =>
      commandLog.push(`strokeText("${text}",${Math.round(x)},${Math.round(y)})`),
    measureText: (text: string) => ({ width: text.length * 18 }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    getLog: () => commandLog,
  };

  return ctx as unknown as CanvasRenderingContext2D & { getLog: () => string[] };
}

describe("ML Subject Segmenter & Sandwich Tracking Suite", () => {
  beforeEach(() => {
    mlSubjectSegmenter.reset();
  });

  it("should have a valid singleton instance of MlSubjectSegmenter", () => {
    expect(mlSubjectSegmenter).toBeDefined();
    expect(typeof mlSubjectSegmenter.reset).toBe("function");
    expect(typeof mlSubjectSegmenter.segmentFrame).toBe("function");
  });

  it("KinematicSubjectTracker: tracks subject smoothly with momentum and rejects sudden jitter", () => {
    const tracker = new KinematicSubjectTracker();

    // Frame 1: Initial detection of subject in upper-center (head at 0.5, 0.35)
    const f1 = tracker.update(
      { centerX: 0.50, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
      { x: 0.20, y: 0.15, width: 0.60, height: 0.80 },
      0.95,
      0.0
    );
    expect(f1.hasSubject).toBe(true);
    expect(f1.confidence).toBeGreaterThan(0.7);

    // Frame 2: Slight creator movement (smooth trajectory)
    const f2 = tracker.update(
      { centerX: 0.52, centerY: 0.36, radiusX: 0.15, radiusY: 0.15 },
      { x: 0.21, y: 0.16, width: 0.60, height: 0.80 },
      0.96,
      0.05
    );
    expect(f2.head.centerX).toBeGreaterThan(0.50);
    expect(f2.head.centerX).toBeLessThan(0.53);

    // Frame 3: Temporary occlusion/missed detection - tracker should coast smoothly with momentum
    const f3 = tracker.update(null, null, 0.0, 0.10);
    expect(f3.hasSubject).toBe(true); // Should not immediately drop the subject
    expect(f3.head.centerX).toBeCloseTo(0.52, 1);
  });

  it("Sandwich Tracking: Line 0 stays strictly behind subject even when active word is on Line 0", () => {
    const ctx = createMockCanvasContext();
    const sandwichTemplate = CAPTION_PRESETS.find((t) => t.id === "behind_sandwich_layer")!;
    expect(sandwichTemplate).toBeDefined();

    const tokens: WordToken[] = [
      { id: "1", text: "VIRAL", start: 0.0, end: 0.5, confidence: 1.0 }, // active on Line 0!
      { id: "2", text: "REEL", start: 0.5, end: 1.0, confidence: 1.0 },
      { id: "3", text: "GROWTH", start: 1.0, end: 1.5, confidence: 1.0 },
      { id: "4", text: "HACK", start: 1.5, end: 2.0, confidence: 1.0 },
    ];

    const subjectMetrics = {
      hasSubject: true,
      confidence: 0.98,
      coveragePercent: 26.0,
      boundingBox: { x: 0.22, y: 0.18, width: 0.56, height: 0.78 },
      headRegion: { centerX: 0.50, centerY: 0.34, radiusX: 0.15, radiusY: 0.16 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    renderCaptionFrame({
      ctx,
      canvasWidth: 1080,
      canvasHeight: 1920,
      currentTime: 0.25, // 'VIRAL' on line 0 is active
      tokens,
      template: sandwichTemplate,
      layerOrder: "sandwich",
      subjectMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = ctx.getLog();
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    // Pass 1: Text drawn before cutout (behind subject)
    const textBeforeCutout = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    // Pass 3: Text drawn after cutout (in front of subject)
    const textAfterCutout = log.slice(cutoutIdx).filter((l) => l.startsWith("fillText"));

    // Line 0 words (VIRAL, REEL) must be in the behind layer
    const hasViralBefore = textBeforeCutout.some((l) => l.includes('"VIRAL"'));
    expect(hasViralBefore).toBe(true);

    // Line 0 words must NOT be drawn in front of the subject cutout
    const hasViralAfter = textAfterCutout.some((l) => l.includes('"VIRAL"'));
    expect(hasViralAfter).toBe(false);

    // Line 1 words (GROWTH, HACK) must be in the front layer
    const hasGrowthAfter = textAfterCutout.some((l) => l.includes('"GROWTH"'));
    expect(hasGrowthAfter).toBe(true);
  });

  it("Behind-The-Subject Mode: All caption text is rendered behind the subject cutout", () => {
    const ctx = createMockCanvasContext();
    const behindTemplate = CAPTION_PRESETS.find((t) => t.id === "behind_head_giant_word")!;
    expect(behindTemplate).toBeDefined();

    const tokens: WordToken[] = [
      { id: "1", text: "INSANE", start: 0.0, end: 1.0, confidence: 1.0 },
    ];

    const subjectMetrics = {
      hasSubject: true,
      confidence: 0.95,
      coveragePercent: 28.0,
      boundingBox: { x: 0.25, y: 0.20, width: 0.50, height: 0.75 },
      headRegion: { centerX: 0.50, centerY: 0.35, radiusX: 0.16, radiusY: 0.16 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.5,
      tokens,
      template: behindTemplate,
      layerOrder: "behind",
      subjectMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = ctx.getLog();
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    const textBeforeCutout = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    const textAfterCutout = log.slice(cutoutIdx).filter((l) => l.startsWith("fillText"));

    // Text must be in Pass 1 (behind subject)
    expect(textBeforeCutout.some((l) => l.includes('"INSANE"'))).toBe(true);
    // In behind mode, zero caption text should be drawn on top of the subject cutout
    expect(textAfterCutout.length).toBe(0);
  });

  it("Screen Boundary Invariant: Behind & Sandwich text strictly remains within video dimensions", () => {
    const ctx = createMockCanvasContext();
    const sandwichTemplate = CAPTION_PRESETS.find((t) => t.id === "behind_sandwich_layer")!;
    const w = 720;
    const h = 1280;

    // Very long words that could potentially overflow if not auto-fit and clamped
    const tokens: WordToken[] = [
      { id: "1", text: "EXTRAORDINARILY", start: 0.0, end: 0.5, confidence: 1.0 },
      { id: "2", text: "UNBELIEVABLE", start: 0.5, end: 1.0, confidence: 1.0 },
      { id: "3", text: "SUPERINTELLECT", start: 1.0, end: 1.5, confidence: 1.0 },
      { id: "4", text: "BREAKTHROUGH", start: 1.5, end: 2.0, confidence: 1.0 },
    ];

    // Wide creator subject positioned off-center
    const subjectMetrics = {
      hasSubject: true,
      confidence: 0.98,
      coveragePercent: 42.0,
      boundingBox: { x: 0.15, y: 0.20, width: 0.70, height: 0.75 },
      headRegion: { centerX: 0.58, centerY: 0.36, radiusX: 0.20, radiusY: 0.18 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    renderCaptionFrame({
      ctx,
      canvasWidth: w,
      canvasHeight: h,
      currentTime: 0.8,
      tokens,
      template: sandwichTemplate,
      layerOrder: "sandwich",
      subjectMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = ctx.getLog();
    const fillTexts = log.filter((l) => l.startsWith("fillText"));
    expect(fillTexts.length).toBeGreaterThan(0);

    for (const cmd of fillTexts) {
      // Parse coordinates from fillText("...", x, y)
      const match = cmd.match(/fillText\("([^"]+)",(-?\d+),(-?\d+)\)/);
      if (match) {
        const text = match[1];
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);

        // x must be non-negative and within screen width
        expect(x, `Text "${text}" X position ${x} is off left edge`).toBeGreaterThanOrEqual(0);
        expect(x, `Text "${text}" X position ${x} is off right edge`).toBeLessThan(w);

        // y must be within screen height
        expect(y, `Text "${text}" Y position ${y} is off top edge`).toBeGreaterThanOrEqual(0);
        expect(y, `Text "${text}" Y position ${y} is off bottom edge`).toBeLessThan(h);
      }
    }
  });
});
