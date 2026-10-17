/**
 * BolSub Studio AI Watermark Logo Dataset & Shape Fingerprints
 * Curated from empirical datasets across modern generative AI models.
 * Contains normalized logo geometries, iconic glyph bitmaps, and color signatures
 * for Google Gemini (Veo / Imagen 3), Kling AI, Runway Gen-2/3, Sora,
 * Luma Dream Machine, Pika Labs, Hailuo, TikTok, and DALL-E.
 */

import type {
  WatermarkPresetId,
  AspectRatioCategory,
  NormalizedROI,
  LearnedLogoData,
} from "./types";

export type LogoShapeType =
  | "sparkle_star"       // Google Gemini 4-pointed diamond star
  | "kling_aperture"     // Kling camera shutter + Chinese/English typography
  | "runway_wordmark"    // Runway bold blocky sans-serif
  | "sora_pill"          // OpenAI flower spiral in pill badge
  | "luma_iris"          // Luma 6-blade camera iris
  | "pika_star"          // Pika sparkling celestial star
  | "hailuo_shell"       // Hailuo spiral shell emblem
  | "tiktok_note"        // TikTok musical note with cyan/magenta aberration
  | "dalle_blocks"       // DALL-E 5-square color palette
  | "midjourney_sail"    // Midjourney sailboat emblem
  | "haiper_origami"     // Haiper origami bird emblem
  | "vidu_prism"         // Vidu overlapping prism triangles
  | "ideogram_type";     // Ideogram typographic mark

export interface LogoDatasetEntry {
  id: WatermarkPresetId;
  name: string;
  badge: string;
  shapeType: LogoShapeType;
  description: string;
  isTransparent: boolean;
  typicalOpacity: number; // 0.0 to 1.0
  chromaticGlitch?: boolean;
  aspectPriors: Record<AspectRatioCategory, NormalizedROI>;
  // 16x16 normalized binary glyph footprint (1 = logo pixel, 0 = background)
  glyphMatrix16: number[];
  colorProfile: {
    primaryLumRange: [number, number]; // [minLum, maxLum]
    hasDarkPill: boolean;
    hasMultiColor?: boolean;
  };
}

/**
 * 16x16 Binary Bitmap Generators for iconic AI Logo Glyphs
 */
// 1. Gemini 4-pointed diamond star with tapered rays
const GEMINI_GLYPH: number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
  0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
  0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

// 2. Kling AI stylized camera lens & badge
const KLING_GLYPH: number[] = [
  0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,
  0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
  0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,
  1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,
  1,1,0,1,1,0,0,0,0,0,0,1,1,0,1,1,
  1,1,0,1,1,0,0,1,1,0,0,1,1,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,1,1,0,0,1,1,0,0,1,1,0,1,1,
  1,1,0,1,1,0,0,0,0,0,0,1,1,0,1,1,
  1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,
  0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,
  0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
  0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,
  0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,
];

// 3. Runway blocky "R" icon
const RUNWAY_GLYPH: number[] = [
  1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
  1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,
  1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,
  1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,
  1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
  1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,
  1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,
  1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,
  1,1,0,0,0,0,0,0,0,1,1,1,0,0,0,0,
  1,1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,
  1,1,0,0,0,0,0,0,0,0,0,1,1,1,0,0,
  1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,
  1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,
];

// 4. TikTok music note with signature offset
const TIKTOK_GLYPH: number[] = [
  0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,
  0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,
  0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,1,
  0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,
  0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,
  0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,
  0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,1,
  0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,
  0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,
  0,0,0,1,1,1,1,0,1,1,0,0,0,0,0,0,
  0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
  1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,
  0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,
  0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,
];

// 5. Luma camera iris / aperture
const LUMA_GLYPH: number[] = [
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
  0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,
  0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0,
  0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,
  1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,1,1,0,1,1,1,1,0,1,1,0,1,1,
  1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,
  0,1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,
  0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0,
  0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,
  0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
];

