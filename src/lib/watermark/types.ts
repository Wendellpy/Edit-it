/**
 * BolSub Studio Watermark Removal Types & Presets
 * 100% on-device AI watermark detection and inpainting.
 */

export type WatermarkPresetId =
  | "custom"
  | "gemini"
  | "kling"
  | "runway"
  | "sora"
  | "luma"
  | "pika"
  | "hailuo"
  | "tiktok"
  | "midjourney"
  | "haiper"
  | "vidu"
  | "ideogram";

export interface LearnedLogoData {
  presetId: WatermarkPresetId;
  platformName: string;
  shapeType: string;
  sampleCount: number;
  clipCount: number;
  extractedAt: string;
  normalizedMask: number[]; // 16x16 normalized weights (256 items, 0 to 1)
  coverageRatio: number;
  detectedRatioLabel: string;
  maskDataUrl?: string;
}

export type AspectRatioCategory =
  | "landscape"   // 16:9, ~1.77
  | "vertical"    // 9:16, ~0.56
  | "square"      // 1:1, ~1.00
  | "portrait"    // 4:5, ~0.80
  | "ultrawide";  // 21:9, ~2.33

export type InpaintMethod = "content-aware" | "bilateral-blur" | "ffmpeg-delogo";

export interface NormalizedROI {
  id?: string;
  name?: string;
  x: number;      // 0.0 to 1.0 (left ratio)
  y: number;      // 0.0 to 1.0 (top ratio)
  width: number;  // 0.0 to 1.0 (width ratio)
  height: number; // 0.0 to 1.0 (height ratio)
}

export interface PixelROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InpaintOptions {
  method?: InpaintMethod;
  featherRadius?: number;    // default 6 (pixels)
  blendStrength?: number;    // 0.0 to 1.0, default 1.0
  preserveGrain?: boolean;   // inject subtle matching film/AI grain to prevent plastic smear
  grainAmount?: number;      // 0.0 to 1.0, default 0.12
  useShapeMask?: boolean;    // only inpaint exact logo shape/silhouette, preserving background pixels
  maskSensitivity?: number;  // 0.0 to 1.0, default 0.50
  platformId?: WatermarkPresetId;
}

export interface WatermarkPreset {
  id: WatermarkPresetId;
  name: string;
  badge: string;
  description: string;
  defaultRois: NormalizedROI[];
  roisByAspectRatio?: Partial<Record<AspectRatioCategory, NormalizedROI[]>>;
}

export interface WatermarkDetectionResult {
  presetId: WatermarkPresetId;
  platformName: string;
  confidence: number; // 0.0 to 1.0
  detectionSource: "filename" | "visual_scan" | "aspect_ratio_heuristic" | "preset_default";
  aspectRatioCategory: AspectRatioCategory;
  aspectRatioLabel: string;
  rois: NormalizedROI[];
  explanation: string;
}

