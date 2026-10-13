import type {
  SegmentationConfig,
  SubjectMetrics,
  SubjectBoundingBox,
  HeadRegion,
} from "./types";

/**
 * Temporal smoothing across consecutive frames using exponential moving average.
 * Eliminates high-frequency boundary jitter / edge flicker.
 */
export function applyTemporalSmoothing(
  currentMask: Uint8Array,
  previousMask: Uint8Array | null,
  alpha: number
): Uint8Array {
  if (!previousMask || previousMask.length !== currentMask.length || alpha <= 0) {
    return new Uint8Array(currentMask);
  }

  const length = currentMask.length;
  const smoothed = new Uint8Array(length);
  const clampedAlpha = Math.min(0.95, Math.max(0.0, alpha));
  const currentWeight = 1.0 - clampedAlpha;

  for (let i = 0; i < length; i++) {
    smoothed[i] = Math.round(
      clampedAlpha * previousMask[i] + currentWeight * currentMask[i]
    );
  }

  return smoothed;
}

/**
 * Morphological dilation (expand) or erosion (contract) of the binary/alpha mask.
 * positive deltaPx -> Expands mask outward
 * negative deltaPx -> Contracts mask inward
 */
export function applyExpandContract(
  mask: Uint8Array,
  width: number,
  height: number,
  deltaPx: number
): Uint8Array {
  if (deltaPx === 0) return new Uint8Array(mask);

  const radius = Math.min(10, Math.abs(Math.round(deltaPx)));
  const isExpand = deltaPx > 0;
  const output = new Uint8Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let targetVal = isExpand ? 0 : 255;

      const minX = Math.max(0, x - radius);
      const maxX = Math.min(width - 1, x + radius);
      const minY = Math.max(0, y - radius);
      const maxY = Math.min(height - 1, y + radius);

      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const val = mask[ny * width + nx];
          if (isExpand) {
            if (val > targetVal) targetVal = val;
          } else {
            if (val < targetVal) targetVal = val;
          }
        }
      }

      output[y * width + x] = targetVal;
    }
  }

  return output;
}

/**
 * Two-pass separable box/Gaussian feathering to produce organic, natural edges.
 */
export function applyFeather(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const r = Math.min(15, Math.max(0, Math.round(radius)));
  if (r === 0) return new Uint8Array(mask);

  const temp = new Float32Array(width * height);
  const output = new Uint8Array(width * height);
  const windowSize = 2 * r + 1;

  // Horizontal blur pass
  for (let y = 0; y < height; y++) {
    let windowSum = 0;
    const rowOffset = y * width;

    // Seed initial window
    for (let x = -r; x <= r; x++) {
      const sampleX = Math.max(0, Math.min(width - 1, x));
      windowSum += mask[rowOffset + sampleX];
    }

    for (let x = 0; x < width; x++) {
      temp[rowOffset + x] = windowSum / windowSize;

      const leftX = Math.max(0, x - r);
      const rightX = Math.min(width - 1, x + r + 1);
      windowSum += mask[rowOffset + rightX] - mask[rowOffset + leftX];
    }
  }

  // Vertical blur pass
  for (let x = 0; x < width; x++) {
    let windowSum = 0;

    for (let y = -r; y <= r; y++) {
      const sampleY = Math.max(0, Math.min(height - 1, y));
      windowSum += temp[sampleY * width + x];
    }

    for (let y = 0; y < height; y++) {
      output[y * width + x] = Math.min(255, Math.max(0, Math.round(windowSum / windowSize)));

      const topY = Math.max(0, y - r);
      const bottomY = Math.min(height - 1, y + r + 1);
      windowSum += temp[bottomY * width + x] - temp[topY * width + x];
    }
  }

  return output;
}

/**
 * Computes rule-based subject metrics, bounding box, and head region from the mask.
 */
