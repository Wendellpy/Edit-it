/**
 * BolSub Studio Intelligent AI Watermark & Aspect Ratio Detector
 * Automatically recognizes whether media was created by Google Gemini (Veo / Imagen),
 * Kling, Runway, Sora, Luma, Pika, Hailuo, or TikTok from filename clues,
 * video metadata, aspect ratio geometry, and visual corner edge analysis.
 */

import {
  WATERMARK_PRESETS,
  type WatermarkPresetId,
  type AspectRatioCategory,
  type NormalizedROI,
  type WatermarkDetectionResult,
} from "./types";
import { clampNormalizedROI } from "./inpainter";
import { AI_WATERMARK_DATASET, computeTemplateCorrelation } from "./logoDataset";

/**
 * Determines aspect ratio category and human-readable label from frame dimensions.
 */
export function getAspectRatioCategory(
  width: number,
  height: number
): {
  category: AspectRatioCategory;
  ratio: number;
  label: string;
} {
  if (width <= 0 || height <= 0) {
    return { category: "landscape", ratio: 1.777, label: "16:9 Landscape" };
  }

  const ratio = width / height;

  if (ratio >= 2.1) {
    return { category: "ultrawide", ratio, label: "21:9 Ultrawide" };
  }
  if (ratio >= 1.35) {
    return { category: "landscape", ratio, label: "16:9 Landscape" };
  }
  if (ratio <= 0.68) {
    return { category: "vertical", ratio, label: "9:16 Vertical (Reels / Shorts)" };
  }
  if (ratio < 0.90) {
    return { category: "portrait", ratio, label: "4:5 Portrait" };
  }
  return { category: "square", ratio, label: "1:1 Square" };
}

/**
 * Detects AI generator from filename keywords and common platform naming schemes.
 */
export function detectAiFromFilename(filename: string): {
  presetId: WatermarkPresetId | null;
  confidence: number;
  matchedKeyword?: string;
} {
  if (!filename) return { presetId: null, confidence: 0 };

  const clean = filename.toLowerCase();

  // 1. Google Gemini / Veo / Imagen / SynthID / DeepMind
  const geminiMatch = clean.match(/(?:gemini|veo|imagen|synthid|deepmind|google-ai|google_ai|googleai)/);
  if (geminiMatch) {
    return { presetId: "gemini", confidence: 0.98, matchedKeyword: geminiMatch[0] };
  }

  // 2. Kling AI / Kuaishou
  const klingMatch = clean.match(/(?:kling|kuaishou)/);
  if (klingMatch) {
    return { presetId: "kling", confidence: 0.98, matchedKeyword: klingMatch[0] };
  }

  // 3. Runway Gen-2 / Gen-3
  const runwayMatch = clean.match(/(?:runway|gen-?2|gen-?3|gen2|gen3)/);
  if (runwayMatch) {
    return { presetId: "runway", confidence: 0.98, matchedKeyword: runwayMatch[0] };
  }

  // 4. OpenAI Sora
  const soraMatch = clean.match(/(?:sora|openai-?sora)/);
  if (soraMatch) {
    return { presetId: "sora", confidence: 0.98, matchedKeyword: soraMatch[0] };
  }

  // 5. Luma Dream Machine
  const lumaMatch = clean.match(/(?:luma|dream-?machine|dreammachine)/);
  if (lumaMatch) {
    return { presetId: "luma", confidence: 0.98, matchedKeyword: lumaMatch[0] };
  }

  // 6. Pika Labs
  const pikaMatch = clean.match(/(?:pika|pikalabs)/);
  if (pikaMatch) {
    return { presetId: "pika", confidence: 0.98, matchedKeyword: pikaMatch[0] };
  }

  // 7. Hailuo / MiniMax
  const hailuoMatch = clean.match(/(?:hailuo|minimax)/);
  if (hailuoMatch) {
    return { presetId: "hailuo", confidence: 0.98, matchedKeyword: hailuoMatch[0] };
  }

  // 8. TikTok / Reels / Douyin
  const tiktokMatch = clean.match(/(?:tiktok|douyin|musical\.?ly|snaptik|ssstik|reels)/);
  if (tiktokMatch) {
    return { presetId: "tiktok", confidence: 0.95, matchedKeyword: tiktokMatch[0] };
  }

  // 9. Midjourney
  const mjMatch = clean.match(/(?:midjourney|mj_|mjv\d)/);
  if (mjMatch) {
    return { presetId: "midjourney", confidence: 0.95, matchedKeyword: mjMatch[0] };
  }

  // 10. Haiper AI
  const haiperMatch = clean.match(/(?:haiper|haiper-?ai)/);
  if (haiperMatch) {
    return { presetId: "haiper", confidence: 0.95, matchedKeyword: haiperMatch[0] };
  }

  // 11. Vidu AI
  const viduMatch = clean.match(/(?:vidu|shengshu|vidu-?ai)/);
  if (viduMatch) {
    return { presetId: "vidu", confidence: 0.95, matchedKeyword: viduMatch[0] };
  }

  // 12. Ideogram
  const ideogramMatch = clean.match(/(?:ideogram)/);
  if (ideogramMatch) {
    return { presetId: "ideogram", confidence: 0.95, matchedKeyword: ideogramMatch[0] };
  }

  return { presetId: null, confidence: 0 };
}

