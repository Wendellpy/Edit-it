import type { CaptionTemplate } from "../templates/schema";
import type { WordToken } from "../timestampRefiner";

export interface RenderCaptionFrameOptions {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  currentTime: number;
  tokens: WordToken[];
  template: CaptionTemplate;
  showBehindBadge?: boolean;
  syncOffsetSeconds?: number;
}

interface CaptionCue {
  id: string;
  start: number;
  end: number;
  displayEnd: number;
  words: WordToken[];
}

/**
 * Builds stable, human-readable caption cue cards from word tokens.
 * Groups words by sentence boundaries, natural pauses (>0.35s), and visual line limits.
 */
function buildCaptionCues(tokens: WordToken[], maxWords: number): CaptionCue[] {
  if (!tokens || tokens.length === 0) return [];

  const cues: CaptionCue[] = [];
  let currentWords: WordToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = currentWords[currentWords.length - 1];
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
          displayEnd: currentWords[currentWords.length - 1].end, // computed in 2nd pass
          words: [...currentWords],
        });
        currentWords = [];
      }
    }
  }

  // Second pass: compute natural hold times between cues to prevent rapid visual blinking
  const holdDuration = 0.25;
  for (let i = 0; i < cues.length; i++) {
    const current = cues[i];
    const next = cues[i + 1];
    if (next) {
      const gap = next.start - current.end;
      if (gap > 0) {
        // Keep card visible for up to holdDuration, but never overlap into the next cue
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
 * Shared Canvas 2D / OffscreenCanvas Caption Renderer.
 * Used by BOTH live player preview and video export worker to guarantee frame-identical output.
 * Renders stable caption cards with frame-accurate word timing and micro-sync compensation.
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
  } = options;

  if (!tokens || tokens.length === 0) return;

  // Apply optional timing offset for audio output latency calibration
  const effectiveTime = Math.max(0, currentTime + syncOffsetSeconds);

  const isLandscape = canvasWidth > canvasHeight;

  // 1. Group chunk into lines
  // In widescreen 16:9, allow 3-5 words per line so captions don't look like an awkward narrow tower
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

  // If effectiveTime is in a silent period between cues, do not render captions
  if (!activeCue || activeCue.words.length === 0) return;

  const currentChunk = activeCue.words;

  // 4. Find active word within this cue card
  const activeWord = currentChunk.find(
    (w) => effectiveTime >= w.start && effectiveTime <= w.end
  );

  // 5. Typography metrics
  const baseScale = template.typography.fontSizeBasePercent || 0.05;
  const fontSize = isLandscape
    ? Math.round(canvasHeight * Math.max(0.065, baseScale * 1.15))
    : Math.round(canvasHeight * baseScale);

  const primaryFontFamily = template.typography.primaryFont || "Impact, sans-serif";
  const secondaryFontFamily = template.typography.secondaryFont || "Playfair Display, serif";
  const lineHeight = fontSize * 1.25;

  ctx.save();

  // 6. Split current chunk into stable visual lines
  const lines: WordToken[][] = [];
  for (let i = 0; i < currentChunk.length; i += wordsPerLine) {
    lines.push(currentChunk.slice(i, i + wordsPerLine));
  }

  // 7. Compute vertical layout position
  const yPercent = isLandscape
    ? Math.max(0.82, template.layout.yPositionPercent)
    : template.layout.yPositionPercent;
  const totalBlockHeight = lines.length * lineHeight;
  const centerY = canvasHeight * yPercent;
  const startY = centerY - totalBlockHeight / 2;

  // 8. Optional "BEHIND YOU" depth badge
  if (template.badge && showBehindBadge) {
    const badgeHeight = Math.round(fontSize * 0.45);
    const badgeWidth = Math.round(badgeHeight * 4.2);
    const badgeX = canvasWidth * 0.08;
    const badgeY = canvasHeight * 0.08;

    ctx.save();
    ctx.fillStyle = "#F59E0B"; // Amber badge
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();

    ctx.fillStyle = "#09090B";
    ctx.font = `bold ${Math.round(badgeHeight * 0.65)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(template.badge, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
    ctx.restore();
  }

  // 9. Render Background Box (e.g. Neon Lime Sticker Box)
  if (template.box && template.box.enabled) {
    ctx.save();

    // Measure total bounding box width across lines
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
    ctx.restore();
  }

  // 10. Render Text Lines & Active Word Animations
  lines.forEach((line, lineIdx) => {
    const lineY = startY + lineIdx * lineHeight + lineHeight / 2;

    // Measure total width of line with spacing
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

    // Center alignment starting X
    let currentX = (canvasWidth - totalLineWidth) / 2;

    line.forEach((word, wordIdx) => {
      const metric = wordMetrics[wordIdx];
      const isCurrentlySpoken =
        effectiveTime >= word.start && effectiveTime <= word.end;
      const isActive = activeWord ? word.id === activeWord.id : isCurrentlySpoken;
      const isPastWord = effectiveTime > word.end;

      ctx.save();

      // Configure font
      ctx.font = metric.isSecondary
        ? `italic ${fontSize}px ${secondaryFontFamily}`
        : `${template.typography.primaryWeight} ${fontSize}px ${primaryFontFamily}`;

      ctx.textBaseline = "middle";

      const wordCenterX = currentX + metric.width / 2;
      const wordCenterY = lineY;

      // Handle Per-Word Animation Effects (Only when word is actively spoken!)
      if (isActive && template.animation) {
        const { perWordEffect, scaleMagnitude } = template.animation;

        if (perWordEffect === "scale_pop") {
          ctx.translate(wordCenterX, wordCenterY);
          ctx.scale(scaleMagnitude, scaleMagnitude);
          ctx.translate(-wordCenterX, -wordCenterY);
        } else if (perWordEffect === "bounce") {
          const bounceOffset = Math.sin((effectiveTime - word.start) * 16) * 5;
          ctx.translate(0, -bounceOffset);
        }
      }

      // Configure Shadows / Glow
      if (isActive && template.colors.glowColor) {
        ctx.shadowColor = template.colors.glowColor;
        ctx.shadowBlur = template.colors.shadowBlur || 20;
      } else if (template.colors.shadowColor) {
        ctx.shadowColor = template.colors.shadowColor;
        ctx.shadowBlur = template.colors.shadowBlur || 10;
      }

      // Stroke pass (if configured)
      if (template.colors.strokeColor && template.colors.strokeWidthPercent) {
        ctx.strokeStyle = template.colors.strokeColor;
        ctx.lineWidth = Math.round(canvasHeight * template.colors.strokeWidthPercent);
        ctx.strokeText(metric.text, currentX, lineY);
      }

      // Dim upcoming words that have not been reached yet so they never visually lead the audio
      if (!isActive && !isPastWord) {
        ctx.globalAlpha = 0.40;
      } else {
        ctx.globalAlpha = 1.0;
      }

      // Fill pass:
      // Active word -> high-contrast accent pop
      // Past read words -> primaryText
      // Upcoming words -> secondaryText
      const activeColor =
        template.colors.activeWordText && template.colors.activeWordText !== template.colors.primaryText
          ? template.colors.activeWordText
          : "#F59E0B";

      const fillColor = isActive
        ? activeColor
        : isPastWord
        ? template.colors.primaryText
        : metric.isSecondary && template.colors.secondaryText
        ? template.colors.secondaryText
        : template.colors.secondaryText || "rgba(255, 255, 255, 0.45)";

      ctx.fillStyle = fillColor;
      ctx.fillText(metric.text, currentX, lineY);

      ctx.restore();

      currentX += metric.width + spaceWidth;
    });
  });

  ctx.restore();
}

/**
 * Convenient parameter order wrapper for renderCaptionFrame
 */
export function renderCaptionsToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  words: { id?: string; text: string; start: number; end: number; confidence: number }[],
  template: CaptionTemplate,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  syncOffsetSeconds = 0
): void {
  const tokens: WordToken[] = words.map((w, idx) => ({
    id: w.id || `word_${idx}`,
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));

  renderCaptionFrame({
    ctx,
    canvasWidth,
    canvasHeight,
    currentTime,
    tokens,
    template,
    syncOffsetSeconds,
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
