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
 * positions, and word-by-word karaoke highlights.
 */
export function generateAss(
  words: WordToken[],
  template: CaptionTemplate,
  videoWidth: number = 1080,
  videoHeight: number = 1920,
  maxWordsPerCue: number = 4
): string {
  const cues = groupWordsIntoCues(words, maxWordsPerCue);

  const rawFont = template.typography.primaryFont || 'Arial';
  const cleanFont = rawFont.split(',')[0].replace(/['"]/g, '').trim() || 'Arial';

  const isAnimated = Boolean(
    template.animation?.perWordEffect && template.animation.perWordEffect !== 'none'
  );
  // In ASS karaoke, SecondaryColour is the base unhighlighted text color,
  // and PrimaryColour is the highlighted active word color that \k sweeps into.
  const primaryColorAss = hexToAssColor(
    isAnimated ? (template.colors.activeWordText || '#FFE600') : template.colors.primaryText
  );
  const secondaryColorAss = hexToAssColor(template.colors.primaryText);
  const outlineColorAss = hexToAssColor(template.colors.strokeColor || '#000000');
  const backColorAss = hexToAssColor(
    template.box?.enabled
      ? (template.box.bgColor || '#000000')
      : (template.colors.shadowColor || '#000000'),
    template.box?.enabled ? 0.3 : 0.2
  );

  const fontSizeAss = Math.max(24, Math.round(videoHeight * (template.typography.fontSizeBasePercent || 0.045)));
  const strokeWidthAss = Math.max(
    2,
    Math.round((template.colors.strokeWidthPercent || 0.003) * videoHeight)
  );
  const shadowDepthAss = template.colors.shadowBlur ? Math.min(8, Math.max(1, Math.round(template.colors.shadowBlur / 3))) : 2;

  // Use Bottom-Center (2) alignment with marginV measuring upward from bottom
  const alignment = 2;
  const marginV = Math.max(
    40,
    Math.round(videoHeight * Math.max(0.05, Math.min(0.95, 1 - template.layout.yPositionPercent)))
  );

  const boldAss = template.typography.primaryWeight === '900' || template.typography.primaryWeight === 'bold' ? -1 : 0;

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
    `Style: Default,${cleanFont},${fontSizeAss},${primaryColorAss},${secondaryColorAss},${outlineColorAss},${backColorAss},${boldAss},0,0,0,100,100,0,0,1,${strokeWidthAss},${shadowDepthAss},${alignment},40,40,${marginV},1`,
    '',
  ];

  const events = [
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  cues.forEach((cue) => {
    const startTimeStr = formatAssTime(cue.start);
    const endTimeStr = formatAssTime(cue.end);

    // Build karaoke word timing if animated active word is configured
    let dialogueText = '';
    if (isAnimated || template.animation?.perWordEffect === 'karaoke_fill' || template.animation?.perWordEffect === 'scale_pop') {
      dialogueText = cue.words
        .map((w) => {
          const durationCentis = Math.max(5, Math.round((w.end - w.start) * 100));
          return `{\\k${durationCentis}}${w.text}`;
        })
        .join(' ');
    } else {
      dialogueText = cue.text;
    }

    events.push(`Dialogue: 0,${startTimeStr},${endTimeStr},Default,,0,0,0,,${dialogueText}`);
  });

  return [...scriptInfo, ...styles, ...events, ''].join('\n');
}
