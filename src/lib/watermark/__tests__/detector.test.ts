import { describe, it, expect } from "vitest";
import {
  detectAiFromFilename,
  getAspectRatioCategory,
  getDynamicRoisForPreset,
  autoDetectMediaWatermark,
} from "../detector";

describe("AI Watermark & Aspect Ratio Detector", () => {
  describe("detectAiFromFilename", () => {
    it("accurately detects Google Gemini and Veo filenames", () => {
      expect(detectAiFromFilename("gemini_sunset_render.mp4").presetId).toBe("gemini");
      expect(detectAiFromFilename("google_veo_cinematic_4k.mp4").presetId).toBe("gemini");
      expect(detectAiFromFilename("imagen_3_ultra_realistic.png").presetId).toBe("gemini");
      expect(detectAiFromFilename("deepmind_synthid_test.mp4").presetId).toBe("gemini");
    });

    it("accurately detects Kling AI, Runway Gen-2/3, and Sora filenames", () => {
      expect(detectAiFromFilename("kling_cyberpunk_samurai.mp4").presetId).toBe("kling");
      expect(detectAiFromFilename("runway_gen3_hyperlapse.mov").presetId).toBe("runway");
      expect(detectAiFromFilename("gen2_clip_final.mp4").presetId).toBe("runway");
      expect(detectAiFromFilename("sora_tokyo_snow.mp4").presetId).toBe("sora");
    });

    it("accurately detects Luma, Pika, Hailuo, TikTok, and Midjourney", () => {
      expect(detectAiFromFilename("luma_dreammachine_car.mp4").presetId).toBe("luma");
      expect(detectAiFromFilename("pikalabs_floating_island.mp4").presetId).toBe("pika");
      expect(detectAiFromFilename("hailuo_minimax_character.mp4").presetId).toBe("hailuo");
      expect(detectAiFromFilename("tiktok_snaptik_reel.mp4").presetId).toBe("tiktok");
      expect(detectAiFromFilename("midjourney_v6_portrait.png").presetId).toBe("midjourney");
    });

    it("returns null for generic filenames without AI signatures", () => {
      expect(detectAiFromFilename("my_vacation_video.mp4").presetId).toBeNull();
      expect(detectAiFromFilename("IMG_20261017.jpg").presetId).toBeNull();
    });
  });

  describe("getAspectRatioCategory", () => {
    it("categorizes 16:9 widescreen as landscape", () => {
      const res = getAspectRatioCategory(1920, 1080);
      expect(res.category).toBe("landscape");
      expect(res.label).toContain("16:9");
    });

    it("categorizes 9:16 vertical as vertical (Reels/Shorts)", () => {
      const res = getAspectRatioCategory(1080, 1920);
      expect(res.category).toBe("vertical");
      expect(res.label).toContain("9:16");
    });

    it("categorizes 1:1 as square", () => {
      const res = getAspectRatioCategory(1080, 1080);
      expect(res.category).toBe("square");
      expect(res.label).toContain("1:1");
    });

    it("categorizes 4:5 as portrait", () => {
      const res = getAspectRatioCategory(1080, 1350);
      expect(res.category).toBe("portrait");
      expect(res.label).toContain("4:5");
    });

    it("categorizes 21:9 as ultrawide", () => {
      const res = getAspectRatioCategory(2560, 1080);
      expect(res.category).toBe("ultrawide");
      expect(res.label).toContain("21:9");
    });
  });

  describe("getDynamicRoisForPreset", () => {
    it("dynamically adjusts Gemini watermark coordinates for landscape vs vertical", () => {
      const landscapeRois = getDynamicRoisForPreset("gemini", 1920, 1080);
      const verticalRois = getDynamicRoisForPreset("gemini", 1080, 1920);

      expect(landscapeRois.length).toBe(1);
      expect(verticalRois.length).toBe(1);

      // On vertical 9:16, width ratio should expand to cover narrow screen relative width
      expect(verticalRois[0].width).toBeGreaterThan(landscapeRois[0].width);
      // Both should be in bottom-right corner
      expect(landscapeRois[0].x).toBeGreaterThan(0.7);
      expect(verticalRois[0].x).toBeGreaterThan(0.6);
      expect(landscapeRois[0].y).toBeGreaterThan(0.85);
      expect(verticalRois[0].y).toBeGreaterThan(0.85);
    });

    it("dynamically adjusts Kling watermark coordinates for landscape vs vertical", () => {
      const landscapeRois = getDynamicRoisForPreset("kling", 1920, 1080);
      const verticalRois = getDynamicRoisForPreset("kling", 1080, 1920);

      expect(verticalRois[0].width).toBeGreaterThan(landscapeRois[0].width);
    });

    it("provides dual-corner ROIs for TikTok across aspect ratios", () => {
      const landscapeRois = getDynamicRoisForPreset("tiktok", 1920, 1080);
      const verticalRois = getDynamicRoisForPreset("tiktok", 1080, 1920);

      expect(landscapeRois.length).toBe(2);
      expect(verticalRois.length).toBe(2);
      // Top-left stamp
      expect(verticalRois[0].x).toBeLessThan(0.1);
      expect(verticalRois[0].y).toBeLessThan(0.1);
      // Bottom-right stamp
      expect(verticalRois[1].x).toBeGreaterThan(0.5);
      expect(verticalRois[1].y).toBeGreaterThan(0.85);
    });
  });

  describe("autoDetectMediaWatermark", () => {
    it("auto-detects Google Gemini and formats dynamic explanation", () => {
      const res = autoDetectMediaWatermark({
        filename: "gemini_veo_volcano_drone.mp4",
        width: 1080,
        height: 1920,
      });

      expect(res.presetId).toBe("gemini");
      expect(res.platformName).toContain("Gemini");
      expect(res.aspectRatioCategory).toBe("vertical");
      expect(res.confidence).toBeGreaterThanOrEqual(0.95);
      expect(res.explanation).toContain("Gemini");
      expect(res.explanation).toContain("9:16");
    });

    it("gracefully falls back for unknown video and adapts to aspect ratio", () => {
      const res = autoDetectMediaWatermark({
        filename: "render_001.mp4",
        width: 1920,
        height: 1080,
      });

      expect(res.presetId).toBe("kling");
      expect(res.aspectRatioCategory).toBe("landscape");
      expect(res.explanation).toContain("16:9 Landscape");
    });
  });
});
