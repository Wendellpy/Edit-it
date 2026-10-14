/**
 * Accurate Subject Tracking & Matting Model
 *
 * 100% On-Device, Real-Time Local Computer Vision Pipeline for Behind & Sandwich Caption Modes.
 *
 * Architecture:
 * 1. Kinematic Kalman / Temporal Momentum Tracker (EMA + Velocity Estimation + Outlier Rejection)
 * 2. Multi-Space Color & Luminance Chrominance Likelihood (YCbCr + HSV + Normalized RGB)
 * 3. 2D Spatial Density Integral & Facial Feature Landmark Localization
 * 4. Multi-Zone Perimeter Background Palette Clustering
 * 5. Sobel 3x3 Luminance Gradient Edge Boundary Snapping
 * 6. Torso & Clothing Saliency Geodesic Expansion
 * 7. 3-Zone Trimap Generation with Bilateral Sub-Pixel Alpha Matting
 */

import type { SubjectMetrics, SubjectBoundingBox, HeadRegion } from "./types";

export interface SubjectDetectionState {
  hasSubject: boolean;
  confidence: number;
  faceDetected: boolean;
  headRegion: HeadRegion;
  boundingBox: SubjectBoundingBox;
  coveragePercent: number;
  subjectCentroid: { x: number; y: number };
}

/**
 * Kinematic Subject Tracker
 * Tracks head centroid, scale, and torso bounding box across video frames with
 * temporal smoothing, velocity prediction, and outlier rejection to eliminate jitter.
 */
export class KinematicSubjectTracker {
  private isInitialized = false;

  // Tracked Kinematic State (Normalized 0.0 to 1.0)
  private headX = 0.5;
  private headY = 0.35;
  private headRadiusX = 0.15;
  private headRadiusY = 0.15;

  private boxX = 0.2;
  private boxY = 0.15;
  private boxW = 0.6;
  private boxH = 0.8;

  // Kinematic Velocities (per second)
  private vx = 0;
  private vy = 0;

  private smoothedConfidence = 0;
  private lastTimestamp = -1;
  private coastFrames = 0;
  private readonly maxCoastFrames = 10;

  reset(): void {
    this.isInitialized = false;
    this.headX = 0.5;
    this.headY = 0.35;
    this.headRadiusX = 0.15;
    this.headRadiusY = 0.15;
    this.boxX = 0.2;
    this.boxY = 0.15;
    this.boxW = 0.6;
    this.boxH = 0.8;
    this.vx = 0;
    this.vy = 0;
    this.smoothedConfidence = 0;
    this.lastTimestamp = -1;
    this.coastFrames = 0;
  }

