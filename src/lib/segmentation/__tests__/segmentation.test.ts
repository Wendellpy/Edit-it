import { describe, it, expect } from "vitest";
import {
  applyTemporalSmoothing,
  applyExpandContract,
  applyFeather,
  computeSubjectMetrics,
  upsampleMaskBilinear,
  postProcessMask,
} from "../maskPostProcessor";
import { opfsMaskCache } from "../opfsMaskCache";
import { segmentationPipeline } from "../segmentationPipeline";
import { SEGMENTATION_BENCHMARK_RESULTS, runHardwareSegmentationBenchmark } from "../benchmarks";
import { DEFAULT_SEGMENTATION_CONFIG, type SegmentationMaskFrame } from "../types";

describe("Phase 2: Subject Segmentation Pipeline Suite", () => {
  describe("Mask Post-Processing Algorithms", () => {
    it("should smooth mask boundaries over consecutive frames using temporal alpha blending", () => {
      const frameA = new Uint8Array([0, 0, 255, 255]);
      const frameB = new Uint8Array([0, 255, 255, 255]);

      const smoothed = applyTemporalSmoothing(frameB, frameA, 0.5);
      expect(smoothed[0]).toBe(0);
      expect(smoothed[1]).toBe(128); // 0.5 * 0 + 0.5 * 255 = 127.5 -> 128
      expect(smoothed[2]).toBe(255);
      expect(smoothed[3]).toBe(255);
    });

    it("should perform morphological dilation (expand) and erosion (contract)", () => {
      const w = 10;
      const h = 10;
      const mask = new Uint8Array(w * h);

      // Place a single white 2x2 box in the center
      mask[4 * w + 4] = 255;
      mask[4 * w + 5] = 255;
      mask[5 * w + 4] = 255;
      mask[5 * w + 5] = 255;

      const countForeground = (m: Uint8Array) => m.filter((p) => p > 128).length;
      const initialCount = countForeground(mask);
      expect(initialCount).toBe(4);

      // Expand (+1px)
      const expanded = applyExpandContract(mask, w, h, 1);
      const expandedCount = countForeground(expanded);
      expect(expandedCount).toBeGreaterThan(initialCount);

      // Contract (-1px) on expanded mask
      const contracted = applyExpandContract(expanded, w, h, -1);
      const contractedCount = countForeground(contracted);
      expect(contractedCount).toBeLessThan(expandedCount);
    });

    it("should apply two-pass feathering to soften binary edge boundaries", () => {
      const w = 12;
      const h = 12;
      const mask = new Uint8Array(w * h);

      // Half black, half white
      for (let y = 0; y < h; y++) {
        for (let x = 6; x < w; x++) {
          mask[y * w + x] = 255;
        }
      }

      const feathered = applyFeather(mask, w, h, 2);

      // Pixels immediately at the boundary should have intermediate alpha values
      const boundaryVal = feathered[6 * w + 6];
      expect(boundaryVal).toBeGreaterThan(0);
      expect(boundaryVal).toBeLessThan(255);
    });

    it("should extract accurate subject bounding box and head region metrics", () => {
      const w = 100;
      const h = 200;
      const synthetic = segmentationPipeline.generateSyntheticSubjectMask(w, h, 0);

      const metrics = computeSubjectMetrics(synthetic, w, h);
      expect(metrics.hasSubject).toBe(true);
      expect(metrics.confidence).toBeGreaterThan(0.7);
      expect(metrics.coveragePercent).toBeGreaterThan(5);

      // Bounding box should center around human silhouette
      expect(metrics.boundingBox.x).toBeGreaterThan(0.1);
      expect(metrics.boundingBox.x + metrics.boundingBox.width).toBeLessThan(0.9);
      expect(metrics.boundingBox.height).toBeGreaterThan(0.4);

      // Head region center should be located in the upper 40%
      expect(metrics.headRegion.centerY).toBeLessThan(0.45);
      expect(metrics.headRegion.centerX).toBeCloseTo(0.5, 1);
    });

    it("should gracefully flag hasSubject=false when frame contains no person", () => {
      const blankMask = new Uint8Array(100 * 100); // All zeros
      const metrics = computeSubjectMetrics(blankMask, 100, 100);

      expect(metrics.hasSubject).toBe(false);
      expect(metrics.coveragePercent).toBe(0);
      expect(metrics.confidence).toBe(0);
    });

    it("should upsample mask smoothly from reduced resolution to target dimensions", () => {
      const srcW = 4;
      const srcH = 4;
      const srcMask = new Uint8Array([
        0, 0, 255, 255,
        0, 0, 255, 255,
        0, 0, 255, 255,
        0, 0, 255, 255,
      ]);

      const dstW = 8;
      const dstH = 8;
      const upsampled = upsampleMaskBilinear(srcMask, srcW, srcH, dstW, dstH);

      expect(upsampled.length).toBe(dstW * dstH);
      // Leftmost pixel should remain 0
      expect(upsampled[0]).toBe(0);
      // Rightmost pixel should remain 255
      expect(upsampled[7]).toBe(255);
    });
  });

  describe("OPFS Mask Storage & Cache Layer", () => {
    it("should cache and retrieve segmentation frames with timestamp tolerance", async () => {
      const videoHash = "test_video_hash_123";
      const testFrame: SegmentationMaskFrame = {
        timestamp: 1.45,
        width: 100,
        height: 100,
        maskData: new Uint8Array(10000).fill(128),
        metrics: {
          hasSubject: true,
          confidence: 0.95,
          coveragePercent: 22.5,
          boundingBox: { x: 0.2, y: 0.2, width: 0.6, height: 0.7 },
          headRegion: { centerX: 0.5, centerY: 0.3, radiusX: 0.15, radiusY: 0.15 },
          subjectCount: 1,
          isLeavingFrame: false,
        },
      };

      await opfsMaskCache.saveMask(videoHash, testFrame);

      // Exact match
      const retrieved = await opfsMaskCache.getMask(videoHash, 1.45);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.timestamp).toBe(1.45);
      expect(retrieved?.metrics.hasSubject).toBe(true);

      // Match within 40ms tolerance
      const nearMatch = await opfsMaskCache.getMask(videoHash, 1.47, 0.05);
      expect(nearMatch).not.toBeNull();

      // Clear cache
      await opfsMaskCache.clearCacheForVideo(videoHash);
      const afterClear = await opfsMaskCache.getMask(videoHash, 1.45);
      expect(afterClear).toBeNull();
    });
  });

  describe("Segmentation Model Benchmarking & Commercial Licensing Audit", () => {
    it("should verify that the primary model is 100% Apache-2.0 and commercial safe", () => {
      const primary = SEGMENTATION_BENCHMARK_RESULTS.find(
        (m) => m.recommendation === "selected_primary"
      );
      expect(primary).toBeDefined();
      expect(primary?.license).toBe("Apache-2.0");
      expect(primary?.isCommercialSafe).toBe(true);
      expect(primary?.throughputFpsWebGPU).toBeGreaterThan(60); // 60+ fps throughput
    });

    it("should reject non-commercial and GPL models to prevent license violations", () => {
      const rejected = SEGMENTATION_BENCHMARK_RESULTS.filter(
        (m) => m.recommendation === "rejected_license"
      );
      expect(rejected.length).toBeGreaterThanOrEqual(2);
      for (const r of rejected) {
        expect(r.isCommercialSafe).toBe(false);
      }
    });

    it("should run hardware benchmark and report latency numbers", async () => {
      const bench = await runHardwareSegmentationBenchmark(10);
      expect(bench.avgInferenceMs).toBeGreaterThan(0);
      expect(bench.measuredFps).toBeGreaterThan(30);
      expect(bench.syntheticEdgeScore).toBeGreaterThan(8.0);
    });
  });
});
