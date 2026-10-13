import type { WordToken } from '@/lib/timestampRefiner';

/**
 * Stopwords in English and conversational Hinglish that should never be emphasized.
 */
export const STOPWORDS = new Set([
  // English
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 'which', 'this',
  'that', 'these', 'those', 'then', 'so', 'than', 'such', 'both', 'through', 'about',
  'for', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  // Hinglish
  'hai', 'hain', 'ho', 'hun', 'tha', 'thi', 'the', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein',
  'par', 'pe', 'aur', 'ya', 'to', 'toh', 'bhi', 'kya', 'kyun', 'kaise', 'kab', 'kahan',
  'ye', 'yeh', 'wo', 'woh', 'in', 'un', 'apna', 'apne', 'apni', 'meri', 'mera', 'mere',
  'tera', 'teri', 'tere', 'uska', 'uski', 'uske', 'iska', 'iski', 'iske', 'hoga', 'hogi',
  'hoge', 'karo', 'kare', 'karna', 'karte', 'karta', 'raha', 'rahi', 'rahe',
]);

/**
 * High-impact creator power words in conversational Indian social content.
 */
export const POWER_WORDS = new Set([
  'secret', 'secrets', 'trick', 'tricks', 'viral', 'hack', 'hacks', 'formula',
  'insane', 'free', 'best', 'worst', 'top', 'first', 'guaranteed', 'mistake',
  'mistakes', 'dangerous', 'danger', 'stop', 'watch', 'fast', 'bhai', 'yaar',
  'paisa', 'crore', 'lakh', 'rupees', 'growth', 'rich', 'results', 'unbelievable',
]);

/**
 * Heuristic keyword importance scorer.
 * Analyzes token frequency, word length, numbers/metrics, and power terms.
 */
export function scoreToken(token: WordToken): number {
  const clean = token.text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean || clean.length <= 2 || STOPWORDS.has(clean)) {
    return 0;
  }

  let score = 1.0;

  // Numbers, statistics, currency, multipliers (e.g. 10x, 100%, 50k, 1cr)
  if (/\d/.test(token.text) || /[$₹%kKxX]/.test(token.text)) {
    score += 3.0;
  }

  // Creator power words
  if (POWER_WORDS.has(clean)) {
    score += 2.5;
  }

  // Capitalized / uppercase emphasis in original transcript
  if (token.text === token.text.toUpperCase() && token.text.length > 2) {
    score += 1.5;
  }

  // Word length bonus (longer words tend to carry more semantic weight)
  if (clean.length >= 6) {
    score += 0.5;
  }

  return score;
}

/**
 * Tags the top percentile of words in a transcript as keywords for kinetic emphasis.
 * By default flags top ~22% highest scoring tokens.
 */
export function highlightKeywords<T extends WordToken>(
  tokens: T[],
  topPercentile: number = 0.22
): T[] {
  if (!tokens || tokens.length === 0) return [];

  const scored = tokens.map((token) => ({
    token,
    score: scoreToken(token),
  }));

  const nonZeroScores = scored
    .map((s) => s.score)
    .filter((s) => s > 0)
    .sort((a, b) => b - a);

  if (nonZeroScores.length === 0) {
    return tokens.map((t) => ({ ...t, isKeyword: false }));
  }

  const cutoffIndex = Math.max(
    1,
    Math.floor(nonZeroScores.length * topPercentile)
  );
  const threshold = nonZeroScores[Math.min(cutoffIndex, nonZeroScores.length - 1)];

  return tokens.map((token) => {
    const s = scoreToken(token);
    return {
      ...token,
      isKeyword: s >= threshold && s > 1.2,
    };
  });
}
