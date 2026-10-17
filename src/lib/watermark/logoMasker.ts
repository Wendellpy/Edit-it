/**
 * BolSub Studio Intelligent Logo Mask Generator & Multi-Frame Temporal Segmenter
 * Extracts the exact shape silhouette of an AI watermark (letters, sparkles, icons)
 * so that ONLY the logo itself is inpainted, leaving innocent background pixels intact.
 */

import type { PixelROI, WatermarkPresetId, LearnedLogoData } from "./types";
import {
  AI_WATERMARK_DATASET,
  computeTemplateCorrelation,
  resizeMaskBilinear,
  saveLearnedLogoProfile,
  getLearnedLogoProfile,
} from "./logoDataset";

export interface LogoMaskResult {
  mask: Uint8Array;       // Length = width * height, values 0 (background) to 255 (logo)
  width: number;
  height: number;
  coverageRatio: number;  // Ratio of pixels marked as watermark (0.0 to 1.0)
  detectedPlatform?: WatermarkPresetId;
  confidence: number;
}

/**
 * Extracts a shape-accurate binary/alpha mask of the watermark inside a pixel ROI
 * using edge gradients, luminance thresholding, AI shape footprint priors, and morphological dilation.
 */
export function generateWatermarkMask(
  imageData: ImageData,
  pixelRoi: PixelROI,
  platformId?: WatermarkPresetId,
  sensitivity: number = 0.5 // 0.0 to 1.0
): LogoMaskResult {
  const { width: imgW, height: imgH, data } = imageData;
  const { x: rx, y: ry, width: rw, height: rh } = pixelRoi;

  const clampedX = Math.max(0, Math.min(imgW - 1, rx));
  const clampedY = Math.max(0, Math.min(imgH - 1, ry));
  const clampedW = Math.max(1, Math.min(imgW - clampedX, rw));
  const clampedH = Math.max(1, Math.min(imgH - clampedY, rh));

  const mask = new Uint8Array(clampedW * clampedH);

  // Sample outer perimeter background mean and variance
  let bgLumaSum = 0;
  let bgSamples = 0;

  // Sample outer ring (top, bottom, left, right borders)
  for (let c = 0; c < clampedW; c++) {
    const topY = Math.max(0, clampedY - 2);
    const botY = Math.min(imgH - 1, clampedY + clampedH + 1);
    const topIdx = (topY * imgW + (clampedX + c)) * 4;
    const botIdx = (botY * imgW + (clampedX + c)) * 4;
    bgLumaSum += 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
    bgLumaSum += 0.299 * data[botIdx] + 0.587 * data[botIdx + 1] + 0.114 * data[botIdx + 2];
    bgSamples += 2;
  }

  const bgMeanLuma = bgSamples > 0 ? bgLumaSum / bgSamples : 128;
  const presetConfig = platformId && platformId !== "custom" ? AI_WATERMARK_DATASET[platformId] : null;

  // Check if a learned profile exists from multi-clip training or fallback to dataset footprint
  const learnedProfile = platformId && platformId !== "custom" ? getLearnedLogoProfile(platformId) : null;
  const glyphMatrix16 = learnedProfile ? learnedProfile.normalizedMask : presetConfig?.glyphMatrix16;
  const shapePrior = glyphMatrix16 ? resizeMaskBilinear(glyphMatrix16, clampedW, clampedH) : null;

  // Adaptive threshold based on platform profile and sensitivity
  const minLumaThreshold = presetConfig
    ? presetConfig.colorProfile.primaryLumRange[0] * (1 - (sensitivity - 0.5) * 0.4)
    : Math.max(140, bgMeanLuma + 30);

  let logoPixelCount = 0;

  // 1. Foreground segmentation with AI Shape Footprint guidance
  for (let row = 0; row < clampedH; row++) {
    for (let col = 0; col < clampedW; col++) {
      const curX = clampedX + col;
      const curY = clampedY + row;
      const idx = (curY * imgW + curX) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // Local edge contrast (Sobel-like difference with neighbors)
      let isEdge = false;
      let edgeStrength = 0;
      if (col > 0 && col < clampedW - 1 && row > 0 && row < clampedH - 1) {
        const leftIdx = (curY * imgW + (curX - 1)) * 4;
        const rightIdx = (curY * imgW + (curX + 1)) * 4;
        const topIdx = ((curY - 1) * imgW + curX) * 4;
        const botIdx = ((curY + 1) * imgW + curX) * 4;

        const dX = Math.abs(data[rightIdx] - data[leftIdx]);
        const dY = Math.abs(data[botIdx] - data[topIdx]);
        edgeStrength = Math.max(dX, dY);
        if (dX > 32 || dY > 32) isEdge = true;
      }

      // Check for chromatic aberration (TikTok signature cyan/magenta fringe)
      let isGlitch = false;
      if (presetConfig?.chromaticGlitch) {
        const cyanMagentaDiff = Math.abs((g + b) / 2 - r);
        if (cyanMagentaDiff > 35) isGlitch = true;
      }

      const mIdx = row * clampedW + col;
      const priorWeight = shapePrior ? shapePrior[mIdx] / 255 : 0;

      // AI Shape Learning: If the pixel strongly correlates with the AI model's logo footprint
      if (priorWeight > 0.45 && (luma > bgMeanLuma + 10 || isEdge)) {
        mask[mIdx] = 255;
        logoPixelCount++;
      } else if (priorWeight > 0.18 && (isEdge || luma > minLumaThreshold || luma > bgMeanLuma + 8)) {
        mask[mIdx] = 230;
        logoPixelCount++;
      } else if (shapePrior) {
        // When an AI shape prior exists, strictly protect innocent background/HUD text outside the logo
        if (priorWeight > 0.08 && ((luma >= minLumaThreshold && isEdge) || (luma >= 220) || isGlitch)) {
          mask[mIdx] = 255;
          logoPixelCount++;
        } else {
          mask[mIdx] = 0;
        }
      } else if ((luma >= minLumaThreshold && isEdge) || (luma >= 220) || isGlitch) {
        // Fallback for general unmodeled watermarks
        mask[mIdx] = 255;
        logoPixelCount++;
      } else if (luma > bgMeanLuma + 45 && edgeStrength > 20) {
        mask[mIdx] = 180;
        logoPixelCount++;
      } else {
        mask[mIdx] = 0;
      }
    }
  }

  // 2. Morphological Dilation pass: Expands mask by 1 pixel to capture antialiased glyph borders
  const dilatedMask = new Uint8Array(mask.length);
  const radius = presetConfig?.shapeType === "sparkle_star" ? 1 : 2;

  for (let row = 0; row < clampedH; row++) {
    for (let col = 0; col < clampedW; col++) {
      const mIdx = row * clampedW + col;
      let maxVal = mask[mIdx];

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = row + dy;
        if (ny < 0 || ny >= clampedH) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = col + dx;
          if (nx < 0 || nx >= clampedW) continue;
          if (dx * dx + dy * dy <= radius * radius) {
            const nVal = mask[ny * clampedW + nx];
            if (nVal > maxVal) maxVal = nVal;
          }
        }
      }

      dilatedMask[mIdx] = maxVal;
    }
  }

  const coverageRatio = logoPixelCount / (clampedW * clampedH);

  // If the mask is completely empty (no edges or bright pixels found), fall back to whole box
  if (logoPixelCount < 4 || coverageRatio < 0.005) {
    dilatedMask.fill(255);
  }

  return {
    mask: dilatedMask,
    width: clampedW,
    height: clampedH,
    coverageRatio,
    detectedPlatform: platformId,
    confidence: coverageRatio > 0.05 && coverageRatio < 0.65 ? 0.94 : 0.70,
  };
}