export const WATERMARK_PRESETS: Record<WatermarkPresetId, WatermarkPreset> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badge: "Google AI",
    description: "Removes Google Gemini, Veo, and Imagen 3 corner star / SynthID watermark",
    defaultRois: [
      { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.885, y: 0.875, width: 0.065, height: 0.085 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.885, y: 0.875, width: 0.065, height: 0.085 },
      ],
      vertical: [
        { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.786, y: 0.871, width: 0.094, height: 0.058 },
      ],
      square: [
        { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.840, y: 0.870, width: 0.095, height: 0.075 },
      ],
      portrait: [
        { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.810, y: 0.870, width: 0.095, height: 0.065 },
      ],
      ultrawide: [
        { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.910, y: 0.860, width: 0.055, height: 0.095 },
      ],
    },
  },
  kling: {
    id: "kling",
    name: "Kling AI",
    badge: "AI Video",
    description: "Targets the bottom-right Kling watermark stamp and logo",
    defaultRois: [
      { id: "kling_br", name: "Bottom-Right Logo", x: 0.76, y: 0.88, width: 0.22, height: 0.095 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "kling_br", name: "Bottom-Right Logo", x: 0.76, y: 0.88, width: 0.22, height: 0.095 },
      ],
      vertical: [
        { id: "kling_br", name: "Bottom-Right Logo", x: 0.62, y: 0.91, width: 0.35, height: 0.06 },
      ],
      square: [
        { id: "kling_br", name: "Bottom-Right Logo", x: 0.72, y: 0.89, width: 0.25, height: 0.08 },
      ],
      portrait: [
        { id: "kling_br", name: "Bottom-Right Logo", x: 0.68, y: 0.90, width: 0.29, height: 0.07 },
      ],
      ultrawide: [
        { id: "kling_br", name: "Bottom-Right Logo", x: 0.83, y: 0.86, width: 0.15, height: 0.11 },
      ],
    },
  },
  runway: {
    id: "runway",
    name: "Runway Gen-2/3",
    badge: "AI Video",
    description: "Removes Runway text/icon mark from bottom-right corner",
    defaultRois: [
      { id: "runway_br", name: "Bottom-Right Logo", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "runway_br", name: "Bottom-Right Logo", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
      ],
      vertical: [
        { id: "runway_br", name: "Bottom-Right Logo", x: 0.65, y: 0.92, width: 0.31, height: 0.055 },
      ],
      square: [
        { id: "runway_br", name: "Bottom-Right Logo", x: 0.74, y: 0.90, width: 0.23, height: 0.07 },
      ],
      portrait: [
        { id: "runway_br", name: "Bottom-Right Logo", x: 0.70, y: 0.91, width: 0.27, height: 0.065 },
      ],
      ultrawide: [
        { id: "runway_br", name: "Bottom-Right Logo", x: 0.85, y: 0.87, width: 0.13, height: 0.095 },
      ],
    },
  },
  sora: {
    id: "sora",
    name: "OpenAI Sora",
    badge: "AI Video",
    description: "Inpaints the bottom-right or top-right Sora watermark badge",
    defaultRois: [
      { id: "sora_br", name: "Bottom-Right Badge", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "sora_br", name: "Bottom-Right Badge", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
      ],
      vertical: [
        { id: "sora_br", name: "Bottom-Right Badge", x: 0.62, y: 0.92, width: 0.34, height: 0.055 },
      ],
      square: [
        { id: "sora_br", name: "Bottom-Right Badge", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      ],
      portrait: [
        { id: "sora_br", name: "Bottom-Right Badge", x: 0.67, y: 0.91, width: 0.30, height: 0.065 },
      ],
      ultrawide: [
        { id: "sora_br", name: "Bottom-Right Badge", x: 0.84, y: 0.87, width: 0.14, height: 0.095 },
      ],
    },
  },
  luma: {
    id: "luma",
    name: "Luma Dream Machine",
    badge: "AI Video",
    description: "Removes Luma AI aperture icon and brand label",
    defaultRois: [
      { id: "luma_br", name: "Bottom-Right Icon", x: 0.76, y: 0.86, width: 0.22, height: 0.11 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "luma_br", name: "Bottom-Right Icon", x: 0.76, y: 0.86, width: 0.22, height: 0.11 },
      ],
      vertical: [
        { id: "luma_br", name: "Bottom-Right Icon", x: 0.60, y: 0.90, width: 0.36, height: 0.075 },
      ],
      square: [
        { id: "luma_br", name: "Bottom-Right Icon", x: 0.70, y: 0.88, width: 0.27, height: 0.09 },
      ],
      portrait: [
        { id: "luma_br", name: "Bottom-Right Icon", x: 0.65, y: 0.89, width: 0.31, height: 0.08 },
      ],
      ultrawide: [
        { id: "luma_br", name: "Bottom-Right Icon", x: 0.82, y: 0.85, width: 0.16, height: 0.12 },
      ],
    },
  },
  pika: {
    id: "pika",
    name: "Pika Labs",
    badge: "AI Video",
    description: "Targets the bottom-right Pika star emblem and typography",
    defaultRois: [
      { id: "pika_br", name: "Bottom-Right Emblem", x: 0.81, y: 0.87, width: 0.17, height: 0.09 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "pika_br", name: "Bottom-Right Emblem", x: 0.81, y: 0.87, width: 0.17, height: 0.09 },
      ],
      vertical: [
        { id: "pika_br", name: "Bottom-Right Emblem", x: 0.66, y: 0.91, width: 0.30, height: 0.06 },
      ],
      square: [
        { id: "pika_br", name: "Bottom-Right Emblem", x: 0.75, y: 0.89, width: 0.22, height: 0.08 },
      ],
      portrait: [
        { id: "pika_br", name: "Bottom-Right Emblem", x: 0.70, y: 0.90, width: 0.26, height: 0.07 },
      ],
      ultrawide: [
        { id: "pika_br", name: "Bottom-Right Emblem", x: 0.86, y: 0.86, width: 0.12, height: 0.10 },
      ],
    },
  },
  hailuo: {
    id: "hailuo",
    name: "Hailuo / MiniMax",
    badge: "AI Video",
    description: "Removes bottom-right Hailuo AI signature badge",
    defaultRois: [
      { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.77, y: 0.88, width: 0.21, height: 0.085 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.77, y: 0.88, width: 0.21, height: 0.085 },
      ],
      vertical: [
        { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.62, y: 0.92, width: 0.34, height: 0.055 },
      ],
      square: [
        { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      ],
      portrait: [
        { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.67, y: 0.91, width: 0.30, height: 0.065 },
      ],
      ultrawide: [
        { id: "hailuo_br", name: "Bottom-Right Stamp", x: 0.83, y: 0.86, width: 0.15, height: 0.10 },
      ],
    },
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok / Reels",
    badge: "Social",
    description: "Dual-corner logo removal for top-left and bottom-right floating stamps",
    defaultRois: [
      { id: "tt_tl", name: "Top-Left Stamp", x: 0.03, y: 0.03, width: 0.22, height: 0.065 },
      { id: "tt_br", name: "Bottom-Right Stamp", x: 0.75, y: 0.90, width: 0.22, height: 0.065 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "tt_tl", name: "Top-Left Stamp", x: 0.03, y: 0.03, width: 0.22, height: 0.065 },
        { id: "tt_br", name: "Bottom-Right Stamp", x: 0.75, y: 0.90, width: 0.22, height: 0.065 },
      ],
      vertical: [
        { id: "tt_tl", name: "Top-Left Stamp", x: 0.04, y: 0.05, width: 0.38, height: 0.045 },
        { id: "tt_br", name: "Bottom-Right Stamp", x: 0.58, y: 0.91, width: 0.38, height: 0.045 },
      ],
      square: [
        { id: "tt_tl", name: "Top-Left Stamp", x: 0.03, y: 0.04, width: 0.28, height: 0.055 },
        { id: "tt_br", name: "Bottom-Right Stamp", x: 0.68, y: 0.91, width: 0.28, height: 0.055 },
      ],
      portrait: [
        { id: "tt_tl", name: "Top-Left Stamp", x: 0.04, y: 0.04, width: 0.32, height: 0.05 },
        { id: "tt_br", name: "Bottom-Right Stamp", x: 0.64, y: 0.91, width: 0.32, height: 0.05 },
      ],
      ultrawide: [
        { id: "tt_tl", name: "Top-Left Stamp", x: 0.03, y: 0.03, width: 0.16, height: 0.08 },
        { id: "tt_br", name: "Bottom-Right Stamp", x: 0.81, y: 0.88, width: 0.16, height: 0.08 },
      ],
    },
  },
  midjourney: {
    id: "midjourney",
    name: "Midjourney",
    badge: "AI Image",
    description: "Targets Midjourney quadrant badges and bottom signature marks",
    defaultRois: [
      { id: "mj_br", name: "Bottom-Right Mark", x: 0.82, y: 0.91, width: 0.16, height: 0.06 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "mj_br", name: "Bottom-Right Mark", x: 0.82, y: 0.91, width: 0.16, height: 0.06 },
      ],
      vertical: [
        { id: "mj_br", name: "Bottom-Right Mark", x: 0.68, y: 0.93, width: 0.28, height: 0.045 },
      ],
      square: [
        { id: "mj_br", name: "Bottom-Right Mark", x: 0.78, y: 0.92, width: 0.20, height: 0.055 },
      ],
    },
  },
  haiper: {
    id: "haiper",
    name: "Haiper AI",
    badge: "AI Video",
    description: "Removes Haiper origami bird emblem and watermark badge",
    defaultRois: [
      { id: "haiper_br", name: "Haiper Emblem", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "haiper_br", name: "Haiper Emblem", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
      ],
      vertical: [
        { id: "haiper_br", name: "Haiper Emblem", x: 0.65, y: 0.92, width: 0.30, height: 0.055 },
      ],
      square: [
        { id: "haiper_br", name: "Haiper Emblem", x: 0.74, y: 0.90, width: 0.23, height: 0.07 },
      ],
    },
  },
  vidu: {
    id: "vidu",
    name: "Vidu AI",
    badge: "AI Video",
    description: "Removes ShengShu Vidu AI prism logo mark",
    defaultRois: [
      { id: "vidu_br", name: "Vidu Logo", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "vidu_br", name: "Vidu Logo", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
      ],
      vertical: [
        { id: "vidu_br", name: "Vidu Logo", x: 0.63, y: 0.92, width: 0.33, height: 0.055 },
      ],
      square: [
        { id: "vidu_br", name: "Vidu Logo", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      ],
    },
  },
  ideogram: {
    id: "ideogram",
    name: "Ideogram",
    badge: "AI Image",
    description: "Removes Ideogram subtle typographic corner mark",
    defaultRois: [
      { id: "ideogram_br", name: "Ideogram Mark", x: 0.82, y: 0.92, width: 0.16, height: 0.055 },
    ],
    roisByAspectRatio: {
      landscape: [
        { id: "ideogram_br", name: "Ideogram Mark", x: 0.82, y: 0.92, width: 0.16, height: 0.055 },
      ],
      vertical: [
        { id: "ideogram_br", name: "Ideogram Mark", x: 0.68, y: 0.93, width: 0.28, height: 0.045 },
      ],
      square: [
        { id: "ideogram_br", name: "Ideogram Mark", x: 0.76, y: 0.92, width: 0.21, height: 0.055 },
      ],
    },
  },
  custom: {
    id: "custom",
    name: "Custom ROI",
    badge: "Interactive",
    description: "Drag, draw and resize custom watermark bounding box anywhere on video/image",
    defaultRois: [
      { id: "custom_box", name: "Watermark Box", x: 0.75, y: 0.85, width: 0.22, height: 0.12 },
    ],
  },
};
