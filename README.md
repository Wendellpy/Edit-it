# BolSub Studio — Local-First Captioning & Auto Shorts Studio

BolSub Studio is a 100% private, local-first creator studio for automated Hinglish video captioning, active-speaker 9:16 reframing, and AI-assisted viral Shorts clip discovery.

---

## ⚡ Core Philosophy & Hard Constraints

1. **100% Local & Private**: All speech recognition (Whisper), face tracking (MediaPipe), Hinglish transliteration, and video rendering run directly on your own machine. Zero media is uploaded anywhere.
2. **Zero API / Token Costs**: Zero metered AI APIs. All clip scoring, hook detection, and caption formatting use deterministic rule-based algorithms, local models, and local binaries (`yt-dlp`, `ffmpeg`).
3. **Local Companion Helper**: A lightweight Node.js daemon binds strictly to `127.0.0.1:4321` (never exposed to external interfaces), authenticated via ephemeral `.helper-token` and `X-Helper-Token`.
4. **Command Injection Defense**: All external subprocesses run with `spawn(..., { shell: false })` using strict array arguments. URLs are validated against strict 11-character YouTube video ID regexes (`/^[a-zA-Z0-9_-]{11}$/`), rejecting shell metacharacters and chaining (`&&`).
5. **Memory-Bounded Streaming**: Video downloads stream directly into browser Origin Private File System (OPFS) in ~64KB chunks to protect RAM from out-of-memory crashes on long videos.

---

## 🛠️ Prerequisites

Ensure you have **Node.js 18+** installed, along with `yt-dlp` and `ffmpeg` in your system `PATH`:

### Windows
```powershell
winget install yt-dlp
winget install Gyan.FFmpeg
```

### macOS (Homebrew)
```bash
brew install yt-dlp ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install ffmpeg
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Local Companion Helper
In your first terminal, launch the local helper daemon:
```bash
npm run helper
```
*The companion helper will start on `http://127.0.0.1:4321` and verify `yt-dlp` and `ffmpeg` availability.*

### 3. Start the Next.js Studio
In a second terminal, launch the web application:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser (Chromium recommended for WebCodecs GPU hardware export).

---

## 🎬 Clips (Auto Shorts) Workflow

Navigate to the **Clips** tab in the top navigation bar (`/clips`):

1. **Paste YouTube Link**: Input any public or unlisted YouTube video URL. The app inspects video duration, title, channel name, and thumbnail.
2. **One-Click Ingestion & Transcription**:
   - Helper downloads 1080p/720p stream chunks into OPFS.
   - Extracts 16kHz mono 16-bit PCM WAV in ~2 seconds.
   - Runs local Whisper speech recognition with VAD sentence boundary alignment.
   - Applies Hinglish dual-script post-processing (Roman Hindi & Devanagari).
3. **Multimodal Shorts Candidate Discovery**:
   - Analyzes RMS loudness peaks, speech pace (140–185 WPM sweet-spot), laughter/cheer bursts, Hinglish hook patterns (*"kya aapko pata hai"*, *"secret trick"*, bold claims, numbers, contrasts).
   - Ranks moments by transparent 0–100 score and snaps to sentence boundaries (15–90s Shorts duration).
4. **9:16 Active Speaker Reframing**:
   - Detects source aspect ratio and tracks active speakers with MediaPipe face segmentation.
   - Applies a 3.5% dead-band filter, cut detection (>35% jump), and exponential moving average (EMA) pan smoothing ($\alpha = 0.20$) to eliminate camera jitter.
   - Alternative modes: Blurred 16:9 pillarbox or source aspect ratio.
5. **Interactive Shorts Studio Preview**:
   - 9:16 mobile phone viewport with live styled caption overlays.
   - Switch between 70+ creator presets (Viral Yellow, Bold Clean, Minimalist, Aura Glow, High Contrast).
   - Contextual emoji injection (💰, 🚀, 💡) and power keyword highlighting.
   - Keyboard shortcuts:
     - <kbd>Space</kbd>: Play / Pause preview video
     - <kbd>←</kbd> / <kbd>→</kbd>: Seek backward / forward 2 seconds
     - <kbd>Esc</kbd>: Exit preview modal
6. **Batch Hardware Export**:
   - Select multiple discovered clips.
   - Exports high-quality vertical 9:16 MP4s using WebCodecs GPU encoding (with automatic FFmpeg fallback).
   - Generates synchronized `.srt` and `.vtt` subtitle sidecars starting at `00:00:00,000`.
   - One-click **"Save All to Disk"** or per-clip individual downloads.

---

## 🧪 Testing & Verification

Run the comprehensive Vitest test suite:
```bash
npm test
```
The test suite covers:
- YouTube URL sanitization, command injection rejection & arg builder security (`urlValidator.test.ts`, `helperSecurity.test.ts`, `argBuilder.test.ts`).
- OPFS streaming & 16kHz PCM WAV audio decoder (`audioUtils.test.ts`, `pipelineIntegration.test.ts`).
- Multimodal signal extraction, boundary snapping & candidate ranking (`signalExtractor.test.ts`, `boundarySnapper.test.ts`, `clipFinder.test.ts`).
- 9:16 auto-reframe trajectory smoothing, dead-band filtering & cut detection (`autoReframe.test.ts`).
- Caption template styling, keyword enrichment & emoji attachment (`templateSelector.test.ts`).
- Batch WebCodecs & FFmpeg fallback export pipeline (`batchClipsExporter.test.ts`).
- End-to-end full pipeline cycle verification (`clipsE2E.test.ts`).
- Long-form clip candidate benchmark suite (`clipsBench.test.ts`).

To run TypeScript static type checks:
```bash
npx tsc --noEmit
```

---

## 🔒 Security & Privacy Guarantees

- **No Remote Telemetry or Logging**: No data is sent over the network to external APIs.
- **Localhost Loopback Only**: The companion helper rejects non-loopback connections and validates incoming `Origin` headers against `localhost` and `127.0.0.1`.
- **Zero Shell Spawning**: Commands are never executed via `sh` or `cmd.exe`.
- **Bounded Resource Usage**: Audio extraction downsamples to 16kHz mono to minimize memory footprint. Completed blob URLs are automatically revoked to prevent browser memory leaks.

---

## 📜 License
Personal tool created for high-efficiency local video content creation.