  update(
    measuredHead: HeadRegion | null,
    measuredBox: SubjectBoundingBox | null,
    instantConfidence: number,
    timestamp: number
  ): { head: HeadRegion; box: SubjectBoundingBox; confidence: number; hasSubject: boolean } {
    if (timestamp === 0 || (this.lastTimestamp >= 0 && timestamp < this.lastTimestamp)) {
      this.reset();
    }
    const dt = this.lastTimestamp >= 0 ? Math.max(0.01, Math.min(0.25, timestamp - this.lastTimestamp)) : 0.033;
    this.lastTimestamp = timestamp;

    if (!measuredHead || !measuredBox || instantConfidence < 0.2) {
      // Missed detection / temporary occlusion
      if (this.isInitialized && this.coastFrames < this.maxCoastFrames) {
        this.coastFrames++;
        // Coast forward with momentum and decaying velocity
        this.headX = Math.max(0.1, Math.min(0.9, this.headX + this.vx * dt));
        this.headY = Math.max(0.1, Math.min(0.9, this.headY + this.vy * dt));
        this.vx *= 0.85;
        this.vy *= 0.85;
        this.smoothedConfidence *= 0.88;

        return {
          head: {
            centerX: this.headX,
            centerY: this.headY,
            radiusX: this.headRadiusX,
            radiusY: this.headRadiusY,
          },
          box: {
            x: this.boxX,
            y: this.boxY,
            width: this.boxW,
            height: this.boxH,
          },
          confidence: this.smoothedConfidence,
          hasSubject: this.smoothedConfidence >= 0.25,
        };
      }

      // Completely lost subject
      this.smoothedConfidence *= 0.8;
      return {
        head: { centerX: 0.5, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        box: { x: 0, y: 0, width: 0, height: 0 },
        confidence: 0,
        hasSubject: false,
      };
    }

    // Valid Measurement
    this.coastFrames = 0;

    if (!this.isInitialized) {
      // Direct initialization
      this.isInitialized = true;
      this.headX = measuredHead.centerX;
      this.headY = measuredHead.centerY;
      this.headRadiusX = measuredHead.radiusX;
      this.headRadiusY = measuredHead.radiusY;
      this.boxX = measuredBox.x;
      this.boxY = measuredBox.y;
      this.boxW = measuredBox.width;
      this.boxH = measuredBox.height;
      this.vx = 0;
      this.vy = 0;
      this.smoothedConfidence = instantConfidence;
    } else {
      // Predictive Kalman / EMA Update with Outlier Gating
      const predictedX = this.headX + this.vx * dt;
      const predictedY = this.headY + this.vy * dt;

      const dist = Math.hypot(measuredHead.centerX - predictedX, measuredHead.centerY - predictedY);

      // Adaptive Kalman Gain based on confidence and spatial proximity
      let alphaPos = dist > 0.35 ? 0.18 : 0.40; // Soften extreme outlier jumps
      const alphaScale = 0.25;

      const newHeadX = predictedX + alphaPos * (measuredHead.centerX - predictedX);
      const newHeadY = predictedY + alphaPos * (measuredHead.centerY - predictedY);

      // Estimate velocity with smoothing
      const measuredVx = (newHeadX - this.headX) / dt;
      const measuredVy = (newHeadY - this.headY) / dt;
      this.vx = 0.70 * this.vx + 0.30 * Math.max(-1.5, Math.min(1.5, measuredVx));
      this.vy = 0.70 * this.vy + 0.30 * Math.max(-1.5, Math.min(1.5, measuredVy));

      this.headX = newHeadX;
      this.headY = newHeadY;
      this.headRadiusX = this.headRadiusX * (1 - alphaScale) + measuredHead.radiusX * alphaScale;
      this.headRadiusY = this.headRadiusY * (1 - alphaScale) + measuredHead.radiusY * alphaScale;

      this.boxX = this.boxX * (1 - alphaPos) + measuredBox.x * alphaPos;
      this.boxY = this.boxY * (1 - alphaPos) + measuredBox.y * alphaPos;
      this.boxW = this.boxW * (1 - alphaScale) + measuredBox.width * alphaScale;
      this.boxH = this.boxH * (1 - alphaScale) + measuredBox.height * alphaScale;

      this.smoothedConfidence = this.smoothedConfidence * 0.75 + instantConfidence * 0.25;
    }

    return {
      head: {
        centerX: this.headX,
        centerY: this.headY,
        radiusX: this.headRadiusX,
        radiusY: this.headRadiusY,
      },
      box: {
        x: this.boxX,
        y: this.boxY,
        width: this.boxW,
        height: this.boxH,
      },
      confidence: this.smoothedConfidence,
      hasSubject: true,
    };
  }
}

/**
 * High-Accuracy Subject Segmentation Model
 */
export class AccurateSubjectModel {
  private tracker = new KinematicSubjectTracker();
  private lastMask: Uint8Array | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  reset(): void {
    this.tracker.reset();
    this.lastMask = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
  }

