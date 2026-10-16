import { describe, it, expect } from "vitest";
import {
  computeTargetCropDimensions,
  clampCropWindow,
  smoothCameraTrajectory,
  getCropWindowAtTime,
  type ReframeTrajectory,
  type RawTrackingPoint,
} from "../autoReframe";

describe("9:16 Auto-Reframe Engine", () => {
  describe("computeTargetCropDimensions", () => {
    it("bypasses reframing when source is already 9:16 vertical", () => {
      // 1080x1920 is exactly 9:16 (0.5625)
      const res = computeTargetCropDimensions(1080, 1920, 9 / 16);
      expect(res.needsReframe).toBe(false);
      expect(res.cropWidthNorm).toBe(1.0);
      expect(res.cropHeightNorm).toBe(1.0);
    });

    it("bypasses reframing for narrow vertical videos (e.g. 9:19.5 or 9:20 reels)", () => {
      const res = computeTargetCropDimensions(1080, 2400, 9 / 16);
      expect(res.needsReframe).toBe(false);
      expect(res.cropWidthNorm).toBe(1.0);
    });

    it("computes exact normalized crop width for 16:9 horizontal video", () => {
      // 1920x1080 -> 16:9
      // (1080 * 9/16) / 1920 = 607.5 / 1920 = 0.31640625 = 81 / 256
      const res = computeTargetCropDimensions(1920, 1080, 9 / 16);
      expect(res.needsReframe).toBe(true);
      expect(res.cropWidthNorm).toBeCloseTo(0.3164, 3);
      expect(res.cropHeightNorm).toBe(1.0);
    });

    it("computes exact normalized crop width for 4:3 video", () => {
      // 1440x1080 -> 4:3
      // (1080 * 9/16) / 1440 = 607.5 / 1440 = 0.421875
      const res = computeTargetCropDimensions(1440, 1080, 9 / 16);
      expect(res.needsReframe).toBe(true);
      expect(res.cropWidthNorm).toBeCloseTo(0.4219, 3);
      expect(res.cropHeightNorm).toBe(1.0);
    });

    it("handles zero or invalid dimensions gracefully without throwing", () => {
      const res = computeTargetCropDimensions(0, 0);
      expect(res.needsReframe).toBe(false);
      expect(res.cropWidthNorm).toBe(1.0);
    });
  });

  describe("clampCropWindow", () => {
    const cropW = 0.3164; // standard 16:9 -> 9:16 crop width

    it("centers crop window when subject is in the middle", () => {
      const window = clampCropWindow(0.5, cropW);
      expect(window.sw).toBe(cropW);
      expect(window.sh).toBe(1.0);
      expect(window.sy).toBe(0);
      expect(window.sx).toBeCloseTo(0.5 - cropW / 2, 4);
    });

    it("clamps left edge to 0 when subject is at far left", () => {
      const window = clampCropWindow(0.05, cropW);
      expect(window.sx).toBe(0);
      expect(window.sw).toBe(cropW);
    });

    it("clamps right edge to (1 - cropWidth) when subject is at far right", () => {
      const window = clampCropWindow(0.95, cropW);
      expect(window.sx).toBeCloseTo(1.0 - cropW, 4);
      expect(window.sx + window.sw).toBeCloseTo(1.0, 4);
    });
  });

  describe("smoothCameraTrajectory", () => {
    const cropW = 0.32;

    it("returns a centered fallback keyframe if no tracking points exist", () => {
      const keyframes = smoothCameraTrajectory([], cropW);
      expect(keyframes.length).toBe(1);
      expect(keyframes[0].centerX).toBe(0.5);
      expect(keyframes[0].sx).toBeCloseTo(0.5 - cropW / 2, 4);
    });

    it("applies dead-band filtering for subtle head movements (< 3.5%)", () => {
      const rawPoints: RawTrackingPoint[] = [
        { time: 0.0, x: 0.50, confidence: 0.9 },
        { time: 0.5, x: 0.51, confidence: 0.9 }, // 0.01 shift -> inside dead-band
        { time: 1.0, x: 0.49, confidence: 0.9 }, // 0.02 shift -> inside dead-band
      ];

      const keyframes = smoothCameraTrajectory(rawPoints, cropW, {
        deadBandThreshold: 0.035,
      });

      expect(keyframes.length).toBe(3);
      // Camera stays locked at initial 0.50 because shifts are within dead-band
      expect(keyframes[1].centerX).toBe(0.50);
      expect(keyframes[2].centerX).toBe(0.50);
    });

    it("smoothly pans using EMA when speaker moves genuinely across frame", () => {
      const rawPoints: RawTrackingPoint[] = [
        { time: 0.0, x: 0.30, confidence: 0.9 },
        { time: 0.5, x: 0.45, confidence: 0.9 }, // 0.15 shift -> triggers pan
        { time: 1.0, x: 0.45, confidence: 0.9 },
      ];

      const keyframes = smoothCameraTrajectory(rawPoints, cropW, {
        deadBandThreshold: 0.035,
        emaAlpha: 0.20,
      });

      expect(keyframes.length).toBe(3);
      expect(keyframes[0].centerX).toBe(0.30);
      // Keyframe 1 moves smoothly towards 0.45: 0.30 + 0.20 * (0.45 - 0.30) = 0.33
      expect(keyframes[1].centerX).toBeCloseTo(0.33, 2);
      expect(keyframes[1].isCut).toBe(false);
    });

    it("detects scene cut and snaps camera instantly on sudden large jumps", () => {
      const rawPoints: RawTrackingPoint[] = [
        { time: 0.0, x: 0.20, confidence: 0.9 },
        { time: 1.0, x: 0.80, confidence: 0.9 }, // 0.60 jump -> exceeds cutJumpThreshold (0.35)
      ];

      const keyframes = smoothCameraTrajectory(rawPoints, cropW, {
        cutJumpThreshold: 0.35,
      });

      expect(keyframes[1].isCut).toBe(true);
      expect(keyframes[1].centerX).toBe(0.80);
    });

    it("ignores low confidence tracking outliers and coasts at previous camera position", () => {
      const rawPoints: RawTrackingPoint[] = [
        { time: 0.0, x: 0.40, confidence: 0.95 },
        { time: 0.5, x: 0.90, confidence: 0.05 }, // outlier with low confidence
        { time: 1.0, x: 0.41, confidence: 0.95 },
      ];

      const keyframes = smoothCameraTrajectory(rawPoints, cropW);
      expect(keyframes[1].centerX).toBe(0.40);
    });
  });

  describe("getCropWindowAtTime", () => {
    const trajectory: ReframeTrajectory = {
      sourceWidth: 1920,
      sourceHeight: 1080,
      sourceAspectRatio: 1920 / 1080,
      targetAspectRatio: 9 / 16,
      needsReframe: true,
      cropWidthNorm: 0.3164,
      cropHeightNorm: 1.0,
      keyframes: [
        {
          time: 0.0,
          centerX: 0.30,
          sx: 0.30 - 0.3164 / 2,
          sy: 0,
          sw: 0.3164,
          sh: 1.0,
          confidence: 0.9,
          isCut: false,
        },
        {
          time: 2.0,
          centerX: 0.50,
          sx: 0.50 - 0.3164 / 2,
          sy: 0,
          sw: 0.3164,
          sh: 1.0,
          confidence: 0.9,
          isCut: false,
        },
        {
          time: 4.0,
          centerX: 0.80,
          sx: 0.80 - 0.3164 / 2,
          sy: 0,
          sw: 0.3164,
          sh: 1.0,
          confidence: 0.9,
          isCut: true, // Cut transition
        },
      ],
      averageConfidence: 0.9,
      mode: "face_tracking",
    };

    it("returns first keyframe crop before start time", () => {
      const window = getCropWindowAtTime(trajectory, -1.0);
      expect(window.sx).toBeCloseTo(0.30 - 0.3164 / 2, 4);
    });

    it("returns last keyframe crop after end time", () => {
      const window = getCropWindowAtTime(trajectory, 10.0);
      expect(window.sx).toBeCloseTo(0.80 - 0.3164 / 2, 4);
    });

    it("smoothly interpolates midway between keyframes", () => {
      // At t = 1.0 (halfway between 0.0 and 2.0 with smoothstep), centerX is ~0.40
      const window = getCropWindowAtTime(trajectory, 1.0);
      expect(window.sx).toBeCloseTo(0.40 - 0.3164 / 2, 2);
    });

    it("snaps immediately to scene cut keyframe", () => {
      // Keyframe 2 at 4.0 is marked as isCut
      const window = getCropWindowAtTime(trajectory, 3.98);
      expect(window.sx).toBeCloseTo(0.80 - 0.3164 / 2, 2);
    });

    it("returns full frame passthrough if needsReframe is false", () => {
      const passthroughTraj: ReframeTrajectory = {
        ...trajectory,
        needsReframe: false,
      };
      const window = getCropWindowAtTime(passthroughTraj, 1.5);
      expect(window.sx).toBe(0);
      expect(window.sy).toBe(0);
      expect(window.sw).toBe(1.0);
      expect(window.sh).toBe(1.0);
    });
  });
});
