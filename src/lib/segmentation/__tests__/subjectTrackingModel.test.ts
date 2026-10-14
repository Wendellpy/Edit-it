import { describe, it, expect } from "vitest";
import { KinematicSubjectTracker, AccurateSubjectModel } from "../subjectTrackingModel";

describe("Accurate Subject Tracking & Segmentation Model", () => {
  describe("KinematicSubjectTracker", () => {
    it("smoothly tracks subject position and scales with velocity prediction", () => {
      const tracker = new KinematicSubjectTracker();

      // Frame 1 at t=0.0s (subject at 0.50)
      const res1 = tracker.update(
        { centerX: 0.50, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.25, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.0
      );
      expect(res1.hasSubject).toBe(true);
      expect(res1.head.centerX).toBeCloseTo(0.50, 2);

      // Frame 2 at t=0.1s (subject smoothly moves right to 0.54)
      const res2 = tracker.update(
        { centerX: 0.54, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.29, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.1
      );
      expect(res2.head.centerX).toBeGreaterThan(0.50);
      expect(res2.head.centerX).toBeLessThan(0.55);

      // Frame 3 at t=0.2s (subject continues right to 0.58)
      const res3 = tracker.update(
        { centerX: 0.58, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.33, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.2
      );
      expect(res3.head.centerX).toBeGreaterThan(res2.head.centerX);
    });

    it("rejects sudden spatial outliers without jumping", () => {
      const tracker = new KinematicSubjectTracker();

      // Initialize at 0.50
      tracker.update(
        { centerX: 0.50, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.25, y: 0.20, width: 0.50, height: 0.70 },
        0.90,
        0.0
      );

      // Outlier frame: sudden reflection or flash measured at 0.95
      const outlier = tracker.update(
        { centerX: 0.95, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.70, y: 0.20, width: 0.50, height: 0.70 },
        0.80,
        0.033
      );

      // Tracker must NOT jump to 0.95! Due to outlier gating, it stays well below 0.65
      expect(outlier.head.centerX).toBeLessThan(0.65);
      expect(outlier.head.centerX).toBeGreaterThan(0.48);
    });

    it("coasts smoothly on momentum during temporary occlusions", () => {
      const tracker = new KinematicSubjectTracker();

      // Move rightward with velocity
      tracker.update(
        { centerX: 0.40, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.15, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.0
      );
      tracker.update(
        { centerX: 0.46, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.21, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.1
      );

      // Frame with lost detection (hand in front of face / blink)
      const occluded = tracker.update(null, null, 0, 0.2);
      expect(occluded.hasSubject).toBe(true);
      // Maintained forward momentum
      expect(occluded.head.centerX).toBeGreaterThan(0.424);
    });

    it("resets state when seek or new video begins at timestamp 0", () => {
      const tracker = new KinematicSubjectTracker();

      tracker.update(
        { centerX: 0.80, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.55, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        5.0
      );

      // Seek back to t=0
      const seekReset = tracker.update(
        { centerX: 0.30, centerY: 0.35, radiusX: 0.15, radiusY: 0.15 },
        { x: 0.05, y: 0.20, width: 0.50, height: 0.70 },
        0.95,
        0.0
      );

      // Instantly resets and adopts 0.30 without lingering at 0.80
      expect(seekReset.head.centerX).toBeCloseTo(0.30, 2);
    });
  });

  describe("AccurateSubjectModel", () => {
    function generateFrame(width: number, height: number, subjectCenterX: number) {
      const rgba = new Uint8ClampedArray(width * height * 4);
      // Neutral background (R=50, G=55, B=65)
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        rgba[idx] = 50;
        rgba[idx + 1] = 55;
        rgba[idx + 2] = 65;
        rgba[idx + 3] = 255;
      }

      const hX = Math.round(width * subjectCenterX);
      const hY = Math.round(height * 0.35);
      const rX = Math.round(width * 0.12);
      const rY = Math.round(height * 0.14);

      // Draw Head (skin tone)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = (x - hX) / rX;
          const dy = (y - hY) / rY;
          if (dx * dx + dy * dy <= 1.0) {
            const idx = (y * width + x) * 4;
            rgba[idx] = 215;     // R
            rgba[idx + 1] = 155; // G
            rgba[idx + 2] = 125; // B
            rgba[idx + 3] = 255;
          }

          // Draw Torso
          const torsoDy = y - hY;
          if (torsoDy > rY * 0.7 && torsoDy < height * 0.55) {
            if (Math.abs(x - hX) <= rX * 1.9) {
              const idx = (y * width + x) * 4;
              rgba[idx] = 35;
              rgba[idx + 1] = 40;
              rgba[idx + 2] = 50;
              rgba[idx + 3] = 255;
            }
          }
        }
      }
      return rgba;
    }

    it("extracts accurate alpha mask with edge feathering and valid metrics", () => {
      const model = new AccurateSubjectModel();
      const w = 320;
      const h = 240;
      const frame = generateFrame(w, h, 0.50);

      const res = model.processFrame(frame, w, h, 0.0);
      expect(res.faceDetected).toBe(true);
      expect(res.metrics.hasSubject).toBe(true);
      expect(res.metrics.confidence).toBeGreaterThan(0.7);

      // Centroid must be centered
      expect(res.metrics.headRegion.centerX).toBeCloseTo(0.50, 1);

      // Mask must have solid core (255) and soft feathered edge (>0 and <255)
      let hasCore = false;
      let hasFeathered = false;
      for (let i = 0; i < res.mask.length; i++) {
        if (res.mask[i] === 255) hasCore = true;
        if (res.mask[i] > 10 && res.mask[i] < 240) hasFeathered = true;
      }
      expect(hasCore).toBe(true);
      expect(hasFeathered).toBe(true);
    });
  });
});
