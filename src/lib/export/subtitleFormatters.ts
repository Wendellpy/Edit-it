import type { WordToken } from '@/lib/timestampRefiner';
import type { CaptionTemplate } from '@/lib/templates/schema';

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
}

/**
 * Groups raw word-level timestamps into readable subtitle cues.
 * Default max words per cue is 4 (ideal for Reels/Shorts fast consumption), max duration 2.5s.
 */
export function groupWordsIntoCues(
  words: WordToken[],
  maxWordsPerCue: number = 4,
  maxDurationSec: number = 2.5
): SubtitleCue[] {
  if (!words || words.length === 0) return [];

  const cues: SubtitleCue[] = [];
  let currentGroup: WordToken[] = [];
  let cueIndex = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = currentGroup[currentGroup.length - 1];

    const groupDuration = currentGroup.length > 0 
      ? word.end - currentGroup[0].start 
      : word.end - word.start;

    // Boundary conditions: max words exceeded, max duration exceeded, or big silence pause (> 0.6s)
    const pauseBreak = prevWord ? (word.start - prevWord.end) > 0.6 : false;
    const punctuationBreak = prevWord && /[.?!]$/.test(prevWord.text.trim());

    if (
      currentGroup.length > 0 &&
      (currentGroup.length >= maxWordsPerCue || groupDuration > maxDurationSec || pauseBreak || punctuationBreak)
    ) {
      cues.push({
        id: cueIndex++,
        start: currentGroup[0].start,
        end: Math.max(currentGroup[currentGroup.length - 1].end, currentGroup[0].start + 0.3),
        text: currentGroup.map((w) => w.text).join(' '),
        words: [...currentGroup],
      });
      currentGroup = [word];
    } else {
      currentGroup.push(word);
    }
  }

  if (currentGroup.length > 0) {
    cues.push({
      id: cueIndex++,
      start: currentGroup[0].start,
      end: Math.max(currentGroup[currentGroup.length - 1].end, currentGroup[0].start + 0.3),
      text: currentGroup.map((w) => w.text).join(' '),
      words: [...currentGroup],
    });
  }

  return cues;
}

/**
 * Format seconds to SubRip timecode: HH:MM:SS,mmm
 */
export function formatSrtTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const millis = Math.floor((safeSec % 1) * 1000);

  return (
    String(hrs).padStart(2, '0') +
    ':' +
    String(mins).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    ',' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Format seconds to WebVTT timecode: HH:MM:SS.mmm
 */
export function formatVttTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const millis = Math.floor((safeSec % 1) * 1000);

  return (
    String(hrs).padStart(2, '0') +
    ':' +
    String(mins).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Format seconds to ASS timecode: H:MM:SS.cc (centiseconds)
 */
export function formatAssTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const centis = Math.floor(((safeSec % 1) * 100));

  return (
    String(hrs) +
    ':' +
    String(mins).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(centis).padStart(2, '0')
  );
}

/**
 * Converts CSS hex color (#RRGGBB or #RGB) to ASS style format: &H00BBGGRR&
 */
export function hexToAssColor(hex: string, alpha: number = 0): string {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    cleanHex = 'FFFFFF';
  }

  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);
  const aHex = Math.floor(alpha * 255).toString(16).padStart(2, '0').toUpperCase();

  // ASS uses &HAABBGGRR& where AA is transparency (00 is opaque, FF is transparent)
  return `&H${aHex}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}&`;
}

/**
 * Generates SubRip (.srt) subtitle document
 */
export function generateSrt(words: WordToken[], maxWordsPerCue: number = 4): string {
  const cues = groupWordsIntoCues(words, maxWordsPerCue);
  if (cues.length === 0) return '';

  return cues
    .map((cue) => {
      return `${cue.id}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`;
    })
    .join('\n');
}

/**
 * Generates WebVTT (.vtt) subtitle document with styling
 */
