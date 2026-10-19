import { describe, it, expect } from "vitest";
import {
  getEmbeddedAlphaMap,
  interpolateAlphaMap,
  resolveGeminiWatermarkConfig,
  estimateGeminiAlphaGain,
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
    expect(config.alphaGain).toBe(1.02);
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

  it("dynamically estimates alpha gain for both standard (1.00) and weak/extended (0.60) watermarks", () => {
    const size = 48;
    const alphaMap = getEmbeddedAlphaMap(48)!;
    const imgW = 100;
    const imgH = 100;
    const x = 20;
    const y = 20;

    // Test with gain = 0.60 on a dark background (value = 10)
    const dataDark = new Uint8ClampedArray(imgW * imgH * 4).fill(10);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const a = alphaMap[r * size + c] * 0.60;
        const idx = ((y + r) * imgW + (x + c)) * 4;
        const val = Math.round(10 * (1 - a) + 255 * a);
        dataDark[idx] = val;
        dataDark[idx + 1] = val;
        dataDark[idx + 2] = val;
        dataDark[idx + 3] = 255;
      }
    }

    const estimatedWeak = estimateGeminiAlphaGain(
      { width: imgW, height: imgH, data: dataDark } as ImageData,
      x,
      y,
      size,
      alphaMap
    );
    expect(estimatedWeak).toBeCloseTo(0.60, 1);

    // Test with gain = 1.00 on a midtone background (value = 60)
    const dataMid = new Uint8ClampedArray(imgW * imgH * 4).fill(60);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const a = alphaMap[r * size + c] * 1.00;
        const idx = ((y + r) * imgW + (x + c)) * 4;
        const val = Math.round(60 * (1 - a) + 255 * a);
        dataMid[idx] = val;
        dataMid[idx + 1] = val;
        dataMid[idx + 2] = val;
        dataMid[idx + 3] = 255;
      }
    }

    const estimatedStandard = estimateGeminiAlphaGain(
      { width: imgW, height: imgH, data: dataMid } as ImageData,
      x,
      y,
      size,
      alphaMap
    );
    expect(estimatedStandard).toBeCloseTo(1.00, 1);
  });

  it("prevents pitch-black diamond underflow artifacts on dark night scenes (t >= 10s)", () => {
    const size = 48;
    const alphaMap = getEmbeddedAlphaMap(48)!;
    const imgW = 100;
    const imgH = 100;
    const x = 20;
    const y = 20;

    // Simulate dark night video scene with background luminance ~10
    const data = new Uint8ClampedArray(imgW * imgH * 4).fill(10);
    // Composite watermark with 0.60 gain (Veo dark/extended mode)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const a = alphaMap[r * size + c] * 0.60;
        const idx = ((y + r) * imgW + (x + c)) * 4;
        const val = Math.round(10 * (1 - a) + 255 * a);
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const imgData = { width: imgW, height: imgH, data } as ImageData;
    inpaintImageData(
      imgData,
      { x, y, width: size, height: size },
      { platformId: "gemini" }
    );

    // Verify zero pixels became pure (0,0,0) black diamond hole
    let pureBlackCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const idx = ((y + r) * imgW + (x + c)) * 4;
        if (data[idx] === 0 && data[idx + 1] === 0 && data[idx + 2] === 0) {
          pureBlackCount++;
        }
      }
    }

    expect(pureBlackCount).toBe(0);
    // Core of diamond should be restored close to ambient background (10)
    const centerIdx = ((y + 24) * imgW + (x + 24)) * 4;
    expect(data[centerIdx]).toBeGreaterThanOrEqual(8);
    expect(data[centerIdx]).toBeLessThanOrEqual(14);
  });
});
