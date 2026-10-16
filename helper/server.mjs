#!/usr/bin/env node
/**
 * BolSub Studio Local Companion Helper Service
 * Runs strictly on 127.0.0.1 with session-token authentication.
 * Wraps local yt-dlp and FFmpeg to fetch source videos and extract audio.
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(__dirname, "cache");
const BIN_DIR = path.join(__dirname, "bin");
const TOKEN_FILE = path.join(ROOT_DIR, ".helper-token");

const HOST = "127.0.0.1"; // HARD CONSTRAINT: NEVER 0.0.0.0
const PORT = parseInt(process.env.PORT || "4321", 10);
const MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB default

// Ensure directories exist
for (const dir of [CACHE_DIR, BIN_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Generate or reuse session token
let SESSION_TOKEN = crypto.randomBytes(24).toString("hex");
try {
  fs.writeFileSync(TOKEN_FILE, SESSION_TOKEN, { encoding: "utf-8", flag: "w" });
} catch (err) {
  console.warn("Could not write .helper-token file:", err);
}

// Global active jobs and SSE clients
const activeJobs = new Map();
const sseClients = new Set();

function broadcastSse(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// -------------------------------------------------------------------------
// Dependency Detection
// -------------------------------------------------------------------------
function getExecutableCandidates(name) {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? `${name}.exe` : name;
  const candidates = [
    path.join(BIN_DIR, binaryName),
    binaryName, // rely on system PATH
  ];

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || "";
    const userProfile = process.env.USERPROFILE || "";
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";

    if (localAppData) {
      candidates.push(path.join(localAppData, "Microsoft", "WinGet", "Links", binaryName));
      candidates.push(path.join(localAppData, "Programs", name, binaryName));
    }
    if (userProfile) {
      candidates.push(path.join(userProfile, "scoop", "shims", binaryName));
      candidates.push(path.join(userProfile, "scoop", "apps", name, "current", binaryName));
      candidates.push(path.join(userProfile, "scoop", "apps", name, "current", "bin", binaryName));
    }
    candidates.push(path.join(programFiles, name, binaryName));
    candidates.push(path.join(programFiles, name, "bin", binaryName));
  }

  return candidates;
}

async function checkBinary(name) {
  const candidates = getExecutableCandidates(name);
  const versionArg = name === "ffmpeg" ? "-version" : "--version";
  for (const candidate of candidates) {
    try {
      const version = await new Promise((resolve, reject) => {
        execFile(candidate, [versionArg], { timeout: 8000 }, (error, stdout) => {
          if (error) reject(error);
          else {
            const firstLine = (stdout || "").trim().split("\n")[0].trim();
            resolve(firstLine);
          }
        });
      });
      return {
        available: true,
        version,
        path: candidate,
      };
    } catch {
      // try next candidate
    }
  }

  const isWin = process.platform === "win32";
  const installCmd =
    name === "yt-dlp"
      ? isWin
        ? "winget install yt-dlp"
        : "brew install yt-dlp || sudo apt install yt-dlp"
      : isWin
      ? "winget install Gyan.FFmpeg"
      : "brew install ffmpeg || sudo apt install ffmpeg";

  return {
    available: false,
    version: null,
    path: null,
    installCommand: installCmd,
    error: `${name} was not found on PATH or in helper/bin/`,
  };
}

async function getDependencyStatus() {
  const [ytdlp, ffmpeg] = await Promise.all([
    checkBinary("yt-dlp"),
    checkBinary("ffmpeg"),
  ]);
  return { ytdlp, ffmpeg };
}

// -------------------------------------------------------------------------
// Cache Management
// -------------------------------------------------------------------------
async function getCacheStats() {
  let totalBytes = 0;
  let fileCount = 0;
  try {
    const files = await fsp.readdir(CACHE_DIR);
    for (const file of files) {
      try {
        const stat = await fsp.stat(path.join(CACHE_DIR, file));
        if (stat.isFile()) {
          totalBytes += stat.size;
          fileCount += 1;
        }
      } catch {}
    }
  } catch {}
  return { totalBytes, maxBytes: MAX_CACHE_BYTES, fileCount, cacheDir: CACHE_DIR };
}

async function cleanCacheLRU(targetFreeBytes = 500 * 1024 * 1024) {
  try {
    const files = await fsp.readdir(CACHE_DIR);
    const fileStats = [];
    let currentTotal = 0;
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const stat = await fsp.stat(filePath);
        if (stat.isFile()) {
          fileStats.push({ path: filePath, size: stat.size, mtime: stat.mtimeMs });
          currentTotal += stat.size;
        }
      } catch {}
    }

    if (currentTotal > MAX_CACHE_BYTES) {
      // Sort oldest first
      fileStats.sort((a, b) => a.mtime - b.mtime);
      for (const item of fileStats) {
        if (currentTotal <= MAX_CACHE_BYTES - targetFreeBytes) break;
        try {
          await fsp.unlink(item.path);
          currentTotal -= item.size;
        } catch {}
      }
    }
  } catch (err) {
    console.error("Cache cleanup error:", err);
  }
}

// -------------------------------------------------------------------------
// YouTube VTT Acoustic Subtitle Word Parser
// -------------------------------------------------------------------------
function parseVttTime(str) {
  const parts = str.trim().split(":");
  let sec = 0;
  if (parts.length === 3) {
    sec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    sec = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(sec.toFixed(3));
}

function parseVttTimedWords(vttContent) {
  const blocks = vttContent.split(/\r?\n\r?\n/);
  const words = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx === -1) continue;

    const timeMatch = lines[timeLineIdx].match(/^(\d{2}:\d{2}(?::\d{2})?\.\d{3})\s+-->\s+(\d{2}:\d{2}(?::\d{2})?\.\d{3})/);
    if (!timeMatch) continue;

    const cueStart = parseVttTime(timeMatch[1]);
    const cueEnd = parseVttTime(timeMatch[2]);
    const textLines = lines.slice(timeLineIdx + 1);

    const hasWordTags = textLines.some((l) => l.includes("<c>") || l.includes("</c>"));
    if (hasWordTags) {
      for (const line of textLines) {
        if (!line.includes("<c>") && !line.includes("</c>") && !line.includes("<")) continue;
        const firstMatch = line.match(/^([^<]+)/);
        let currentWord = firstMatch ? firstMatch[1].trim() : "";
        const tagRegex = /<(\d{2}:\d{2}(?::\d{2})?\.\d{3})><c>\s*([^<]+)<\/c>/g;
        let m;
        let prevTime = cueStart;

        while ((m = tagRegex.exec(line)) !== null) {
          const wordEndTime = parseVttTime(m[1]);
          const nextWord = m[2].trim();
          if (currentWord) {
            words.push({
              text: currentWord,
              start: prevTime,
              end: Math.max(prevTime + 0.08, wordEndTime),
            });
          }
          currentWord = nextWord;
          prevTime = wordEndTime;
        }

        if (currentWord) {
          words.push({
            text: currentWord,
            start: prevTime,
            end: Math.max(prevTime + 0.08, cueEnd),
          });
        }
      }
    } else {
      const cueText = textLines.map((l) => l.replace(/<[^>]*>/g, "").trim()).filter(Boolean).join(" ");
      const tokens = cueText.split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const cueDuration = Math.max(0.1, cueEnd - cueStart);
        const step = cueDuration / tokens.length;
        tokens.forEach((t, idx) => {
          const wStart = parseFloat((cueStart + idx * step).toFixed(3));
          const wEnd = parseFloat((cueStart + (idx + 1) * step).toFixed(3));
          words.push({
            text: t,
            start: wStart,
            end: Math.max(wStart + 0.08, wEnd),
          });
        });
      }
    }
  }

  // Deduplicate consecutive identical words at close timestamps (rolling captions in VTT)
  const deduplicated = [];
  for (const w of words) {
    if (!w.text) continue;
    const last = deduplicated[deduplicated.length - 1];
    if (last && last.text.toLowerCase() === w.text.toLowerCase() && Math.abs(last.start - w.start) < 0.25) {
      continue;
    }
    deduplicated.push(w);
  }
  return deduplicated;
}

// -------------------------------------------------------------------------
// Strict URL Validator
// -------------------------------------------------------------------------
function validateYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, error: "URL must be a non-empty string" };
  }
  const trimmed = rawUrl.trim();
  if (/[\s;`$|<>\r\n\t"']|&&/.test(trimmed)) {
    return { ok: false, error: "URL contains illegal characters" };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Malformed URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTP/HTTPS allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"];
  if (!allowed.includes(host)) {
    return { ok: false, error: "Only YouTube links are permitted" };
  }

  let videoId = null;
  if (host === "youtu.be") {
    videoId = parsed.pathname.replace(/^\/+/, "").split("/")[0];
  } else {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.split("/").filter(Boolean)[1];
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.split("/").filter(Boolean)[1];
    }
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { ok: false, error: "Could not find a valid 11-char YouTube video ID" };
  }

  return {
    ok: true,
    videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    hasPlaylist: Boolean(parsed.searchParams.get("list")),
  };
}

// -------------------------------------------------------------------------
// HTTP Server
// -------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Security: Allow only local web application origins
  const origin = req.headers["origin"] || "";
  const isAllowedOrigin =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin === "";

  res.setHeader("Access-Control-Allow-Origin", isAllowedOrigin ? origin || "*" : "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Helper-Token, Range, Authorization, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = urlObj.pathname;

  // Session Token Check
  // We allow /status and /token for initial handshake, and /file/:id for local media streaming
  const providedToken = req.headers["x-helper-token"] || urlObj.searchParams.get("token");
  const isHandshake = pathname === "/status" || pathname === "/token";
  const isMediaStream = (pathname.startsWith("/file/") || pathname === "/favicon.ico") && (isAllowedOrigin || providedToken === SESSION_TOKEN);

  if (!isHandshake && !isMediaStream) {
    if (!providedToken || providedToken !== SESSION_TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid helper token." }));
      return;
    }
  }

  // Route Handlers
  try {
    // GET /token - Handshake to give token to local browser app
    if (req.method === "GET" && pathname === "/token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: SESSION_TOKEN }));
      return;
    }

    // GET /status
    if (req.method === "GET" && pathname === "/status") {
      const binaries = await getDependencyStatus();
      const cache = await getCacheStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          version: "1.0.0",
          token: SESSION_TOKEN,
          binaries,
          cache,
        })
      );
      return;
    }

    // POST /update-ytdlp
    if (req.method === "POST" && pathname === "/update-ytdlp") {
      const binaries = await getDependencyStatus();
      if (!binaries.ytdlp.available) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "yt-dlp is not installed yet." }));
        return;
      }

      execFile(binaries.ytdlp.path, ["-U"], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message, details: stderr }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: stdout.trim() }));
        }
      });
      return;
    }

    // POST /probe
    if (req.method === "POST" && pathname === "/probe") {
      const body = await parseJsonBody(req);
      const val = validateYouTubeUrl(body.url);
      if (!val.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: val.error }));
        return;
      }

      const binaries = await getDependencyStatus();
      if (!binaries.ytdlp.available) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "yt-dlp is missing. Install it with: " + binaries.ytdlp.installCommand }));
        return;
      }

      const probeArgs = [
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--skip-download",
        "--extractor-args",
        "youtube:player_client=android,web",
        "--socket-timeout",
        "20",
        val.normalizedUrl,
      ];

      execFile(binaries.ytdlp.path, probeArgs, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          let friendlyError = err.message;
          const combined = (stderr || "") + (stdout || "");
          if (combined.includes("Private video")) friendlyError = "This video is private.";
          else if (combined.includes("Sign in to confirm your age")) friendlyError = "This video is age-restricted.";
          else if (combined.includes("Video unavailable")) friendlyError = "This video is unavailable or removed.";
          else if (combined.includes("live stream")) friendlyError = "Live streams are not supported.";

          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: friendlyError, details: stderr }));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const duration = info.duration || 0;
          let warning = undefined;
          if (duration > 3 * 3600) {
            warning = "This video is over 3 hours long. Ingestion and transcription may take longer.";
          }

          const availableQualities = [];
          if (Array.isArray(info.formats)) {
            const heights = new Set(info.formats.map((f) => f.height).filter(Boolean));
            if (heights.has(2160)) availableQualities.push("4k");
            if (heights.has(1440)) availableQualities.push("1440p");
            if (heights.has(1080)) availableQualities.push("1080p");
            if (heights.has(720)) availableQualities.push("720p");
          }
          if (availableQualities.length === 0) availableQualities.push("1080p", "720p");

          const subtitles = info.subtitles ? Object.keys(info.subtitles) : [];

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: info.id || val.videoId,
              url: val.normalizedUrl,
              title: info.title || "Untitled Video",
              duration,
              thumbnail: info.thumbnail || "",
              uploader: info.uploader || "",
              isLive: Boolean(info.is_live),
              isAgeRestricted: Boolean(info.age_limit && info.age_limit >= 18),
              availableQualities,
              subtitlesAvailable: subtitles,
              warning,
            })
          );
        } catch (parseErr) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to parse video metadata." }));
        }
      });
      return;
    }

    // POST /download
    if (req.method === "POST" && pathname === "/download") {
      const body = await parseJsonBody(req);
      const val = validateYouTubeUrl(body.url);
      if (!val.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: val.error }));
        return;
      }

      const quality = body.quality || "1080p";
      const timeRange = body.timeRange;
      const startSec = timeRange?.start ? Math.max(0, Math.floor(timeRange.start)) : 0;
      const endSec = timeRange?.end ? Math.max(startSec + 1, Math.floor(timeRange.end)) : 0;

      // Hash key for caching
      const cacheKey = crypto
        .createHash("sha256")
        .update(`${val.videoId}:${quality}:${startSec}:${endSec}`)
        .digest("hex")
        .slice(0, 20);

      const cachedMp4Path = path.join(CACHE_DIR, `${cacheKey}.mp4`);

      // Check if cache hit exists and is valid
      if (fs.existsSync(cachedMp4Path)) {
        const stat = await fsp.stat(cachedMp4Path);
        if (stat.size > 1024) {
          const resp = {
            cached: true,
            jobId: cacheKey,
            fileId: cacheKey,
            fileName: `${cacheKey}.mp4`,
            fileSize: stat.size,
            status: "ready",
            progressPercent: 100,
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(resp));
          return;
        }
      }

      // Check binaries
      const binaries = await getDependencyStatus();
      if (!binaries.ytdlp.available) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "yt-dlp is missing: " + binaries.ytdlp.installCommand }));
        return;
      }

      const jobId = cacheKey;
      const tempOutput = path.join(CACHE_DIR, `${jobId}.part.mp4`);

      // Prepare download arguments
      const formatStr =
        quality === "4k"
          ? "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]/best"
          : quality === "1440p"
          ? "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"
          : quality === "720p"
          ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"
          : quality === "source"
          ? "bestvideo+bestaudio/best"
          : "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";

      const dlArgs = [
        "--newline",
        "--progress",
        "--progress-template",
        "download:[%(progress._percent_str)s] speed:[%(progress._speed_str)s] eta:[%(progress._eta_str)s] downloaded:[%(progress.downloaded_bytes)s] total:[%(progress.total_bytes)s]",
        "-f",
        formatStr,
        "--merge-output-format",
        "mp4",
        "--retries",
        "5",
        "--fragment-retries",
        "5",
        "--socket-timeout",
        "30",
        "--extractor-args",
        "youtube:player_client=android,web",
        "-o",
        tempOutput,
      ];

      if (binaries.ffmpeg.available && binaries.ffmpeg.path) {
        dlArgs.push("--ffmpeg-location", binaries.ffmpeg.path);
      }

      if (!body.allowPlaylist) {
        dlArgs.push("--no-playlist");
      }

      if (timeRange && endSec > startSec) {
        dlArgs.push("--download-sections", `*${startSec}-${endSec}`);
        dlArgs.push("--force-keyframes-at-cuts");
      }

      dlArgs.push(val.normalizedUrl);

      // Start asynchronous download job
      const jobState = {
        jobId,
        videoId: val.videoId,
        status: "downloading",
        progressPercent: 0,
        speed: "0B/s",
        eta: "calculating",
        downloadedBytes: 0,
        totalBytes: 0,
        fileId: cacheKey,
        fileName: `${cacheKey}.mp4`,
      };
      activeJobs.set(jobId, jobState);

      const ytdlpProc = spawn(binaries.ytdlp.path, dlArgs, {
        windowsHide: true,
        shell: false, // HARD CONSTRAINT: NEVER pass through shell
      });

      ytdlpProc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        // Parse custom progress template: download:[15.4%] speed:[2.1MiB/s] eta:[00:45] downloaded:[12345] total:[98765]
        const match = text.match(/download:\[(.*?)]\s+speed:\[(.*?)]\s+eta:\[(.*?)]\s+downloaded:\[(.*?)]\s+total:\[(.*?)]/);
        if (match) {
          const rawPct = parseFloat(match[1].replace("%", "").trim());
          if (!isNaN(rawPct)) jobState.progressPercent = Math.min(99, Math.round(rawPct));
          jobState.speed = match[2].trim() || jobState.speed;
          jobState.eta = match[3].trim() || jobState.eta;
          jobState.downloadedBytes = parseInt(match[4], 10) || jobState.downloadedBytes;
          jobState.totalBytes = parseInt(match[5], 10) || jobState.totalBytes;
          jobState.status = "downloading";
          broadcastSse(jobState);
        } else if (text.includes("[Merger]") || text.includes("Merging formats")) {
          jobState.status = "merging";
          broadcastSse(jobState);
        }
      });

      ytdlpProc.stderr.on("data", (chunk) => {
        // Can monitor stderr for detailed warnings
      });

      ytdlpProc.on("close", async (code) => {
        if (code === 0 && fs.existsSync(tempOutput)) {
          try {
            await fsp.rename(tempOutput, cachedMp4Path);
            const stat = await fsp.stat(cachedMp4Path);
            jobState.status = "ready";
            jobState.progressPercent = 100;
            jobState.fileSize = stat.size;
            broadcastSse(jobState);
            cleanCacheLRU();
          } catch (mvErr) {
            jobState.status = "error";
            jobState.error = "Failed to finalize downloaded file.";
            broadcastSse(jobState);
          }
        } else {
          jobState.status = "error";
          jobState.error = `yt-dlp exited with error code ${code}`;
          broadcastSse(jobState);
          try {
            if (fs.existsSync(tempOutput)) await fsp.unlink(tempOutput);
          } catch {}
        }
      });

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify(jobState));
      return;
    }

    // GET /progress (Server-Sent Events)
    if (req.method === "GET" && pathname === "/progress") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Send current snapshot of all active jobs
      for (const job of activeJobs.values()) {
        res.write(`data: ${JSON.stringify(job)}\n\n`);
      }

      sseClients.add(res);

      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    // GET or HEAD /file/:id - Stream video or audio file with HTTP Range support
    if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/file/")) {
      const fileId = path.basename(pathname.replace("/file/", "")).replace(/[^a-zA-Z0-9_.-]/g, "");
      const possibleFiles = [
        path.join(CACHE_DIR, `${fileId}.mp4`),
        path.join(CACHE_DIR, `${fileId}.wav`),
        path.join(CACHE_DIR, fileId),
      ];

      let targetPath = null;
      for (const p of possibleFiles) {
        if (fs.existsSync(p)) {
          targetPath = p;
          break;
        }
      }

      if (!targetPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "File not found" }));
        return;
      }

      const stat = await fsp.stat(targetPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const ext = path.extname(targetPath).toLowerCase();
      const mimeType = ext === ".wav" ? "audio/wav" : "video/mp4";

      if (req.method === "HEAD") {
        res.writeHead(200, {
          "Content-Type": mimeType,
          "Content-Length": fileSize,
          "Accept-Ranges": "bytes",
        });
        res.end();
        return;
      }

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize || (parts[1] && end < start)) {
          res.writeHead(416, {
            "Content-Range": `bytes */${fileSize}`,
          });
          res.end();
          return;
        }

        const chunksize = end - start + 1;
        const stream = fs.createReadStream(targetPath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": mimeType,
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
        });
        fs.createReadStream(targetPath).pipe(res);
      }
      return;
    }

    // POST /extract-audio - Local FFmpeg speedup for 16kHz mono audio extraction
    if (req.method === "POST" && pathname === "/extract-audio") {
      const body = await parseJsonBody(req);
      const fileId = (body.fileId || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const sourceMp4 = path.join(CACHE_DIR, `${fileId}.mp4`);
      const outputWav = path.join(CACHE_DIR, `${fileId}.wav`);

      if (!fs.existsSync(sourceMp4)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Source video file not found in cache." }));
        return;
      }

      if (fs.existsSync(outputWav)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cached: true, audioFileId: `${fileId}.wav`, path: `/file/${fileId}.wav` }));
        return;
      }

      const binaries = await getDependencyStatus();
      if (!binaries.ffmpeg.available) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "FFmpeg is missing: " + binaries.ffmpeg.installCommand }));
        return;
      }

      const ffmpegArgs = ["-y", "-i", sourceMp4, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", outputWav];

      execFile(binaries.ffmpeg.path, ffmpegArgs, { timeout: 120000 }, (err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "FFmpeg audio extraction failed: " + err.message }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, audioFileId: `${fileId}.wav`, path: `/file/${fileId}.wav` }));
        }
      });
      return;
    }

    // POST /export-clip-ffmpeg - Local FFmpeg hardware cut, 9:16 crop, subtitle burning
    if (req.method === "POST" && pathname === "/export-clip-ffmpeg") {
      const body = await parseJsonBody(req);
      const fileId = (body.fileId || "").replace(/[^a-zA-Z0-9_-]/g, "");
      const clipId = (body.clipId || "clip").replace(/[^a-zA-Z0-9_-]/g, "");
      const start = Math.max(0, parseFloat(body.start) || 0);
      const end = Math.max(start + 0.1, parseFloat(body.end) || start + 10);

      const sourceMp4 = path.join(CACHE_DIR, `${fileId}.mp4`);
      if (!fs.existsSync(sourceMp4)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Source video file not found in cache." }));
        return;
      }

      const binaries = await getDependencyStatus();
      if (!binaries.ffmpeg.available) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "FFmpeg is missing: " + binaries.ffmpeg.installCommand }));
        return;
      }

      const outFileName = `export_${fileId}_${clipId}_${Math.round(start)}_${Math.round(end)}.mp4`;
      const outputMp4 = path.join(CACHE_DIR, outFileName);

      // If already exported in cache, return immediately
      if (fs.existsSync(outputMp4)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          cached: true,
          fileId: outFileName,
          downloadUrl: `/file/${outFileName}`,
        }));
        return;
      }

      // Optional Subtitle writing (supports ASS karaoke or SRT)
      let subPath = null;
      if (body.assContent && typeof body.assContent === "string") {
        subPath = path.join(CACHE_DIR, `temp_${fileId}_${clipId}.ass`);
        await fsp.writeFile(subPath, body.assContent, "utf-8");
      } else if (body.srtContent && typeof body.srtContent === "string") {
        subPath = path.join(CACHE_DIR, `temp_${fileId}_${clipId}.srt`);
        await fsp.writeFile(subPath, body.srtContent, "utf-8");
      }

      // Crop coordinates (normalized 0..1)
      const crop = body.crop || { sx: 0.34, sy: 0, sw: 0.3164, sh: 1.0 };
      const sx = Math.max(0, Math.min(0.9, parseFloat(crop.sx) || 0.34));
      const sy = Math.max(0, Math.min(0.9, parseFloat(crop.sy) || 0));
      const sw = Math.max(0.1, Math.min(1.0, parseFloat(crop.sw) || 0.3164));
      const sh = Math.max(0.1, Math.min(1.0, parseFloat(crop.sh) || 1.0));

      // Construct FFmpeg video filter: crop to 9:16 then scale to 1080x1920
      const vfParts = [
        `crop=w=in_w*${sw.toFixed(4)}:h=in_h*${sh.toFixed(4)}:x=in_w*${sx.toFixed(4)}:y=in_h*${sy.toFixed(4)}`,
        `scale=1080:1920:flags=bicubic`,
      ];

      if (subPath && fs.existsSync(subPath)) {
        const escapedSub = subPath.replace(/\\/g, "/").replace(/:/g, "\\:");
        vfParts.push(`subtitles='${escapedSub}'`);
      }

      const duration = Math.max(0.1, end - start);
      const ffmpegArgs = [
        "-y",
        "-accurate_seek",
        "-ss", start.toFixed(3),
        "-i", sourceMp4,
        "-t", duration.toFixed(3),
        "-avoid_negative_ts", "make_zero",
        "-vf", vfParts.join(","),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        outputMp4,
      ];

      execFile(binaries.ffmpeg.path, ffmpegArgs, { timeout: 180000 }, async (err) => {
        if (subPath && fs.existsSync(subPath)) {
          try { await fsp.unlink(subPath); } catch {}
        }

        if (err || !fs.existsSync(outputMp4)) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "FFmpeg export failed: " + (err ? err.message : "No output generated") }));
        } else {
          cleanCacheLRU();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            fileId: outFileName,
            downloadUrl: `/file/${outFileName}`,
          }));
        }
      });
      return;
    }

    // POST /captions-hint - Pull creator YouTube captions as hints for proper nouns and spelling
    if (req.method === "POST" && pathname === "/captions-hint") {
      const body = await parseJsonBody(req);
      const val = validateYouTubeUrl(body.url);
      if (!val.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: val.error }));
        return;
      }

      // 1. Fast-path: Check if a VTT file for this video already exists in CACHE_DIR
      try {
        const files = await fsp.readdir(CACHE_DIR);
        const existingVtt = files.find((f) => f.startsWith(`${val.videoId}_subs`) && f.endsWith(".vtt"));
        if (existingVtt) {
          const rawVtt = await fsp.readFile(path.join(CACHE_DIR, existingVtt), "utf-8");
          const timedWords = parseVttTimedWords(rawVtt);
          const fullText = timedWords.map((w) => w.text).join(" ");
          const properNouns = Array.from(new Set(timedWords.map((w) => w.text).filter((w) => /^[A-Z][a-z]{2,}$/.test(w))));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, text: fullText, properNouns, timedWords }));
          return;
        }
      } catch {}

      const binaries = await getDependencyStatus();
      if (!binaries.ytdlp.available) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, text: "", properNouns: [], timedWords: [] }));
        return;
      }

      const subOutPrefix = path.join(CACHE_DIR, `${val.videoId}_subs`);
      const subArgs = [
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-lang",
        "en,hi",
        "--sub-format",
        "vtt",
        "-o",
        `${subOutPrefix}.%(ext)s`,
        val.normalizedUrl,
      ];

      execFile(binaries.ytdlp.path, subArgs, { timeout: 25000 }, async () => {
        try {
          const files = await fsp.readdir(CACHE_DIR);
          const vttFile = files.find((f) => f.startsWith(`${val.videoId}_subs`) && f.endsWith(".vtt"));
          if (!vttFile) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, text: "", properNouns: [], timedWords: [] }));
            return;
          }

          const rawVtt = await fsp.readFile(path.join(CACHE_DIR, vttFile), "utf-8");
          const timedWords = parseVttTimedWords(rawVtt);
          const fullText = timedWords.map((w) => w.text).join(" ");
          const properNouns = Array.from(new Set(timedWords.map((w) => w.text).filter((w) => /^[A-Z][a-z]{2,}$/.test(w))));

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, text: fullText, properNouns, timedWords }));
        } catch {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, text: "", properNouns: [], timedWords: [] }));
        }
      });
      return;
    }

    // DELETE /cleanup
    if (req.method === "DELETE" && pathname === "/cleanup") {
      const body = await parseJsonBody(req).catch(() => ({}));
      if (body.fileId) {
        const fileId = body.fileId.replace(/[^a-zA-Z0-9_-]/g, "");
        const paths = [path.join(CACHE_DIR, `${fileId}.mp4`), path.join(CACHE_DIR, `${fileId}.wav`)];
        for (const p of paths) {
          try {
            if (fs.existsSync(p)) await fsp.unlink(p);
          } catch {}
        }
      } else {
        // Clear all files in cache
        const files = await fsp.readdir(CACHE_DIR);
        for (const file of files) {
          try {
            await fsp.unlink(path.join(CACHE_DIR, file));
          } catch {}
        }
      }
      const stats = await getCacheStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, cache: stats }));
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  } catch (routeErr) {
    console.error("Server error:", routeErr);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: routeErr.message || "Internal server error" }));
  }
});

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`\n=========================================================`);
  console.log(`  BolSub Studio Local Helper`);
  console.log(`  Bound to: http://${HOST}:${PORT} (127.0.0.1 ONLY)`);
  console.log(`  Session token: ${SESSION_TOKEN}`);
  console.log(`  Cache directory: ${CACHE_DIR}`);
  console.log(`=========================================================\n`);
  getDependencyStatus().then(({ ytdlp, ffmpeg }) => {
    console.log(`[yt-dlp]  ${ytdlp.available ? `✓ Version ${ytdlp.version}` : `✗ Missing (${ytdlp.installCommand})`}`);
    console.log(`[FFmpeg]  ${ffmpeg.available ? `✓ Version ${ffmpeg.version}` : `✗ Missing (${ffmpeg.installCommand})`}`);
  });
});
