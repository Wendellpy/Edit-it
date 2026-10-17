import type { WordToken } from '@/lib/timestampRefiner';

/**
 * Common filler words across conversational Hinglish and English.
 */
export const FILLER_WORDS = new Set([
  'um', 'umm', 'uh', 'uhh', 'er', 'ah', 'ahh',
  'matlab', 'basically', 'like', 'actually', 'literally',
  'you know', 'sort of', 'kind of',
]);

/**
 * Common Indian / English abusive or profanity terms for optional bleeping/masking.
 */
export const PROFANITY_WORDS = new Set([
  // English
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fucks', 'fuckin',
  'motherfucker', 'motherfucking',
  'shit', 'shits', 'shitting', 'shitty', 'bullshit',
  'bitch', 'bitches', 'bitching', 'bitchy',
  'ass', 'asshole', 'assholes', 'asses',
  'bastard', 'bastards',
  'damn', 'damned',
  'cunt', 'cunts',
  'dick', 'dicks', 'dickhead',
  'pussy', 'pussies',
  'cock', 'cocks', 'cocksucker',
  'whore', 'whores',
  'slut', 'sluts',
  'nigger', 'nigga', 'niggaz',
  'twat', 'prick',

  // Hindi / Hinglish
  'bc', 'mc',
  'chutiya', 'chutiye', 'chutiyapa', 'chut', 'choot',
  'bhenchod', 'behenchod', 'bhenchodd', 'behenchodd',
  'madarchod', 'maderchod', 'madarchodd',
  'bhosdike', 'bhosadike', 'bhosda', 'bhosadi',
  'gaand', 'gand', 'gandu', 'gaandu',
  'lauda', 'lawda', 'loda', 'lodu', 'lavda',
  'harami', 'haraami',
  'kamina', 'kamine', 'kameena',
  'saala', 'sala', 'saale', 'sale',
  'randi', 'raandi', 'kuttiya', 'kutta',
  'jhaant', 'mutth', 'chuda', 'chudai', 'chudao',
]);

/**
 * Censors a curse word by writing a few letters and replacing the rest with ** (e.g. "f**k", "s**t", "b***h").
 * Accurately preserves original punctuation, capitalization, and suffixes.
 */
export function censorCurseWord(rawWord: string): string {
  if (!rawWord || typeof rawWord !== 'string') return rawWord;

  // Split leading and trailing punctuation from the core alphanumeric token
  const match = rawWord.match(/^([^a-zA-Z0-9\u0900-\u097F]*)(.*?)([^a-zA-Z0-9\u0900-\u097F]*)$/);
  if (!match) return rawWord;

  const prefix = match[1] || '';
  const core = match[2] || '';
  const suffix = match[3] || '';

  if (!core) return rawWord;

  const lower = core.toLowerCase();

  // Check if exact match or contains a known profanity stem
  const isProfane =
    PROFANITY_WORDS.has(lower) ||
    (lower.length >= 4 &&
      Array.from(PROFANITY_WORDS).some(
        (p) => p.length >= 4 && (lower === p || lower.startsWith(p) || lower.endsWith(p))
      ));

  if (!isProfane) {
    return rawWord;
  }

  const len = core.length;
  let censored = '';

  if (len <= 2) {
    censored = core[0] + '*';
  } else if (len === 3) {
    censored = core[0] + '**';
  } else if (len === 4) {
    // e.g. "fuck" -> "f**k", "shit" -> "s**t", "damn" -> "d**n", "cunt" -> "c**t"
    censored = core[0] + '**' + core[3];
  } else if (len === 5) {
    // e.g. "bitch" -> "b***h", "pussy" -> "p***y", "whore" -> "w***e"
    censored = core[0] + '***' + core[4];
  } else {
    // 6+ characters (e.g. "fucking", "chutiya", "asshole", "bhenchod", "bastard")
    if (lower.endsWith('ing') && len >= 6) {
      // "fucking" -> "f***ing"
      censored = core[0] + '*'.repeat(len - 4) + core.slice(len - 3);
    } else if ((lower.endsWith('er') || lower.endsWith('ed')) && len >= 6) {
      // "fucked" -> "f***ed", "fucker" -> "f***er"
      censored = core[0] + '*'.repeat(len - 3) + core.slice(len - 2);
    } else if (lower.startsWith('ass') && len >= 7) {
      // "asshole" -> "a**hole"
      censored = core[0] + '**' + core.slice(3);
    } else if (lower.startsWith('chut') && len >= 6) {
      // "chutiya" -> "ch***ya"
      censored = core.slice(0, 2) + '*'.repeat(len - 4) + core.slice(len - 2);
    } else if (lower.startsWith('bhen') || lower.startsWith('behen')) {
      // "bhenchod" -> "bh***hod"
      censored = core.slice(0, 2) + '*'.repeat(len - 5) + core.slice(len - 3);
    } else {
      // Generic multi-letter: keep first 1-2 letters, asterisks, and last 1-2 letters
      const leadCount = len >= 8 ? 2 : 1;
      const trailCount = len >= 8 ? 2 : 1;
      const starCount = Math.max(2, len - leadCount - trailCount);
      censored = core.slice(0, leadCount) + '*'.repeat(starCount) + core.slice(len - trailCount);
    }
  }

  // Preserve all-caps casing if original was all uppercase (e.g. FUCK -> F**K)
  if (core === core.toUpperCase() && /[A-Z]/.test(core)) {
    censored = censored.toUpperCase();
  } else if (core[0] === core[0].toUpperCase()) {
    censored = censored[0].toUpperCase() + censored.slice(1);
  }

  return prefix + censored + suffix;
}