export function generateVtt(
  words: WordToken[],
  template?: CaptionTemplate,
  maxWordsPerCue: number = 4
): string {
  const cues = groupWordsIntoCues(words, maxWordsPerCue);
  const lines: string[] = ['WEBVTT', ''];

  if (template) {
    lines.push('STYLE');
    lines.push('::cue {');
    lines.push(`  font-family: "${template.typography.primaryFont}", sans-serif;`);
    lines.push(`  color: ${template.colors.primaryText};`);
    if (template.colors.strokeColor) {
      lines.push(
        `  text-shadow: -1px -1px 0 ${template.colors.strokeColor}, 1px -1px 0 ${template.colors.strokeColor}, -1px 1px 0 ${template.colors.strokeColor}, 1px 1px 0 ${template.colors.strokeColor};`
      );
    }
    if (template.box?.enabled && template.box.bgColor) {
      lines.push(`  background-color: ${template.box.bgColor};`);
    }
    lines.push('}');
    lines.push('');
  }

  cues.forEach((cue) => {
    lines.push(String(cue.id));
    lines.push(`${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)} align:center line:85%`);
    lines.push(cue.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Generates Advanced SubStation Alpha (.ass) format with accurate font, colors,
 * positions, and dynamic word-by-word reveal animations matching preview.
 */
export function generateAss(
  words: WordToken[],
  template: CaptionTemplate,
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  maxWordsPerCue: number = 4
): string {
  const cues = groupWordsIntoCues(words, maxWordsPerCue);

  const rawFont = template.typography?.primaryFont || 'Arial';
  const cleanFont = rawFont.split(',')[0].replace(/['"]/g, '').trim() || 'Arial';

  // Apply typography transform (MrBeast is UPPERCASE)
  const textTransform = template.typography?.textTransform || 'none';
  const applyTransform = (text: string): string => {
    if (!text) return '';
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    if (textTransform === 'capitalize') {
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return text;
  };

  const isAnimated = Boolean(
    template.animation?.perWordEffect && template.animation.perWordEffect !== 'none'
  );
  const isKaraokeFill = template.animation?.perWordEffect === 'karaoke_fill';
  const isSingleWord = Boolean(template.layout?.singleWordOnly);
  const scaleMag = template.animation?.scaleMagnitude || 1.15;
  const activeScalePct = Math.min(150, Math.max(105, Math.round(scaleMag * 100)));

  const primaryColorAss = hexToAssColor(template.colors.primaryText || '#FFFFFF');
  const activeColorAss = hexToAssColor(template.colors.activeWordText || '#FFE600');
  const secondaryColorAss = hexToAssColor(template.colors.secondaryText || '#38BDF8');
  const outlineColorAss = hexToAssColor(template.colors.strokeColor || '#000000');
  const shadowColorAss = hexToAssColor(template.colors.shadowColor || '#000000', 0.2);
  const boxBgColorAss = hexToAssColor(template.box?.bgColor || '#000000', 0.25);

  const fontSizeAss = Math.max(28, Math.round(videoHeight * (template.typography?.fontSizeBasePercent || 0.05)));
  const strokeWidthAss = template.colors.strokeWidthPercent
    ? Math.min(16, Math.max(2, Math.round(template.colors.strokeWidthPercent * videoHeight)))
    : 6;
  const shadowDepthAss = template.colors.shadowBlur
    ? Math.min(10, Math.max(1, Math.round(template.colors.shadowBlur / 2.5)))
    : 3;

  const borderStyle = template.box?.enabled ? 3 : 1;
  const backColorAss = template.box?.enabled ? boxBgColorAss : shadowColorAss;

  // Bottom-Center (2) alignment
  const alignment = 2;
  const yPos = template.layout?.yPositionPercent ?? 0.74;
  const marginV = Math.max(
    40,
    Math.round(videoHeight * Math.max(0.05, Math.min(0.95, 1 - yPos)))
  );

  const isBold =
    template.typography?.primaryWeight === '900' ||
    template.typography?.primaryWeight === 'bold' ||
    cleanFont.toLowerCase().includes('black');
  const boldAss = isBold ? -1 : 0;

  const scriptInfo = [
    '[Script Info]',
    'Title: BolSub Studio Subtitles',
    'Original Script: BolSub Studio Local AI Engine',
    'ScriptType: v4.00+',
    'Collisions: Normal',
    `PlayResX: ${videoWidth}`,
    `PlayResY: ${videoHeight}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
  ];

  const styles = [
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${cleanFont},${fontSizeAss},${primaryColorAss},${primaryColorAss},${outlineColorAss},${backColorAss},${boldAss},0,0,0,100,100,0,0,${borderStyle},${strokeWidthAss},${shadowDepthAss},${alignment},40,40,${marginV},1`,
    '',
  ];

  const events = [
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  cues.forEach((cue) => {
    if (!cue.words || cue.words.length === 0) {
      events.push(
        `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${applyTransform(cue.text)}`
      );
      return;
    }

    if (isKaraokeFill) {
      // Classic ASS \k sweep
      const dialogueText = cue.words
        .map((w) => {
          const durationCentis = Math.max(5, Math.round((w.end - w.start) * 100));
          return `{\\k${durationCentis}}${applyTransform(w.text)}`;
        })
        .join(' ');
      events.push(
        `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${dialogueText}`
      );
      return;
    }

    if (!isAnimated) {
      // Static display
      events.push(
        `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,${applyTransform(cue.text)}`
      );
      return;
    }

    // Dynamic word-by-word reveal (Shorts / Reels / MrBeast dynamic bounce)
    // Upcoming words are hidden until spoken, active word is highlighted & popped, passed words remain visible
    const words = cue.words;
    const n = words.length;

    for (let i = 0; i < n; i++) {
      const w = words[i];
      const nextWordStart = i < n - 1 ? words[i + 1].start : cue.end;

      // 1. Spoken interval for word i
      const activeStart = w.start;
      const activeEnd = Math.max(activeStart + 0.05, Math.min(w.end, nextWordStart));

      if (activeEnd > activeStart) {
        let lineText = '';
        if (isSingleWord) {
          lineText = `{\\c${activeColorAss}\\fscx${activeScalePct}\\fscy${activeScalePct}}${applyTransform(w.text)}`;
        } else {
          const parts: string[] = [];
          for (let j = 0; j < i; j++) {
            const prevW = words[j];
            const cAss = prevW.isKeyword ? secondaryColorAss : primaryColorAss;
            parts.push(`{\\c${cAss}\\fscx100\\fscy100}${applyTransform(prevW.text)}`);
          }
          parts.push(`{\\c${activeColorAss}\\fscx${activeScalePct}\\fscy${activeScalePct}}${applyTransform(w.text)}`);
          lineText = parts.join(' ');
        }
        events.push(
          `Dialogue: 0,${formatAssTime(activeStart)},${formatAssTime(activeEnd)},Default,,0,0,0,,${lineText}`
        );
      }

      // 2. Pause interval before next word starts (or until cue end)
      const pauseStart = activeEnd;
      const pauseEnd = nextWordStart;
      if (pauseEnd - pauseStart >= 0.05 && !isSingleWord) {
        const parts: string[] = [];
        for (let j = 0; j <= i; j++) {
          const prevW = words[j];
          const cAss = prevW.isKeyword ? secondaryColorAss : primaryColorAss;
          parts.push(`{\\c${cAss}\\fscx100\\fscy100}${applyTransform(prevW.text)}`);
        }
        events.push(
          `Dialogue: 0,${formatAssTime(pauseStart)},${formatAssTime(pauseEnd)},Default,,0,0,0,,${parts.join(' ')}`
        );
      }
    }
  });

  return [...scriptInfo, ...styles, ...events, ''].join('\n');
}

