/**
 * Rule-Based Devanagari to Roman Script Transliterator with Schwa-Deletion Heuristics.
 * 100% Deterministic, local and zero-latency.
 */

const VOWELS_INDEPENDENT: Record<string, string> = {
  "अ": "a",
  "आ": "aa",
  "इ": "i",
  "ई": "ee",
  "उ": "u",
  "ऊ": "oo",
  "ऋ": "ri",
  "ए": "e",
  "ऐ": "ai",
  "ओ": "o",
  "औ": "au",
  "अं": "an",
  "अँ": "an",
  "अः": "ah",
};

const VOWEL_MATRAS: Record<string, string> = {
  "ा": "a",
  "ि": "i",
  "ी": "i",
  "ु": "u",
  "ू": "u",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
  "ं": "n",
  "ँ": "n",
  "ः": "h",
};

const CONSONANTS: Record<string, string> = {
  // Gutturals
  "क": "k",
  "ख": "kh",
  "ग": "g",
  "घ": "gh",
  "ङ": "ng",
  // Palatals
  "च": "ch",
  "छ": "chh",
  "ज": "j",
  "झ": "jh",
  "ञ": "ny",
  // Retroflex
  "ट": "t",
  "ठ": "th",
  "ड": "d",
  "ढ": "dh",
  "ण": "n",
  // Dentals
  "त": "t",
  "थ": "th",
  "द": "d",
  "ध": "dh",
  "न": "n",
  // Labials
  "प": "p",
  "फ": "ph",
  "ब": "b",
  "भ": "bh",
  "म": "m",
  // Semivowels & Sibilants
  "य": "y",
  "र": "r",
  "ल": "l",
  "व": "v",
  "श": "sh",
  "ष": "sh",
  "स": "s",
  "ह": "h",
  // Nukta consonants (Urdu/Persian sounds)
  "क़": "q",
  "ख़": "kh",
  "ग़": "gh",
  "ज़": "z",
  "ड़": "d",
  "ढ़": "dh",
  "फ़": "f",
};

const HALANT = "\u094D"; // ्
const NUKTA = "\u093C";  // ़

export function isDevanagariChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x0900 && code <= 0x097f;
}

export function isDevanagariWord(word: string): boolean {
  for (let i = 0; i < word.length; i++) {
    if (isDevanagariChar(word[i])) return true;
  }
  return false;
}

/**
 * Transliterates a Devanagari word to conversational Roman Hinglish.
 * Applies Hindi phonetic schwa deletion.
 */
export function transliterateDevanagariWord(word: string): string {
  // Separate leading or trailing punctuation (e.g. "किया," -> "किया" + ",")
  const match = word.match(/^([^\u0900-\u097f]*)([\u0900-\u097f\u093c]+)([^\u0900-\u097f]*)$/);
  if (!match) return word;

  const prefixPunct = match[1] || "";
  const devToken = match[2];
  const suffixPunct = match[3] || "";

  const chars = Array.from(devToken);
  let result = "";

  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];

    // Check for Nukta combining character
    if (i + 1 < chars.length && chars[i + 1] === NUKTA) {
      ch = ch + NUKTA;
      i++;
    }

    // 1. Independent Vowel
    if (VOWELS_INDEPENDENT[ch]) {
      result += VOWELS_INDEPENDENT[ch];
      continue;
    }

    // 2. Consonant
    if (CONSONANTS[ch]) {
      const romanConsonant = CONSONANTS[ch];
      const nextChar = i + 1 < chars.length ? chars[i + 1] : null;

      if (nextChar === HALANT) {
        // Suppress inherent vowel; next is halant
        result += romanConsonant;
        i++; // skip halant
      } else if (nextChar && VOWEL_MATRAS[nextChar]) {
        // Consonant followed by vowel matra
        result += romanConsonant;
        result += VOWEL_MATRAS[nextChar];
        i++; // skip matra
      } else {
        // Inherent schwa /a/ handling:
        // Rule: Delete word-final schwa (e.g., "कमल" -> "kamal", not "kamala")
        const isWordFinal = i === chars.length - 1;

        if (isWordFinal) {
          result += romanConsonant;
        } else {
          // Medial schwa deletion heuristics:
          // Rule A: In C1-C2-C3-C4 words (e.g. मतलब, हरकत, बचपन), schwa drops at C2
          const isSecondOfFourConsonants =
            i === 1 &&
            nextChar &&
            CONSONANTS[nextChar] &&
            i + 2 < chars.length &&
            CONSONANTS[chars[i + 2]];

          // Rule B: In C1-C2-V words (e.g. क-र-ता / करता), C2 schwa drops -> "karta", not "karata"
          const nextNextChar = i + 2 < chars.length ? chars[i + 2] : null;
          const followedByConsonantAndMatra =
            nextChar && CONSONANTS[nextChar] && nextNextChar && VOWEL_MATRAS[nextNextChar];

          if (isSecondOfFourConsonants || (followedByConsonantAndMatra && i > 0)) {
            result += romanConsonant;
          } else {
            result += romanConsonant + "a";
          }
        }
      }
      continue;
    }

    // 3. Standalone Matra (fallback)
    if (VOWEL_MATRAS[ch]) {
      result += VOWEL_MATRAS[ch];
      continue;
    }

    // Any other character
    result += ch;
  }

  return prefixPunct + result + suffixPunct;
}
