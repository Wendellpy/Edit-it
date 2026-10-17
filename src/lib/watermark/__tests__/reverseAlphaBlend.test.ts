import { describe, it, expect } from "vitest";
import {
  getEmbeddedAlphaMap,
  interpolateAlphaMap,
  resolveGeminiWatermarkConfig,
} from "../geminiAlphaMaps";
import { reverseAlphaBlend } from "../reverseAlphaBlend";
import { inpaintImageData } from "../inpainter";

describe("Reverse Alpha Blending Engine (Gemini / Veo Ground Truth)", () => {
  it("decodes embedded Float32 alpha maps accurately", () => {
    const alpha48 = getEmbeddedAlphaMap(48);
    expect(alpha48).not.toBeNull();
    expect(alpha48!.length).toBe(48 * 48);
    // Peak alpha for 48px watermark is approx ~0.5059 (129/255)
    expect(Math.max(...alpha48!)).toBeCloseTo(0.5059, 2);

    const alpha96 = getEmbeddedAlphaMap(96);
    expect(alpha96).not.toBeNull();
    expect(alpha96!.length).toBe(96 * 96);
    expect(Math.max(...alpha96!)).toBeCloseTo(0.5137, 2);

    const alpha36 = getEmbeddedAlphaMap("36-v2");
    expect(alpha36).not.toBeNull();
    expect(alpha36!.length).toBe(36 * 36);
  });

  it("scales alpha maps using bilinear interpolation", () => {
    const alpha48 = getEmbeddedAlphaMap(48)!;
    const scaled64 = interpolateAlphaMap(alpha48, 48, 64);
    expect(scaled64.length).toBe(64 * 64);
    expect(Math.max(...scaled64)).toBeCloseTo(0.5059, 1);
  });

  it("resolves official catalog dimensions for 720x1280 vertical video", () => {
    const config = resolveGeminiWatermarkConfig(720, 1280);
    expect(config.logoSize).toBe(48);
    expect(config.marginRight).toBe(96);
    expect(config.marginBottom).toBe(96);
    expect(config.alphaGain).toBe(0.60);
    expect(config.x).toBe(720 - 96 - 48); // 576
    expect(config.y).toBe(1280 - 96 - 48); // 1136
  });

  it("mathematically reverses alpha blending with near-lossless precision", () => {
    const width = 48;
    const height = 48;
    const originalValue = 85; // e.g. dark dashboard or text pixel
    const logoValue = 255;
    const alpha = 0.30; // 30% watermark opacity

    // Simulate forward compositing: watermarked = alpha * logo + (1 - alpha) * original
    const watermarkedValue = Math.round(alpha * logoValue + (1 - alpha) * originalValue);

    // Create ImageData buffer with watermarked pixel
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = watermarkedValue;
      data[i * 4 + 1] = watermarkedValue;
      data[i * 4 + 2] = watermarkedValue;
      data[i * 4 + 3] = 255;
    }

    const imgData = {
      width,
      height,
      data,
    } as ImageData;

    // Synthetic alpha map with uniform 0.30 opacity
    const alphaMap = new Float32Array(width * height).fill(0.30);

    reverseAlphaBlend(
      imgData,
      alphaMap,
      { x: 0, y: 0, width, height },
      { alphaGain: 1.0 }
    );

    // Inverted pixel should restore original value (85) within 1-unit rounding error
    expect(data[0]).toBeGreaterThanOrEqual(originalValue - 1);
    expect(data[0]).toBeLessThanOrEqual(originalValue + 1);
  });

  it("inpaints Gemini watermarks using reverse alpha blend without boundary smearing", () => {
    const imgW = 720;
    const imgH = 1280;
    const data = new Uint8ClampedArray(imgW * imgH * 4);

    // Fill with a synthetic gradient representing dashboard and bright text
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        const idx = (y * imgW + x) * 4;
        data[idx] = 60;     // R
        data[idx + 1] = 60; // G
        data[idx + 2] = 60; // B
        data[idx + 3] = 255;
      }
    }

    const imageData = { width: imgW, height: imgH, data } as ImageData;

    // Call inpaintImageData with platformId = 'gemini'
    inpaintImageData(
      imageData,
      { x: 566, y: 1115, width: 68, height: 74 },
      { platformId: "gemini" }
    );

    // Pixels outside watermark should remain 60
    expect(data[(1100 * imgW + 550) * 4]).toBe(60);
  });
});
