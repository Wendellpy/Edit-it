/**
 * Dynamic Video Subject Analyzer
 *
 * 100% on-device, local-first computer vision pipeline that analyzes actual video frames
 * to dynamically locate and segment the main human subject (speaker/creator).
 *
 * Combines:
 * 1. Deep Learning MobileNetV3 Selfie Segmenter via MediaPipe WebGPU/WASM (state-of-the-art accuracy)
 * 2. Temporal kinematic Kalman tracking for smooth, jitter-free positioning
 * 3. Fallback to heuristic and synthetic analysis in headless/test environments
 */

import type { SubjectMetrics } from "./types";
import { AccurateSubjectModel } from "./subjectTrackingModel";
import { mlSubjectSegmenter } from "./mlSubjectSegmenter";

export interface DynamicAnalysisResult {
  mask: Uint8Array;
  metrics: SubjectMetrics;
  faceDetected: boolean;
  subjectCentroid: { x: number; y: number };
}

export class DynamicSubjectAnalyzer {
  private model = new AccurateSubjectModel();

  /**
   * Resets temporal frame state (e.g. on clip change or seek).
   */
  reset(): void {
    this.model.reset();
    mlSubjectSegmenter.reset();
  }

  /**
   * High-accuracy ML-driven async frame analysis.
   * Runs MediaPipe neural network on WebGPU/WASM when available, with graceful fallback.
   */
  async analyzeFrameAsync(
    source: CanvasImageSource,
    width: number,
    height: number,
    timestamp = 0
  ): Promise<DynamicAnalysisResult> {
    try {
      const mlRes = await mlSubjectSegmenter.segmentFrame(source, width, height, timestamp);
      if (mlRes && mlRes.mask) {
        return {
          mask: mlRes.mask,
          metrics: mlRes.metrics,
          faceDetected: mlRes.hasSubject,
          subjectCentroid: {
            x: mlRes.metrics.headRegion.centerX,
            y: mlRes.metrics.headRegion.centerY,
          },
        };
      }
    } catch {
      // Graceful fallback to heuristic model below
    }

    // In-memory canvas extraction fallback for heuristic processing
    if (typeof document !== "undefined") {
      try {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(source, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          return this.analyzeFrame(imgData.data, width, height, timestamp);
        }
      } catch {}
    }

    return this.model.processFrame(new Uint8ClampedArray(width * height * 4), width, height, timestamp);
  }

  /**
   * Synchronous frame analysis (used by tests and heuristic fallback).
   */
  analyzeFrame(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    timestamp = 0
  ): DynamicAnalysisResult {
    return this.model.processFrame(rgba, width, height, timestamp);
  }
}

export const dynamicSubjectAnalyzer = new DynamicSubjectAnalyzer();