// 6. OpenAI Sora spiral whorl / pill mark
const SORA_GLYPH: number[] = [
  0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,
  1,1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,
  1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,
  1,0,1,1,0,0,1,1,1,1,0,0,1,1,0,1,
  1,0,1,1,0,1,1,0,0,1,1,0,1,1,0,1,
  1,0,0,1,1,1,0,1,1,0,1,1,1,0,0,1,
  1,1,0,0,1,1,0,1,1,0,1,1,0,0,1,1,
  1,1,0,0,1,1,0,1,1,0,1,1,0,0,1,1,
  1,0,0,1,1,1,0,1,1,0,1,1,1,0,0,1,
  1,0,1,1,0,1,1,0,0,1,1,0,1,1,0,1,
  1,0,1,1,0,0,1,1,1,1,0,0,1,1,0,1,
  1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,
  1,1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,
  0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,
  0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
];

// 7. Pika Labs sparkling celestial star + satellite spark
const PIKA_GLYPH: number[] = [
  0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,
  0,0,0,0,0,1,1,1,1,0,0,1,1,1,1,0,
  0,0,0,0,1,1,1,1,1,1,0,0,1,1,0,0,
  0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,
  0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,
];

// 8. Hailuo AI nautilus spiral shell
const HAILUO_GLYPH: number[] = [
  0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,
  0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,
  1,1,0,0,1,1,1,1,1,1,0,0,1,1,0,0,
  1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,
  1,1,0,1,1,0,1,0,1,1,0,0,1,1,0,0,
  1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,0,
  1,1,0,0,1,1,1,1,1,0,0,1,1,0,0,0,
  0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,
  0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

// 9. Midjourney sailing ship / quadrant mark
const MIDJOURNEY_GLYPH: number[] = [
  0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,
  0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,
  0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,
  0,0,1,1,0,0,0,1,1,0,1,1,1,0,0,0,
  0,1,1,0,0,0,0,1,1,0,0,1,1,1,0,0,
  1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,
  0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,
  0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,
  0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,
  0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

// 10. Haiper origami geometric bird
const HAIPER_GLYPH: number[] = [
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,1,1,0,0,1,1,1,1,0,0,0,0,
  0,0,0,1,1,0,0,0,0,1,1,1,1,0,0,0,
  0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
  0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,0,
  1,1,1,1,0,0,0,1,1,0,0,0,0,1,1,1,
  1,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,
  1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,1,
  1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
  0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,
  0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

// 11. Vidu AI optical prism triangles
const VIDU_GLYPH: number[] = [
  0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
  0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,
  0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,
  0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
  0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,
  1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,
  1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,
  0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,
  0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,
  0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,
  0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,
  0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
];

// 12. Ideogram typographic italic "i"
const IDEOGRAM_GLYPH: number[] = [
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,
  0,0,0,0,0,1,1,1,0,0,1,1,0,0,0,0,
  0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,
  0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,
];

/**
 * Exhaustive AI Watermark Dataset with aspect ratio coordinates and shape templates.
 */
export const AI_WATERMARK_DATASET: Record<WatermarkPresetId, LogoDatasetEntry> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badge: "Google AI",
    shapeType: "sparkle_star",
    description: "Gemini 4-pointed radiant sparkle star with SynthID metadata flag",
    isTransparent: true,
    typicalOpacity: 0.75,
    glyphMatrix16: GEMINI_GLYPH,
    colorProfile: {
      primaryLumRange: [40, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.885, y: 0.875, width: 0.065, height: 0.085 },
      vertical: { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.786, y: 0.871, width: 0.094, height: 0.058 },
      square: { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.840, y: 0.870, width: 0.095, height: 0.075 },
      portrait: { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.810, y: 0.870, width: 0.095, height: 0.065 },
      ultrawide: { id: "gemini_br", name: "Gemini Sparkle Mark", x: 0.910, y: 0.860, width: 0.055, height: 0.095 },
    },
  },

  kling: {
    id: "kling",
    name: "Kling AI",
    badge: "AI Video",
    shapeType: "kling_aperture",
    description: "Kuaishou Kling camera aperture logo with bilingual typography",
    isTransparent: false,
    typicalOpacity: 0.85,
    glyphMatrix16: KLING_GLYPH,
    colorProfile: {
      primaryLumRange: [200, 255],
      hasDarkPill: true,
    },
    aspectPriors: {
      landscape: { id: "kling_br", name: "Kling Logo Stamp", x: 0.76, y: 0.88, width: 0.22, height: 0.095 },
      vertical: { id: "kling_br", name: "Kling Logo Stamp", x: 0.62, y: 0.91, width: 0.35, height: 0.06 },
      square: { id: "kling_br", name: "Kling Logo Stamp", x: 0.72, y: 0.89, width: 0.25, height: 0.08 },
      portrait: { id: "kling_br", name: "Kling Logo Stamp", x: 0.68, y: 0.90, width: 0.29, height: 0.07 },
      ultrawide: { id: "kling_br", name: "Kling Logo Stamp", x: 0.83, y: 0.86, width: 0.15, height: 0.11 },
    },
  },

  runway: {
    id: "runway",
    name: "Runway Gen-2/3",
    badge: "AI Video",
    shapeType: "runway_wordmark",
    description: "Runway all-caps bold wordmark and stylized R glyph",
    isTransparent: true,
    typicalOpacity: 0.80,
    glyphMatrix16: RUNWAY_GLYPH,
    colorProfile: {
      primaryLumRange: [190, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "runway_br", name: "Runway Badge", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
      vertical: { id: "runway_br", name: "Runway Badge", x: 0.65, y: 0.92, width: 0.31, height: 0.055 },
      square: { id: "runway_br", name: "Runway Badge", x: 0.74, y: 0.90, width: 0.23, height: 0.07 },
      portrait: { id: "runway_br", name: "Runway Badge", x: 0.70, y: 0.91, width: 0.27, height: 0.065 },
      ultrawide: { id: "runway_br", name: "Runway Badge", x: 0.85, y: 0.87, width: 0.13, height: 0.095 },
    },
  },

  sora: {
    id: "sora",
    name: "OpenAI Sora",
    badge: "AI Video",
    shapeType: "sora_pill",
    description: "OpenAI floral spiral and Sora clean typography pill",
    isTransparent: true,
    typicalOpacity: 0.85,
    glyphMatrix16: SORA_GLYPH,
    colorProfile: {
      primaryLumRange: [210, 255],
      hasDarkPill: true,
    },
    aspectPriors: {
      landscape: { id: "sora_br", name: "Sora Pill Badge", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
      vertical: { id: "sora_br", name: "Sora Pill Badge", x: 0.62, y: 0.92, width: 0.34, height: 0.055 },
      square: { id: "sora_br", name: "Sora Pill Badge", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      portrait: { id: "sora_br", name: "Sora Pill Badge", x: 0.67, y: 0.91, width: 0.30, height: 0.065 },
      ultrawide: { id: "sora_br", name: "Sora Pill Badge", x: 0.84, y: 0.87, width: 0.14, height: 0.095 },
    },
  },

  luma: {
    id: "luma",
    name: "Luma Dream Machine",
    badge: "AI Video",
    shapeType: "luma_iris",
    description: "Luma AI camera iris shutter emblem and brand text",
    isTransparent: true,
    typicalOpacity: 0.70,
    glyphMatrix16: LUMA_GLYPH,
    colorProfile: {
      primaryLumRange: [180, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "luma_br", name: "Luma Aperture", x: 0.76, y: 0.86, width: 0.22, height: 0.11 },
      vertical: { id: "luma_br", name: "Luma Aperture", x: 0.60, y: 0.90, width: 0.36, height: 0.075 },
      square: { id: "luma_br", name: "Luma Aperture", x: 0.70, y: 0.88, width: 0.27, height: 0.09 },
      portrait: { id: "luma_br", name: "Luma Aperture", x: 0.65, y: 0.89, width: 0.31, height: 0.08 },
      ultrawide: { id: "luma_br", name: "Luma Aperture", x: 0.82, y: 0.85, width: 0.16, height: 0.12 },
    },
  },

  pika: {
    id: "pika",
    name: "Pika Labs",
    badge: "AI Video",
    shapeType: "pika_star",
    description: "Pika 4-pointed glowing star emblem and wordmark",
    isTransparent: true,
    typicalOpacity: 0.80,
    glyphMatrix16: PIKA_GLYPH,
    colorProfile: {
      primaryLumRange: [200, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "pika_br", name: "Pika Star Emblem", x: 0.81, y: 0.87, width: 0.17, height: 0.09 },
      vertical: { id: "pika_br", name: "Pika Star Emblem", x: 0.66, y: 0.91, width: 0.30, height: 0.06 },
      square: { id: "pika_br", name: "Pika Star Emblem", x: 0.75, y: 0.89, width: 0.22, height: 0.08 },
      portrait: { id: "pika_br", name: "Pika Star Emblem", x: 0.70, y: 0.90, width: 0.26, height: 0.07 },
      ultrawide: { id: "pika_br", name: "Pika Star Emblem", x: 0.86, y: 0.86, width: 0.12, height: 0.10 },
    },
  },

  hailuo: {
    id: "hailuo",
    name: "Hailuo / MiniMax",
    badge: "AI Video",
    shapeType: "hailuo_shell",
    description: "Hailuo AI spiral wave shell stamp",
    isTransparent: false,
    typicalOpacity: 0.85,
    glyphMatrix16: HAILUO_GLYPH,
    colorProfile: {
      primaryLumRange: [200, 255],
      hasDarkPill: true,
    },
    aspectPriors: {
      landscape: { id: "hailuo_br", name: "Hailuo Stamp", x: 0.77, y: 0.88, width: 0.21, height: 0.085 },
      vertical: { id: "hailuo_br", name: "Hailuo Stamp", x: 0.62, y: 0.92, width: 0.34, height: 0.055 },
      square: { id: "hailuo_br", name: "Hailuo Stamp", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      portrait: { id: "hailuo_br", name: "Hailuo Stamp", x: 0.67, y: 0.91, width: 0.30, height: 0.065 },
      ultrawide: { id: "hailuo_br", name: "Hailuo Stamp", x: 0.83, y: 0.86, width: 0.15, height: 0.10 },
    },
  },

  tiktok: {
    id: "tiktok",
    name: "TikTok / Reels",
    badge: "Social",
    shapeType: "tiktok_note",
    description: "TikTok musical note with signature cyan/magenta chromatic fringe",
    isTransparent: true,
    typicalOpacity: 0.88,
    chromaticGlitch: true,
    glyphMatrix16: TIKTOK_GLYPH,
    colorProfile: {
      primaryLumRange: [180, 255],
      hasDarkPill: false,
      hasMultiColor: true,
    },
    aspectPriors: {
      landscape: { id: "tt_br", name: "TikTok Watermark", x: 0.75, y: 0.90, width: 0.22, height: 0.065 },
      vertical: { id: "tt_br", name: "TikTok Watermark", x: 0.58, y: 0.91, width: 0.38, height: 0.045 },
      square: { id: "tt_br", name: "TikTok Watermark", x: 0.68, y: 0.91, width: 0.28, height: 0.055 },
      portrait: { id: "tt_br", name: "TikTok Watermark", x: 0.64, y: 0.91, width: 0.32, height: 0.05 },
      ultrawide: { id: "tt_br", name: "TikTok Watermark", x: 0.81, y: 0.88, width: 0.16, height: 0.08 },
    },
  },

  midjourney: {
    id: "midjourney",
    name: "Midjourney",
    badge: "AI Image",
    shapeType: "midjourney_sail",
    description: "Midjourney sailing ship logo or quadrant crop mark",
    isTransparent: true,
    typicalOpacity: 0.65,
    glyphMatrix16: MIDJOURNEY_GLYPH,
    colorProfile: {
      primaryLumRange: [160, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "mj_br", name: "Midjourney Mark", x: 0.82, y: 0.91, width: 0.16, height: 0.06 },
      vertical: { id: "mj_br", name: "Midjourney Mark", x: 0.68, y: 0.93, width: 0.28, height: 0.045 },
      square: { id: "mj_br", name: "Midjourney Mark", x: 0.78, y: 0.92, width: 0.20, height: 0.055 },
      portrait: { id: "mj_br", name: "Midjourney Mark", x: 0.72, y: 0.92, width: 0.25, height: 0.05 },
      ultrawide: { id: "mj_br", name: "Midjourney Mark", x: 0.86, y: 0.89, width: 0.12, height: 0.07 },
    },
  },

  haiper: {
    id: "haiper",
    name: "Haiper AI",
    badge: "AI Video",
    shapeType: "haiper_origami",
    description: "Haiper origami hummingbird geometric badge",
    isTransparent: true,
    typicalOpacity: 0.80,
    glyphMatrix16: HAIPER_GLYPH,
    colorProfile: {
      primaryLumRange: [190, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "haiper_br", name: "Haiper Emblem", x: 0.80, y: 0.89, width: 0.18, height: 0.08 },
      vertical: { id: "haiper_br", name: "Haiper Emblem", x: 0.65, y: 0.92, width: 0.30, height: 0.055 },
      square: { id: "haiper_br", name: "Haiper Emblem", x: 0.74, y: 0.90, width: 0.23, height: 0.07 },
      portrait: { id: "haiper_br", name: "Haiper Emblem", x: 0.70, y: 0.91, width: 0.27, height: 0.065 },
      ultrawide: { id: "haiper_br", name: "Haiper Emblem", x: 0.85, y: 0.87, width: 0.13, height: 0.095 },
    },
  },

  vidu: {
    id: "vidu",
    name: "Vidu AI",
    badge: "AI Video",
    shapeType: "vidu_prism",
    description: "ShengShu Vidu optical prism triangles logo",
    isTransparent: true,
    typicalOpacity: 0.85,
    glyphMatrix16: VIDU_GLYPH,
    colorProfile: {
      primaryLumRange: [200, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "vidu_br", name: "Vidu Logo", x: 0.78, y: 0.89, width: 0.20, height: 0.08 },
      vertical: { id: "vidu_br", name: "Vidu Logo", x: 0.63, y: 0.92, width: 0.33, height: 0.055 },
      square: { id: "vidu_br", name: "Vidu Logo", x: 0.72, y: 0.90, width: 0.25, height: 0.07 },
      portrait: { id: "vidu_br", name: "Vidu Logo", x: 0.67, y: 0.91, width: 0.30, height: 0.065 },
      ultrawide: { id: "vidu_br", name: "Vidu Logo", x: 0.84, y: 0.87, width: 0.14, height: 0.095 },
    },
  },

  ideogram: {
    id: "ideogram",
    name: "Ideogram",
    badge: "AI Image",
    shapeType: "ideogram_type",
    description: "Ideogram typographic lower-case 'i' mark",
    isTransparent: true,
    typicalOpacity: 0.75,
    glyphMatrix16: IDEOGRAM_GLYPH,
    colorProfile: {
      primaryLumRange: [180, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "ideogram_br", name: "Ideogram Mark", x: 0.82, y: 0.92, width: 0.16, height: 0.055 },
      vertical: { id: "ideogram_br", name: "Ideogram Mark", x: 0.68, y: 0.93, width: 0.28, height: 0.045 },
      square: { id: "ideogram_br", name: "Ideogram Mark", x: 0.76, y: 0.92, width: 0.21, height: 0.055 },
      portrait: { id: "ideogram_br", name: "Ideogram Mark", x: 0.71, y: 0.92, width: 0.26, height: 0.05 },
      ultrawide: { id: "ideogram_br", name: "Ideogram Mark", x: 0.86, y: 0.90, width: 0.12, height: 0.065 },
    },
  },

  custom: {
    id: "custom",
    name: "Custom ROI",
    badge: "Interactive",
    shapeType: "sparkle_star",
    description: "User-defined custom bounding box",
    isTransparent: false,
    typicalOpacity: 1.0,
    glyphMatrix16: GEMINI_GLYPH,
    colorProfile: {
      primaryLumRange: [0, 255],
      hasDarkPill: false,
    },
    aspectPriors: {
      landscape: { id: "custom_box", name: "Custom ROI", x: 0.75, y: 0.85, width: 0.22, height: 0.12 },
      vertical: { id: "custom_box", name: "Custom ROI", x: 0.62, y: 0.90, width: 0.35, height: 0.08 },
      square: { id: "custom_box", name: "Custom ROI", x: 0.70, y: 0.87, width: 0.27, height: 0.10 },
      portrait: { id: "custom_box", name: "Custom ROI", x: 0.66, y: 0.88, width: 0.30, height: 0.09 },
      ultrawide: { id: "custom_box", name: "Custom ROI", x: 0.80, y: 0.84, width: 0.18, height: 0.13 },
    },
  },
};

/**
 * Computes Normalized Cross-Correlation (NCC) between a sampled 16x16 patch and a dataset glyph matrix.
 * Returns match score from -1.0 to 1.0.
 */
export function computeTemplateCorrelation(patch16: number[], template16: number[]): number {
  if (patch16.length !== 256 || template16.length !== 256) return 0;

  let meanP = 0, meanT = 0;
  for (let i = 0; i < 256; i++) {
    meanP += patch16[i];
    meanT += template16[i];
  }
  meanP /= 256;
  meanT /= 256;

  let num = 0, denP = 0, denT = 0;
  for (let i = 0; i < 256; i++) {
    const diffP = patch16[i] - meanP;
    const diffT = template16[i] - meanT;
    num += diffP * diffT;
    denP += diffP * diffP;
    denT += diffT * diffT;
  }

  const denom = Math.sqrt(denP * denT);
  return denom > 0.00001 ? Math.max(-1, Math.min(1, num / denom)) : 0;
}

/**
 * Bilinearly resamples a 16x16 glyph template into any arbitrary destination width and height.
 * Returns Uint8Array of size dstW * dstH (values 0..255).
 */
export function resizeMaskBilinear(
  src16: number[],
  dstW: number,
  dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH);
  if (dstW <= 0 || dstH <= 0 || !src16 || src16.length !== 256) return dst;

  for (let dy = 0; dy < dstH; dy++) {
    const srcY = dstH > 1 ? (dy / (dstH - 1)) * 15 : 7.5;
    const y0 = Math.floor(srcY);
    const y1 = Math.min(15, y0 + 1);
    const wy1 = srcY - y0;
    const wy0 = 1 - wy1;

    for (let dx = 0; dx < dstW; dx++) {
      const srcX = dstW > 1 ? (dx / (dstW - 1)) * 15 : 7.5;
      const x0 = Math.floor(srcX);
      const x1 = Math.min(15, x0 + 1);
      const wx1 = srcX - x0;
      const wx0 = 1 - wx1;

      const v00 = src16[y0 * 16 + x0];
      const v01 = src16[y0 * 16 + x1];
      const v10 = src16[y1 * 16 + x0];
      const v11 = src16[y1 * 16 + x1];

      const val = wy0 * (wx0 * v00 + wx1 * v01) + wy1 * (wx0 * v10 + wx1 * v11);
      dst[dy * dstW + dx] = Math.round(Math.max(0, Math.min(1, val)) * 255);
    }
  }

  return dst;
}

const LEARNED_LOGOS_STORAGE_KEY = "bolsub_ai_learned_watermark_dataset";

/**
 * Saves a learned watermark logo profile to browser storage.
 */
export function saveLearnedLogoProfile(profile: LearnedLogoData): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getAllLearnedLogoProfiles();
    existing[profile.presetId] = profile;
    window.localStorage.setItem(LEARNED_LOGOS_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn("Failed to persist learned logo profile:", err);
  }
}

/**
 * Retrieves a learned watermark logo profile for an AI preset.
 */
export function getLearnedLogoProfile(presetId: WatermarkPresetId): LearnedLogoData | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const existing = getAllLearnedLogoProfiles();
    return existing[presetId] || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves all learned AI logo profiles.
 */
export function getAllLearnedLogoProfiles(): Record<string, LearnedLogoData> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LEARNED_LOGOS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
