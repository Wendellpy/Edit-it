"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Video,
  FileText,
  Sparkles,
  Download,
  CheckCircle2,
  Cpu,
  Layers,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Crop,
  Maximize2,
  Tv,
  Smartphone,
  Square,
  Ratio,
  Clapperboard,
  Sliders,
  CheckCheck,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useEditorStore } from "@/lib/editorStore";
import {
  exportVideoWithWebCodecs,
  calculateExportDimensions,
  ExportConfig,
  ExportProgress,
  ExportResolution,
  ExportAspectRatio,
  ExportFitMode,
  ExportQuality,
  ExportFps,
  ExportFormat,
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
  const {
    videoUrl,
    videoFile,
    tokens,
    templateId,
    duration,
    syncOffset,
    exportSettings,
    setExportSettings,
    layerOrder,
  } = useEditorStore();
  const template = getTemplateById(templateId);

  // Tabs
  const [activeTab, setActiveTab] = useState<"video" | "subtitles">("video");

  // Read export settings directly from persisted store
  const videoFormat = exportSettings.format;
  const aspectRatio = exportSettings.aspectRatio;
  const fitMode = exportSettings.fitMode;
  const resolution = exportSettings.resolution;
  const fps = exportSettings.fps;
  const quality = exportSettings.quality;
  const includeAudio = exportSettings.includeAudio;

  const setVideoFormat = (format: ExportFormat) => setExportSettings({ format });
  const setAspectRatio = (aspectRatio: ExportAspectRatio) => setExportSettings({ aspectRatio });
  const setFitMode = (fitMode: ExportFitMode) => setExportSettings({ fitMode });
  const setResolution = (resolution: ExportResolution) => setExportSettings({ resolution });
  const setFps = (fps: ExportFps) => setExportSettings({ fps });
  const setQuality = (quality: ExportQuality) => setExportSettings({ quality });
  const setIncludeAudio = (includeAudio: boolean) => setExportSettings({ includeAudio });

  // Detected Source Specs
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number } | null>(null);

  // Hardware Status & Progress
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  const [lastSavedFilename, setLastSavedFilename] = useState("");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Live Canvas Preview Ref during hardware encoding
  const livePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCountRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    detectSystemCapabilities().then(setCapabilities);
  }, []);

  // Inspect source video dimensions when video changes (without clobbering user choice)
  useEffect(() => {
    if (videoUrl) {
      const v = document.createElement("video");
      v.src = videoUrl;
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (v.videoWidth && v.videoHeight) {
          setSourceDimensions({ width: v.videoWidth, height: v.videoHeight });
        }
      };
    }
  }, [videoUrl]);

  if (!isOpen) return null;

  // Calculate live output dimension pill
  const computedDims = calculateExportDimensions(
    aspectRatio,
    resolution,
    sourceDimensions?.width,
    sourceDimensions?.height,
    quality
  );

  const isAspectRatioDifferentFromSource =
    sourceDimensions &&
    (() => {
      const srcRatio = sourceDimensions.width / sourceDimensions.height;
      const targetRatio = computedDims.width / computedDims.height;
      return Math.abs(srcRatio - targetRatio) > 0.05;
    })();

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    const totalFrames = Math.max(1, Math.round((duration || 5) * fps));
    setProgress({
      phase: "preparing",
      percent: 0,
      currentFrame: 0,
      totalFrames,
      fps: 0,
      timeRemainingSec: 0,
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const config: ExportConfig = {
      resolution,
      aspectRatio,
      fitMode,
      fps,
      format: videoFormat,
      quality,
      includeAudio,
      syncOffsetSeconds: syncOffset || 0,
    };

    try {
      const exportedBlob = await exportVideoWithWebCodecs({
        videoElement: videoElement || undefined,
        videoUrl: videoUrl || undefined,
        videoFile: videoFile || undefined,
        words: tokens,
        template,
        config,
        duration: duration || 5,
        layerOrder,
        onProgress: (p) => setProgress(p),
        onFrameRendered: (canvasSource) => {
          frameCountRef.current++;
          if (frameCountRef.current % 4 !== 0) return;
          if (livePreviewCanvasRef.current) {
            const previewCtx = livePreviewCanvasRef.current.getContext("2d");
            if (previewCtx) {
              previewCtx.clearRect(0, 0, livePreviewCanvasRef.current.width, livePreviewCanvasRef.current.height);
              previewCtx.drawImage(
                canvasSource as CanvasImageSource,
                0,
                0,
                livePreviewCanvasRef.current.width,
                livePreviewCanvasRef.current.height
              );
            }
          }
        },
        signal: abortController.signal,
      });

      const aspectTag = aspectRatio.replace(":", "x");
      const filename =
        videoFormat === "webm_alpha"
          ? `bolsub-overlay-${aspectTag}-${resolution}-${Date.now()}.webm`
          : `bolsub-video-${aspectTag}-${resolution}-${Date.now()}.mp4`;

      const mime = videoFormat === "webm_alpha" ? "video/webm" : "video/mp4";
      const ext = videoFormat === "webm_alpha" ? "webm" : "mp4";

      await saveBlobToDisk(exportedBlob, {
        suggestedName: filename,
        mimeType: mime,
        extension: ext,
        description: videoFormat === "webm_alpha" ? "Transparent Alpha WebM" : "Full Composite MP4 Video",
      });

      setLastSavedFilename(filename);
      setExportComplete(true);
      setIsExporting(false);

      // Trigger celebratory local confetti
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#A3E635", "#39FF14", "#FFE600", "#FF007F", "#00F0FF"],
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
          ? { ...prev, phase: "error", error: err instanceof Error ? err.message : "Export pipeline error" }
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
      content = generateAss(tokens, template, computedDims.width, computedDims.height);
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
    else if (type === "ass") text = generateAss(tokens, template, computedDims.width, computedDims.height);

    navigator.clipboard.writeText(text);
    setCopiedFormat(type);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] rounded-2xl shadow-[6px_6px_0px_var(--border-main)] overflow-hidden flex flex-col text-[var(--text-main)] my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <Sparkles className="w-5 h-5 text-[#142218]" />
            </div>
            <div>
              <h2 className="font-fraunces italic text-lg sm:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
                Export Studio Captions
                <span className="neo-pill bg-[var(--accent-lime)]/20 text-[var(--text-main)] text-[9px] py-0.5 px-2">
                  100% On-Device
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Hardware-accelerated rendering with custom aspect ratios & synchronized sound
              </p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        {!isExporting && !exportComplete && (
          <div className="flex border-b-2 border-[var(--border-main)]/30 bg-[var(--bg-panel)] px-6 pt-2 gap-4 shrink-0">
            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
                activeTab === "video"
                  ? "border-[var(--accent-lime)] text-[var(--text-main)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Video & Transparent Overlay</span>
            </button>
            <button
              onClick={() => setActiveTab("subtitles")}
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
                activeTab === "subtitles"
                  ? "border-[var(--accent-lime)] text-[var(--text-main)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Subtitle Files (SRT, VTT, ASS)</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* STATE 1: Live Hardware Exporting Progress */}
          {isExporting && progress && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-[var(--accent-lime)]/20 text-[var(--accent-forest)] dark:text-[var(--accent-lime)] border-2 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] animate-pulse">
                  <Cpu className="w-8 h-8" />
                </div>
                <h3 className="font-fraunces italic text-lg sm:text-xl font-bold text-[var(--text-main)] capitalize">
                  {progress.phase === "preparing" && "Preparing Hardware Encoder & Audio..."}
                  {progress.phase === "rendering" && "Rendering Frames with Captions..."}
                  {progress.phase === "muxing" && "Muxing MP4 Fast Container..."}
                  {progress.phase === "error" && "Export Encountered an Error"}
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  {aspectRatio} · {computedDims.width}×{computedDims.height} · {fps}fps · {includeAudio ? "Audio Track Included" : "Muted"}
                </p>
              </div>

              {/* Realtime Live Preview Canvas */}
              <div className="flex justify-center">
                <div className="relative rounded-xl border-2 border-[var(--border-main)] overflow-hidden bg-black shadow-[4px_4px_0px_var(--border-main)] max-h-48 flex items-center justify-center">
                  <canvas
                    ref={livePreviewCanvasRef}
                    width={320}
                    height={Math.round((320 * computedDims.height) / computedDims.width)}
                    className="max-h-44 object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-[var(--accent-lime)] text-[9px] font-mono font-bold border border-white/20">
                    LIVE ENCODER PREVIEW
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono">
                  <span className="font-bold text-[var(--text-main)]">Rendering Progress</span>
                  <span className="font-black text-[var(--accent-forest)] dark:text-[var(--accent-lime)]">
                    {progress.percent}%
                  </span>
                </div>
                <div className="h-3.5 w-full bg-[var(--bg-panel)] rounded-full overflow-hidden border-2 border-[var(--border-main)]">
                  <div
                    className="h-full bg-[var(--accent-lime)] transition-all duration-150"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              {/* Realtime Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] text-center text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Frames</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">
                    {progress.currentFrame} / {progress.totalFrames}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Encoding Speed</span>
                  <span className="font-mono font-bold text-[var(--accent-forest)] dark:text-[var(--accent-lime)]">
                    {progress.fps > 0 ? `${progress.fps} FPS` : "Calibrating..."}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Est. Remaining</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">
                    {progress.timeRemainingSec > 0 ? `${progress.timeRemainingSec}s` : "Wrapping up..."}
                  </span>
                </div>
              </div>

              {progress.error && (
                <div className="p-3 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-500 text-xs font-medium">
                  {progress.error}
                </div>
              )}

              {/* Cancel Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleCancelExport}
                  className="neo-btn-secondary px-4 py-2 text-xs font-bold text-red-500 hover:text-red-600 cursor-pointer"
                >
                  Cancel Export
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Export Complete Screen */}
          {!isExporting && exportComplete && (
            <div className="text-center space-y-4 py-6">
              <div className="inline-flex p-3 rounded-2xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)]">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-fraunces italic text-xl font-bold text-[var(--text-main)]">
                  Video Saved Successfully!
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                  Directly saved to your local disk with frame-accurate sync and sound
                </p>
                <div className="mt-3 inline-block font-mono text-xs text-[var(--text-main)] bg-[var(--bg-panel)] px-3 py-1.5 rounded-lg border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
                  {lastSavedFilename}
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  onClick={() => setExportComplete(false)}
                  className="neo-btn-secondary px-4 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Export Another Format
                </button>
                <button
                  onClick={onClose}
                  className="neo-btn px-6 py-2.5 text-xs font-black cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: Tab 1 - Video Export Configuration */}
          {!isExporting && !exportComplete && activeTab === "video" && (
            <div className="space-y-4">
              {/* Export Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Export Mode
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setVideoFormat("mp4")}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      videoFormat === "mp4"
                        ? "bg-[var(--accent-lime)]/15 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] text-[var(--text-main)]"
                        : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-[var(--accent-forest)] dark:text-[var(--accent-lime)]" />
                      <span className="text-xs font-black text-[var(--text-main)]">Burn-In MP4 Video</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                      Full composite video with styled captions, depth & synchronized sound
                    </p>
                  </button>

                  <button
                    onClick={() => setVideoFormat("webm_alpha")}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      videoFormat === "webm_alpha"
                        ? "bg-[var(--accent-lime)]/15 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] text-[var(--text-main)]"
                        : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[var(--accent-forest)] dark:text-[var(--accent-lime)]" />
                      <span className="text-xs font-black text-[var(--text-main)]">Transparent Overlay (WebM)</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                      Alpha-channel track for Premiere Pro, DaVinci Resolve & Final Cut
                    </p>
                  </button>
                </div>
              </div>

              {/* 1. Aspect Ratio Selection (CORE USER REQUIREMENT) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Ratio className="w-3.5 h-3.5" />
                    Target Aspect Ratio
                  </label>
                  {sourceDimensions && (
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Source: {sourceDimensions.width}×{sourceDimensions.height}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(
                    [
                      { id: "original", label: "Original", icon: Clapperboard, sub: "Source" },
                      { id: "9:16", label: "9:16", icon: Smartphone, sub: "Reels / TikTok" },
                      { id: "16:9", label: "16:9", icon: Tv, sub: "YouTube / Widescreen" },
                      { id: "1:1", label: "1:1", icon: Square, sub: "Instagram Square" },
                      { id: "4:5", label: "4:5", icon: Smartphone, sub: "Feed Portrait" },
                      { id: "21:9", label: "21:9", icon: Maximize2, sub: "Ultrawide" },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setAspectRatio(item.id)}
                        className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          aspectRatio === item.id
                            ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] font-black shadow-[3px_3px_0px_var(--border-main)]"
                            : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mx-auto mb-1" />
                        <span className="block text-xs font-black">{item.label}</span>
                        <span className="block text-[9px] opacity-80 truncate">{item.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Framing & Crop Mode (When aspect ratio changes) */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)]/40">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5" />
                    Framing & Crop Mode
                  </label>
                  {isAspectRatioDifferentFromSource && (
                    <span className="neo-pill bg-[var(--accent-lime)]/20 text-[var(--text-main)] text-[9px] py-0 px-2">
                      Aspect Ratio Conversion
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "cover", label: "Cover (Crop)", desc: "Fill frame, crop edges" },
                      { id: "fit", label: "Fit (Letterbox)", desc: "Clean dark bars" },
                      { id: "fit_blur", label: "Fit + Blur", desc: "Ambient blurred backdrop" },
                      { id: "stretch", label: "Stretch", desc: "Stretch to fill" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFitMode(f.id)}
                      className={`p-2 rounded-lg border-2 text-center transition-all cursor-pointer ${
                        fitMode === f.id
                          ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] font-black shadow-[2px_2px_0px_var(--border-main)]"
                          : "bg-[var(--bg-card)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                      }`}
                    >
                      <span className="block text-[11px] font-bold">{f.label}</span>
                      <span className="block text-[9px] opacity-80 mt-0.5 truncate">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Resolution Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Resolution Quality Tier
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[var(--accent-forest)] dark:text-[var(--accent-lime)]">
                    Output: {computedDims.width} × {computedDims.height} px
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(
                    [
                      { id: "720p", label: "720p HD", sub: "Fastest" },
                      { id: "1080p", label: "1080p FHD", sub: "Recommended" },
                      { id: "1440p", label: "1440p 2K", sub: "Crisp QHD" },
                      { id: "4k", label: "4K UHD", sub: "Ultra Crisp" },
                      { id: "source", label: "Source Match", sub: "Exact Pixels" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setResolution(item.id)}
                      className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        resolution === item.id
                          ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] font-black shadow-[2px_2px_0px_var(--border-main)]"
                          : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                      }`}
                    >
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="block text-[9px] opacity-80 mt-0.5 truncate">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Frame Rate & Quality Bitrate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Frame Rate
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([24, 30, 60] as const).map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setFps(rate)}
                        className={`p-2 rounded-lg border-2 text-center text-xs font-bold transition-all cursor-pointer ${
                          fps === rate
                            ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]"
                            : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                        }`}
                      >
                        {rate} FPS
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Quality Preset
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "fast", label: "Compact" },
                        { id: "standard", label: "Balanced" },
                        { id: "high", label: "High Q" },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setQuality(q.id)}
                        className={`p-2 rounded-lg border-2 text-center text-xs font-bold transition-all cursor-pointer ${
                          quality === q.id
                            ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]"
                            : "bg-[var(--bg-panel)] border-[var(--border-main)]/30 text-[var(--text-muted)] hover:border-[var(--border-main)]"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Audio Inclusion Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)]/40 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg border border-[var(--border-main)] ${includeAudio ? "bg-[var(--accent-lime)] text-[#142218]" : "bg-zinc-800 text-zinc-400"}`}>
                    {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-main)] block">
                      Include Original Audio Track
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Synchronized stereo AAC encoding directly into the container
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-lime)]" />
                </label>
              </div>

              {/* Hardware Acceleration Status Banner */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)]/30 text-xs">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Cpu className="w-4 h-4 text-[var(--accent-forest)] dark:text-[var(--accent-lime)]" />
                  <span>
                    Hardware Accelerator:{" "}
                    <strong className="text-[var(--text-main)]">
                      {capabilities?.webCodecsH264 ? "WebCodecs H.264 (Active)" : "Universal MediaEngine"}
                    </strong>
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-[var(--accent-forest)] dark:text-[var(--accent-lime)]">
                  0 Cloud Tokens · Local
                </span>
              </div>

              {/* Export Action Button */}
              <button
                onClick={handleStartExport}
                className="neo-btn w-full py-3.5 px-4 text-[#142218] font-black text-sm gap-2 cursor-pointer shadow-[4px_4px_0px_var(--border-main)]"
              >
                <Download className="w-4 h-4 text-[#142218] stroke-[2.5]" />
                <span>
                  Render & Save {videoFormat === "webm_alpha" ? "Transparent WebM" : "Composite Video"} ({computedDims.width}×{computedDims.height} · {fps}fps)
                </span>
              </button>
            </div>
          )}

          {/* STATE 4: Tab 2 - Subtitle Documents (SRT, VTT, ASS) */}
          {!isExporting && !exportComplete && activeTab === "subtitles" && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Download formatted subtitle documents for YouTube Studio, VLC, Premiere Pro, or CapCut.
              </p>

              <div className="space-y-3">
                {/* SRT */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
                  <div>
                    <h4 className="text-xs font-black text-[var(--text-main)] flex items-center gap-1.5">
                      SubRip Subtitle (.srt)
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Universal subtitle format compatible with every video editor & player
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("srt")}
                      className="neo-btn-secondary p-2 rounded-lg cursor-pointer"
                      title="Copy SRT to clipboard"
                    >
                      {copiedFormat === "srt" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("srt")}
                      className="neo-btn py-1.5 px-3 text-xs font-black gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.srt</span>
                    </button>
                  </div>
                </div>

                {/* VTT */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
                  <div>
                    <h4 className="text-xs font-black text-[var(--text-main)] flex items-center gap-1.5">
                      WebVTT Subtitle (.vtt)
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      HTML5 web standard format with font colors and layout cues
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("vtt")}
                      className="neo-btn-secondary p-2 rounded-lg cursor-pointer"
                      title="Copy VTT to clipboard"
                    >
                      {copiedFormat === "vtt" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("vtt")}
                      className="neo-btn py-1.5 px-3 text-xs font-black gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.vtt</span>
                    </button>
                  </div>
                </div>

                {/* ASS */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
                  <div>
                    <h4 className="text-xs font-black text-[var(--text-main)] flex items-center gap-1.5">
                      Advanced SubStation Alpha (.ass)
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Rich styling, template font colors, borders, and per-word karaoke tags (\k)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySubtitles("ass")}
                      className="neo-btn-secondary p-2 rounded-lg cursor-pointer"
                      title="Copy ASS to clipboard"
                    >
                      {copiedFormat === "ass" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExportSubtitleFile("ass")}
                      className="neo-btn py-1.5 px-3 text-xs font-black gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.ass</span>
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
