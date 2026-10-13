import { describe, it, expect } from "vitest";
import { CAPTION_PRESETS } from "../presets";
import { validateTemplate } from "../schema";
import {
  TEMPLATE_SCHEMA_VERSION,
  TEMPLATE_RETIREMENT_MAP,
  migrateTemplateId,
  migrateProjectPayload,
} from "../migration";

const EXPECTED_TOTAL_TEMPLATES = 72;

const EXPECTED_CATEGORY_COUNTS: Record<string, number> = {
  bold_viral: 10,
  neon: 10,
  aesthetic: 10,
  bollywood: 10,
  minimal: 8,
  podcast: 8,
  comic: 8,
  news: 8,
};

describe("Template Collection Invariants & Migration Suite (Full Catalog)", () => {
  it("MUST preserve the exact total template count invariant of 72 presets", () => {
    expect(CAPTION_PRESETS.length).toBe(EXPECTED_TOTAL_TEMPLATES);
  });

  it("MUST preserve exact category distribution counts", () => {
    const counts: Record<string, number> = {};
    for (const tmpl of CAPTION_PRESETS) {
      counts[tmpl.vibe] = (counts[tmpl.vibe] || 0) + 1;
    }

    expect(counts).toEqual(EXPECTED_CATEGORY_COUNTS);
  });

  it("MUST ensure every preset passes strict schema validation", () => {
    const ids = new Set<string>();
    for (const tmpl of CAPTION_PRESETS) {
      expect(tmpl.id, "Template ID must be non-empty").toBeTruthy();
      expect(ids.has(tmpl.id), `Duplicate template ID found: ${tmpl.id}`).toBe(false);
      ids.add(tmpl.id);

      const isValid = validateTemplate(tmpl);
      expect(isValid, `Template ${tmpl.id} failed schema validation`).toBe(true);
    }
  });

  it("MUST verify that all 10 Part A replacement text styles exist in their exact slots", () => {
    const expectedPartAIds = [
      "die_cut_sticker",
      "hollow_outline_fill",
      "chrome_metallic_3d",
      "neon_tube_flicker",
      "editorial_serif_luxury",
      "devanagari_calligraphy_bold",
      "brush_graffiti_paint",
      "hand_script_marker",
      "retro_80s_synth",
      "glitch_rgb_split",
    ];

    const presetIds = new Set(CAPTION_PRESETS.map((p) => p.id));
    for (const id of expectedPartAIds) {
      expect(presetIds.has(id), `Expected Part A template ${id} to exist in CAPTION_PRESETS`).toBe(true);
    }
  });

  it("MUST verify that all 8 Part B behind-the-subject styles exist in their exact slots", () => {
    const expectedPartBIds = [
      "behind_head_giant_word",
      "behind_cover_stack",
      "behind_outline_huge",
      "behind_depth_fade",
      "behind_sandwich_layer",
      "behind_curved_arc",
      "behind_vertical_sidetext",
      "behind_devanagari_calligraphy",
    ];

    const presetIds = new Set(CAPTION_PRESETS.map((p) => p.id));
    for (const id of expectedPartBIds) {
      expect(presetIds.has(id), `Expected Part B template ${id} to exist in CAPTION_PRESETS`).toBe(true);
      const tmpl = CAPTION_PRESETS.find((p) => p.id === id);
      expect(tmpl?.layout.behindSubjectDepth).toBe(true);
    }
  });

  it("MUST contain exactly 18 retirement plans: 10 Part A and 8 Part B", () => {
    const plans = Object.values(TEMPLATE_RETIREMENT_MAP);
    expect(plans.length).toBe(18);

    const partA = plans.filter((p) => p.part === "A");
    const partB = plans.filter((p) => p.part === "B");

    expect(partA.length).toBe(10);
    expect(partB.length).toBe(8);
  });

  it("MUST correctly migrate retired template IDs to replacement IDs", () => {
    for (const [retiredId, plan] of Object.entries(TEMPLATE_RETIREMENT_MAP)) {
      const migrated = migrateTemplateId(retiredId);
      expect(migrated).toBe(plan.replacementId);
    }

    // Survivor templates should not be changed
    expect(migrateTemplateId("behind_you_white")).toBe("behind_you_white");
    expect(migrateTemplateId("alex_hormozi_punch")).toBe("alex_hormozi_punch");
    expect(migrateTemplateId("mr_beast_bold")).toBe("mr_beast_bold");
  });

  it("MUST migrate saved v1.0 project JSON cleanly to v2.0 without breaking user projects", () => {
    const legacyProject = {
      version: "1.0",
      product: "BolSub Studio",
      templateId: "slate_subtle", // Retired Part B template
      scriptMode: "hinglish",
      duration: 15.4,
      tokens: [
        { id: "1", text: "Maine", start: 0.1, end: 0.5, confidence: 0.99 },
        { id: "2", text: "video", start: 0.5, end: 1.0, confidence: 0.98 },
      ],
    };

    const migrated = migrateProjectPayload(legacyProject);
    expect(migrated.version).toBe(TEMPLATE_SCHEMA_VERSION);
    expect(migrated.templateId).toBe("behind_depth_fade");
    expect(migrated.wasMigrated).toBe(true);
    expect(migrated.tokens).toEqual(legacyProject.tokens);
    expect(migrated.duration).toBe(15.4);
  });
});
