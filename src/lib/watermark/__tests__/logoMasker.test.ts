import { describe, it, expect } from "vitest";
import {
  generateWatermarkMask,
  extractTemporalWatermarkMask,
  learnWatermarkFromClips,
} from "../logoMasker";
import {
  AI_WATERMARK_DATASET,
  computeTemplateCorrelation,
} from "../logoDataset";
import { inpaintImageData } from "../inpainter";

describe("AI Logo Dataset, Correlation & Shape Masker", () => {
  it("computes accurate normalized cross-correlation for identical glyph templates", () => {
    const geminiGlyph = AI_WATERMARK_DATASET.gemini.glyphMatrix16;
    const score = computeTemplateCorrelation(geminiGlyph, geminiGlyph);
    expect(score).toBeCloseTo(1.0, 2);
  });

  it("produces distinct correlation profiles between Gemini sparkle and Runway wordmark", () => {
    const geminiGlyph = AI_WATERMARK_DATASET.gemini.glyphMatrix16;
    const runwayGlyph = AI_WATERMARK_DATASET.runway.glyphMatrix16;
    const score = computeTemplateCorrelation(geminiGlyph, runwayGlyph);
    expect(score).toBeLessThan(0.7);
  });

  it("generates a tight shape mask for a white logo on dark background", () => {
    const w = 40;
    const h = 20;
    const data = new Uint8ClampedArray(w * h * 4);

    // Background: dark green (30, 60, 40)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30;
      data[i + 1] = 60;
      data[i + 2] = 40;
      data[i + 3] = 255;
    }

    // Logo: small 4x4 white sparkle mark inside the box (x: 10..14, y: 5..9)
    for (let y = 5; y < 9; y++) {
      for (let x = 10; x < 14; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 250;
        data[idx + 1] = 250;
        data[idx + 2] = 250;
      }
    }

    const fakeImgData = { width: w, height: h, data } as unknown as ImageData;
    const result = generateWatermarkMask(fakeImgData, { x: 0, y: 0, width: w, height: h }, "gemini");

    expect(result.width).toBe(w);
    expect(result.height).toBe(h);
    expect(result.coverageRatio).toBeGreaterThan(0.01);
    expect(result.coverageRatio).toBeLessThan(0.40);

    // The logo center should be marked in the mask
    const logoCenterIdx = 7 * w + 12;
    expect(result.mask[logoCenterIdx]).toBe(255);

    // Distant background (e.g. x: 30, y: 15) should remain untouched in mask (0)
    const bgIdx = 15 * w + 30;
    expect(result.mask[bgIdx]).toBe(0);
  });

  it("extracts static watermark silhouette across multiple simulated video frames", () => {
    const w = 30;
    const h = 20;

    // Simulate 3 frames of a video
    const frames: ImageData[] = [];
    for (let f = 0; f < 3; f++) {
      const data = new Uint8ClampedArray(w * h * 4);
      // Background changes with time f
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 40 + f * 40;
        data[i + 1] = 50 + f * 30;
        data[i + 2] = 60 + f * 20;
        data[i + 3] = 255;
      }

      // Static watermark letters at exact same location across all 3 frames (x: 8..12, y: 8..12)
      for (let y = 8; y < 12; y++) {
        for (let x = 8; x < 12; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 240;
          data[idx + 1] = 240;
          data[idx + 2] = 240;
        }
      }
      frames.push({ width: w, height: h, data } as unknown as ImageData);
    }

    const res = extractTemporalWatermarkMask(frames, { x: 0, y: 0, width: w, height: h });
    expect(res.width).toBe(w);
    expect(res.height).toBe(h);

    // Center of static logo should be detected as watermark
    const logoIdx = 10 * w + 10;
    expect(res.mask[logoIdx]).toBe(255);

    // Fluctuating background should be rejected from the mask (0)
    const bgIdx = 2 * w + 25;
    expect(res.mask[bgIdx]).toBe(0);
  });

  it("selectively inplants only the logo while preserving clean background pixels", () => {
    const w = 40;
    const h = 40;
    const data = new Uint8ClampedArray(w * h * 4);

    // Distinct background pattern (checkerboard or gradient)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 100;
        data[idx + 1] = (x * 4) % 255;
        data[idx + 2] = (y * 4) % 255;
        data[idx + 3] = 255;
      }
    }

    // Preserve sample background pixel value at (10, 10)
    const bgTestIdx = (10 * w + 10) * 4;
    const origBgG = data[bgTestIdx + 1];
    const origBgB = data[bgTestIdx + 2];

    // White watermark logo placed at (25..30, 25..30)
    for (let y = 25; y < 30; y++) {
      for (let x = 25; x < 30; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }

    const fakeImg = { width: w, height: h, data } as unknown as ImageData;

    // Run selective inpainting with shape mask enabled
    inpaintImageData(fakeImg, { x: 5, y: 5, width: 32, height: 32 }, {
      useShapeMask: true,
      featherRadius: 2,
      preserveGrain: false,
    });

    // 1. Watermark logo at (27, 27) must be inpainted (no longer pure 255 white)
    const wmTestIdx = (27 * w + 27) * 4;
    expect(data[wmTestIdx]).toBeLessThan(230);

    // 2. Background pixel at (10, 10) must be untouched!
    expect(data[bgTestIdx + 1]).toBe(origBgG);
    expect(data[bgTestIdx + 2]).toBe(origBgB);
  });

  it("learns watermark logo profile across multiple clip frames and identifies AI preset", () => {
    const w = 32;
    const h = 32;
    const frames: ImageData[] = [];

    // Simulate 4 video frames with moving background
    for (let f = 0; f < 4; f++) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i * 7 + f * 50) % 180;
        data[i + 1] = (i * 13 + f * 40) % 180;
        data[i + 2] = (i * 17 + f * 30) % 180;
        data[i + 3] = 255;
      }

      // Consistent 4-pointed sparkle star logo (Gemini-like) in the center (14..18, 14..18)
      for (let y = 14; y < 18; y++) {
        for (let x = 14; x < 18; x++) {
          const idx = (y * w + x) * 4;
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }
      }
      frames.push({ width: w, height: h, data } as unknown as ImageData);
    }

    const { maskResult, learnedProfile } = learnWatermarkFromClips(frames, { x: 0, y: 0, width: w, height: h });
    expect(maskResult.width).toBe(w);
    expect(maskResult.height).toBe(h);
    expect(learnedProfile.sampleCount).toBe(4);
    expect(learnedProfile.normalizedMask.length).toBe(256);
    expect(learnedProfile.presetId).toBeDefined();
    expect(learnedProfile.platformName).toBeDefined();
  });
});