/**
 * Multi-Clip & Multi-Frame Temporal Watermark Extractor.
 * Given sampled frame image buffers across a video clip, detects the temporally static
 * watermark silhouette by computing pixel variance across time.
 */
export function extractTemporalWatermarkMask(
  frames: ImageData[],
  pixelRoi: PixelROI
): LogoMaskResult {
  if (!frames || frames.length === 0) {
    return {
      mask: new Uint8Array(pixelRoi.width * pixelRoi.height).fill(255),
      width: pixelRoi.width,
      height: pixelRoi.height,
      coverageRatio: 1.0,
      confidence: 0.5,
    };
  }

  const { width: imgW, height: imgH } = frames[0];
  const { x: rx, y: ry, width: rw, height: rh } = pixelRoi;

  const clampedX = Math.max(0, Math.min(imgW - 1, rx));
  const clampedY = Math.max(0, Math.min(imgH - 1, ry));
  const clampedW = Math.max(1, Math.min(imgW - clampedX, rw));
  const clampedH = Math.max(1, Math.min(imgH - clampedY, rh));

  const numFrames = frames.length;
  const mask = new Uint8Array(clampedW * clampedH);

  let staticCount = 0;

  // For each pixel in the ROI, evaluate temporal standard deviation
  for (let row = 0; row < clampedH; row++) {
    for (let col = 0; col < clampedW; col++) {
      const curX = clampedX + col;
      const curY = clampedY + row;

      let sumLuma = 0;
      let sumLumaSq = 0;

      for (let f = 0; f < numFrames; f++) {
        const idx = (curY * imgW + curX) * 4;
        const data = frames[f].data;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        sumLuma += luma;
        sumLumaSq += luma * luma;
      }

      const mean = sumLuma / numFrames;
      const variance = Math.max(0, (sumLumaSq / numFrames) - (mean * mean));
      const stdDev = Math.sqrt(variance);

      const mIdx = row * clampedW + col;

      // In real video, background pixels fluctuate (stdDev > 10)
      // Watermark pixels remain static across frames with low variance
      if (stdDev < 9.0 && (mean > 55 || stdDev < 4.0)) {
        mask[mIdx] = 255;
        staticCount++;
      } else {
        mask[mIdx] = 0;
      }
    }
  }

  const coverageRatio = staticCount / (clampedW * clampedH);

  // If no static pixels were found, fallback safely without filling the entire frame
  if (staticCount < 4) {
    // Sparse fallback: leave mask empty so innocent content is not wiped
    mask.fill(0);
  }

  return {
    mask,
    width: clampedW,
    height: clampedH,
    coverageRatio,
    confidence: coverageRatio >= 0.02 && coverageRatio <= 0.65 ? 0.96 : 0.70,
  };
}

