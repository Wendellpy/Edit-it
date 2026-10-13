"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Video,
  FileText,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Copy,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useEditorStore } from "@/lib/editorStore";
import {
  exportVideoWithWebCodecs,
  ExportConfig,
  ExportProgress,
  ExportResolution,
} from "@/lib/export/webcodecsExport";
import {
  generateSrt,
  generateVtt,
  generateAss,
} from "@/lib/export/subtitleFormatters";
import { saveBlobToDisk } from "@/lib/export/fileSaver";
import { detectSystemCapabilities, SystemCapabilities } from "@/lib/capabilities";
import { getTemplateById } from "@/lib/templates";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement?: HTMLVideoElement | null;
}

export function ExportModal({ isOpen, onClose, videoElement }: ExportModalProps) {
  const { tokens, templateId, duration, syncOffset } = useEditorStore();
  const template = getTemplateById(templateId);

  const [activeTab, setActiveTab] = useState<"video" | "subtitles">("video");
  const [resolution, setResolution] = useState<ExportResolution>("1080p");
  const [fps, setFps] = useState<30 | 60>(30);
  const [videoFormat, setVideoFormat] = useState<"mp4" | "webm_alpha">("mp4");

  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  const [lastSavedFilename, setLastSavedFilename] = useState("");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    detectSystemCapabilities().then(setCapabilities);
  }, []);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportComplete(false);
    setProgress({
      phase: "preparing",
      percent: 0,
      currentFrame: 0,
      totalFrames: Math.round((duration || 5) * fps),
      fps: 0,
      timeRemainingSec: 0,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const config: ExportConfig = {
      resolution,
      fps,
      format: videoFormat,
      syncOffsetSeconds: syncOffset || 0,
    };

    try {
      // Find video element from DOM if not passed directly
      const videoEl =
        videoElement ||
        (document.querySelector("video") as HTMLVideoElement) ||
        document.createElement("video");

      const exportedBlob = await exportVideoWithWebCodecs({
        videoElement: videoEl,
        words: tokens,
        template,
        config,
        duration: duration || 5,
        onProgress: (p) => setProgress(p),
        signal: abortController.signal,
      });

      const filename =
        videoFormat === "webm_alpha"
          ? `bolsub-captions-alpha-${resolution}-${Date.now()}.webm`
          : `bolsub-reel-${resolution}-${Date.now()}.mp4`;

      const mime = videoFormat === "webm_alpha" ? "video/webm" : "video/mp4";
      const ext = videoFormat === "webm_alpha" ? "webm" : "mp4";

      await saveBlobToDisk(exportedBlob, {
        suggestedName: filename,
        mimeType: mime,
        extension: ext,
        description: videoFormat === "webm_alpha" ? "Transparent WebM Overlay" : "MP4 Reel Video",
      });

      setLastSavedFilename(filename);
      setExportComplete(true);
      setIsExporting(false);

      // Trigger celebratory local confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#39FF14", "#FFE600", "#FF007F", "#00F0FF"],
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        setIsExporting(false);
        setProgress(null);
        return;
      }
      console.error("Export failed:", err);
      setProgress((prev) =>
        prev
          ? { ...prev, phase: "error", error: err instanceof Error ? err.message : "Unknown error" }
          : null
      );
      setIsExporting(false);
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
    setProgress(null);
  };

  const handleExportSubtitleFile = async (type: "srt" | "vtt" | "ass") => {
    let content = "";
    let ext = "";
    let mime = "text/plain";
    let desc = "";

    if (type === "srt") {
      content = generateSrt(tokens);
      ext = "srt";
      mime = "application/x-subrip";
      desc = "SubRip Subtitle File";
    } else if (type === "vtt") {
      content = generateVtt(tokens, template);
      ext = "vtt";
      mime = "text/vtt";
      desc = "WebVTT Subtitle File";
    } else if (type === "ass") {
      content = generateAss(tokens, template, 1080, 1920);
      ext = "ass";
      mime = "text/x-ssa";
      desc = "Advanced SubStation Alpha Subtitle File";
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const filename = `bolsub-subtitles-${Date.now()}.${ext}`;

    await saveBlobToDisk(blob, {
      suggestedName: filename,
      mimeType: mime,
      extension: ext,
      description: desc,
    });
  };

  const handleCopySubtitles = (type: "srt" | "vtt" | "ass") => {
    let text = "";
    if (type === "srt") text = generateSrt(tokens);
    else if (type === "vtt") text = generateVtt(tokens, template);
    else if (type === "ass") text = generateAss(tokens, template);

    navigator.clipboard.writeText(text);
    setCopiedFormat(type);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Export Studio Captions
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% Local Hardware
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Render and save directly on your machine with zero server latency or token costs
              </p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        {!isExporting && !exportComplete && (
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/30 px-6 pt-2">
            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "video"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video & Transparent Overlay</span>
            </button>
            <button
              onClick={() => setActiveTab("subtitles")}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "subtitles"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Subtitle Documents (SRT, VTT, ASS)</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {/* STATE 1: Live Hardware Exporting Progress */}
          {isExporting && progress && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  <Cpu className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white capitalize">
                  {progress.phase === "preparing" && "Preparing WebCodecs Pipeline..."}
                  {progress.phase === "rendering" && "Rendering Hardware Frames..."}
                  {progress.phase === "muxing" && "Muxing MP4 Fast Container..."}
                </h3>
                <p className="text-xs text-zinc-400">
                  Compositing 9:16 vertical canvas at {resolution.toUpperCase()} ({fps}fps)
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Progress</span>
                  <span className="text-amber-400 font-bold">{progress.percent}%</span>
                </div>
                <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              {/* Realtime Stats */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-xs">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Frames</span>
                  <span className="font-mono text-zinc-200">
                    {progress.currentFrame} / {progress.totalFrames}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Speed</span>
                  <span className="font-mono text-amber-400 font-medium">
                    {progress.fps > 0 ? `${progress.fps} FPS` : "Calibrating..."}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Est. Remaining</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {progress.timeRemainingSec > 0 ? `${progress.timeRemainingSec}s` : "Wrapping up..."}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleCancelExport}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 text-xs font-medium transition-colors"
                >
                  Cancel Export
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Export Complete Screen */}
          {!isExporting && exportComplete && (
            <div className="text-center space-y-4 py-6">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Export Successfully Saved!</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Saved directly to your local drive via File System Access API
                </p>
                <div className="mt-2 inline-block font-mono text-xs text-amber-300 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                  {lastSavedFilename}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={() => setExportComplete(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Export Another Format
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: Tab 1 - Video Export Configuration */}
          {!isExporting && !exportComplete && activeTab === "video" && (
            <div className="space-y-5">
              {/* Export Mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Export Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setVideoFormat("mp4")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      videoFormat === "mp4"
                        ? "bg-amber-500/10 border-amber-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold">Burn-In MP4 Video</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Full composite video with styled captions for Instagram & YouTube
                    </p>
                  </button>

                  <button
                    onClick={() => setVideoFormat("webm_alpha")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      videoFormat === "webm_alpha"
                        ? "bg-amber-500/10 border-amber-500 text-white"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold">Transparent Overlay (WebM)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Alpha channel video for Premiere Pro, DaVinci Resolve & Final Cut
                    </p>
                  </button>
                </div>
              </div>

              {/* Resolution Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Target Resolution (9:16 Vertical)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "720p", label: "720p HD", sub: "Fastest" },
                      { id: "1080p", label: "1080p FHD", sub: "Recommended" },
                      { id: "1440p", label: "1440p 2K", sub: "Crisp QHD" },
                      { id: "4k", label: "4K UHD", sub: "Pro Ultra" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setResolution(item.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        resolution === item.id
                          ? "bg-zinc-900 border-amber-500 text-amber-400 font-bold"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block text-xs font-semibold">{item.label}</span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Framerate Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Frame Rate
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFps(30)}
                    className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                      fps === 30
                        ? "bg-zinc-900 border-amber-500 text-amber-400"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    30 FPS (Standard Reels / Shorts)
                  </button>
                  <button
                    onClick={() => setFps(60)}
                    className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                      fps === 60
                        ? "bg-zinc-900 border-amber-500 text-amber-400"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    60 FPS (Ultra Smooth Motion)
                  </button>
                </div>
              </div>

              {/* Hardware Acceleration Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>
                    Hardware Accelerator:{" "}
                    <strong className="text-white">
                      {capabilities?.webCodecsH264 ? "WebCodecs H.264 (Active)" : "Universal MediaEngine"}
                    </strong>
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">0ms Upload</span>
              </div>

              {/* Export Action Button */}
              <button
                onClick={handleStartExport}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-black font-extrabold text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Render & Save {videoFormat === "webm_alpha" ? "Transparent WebM" : "Reel Video"}</span>
              </button>
            </div>
          )}

          {/* STATE 4: Tab 2 - Subtitle Documents (SRT, VTT, ASS) */}
          {!isExporting && !exportComplete && activeTab === "subtitles" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Download formatted subtitle documents for YouTube Studio, VLC, CapCut or video editing suites.
              </p>

              <div className="space-y-3">
                {/* SRT */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      SubRip Subtitle (.srt)
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Industry standard format compatible with all players & platforms
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("srt")}
                      className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedFormat === "srt" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("srt")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .srt</span>
                    </button>
                  </div>
                </div>

                {/* VTT */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      WebVTT Subtitle (.vtt)
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Web standard format including font colors and positioning styles
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("vtt")}
                      className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedFormat === "vtt" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("vtt")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .vtt</span>
                    </button>
                  </div>
                </div>

                {/* ASS */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Advanced SubStation Alpha (.ass)
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Rich styling, template colors, borders, and per-word karaoke tags (\k)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("ass")}
                      className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedFormat === "ass" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("ass")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .ass</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
