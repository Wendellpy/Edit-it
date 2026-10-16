/**
 * 9:16 Auto-Reframe Engine with Active Speaker Face Tracking
 * 
 * 100% Local & In-Browser:
 * - Detects source video aspect ratio (skips/passes through if already 9:16 vertical).
 * - Slices horizontal 16:9 / 4:3 videos into vertical 9:16 Shorts dimensions.
 * - Samples video frames at 2-5 fps for speaker face/head position saliency.
 * - Applies dead-band thresholding, EMA camera trajectory smoothing, and cut detection.
 * - Interpolates smooth camera panning coordinates (sx, sy, sw, sh) across time.
 * - Zero network requests, zero cloud dependencies.
 */

import { MlSubjectSegmenter } from "../segmentation/mlSubjectSegmenter";

export interface CropWindow {
  /** Normalized left crop boundary [0.0, 1.0] */
  sx: number;
  /** Normalized top crop boundary [0.0, 1.0] */
  sy: number;
  /** Normalized crop width [0.0, 1.0] */
  sw: number;
  /** Normalized crop height [0.0, 1.0] */
  sh: number;
}

export interface CropKeyframe extends CropWindow {
  /** Timestamp in seconds */
  time: number;
  /** Target horizontal center position [0.0, 1.0] */
  centerX: number;
  /** Detection confidence [0.0, 1.0] */
  confidence: number;
  /** Indicates a hard scene cut where camera should snap instead of smooth pan */
  isCut?: boolean;
}

export interface ReframeTrajectory {
  sourceWidth: number;
  sourceHeight: number;
  sourceAspectRatio: number;
  targetAspectRatio: number; // e.g. 9/16 = 0.5625
  needsReframe: boolean;
  cropWidthNorm: number;
  cropHeightNorm: number;
  keyframes: CropKeyframe[];
  averageConfidence: number;
  mode: "face_tracking" | "center_crop" | "passthrough";
}

export interface AutoReframeOptions {
  /** Sampling frame rate for face detection (default: 3 fps) */
  sampleFps?: number;
  /** Camera won't move if speaker movement is less than this fraction of width (default: 0.035) */
  deadBandThreshold?: number;
  /** Exponential moving average smoothing factor [0.0, 1.0] (default: 0.20) */
  emaAlpha?: number;
  /** Normalized horizontal jump threshold to trigger an instant camera cut (default: 0.35) */
  cutJumpThreshold?: number;
  /** Desired target aspect ratio (default: 9/16 = 0.5625) */
  targetAspectRatio?: number;
}

export const DEFAULT_REFRAME_OPTIONS: Required<AutoReframeOptions> = {
  sampleFps: 3,
  deadBandThreshold: 0.035,
  emaAlpha: 0.20,
  cutJumpThreshold: 0.35,
  targetAspectRatio: 9 / 16, // 0.5625
};

/**
 * Computes normalized crop dimensions for a given source aspect ratio.
 */
export function computeTargetCropDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number = 9 / 16
): { cropWidthNorm: number; cropHeightNorm: number; needsReframe: boolean } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { cropWidthNorm: 1.0, cropHeightNorm: 1.0, needsReframe: false };
  }

  const sourceAspectRatio = sourceWidth / sourceHeight;

  // If already vertical or nearly 9:16 (within 5% tolerance or narrower), passthrough
  if (sourceAspectRatio <= targetAspectRatio + 0.05) {
    return { cropWidthNorm: 1.0, cropHeightNorm: 1.0, needsReframe: false };
  }

  // Source is wider than target (e.g. 16:9 = 1.777, 4:3 = 1.333)
  // Target width in source coordinates: H * targetAspectRatio
  // Normalized width: (H * targetAspectRatio) / W = targetAspectRatio / sourceAspectRatio
  const cropWidthNorm = targetAspectRatio / sourceAspectRatio;
  const cropHeightNorm = 1.0;

  return {
    cropWidthNorm: Math.min(1.0, Math.max(0.1, cropWidthNorm)),
    cropHeightNorm,
    needsReframe: true,
  };
}

/**
 * Clamps normalized horizontal center so crop window stays strictly inside [0.0, 1.0].
 */
export function clampCropWindow(
  centerX: number,
  cropWidthNorm: number,
  cropHeightNorm: number = 1.0
): CropWindow {
  const halfW = cropWidthNorm / 2;
  const clampedCenterX = Math.max(halfW, Math.min(1.0 - halfW, centerX));
  const sx = clampedCenterX - halfW;

  return {
    sx: Math.max(0, Math.min(1.0 - cropWidthNorm, sx)),
    sy: 0,
    sw: cropWidthNorm,
    sh: cropHeightNorm,
  };
}

export interface RawTrackingPoint {
  time: number;
  x: number; // 0..1
  confidence: number;
}

/**
 * Smooths raw face detection points into a cinematic camera trajectory using
 * dead-band thresholding, cut jump detection, and exponential moving average (EMA).
 */
