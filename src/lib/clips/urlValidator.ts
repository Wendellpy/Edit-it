/**
 * Local YouTube URL Sanitizer & Validator
 * Enforces strict defense-in-depth against command injection, SSRF, and invalid video links.
 */

// Strict pattern for 11-character YouTube video IDs
export const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export interface ParsedYouTubeUrl {
  isValid: boolean;
  videoId: string | null;
  normalizedUrl: string | null;
  hasPlaylist: boolean;
  playlistId: string | null;
  error?: string;
}

/**
 * Validates and extracts canonical video ID and clean normalized YouTube URL.
 * Rejects non-YouTube domains, shell injection sequences, and malformed inputs.
 */
export function parseAndValidateYouTubeUrl(rawUrl: string): ParsedYouTubeUrl {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist: false,
      playlistId: null,
      error: "URL must be a non-empty string",
    };
  }

  const trimmed = rawUrl.trim();

  // Reject strings containing shell metacharacters, spaces, control chars, newlines or command chains (&&)
  if (/[\s;`$|<>\r\n\t"']|&&/.test(trimmed)) {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist: false,
      playlistId: null,
      error: "URL contains invalid characters or injection attempts",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist: false,
      playlistId: null,
      error: "Malformed URL format",
    };
  }

  // Only allow http: or https:
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist: false,
      playlistId: null,
      error: "Only HTTP and HTTPS protocols are permitted",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const validHosts = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
  ];

  if (!validHosts.includes(hostname)) {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist: false,
      playlistId: null,
      error: `Unsupported domain: ${hostname}. Only YouTube links are supported.`,
    };
  }

  let videoId: string | null = null;
  let hasPlaylist = false;
  let playlistId: string | null = null;

  if (hostname === "youtu.be") {
    // Format: https://youtu.be/<videoId>
    const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
    if (YOUTUBE_VIDEO_ID_REGEX.test(id)) {
      videoId = id;
    }
    playlistId = parsed.searchParams.get("list");
  } else {
    // Format: /watch?v=<videoId> or /shorts/<videoId> or /embed/<videoId>
    if (parsed.pathname === "/watch") {
      const v = parsed.searchParams.get("v");
      if (v && YOUTUBE_VIDEO_ID_REGEX.test(v)) {
        videoId = v;
      }
    } else if (parsed.pathname.startsWith("/shorts/")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[1];
      if (id && YOUTUBE_VIDEO_ID_REGEX.test(id)) {
        videoId = id;
      }
    } else if (parsed.pathname.startsWith("/embed/")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[1];
      if (id && YOUTUBE_VIDEO_ID_REGEX.test(id)) {
        videoId = id;
      }
    }

    playlistId = parsed.searchParams.get("list");
  }

  if (playlistId && /^[a-zA-Z0-9_-]+$/.test(playlistId)) {
    hasPlaylist = true;
  } else {
    playlistId = null;
  }

  if (!videoId) {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      hasPlaylist,
      playlistId,
      error: "Could not extract a valid 11-character YouTube video ID",
    };
  }

  return {
    isValid: true,
    videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    hasPlaylist,
    playlistId,
  };
}
