export type MaskQualityTier = "fast" | "balanced" | "ultra";

export interface SegmentationConfig {
  qualityTier: MaskQualityTier;
  featherRadius: number;         // 0 to 20 pixels
  expandContractPx: number;      // -10 to +10 pixels (negative = contract/erode, positive = expand/dilate)
  temporalSmoothingAlpha: number;// 0.0 (no history) to 0.9 (heavy smoothing)
  targetResolution: number;      // Longest dimension: 256, 384, or 512
  enableEdgeRefinement: boolean; // Bilateral/guided upsampling
}

export const DEFAULT_SEGMENTATION_CONFIG: SegmentationConfig = {
  qualityTier: "balanced",
  featherRadius: 4,
  expandContractPx: 0,
  temporalSmoothingAlpha: 0.70,
  targetResolution: 384,
  enableEdgeRefinement: true,
};

export interface SubjectBoundingBox {
  x: number;      // Normalized 0.0 to 1.0
  y: number;      // Normalized 0.0 to 1.0
  width: number;  // Normalized 0.0 to 1.0
  height: number; // Normalized 0.0 to 1.0
}

export interface HeadRegion {
  centerX: number; // Normalized 0.0 to 1.0
  centerY: number; // Normalized 0.0 to 1.0
  radiusX: number; // Normalized 0.0 to 1.0
  radiusY: number; // Normalized 0.0 to 1.0
}

export interface SubjectMetrics {
  hasSubject: boolean;
  confidence: number;            // 0.0 to 1.0
  coveragePercent: number;       // Percentage of frame covered by subject (0 to 100)
  boundingBox: SubjectBoundingBox;
  headRegion: HeadRegion;
  subjectCount: number;          // 0, 1, or multiple
  isLeavingFrame: boolean;
}

export interface SegmentationMaskFrame {
  timestamp: number;
  width: number;
  height: number;
  // 8-bit alpha mask values: 0 = background, 255 = foreground subject
  maskData: Uint8Array;
  metrics: SubjectMetrics;
}

export interface ModelBenchmarkResult {
  modelName: string;
  license: string;
  isCommercialSafe: boolean;
  modelSizeMb: number;
  inputResolution: string;
  webGpuSpeedMs: number;
  wasmSpeedMs: number;
  throughputFpsWebGPU: number;
  throughputFpsWasm: number;
  edgeQualityScore: number;     // 1 to 10
  temporalStabilityScore: number;// 1 to 10
  recommendation: "selected_primary" | "selected_ultra" | "rejected_license" | "rejected_performance";
  notes: string;
}
