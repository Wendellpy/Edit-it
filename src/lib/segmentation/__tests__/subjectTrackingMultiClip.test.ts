import { describe, it, expect } from "vitest";
import { AccurateSubjectModel, KinematicSubjectTracker } from "../subjectTrackingModel";
import { dynamicSubjectAnalyzer } from "../dynamicSubjectAnalyzer";
import { renderCaptionFrame } from "../../renderer/captionRenderer";
import { computeSubjectAwareLayout } from "../../renderer/subjectAwareLayout";
import { CAPTION_PRESETS } from "../../templates/presets";
import type { WordToken } from "@/lib/timestampRefiner";

function createMockContext() {
  const log: string[] = [];
  return {
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
    fillText: (text: string, x: number, y: number) =>
      log.push(`fillText("${text}",${Math.round(x)},${Math.round(y)})`),
    strokeText: (text: string, x: number, y: number) =>
      log.push(`strokeText("${text}",${Math.round(x)},${Math.round(y)})`),
    measureText: (text: string) => ({ width: text.length * 20 }),
    getLog: () => log,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    shadowColor: "",
    shadowBlur: 0,
    globalAlpha: 1.0,
    globalCompositeOperation: "source-over",
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Synthetic realistic clip generator simulating different human creators,
 * diverse skin tones, clothing, lighting, and positions.
 */
function generateClipFrame(params: {
  width: number;
  height: number;
  subjectX: number; // 0.0 to 1.0
  subjectY?: number;
  skinR?: number;
  skinG?: number;
  skinB?: number;
  shirtR?: number;
  shirtG?: number;
  shirtB?: number;
  bgR?: number;
  bgG?: number;
  bgB?: number;
}): Uint8ClampedArray {
  const {
    width,
    height,
    subjectX,
    subjectY = 0.35,
    skinR = 210,
    skinG = 150,
    skinB = 120,
    shirtR = 30,
    shirtG = 35,
    shirtB = 45,
    bgR = 60,
    bgG = 70,
    bgB = 90,
  } = params;

  const rgba = new Uint8ClampedArray(width * height * 4);

  // 1. Background fill (wall/room)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    rgba[idx] = bgR;
    rgba[idx + 1] = bgG;
    rgba[idx + 2] = bgB;
    rgba[idx + 3] = 255;
  }

  // 2. Head & Torso Geometry
  const hX = Math.round(width * subjectX);
  const hY = Math.round(height * subjectY);
  const rX = Math.round(width * 0.12);
  const rY = Math.round(height * 0.14);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - hX) / rX;
      const dy = (y - hY) / rY;

      // Head / Face ellipse
      if (dx * dx + dy * dy <= 1.0) {
        const idx = (y * width + x) * 4;
        rgba[idx] = skinR;
        rgba[idx + 1] = skinG;
        rgba[idx + 2] = skinB;
        rgba[idx + 3] = 255;
      }

      // Shoulders & Torso
      const torsoDy = y - hY;
      if (torsoDy > rY * 0.7 && torsoDy < height * 0.65) {
        const shoulderW = rX * 2.4;
        if (Math.abs(x - hX) <= shoulderW) {
          const idx = (y * width + x) * 4;
          rgba[idx] = shirtR;
          rgba[idx + 1] = shirtG;
          rgba[idx + 2] = shirtB;
          rgba[idx + 3] = 255;
        }
      }
    }
  }

  return rgba;
}

