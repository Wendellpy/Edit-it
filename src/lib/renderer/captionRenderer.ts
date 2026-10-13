import type { CaptionTemplate } from "../templates/schema";
import type { WordToken } from "../timestampRefiner";
import type { SubjectMetrics } from "../segmentation/types";
import { computeSubjectAwareLayout, type AdjustedTextLayout } from "./subjectAwareLayout";

export interface RenderCaptionFrameOptions {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  currentTime: number;
  tokens: WordToken[];
  template: CaptionTemplate;
  showBehindBadge?: boolean;
  syncOffsetSeconds?: number;

  // Behind-the-Subject 3D Depth Compositing
  videoSource?: CanvasImageSource | null;
  segmentationMask?: Uint8Array | null;
  maskWidth?: number;
  maskHeight?: number;
  subjectMetrics?: SubjectMetrics | null;
  showMaskOverlay?: boolean;
  layerOrder?: "behind" | "front" | "sandwich";
  fitMode?: "fit" | "cover" | "stretch";
}

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  displayEnd: number;
  words: WordToken[];
}

export function buildCaptionCues(tokens: WordToken[], maxWords: number): CaptionCue[] {
  if (!tokens || tokens.length === 0) return [];

  const cues: CaptionCue[] = [];
  let currentWords: WordToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];

    currentWords.push(token);

    const pauseToNext = next ? next.start - token.end : 0;
    const endsSentence = /[.!?]$/.test(token.text.trim());
    const endsClause = /[,;:\-—]$/.test(token.text.trim());

    const shouldBreak =
      currentWords.length >= maxWords ||
      pauseToNext > 0.35 ||
      endsSentence ||
      (endsClause && currentWords.length >= 2);

    if (shouldBreak || i === tokens.length - 1) {
      if (currentWords.length > 0) {
        cues.push({
          id: `cue_${cues.length + 1}`,
          start: currentWords[0].start,
          end: currentWords[currentWords.length - 1].end,
          displayEnd: currentWords[currentWords.length - 1].end,
          words: [...currentWords],
        });
        currentWords = [];
      }
    }
  }

  const holdDuration = 0.25;
  for (let i = 0; i < cues.length; i++) {
    const current = cues[i];
    const next = cues[i + 1];
    if (next) {
      const gap = next.start - current.end;
      if (gap > 0) {
        current.displayEnd = Math.min(current.end + holdDuration, next.start - 0.04);
      } else {
        current.displayEnd = current.end;
      }
    } else {
      current.displayEnd = current.end + holdDuration;
    }
  }

  return cues;
}

/**
 * Draws the masked cutout of the subject over the background canvas.
 * Draw order: 1. Video frame -> 2. Behind-subject caption -> 3. Subject cutout -> 4. Foreground text
 */
