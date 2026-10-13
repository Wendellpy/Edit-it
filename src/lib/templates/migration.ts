import type { TemplateVibe } from "./schema";

export const TEMPLATE_SCHEMA_VERSION = "2.0";

export interface RetirementPlan {
  retiredId: string;
  retiredName: string;
  category: TemplateVibe;
  part: "A" | "B";
  replacementId: string;
  replacementName: string;
  reason: string;
  designSpec: string;
}

/**
 * Strict 18-template retirement and migration ledger.
 * Exactly 18 slots: 10 Part A (New Text Styles) and 8 Part B (Behind-Subject Styles).
 * Keeps slot, position, and category balance strictly invariant (72 total).
 */
export const TEMPLATE_RETIREMENT_MAP: Record<string, RetirementPlan> = {
  // ----------------------------------------------------
  // PART A: 10 NEW TEXT STYLES (Replaces Weakest Templates)
  // ----------------------------------------------------
  nordic_clean: {
    retiredId: "nordic_clean",
    retiredName: "Nordic Clean Serif",
    category: "aesthetic",
    part: "A",
    replacementId: "editorial_serif_luxury",
    replacementName: "Editorial Serif (High-Contrast Italic Keyword)",
    reason: "Low contrast at 0.04 size, generic Georgia serif, none animation.",
    designSpec: "High-contrast Didone/serif with tight tracking, letter-spacing, and italic emphasis on spoken keyword."
  },
  doodle_marker_white: {
    retiredId: "doodle_marker_white",
    retiredName: "Doodle Marker Hand",
    category: "comic",
    part: "A",
    replacementId: "hand_script_marker",
    replacementName: "Hand-Script Marker (Animated Swash Underline)",
    reason: "Misleading preset name: used Impact font rather than an authentic marker, highly redundant.",
    designSpec: "Handwritten casual marker feel with animated dynamic underline and swash stroke on active word."
  },
  ultra_glow_orange: {
    retiredId: "ultra_glow_orange",
    retiredName: "Ultra Sunset Orange",
    category: "neon",
    part: "A",
    replacementId: "chrome_metallic_3d",
    replacementName: "Chrome / Metallic 3D Specular",
    reason: "Redundant orange glow clone of existing sunset and fire presets.",
    designSpec: "Extruded depth with specular metallic gradient and soft floor/horizon reflection."
  },
  radioactive_yellow: {
    retiredId: "radioactive_yellow",
    retiredName: "Radioactive High-Vis",
    category: "neon",
    part: "A",
    replacementId: "neon_tube_flicker",
    replacementName: "Neon Tube (Layered Multi-Glow & Flicker)",
    reason: "Redundant dark box yellow style with low typographic novelty.",
    designSpec: "Multi-layered realistic gas-discharge glow with subtle organic micro-flicker on active word."
  },
  exclusive_report_amber: {
    retiredId: "exclusive_report_amber",
    retiredName: "Exclusive Report Alert",
    category: "news",
    part: "A",
    replacementId: "glitch_rgb_split",
    replacementName: "Glitch RGB-Split Chromatic Jitter",
    reason: "Low-scoring Impact amber duplicate (score 5.62).",
    designSpec: "Channel-offset chromatic aberration jitter on entry, snap-settling into crisp focus."
  },
  financial_green_caps: {
    retiredId: "financial_green_caps",
    retiredName: "Market Green Bulletin",
    category: "news",
    part: "A",
    replacementId: "retro_80s_synth",
    replacementName: "Retro 80s Synthwave Gradient",
    reason: "Dull green Impact clone with poor contrast.",
    designSpec: "Vibrant synthwave chrome/magenta gradient fill with crisp outlined offset drop shadow."
  },
  supreme_stacked: {
    retiredId: "supreme_stacked",
    retiredName: "Supreme Stacked Red",
    category: "bold_viral",
    part: "A",
    replacementId: "die_cut_sticker",
    replacementName: "Die-Cut Sticker (Vinyl Border & Word Tilt)",
    reason: "Lowest-scoring template (5.50); near-identical clone of white Impact.",
    designSpec: "Thick white vinyl border, offset drop shadow, and subtle per-word tilt rotation."
  },
  alpha_punch_red: {
    retiredId: "alpha_punch_red",
    retiredName: "Alpha Punch Crimson",
    category: "bold_viral",
    part: "A",
    replacementId: "hollow_outline_fill",
    replacementName: "Hollow Outline to Solid Fill",
    reason: "Duplicate clone of Hormozi punch with minor red accent.",
    designSpec: "Crisp hollow stroke outline text where the active spoken word transitions into vibrant solid fill."
  },
  manga_action_slant: {
    retiredId: "manga_action_slant",
    retiredName: "Manga Slanted Action",
    category: "comic",
    part: "A",
    replacementId: "brush_graffiti_paint",
    replacementName: "Brush / Graffiti Paint Reveal",
    reason: "Redundant Impact black stroke preset.",
    designSpec: "Expressive urban street-art brush typography with dynamic paint-reveal animation per word."
  },
  dil_dhadakne_do: {
    retiredId: "dil_dhadakne_do",
    retiredName: "Urban Mumbai Cool",
    category: "bollywood",
    part: "A",
    replacementId: "devanagari_calligraphy_bold",
    replacementName: "Devanagari Display Calligraphy Headline",
    reason: "Was plain English Inter sans; completely lacked authentic Indian typographic aesthetic.",
    designSpec: "Bold, expressive Hindi-first headline script optimized for Devanagari and Hinglish with proper shirorekha."
  },

  // ----------------------------------------------------
  // PART B: 8 BEHIND-THE-SUBJECT STYLES
  // ----------------------------------------------------
  viral_titan_white: {
    retiredId: "viral_titan_white",
    retiredName: "Viral Titan Mono",
    category: "bold_viral",
    part: "B",
    replacementId: "behind_head_giant_word",
    replacementName: "Giant Word Behind Head (Poster Swap)",
    reason: "Duplicate clone of Behind You White (Impact uppercase).",
    designSpec: "Giant single word auto-positioned behind the subject head/torso, swapping dynamically per spoken word."
  },
  minimal_monochrome: {
    retiredId: "minimal_monochrome",
    retiredName: "Monochrome High Contrast",
    category: "aesthetic",
    part: "B",
    replacementId: "behind_cover_stack",
    replacementName: "Magazine-Cover Stack Behind Subject",
    reason: "Drab, unstyled monochrome with mediocre readability.",
    designSpec: "Large multi-line editorial typography positioned behind the subject, peeking out on both flanks."
  },
  monoline_white: {
    retiredId: "monoline_white",
    retiredName: "Monoline Thin Sans",
    category: "minimal",
    part: "B",
    replacementId: "behind_outline_huge",
    replacementName: "Outline-Only Huge Text Behind Subject",
    reason: "Thin illegible font at 360px width with weak contrast.",
    designSpec: "Transparent fill with crisp outer stroke running behind the sharp foreground subject."
  },
  slate_subtle: {
    retiredId: "slate_subtle",
    retiredName: "Slate Gray Subtitle",
    category: "minimal",
    part: "B",
    replacementId: "behind_depth_fade",
    replacementName: "Depth Fade Behind Subject (Atmospheric Blur)",
    reason: "Lowest scorer in entire catalog (4.35): tiny 0.036 size, slate gray illegible text, none animation.",
    designSpec: "Text rendered behind subject with Gaussian depth blur and atmospheric gradient falloff."
  },
  lex_minimal_podcast: {
    retiredId: "lex_minimal_podcast",
    retiredName: "Lex Minimal Mono",
    category: "podcast",
    part: "B",
    replacementId: "behind_sandwich_layer",
    replacementName: "Sandwich Layering (Foreground Context, Keyword Behind)",
    reason: "0.034 size tiny drab monospace with zero animation; illegible on mobile.",
    designSpec: "Multi-depth sandwich: primary context words in front, active spoken keyword layered behind subject."
  },
  slow_read_clean: {
    retiredId: "slow_read_clean",
    retiredName: "Slow Read Clean Sans",
    category: "podcast",
    part: "B",
    replacementId: "behind_curved_arc",
    replacementName: "Curved Arc Behind Shoulders",
    reason: "Duplicate clean subtitle with generic karaoke fill.",
    designSpec: "Radial/arc layout hugging the silhouette of the subject head and shoulders."
  },
  filmi_dialogue_red: {
    retiredId: "filmi_dialogue_red",
    retiredName: "Filmi Dialogue Punch",
    category: "bollywood",
    part: "B",
    replacementId: "behind_vertical_sidetext",
    replacementName: "Vertical Side-Text Running Behind Shoulders",
    reason: "Redundant red glow Impact clone.",
    designSpec: "Cinematic vertical column typography running behind the subject's left or right shoulder."
  },
  desi_swag_amber: {
    retiredId: "desi_swag_amber",
    retiredName: "Desi Swag Amber Pop",
    category: "bollywood",
    part: "B",
    replacementId: "behind_devanagari_calligraphy",
    replacementName: "Devanagari Calligraphy Behind Subject",
    reason: "Redundant amber pop clone.",
    designSpec: "Hindi-first cinematic poster calligraphy layered directly behind the subject."
  },
};

/**
 * Translates any historical or retired templateId into its official replacement.
 */
export function migrateTemplateId(templateId: string): string {
  const plan = TEMPLATE_RETIREMENT_MAP[templateId];
  return plan ? plan.replacementId : templateId;
}

/**
 * Migrates a saved project payload from legacy v1.0 to v2.0 schema.
 */
export function migrateProjectPayload(payload: {
  version?: string;
  templateId?: string;
  [key: string]: any;
}): { version: string; templateId: string; wasMigrated: boolean; [key: string]: any } {
  const oldId = payload.templateId || "behind_you_white";
  const newId = migrateTemplateId(oldId);
  return {
    ...payload,
    version: TEMPLATE_SCHEMA_VERSION,
    templateId: newId,
    wasMigrated: oldId !== newId,
  };
}