describe("Subject Tracking & Matting on Multi-Clip Corpus", () => {
  it("Clip 1: Center talking head vlog - tracks accurately with high confidence", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;
    const frame = generateClipFrame({
      width: w,
      height: h,
      subjectX: 0.50,
      skinR: 215,
      skinG: 155,
      skinB: 125,
      shirtR: 35,
      shirtG: 40,
      shirtB: 50,
    });

    const res = model.processFrame(frame, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);
    expect(res.faceDetected).toBe(true);
    expect(res.metrics.confidence).toBeGreaterThan(0.7);
    expect(res.metrics.headRegion.centerX).toBeCloseTo(0.50, 1);
  });

  it("Clip 2: Moving creator walking across frame - tracks motion smoothly", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;

    // Frame 1: Creator at left (x = 0.35)
    const frame1 = generateClipFrame({ width: w, height: h, subjectX: 0.35 });
    const res1 = model.processFrame(frame1, w, h, 0.0);
    expect(res1.metrics.headRegion.centerX).toBeLessThan(0.42);

    // Frame 2: Creator moving to center (x = 0.50)
    const frame2 = generateClipFrame({ width: w, height: h, subjectX: 0.50 });
    const res2 = model.processFrame(frame2, w, h, 0.1);
    expect(res2.metrics.headRegion.centerX).toBeGreaterThan(res1.metrics.headRegion.centerX);

    // Frame 3: Creator moving to right (x = 0.65)
    const frame3 = generateClipFrame({ width: w, height: h, subjectX: 0.65 });
    const res3 = model.processFrame(frame3, w, h, 0.2);
    expect(res3.metrics.headRegion.centerX).toBeGreaterThan(res2.metrics.headRegion.centerX);
  });

  it("Clip 3: Creator with deep/brown skin tone - accurately segmented by universal YCbCr locus", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;
    // Deep warm brown skin tone (R=145, G=95, B=70)
    const frame = generateClipFrame({
      width: w,
      height: h,
      subjectX: 0.50,
      skinR: 145,
      skinG: 95,
      skinB: 70,
      shirtR: 200,
      shirtG: 200,
      shirtB: 200, // White shirt
      bgR: 50,
      bgG: 60,
      bgB: 80,
    });

    const res = model.processFrame(frame, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);
    expect(res.metrics.confidence).toBeGreaterThan(0.65);
    expect(res.metrics.headRegion.centerX).toBeCloseTo(0.50, 1);
  });

  it("Clip 4: Creator in high-contrast bright clothing - clothing seeds segment solid torso", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;
    // Red hoodie (R=190, G=30, B=40)
    const frame = generateClipFrame({
      width: w,
      height: h,
      subjectX: 0.48,
      skinR: 220,
      skinG: 160,
      skinB: 130,
      shirtR: 190,
      shirtG: 30,
      shirtB: 40,
    });

    const res = model.processFrame(frame, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);

    // Verify chest core pixels are solid foreground (alpha = 255)
    const chestY = Math.round(h * 0.48);
    const chestX = Math.round(w * 0.48);
    expect(res.mask[chestY * w + chestX]).toBe(255);
  });

  it("Clip 5: Backlit / silhouette subject - fallback to background contrast localization", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;
    // Dark silhouette (R=30, G=30, B=35) against bright studio window (R=210, G=220, B=230)
    const frame = generateClipFrame({
      width: w,
      height: h,
      subjectX: 0.52,
      skinR: 40,
      skinG: 40,
      skinB: 45,
      shirtR: 30,
      shirtG: 30,
      shirtB: 35,
      bgR: 210,
      bgG: 220,
      bgB: 230,
    });

    const res = model.processFrame(frame, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);
    expect(res.metrics.headRegion.centerX).toBeCloseTo(0.52, 1);
  });

  it("Clip 6: Person sitting on chair - chair backrest wings and seated torso track solidly without holes", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;

    // Generate frame with person sitting in an office / gaming chair
    const bgR = 75, bgG = 85, bgB = 100;
    const chairR = 25, chairG = 28, chairB = 35; // Dark chair
    const skinR = 215, skinG = 155, skinB = 120;
    const shirtR = 200, shirtG = 50, shirtB = 60; // Red shirt

    const rgba = new Uint8ClampedArray(w * h * 4);
    // Background wall
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      rgba[idx] = bgR;
      rgba[idx + 1] = bgG;
      rgba[idx + 2] = bgB;
      rgba[idx + 3] = 255;
    }

    const hX = Math.round(w * 0.50);
    const hY = Math.round(h * 0.35);
    const rX = Math.round(w * 0.12);
    const rY = Math.round(h * 0.14);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - hX) / rX;
        const dy = (y - hY) / rY;

        // Chair backrest: spans from above head down to bottom, flanking head and neck
        const chairDy = y - hY;
        if (chairDy >= -rY * 0.9 && y < h * 0.9) {
          const chairHalfW = chairDy < rY * 0.8 ? rX * 1.6 : rX * 2.6;
          if (Math.abs(x - hX) <= chairHalfW) {
            const idx = (y * w + x) * 4;
            rgba[idx] = chairR;
            rgba[idx + 1] = chairG;
            rgba[idx + 2] = chairB;
            rgba[idx + 3] = 255;
          }
        }

        // Head / Face ellipse in front of chair
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * w + x) * 4;
          rgba[idx] = skinR;
          rgba[idx + 1] = skinG;
          rgba[idx + 2] = skinB;
          rgba[idx + 3] = 255;
        }

        // Torso / Clothing in front of chair
        const torsoDy = y - hY;
        if (torsoDy > rY * 0.7 && torsoDy < h * 0.65) {
          const shoulderW = rX * 2.2;
          if (Math.abs(x - hX) <= shoulderW) {
            const idx = (y * w + x) * 4;
            rgba[idx] = shirtR;
            rgba[idx + 1] = shirtG;
            rgba[idx + 2] = shirtB;
            rgba[idx + 3] = 255;
          }
        }
      }
    }

    const res = model.processFrame(rgba, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);
    expect(res.faceDetected).toBe(true);
    expect(res.metrics.confidence).toBeGreaterThan(0.70);

    // 1. Face pixel is solid foreground
    expect(res.mask[hY * w + hX]).toBe(255);

    // 2. Torso pixel is solid foreground
    const torsoY = Math.round(h * 0.55);
    expect(res.mask[torsoY * w + hX]).toBe(255);

    // 3. Chair backrest wing flanking the head/ears is solid foreground (alpha = 255)
    // This ensures text doesn't punch holes through the chair headrest right next to the person's face!
    const earLevelY = hY;
    const chairWingX = Math.round(hX + rX * 1.35);
    expect(res.mask[earLevelY * w + chairWingX]).toBe(255);

    // 4. Chair backrest wing flanking the neck is solid foreground (alpha >= 250)
    const neckLevelY = Math.round(hY + rY * 0.6);
    const neckChairX = Math.round(hX + rX * 1.45);
    expect(res.mask[neckLevelY * w + neckChairX]).toBeGreaterThanOrEqual(250);

    // 5. Perimeter room wall is background (alpha = 0)
    expect(res.mask[10 * w + 10]).toBe(0);
    expect(res.mask[10 * w + (w - 10)]).toBe(0);
  });

  it("Clip 7: Small / distant subject (10% frame width) - mask conforms tightly without leaking background", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;

    // Small subject centered at 0.50, taking only 10% width
    const bgR = 60, bgG = 65, bgB = 75;
    const skinR = 215, skinG = 155, skinB = 125;
    const shirtR = 30, shirtG = 35, shirtB = 45;

    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      rgba[idx] = bgR;
      rgba[idx + 1] = bgG;
      rgba[idx + 2] = bgB;
      rgba[idx + 3] = 255;
    }

    const hX = Math.round(w * 0.50);
    const hY = Math.round(h * 0.35);
    const rX = Math.round(w * 0.04); // Only 4% radius = 8% width!
    const rY = Math.round(h * 0.05);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - hX) / rX;
        const dy = (y - hY) / rY;
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * w + x) * 4;
          rgba[idx] = skinR;
          rgba[idx + 1] = skinG;
          rgba[idx + 2] = skinB;
          rgba[idx + 3] = 255;
        }
        const torsoDy = y - hY;
        if (torsoDy > rY * 0.7 && torsoDy < h * 0.3) {
          if (Math.abs(x - hX) <= rX * 1.5) {
            const idx = (y * w + x) * 4;
            rgba[idx] = shirtR;
            rgba[idx + 1] = shirtG;
            rgba[idx + 2] = shirtB;
            rgba[idx + 3] = 255;
          }
        }
      }
    }

    const res = model.processFrame(rgba, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);

    // Subject core is solid
    expect(res.mask[hY * w + hX]).toBe(255);

    // Dynamic mask bounds must be tight (width <= 0.22, not forced to 49.5%!)
    expect(res.metrics.boundingBox.width).toBeLessThanOrEqual(0.22);

    // Pixels at distance 0.15 * w (48px away) must be 0 (clean background, no leaks)
    const outsideX = Math.round(hX + w * 0.15);
    expect(res.mask[hY * w + outsideX]).toBe(0);
  });

  it("Clip 8: Extreme close-up / wide object (75% frame width) - mask dynamically covers wide span without clamping", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;

    const bgR = 50, bgG = 55, bgB = 65;
    const skinR = 215, skinG = 155, skinB = 125;
    const shirtR = 180, shirtG = 40, shirtB = 45;

    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      rgba[idx] = bgR;
      rgba[idx + 1] = bgG;
      rgba[idx + 2] = bgB;
      rgba[idx + 3] = 255;
    }

    const hX = Math.round(w * 0.50);
    const hY = Math.round(h * 0.35);
    const rX = Math.round(w * 0.25); // 25% radius = 50% head width
    const rY = Math.round(h * 0.22);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - hX) / rX;
        const dy = (y - hY) / rY;
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * w + x) * 4;
          rgba[idx] = skinR;
          rgba[idx + 1] = skinG;
          rgba[idx + 2] = skinB;
          rgba[idx + 3] = 255;
        }
        // Wide shoulders spanning 75% of frame width
        const torsoDy = y - hY;
        if (torsoDy > rY * 0.7 && torsoDy < h * 0.75) {
          if (Math.abs(x - hX) <= w * 0.38) {
            const idx = (y * w + x) * 4;
            rgba[idx] = shirtR;
            rgba[idx + 1] = shirtG;
            rgba[idx + 2] = shirtB;
            rgba[idx + 3] = 255;
          }
        }
      }
    }

    const res = model.processFrame(rgba, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);
    expect(res.metrics.confidence).toBeGreaterThan(0.70);

    // Wide subject bounding box width must exceed 65% of screen width
    expect(res.metrics.boundingBox.width).toBeGreaterThanOrEqual(0.65);

    // Left and right flanks at x = 0.20 and x = 0.80 must be foreground (alpha = 255)
    // Proving the mask is NOT clamped at width * 0.495!
    const torsoY = Math.round(h * 0.60);
    const leftFlankX = Math.round(w * 0.20);
    const rightFlankX = Math.round(w * 0.80);
    expect(res.mask[torsoY * w + leftFlankX]).toBe(255);
    expect(res.mask[torsoY * w + rightFlankX]).toBe(255);
  });

  it("Clip 9: Non-human object product showcase (no face) - dynamically segments object via contrast contour", () => {
    const model = new AccurateSubjectModel();
    const w = 320;
    const h = 240;

    // Studio table background (light gray R=210, G=215, B=220)
    const bgR = 210, bgG = 215, bgB = 220;
    // Dark metallic camera/gadget product (R=30, G=30, B=35)
    const prodR = 30, prodG = 30, prodB = 35;

    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      rgba[idx] = bgR;
      rgba[idx + 1] = bgG;
      rgba[idx + 2] = bgB;
      rgba[idx + 3] = 255;
    }

    // Product placed in center, 40% width and 30% height
    const pX = Math.round(w * 0.50);
    const pY = Math.round(h * 0.50);
    const pHalfW = Math.round(w * 0.20);
    const pHalfH = Math.round(h * 0.15);

    for (let y = pY - pHalfH; y <= pY + pHalfH; y++) {
      for (let x = pX - pHalfW; x <= pX + pHalfW; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = prodR;
        rgba[idx + 1] = prodG;
        rgba[idx + 2] = prodB;
        rgba[idx + 3] = 255;
      }
    }

    const res = model.processFrame(rgba, w, h, 0.0);
    expect(res.metrics.hasSubject).toBe(true);

    // Product interior must be solid foreground
    expect(res.mask[pY * w + pX]).toBe(255);

    // Outside product must be clean background (0)
    expect(res.mask[10 * w + 10]).toBe(0);
    expect(res.mask[pY * w + Math.round(pX + pHalfW + 20)]).toBe(0);
  });
});