export function drawSubjectCutout(
  targetCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  videoSource: CanvasImageSource,
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  fitMode: "fit" | "cover" | "stretch" = "fit"
): void {
  // If targetCtx is a mock test context without real offscreen support, log command and exit
  if (typeof (targetCtx as any).getLog === "function") {
    (targetCtx as any).getLog().push(`drawSubjectCutout(${maskWidth}x${maskHeight})`);
    return;
  }

  let cutoutCanvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    cutoutCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  } else if (typeof document !== "undefined") {
    cutoutCanvas = document.createElement("canvas");
    cutoutCanvas.width = canvasWidth;
    cutoutCanvas.height = canvasHeight;
  } else {
    return;
  }

  const cutoutCtx = cutoutCanvas.getContext("2d");
  if (!cutoutCtx) return;

  // Compute aspect-ratio bounds to align with video viewport
  let dstX = 0;
  let dstY = 0;
  let dstW = canvasWidth;
  let dstH = canvasHeight;

  const vW = (videoSource as HTMLVideoElement).videoWidth || (videoSource as any).width || canvasWidth;
  const vH = (videoSource as HTMLVideoElement).videoHeight || (videoSource as any).height || canvasHeight;

  if (vW && vH) {
    const vAspect = vW / vH;
    const cAspect = canvasWidth / canvasHeight;
    if (Math.abs(vAspect - cAspect) > 0.01) {
      if (fitMode === "cover") {
        if (vAspect > cAspect) {
          dstH = canvasHeight;
          dstW = Math.round(canvasHeight * vAspect);
          dstX = Math.round((canvasWidth - dstW) / 2);
          dstY = 0;
        } else {
          dstW = canvasWidth;
          dstH = Math.round(canvasWidth / vAspect);
          dstX = 0;
          dstY = Math.round((canvasHeight - dstH) / 2);
        }
      } else if (fitMode === "stretch") {
        dstW = canvasWidth;
        dstH = canvasHeight;
        dstX = 0;
        dstY = 0;
      } else {
        // default fit / contain
        if (vAspect > cAspect) {
          dstW = canvasWidth;
          dstH = Math.round(canvasWidth / vAspect);
          dstX = 0;
          dstY = Math.round((canvasHeight - dstH) / 2);
        } else {
          dstH = canvasHeight;
          dstW = Math.round(canvasHeight * vAspect);
          dstX = Math.round((canvasWidth - dstW) / 2);
          dstY = 0;
        }
      }
    }
  }

  // 1. Draw video frame into cutout buffer with aspect-ratio alignment
  try {
    cutoutCtx.drawImage(videoSource, dstX, dstY, dstW, dstH);
  } catch {
    return;
  }

  // 2. Prepare mask image data
  let maskCanvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    maskCanvas = new OffscreenCanvas(maskWidth, maskHeight);
  } else if (typeof document !== "undefined") {
    maskCanvas = document.createElement("canvas");
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
  } else {
    return;
  }

  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return;

  const maskImgData = maskCtx.createImageData(maskWidth, maskHeight);
  const data = maskImgData.data;
  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i];
    const idx = i * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = alpha;
  }
  maskCtx.putImageData(maskImgData, 0, 0);

  // 3. Mask the cutout buffer using destination-in
  cutoutCtx.globalCompositeOperation = "destination-in";
  cutoutCtx.drawImage(maskCanvas, dstX, dstY, dstW, dstH);

  // 4. Composite subject cutout on top of caption text
  targetCtx.save();
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.drawImage(cutoutCanvas, 0, 0, canvasWidth, canvasHeight);
  targetCtx.restore();
}

/**
 * Draws translucent cyan mask overlay for visual mask quality inspection.
 */
function drawMaskOverlay(
  targetCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  mask: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (typeof (targetCtx as any).getLog === "function") {
    (targetCtx as any).getLog().push("drawMaskOverlay");
    return;
  }

  let overlayCanvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    overlayCanvas = new OffscreenCanvas(maskWidth, maskHeight);
  } else if (typeof document !== "undefined") {
    overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = maskWidth;
    overlayCanvas.height = maskHeight;
  } else {
    return;
  }

  const oCtx = overlayCanvas.getContext("2d");
  if (!oCtx) return;

  const imgData = oCtx.createImageData(maskWidth, maskHeight);
  const data = imgData.data;
  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i];
    const idx = i * 4;
    data[idx] = 6;      // Cyan tint
    data[idx + 1] = 182;
    data[idx + 2] = 212;
    data[idx + 3] = Math.round(alpha * 0.45);
  }
  oCtx.putImageData(imgData, 0, 0);

  targetCtx.save();
  targetCtx.drawImage(overlayCanvas, 0, 0, canvasWidth, canvasHeight);
  targetCtx.restore();
}

/**
 * Shared Canvas 2D / OffscreenCanvas Caption Renderer.
 * Used by BOTH live player preview and video export worker to guarantee frame-identical output.
 * Renders stable caption cards with frame-accurate word timing, subject-aware placement, and behind-depth compositing.
 */
