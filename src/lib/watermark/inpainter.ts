/**
 * BolSub Studio High-Fidelity Content-Aware Watermark Inpainting Engine
 * 100% on-device spatial interpolation with harmonic gradient boundary propagation,
 * bilateral edge feathering, and natural noise matching.
 */

import type { NormalizedROI, PixelROI, InpaintOptions } from "./types";
import { generateWatermarkMask } from "./logoMasker";
import { resolveGeminiWatermarkConfig, refineGeminiPosition } from "./geminiAlphaMaps";
import { reverseAlphaBlend } from "./reverseAlphaBlend";

/**
 * Clamps a normalized ROI strictly within [0, 1] bounds and ensures positive dimensions.
 */
export function clampNormalizedROI(roi: NormalizedROI): NormalizedROI {
  const x = Math.max(0, Math.min(0.99, roi.x));
  const y = Math.max(0, Math.min(0.99, roi.y));
  const width = Math.max(0.01, Math.min(1 - x, roi.width));
  const height = Math.max(0.01, Math.min(1 - y, roi.height));

  return {
    id: roi.id,
    name: roi.name,
    x,
    y,
    width,
    height,
  };
}

/**
 * Converts a normalized ROI (0..1) to integer pixel coordinates for a given frame dimension.
 */
export function denormalizeROI(
  roi: NormalizedROI,
  frameWidth: number,
  frameHeight: number
): PixelROI {
  const clamped = clampNormalizedROI(roi);
  const x = Math.max(0, Math.floor(clamped.x * frameWidth));
  const y = Math.max(0, Math.floor(clamped.y * frameHeight));
  const width = Math.max(4, Math.min(frameWidth - x, Math.round(clamped.width * frameWidth)));
  const height = Math.max(4, Math.min(frameHeight - y, Math.round(clamped.height * frameHeight)));

  return { x, y, width, height };
}

/**
 * Converts integer pixel coordinates to normalized ROI (0..1).
 */
export function normalizeROI(
  pixelRoi: PixelROI,
  frameWidth: number,
  frameHeight: number,
  meta?: { id?: string; name?: string }
): NormalizedROI {
  if (frameWidth <= 0 || frameHeight <= 0) {
    return { id: meta?.id, name: meta?.name, x: 0, y: 0, width: 0.1, height: 0.1 };
  }

  const x = Math.max(0, Math.min(1, pixelRoi.x / frameWidth));
  const y = Math.max(0, Math.min(1, pixelRoi.y / frameHeight));
  const width = Math.max(0.01, Math.min(1 - x, pixelRoi.width / frameWidth));
  const height = Math.max(0.01, Math.min(1 - y, pixelRoi.height / frameHeight));

  return {
    id: meta?.id,
    name: meta?.name,
    x,
    y,
    width,
    height,
  };
}

/**
 * Fast Pseudo-random generator with seed for deterministic grain injection.
 */
function fastRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Suppresses boundary outlier spikes (e.g. innocent text or HUD borders touching the ROI)
 * so that they do not cast linear horizontal/vertical streaks across the inpainting patch.
 */
function cleanBorderOutliers(border: Float32Array, count: number, threshold: number = 30): void {
  if (count <= 3) return;
  const lumas = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    lumas[i] = 0.299 * border[i * 3] + 0.587 * border[i * 3 + 1] + 0.114 * border[i * 3 + 2];
  }
  const sorted = Array.from(lumas).sort((a, b) => a - b);
  const medLuma = sorted[Math.floor(count / 2)];

  // Compute median ambient RGB from samples near median luminance
  let medR = 0, medG = 0, medB = 0, medCount = 0;
  for (let i = 0; i < count; i++) {
    if (Math.abs(lumas[i] - medLuma) <= 16) {
      medR += border[i * 3];
      medG += border[i * 3 + 1];
      medB += border[i * 3 + 2];
      medCount++;
    }
  }
  if (medCount === 0) {
    medR = border[0];
    medG = border[1];
    medB = border[2];
    medCount = 1;
  }
  const avgMedR = medR / medCount;
  const avgMedG = medG / medCount;
  const avgMedB = medB / medCount;

  for (let i = 0; i < count; i++) {
    if (Math.abs(lumas[i] - medLuma) > threshold) {
      border[i * 3] = avgMedR;
      border[i * 3 + 1] = avgMedG;
      border[i * 3 + 2] = avgMedB;
    }
  }
}

/**
 * Inpaints a rectangular region on an ImageData buffer using harmonic boundary interpolation,
 * edge feathering, and optional grain matching.
 */
