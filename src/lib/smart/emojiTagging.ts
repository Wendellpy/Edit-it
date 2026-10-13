import type { WordToken } from '@/lib/timestampRefiner';

/**
 * Contextual mapping of Indian conversational Hinglish and creator terms to emojis.
 */
export const EMOJI_MAP: Record<string, string> = {
  // Wealth & Finance
  paisa: '💰',
  paise: '💰',
  rupaye: '💸',
  rupees: '💸',
  crore: '💵',
  lakh: '🤑',
  rich: '💎',
  investment: '📈',
  profit: '💹',
  free: '🎁',
  target: '🎯',

  // Social & Content
  video: '🎥',
  camera: '📸',
  viral: '🚀',
  youtube: '▶️',
  reel: '📱',
  reels: '📱',
  shorts: '⚡',
  subscribers: '👥',
  views: '👀',
  viewers: '👀',
  share: '📲',
  like: '❤️',
  comment: '💬',

  // Power Words & Emotions
  fire: '🔥',
  jhakaas: '✨',
  bhai: '🫂',
  dost: '🤝',
  dosto: '🤝',
  secret: '🤫',
  formula: '🧪',
  shocking: '🤯',
  insane: '🤯',
  danger: '⚠️',
  galat: '❌',
  sahi: '✅',
  win: '🏆',
  winner: '🥇',
  idea: '💡',
  tricks: '🪄',
  hack: '⚡',
  growth: '📈',
  love: '❤️',
  fast: '⚡',
  food: '🍕',
  khana: '🍲',
  chai: '☕',
  music: '🎵',
};

/**
 * Normalizes input word and checks for an emoji match.
 */
export function getEmojiForWord(wordText: string): string | null {
  const clean = wordText.toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMOJI_MAP[clean] || null;
}

/**
 * Automatically tags or appends contextual emojis to matching tokens in the transcript.
 */
export function applySmartEmojis<T extends WordToken>(
  tokens: T[],
  mode: 'append' | 'tag' = 'append'
): T[] {
  return tokens.map((token) => {
    const emoji = getEmojiForWord(token.text);
    if (!emoji) return token;

    if (mode === 'append' && !token.text.includes(emoji)) {
      return {
        ...token,
        text: `${token.text} ${emoji}`,
      };
    }

    return token;
  });
}
