import type { CaptionTemplate } from "../templates/schema";
import type { SubjectMetrics } from "../segmentation/types";

export interface AdjustedTextLayout {
  x: number;               // Canvas X center or anchor
  y: number;               // Canvas Y center
  fontSize: number;        // Adjusted font size
  occlusionRatio: number;  // 0.0 to 1.0 (percent of text covered by subject)
  isOccludedWarning: boolean;
  isFallback: boolean;     // True if fell back to front layer due to missing subject
  layoutMode: "standard" | "behind_head" | "arc" | "vertical_flank" | "sandwich";
  arcParams?: {
    centerX: number;
    centerY: number;
    radius: number;
    startAngleRad: number;
    endAngleRad: number;
  };
}

/**
 * Computes rule-based subject-aware text placement and occlusion mitigation.
 * Never uses an LLM; 100% deterministic, local, and sub-millisecond execution.
 */
export function computeSubjectAwareLayout(
  template: CaptionTemplate,
  metrics: SubjectMetrics | null,
  canvasWidth: number,
  canvasHeight: number,
  rawFontSize: number,
  estimatedTextWidth: number,
  estimatedTextHeight: number
): AdjustedTextLayout {
  // 1. Fallback if no subject is detected or metrics are missing
  if (!metrics || !metrics.hasSubject) {
    return {
      x: canvasWidth / 2,
      y: canvasHeight * (template.layout.yPositionPercent || 0.72),
      fontSize: rawFontSize,
      occlusionRatio: 0,
      isOccludedWarning: false,
      isFallback: true,
      layoutMode: "standard",
    };
  }

  const { boundingBox, headRegion } = metrics;
  const subLeft = boundingBox.x * canvasWidth;
  const subRight = (boundingBox.x + boundingBox.width) * canvasWidth;
  const subTop = boundingBox.y * canvasHeight;
  const subBottom = (boundingBox.y + boundingBox.height) * canvasHeight;

  // By default, anchor dynamically to the detected subject's horizontal centroid
  let targetX = headRegion ? headRegion.centerX * canvasWidth : canvasWidth / 2;
  let targetY = canvasHeight * template.layout.yPositionPercent;
  let targetFontSize = rawFontSize;
  let layoutMode: AdjustedTextLayout["layoutMode"] = "standard";
  let arcParams: AdjustedTextLayout["arcParams"] = undefined;

  // 2. Specific Style Placement Logic
  if (template.id === "behind_head_giant_word") {
    // Giant single word directly behind head, scaled to peek out on both sides
    layoutMode = "behind_head";
    targetX = headRegion.centerX * canvasWidth;
    targetY = headRegion.centerY * canvasHeight;

    const headWidthPx = headRegion.radiusX * 2 * canvasWidth;
    const minRequiredWidth = headWidthPx * 1.45; // Must peek out 45% beyond head width
    if (estimatedTextWidth < minRequiredWidth && estimatedTextWidth > 0) {
      targetFontSize = Math.round(rawFontSize * (minRequiredWidth / estimatedTextWidth));
    }
  } else if (template.id === "behind_cover_stack") {
    // Magazine cover: placed crowning behind head
    layoutMode = "standard";
    targetX = headRegion.centerX * canvasWidth;
    targetY = Math.max(
      canvasHeight * 0.18,
      (headRegion.centerY - headRegion.radiusY * 0.65) * canvasHeight
    );
  } else if (template.id === "behind_curved_arc") {
    // Radial arc hugging head & shoulders
    layoutMode = "arc";
    const arcRadius = Math.max(
      canvasWidth * 0.32,
      headRegion.radiusX * canvasWidth * 1.55
    );
    arcParams = {
      centerX: headRegion.centerX * canvasWidth,
      centerY: headRegion.centerY * canvasHeight,
      radius: arcRadius,
      startAngleRad: -Math.PI * 0.65,
      endAngleRad: -Math.PI * 0.35,
    };
    targetX = arcParams.centerX;
    targetY = arcParams.centerY;
  } else if (template.id === "behind_vertical_sidetext") {
    // Vertical side-text running behind left or right shoulder
    layoutMode = "vertical_flank";
    // Place in the flank with greatest available space
    const leftMargin = subLeft;
    const rightMargin = canvasWidth - subRight;

    if (leftMargin >= rightMargin) {
      targetX = Math.round(leftMargin * 0.55);
    } else {
      targetX = Math.round(subRight + rightMargin * 0.45);
    }
    targetY = (boundingBox.y + boundingBox.height * 0.38) * canvasHeight;
  } else if (template.id === "behind_sandwich_layer") {
    layoutMode = "sandwich";
    targetX = headRegion.centerX * canvasWidth;
    targetY = canvasHeight * template.layout.yPositionPercent;
  } else if (template.layout.behindSubjectDepth) {
    // General behind-the-subject styles (Behind You White, Neon Halo, Cinema Letterbox, etc.)
    // Anchor horizontally behind the detected subject
    targetX = headRegion.centerX * canvasWidth;
    targetY = canvasHeight * template.layout.yPositionPercent;

    // Scale font size up if text is narrower than the subject's torso so it peeks out on both sides
    const torsoWidthPx = boundingBox.width * canvasWidth;
    const minPeekingWidth = Math.max(torsoWidthPx * 1.35, canvasWidth * 0.42);
    if (estimatedTextWidth < minPeekingWidth && estimatedTextWidth > 0) {
      targetFontSize = Math.round(rawFontSize * (minPeekingWidth / estimatedTextWidth));
    }
  }

  // 3. Occlusion and Legibility Check
  const effectiveTextW = estimatedTextWidth * (targetFontSize / rawFontSize);
  const effectiveTextH = estimatedTextHeight * (targetFontSize / rawFontSize);

  const textLeft = targetX - effectiveTextW / 2;
  const textRight = targetX + effectiveTextW / 2;
  const textTop = targetY - effectiveTextH / 2;
  const textBottom = targetY + effectiveTextH / 2;

  const overlapW = Math.max(0, Math.min(textRight, subRight) - Math.max(textLeft, subLeft));
  const overlapH = Math.max(0, Math.min(textBottom, subBottom) - Math.max(textTop, subTop));
  const overlapArea = overlapW * overlapH;
  const textArea = Math.max(1, effectiveTextW * effectiveTextH);
  let occlusionRatio = Math.round((overlapArea / textArea) * 100) / 100;

  let isOccludedWarning = false;

  // If more than 50% of the text area is occluded by the subject:
  if (occlusionRatio > 0.50 && layoutMode !== "vertical_flank" && layoutMode !== "behind_head") {
    // Step A: Scale up text by up to 25% so wings peek out further
    targetFontSize = Math.round(targetFontSize * 1.25);
    const newTextW = effectiveTextW * 1.25;
    const newTextLeft = targetX - newTextW / 2;
    const newTextRight = targetX + newTextW / 2;
    const newOverlapW = Math.max(0, Math.min(newTextRight, subRight) - Math.max(newTextLeft, subLeft));
    occlusionRatio = Math.round(((newOverlapW * overlapH) / (newTextW * effectiveTextH)) * 100) / 100;

    // Step B: If still >50% occluded, adjust vertical position toward negative space
    if (occlusionRatio > 0.50) {
      if (headRegion.centerY > 0.4) {
        // Nudge upward
        targetY = Math.max(canvasHeight * 0.18, targetY - canvasHeight * 0.1);
      } else {
        // Nudge downward
        targetY = Math.min(canvasHeight * 0.85, targetY + canvasHeight * 0.1);
      }
      isOccludedWarning = true;
    }
  }

  return {
    x: Math.round(targetX),
    y: Math.round(targetY),
    fontSize: targetFontSize,
    occlusionRatio,
    isOccludedWarning,
    isFallback: false,
    layoutMode,
    arcParams,
  };
}
