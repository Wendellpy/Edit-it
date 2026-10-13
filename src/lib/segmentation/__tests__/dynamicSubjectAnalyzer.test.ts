import { describe, it, expect } from "vitest";
import { DynamicSubjectAnalyzer } from "../dynamicSubjectAnalyzer";
import { computeSubjectAwareLayout } from "../../renderer/subjectAwareLayout";
import { getTemplateById } from "../../templates";

describe("DynamicSubjectAnalyzer - Dynamic Video Subject Analysis", () => {
  const analyzer = new DynamicSubjectAnalyzer();

  function createSyntheticFrame(
    width: number,
    height: number,
    subjectXRatio: number, // 0.0 to 1.0 (e.g. 0.3 for left, 0.7 for right)
    subjectYRatio = 0.4
  ): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(width * height * 4);

    // Fill background with cool blue/slate wall color (R=60, G=70, B=90)
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      rgba[idx] = 60;
      rgba[idx + 1] = 70;
      rgba[idx + 2] = 90;
      rgba[idx + 3] = 255;
    }

    // Draw human subject at specified horizontal position:
    // Head: skin tone (R=210, G=150, B=120)
    const headCenterX = Math.round(width * subjectXRatio);
    const headCenterY = Math.round(height * subjectYRatio);
    const headRadiusX = Math.round(width * 0.12);
    const headRadiusY = Math.round(height * 0.14);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - headCenterX) / headRadiusX;
        const dy = (y - headCenterY) / headRadiusY;
        if (dx * dx + dy * dy <= 1.0) {
          const idx = (y * width + x) * 4;
          rgba[idx] = 210;     // Skin R
          rgba[idx + 1] = 150; // Skin G
          rgba[idx + 2] = 120; // Skin B
          rgba[idx + 3] = 255;
        }

        // Torso: darker shirt (R=30, G=35, B=45) extending downwards
        const torsoDy = y - headCenterY;
        if (torsoDy > headRadiusY * 0.6 && torsoDy < height * 0.5) {
          const torsoHalfWidth = headRadiusX * 1.8;
          if (Math.abs(x - headCenterX) <= torsoHalfWidth) {
            const idx = (y * width + x) * 4;
            rgba[idx] = 30;
            rgba[idx + 1] = 35;
            rgba[idx + 2] = 45;
            rgba[idx + 3] = 255;
          }
        }
      }
    }

    return rgba;
  }

  it("dynamically detects a subject located on the LEFT side of the video", () => {
    const width = 320;
    const height = 240;
    const leftFrame = createSyntheticFrame(width, height, 0.30); // 30% from left
    const result = analyzer.analyzeFrame(leftFrame, width, height, 0);

    expect(result.faceDetected).toBe(true);
    expect(result.metrics.hasSubject).toBe(true);
    // Real detected centroid must be in the left half (< 0.42)
    expect(result.subjectCentroid.x).toBeLessThan(0.42);
    expect(result.metrics.headRegion.centerX).toBeLessThan(0.42);
  });

  it("dynamically detects a subject located on the RIGHT side of the video", () => {
    const width = 320;
    const height = 240;
    const rightFrame = createSyntheticFrame(width, height, 0.70); // 70% from left
    const result = analyzer.analyzeFrame(rightFrame, width, height, 0);

    expect(result.faceDetected).toBe(true);
    expect(result.metrics.hasSubject).toBe(true);
    // Real detected centroid must be in the right half (> 0.58)
    expect(result.subjectCentroid.x).toBeGreaterThan(0.58);
    expect(result.metrics.headRegion.centerX).toBeGreaterThan(0.58);
  });

  it("dynamically shifts behind-the-subject caption position according to detected subject", () => {
    const template = getTemplateById("behind_you_white");
    const width = 1080;
    const height = 1920;

    // Subject on Left (x = 0.30)
    const leftMetrics = {
      hasSubject: true,
      confidence: 0.9,
      coveragePercent: 18,
      boundingBox: { x: 0.18, y: 0.25, width: 0.24, height: 0.55 },
      headRegion: { centerX: 0.30, centerY: 0.35, radiusX: 0.12, radiusY: 0.14 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    const leftLayout = computeSubjectAwareLayout(
      template,
      leftMetrics,
      width,
      height,
      80,
      400,
      120
    );

    // Subject on Right (x = 0.70)
    const rightMetrics = {
      hasSubject: true,
      confidence: 0.9,
      coveragePercent: 18,
      boundingBox: { x: 0.58, y: 0.25, width: 0.24, height: 0.55 },
      headRegion: { centerX: 0.70, centerY: 0.35, radiusX: 0.12, radiusY: 0.14 },
      subjectCount: 1,
      isLeavingFrame: false,
    };

    const rightLayout = computeSubjectAwareLayout(
      template,
      rightMetrics,
      width,
      height,
      80,
      400,
      120
    );

    // Verify dynamic text placement:
    // When subject is on left, text is placed on left (< 500px)
    expect(leftLayout.x).toBeLessThan(500);
    // When subject is on right, text is placed on right (> 650px)
    expect(rightLayout.x).toBeGreaterThan(650);
    // The two positions MUST be different, proving dynamic behavior!
    expect(leftLayout.x).not.toEqual(rightLayout.x);
  });

  it("returns hasSubject=false when no person is present in the video frame", () => {
    const width = 160;
    const height = 120;
    const emptyFrame = new Uint8ClampedArray(width * height * 4);
    // Pure green background (landscape / chroma key)
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      emptyFrame[idx] = 20;
      emptyFrame[idx + 1] = 180;
      emptyFrame[idx + 2] = 20;
      emptyFrame[idx + 3] = 255;
    }

    const result = analyzer.analyzeFrame(emptyFrame, width, height, 0);
    expect(result.faceDetected).toBe(false);
    expect(result.metrics.hasSubject).toBe(false);
  });
});
