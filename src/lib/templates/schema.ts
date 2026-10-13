export type TemplateVibe =
  | "bold_viral"
  | "minimal"
  | "neon"
  | "podcast"
  | "comic"
  | "news"
  | "aesthetic"
  | "bollywood";

export type WordAnimationEffect =
  | "scale_pop"
  | "color_pop"
  | "karaoke_fill"
  | "bounce"
  | "typewriter"
  | "glow"
  | "glitch_jitter"
  | "brush_reveal"
  | "swash_underline"
  | "flicker"
  | "hollow_fill"
  | "extrusion_3d"
  | "none";

export interface ColorGradientStop {
  offset: number; // 0.0 to 1.0
  color: string;  // CSS color
}

export interface ColorGradient {
  type: "linear" | "radial";
  angleDeg?: number; // Linear gradient angle (0 = top-to-bottom, 90 = left-to-right)
  stops: ColorGradientStop[];
}

export interface MultiStrokeLayer {
  color: string;
  widthPercent: number; // Percentage of canvas height (e.g. 0.012 = 1.2%)
}

export interface Extrusion3D {
  depthPercent: number;    // e.g. 0.008 = 0.8% of canvas height
  angleDeg: number;        // Angle of 3D depth extrusion (e.g. 45deg, 90deg)
  steps: number;           // Number of iterative extrusion passes (e.g. 4 to 8)
  color: string;           // Base bevel shadow color
  highlightColor?: string; // Specular metallic rim light
}

export interface GlowLayer {
  color: string;
  blur: number; // Canvas shadow blur
}

export interface WordTransformConfig {
  randomTiltDeg?: number;   // E.g. 4 for dynamic sticker tilt
  letterSpacingEm?: number; // Negative for tight editorial tracking, positive for airy
  italicKeyword?: boolean;  // Automatically italicize active/emphasized keyword
}

export interface UnderlineConfig {
  enabled: boolean;
  color: string;
  thicknessPercent: number; // Percentage of canvas height
  animated: boolean;        // Dynamic swash stroke drawn on active word
}

export interface CaptionTemplate {
  id: string;
  name: string;
  vibe: TemplateVibe;
  badge?: string; // e.g. "BEHIND YOU", "NEW", "3D CHROME", "NEON TUBE"

  typography: {
    primaryFont: string;          // e.g. "Playfair Display, serif", "Kalam, cursive", "Montserrat, sans-serif"
    secondaryFont?: string;       // e.g. "Rozha One, serif", "Noto Sans Devanagari, sans-serif"
    primaryWeight: string;        // e.g. "900", "bold"
    textTransform: "uppercase" | "lowercase" | "none" | "capitalize";
    fontSizeBasePercent: number;  // Percentage of canvas height (e.g. 0.045 = 4.5%)
    wordTransform?: WordTransformConfig;
  };

  colors: {
    primaryText: string;
    secondaryText?: string;
    activeWordText: string;
    activeWordBg?: string;
    strokeColor?: string;
    strokeWidthPercent?: number;
    shadowColor?: string;
    shadowBlur?: number;
    glowColor?: string;

    // Advanced Phase 1 Styling Extensions
    gradient?: ColorGradient;
    activeWordGradient?: ColorGradient;
    multiStrokes?: MultiStrokeLayer[];
    extrusion?: Extrusion3D;
    glowLayers?: GlowLayer[];
  };

  box?: {
    enabled: boolean;
    bgColor: string;
    paddingX: number;
    paddingY: number;
    borderRadius: number;
    rotationDeg?: number;
    borderColor?: string;
    borderWidth?: number;
  };

  layout: {
    yPositionPercent: number; // 0.0 (top) to 1.0 (bottom)
    maxWordsPerLine: number;
    maxLines: number;
    behindSubjectDepth: boolean;
    layerOrder?: "front" | "behind" | "sandwich"; // Depth layering control
  };

  animation: {
    perWordEffect: WordAnimationEffect;
    scaleMagnitude: number; // e.g. 1.15 = 15% pop
    glitchOffsetPx?: number; // Chromatic aberration RGB offset
    flickerFrequency?: number; // Neon pulse frequency
    underline?: UnderlineConfig;
  };

  accessibility?: {
    contrastFallback: "auto_stroke" | "backdrop_shadow" | "pill_box";
    minContrastRatio?: number;
  };

  emoji?: {
    enabled: boolean;
    position: "inline" | "above";
  };
}

export function validateTemplate(template: CaptionTemplate): boolean {
  if (!template || typeof template !== "object") return false;
  if (!template.id || typeof template.id !== "string") return false;
  if (!template.name || typeof template.name !== "string") return false;
  if (!template.vibe || typeof template.vibe !== "string") return false;

  // Typography validation
  if (!template.typography?.primaryFont || typeof template.typography.primaryFont !== "string") return false;
  if (typeof template.typography.fontSizeBasePercent !== "number" || template.typography.fontSizeBasePercent <= 0) {
    return false;
  }

  // Color validation
  if (!template.colors?.primaryText || typeof template.colors.primaryText !== "string") return false;
  if (!template.colors?.activeWordText || typeof template.colors.activeWordText !== "string") return false;

  // Layout validation
  if (typeof template.layout?.yPositionPercent !== "number") return false;
  if (template.layout.yPositionPercent <= 0 || template.layout.yPositionPercent >= 1) return false;

  // Gradient validation if present
  if (template.colors.gradient) {
    if (!Array.isArray(template.colors.gradient.stops) || template.colors.gradient.stops.length < 2) {
      return false;
    }
    for (const stop of template.colors.gradient.stops) {
      if (typeof stop.offset !== "number" || stop.offset < 0 || stop.offset > 1 || !stop.color) {
        return false;
      }
    }
  }

  // Multi-stroke validation if present
  if (template.colors.multiStrokes) {
    if (!Array.isArray(template.colors.multiStrokes)) return false;
    for (const stroke of template.colors.multiStrokes) {
      if (!stroke.color || typeof stroke.widthPercent !== "number" || stroke.widthPercent <= 0) {
        return false;
      }
    }
  }

  // Extrusion validation if present
  if (template.colors.extrusion) {
    if (
      typeof template.colors.extrusion.depthPercent !== "number" ||
      typeof template.colors.extrusion.steps !== "number" ||
      !template.colors.extrusion.color
    ) {
      return false;
    }
  }

  return true;
}