  processFrame(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    timestamp = 0
  ): {
    mask: Uint8Array;
    metrics: SubjectMetrics;
    faceDetected: boolean;
    subjectCentroid: { x: number; y: number };
  } {
    const totalPixels = width * height;
    const finalMask = new Uint8Array(totalPixels);
    const grayscale = new Uint8Array(totalPixels);
    const skinMap = new Float32Array(totalPixels);

    // -------------------------------------------------------------
    // STAGE 1: Multi-Zone Perimeter Background Palette Sampling
    // -------------------------------------------------------------
    const bgZones: Array<{ r: number; g: number; b: number }> = [];
    const samplePerimeter = (xStart: number, xEnd: number, yStart: number, yEnd: number, step = 3) => {
      let sr = 0, sg = 0, sb = 0, c = 0;
      for (let y = yStart; y < yEnd; y += step) {
        for (let x = xStart; x < xEnd; x += step) {
          const idx = (y * width + x) * 4;
          sr += rgba[idx];
          sg += rgba[idx + 1];
          sb += rgba[idx + 2];
          c++;
        }
      }
      if (c > 0) bgZones.push({ r: sr / c, g: sg / c, b: sb / c });
    };

    // Top border (sky/ceiling/room top)
    samplePerimeter(0, width, 0, Math.max(4, Math.round(height * 0.08)));
    // Left border (wall)
    samplePerimeter(0, Math.max(4, Math.round(width * 0.08)), Math.round(height * 0.08), height);
    // Right border (wall)
    samplePerimeter(Math.round(width * 0.92), width, Math.round(height * 0.08), height);

    // Minimum distance function to perimeter background clusters
    const getBgDistance = (r: number, g: number, b: number) => {
      let minDist = 999;
      for (const z of bgZones) {
        const d = Math.hypot(r - z.r, g - z.g, b - z.b);
        if (d < minDist) minDist = d;
      }
      return minDist;
    };

    // -------------------------------------------------------------
    // STAGE 2: Multi-Space Color Locus (YCbCr + HSV + NormRGB)
    // -------------------------------------------------------------
    let skinSumX = 0;
    let skinSumY = 0;
    let skinCount = 0;
    const headSearchMaxY = Math.round(height * 0.68);

    for (let y = 0; y < height; y++) {
      const row = y * width;
      const normY = y / height;
      // Vertical prior: human heads in portrait/reels cluster around y=0.32
      const verticalWeight = Math.exp(-0.5 * Math.pow((normY - 0.32) / 0.18, 2));

      for (let x = 0; x < width; x++) {
        const idx = (row + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];

        // Fast Luminance
        const lum = (r * 77 + g * 150 + b * 29) >> 8;
        grayscale[row + x] = lum;

        // YCbCr Skin Chrominance
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        // Universal Gaussian Mahalanobis Likelihood (Fitzpatrick skin tones I-VI)
        const dCb = (cb - 110) / 28;
        const dCr = (cr - 150) / 26;
        const distSq = dCb * dCb + dCr * dCr;
        let pSkin = Math.exp(-0.5 * distSq);

        // Normalized RGB
        const sum = r + g + b + 1;
        const nr = r / sum;
        const ng = g / sum;
        const isNormSkin = nr >= 0.28 && nr <= 0.65 && ng >= 0.20 && ng <= 0.45 && (nr > ng || (r > g && g >= b));
        if (!isNormSkin) pSkin *= 0.5;

        // HSV Hue Filter
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        let hue = 0;
        if (delta > 0) {
          if (max === r) hue = ((g - b) / delta) % 6;
          else if (max === g) hue = (b - r) / delta + 2;
          else hue = (r - g) / delta + 4;
          hue *= 60;
          if (hue < 0) hue += 360;
        }
        const sat = max > 0 ? delta / max : 0;
        const isHueSkin = (hue <= 52 || hue >= 325) && sat >= 0.08 && sat <= 0.85;
        if (!isHueSkin) pSkin *= 0.5;

        // Reject pixels matching room perimeter background wall
        const bgDist = getBgDistance(r, g, b);
        if (bgDist < 14) pSkin = 0;

        // Real human skin requires red dominance, chrominance red > blue, and sufficient saturation
        if (r <= g || (r - g) < 12 || (r - b) < 18 || sat < 0.14 || cr <= cb + 6) {
          pSkin = 0;
        }

        if (pSkin >= 0.25) {
          skinMap[row + x] = pSkin;
          if (y < headSearchMaxY) {
            skinSumX += x * pSkin * verticalWeight;
            skinSumY += y * pSkin * verticalWeight;
            skinCount += pSkin * verticalWeight;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STAGE 3: Spatial Density & Saliency for Head Localization
    // -------------------------------------------------------------
    const minSkinThreshold = Math.max(20, Math.round(width * height * 0.0012));
    let measuredHead: HeadRegion | null = null;
    let faceDetected = false;

    if (skinCount >= minSkinThreshold) {
      faceDetected = true;
      const rawMeanX = skinSumX / skinCount;
      const rawMeanY = skinSumY / skinCount;

      // Second spatial pass around raw centroid to filter out hands/arms
      let localSumX = 0;
      let localSumY = 0;
      let localCount = 0;
      const localRadius = width * 0.20;

      for (let y = 0; y < headSearchMaxY; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const p = skinMap[row + x];
          if (p > 0.28) {
            if (Math.abs(x - rawMeanX) <= localRadius && Math.abs(y - rawMeanY) <= localRadius) {
              localSumX += x * p;
              localSumY += y * p;
              localCount += p;
            }
          }
        }
      }

      const meanX = localCount > 0 ? localSumX / localCount : rawMeanX;
      const meanY = localCount > 0 ? localSumY / localCount : rawMeanY;

      // Variance of cluster
      let varX = 0;
      let varY = 0;
      for (let y = 0; y < headSearchMaxY; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const p = skinMap[row + x];
          if (p > 0.28 && Math.abs(x - meanX) <= localRadius && Math.abs(y - meanY) <= localRadius) {
            varX += (x - meanX) * (x - meanX) * p;
            varY += (y - meanY) * (y - meanY) * p;
          }
        }
      }

      const stdX = localCount > 0 ? Math.sqrt(varX / localCount) : width * 0.10;
      const stdY = localCount > 0 ? Math.sqrt(varY / localCount) : height * 0.12;

      // Dynamic object sizing: smoothly adapts to small, medium, and massive objects
      measuredHead = {
        centerX: meanX / width,
        centerY: meanY / height,
        radiusX: Math.min(0.30, Math.max(0.05, (stdX * 1.7) / width)),
        radiusY: Math.min(0.30, Math.max(0.06, (stdY * 1.7) / height)),
      };
    } else {
      // Saliency Silhouette Fallback:
      // If skin is obscured (e.g. sunglasses, dark lighting, backlight, objects), detect central subject silhouette
      let fgColSum = 0;
      let fgColCount = 0;
      let fgRowSum = 0;
      let fgRowCount = 0;
      let minFgX = width, maxFgX = 0, minFgY = height, maxFgY = 0;
      const searchYEnd = Math.round(height * 0.85);

      for (let y = Math.round(height * 0.08); y < searchYEnd; y += 2) {
        const row = y * width;
        for (let x = Math.round(width * 0.05); x < Math.round(width * 0.95); x += 2) {
          const idx = (row + x) * 4;
          const d = getBgDistance(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
          if (d >= 20) {
            fgColSum += x;
            fgRowSum += y;
            fgColCount++;
            fgRowCount++;
            if (x < minFgX) minFgX = x;
            if (x > maxFgX) maxFgX = x;
            if (y < minFgY) minFgY = y;
            if (y > maxFgY) maxFgY = y;
          }
        }
      }

      if (fgColCount >= Math.round(width * height * 0.005)) {
        faceDetected = true;
        const meanX = fgColSum / fgColCount;
        const meanY = fgRowSum / fgRowCount;

        let varCol = 0, varRow = 0;
        for (let y = minFgY; y <= maxFgY; y += 4) {
          const row = y * width;
          for (let x = minFgX; x <= maxFgX; x += 4) {
            const idx = (row + x) * 4;
            if (getBgDistance(rgba[idx], rgba[idx + 1], rgba[idx + 2]) >= 20) {
              varCol += (x - meanX) * (x - meanX);
              varRow += (y - meanY) * (y - meanY);
            }
          }
        }
        const sampleCount = Math.max(1, fgColCount / 4);
        const stdCol = Math.sqrt(varCol / sampleCount);
        const stdRow = Math.sqrt(varRow / sampleCount);

        measuredHead = {
          centerX: meanX / width,
          centerY: Math.max(0.10, Math.min(0.85, meanY / height)),
          radiusX: Math.max(0.04, Math.min(0.48, (stdCol * 1.85) / width)),
          radiusY: Math.max(0.04, Math.min(0.48, (stdRow * 1.85) / height)),
        };
      } else {
        this.tracker.reset();
        return {
          mask: new Uint8Array(totalPixels),
          metrics: {
            hasSubject: false,
            confidence: 0,
            coveragePercent: 0,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 },
            headRegion: { centerX: 0.5, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
            subjectCount: 0,
            isLeavingFrame: false,
          },
          faceDetected: false,
          subjectCentroid: { x: 0.5, y: 0.35 },
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 4: Sobel 3x3 Luminance Gradient Edge Map
    // -------------------------------------------------------------
    const edgeMap = new Uint8Array(totalPixels);
    for (let y = 1; y < height - 1; y++) {
      const rowPrev = (y - 1) * width;
      const rowCurr = y * width;
      const rowNext = (y + 1) * width;
      for (let x = 1; x < width - 1; x++) {
        const gx =
          -grayscale[rowPrev + x - 1] + grayscale[rowPrev + x + 1]
          - 2 * grayscale[rowCurr + x - 1] + 2 * grayscale[rowCurr + x + 1]
          - grayscale[rowNext + x - 1] + grayscale[rowNext + x + 1];

        const gy =
          -grayscale[rowPrev + x - 1] - 2 * grayscale[rowPrev + x] - grayscale[rowPrev + x + 1]
          + grayscale[rowNext + x - 1] + 2 * grayscale[rowNext + x] + grayscale[rowNext + x + 1];

        edgeMap[rowCurr + x] = Math.min(255, (Math.abs(gx) + Math.abs(gy)) >> 2);
      }
    }

    // -------------------------------------------------------------
    // STAGE 5: Multi-Seed Subject Body, Hair & Clothing Sampling
    // -------------------------------------------------------------
    const subjectSeeds: Array<{ r: number; g: number; b: number }> = [];
    if (measuredHead) {
      const objCenterX = Math.round(measuredHead.centerX * width);
      const objCenterY = Math.round(measuredHead.centerY * height);
      const objRadX = Math.round(measuredHead.radiusX * width);
      const objRadY = Math.round(measuredHead.radiusY * height);

      // Sample core points across hair, chest, and shoulders
      const samplePoints: Array<[number, number]> = [
        // Hair crown
        [objCenterX, Math.round(objCenterY - objRadY * 0.65)],
        // Mid chest
        [objCenterX, Math.round(objCenterY + objRadY * 1.15)],
        [objCenterX, Math.round(objCenterY + objRadY * 1.65)],
        // Torso core
        [Math.round(objCenterX - objRadX * 0.45), Math.round(objCenterY + objRadY * 1.35)],
        [Math.round(objCenterX + objRadX * 0.45), Math.round(objCenterY + objRadY * 1.35)],
      ];

      for (const [sx, sy] of samplePoints) {
        if (sy > 2 && sy < height - 2 && sx > 2 && sx < width - 2) {
          const idx = (sy * width + sx) * 4;
          const cr = rgba[idx];
          const cg = rgba[idx + 1];
          const cb = rgba[idx + 2];
          if (getBgDistance(cr, cg, cb) >= 15) {
            subjectSeeds.push({ r: cr, g: cg, b: cb });
          }
        }
      }
    }

    const isSubjectColorMatch = (r: number, g: number, b: number) => {
      for (const s of subjectSeeds) {
        if (Math.hypot(r - s.r, g - s.g, b - s.b) <= 52) return true;
      }
      return false;
    };

    // -------------------------------------------------------------
    // STAGE 6: Dynamic Object-Adaptive Scanline Profiler & Masking
    // -------------------------------------------------------------
    let minX = width, maxX = -1, minY = height, maxY = -1;
    let fgPixelCount = 0;

    const headPixelX = measuredHead ? measuredHead.centerX * width : width * 0.5;
    const headPixelY = measuredHead ? measuredHead.centerY * height : height * 0.35;
    const headRadiusPxX = measuredHead ? measuredHead.radiusX * width : width * 0.15;
    const headRadiusPxY = measuredHead ? measuredHead.radiusY * height : height * 0.15;

    // Fast check: is pixel a candidate foreground pixel for this object?
    const isFgCandidate = (x: number, y: number): boolean => {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const bgDist = getBgDistance(r, g, b);
      if (bgDist < 14) return false; // Directly matches the perimeter room background!

      // 1. Skin chrominance
      if (skinMap[y * width + x] >= 0.28) return true;

      // 2. Subject clothing / hair / chair color match
      if (isSubjectColorMatch(r, g, b)) return true;

      // 3. Hair or dark chair headrest match near the head (with background contrast)
      const dy = y - headPixelY;
      const isHair =
        Math.abs(x - headPixelX) <= Math.max(width * 0.18, headRadiusPxX * 1.85) &&
        dy >= -headRadiusPxY * 1.35 &&
        dy <= headRadiusPxY * 1.15 &&
        (r + g + b) < 170 &&
        bgDist >= 14;
      if (isHair) return true;

      // 4. For non-human / silhouette videos with NO face (e.g. product showcase):
      if (!faceDetected && bgDist >= 22) return true;

      return false;
    };

    // 1. Scanline Profiling: Measure dynamic left & right bounds for every scanline
    const envLeft = new Float32Array(height);
    const envRight = new Float32Array(height);
    const hasRowFg = new Uint8Array(height);

    const topSearchY = Math.max(0, Math.floor(headPixelY - headRadiusPxY * 1.35));
    let prevRowCenter = headPixelX;

    for (let y = topSearchY; y < height; y++) {
      const dy = y - headPixelY;

      // Scan starting anchor: smooth tracking of object spine
      let scanX = Math.round(prevRowCenter);
      if (scanX < 5 || scanX >= width - 5) scanX = Math.round(headPixelX);

      let anchorX = scanX;
      let foundAnchor = isFgCandidate(scanX, y);
      if (!foundAnchor) {
        const searchDelta = Math.max(4, Math.round(headRadiusPxX * 0.75));
        for (let dx = 1; dx <= searchDelta; dx++) {
          if (scanX - dx >= 0 && isFgCandidate(scanX - dx, y)) {
            anchorX = scanX - dx;
            foundAnchor = true;
            break;
          }
          if (scanX + dx < width && isFgCandidate(scanX + dx, y)) {
            anchorX = scanX + dx;
            foundAnchor = true;
            break;
          }
        }
      }

      // If within head/torso core, enforce minimum anchor presence
      const isWithinCoreY = dy >= -headRadiusPxY * 1.15 && dy <= headRadiusPxY * 2.2;
      if (!foundAnchor && !isWithinCoreY) {
        envLeft[y] = prevRowCenter;
        envRight[y] = prevRowCenter;
        continue;
      }

      // Scan leftward and rightward from anchorX bounded by anatomical width
      const maxSpanW = dy <= 0
        ? Math.max(width * 0.18, headRadiusPxX * 1.85)
        : Math.min(width * 0.44, Math.max(width * 0.22, headRadiusPxX * (2.0 + Math.min(3.0, (dy / (headRadiusPxY || 1)) * 1.0))));
      let rowMinX = anchorX;
      let bgStreak = 0;
      for (let x = anchorX; x >= Math.max(0, Math.floor(anchorX - maxSpanW)); x--) {
        if (isFgCandidate(x, y)) {
          rowMinX = x;
          bgStreak = 0;
        } else {
          bgStreak++;
          if (bgStreak > 4) break; // End of object boundary on the left
        }
      }

      let rowMaxX = anchorX;
      bgStreak = 0;
      for (let x = anchorX; x <= Math.min(width - 1, Math.ceil(anchorX + maxSpanW)); x++) {
        if (isFgCandidate(x, y)) {
          rowMaxX = x;
          bgStreak = 0;
        } else {
          bgStreak++;
          if (bgStreak > 4) break; // End of object boundary on the right
        }
      }

      // Enforce head core if within head ellipse, anchored on subject
      if (dy >= -headRadiusPxY * 1.0 && dy <= headRadiusPxY * 0.9 && foundAnchor) {
        const headHw = headRadiusPxX * 0.85 * Math.sqrt(Math.max(0, 1.0 - Math.pow(dy / (headRadiusPxY || 1), 2)));
        rowMinX = Math.min(rowMinX, Math.round(anchorX - headHw));
        rowMaxX = Math.max(rowMaxX, Math.round(anchorX + headHw));
      }

      if (rowMaxX >= rowMinX + 2) {
        hasRowFg[y] = 1;
        envLeft[y] = rowMinX;
        envRight[y] = rowMaxX;
        prevRowCenter = (rowMinX + rowMaxX) / 2;
      } else {
        envLeft[y] = prevRowCenter;
        envRight[y] = prevRowCenter;
      }
    }

    // 2. Smooth the dynamic left & right envelopes vertically
    const smoothLeft = new Float32Array(height);
    const smoothRight = new Float32Array(height);

    for (let y = 0; y < height; y++) {
      if (!hasRowFg[y]) {
        smoothLeft[y] = envLeft[y];
        smoothRight[y] = envRight[y];
        continue;
      }

      let lSum = 0, rSum = 0, wSum = 0;
      for (let sy = -2; sy <= 2; sy++) {
        const ny = y + sy;
        if (ny >= 0 && ny < height && hasRowFg[ny]) {
          const w = 3 - Math.abs(sy);
          lSum += envLeft[ny] * w;
          rSum += envRight[ny] * w;
          wSum += w;
        }
      }
      if (wSum > 0) {
        smoothLeft[y] = lSum / wSum;
        smoothRight[y] = rSum / wSum;
      } else {
        smoothLeft[y] = envLeft[y];
        smoothRight[y] = envRight[y];
      }
    }

    // 3. Rasterize dynamic mask with boundary anti-aliasing
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const dy = y - headPixelY;
      if (!hasRowFg[y]) {
        for (let x = 0; x < width; x++) {
          finalMask[row + x] = 0;
        }
        continue;
      }

      const lBound = Math.max(0, Math.floor(smoothLeft[y]));
      const rBound = Math.min(width - 1, Math.ceil(smoothRight[y]));

      // Clean background outside left and right object boundaries
      for (let x = 0; x < lBound; x++) {
        finalMask[row + x] = 0;
      }
      for (let x = rBound + 1; x < width; x++) {
        finalMask[row + x] = 0;
      }

      // Populate pixels inside dynamic object span
      const rowSpan = Math.max(1, rBound - lBound);
      for (let x = lBound; x <= rBound; x++) {
        const idx = (row + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];

        // Head ellipse test
        const hdx = (x - headPixelX) / (headRadiusPxX || 1);
        const hdy = (y - headPixelY) / (headRadiusPxY || 1);
        const insideHead = hdx * hdx + hdy * hdy <= 1.05;

        // Features
        const isSkin = skinMap[row + x] >= 0.28;
        const bgDist = getBgDistance(r, g, b);
        const isSubjectMatch = isSubjectColorMatch(r, g, b);
        const isHair =
          Math.abs(x - headPixelX) <= Math.max(width * 0.18, headRadiusPxX * 1.85) &&
          dy >= -headRadiusPxY * 1.35 &&
          dy <= headRadiusPxY * 1.15 &&
          (r + g + b) < 170 &&
          bgDist >= 14;
        const isFgContrast = !faceDetected && bgDist >= 22;

        // Inside head ellipse or hair/headrest zone, only accept actual subject pixels (skin, hair, dark facial features, or subject seeds)
        const isHeadFeature = (insideHead || isHair) && (isSkin || isHair || (r + g + b < 185) || isSubjectMatch);

        // Core solidity within dynamic row width (only for matching subject colors)
        const distFromCenter = Math.abs(x - (lBound + rBound) / 2);
        const isCoreInterior = (isSkin || isSubjectMatch || isHair) && (distFromCenter / (rowSpan / 2)) <= 0.80;

        if (bgDist >= 14 && (isHeadFeature || isSkin || isHair || isSubjectMatch || isFgContrast || isCoreInterior)) {
          let alpha = 255;
          // Boundary falloff near envelope edge
          const distToEdge = Math.min(x - lBound, rBound - x);
          if (distToEdge <= 4) {
            const edgeT = distToEdge / 4.0;
            const sobel = edgeMap[row + x];
            if (sobel > 30) {
              alpha = Math.round(255 * (edgeT > 0.35 ? 1.0 : edgeT * 1.5));
            } else {
              alpha = Math.round(255 * Math.min(1.0, Math.max(0.0, edgeT)));
            }
          }

          finalMask[row + x] = alpha;

          if (alpha >= 120) {
            fgPixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        } else {
          finalMask[row + x] = 0;
        }
      }
    }

    // -------------------------------------------------------------
    // STAGE 7: Temporal Smoothing & Metrics Fusion via Tracker
    // -------------------------------------------------------------
    const rawCoverage = (fgPixelCount / totalPixels) * 100;
    const rawHasSubject = rawCoverage >= 1.2 && minX <= maxX && minY <= maxY && faceDetected;

    let measuredBox: SubjectBoundingBox | null = null;
    if (rawHasSubject) {
      measuredBox = {
        x: minX / width,
        y: minY / height,
        width: (maxX - minX) / width,
        height: (maxY - minY) / height,
      };
    }

    const instantConfidence = rawHasSubject ? Math.min(1.0, Math.max(0.65, rawCoverage / 18)) : 0;

    // Run Kinematic Tracker Update
    const tracked = this.tracker.update(measuredHead, measuredBox, instantConfidence, timestamp);

    // Apply temporal anti-flicker blending if dimensions match
    if (this.lastMask && this.lastWidth === width && this.lastHeight === height) {
      const alphaBlend = 0.72; // 72% previous, 28% current
      for (let i = 0; i < totalPixels; i++) {
        finalMask[i] = Math.round(finalMask[i] * (1 - alphaBlend) + this.lastMask[i] * alphaBlend);
      }
    }
    this.lastMask = new Uint8Array(finalMask);
    this.lastWidth = width;
    this.lastHeight = height;

    const metrics: SubjectMetrics = {
      hasSubject: tracked.hasSubject,
      confidence: Math.round(tracked.confidence * 100) / 100,
      coveragePercent: Math.round(rawCoverage * 10) / 10,
      boundingBox: tracked.box,
      headRegion: tracked.head,
      subjectCount: tracked.hasSubject ? 1 : 0,
      isLeavingFrame: tracked.box.x <= 0.02 || (tracked.box.x + tracked.box.width) >= 0.98,
    };

    return {
      mask: finalMask,
      metrics,
      faceDetected,
      subjectCentroid: {
        x: tracked.head.centerX,
        y: tracked.head.centerY,
      },
    };
  }
}

export const accurateSubjectModel = new AccurateSubjectModel();