/**
 * Dynamically resolves and adapts ROI coordinates for a preset based on the media's exact aspect ratio.
 */
export function getDynamicRoisForPreset(
  presetId: WatermarkPresetId,
  width: number,
  height: number
): NormalizedROI[] {
  const preset = WATERMARK_PRESETS[presetId] || WATERMARK_PRESETS.kling;
  const { category } = getAspectRatioCategory(width, height);

  if (preset.roisByAspectRatio && preset.roisByAspectRatio[category]) {
    return preset.roisByAspectRatio[category]!.map((r) => clampNormalizedROI({ ...r }));
  }

  // Fallback to default ROIs with aspect-ratio adaptive scaling
  return preset.defaultRois.map((roi) => {
    const cloned = { ...roi };
    if (category === "vertical" && cloned.x > 0.5) {
      // Scale horizontal width larger on vertical mobile screens
      cloned.x = Math.max(0.55, cloned.x - 0.12);
      cloned.width = Math.min(0.40, cloned.width * 1.55);
      cloned.y = Math.min(0.93, cloned.y + 0.02);
      cloned.height = Math.max(0.045, cloned.height * 0.75);
    }
    return clampNormalizedROI(cloned);
  });
}

/**
 * Scans candidate corner zones on a canvas for high-contrast watermark text/logos.
 */