/**
 * Learns the AI watermark signature by analyzing multiple video frames or clips.
 * Computes temporal variance across frames, correlates the static patch against
 * the AI Logo dataset to classify which AI generator produced it, and returns
 * a refined LearnedLogoData profile along with the crisp extracted mask.
 */
export function learnWatermarkFromClips(
  frames: ImageData[],
  pixelRoi: PixelROI,
  platformHint?: WatermarkPresetId
): {
  maskResult: LogoMaskResult;
  learnedProfile: LearnedLogoData;
} {
  const maskResult = extractTemporalWatermarkMask(frames, pixelRoi);
  const { width: mw, height: mh, mask } = maskResult;

  // Downsample the extracted mask to a 16x16 normalized matrix (256 items)
  const norm16: number[] = new Array(256).fill(0);
  for (let dy = 0; dy < 16; dy++) {
    const sy0 = Math.floor((dy / 16) * mh);
    const sy1 = Math.min(mh, Math.floor(((dy + 1) / 16) * mh));
    for (let dx = 0; dx < 16; dx++) {
      const sx0 = Math.floor((dx / 16) * mw);
      const sx1 = Math.min(mw, Math.floor(((dx + 1) / 16) * mw));

      let sum = 0, count = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          sum += mask[y * mw + x];
          count++;
        }
      }
      norm16[dy * 16 + dx] = count > 0 ? (sum / (count * 255)) : 0;
    }
  }

  // Correlate 16x16 patch against all AI Logo Dataset entries to identify the AI
  let bestPreset: WatermarkPresetId = platformHint && platformHint !== "custom" ? platformHint : "gemini";
  let bestScore = -1;

  for (const presetKey of Object.keys(AI_WATERMARK_DATASET) as WatermarkPresetId[]) {
    if (presetKey === "custom") continue;
    const entry = AI_WATERMARK_DATASET[presetKey];
    const score = computeTemplateCorrelation(norm16, entry.glyphMatrix16);
    if (score > bestScore) {
      bestScore = score;
      bestPreset = presetKey;
    }
  }

  const matchedEntry = AI_WATERMARK_DATASET[bestPreset];
  const learnedProfile: LearnedLogoData = {
    presetId: bestPreset,
    platformName: matchedEntry ? matchedEntry.name : "Custom AI",
    shapeType: matchedEntry ? matchedEntry.shapeType : "sparkle_star",
    sampleCount: frames.length,
    clipCount: 1,
    extractedAt: new Date().toISOString(),
    normalizedMask: norm16,
    coverageRatio: maskResult.coverageRatio,
    detectedRatioLabel: `${mw}x${mh} ROI (${Math.round(maskResult.coverageRatio * 100)}% coverage)`,
  };

  // Only persist learned profile if the extracted mask has a realistic logo coverage (1% to 65%)
  if (maskResult.coverageRatio >= 0.01 && maskResult.coverageRatio <= 0.65) {
    saveLearnedLogoProfile(learnedProfile);
  }

  return {
    maskResult: {
      ...maskResult,
      detectedPlatform: bestPreset,
      confidence: Math.max(0.75, Math.min(0.99, 0.70 + Math.max(0, bestScore) * 0.28)),
    },
    learnedProfile,
  };
}