export function smoothCameraTrajectory(
  rawPoints: RawTrackingPoint[],
  cropWidthNorm: number,
  options: Partial<AutoReframeOptions> = {}
): CropKeyframe[] {
  const opts = { ...DEFAULT_REFRAME_OPTIONS, ...options };
  const cropHeightNorm = 1.0;

  if (rawPoints.length === 0) {
    const defaultWindow = clampCropWindow(0.5, cropWidthNorm, cropHeightNorm);
    return [
      {
        time: 0,
        centerX: 0.5,
        ...defaultWindow,
        confidence: 0,
      },
    ];
  }

  const keyframes: CropKeyframe[] = [];
  let currentCameraX = rawPoints[0].x;

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    const prevPt = i > 0 ? rawPoints[i - 1] : null;

    let targetX = pt.x;
    let isCut = false;

    // Outlier rejection: if confidence is very low, stay at previous camera position
    if (pt.confidence < 0.20 && prevPt) {
      targetX = currentCameraX;
    } else if (prevPt) {
      const deltaFromCurrent = Math.abs(targetX - currentCameraX);

      // 1. Cut jump detection: if speaker position shifts violently (> cutJumpThreshold), snap immediately
      if (deltaFromCurrent >= opts.cutJumpThreshold) {
        isCut = true;
        currentCameraX = targetX;
      }
      // 2. Dead-band filter: if motion is tiny (< deadBandThreshold), keep camera steady
      else if (deltaFromCurrent <= opts.deadBandThreshold) {
        targetX = currentCameraX;
      }
      // 3. Smooth cinematic pan: damp camera motion towards speaker
      else {
        currentCameraX = currentCameraX + opts.emaAlpha * (targetX - currentCameraX);
      }
    } else {
      currentCameraX = targetX;
    }

    const window = clampCropWindow(currentCameraX, cropWidthNorm, cropHeightNorm);

    keyframes.push({
      time: pt.time,
      centerX: currentCameraX,
      sx: window.sx,
      sy: window.sy,
      sw: window.sw,
      sh: window.sh,
      confidence: pt.confidence,
      isCut,
    });
  }

  return keyframes;
}

/**
 * Evaluates the crop window at any arbitrary timestamp using linear interpolation
 * between keyframes, respecting hard scene cuts.
 */
export function getCropWindowAtTime(
  trajectory: ReframeTrajectory,
  time: number
): CropWindow {
  if (!trajectory.needsReframe || trajectory.keyframes.length === 0) {
    return { sx: 0, sy: 0, sw: 1.0, sh: 1.0 };
  }

  const keyframes = trajectory.keyframes;

  // Edge cases: before first or after last keyframe
  if (time <= keyframes[0].time) {
    return {
      sx: keyframes[0].sx,
      sy: keyframes[0].sy,
      sw: keyframes[0].sw,
      sh: keyframes[0].sh,
    };
  }

  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) {
    return {
      sx: last.sx,
      sy: last.sy,
      sw: last.sw,
      sh: last.sh,
    };
  }

  // Binary search for surrounding keyframes [k0, k1]
  let low = 0;
  let high = keyframes.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (keyframes[mid].time === time) {
      return {
        sx: keyframes[mid].sx,
        sy: keyframes[mid].sy,
        sw: keyframes[mid].sw,
        sh: keyframes[mid].sh,
      };
    }
    if (keyframes[mid].time < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx0 = Math.max(0, high);
  const idx1 = Math.min(keyframes.length - 1, low);
  const k0 = keyframes[idx0];
  const k1 = keyframes[idx1];

  // If next frame is a scene cut, snap immediately
  if (k1.isCut && time >= k1.time - 0.05) {
    return { sx: k1.sx, sy: k1.sy, sw: k1.sw, sh: k1.sh };
  }

  const span = k1.time - k0.time;
  if (span <= 0) {
    return { sx: k0.sx, sy: k0.sy, sw: k0.sw, sh: k0.sh };
  }

  const t = Math.max(0, Math.min(1, (time - k0.time) / span));

  // Smooth Hermite (smoothstep) interpolation: 3t^2 - 2t^3 for fluid camera pan
  const smoothT = t * t * (3 - 2 * t);
  const interpCenterX = k0.centerX + smoothT * (k1.centerX - k0.centerX);

  return clampCropWindow(interpCenterX, trajectory.cropWidthNorm, trajectory.cropHeightNorm);
}

/**
 * Draws a reframed crop of the source video onto a target canvas with high-fidelity scaling.
 */
