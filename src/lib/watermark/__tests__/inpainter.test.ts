import { describe, it, expect } from "vitest";
import {
  clampNormalizedROI,
  denormalizeROI,
  normalizeROI,
  inpaintImageData,
} from "../inpainter";
import { WATERMARK_PRESETS } from "../types";

describe("Watermark Remover Inpainter Math & Bounds", () => {
  it("strictly clamps normalized ROI within [0, 1] range", () => {
    const invalid = { x: -0.5, y: 1.2, width: 2.0, height: -0.1 };
    const clamped = clampNormalizedROI(invalid);

    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeLessThanOrEqual(0.99);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(1.0);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(1.0);
    expect(clamped.width).toBeGreaterThanOrEqual(0.01);
    expect(clamped.height).toBeGreaterThanOrEqual(0.01);
  });

  it("converts normalized ROI to integer pixel coordinates correctly", () => {
    const norm = { x: 0.8, y: 0.9, width: 0.15, height: 0.08 };
    const pixel = denormalizeROI(norm, 1920, 1080);

    expect(pixel.x).toBe(1536);
    expect(pixel.y).toBe(972);
    expect(pixel.width).toBe(288);
    expect(pixel.height).toBe(86);
  });

  it("normalizes pixel coordinates back to 0..1 ratio", () => {
    const pixel = { x: 500, y: 200, width: 100, height: 50 };
    const norm = normalizeROI(pixel, 1000, 1000);

    expect(norm.x).toBeCloseTo(0.5, 2);
    expect(norm.y).toBeCloseTo(0.2, 2);
    expect(norm.width).toBeCloseTo(0.1, 2);
    expect(norm.height).toBeCloseTo(0.05, 2);
  });

  it("has valid default ROIs for all AI platform presets", () => {
    const presetKeys = Object.keys(WATERMARK_PRESETS) as Array<keyof typeof WATERMARK_PRESETS>;
    expect(presetKeys.length).toBeGreaterThanOrEqual(7);

    for (const key of presetKeys) {
      const preset = WATERMARK_PRESETS[key];
      expect(preset.defaultRois.length).toBeGreaterThan(0);
      for (const roi of preset.defaultRois) {
        expect(roi.x).toBeGreaterThanOrEqual(0);
        expect(roi.y).toBeGreaterThanOrEqual(0);
        expect(roi.x + roi.width).toBeLessThanOrEqual(1.0001);
        expect(roi.y + roi.height).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("inpaints a simulated white watermark inside a solid red canvas", () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    // Fill entirely with red (200, 0, 0, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    // Put a white watermark block in the center (x: 20..30, y: 20..30)
    for (let y = 20; y < 30; y++) {
      for (let x = 20; x < 30; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }

    // Verify white watermark exists
    const testIdx = (25 * w + 25) * 4;
    expect(data[testIdx]).toBe(255);
    expect(data[testIdx + 1]).toBe(255);
    expect(data[testIdx + 2]).toBe(255);

    const fakeImageData = {
      width: w,
      height: h,
      data,
    } as unknown as ImageData;

    // Run inpainting on the watermark region
    inpaintImageData(fakeImageData, { x: 20, y: 20, width: 10, height: 10 }, {
      featherRadius: 2,
      preserveGrain: false,
    });

    // Center pixel should now be restored close to surrounding red (200, 0, 0)
    expect(data[testIdx]).toBeGreaterThan(150);
    expect(data[testIdx + 1]).toBeLessThan(50);
    expect(data[testIdx + 2]).toBeLessThan(50);
  });
});
