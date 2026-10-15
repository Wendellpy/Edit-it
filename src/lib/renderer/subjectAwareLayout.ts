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
 * Strictly guarantees captions NEVER exceed video screen boundaries.
 */
export function computeSubjectAwareLayout(
  template: CaptionTemplate,
  metrics: SubjectMetrics | null,
  canvasWidth: number,
  canvasHeight: number,
  rawFontSize: number,
  estimatedTextWidth: number,
  estimatedTextHeight: number,
  layerOrderOverride?: "behind" | "front" | "sandwich"
): AdjustedTextLayout {
  // Screen safe margins & maximum allowed bounds
  const safeMarginX = Math.round(canvasWidth * 0.08);
  const maxSafeTextWidth = Math.max(100, Math.round(canvasWidth - safeMarginX * 2));
  const safeMarginTop = Math.round(canvasHeight * 0.12);
  const safeMarginBottom = Math.round(canvasHeight * 0.14);

  const clampFontSizeToSafeWidth = (size: number): number => {
    if (estimatedTextWidth <= 0) return size;
    const projectedWidth = estimatedTextWidth * (size / rawFontSize);
    if (projectedWidth > maxSafeTextWidth) {
      return Math.max(14, Math.floor(rawFontSize * (maxSafeTextWidth / estimatedTextWidth)));
    }
    return size;
  };

  // 1. Fallback if no subject is detected or metrics are missing
  if (!metrics || !metrics.hasSubject) {
    const safeTargetFontSize = clampFontSizeToSafeWidth(rawFontSize);
    return {
      x: canvasWidth / 2,
      y: canvasHeight * (template.layout.yPositionPercent || 0.72),
      fontSize: safeTargetFontSize,
      occlusionRatio: 0,
      isOccludedWarning: false,
      isFallback: true,
      layoutMode: layerOrderOverride === "sandwich" || template.layout.layerOrder === "sandwich" ? "sandwich" : "standard",
    };
  }

  const { boundingBox, headRegion } = metrics;
  const subLeft = boundingBox.x * canvasWidth;
  const subRight = (boundingBox.x + boundingBox.width) * canvasWidth;

  // By default, anchor dynamically to the detected subject's horizontal centroid
  let targetX = headRegion ? headRegion.centerX * canvasWidth : canvasWidth / 2;
  let targetY = canvasHeight * template.layout.yPositionPercent;
  let targetFontSize = rawFontSize;
  let layoutMode: AdjustedTextLayout["layoutMode"] = "standard";
  let arcParams: AdjustedTextLayout["arcParams"] = undefined;

  const isSandwich = layerOrderOverride === "sandwich" || template.id === "behind_sandwich_layer" || template.layout.layerOrder === "sandwich";
  const isBehind = layerOrderOverride === "behind" || template.layout.behindSubjectDepth;

  // 2. Specific Style Placement Logic
  if (template.id === "behind_head_giant_word") {
    // Giant single word directly behind head, scaled to peek out on both sides
    layoutMode = "behind_head";
    targetX = headRegion.centerX * canvasWidth;
    targetY = headRegion.centerY * canvasHeight;

    const headWidthPx = headRegion.radiusX * 2 * canvasWidth;
    const minRequiredWidth = Math.min(maxSafeTextWidth, headWidthPx * 1.35); // Peek out beyond head width, capped at safe screen width
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
  } else if (isSandwich) {
    layoutMode = "sandwich";
    targetX = headRegion.centerX * canvasWidth;
    // Position comfortably across the neck/upper-chest junction so Line 0 peeks behind shoulders and Line 1 sits in front
    const anchorY = template.layout.yPositionPercent && template.layout.yPositionPercent >= 0.35 && template.layout.yPositionPercent <= 0.65
      ? template.layout.yPositionPercent
      : (headRegion.centerY + headRegion.radiusY * 1.1);
    targetY = canvasHeight * anchorY;

    // Scale font size dynamically according to the actual object size so text peeks out proportionately, capped at safe screen width
    const torsoWidthPx = boundingBox.width * canvasWidth;
    const minPeekingWidth = Math.min(maxSafeTextWidth, Math.max(torsoWidthPx * 1.25, canvasWidth * 0.20));
    if (estimatedTextWidth < minPeekingWidth && estimatedTextWidth > 0) {
      targetFontSize = Math.round(rawFontSize * (minPeekingWidth / estimatedTextWidth));
    }
  } else if (isBehind) {
    // General behind-the-subject styles (Behind You White, Neon Halo, Cinema Letterbox, etc.)
    // Anchor horizontally behind the detected subject
    targetX = headRegion.centerX * canvasWidth;
    targetY = canvasHeight * (template.layout.yPositionPercent || 0.45);

    // Scale font size dynamically according to the actual object size so text peeks out proportionately, capped at safe screen width
    const torsoWidthPx = boundingBox.width * canvasWidth;
    const minPeekingWidth = Math.min(maxSafeTextWidth, Math.max(torsoWidthPx * 1.25, canvasWidth * 0.20));
    if (estimatedTextWidth < minPeekingWidth && estimatedTextWidth > 0) {
      targetFontSize = Math.round(rawFontSize * (minPeekingWidth / estimatedTextWidth));
    }
  }

  // Strictly enforce safe width ceiling before occlusion check
  targetFontSize = clampFontSizeToSafeWidth(targetFontSize);

  // 3. Occlusion and Legibility Check
  const effectiveTextW = estimatedTextWidth * (targetFontSize / rawFontSize);
  const effectiveTextH = estimatedTextHeight * (targetFontSize / rawFontSize);

  const textLeft = targetX - effectiveTextW / 2;
  const textRight = targetX + effectiveTextW / 2;
  const textTop = targetY - effectiveTextH / 2;
  const textBottom = targetY + effectiveTextH / 2;

  const overlapW = Math.max(0, Math.min(textRight, subRight) - Math.max(textLeft, subLeft));
  const overlapH = Math.max(0, Math.min(textBottom, (boundingBox.y + boundingBox.height) * canvasHeight) - Math.max(textTop, boundingBox.y * canvasHeight));
  const overlapArea = overlapW * overlapH;
  const textArea = Math.max(1, effectiveTextW * effectiveTextH);
  let occlusionRatio = Math.round((overlapArea / textArea) * 100) / 100;

  let isOccludedWarning = false;

  // If more than 50% of the text area is occluded by the subject:
  if (occlusionRatio > 0.50 && layoutMode !== "vertical_flank" && layoutMode !== "behind_head") {
    isOccludedWarning = true;
    // Scale up text width so wings peek out further into open space on both sides, strictly capped at safe screen width
    const scaleFactor = Math.min(1.20, Math.max(1.05, 0.85 / Math.max(0.2, 1.01 - occlusionRatio)));
    targetFontSize = clampFontSizeToSafeWidth(Math.round(targetFontSize * scaleFactor));
  }

  // 4. Horizontal Screen Boundary Clamping
  // Clamps targetX so [targetX - halfW, targetX + halfW] never exceeds safe margins
  const finalEffectiveW = estimatedTextWidth * (targetFontSize / rawFontSize);
  const halfTextW = finalEffectiveW / 2;
  const minTargetX = safeMarginX + halfTextW;
  const maxTargetX = canvasWidth - safeMarginX - halfTextW;
  if (minTargetX <= maxTargetX) {
    targetX = Math.max(minTargetX, Math.min(maxTargetX, targetX));
  } else {
    targetX = canvasWidth / 2;
  }

  // 5. Vertical Screen Boundary Clamping
  // Clamps targetY so [targetY - halfH, targetY + halfH] never exceeds safe margins
  const finalEffectiveH = estimatedTextHeight * (targetFontSize / rawFontSize);
  const halfTextH = finalEffectiveH / 2;
  const minTargetY = safeMarginTop + halfTextH;
  const maxTargetY = canvasHeight - safeMarginBottom - halfTextH;
  if (minTargetY <= maxTargetY) {
    targetY = Math.max(minTargetY, Math.min(maxTargetY, targetY));
  } else {
    targetY = (safeMarginTop + canvasHeight - safeMarginBottom) / 2;
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