export function inpaintImageData(
  imageData: ImageData,
  pixelRoi: PixelROI,
  options: InpaintOptions = {},
  explicitMask?: Uint8Array | null
): void {
  const { width: imgW, height: imgH, data } = imageData;
  const { x: rx, y: ry, width: rw, height: rh } = pixelRoi;

  // Boundary safety checks
  if (rx >= imgW || ry >= imgH || rw <= 0 || rh <= 0) return;
  const clampedX = Math.max(0, rx);
  const clampedY = Math.max(0, ry);
  const clampedW = Math.min(rw, imgW - clampedX);
  const clampedH = Math.min(rh, imgH - clampedY);

  if (clampedW < 2 || clampedH < 2) return;
  // 0. High-Fidelity Reverse Alpha Blending for Google Gemini / Veo:
  // Mathematically inverts Google's alpha compositing formula, recovering the original
  // pixels underneath the watermark (HUD text, textures, details) with zero smearing or erasure.
  if (options.platformId === "gemini") {
    const config = resolveGeminiWatermarkConfig(imgW, imgH);

    let targetX = config.x;
    let targetY = config.y;
    const targetSize = config.logoSize;

    // Check if pixelRoi roughly encloses the catalog position
    const enclosesCatalog =
      clampedX <= targetX + 16 &&
      clampedX + clampedW >= targetX + targetSize - 16 &&
      clampedY <= targetY + 16 &&
      clampedY + clampedH >= targetY + targetSize - 16;

    if (!enclosesCatalog && clampedW >= 24 && clampedH >= 24) {
      targetX = Math.round(clampedX + (clampedW - targetSize) / 2);
      targetY = Math.round(clampedY + (clampedH - targetSize) / 2);
    } else {
      // Refine position around catalog anchor with normalized cross-correlation
      const refined = refineGeminiPosition(imageData, {
        ...config,
        x: targetX,
        y: targetY,
      }, 10);
      targetX = refined.x;
      targetY = refined.y;
    }

    reverseAlphaBlend(
      imageData,
      config.alphaMap,
      { x: targetX, y: targetY, width: targetSize, height: targetSize },
      { alphaGain: config.alphaGain }
    );

    // Post-pass: eliminate video compression / DCT ringing around diamond perimeter
    const mapLen = targetSize;
    for (let r = 0; r < mapLen; r++) {
      for (let c = 0; c < mapLen; c++) {
        const aVal = config.alphaMap[r * mapLen + c];
        if (aVal > 0.02 && aVal < 0.48) {
          const cy = targetY + r;
          const cx = targetX + c;
          if (cy >= 0 && cy < imgH && cx >= 0 && cx < imgW) {
            const nbrsR: number[] = [];
            const nbrsG: number[] = [];
            const nbrsB: number[] = [];
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const ny = cy + dy;
                const nx = cx + dx;
                if (ny >= 0 && ny < imgH && nx >= 0 && nx < imgW) {
                  const idx = (ny * imgW + nx) * 4;
                  nbrsR.push(data[idx]);
                  nbrsG.push(data[idx + 1]);
                  nbrsB.push(data[idx + 2]);
                }
              }
            }
            nbrsR.sort((a, b) => a - b);
            nbrsG.sort((a, b) => a - b);
            nbrsB.sort((a, b) => a - b);
            const medIdx = Math.floor(nbrsR.length / 2);
            const curIdx = (cy * imgW + cx) * 4;
            data[curIdx] = nbrsR[medIdx];
            data[curIdx + 1] = nbrsG[medIdx];
            data[curIdx + 2] = nbrsB[medIdx];
          }
        }
      }
    }
    return;
  }

  // Generate logo shape mask if shape mask is requested (default true)
  let mask: Uint8Array | null = explicitMask ?? null;
  if (!mask && options.useShapeMask !== false) {
    const maskResult = generateWatermarkMask(
      imageData,
      { x: clampedX, y: clampedY, width: clampedW, height: clampedH },
      options.platformId,
      options.maskSensitivity ?? 0.50
    );
    mask = maskResult.mask;
  }

  const feather = Math.max(0, Math.min(Math.min(clampedW, clampedH) / 2, options.featherRadius ?? 6));
  const blendStrength = Math.max(0, Math.min(1, options.blendStrength ?? 1.0));
  const preserveGrain = options.preserveGrain ?? true;
  const grainAmount = options.grainAmount ?? 0.12;

  // 1. Sample surrounding boundary perimeter (top, bottom, left, right borders)
  const borderWidth = Math.max(2, Math.min(12, Math.floor(feather + 2)));

  // Arrays to hold sampled boundary colors
  // Top: array of length clampedW, each entry [r, g, b]
  const topBorder = new Float32Array(clampedW * 3);
  const bottomBorder = new Float32Array(clampedW * 3);
  const leftBorder = new Float32Array(clampedH * 3);
  const rightBorder = new Float32Array(clampedH * 3);

  // Measure ambient variance (film grain) from outer perimeter
  let sumLuma = 0;
  let sumLumaSq = 0;
  let sampleCount = 0;

  // Sample top boundary
  for (let col = 0; col < clampedW; col++) {
    const curX = clampedX + col;
    let r = 0, g = 0, b = 0, count = 0;
    for (let bw = 1; bw <= borderWidth; bw++) {
      const sampleY = Math.max(0, clampedY - bw);
      const idx = (sampleY * imgW + curX) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;

      const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sumLuma += luma;
      sumLumaSq += luma * luma;
      sampleCount++;
    }
    const o = col * 3;
    topBorder[o] = r / count;
    topBorder[o + 1] = g / count;
    topBorder[o + 2] = b / count;
  }

  // Sample bottom boundary
  for (let col = 0; col < clampedW; col++) {
    const curX = clampedX + col;
    let r = 0, g = 0, b = 0, count = 0;
    for (let bw = 1; bw <= borderWidth; bw++) {
      const sampleY = Math.min(imgH - 1, clampedY + clampedH - 1 + bw);
      const idx = (sampleY * imgW + curX) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;

      const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sumLuma += luma;
      sumLumaSq += luma * luma;
      sampleCount++;
    }
    const o = col * 3;
    bottomBorder[o] = r / count;
    bottomBorder[o + 1] = g / count;
    bottomBorder[o + 2] = b / count;
  }

  // Sample left boundary
  for (let row = 0; row < clampedH; row++) {
    const curY = clampedY + row;
    let r = 0, g = 0, b = 0, count = 0;
    for (let bw = 1; bw <= borderWidth; bw++) {
      const sampleX = Math.max(0, clampedX - bw);
      const idx = (curY * imgW + sampleX) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
    const o = row * 3;
    leftBorder[o] = r / count;
    leftBorder[o + 1] = g / count;
    leftBorder[o + 2] = b / count;
  }

  // Sample right boundary
  for (let row = 0; row < clampedH; row++) {
    const curY = clampedY + row;
    let r = 0, g = 0, b = 0, count = 0;
    for (let bw = 1; bw <= borderWidth; bw++) {
      const sampleX = Math.min(imgW - 1, clampedX + clampedW - 1 + bw);
      const idx = (curY * imgW + sampleX) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
    const o = row * 3;
    rightBorder[o] = r / count;
    rightBorder[o + 1] = g / count;
    rightBorder[o + 2] = b / count;
  }

  // Filter out boundary spikes (text, icons, HUD borders touching ROI) to prevent directional streaks
  cleanBorderOutliers(topBorder, clampedW, 30);
  cleanBorderOutliers(bottomBorder, clampedW, 30);
  cleanBorderOutliers(leftBorder, clampedH, 30);
  cleanBorderOutliers(rightBorder, clampedH, 30);

  // Compute ambient standard deviation for grain matching
  let ambientStdDev = 6.0;
  if (sampleCount > 10) {
    const mean = sumLuma / sampleCount;
    const variance = Math.max(0, (sumLumaSq / sampleCount) - (mean * mean));
    ambientStdDev = Math.min(22, Math.sqrt(variance));
  }

  // 2. Harmonic spatial interpolation pass
  const tempPatch = new Float32Array(clampedW * clampedH * 3);

  for (let row = 0; row < clampedH; row++) {
    const vWeight = clampedH > 1 ? row / (clampedH - 1) : 0.5;
    const invVWeight = 1 - vWeight;
    const dTop = row + 1;
    const dBottom = clampedH - row;

    const leftR = leftBorder[row * 3];
    const leftG = leftBorder[row * 3 + 1];
    const leftB = leftBorder[row * 3 + 2];

    const rightR = rightBorder[row * 3];
    const rightG = rightBorder[row * 3 + 1];
    const rightB = rightBorder[row * 3 + 2];

    for (let col = 0; col < clampedW; col++) {
      const hWeight = clampedW > 1 ? col / (clampedW - 1) : 0.5;
      const invHWeight = 1 - hWeight;
      const dLeft = col + 1;
      const dRight = clampedW - col;

      // Horizontal linear interpolation between left and right boundary
      const horizR = invHWeight * leftR + hWeight * rightR;
      const horizG = invHWeight * leftG + hWeight * rightG;
      const horizB = invHWeight * leftB + hWeight * rightB;

      // Vertical linear interpolation between top and bottom boundary
      const topR = topBorder[col * 3];
      const topG = topBorder[col * 3 + 1];
      const topB = topBorder[col * 3 + 2];

      const bottomR = bottomBorder[col * 3];
      const bottomG = bottomBorder[col * 3 + 1];
      const bottomB = bottomBorder[col * 3 + 2];

      const vertR = invVWeight * topR + vWeight * bottomR;
      const vertG = invVWeight * topG + vWeight * bottomG;
      const vertB = invVWeight * topB + vWeight * bottomB;

      // Harmonic inverse-distance blend weights
      const wH = (1 / dLeft) + (1 / dRight);
      const wV = (1 / dTop) + (1 / dBottom);
      const sumW = wH + wV;

      const pIdx = (row * clampedW + col) * 3;
      tempPatch[pIdx] = (horizR * wH + vertR * wV) / sumW;
      tempPatch[pIdx + 1] = (horizG * wH + vertG * wV) / sumW;
      tempPatch[pIdx + 2] = (horizB * wH + vertB * wV) / sumW;
    }
  }

  // 3. Fast multi-pass bilateral smoothing on the inner patch to eliminate directional lines
  const smoothPatch = new Float32Array(tempPatch.length);
  for (let row = 0; row < clampedH; row++) {
    for (let col = 0; col < clampedW; col++) {
      const pIdx = (row * clampedW + col) * 3;

      let accR = 0, accG = 0, accB = 0, accW = 0;
      const win = 2; // 5x5 window
      for (let dy = -win; dy <= win; dy++) {
        const ny = Math.max(0, Math.min(clampedH - 1, row + dy));
        for (let dx = -win; dx <= win; dx++) {
          const nx = Math.max(0, Math.min(clampedW - 1, col + dx));
          const nIdx = (ny * clampedW + nx) * 3;

          const distSq = dx * dx + dy * dy;
          const spatialW = Math.exp(-distSq / 6);

          accR += tempPatch[nIdx] * spatialW;
          accG += tempPatch[nIdx + 1] * spatialW;
          accB += tempPatch[nIdx + 2] * spatialW;
          accW += spatialW;
        }
      }

      smoothPatch[pIdx] = accR / accW;
      smoothPatch[pIdx + 1] = accG / accW;
      smoothPatch[pIdx + 2] = accB / accW;
    }
  }

  // 4. Blend onto source image with perimeter cosine feathering & ambient grain
  let seed = 12345;
  for (let row = 0; row < clampedH; row++) {
    const curY = clampedY + row;
    const distY = Math.min(row, clampedH - 1 - row);

    for (let col = 0; col < clampedW; col++) {
      const curX = clampedX + col;
      const distX = Math.min(col, clampedW - 1 - col);
      const edgeDist = Math.min(distX, distY);

      let alpha = 1.0;
      if (!mask) {
        if (feather > 0 && edgeDist < feather) {
          const t = edgeDist / feather;
          alpha = t * t * (3 - 2 * t);
        }
      }
      alpha *= blendStrength;

      // Shape-aware logo masking: only inpaint actual watermark/logo pixels!
      if (mask) {
        const mVal = mask[row * clampedW + col];
        if (mVal <= 8) {
          // Innocent background pixel - leave completely untouched!
          continue;
        }
        alpha *= (mVal / 255);
      }

      const pIdx = (row * clampedW + col) * 3;
      let inpaintR = smoothPatch[pIdx];
      let inpaintG = smoothPatch[pIdx + 1];
      let inpaintB = smoothPatch[pIdx + 2];

      // Add matching ambient grain
      if (preserveGrain && grainAmount > 0) {
        seed = (seed * 9301 + 49297) % 233280;
        const randVal = (fastRand(seed + curX + curY * 17) - 0.5) * 2;
        const noise = randVal * ambientStdDev * grainAmount;

        inpaintR = Math.max(0, Math.min(255, inpaintR + noise));
        inpaintG = Math.max(0, Math.min(255, inpaintG + noise));
        inpaintB = Math.max(0, Math.min(255, inpaintB + noise));
      }

      const imgIdx = (curY * imgW + curX) * 4;
      const origR = data[imgIdx];
      const origG = data[imgIdx + 1];
      const origB = data[imgIdx + 2];

      data[imgIdx] = Math.round(origR * (1 - alpha) + inpaintR * alpha);
      data[imgIdx + 1] = Math.round(origG * (1 - alpha) + inpaintG * alpha);
      data[imgIdx + 2] = Math.round(origB * (1 - alpha) + inpaintB * alpha);
      // Keep alpha channel intact
    }
  }
}

/**
 * Inpaints multiple normalized ROIs directly on an HTMLCanvasElement rendering context.
 */
export function inpaintCanvasROIs(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  rois: NormalizedROI[],
  options: InpaintOptions = {},
  explicitMasks?: (Uint8Array | null)[]
): void {
  if (!rois || rois.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) return;

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  for (let i = 0; i < rois.length; i++) {
    const roi = rois[i];
    const pixelRoi = denormalizeROI(roi, canvasWidth, canvasHeight);
    const mask = explicitMasks && explicitMasks[i] ? explicitMasks[i] : undefined;
    inpaintImageData(imageData, pixelRoi, options, mask);
  }

  ctx.putImageData(imageData, 0, 0);
}
