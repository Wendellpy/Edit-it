/**
 * BolSub Studio - Reverse Alpha Blending Engine
 * Lossless mathematical inversion of alpha compositing for Google Gemini / Veo watermarks.
 * 
 * Blending formula:
 *   watermarked = α * logo + (1 - α) * original
 * Inversion formula:
 *   original = (watermarked - α * logo) / (1 - α)
 */

export interface ReverseBlendOptions {
  alphaGain?: number;
  logoValue?: number;
  noiseFloor?: number;
  maxAlpha?: number;
}

const DEFAULT_ALPHA_NOISE_FLOOR = 3 / 255; // Quantization noise threshold
const DEFAULT_ALPHA_THRESHOLD = 0.002;
const DEFAULT_MAX_ALPHA = 0.99;
const DEFAULT_LOGO_VALUE = 255; // White watermark

/**
 * Removes a watermark from an ImageData buffer using Reverse Alpha Blending in-place.
 */
export function reverseAlphaBlend(
  imageData: ImageData,
  alphaMap: Float32Array,
  position: { x: number; y: number; width: number; height: number },
  options: ReverseBlendOptions = {}
): void {
  const { width: imgW, height: imgH, data } = imageData;
  const { x, y, width: w, height: h } = position;

  const alphaGain = Number.isFinite(options.alphaGain) && options.alphaGain! > 0
    ? options.alphaGain!
    : 1.0;
  const logoValue = Number.isFinite(options.logoValue) ? options.logoValue! : DEFAULT_LOGO_VALUE;
  const noiseFloor = options.noiseFloor ?? DEFAULT_ALPHA_NOISE_FLOOR;
  const maxAlpha = options.maxAlpha ?? DEFAULT_MAX_ALPHA;

  // Process only valid bounds within the image
  const startRow = Math.max(0, -y);
  const endRow = Math.min(h, imgH - y);
  const startCol = Math.max(0, -x);
  const endCol = Math.min(w, imgW - x);

  for (let row = startRow; row < endRow; row++) {
    const curY = y + row;
    const rowOffset = curY * imgW;
    const alphaRowOffset = row * w;

    for (let col = startCol; col < endCol; col++) {
      const curX = x + col;
      const alphaIdx = alphaRowOffset + col;
      const rawAlpha = alphaMap[alphaIdx];
      const alphaMag = Math.abs(rawAlpha);

      // Noise floor suppression to preserve innocent dark background pixels
      const signalAlpha = Math.max(0, alphaMag - noiseFloor) * alphaGain;
      if (signalAlpha < DEFAULT_ALPHA_THRESHOLD) {
        continue;
      }

      const alpha = Math.min(alphaMag * alphaGain, maxAlpha);
      const oneMinusAlpha = 1.0 - alpha;
      const alphaTimesLogo = alpha * (rawAlpha < 0 ? 0 : logoValue);

      const imgIdx = (rowOffset + curX) * 4;

      // Invert RGB channels
      for (let c = 0; c < 3; c++) {
        const watermarked = data[imgIdx + c];
        const original = (watermarked - alphaTimesLogo) / oneMinusAlpha;
        data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
      }
      // Alpha channel data[imgIdx + 3] remains unchanged
    }
  }
}