export function computeSubjectMetrics(
  mask: Uint8Array,
  width: number,
  height: number
): SubjectMetrics {
  const totalPixels = width * height;
  let foregroundCount = 0;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  // Track vertical centroid and head estimate
  let weightedHeadX = 0;
  let headPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = mask[y * width + x];
      if (alpha >= 128) {
        foregroundCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const coveragePercent = Math.round((foregroundCount / totalPixels) * 1000) / 10;
  const hasSubject = coveragePercent >= 1.5; // At least 1.5% of frame has person

  if (!hasSubject || minX > maxX || minY > maxY) {
    return {
      hasSubject: false,
      confidence: 0,
      coveragePercent: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      headRegion: { centerX: 0.5, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
      subjectCount: 0,
      isLeavingFrame: false,
    };
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // Head region is estimated in the upper 35% of the subject's vertical span
  const headCutoffY = minY + boxH * 0.35;
  for (let y = minY; y <= headCutoffY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * width + x] >= 128) {
        weightedHeadX += x;
        headPixels++;
      }
    }
  }

  const headCenterX = headPixels > 0 ? weightedHeadX / headPixels / width : (minX + boxW / 2) / width;
  const headCenterY = (minY + boxH * 0.18) / height;

  const boundingBox: SubjectBoundingBox = {
    x: minX / width,
    y: minY / height,
    width: boxW / width,
    height: boxH / height,
  };

  const headRegion: HeadRegion = {
    centerX: headCenterX,
    centerY: headCenterY,
    radiusX: (boxW / width) * 0.32,
    radiusY: (boxH / height) * 0.18,
  };

  // Detect if person is touching frame boundary (leaving frame)
  const isLeavingFrame = minX <= 2 || maxX >= width - 3;

  return {
    hasSubject: true,
    confidence: Math.min(1.0, Math.max(0.6, coveragePercent / 20)),
    coveragePercent,
    boundingBox,
    headRegion,
    subjectCount: 1,
    isLeavingFrame,
  };
}

/**
 * Bilinear mask upsampler to scale masks from inference resolution (e.g. 384x512)
 * to full video preview/export canvas resolution.
 */
export function upsampleMaskBilinear(
  srcMask: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  if (srcW === dstW && srcH === dstH) {
    return new Uint8Array(srcMask);
  }

  const dest = new Uint8Array(dstW * dstH);
  const xRatio = (srcW - 1) / Math.max(1, dstW - 1);
  const yRatio = (srcH - 1) / Math.max(1, dstH - 1);

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const yFrac = sy - y0;

    const row0 = y0 * srcW;
    const row1 = y1 * srcW;
    const destRow = dy * dstW;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const xFrac = sx - x0;

      const p00 = srcMask[row0 + x0];
      const p10 = srcMask[row0 + x1];
      const p01 = srcMask[row1 + x0];
      const p11 = srcMask[row1 + x1];

      const top = p00 + (p10 - p00) * xFrac;
      const bottom = p01 + (p11 - p01) * xFrac;
      const val = Math.round(top + (bottom - top) * yFrac);

      dest[destRow + dx] = Math.min(255, Math.max(0, val));
    }
  }

  return dest;
}

/**
 * Complete post-processing pipeline for a single segmentation frame.
 */
export function postProcessMask(
  rawMask: Uint8Array,
  width: number,
  height: number,
  prevMask: Uint8Array | null,
  config: SegmentationConfig
): { mask: Uint8Array; metrics: SubjectMetrics } {
  // 1. Temporal Smoothing
  let processed = applyTemporalSmoothing(
    rawMask,
    prevMask,
    config.temporalSmoothingAlpha
  );

  // 2. Expand / Contract
  if (config.expandContractPx !== 0) {
    processed = applyExpandContract(processed, width, height, config.expandContractPx);
  }

  // 3. Feathering
  if (config.featherRadius > 0) {
    processed = applyFeather(processed, width, height, config.featherRadius);
  }

  // 4. Compute Metrics
  const metrics = computeSubjectMetrics(processed, width, height);

  return { mask: processed, metrics };
}