export function renderCaptionFrame(options: RenderCaptionFrameOptions): void {
  const {
    ctx,
    canvasWidth,
    canvasHeight,
    currentTime,
    tokens,
    template,
    showBehindBadge = true,
    syncOffsetSeconds = 0,
    videoSource = null,
    segmentationMask = null,
    maskWidth = 384,
    maskHeight = 512,
    subjectMetrics = null,
    showMaskOverlay = false,
    layerOrder,
    fitMode = "fit",
  } = options;

  if (!tokens || tokens.length === 0) return;

  const effectiveTime = Math.max(0, currentTime + syncOffsetSeconds);
  const isLandscape = canvasWidth > canvasHeight;

  // 1. Group chunk into lines
  const wordsPerLine = isLandscape
    ? Math.max(template.layout.maxWordsPerLine || 2, 4)
    : template.layout.maxWordsPerLine || 2;
  const maxLines = template.layout.maxLines || 2;
  const maxWords = wordsPerLine * maxLines;

  // 2. Build stable cue cards
  const cues = buildCaptionCues(tokens, maxWords);

  // 3. Find the currently active cue card
  const activeCue = cues.find(
    (c) => effectiveTime >= c.start && effectiveTime <= c.displayEnd
  );

  if (!activeCue || activeCue.words.length === 0) return;

  const currentChunk = activeCue.words;

  // 4. Find active word within this cue card
  const activeWord = currentChunk.find(
    (w) => effectiveTime >= w.start && effectiveTime <= w.end
  );

  // 5. Typography metrics
  const baseScale = template.typography.fontSizeBasePercent || 0.05;
  let fontSize = isLandscape
    ? Math.round(canvasHeight * Math.max(0.065, baseScale * 1.15))
    : Math.round(canvasHeight * baseScale);

  const primaryFontFamily = template.typography.primaryFont || "Impact, sans-serif";
  const secondaryFontFamily = template.typography.secondaryFont || "Playfair Display, serif";
  let lineHeight = fontSize * 1.25;

  ctx.save();

  // 6. Split current chunk into stable visual lines
  const lines: WordToken[][] = [];
  if (template.id === "behind_vertical_sidetext") {
    // Vertical side text: 1 word per line
    for (const w of currentChunk) {
      lines.push([w]);
    }
  } else {
    for (let i = 0; i < currentChunk.length; i += wordsPerLine) {
      lines.push(currentChunk.slice(i, i + wordsPerLine));
    }
  }

  // Measure estimated text dimensions for layout planning
  ctx.font = `${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`;
  let estMaxLineWidth = 0;
  for (const line of lines) {
    const lineText = line
      .map((w) => formatWordText(w.text, template.typography.textTransform))
      .join(" ");
    const m = ctx.measureText(lineText).width;
    if (m > estMaxLineWidth) estMaxLineWidth = m;
  }
  const estBlockHeight = lines.length * lineHeight;

  // 7. Subject-Aware Layout Computation
  let adjustedLayout: AdjustedTextLayout;
  const isDepthActive =
    layerOrder !== undefined
      ? layerOrder !== "front"
      : !!template.layout.behindSubjectDepth;

  if (isDepthActive) {
    adjustedLayout = computeSubjectAwareLayout(
      template,
      subjectMetrics,
      canvasWidth,
      canvasHeight,
      fontSize,
      estMaxLineWidth,
      estBlockHeight
    );
    if (layerOrder === "sandwich") {
      adjustedLayout.layoutMode = "sandwich";
    }
    fontSize = adjustedLayout.fontSize;
    lineHeight = fontSize * 1.25;
  } else {
    const yPercent = isLandscape
      ? Math.max(0.82, template.layout.yPositionPercent)
      : template.layout.yPositionPercent;
    adjustedLayout = {
      x: canvasWidth / 2,
      y: canvasHeight * yPercent,
      fontSize,
      occlusionRatio: 0,
      isOccludedWarning: false,
      isFallback: false,
      layoutMode: "standard",
    };
  }

  const totalBlockHeight = lines.length * lineHeight;
  const centerY = adjustedLayout.y;
  const startY = centerY - totalBlockHeight / 2;

  // 8. Optional Depth Badge
  if (template.badge && showBehindBadge) {
    const badgeHeight = Math.round(fontSize * 0.45);
    const badgeWidth = Math.round(badgeHeight * 4.4);
    const badgeX = canvasWidth * 0.08;
    const badgeY = canvasHeight * 0.08;

    ctx.save();
    ctx.fillStyle = template.layout.behindSubjectDepth ? "#38BDF8" : "#F59E0B";
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();

    ctx.fillStyle = "#09090B";
    ctx.font = `bold ${Math.round(badgeHeight * 0.65)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(template.badge, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
    ctx.restore();
  }

  // 9. Render Background Box
  if (template.box && template.box.enabled) {
    ctx.save();
    ctx.font = `${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`;
    let maxLineWidth = 0;
    for (const line of lines) {
      const lineText = line
        .map((w) => formatWordText(w.text, template.typography.textTransform))
        .join(" ");
      const width = ctx.measureText(lineText).width;
      if (width > maxLineWidth) maxLineWidth = width;
    }

    const boxW = maxLineWidth + template.box.paddingX * 2;
    const boxH = totalBlockHeight + template.box.paddingY * 2;
    const boxX = (canvasWidth - boxW) / 2;
    const boxY = centerY - boxH / 2;

    if (template.box.rotationDeg) {
      ctx.translate(canvasWidth / 2, centerY);
      ctx.rotate((template.box.rotationDeg * Math.PI) / 180);
      ctx.translate(-canvasWidth / 2, -centerY);
    }

    ctx.fillStyle = template.box.bgColor;
    roundRect(ctx, boxX, boxY, boxW, boxH, template.box.borderRadius);
    ctx.fill();

    if (template.box.borderColor && template.box.borderWidth) {
      ctx.strokeStyle = template.box.borderColor;
      ctx.lineWidth = template.box.borderWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Helper to render text words
  const renderTextPass = (isFrontPass: boolean) => {
    lines.forEach((line, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight + lineHeight / 2;

      let totalLineWidth = 0;
      const wordMetrics: Array<{ width: number; isSecondary: boolean; text: string }> = [];

      line.forEach((word) => {
        const isSecondary =
          !!template.typography.secondaryFont &&
          (word.script === "devanagari" ||
            word.text.includes(",") ||
            (lineIdx === 0 && lines.length > 1));

        const font = isSecondary
          ? `italic ${fontSize}px ${secondaryFontFamily}`
          : `${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`;

        ctx.font = font;
        const formatted = formatWordText(word.text, template.typography.textTransform);
        const m = ctx.measureText(formatted);
        wordMetrics.push({ width: m.width, isSecondary, text: formatted });
        totalLineWidth += m.width;
      });

      const spaceWidth = fontSize * 0.28;
      totalLineWidth += (line.length - 1) * spaceWidth;

      let currentX =
        adjustedLayout.layoutMode === "vertical_flank"
          ? adjustedLayout.x
          : (canvasWidth - totalLineWidth) / 2;

      line.forEach((word, wordIdx) => {
        const metric = wordMetrics[wordIdx];
        const isCurrentlySpoken =
          effectiveTime >= word.start && effectiveTime <= word.end;
        const isActive = activeWord ? word.id === activeWord.id : isCurrentlySpoken;
        const isPastWord = effectiveTime > word.end;

        // In Sandwich mode:
        // Behind pass draws ONLY the active keyword
        // Front pass draws ONLY the surrounding context words
        if (adjustedLayout.layoutMode === "sandwich") {
          if (!isFrontPass && !isActive) {
            currentX += metric.width + spaceWidth;
            return;
          }
          if (isFrontPass && isActive) {
            currentX += metric.width + spaceWidth;
            return;
          }
        }

        ctx.save();

        const isItalicKeyword =
          isActive && template.typography.wordTransform?.italicKeyword;

        ctx.font = isItalicKeyword
          ? `italic ${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`
          : metric.isSecondary
          ? `italic ${fontSize}px ${secondaryFontFamily}`
          : `${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`;

        ctx.textBaseline = "middle";

        const wordCenterX = currentX + metric.width / 2;
        const wordCenterY = lineY;

        // Radial Arc Placement
        if (adjustedLayout.layoutMode === "arc" && adjustedLayout.arcParams) {
          const arc = adjustedLayout.arcParams;
          const arcSpread = arc.endAngleRad - arc.startAngleRad;
          const tProgress = currentChunk.length > 1 ? wordIdx / (currentChunk.length - 1) : 0.5;
          const angle = arc.startAngleRad + tProgress * arcSpread;

          const arcX = arc.centerX + Math.cos(angle) * arc.radius;
          const arcY = arc.centerY + Math.sin(angle) * arc.radius;

          ctx.translate(arcX, arcY);
          ctx.rotate(angle + Math.PI / 2);
          ctx.translate(-wordCenterX, -wordCenterY);
        } else if (template.typography.wordTransform?.randomTiltDeg) {
          const tiltMax = template.typography.wordTransform.randomTiltDeg;
          const tiltDeg = (((wordIdx * 7 + 3) % 5) - 2) * (tiltMax / 2);
          ctx.translate(wordCenterX, wordCenterY);
          ctx.rotate((tiltDeg * Math.PI) / 180);
          ctx.translate(-wordCenterX, -wordCenterY);
        }

        // Kinetic pop animations
        if (isActive && template.animation) {
          const { perWordEffect, scaleMagnitude = 1.15 } = template.animation;
          if (
            perWordEffect === "scale_pop" ||
            perWordEffect === "bounce" ||
            perWordEffect === "brush_reveal" ||
            perWordEffect === "hollow_fill" ||
            perWordEffect === "extrusion_3d"
          ) {
            ctx.translate(wordCenterX, wordCenterY);
            ctx.scale(scaleMagnitude, scaleMagnitude);
            ctx.translate(-wordCenterX, -wordCenterY);
          } else if (perWordEffect === "glitch_jitter") {
            const jitterX =
              Math.sin((effectiveTime - word.start) * 40) *
              (template.animation.glitchOffsetPx || 4);
            ctx.translate(jitterX, 0);
          } else if (perWordEffect === "flicker") {
            const flickerFreq = template.animation.flickerFrequency || 28;
            const flickerAlpha =
              0.8 + 0.2 * Math.sin((effectiveTime - word.start) * flickerFreq);
            ctx.globalAlpha *= flickerAlpha;
          }
        }

        // Shadows / Glow
        if (isActive && template.colors.glowColor) {
          ctx.shadowColor = template.colors.glowColor;
          ctx.shadowBlur = template.colors.shadowBlur || 20;
        } else if (template.colors.shadowColor) {
          ctx.shadowColor = template.colors.shadowColor;
          ctx.shadowBlur = template.colors.shadowBlur || 10;
        }

        // 3D Extrusion
        if (template.colors.extrusion) {
          const ext = template.colors.extrusion;
          const totalDepth = canvasHeight * ext.depthPercent;
          const rad = (ext.angleDeg * Math.PI) / 180;
          const stepX = (Math.cos(rad) * totalDepth) / ext.steps;
          const stepY = (Math.sin(rad) * totalDepth) / ext.steps;

          ctx.save();
          ctx.fillStyle = ext.color;
          ctx.shadowBlur = 0;
          for (let s = ext.steps; s >= 1; s--) {
            ctx.fillText(metric.text, currentX + s * stepX, lineY + s * stepY);
          }
          ctx.restore();
        }

        // Multi-layer strokes
        if (template.colors.multiStrokes && template.colors.multiStrokes.length > 0) {
          const sorted = [...template.colors.multiStrokes].sort(
            (a, b) => b.widthPercent - a.widthPercent
          );
          for (const st of sorted) {
            ctx.save();
            ctx.strokeStyle = st.color;
            ctx.lineWidth = Math.round(canvasHeight * st.widthPercent);
            ctx.lineJoin = "round";
            ctx.strokeText(metric.text, currentX, lineY);
            ctx.restore();
          }
        } else if (template.colors.strokeColor && template.colors.strokeWidthPercent) {
          ctx.strokeStyle = template.colors.strokeColor;
          ctx.lineWidth = Math.round(canvasHeight * template.colors.strokeWidthPercent);
          ctx.lineJoin = "round";
          ctx.strokeText(metric.text, currentX, lineY);
        }

        // Glitch chromatic split
        if (isActive && template.animation?.perWordEffect === "glitch_jitter") {
          const splitPx = template.animation.glitchOffsetPx || 4;
          ctx.save();
          ctx.fillStyle = "rgba(239, 68, 68, 0.75)";
          ctx.fillText(metric.text, currentX - splitPx, lineY);
          ctx.fillStyle = "rgba(6, 182, 212, 0.75)";
          ctx.fillText(metric.text, currentX + splitPx, lineY);
          ctx.restore();
        }

        // Dim upcoming words
        if (!isActive && !isPastWord) {
          ctx.globalAlpha = 0.40;
        } else {
          ctx.globalAlpha = 1.0;
        }

        const activeColor =
          template.colors.activeWordText && template.colors.activeWordText !== template.colors.primaryText
            ? template.colors.activeWordText
            : "#F59E0B";

        let fillStyle: string | CanvasGradient = isActive
          ? activeColor
          : isPastWord
          ? template.colors.primaryText
          : metric.isSecondary && template.colors.secondaryText
          ? template.colors.secondaryText
          : template.colors.secondaryText || "rgba(255, 255, 255, 0.45)";

        // Gradient Fill
        const gradConfig =
          (isActive && template.colors.activeWordGradient) || template.colors.gradient;
        if (gradConfig && gradConfig.stops.length >= 2) {
          const rad = ((gradConfig.angleDeg ?? 90) * Math.PI) / 180;
          const grad = ctx.createLinearGradient(
            currentX,
            lineY - fontSize / 2,
            currentX + Math.cos(rad) * metric.width,
            lineY - fontSize / 2 + Math.sin(rad) * fontSize
          );
          for (const stop of gradConfig.stops) {
            grad.addColorStop(stop.offset, stop.color);
          }
          fillStyle = grad;
        }

        if (template.animation?.perWordEffect === "hollow_fill" && !isActive) {
          fillStyle = "transparent";
        }

        ctx.fillStyle = fillStyle;
        ctx.fillText(metric.text, currentX, lineY);

        // Animated Swash Underline
        if (isActive && template.animation?.underline?.enabled) {
          const u = template.animation.underline;
          const uY = lineY + fontSize * 0.52;
          ctx.save();
          ctx.strokeStyle = u.color;
          ctx.lineWidth = Math.round(canvasHeight * u.thicknessPercent);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(currentX - 2, uY);
          ctx.quadraticCurveTo(
            currentX + metric.width / 2,
            uY + Math.round(fontSize * 0.12),
            currentX + metric.width + 4,
            uY - 1
          );
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
        currentX += metric.width + spaceWidth;
      });
    });
  };

  // 10. Execution of Compositing Layers
  if (isDepthActive) {
    // PASS 1: Render Behind-the-Subject Text
    renderTextPass(false);

    // PASS 2: Cutout Subject on top of text (if videoSource & segmentationMask provided)
    if (videoSource && segmentationMask) {
      drawSubjectCutout(
        ctx,
        videoSource,
        segmentationMask,
        maskWidth,
        maskHeight,
        canvasWidth,
        canvasHeight,
        fitMode
      );
    }

    // PASS 3: Render Foreground Text (e.g. Sandwich context words)
    if (adjustedLayout.layoutMode === "sandwich") {
      renderTextPass(true);
    }

    // PASS 4: Optional Mask Preview Overlay
    if (showMaskOverlay && segmentationMask) {
      drawMaskOverlay(ctx, segmentationMask, maskWidth, maskHeight, canvasWidth, canvasHeight);
    }
  } else {
    // Normal single-pass foreground render (standard or fallback)
    renderTextPass(true);
  }

  ctx.restore();
}

/**
 * Convenient parameter order wrapper for renderCaptionFrame
 */
export function renderCaptionsToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  words: { id?: string; text: string; start: number; end: number; confidence: number; script?: "latin" | "devanagari" | "roman" }[],
  template: CaptionTemplate,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  syncOffsetSeconds = 0,
  behindCompositing?: {
    videoSource?: CanvasImageSource | null;
    segmentationMask?: Uint8Array | null;
    maskWidth?: number;
    maskHeight?: number;
    subjectMetrics?: SubjectMetrics | null;
    showMaskOverlay?: boolean;
    layerOrder?: "behind" | "front" | "sandwich";
    fitMode?: "fit" | "cover" | "stretch";
  }
): void {
  const tokens: WordToken[] = words.map((w, idx) => ({
    id: w.id || `word_${idx}`,
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
    script: w.script === "latin" ? "roman" : w.script,
  }));

  renderCaptionFrame({
    ctx,
    canvasWidth,
    canvasHeight,
    currentTime,
    tokens,
    template,
    syncOffsetSeconds,
    videoSource: behindCompositing?.videoSource,
    segmentationMask: behindCompositing?.segmentationMask,
    maskWidth: behindCompositing?.maskWidth,
    maskHeight: behindCompositing?.maskHeight,
    subjectMetrics: behindCompositing?.subjectMetrics,
    showMaskOverlay: behindCompositing?.showMaskOverlay,
    layerOrder: behindCompositing?.layerOrder,
    fitMode: behindCompositing?.fitMode,
  });
}

function formatWordText(
  text: string,
  transform: "uppercase" | "lowercase" | "none" | "capitalize"
): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}

function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
