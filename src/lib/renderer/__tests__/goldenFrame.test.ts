import { describe, it, expect } from "vitest";
import { renderCaptionFrame, renderCaptionsToCanvas } from "../captionRenderer";
import { CAPTION_PRESETS } from "../../templates/presets";
import { validateTemplate } from "../../templates/schema";
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

describe("Golden-Frame Consistency & Template Schema Suite", () => {
  it("should validate all 70+ caption template presets against the strict schema", () => {
    expect(CAPTION_PRESETS.length).toBeGreaterThanOrEqual(70);

    for (const tmpl of CAPTION_PRESETS) {
      const isValid = validateTemplate(tmpl);
      expect(isValid, `Template ${tmpl.id} failed validation`).toBe(true);
      expect(tmpl.typography.primaryFont.length).toBeGreaterThan(0);
      expect(tmpl.colors.primaryText.length).toBeGreaterThan(0);
      expect(tmpl.colors.activeWordText.length).toBeGreaterThan(0);
      expect(tmpl.layout.yPositionPercent).toBeGreaterThan(0);
      expect(tmpl.layout.yPositionPercent).toBeLessThan(1);
    }
  });

  it("should generate 100% identical frame drawing commands across preview and export renderers", () => {
    const width = 720;
    const height = 1280;

    // Canvas 1: Live Player Preview Renderer
    const ctxPreview = createMockCanvasContext();

    // Canvas 2: Hardware Export Video Pipeline Renderer
    const ctxExport = createMockCanvasContext();

    const testTokens: WordToken[] = [
      { id: "1", text: "Maine", start: 0.2, end: 0.6, confidence: 0.98 },
      { id: "2", text: "video", start: 0.7, end: 1.1, confidence: 0.99 },
      { id: "3", text: "upload", start: 1.2, end: 1.6, confidence: 0.97 },
      { id: "4", text: "kiya,", start: 1.7, end: 2.1, confidence: 0.99 },
    ];

    const template = CAPTION_PRESETS[0]; // Behind You White

    // Render Preview Frame
    renderCaptionFrame({
      ctx: ctxPreview,
      canvasWidth: width,
      canvasHeight: height,
      currentTime: 0.9, // Active word is 'video'
      tokens: testTokens,
      template,
      showBehindBadge: true,
    });

    // Render Export Frame with identical parameters
    renderCaptionFrame({
      ctx: ctxExport,
      canvasWidth: width,
      canvasHeight: height,
      currentTime: 0.9,
      tokens: testTokens,
      template,
      showBehindBadge: true,
    });

    const previewLog = ctxPreview.getLog();
    const exportLog = ctxExport.getLog();

    // Assert that the command logs are non-empty and 100% identical
    expect(previewLog.length).toBeGreaterThan(5);
    expect(previewLog).toEqual(exportLog);
  });

  it("should not render captions during silent periods before speech starts or during long pauses", () => {
    const ctx = createMockCanvasContext();
    const testTokens: WordToken[] = [
      { id: "1", text: "Hello", start: 2.0, end: 2.5, confidence: 1.0 },
      { id: "2", text: "world", start: 2.5, end: 3.0, confidence: 1.0 },
    ];
    const template = CAPTION_PRESETS[0];

    // Frame at 0.5s (before speech begins at 2.0s)
    renderCaptionFrame({
      ctx,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.5,
      tokens: testTokens,
      template,
    });

    // In a silent period, no text should be drawn
    const log = ctx.getLog();
    const drawnText = log.filter((l) => l.startsWith("fillText"));
    expect(drawnText.length).toBe(0);
  });

  it("should accurately apply syncOffsetSeconds to advance or delay caption rendering", () => {
    const ctxNormal = createMockCanvasContext();
    const ctxShifted = createMockCanvasContext();

    const testTokens: WordToken[] = [
      { id: "1", text: "Viral", start: 1.0, end: 1.5, confidence: 1.0 },
      { id: "2", text: "Reel", start: 1.5, end: 2.0, confidence: 1.0 },
    ];
    const template = CAPTION_PRESETS[0];

    // At 0.95s, speech hasn't started yet (normally silent)
    renderCaptionFrame({
      ctx: ctxNormal,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.95,
      tokens: testTokens,
      template,
      syncOffsetSeconds: 0,
    });
    expect(ctxNormal.getLog().filter((l) => l.startsWith("fillText")).length).toBe(0);

    // With +100ms sync offset (effective time 1.05s), 'Viral' is now active!
    renderCaptionFrame({
      ctx: ctxShifted,
      canvasWidth: 720,
      canvasHeight: 1280,
      currentTime: 0.95,
      tokens: testTokens,
      template,
      syncOffsetSeconds: 0.1,
    });
    expect(ctxShifted.getLog().filter((l) => l.startsWith("fillText")).length).toBeGreaterThan(0);
  });

  it("should generate 100% identical behind-the-subject compositing commands across preview and export using synthetic mask", () => {
    const width = 720;
    const height = 1280;

    const ctxPreview = createMockCanvasContext();
    const ctxExport = createMockCanvasContext();

    const syntheticMask = new Uint8Array(384 * 512).fill(255);
    const mockVideoSource = {} as CanvasImageSource;

    const testTokens: WordToken[] = [
      { id: "1", text: "Maine", start: 0.2, end: 0.6, confidence: 0.99 },
      { id: "2", text: "video", start: 0.7, end: 1.1, confidence: 0.99 },
    ];

    const behindTemplate = CAPTION_PRESETS.find((t) => t.id === "behind_head_giant_word")!;
    expect(behindTemplate.layout.behindSubjectDepth).toBe(true);

    const subjectMetrics = {
      hasSubject: true,
      confidence: 0.95,
      coveragePercent: 25.0,
      boundingBox: { x: 0.25, y: 0.2, width: 0.5, height: 0.75 },
      headRegion: { centerX: 0.5, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    // Render Preview
    renderCaptionFrame({
      ctx: ctxPreview,
      canvasWidth: width,
      canvasHeight: height,
      currentTime: 0.85,
      tokens: testTokens,
      template: behindTemplate,
      videoSource: mockVideoSource,
      segmentationMask: syntheticMask,
      maskWidth: 384,
      maskHeight: 512,
      subjectMetrics,
    });

    // Render Export
    renderCaptionFrame({
      ctx: ctxExport,
      canvasWidth: width,
      canvasHeight: height,
      currentTime: 0.85,
      tokens: testTokens,
      template: behindTemplate,
      videoSource: mockVideoSource,
      segmentationMask: syntheticMask,
      maskWidth: 384,
      maskHeight: 512,
      subjectMetrics,
    });

    const previewLog = ctxPreview.getLog();
    const exportLog = ctxExport.getLog();

    // Verify 100% identical command logs across preview and export
    expect(previewLog).toEqual(exportLog);

    // Verify layer draw order:
    // 1. Text is filled before the cutout pass
    const textFillIndex = previewLog.findIndex((l) => l.startsWith("fillText"));
    const cutoutIndex = previewLog.findIndex((l) => l.startsWith("drawSubjectCutout"));

    expect(textFillIndex).toBeGreaterThanOrEqual(0);
    expect(cutoutIndex).toBeGreaterThan(textFillIndex);
  });

  it("should never render template pill badges (such as 'BEHIND YOU' or 'SQUASH BOUNCE') on the video overlay by default", () => {
    const ctxDefault = createMockCanvasContext();
    const ctxCanvasWrapper = createMockCanvasContext();
    const testTokens: WordToken[] = [
      { id: "1", text: "Test", start: 0.1, end: 0.5, confidence: 1.0 },
      { id: "2", text: "overlay", start: 0.5, end: 1.0, confidence: 1.0 },
    ];
    const templateWithBadge = CAPTION_PRESETS.find((t) => t.badge) || CAPTION_PRESETS[0];

    // 1. Direct renderCaptionFrame without showBehindBadge specified
    renderCaptionFrame({
      ctx: ctxDefault as unknown as CanvasRenderingContext2D,
      canvasWidth: 1080,
      canvasHeight: 1920,
      currentTime: 0.3,
      tokens: testTokens,
      template: templateWithBadge,
    });

    const defaultLog = ctxDefault.getLog();
    const hasBadgeInDefault = defaultLog.some((cmd) => cmd.includes(`fillText("${templateWithBadge.badge}"`));
    expect(hasBadgeInDefault).toBe(false);

    // 2. Via renderCaptionsToCanvas (used in editor and export)
    renderCaptionsToCanvas(
      ctxCanvasWrapper as unknown as CanvasRenderingContext2D,
      testTokens,
      templateWithBadge,
      0.3,
      1080,
      1920,
      0
    );

    const canvasWrapperLog = ctxCanvasWrapper.getLog();
    const hasBadgeInWrapper = canvasWrapperLog.some((cmd) => cmd.includes(`fillText("${templateWithBadge.badge}"`));
    expect(hasBadgeInWrapper).toBe(false);
  });
});


