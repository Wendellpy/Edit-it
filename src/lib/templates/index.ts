import { CAPTION_PRESETS } from "./presets";
import { type CaptionTemplate, type TemplateVibe, validateTemplate } from "./schema";

export * from "./schema";
export * from "./presets";

export function getTemplateById(id: string): CaptionTemplate {
  const match = CAPTION_PRESETS.find((t) => t.id === id);
  return match || CAPTION_PRESETS[0];
}

export function getTemplatesByVibe(vibe: TemplateVibe): CaptionTemplate[] {
  return CAPTION_PRESETS.filter((t) => t.vibe === vibe);
}

export function getAllVibes(): Array<{ id: TemplateVibe; label: string }> {
  return [
    { id: "bold_viral", label: "Bold Viral" },
    { id: "neon", label: "Neon" },
    { id: "aesthetic", label: "Aesthetic" },
    { id: "bollywood", label: "Bollywood" },
    { id: "minimal", label: "Minimal" },
    { id: "podcast", label: "Podcast" },
    { id: "comic", label: "Comic" },
    { id: "news", label: "News" },
  ];
}
