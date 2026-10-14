/**
 * Dynamic Video Subject Analyzer
 *
 * 100% on-device, local-first computer vision pipeline that analyzes actual video frames
 * to dynamically locate and segment the main human subject (speaker/creator).
 *
 * Replaces static center-ellipse heuristics with real dynamic frame analysis:
 * 1. Adaptive perimeter background color clustering
 * 2. YCbCr & normalized rgb human skin chrominance locus modeling
 * 3. Dynamic head/face centroid and scale detection
 * 4. Torso, hair, and clothing silhouette expansion with Sobel gradient boundary snapping
 * 5. Temporal motion difference accumulation
 * 6. Dynamic SubjectMetrics calculation reflecting the real subject in each video
 */

import type { SubjectMetrics } from "./types";
import { AccurateSubjectModel } from "./subjectTrackingModel";

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
  }

  /**
   * Analyzes an RGBA video frame and returns the dynamic subject mask and metrics.
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