describe("Behind & Sandwich Depth Compositing", () => {
  const behindTmpl = CAPTION_PRESETS.find((t) => t.id === "behind_you_white")!;
  const sandwichTmpl = CAPTION_PRESETS.find((t) => t.id === "behind_sandwich_layer")!;

  const testTokens: WordToken[] = [
    { id: "1", text: "Create", start: 0.1, end: 0.5, confidence: 0.99 },
    { id: "2", text: "VIRAL", start: 0.5, end: 1.0, confidence: 0.99 }, // Active
    { id: "3", text: "Captions", start: 1.0, end: 1.5, confidence: 0.99 },
  ];

  it("Behind Effect: renders text layer behind subject cutout with wide peeking font", () => {
    const ctx = createMockContext();
    const w = 1080;
    const h = 1920;

    const mockSubjectMetrics = {
      hasSubject: true,
      confidence: 0.95,
      coveragePercent: 22.0,
      boundingBox: { x: 0.25, y: 0.20, width: 0.50, height: 0.70 },
      headRegion: { centerX: 0.50, centerY: 0.32, radiusX: 0.14, radiusY: 0.15 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    renderCaptionFrame({
      ctx,
      canvasWidth: w,
      canvasHeight: h,
      currentTime: 0.7,
      tokens: testTokens,
      template: behindTmpl,
      layerOrder: "behind",
      subjectMetrics: mockSubjectMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = (ctx as any).getLog() as string[];
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    // Text MUST be rendered before cutout (behind layer)
    const textBeforeCutout = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    expect(textBeforeCutout.length).toBeGreaterThan(0);

    // In 'behind' mode, no text is rendered after cutout (no foreground clutter)
    const textAfterCutout = log.slice(cutoutIdx).filter((l) => l.startsWith("fillText"));
    expect(textAfterCutout.length).toBe(0);
  });

  it("Sandwich Effect: renders multi-line with Line 0 behind and Line 1 in front", () => {
    const ctx = createMockContext();
    const w = 1080;
    const h = 1920;

    const mockSubjectMetrics = {
      hasSubject: true,
      confidence: 0.95,
      coveragePercent: 22.0,
      boundingBox: { x: 0.25, y: 0.20, width: 0.50, height: 0.70 },
      headRegion: { centerX: 0.50, centerY: 0.32, radiusX: 0.14, radiusY: 0.15 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    // 4 words split into 2 lines
    const multiLineTokens: WordToken[] = [
      { id: "1", text: "Top", start: 0.1, end: 0.4, confidence: 1.0 },
      { id: "2", text: "Line", start: 0.4, end: 0.8, confidence: 1.0 },
      { id: "3", text: "Front", start: 0.8, end: 1.2, confidence: 1.0 }, // active
      { id: "4", text: "Layer", start: 1.2, end: 1.6, confidence: 1.0 },
    ];

    renderCaptionFrame({
      ctx,
      canvasWidth: w,
      canvasHeight: h,
      currentTime: 0.9,
      tokens: multiLineTokens,
      template: sandwichTmpl,
      layerOrder: "sandwich",
      subjectMetrics: mockSubjectMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = (ctx as any).getLog() as string[];
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    // Behind layer has Line 0 text
    const textBefore = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    expect(textBefore.length).toBeGreaterThan(0);

    // Front layer has Line 1 text
    const textAfter = log.slice(cutoutIdx).filter((l) => l.startsWith("fillText"));
    expect(textAfter.length).toBeGreaterThan(0);
  });

  it("Seated Creator in Chair: Behind mode scales font to peek out flanking chair wings", () => {
    const ctx = createMockContext();
    const w = 1080;
    const h = 1920;

    // Seated creator occupies wider bounding box due to chair wings (width 0.58)
    const seatedMetrics = {
      hasSubject: true,
      confidence: 0.96,
      coveragePercent: 32.0,
      boundingBox: { x: 0.21, y: 0.22, width: 0.58, height: 0.75 },
      headRegion: { centerX: 0.50, centerY: 0.35, radiusX: 0.13, radiusY: 0.14 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    renderCaptionFrame({
      ctx,
      canvasWidth: w,
      canvasHeight: h,
      currentTime: 0.7,
      tokens: testTokens,
      template: behindTmpl,
      layerOrder: "behind",
      subjectMetrics: seatedMetrics,
      videoSource: {} as CanvasImageSource,
      segmentationMask: new Uint8Array(100).fill(255),
      maskWidth: 10,
      maskHeight: 10,
    });

    const log = (ctx as any).getLog() as string[];
    const cutoutIdx = log.findIndex((l) => l.startsWith("drawSubjectCutout"));
    expect(cutoutIdx).toBeGreaterThan(0);

    // Text renders behind cutout
    const textBeforeCutout = log.slice(0, cutoutIdx).filter((l) => l.startsWith("fillText"));
    expect(textBeforeCutout.length).toBeGreaterThan(0);

    // Verify layout calculation for seated subject peeks out beyond chair width
    const layout = computeSubjectAwareLayout(
      behindTmpl,
      seatedMetrics,
      w,
      h,
      100,
      400, // Narrow text width initially
      100
    );
    // Adjusted font size must scale up to peek beyond the chair width (0.58 * 1080 * 1.35 = 845px)
    expect(layout.fontSize).toBeGreaterThan(100);
  });
});
