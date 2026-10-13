export interface WerResult {
  wer: number; // Word Error Rate as decimal (e.g. 0.05 = 5%)
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWordCount: number;
  hypothesisWordCount: number;
}

/**
 * Normalizes text for speech recognition benchmarking.
 * Lowercases, strips punctuation, normalizes spacing.
 */
export function normalizeTranscript(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'।॥]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Computes exact Word Error Rate (WER) using Levenshtein distance on token arrays.
 * WER = (Substitutions + Deletions + Insertions) / TotalReferenceWords
 */
export function computeWER(reference: string, hypothesis: string): WerResult {
  const refWords = normalizeTranscript(reference);
  const hypWords = normalizeTranscript(hypothesis);

  const n = refWords.length;
  const m = hypWords.length;

  if (n === 0) {
    return {
      wer: m === 0 ? 0 : 1,
      substitutions: 0,
      deletions: 0,
      insertions: m,
      referenceWordCount: 0,
      hypothesisWordCount: m,
    };
  }

  // DP Matrix for Levenshtein Distance
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        const substitution = dp[i - 1][j - 1] + 1;
        const deletion = dp[i - 1][j] + 1;
        const insertion = dp[i][j - 1] + 1;
        dp[i][j] = Math.min(substitution, deletion, insertion);
      }
    }
  }

  // Backtrack to count substitutions, deletions, insertions
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refWords[i - 1] === hypWords[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }

  const wer = (substitutions + deletions + insertions) / n;

  return {
    wer: parseFloat(wer.toFixed(4)),
    substitutions,
    deletions,
    insertions,
    referenceWordCount: n,
    hypothesisWordCount: m,
  };
}
