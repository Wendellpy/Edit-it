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
  | "none";

export interface CaptionTemplate {
  id: string;
  name: string;
  vibe: TemplateVibe;
  badge?: string; // e.g. "BEHIND YOU", "NEW", "HOT"

  typography: {
    primaryFont: string;       // e.g. "Impact", "Arial Black", "Inter"
    secondaryFont?: string;    // e.g. "Playfair Display", "Cinzel", cursive for dual-font
    primaryWeight: string;     // e.g. "900", "bold"
    textTransform: "uppercase" | "lowercase" | "none" | "capitalize";
    fontSizeBasePercent: number; // Percentage of canvas height (e.g. 0.045 = 4.5%)
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
  };

  box?: {
    enabled: boolean;
    bgColor: string;
    paddingX: number;
    paddingY: number;
    borderRadius: number;
    rotationDeg?: number;
  };

  layout: {
    yPositionPercent: number; // 0.0 (top) to 1.0 (bottom), e.g. 0.50 (behind chest) or 0.75 (bottom)
    maxWordsPerLine: number;
    maxLines: number;
    behindSubjectDepth: boolean;
  };

  animation: {
    perWordEffect: WordAnimationEffect;
    scaleMagnitude: number; // e.g. 1.15 = 15% pop
  };

  emoji?: {
    enabled: boolean;
    position: "inline" | "above";
  };
}

export function validateTemplate(template: CaptionTemplate): boolean {
  if (!template.id || !template.name || !template.vibe) return false;
  if (!template.typography?.primaryFont) return false;
  if (!template.colors?.primaryText || !template.colors?.activeWordText) return false;
  if (typeof template.layout?.yPositionPercent !== "number") return false;
  return true;
}