export function scanCornerWatermarks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): {
  detected: boolean;
  corner: "br" | "bl" | "tr" | "tl" | null;
  candidateRoi: NormalizedROI | null;
  confidence: number;
  edgeScore: number;
  platformHint?: WatermarkPresetId;
  correlationScore?: number;
} {
  if (width < 32 || height < 32) {
    return { detected: false, corner: null, candidateRoi: null, confidence: 0, edgeScore: 0 };
  }

  // We primarily inspect the Bottom-Right corner (standard for 95% of AI watermarks)
  const brX = Math.floor(width * 0.68);
  const brY = Math.floor(height * 0.84);
  const brW = width - brX;
  const brH = height - brY;

  try {
    const imgData = ctx.getImageData(brX, brY, brW, brH);
    const data = imgData.data;

    let edgeCount = 0;
    let minX = brW, maxX = 0, minY = brH, maxY = 0;
    let highContrastPixels = 0;

    // Scan horizontal gradients to detect text / glyph edges
    for (let y = 1; y < brH - 1; y++) {
      for (let x = 1; x < brW - 1; x++) {
        const idx = (y * brW + x) * 4;
        const leftIdx = (y * brW + (x - 1)) * 4;
        const rightIdx = (y * brW + (x + 1)) * 4;

        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const lumL = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
        const lumR = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];

        const gradX = Math.abs(lumR - lumL);
        if (gradX > 38) {
          edgeCount++;
          if (lum > 140) {
            highContrastPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    const totalPixels = brW * brH;
    const edgeDensity = edgeCount / totalPixels;

    // If a cluster of distinct edges and high contrast is found
    if (highContrastPixels >= 25 && edgeDensity > 0.015 && maxX > minX && maxY > minY) {
      // Add padding around detected bounding box
      const padX = 8;
      const padY = 6;
      const tightX = Math.max(0, brX + minX - padX);
      const tightY = Math.max(0, brY + minY - padY);
      const tightW = Math.min(width - tightX, (maxX - minX) + padX * 2);
      const tightH = Math.min(height - tightY, (maxY - minY) + padY * 2);

      const candidateRoi: NormalizedROI = clampNormalizedROI({
        id: "auto_detected_br",
        name: "Auto-Detected Watermark",
        x: tightX / width,
        y: tightY / height,
        width: Math.max(0.12, tightW / width),
        height: Math.max(0.04, tightH / height),
      });

      // Extract 16x16 normalized binary patch to classify logo shape against dataset
      const patch16: number[] = new Array(256).fill(0);
      for (let py = 0; py < 16; py++) {
        const sampleY = Math.floor(minY + (py / 15) * Math.max(1, maxY - minY));
        for (let px = 0; px < 16; px++) {
          const sampleX = Math.floor(minX + (px / 15) * Math.max(1, maxX - minX));
          const idx = (sampleY * brW + sampleX) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          patch16[py * 16 + px] = lum > 145 ? 1 : 0;
        }
      }

      let bestMatchedPlatform: WatermarkPresetId = "kling";
      let highestCorrelation = -1;

      for (const presetKey of Object.keys(AI_WATERMARK_DATASET) as WatermarkPresetId[]) {
        if (presetKey === "custom") continue;
        const entry = AI_WATERMARK_DATASET[presetKey];
        const score = computeTemplateCorrelation(patch16, entry.glyphMatrix16);
        if (score > highestCorrelation) {
          highestCorrelation = score;
          bestMatchedPlatform = presetKey;
        }
      }

      return {
        detected: true,
        corner: "br",
        candidateRoi,
        confidence: Math.min(0.98, Math.max(0.65, 0.65 + edgeDensity * 10 + highestCorrelation * 0.2)),
        edgeScore: edgeDensity,
        platformHint: highestCorrelation > 0.35 ? bestMatchedPlatform : undefined,
        correlationScore: highestCorrelation,
      };
    }
  } catch {
    // Canvas security or context error
  }

  return { detected: false, corner: null, candidateRoi: null, confidence: 0, edgeScore: 0 };
}

/**
 * Primary auto-detection pipeline: combines filename analysis, aspect ratio adaptation,
 * and visual canvas frame scanning into a unified watermark detection result.
 */
export function autoDetectMediaWatermark(params: {
  filename?: string;
  width: number;
  height: number;
  ctx?: CanvasRenderingContext2D | null;
}): WatermarkDetectionResult {
  const { filename = "", width, height, ctx } = params;

  const { category, label: aspectRatioLabel } = getAspectRatioCategory(width, height);

  // 1. Check filename for explicit AI platform signature
  const fnDetection = detectAiFromFilename(filename);

  if (fnDetection.presetId) {
    const preset = WATERMARK_PRESETS[fnDetection.presetId];
    const adaptedRois = getDynamicRoisForPreset(fnDetection.presetId, width, height);

    return {
      presetId: fnDetection.presetId,
      platformName: preset.name,
      confidence: fnDetection.confidence,
      detectionSource: "filename",
      aspectRatioCategory: category,
      aspectRatioLabel,
      rois: adaptedRois,
      explanation: `Identified ${preset.name} from filename keyword "${fnDetection.matchedKeyword}" • Coordinates dynamically adapted for ${aspectRatioLabel}.`,
    };
  }

  // 2. Visual scan on canvas if rendering context is provided
  if (ctx && width > 0 && height > 0) {
    const scan = scanCornerWatermarks(ctx, width, height);
    if (scan.detected && scan.candidateRoi) {
      const recognizedPresetId = scan.platformHint || "kling";
      const preset = WATERMARK_PRESETS[recognizedPresetId];
      const matchPct = Math.round(scan.confidence * 100);

      return {
        presetId: recognizedPresetId,
        platformName: preset.name,
        confidence: scan.confidence,
        detectionSource: "visual_scan",
        aspectRatioCategory: category,
        aspectRatioLabel,
        rois: [scan.candidateRoi],
        explanation: scan.platformHint
          ? `Matched ${preset.name} logo shape from visual template correlation (${matchPct}% confidence) • Adapted for ${aspectRatioLabel}.`
          : `Detected watermark cluster in bottom-right corner (${matchPct}% confidence) • Adapted for ${aspectRatioLabel}.`,
      };
    }
  }

  // 3. Fallback: Default to Kling AI with aspect ratio dynamic geometry
  const defaultPresetId: WatermarkPresetId = "kling";
  const defaultRois = getDynamicRoisForPreset(defaultPresetId, width, height);

  return {
    presetId: defaultPresetId,
    platformName: WATERMARK_PRESETS[defaultPresetId].name,
    confidence: 0.50,
    detectionSource: "aspect_ratio_heuristic",
    aspectRatioCategory: category,
    aspectRatioLabel,
    rois: defaultRois,
    explanation: `Preset configured for ${aspectRatioLabel}. Adjust watermark box as needed.`,
  };
}