/**
 * Flags filler words in transcript.
 */
export function detectFillerWords<T extends WordToken>(tokens: T[]): T[] {
  return tokens.map((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isFiller = FILLER_WORDS.has(clean);
    return {
      ...token,
      isFiller,
    };
  });
}

/**
 * Removes all detected filler words from transcript while preserving timeline continuity.
 */
export function removeFillerWords<T extends WordToken>(tokens: T[]): T[] {
  return tokens.filter((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !FILLER_WORDS.has(clean);
  });
}

/**
 * Masks profanity words. Supports:
 * - 'partial' (default): Writes a few letters and ** the rest (e.g. "f**k", "s**t", "b***h").
 * - 'full': Replaces all following letters with maskChar (e.g. "s****").
 */
export function maskProfanity<T extends WordToken>(
  tokens: T[],
  maskChar?: string,
  mode?: 'partial' | 'full'
): T[] {
  const effectiveMode = mode || (maskChar ? 'full' : 'partial');
  return tokens.map((token) => {
    const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isProfane =
      PROFANITY_WORDS.has(clean) ||
      (clean.length >= 4 && Array.from(PROFANITY_WORDS).some((p) => p.length >= 4 && clean.includes(p)));

    if (isProfane) {
      const masked =
        effectiveMode === 'full' && maskChar
          ? token.text.length > 2
            ? token.text[0] + maskChar.repeat(token.text.length - 1)
            : maskChar.repeat(token.text.length)
          : censorCurseWord(token.text);

      return {
        ...token,
        text: masked,
        isProfanity: true,
      };
    }
    return token;
  });
}

/**
 * Detects silent gaps longer than maxSilenceSeconds (e.g. 0.8s) for jump-cut recommendation.
 */
export function findSilenceGaps(
  tokens: WordToken[],
  maxSilenceSeconds: number = 0.8
): Array<{ start: number; end: number; duration: number }> {
  const gaps: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];
    const gapDuration = next.start - current.end;

    if (gapDuration >= maxSilenceSeconds) {
      gaps.push({
        start: current.end,
        end: next.start,
        duration: Math.round(gapDuration * 100) / 100,
      });
    }
  }

  return gaps;
}

/**
 * Decodes HTML entities commonly found in subtitle files (e.g. &gt; &lt; &amp; &#39; &quot;)
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    });
}

/**
 * Checks if a word token is an artifact/noise marker:
 * - Speaker change indicators: ">>", ">>>", ">", "&gt;&gt;", "&gt;&gt;&gt;", "> >"
 * - Closed-caption audio descriptions: "[Music]", "[Applause]", "[Laughter]", "[Inaudible]", "(music)", "(applause)"
 * - Blank or symbol-only artifacts
 */
export function isArtifactWord(rawWord: string): boolean {
  if (!rawWord || typeof rawWord !== 'string') return true;
  const decoded = decodeHtmlEntities(rawWord).trim();
  if (!decoded) return true;

  // Speaker change markers e.g. ">>", ">>>", ">", ">>>>>", "> >", ">>-", "-->>"
  if (/[>]/.test(decoded) && /^[\s>\-_.*~]+$/.test(decoded)) return true;

  // HTML entity speaker markers that weren't decoded e.g. "&gt;&gt;", "&gt; &gt;"
  if (/&gt;/i.test(decoded) && /^[\s&;gt\-_.*~]+$/i.test(decoded)) return true;

  // Non-verbal bracketed sound cues e.g. "[Music]", "[Applause]", "(Laughter)", "[inaudible]", "[silence]"
  if (/^[\[(][a-zA-Z0-9\s_.,:/-]+[\])]$/.test(decoded)) return true;
  if (/^[\[(]?(music|applause|laughter|inaudible|chuckle|cheering|gasp|sigh|sighs|groan|screaming|snicker|bell|applause|sound)[\])]?$/i.test(decoded)) return true;

  // Repetitive punctuation / noise artifacts like "***", "---", "..."
  if (/^[*_~=\-–—.]+$/.test(decoded)) return true;

  return false;
}

/**
 * Cleans a caption word token:
 * - Decodes HTML entities (e.g. &gt;&gt; -> >>)
 * - Strips leading/trailing speaker change chevrons (e.g. ">>Hello" -> "Hello")
 * - Trims whitespace
 */
export function cleanCaptionWord(rawWord: string): string {
  if (!rawWord || typeof rawWord !== 'string') return '';
  let cleaned = decodeHtmlEntities(rawWord).trim();

  // Strip leading speaker change arrows e.g. ">>Hello" -> "Hello", "&gt;&gt;Hello" -> "Hello"
  cleaned = cleaned.replace(/^[>\s]+/, '').replace(/[<\s]+$/, '').trim();

  // If the word itself was an artifact marker or is now empty, return empty
  if (isArtifactWord(cleaned)) {
    return '';
  }

  return cleaned;
}

/**
 * Filters an array of WordTokens, removing all noise artifacts, speaker markers,
 * and empty tokens.
 */
export function filterArtifactTokens<T extends { text: string }>(tokens: T[]): T[] {
  if (!tokens || !Array.isArray(tokens)) return [];
  const result: T[] = [];

  for (const tok of tokens) {
    if (!tok || typeof tok.text !== 'string') continue;
    if (isArtifactWord(tok.text)) continue;

    const cleanedText = cleanCaptionWord(tok.text);
    if (!cleanedText) continue;

    result.push({
      ...tok,
      text: cleanedText,
    });
  }

  return result;
}