export function applyReframedCrop(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: HTMLVideoElement | CanvasImageSource,
  crop: CropWindow,
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth?: number,
  sourceHeight?: number
): void {
  const vw = sourceWidth || (video as HTMLVideoElement).videoWidth || (video as any).width || canvasWidth;
  const vh = sourceHeight || (video as HTMLVideoElement).videoHeight || (video as any).height || canvasHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Convert normalized crop coordinates to source pixel coordinates
  const sx = Math.max(0, Math.min(vw - 1, Math.round(crop.sx * vw)));
  const sy = Math.max(0, Math.min(vh - 1, Math.round(crop.sy * vh)));
  const sw = Math.max(1, Math.min(vw - sx, Math.round(crop.sw * vw)));
  const sh = Math.max(1, Math.min(vh - sy, Math.round(crop.sh * vh)));

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
}

/**
 * Generates an active speaker tracking trajectory for a video clip by sampling frames
 * and running local machine learning face/head localization.
 */
export async function buildReframeTrajectory(
  sourceWidth: number,
  sourceHeight: number,
  clipStart: number,
  clipEnd: number,
  videoElement?: HTMLVideoElement | null,
  options: Partial<AutoReframeOptions> = {}
): Promise<ReframeTrajectory> {
  const opts = { ...DEFAULT_REFRAME_OPTIONS, ...options };
  const { cropWidthNorm, cropHeightNorm, needsReframe } = computeTargetCropDimensions(
    sourceWidth,
    sourceHeight,
    opts.targetAspectRatio
  );

  // If already vertical, no reframing necessary
  if (!needsReframe) {
    return {
      sourceWidth,
      sourceHeight,
      sourceAspectRatio: sourceWidth / (sourceHeight || 1),
      targetAspectRatio: opts.targetAspectRatio,
      needsReframe: false,
      cropWidthNorm: 1.0,
      cropHeightNorm: 1.0,
      keyframes: [
        {
          time: clipStart,
          centerX: 0.5,
          sx: 0,
          sy: 0,
          sw: 1.0,
          sh: 1.0,
          confidence: 1.0,
        },
      ],
      averageConfidence: 1.0,
      mode: "passthrough",
    };
  }

  const duration = Math.max(0.1, clipEnd - clipStart);
  const sampleInterval = 1 / opts.sampleFps;
  const sampleTimes: number[] = [];

  for (let t = clipStart; t <= clipEnd; t += sampleInterval) {
    sampleTimes.push(t);
  }
  if (sampleTimes[sampleTimes.length - 1] < clipEnd) {
    sampleTimes.push(clipEnd);
  }

  const rawPoints: RawTrackingPoint[] = [];

  // If in browser and videoElement is provided, sample frames and run local ML detection
  if (typeof window !== "undefined" && videoElement && videoElement.readyState >= 2) {
    const segmenter = MlSubjectSegmenter.getInstance();
    const canSegment = await segmenter.initialize();

    if (canSegment) {
      // Create lightweight offscreen sampling canvas (384x216 for fast inference)
      const sampleW = 384;
      const sampleH = Math.round(sampleW / (sourceWidth / (sourceHeight || 1)));
      const sampleCanvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(sampleW, sampleH)
          : document.createElement("canvas");
      sampleCanvas.width = sampleW;
      sampleCanvas.height = sampleH;
      const sampleCtx = sampleCanvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

      for (const time of sampleTimes) {
        try {
          // Seek video to sample time
          videoElement.currentTime = time;
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              videoElement.removeEventListener("seeked", onSeeked);
              resolve();
            };
            videoElement.addEventListener("seeked", onSeeked, { once: true });
            // Fallback timeout in case seeked event doesn't fire
            setTimeout(resolve, 80);
          });

          if (sampleCtx) {
            sampleCtx.drawImage(videoElement, 0, 0, sampleW, sampleH);
            const segResult = await segmenter.segmentFrame(sampleCanvas as any, sampleW, sampleH, time);

            if (segResult && segResult.hasSubject && segResult.metrics.headRegion) {
              const headX = segResult.metrics.headRegion.centerX;
              rawPoints.push({
                time,
                x: headX,
                confidence: segResult.metrics.confidence,
              });
              continue;
            }
          }
        } catch {
          // Fall through to fallback
        }

        // Fallback: center framing
        rawPoints.push({
          time,
          x: 0.5,
          confidence: 0.3,
        });
      }
    }
  }

  // If no raw points were collected (e.g. Node test environment, or videoElement not provided)
  if (rawPoints.length === 0) {
    for (const time of sampleTimes) {
      rawPoints.push({
        time,
        x: 0.5,
        confidence: 0.5,
      });
    }
  }

  const keyframes = smoothCameraTrajectory(rawPoints, cropWidthNorm, opts);
  const avgConf =
    rawPoints.reduce((acc, p) => acc + p.confidence, 0) / Math.max(1, rawPoints.length);

  return {
    sourceWidth,
    sourceHeight,
    sourceAspectRatio: sourceWidth / (sourceHeight || 1),
    targetAspectRatio: opts.targetAspectRatio,
    needsReframe: true,
    cropWidthNorm,
    cropHeightNorm,
    keyframes,
    averageConfidence: avgConf,
    mode: avgConf >= 0.5 ? "face_tracking" : "center_crop",
  };
}
