"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEditorStore } from "@/lib/editorStore";
import { renderCaptionsToCanvas } from "@/lib/renderer/captionRenderer";
import { getTemplateById } from "@/lib/templates";
import {
  Play,
  Pause,
  Upload,
  Layers,
  Volume2,
  VolumeX,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sliders,
  Sparkles,
  Eye,
  Film,
  Mic,
  Zap,
} from "lucide-react";

interface VideoPlayerPreviewProps {
  onOpenTranscribe?: () => void;
}

export function VideoPlayerPreview({ onOpenTranscribe }: VideoPlayerPreviewProps) {
  const {
    videoUrl,
    videoTitle,
    setVideo,
    currentTime,
    setCurrentTime,
    duration,
    isPlaying,
    togglePlay,
    playbackRate,
    setPlaybackRate,
    tokens,
    templateId,
    showSafeZones,
    toggleSafeZones,
    syncOffset,
    setSyncOffset,
  } = useEditorStore();

  const template = getTemplateById(templateId);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">("16:9");
  const [detectedSpecs, setDetectedSpecs] = useState<string>("1920×1080 · 24fps");
  const [zoomLevel, setZoomLevel] = useState<"fit" | "100%" | "75%" | "50%">("fit");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Dynamic canvas pixel dimensions according to selected aspect ratio
  const canvasDims =
    aspectRatio === "16:9"
      ? { width: 1920, height: 1080 }
      : aspectRatio === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1080, height: 1920 };

  // Audio VU Meter simulation values
  const [vuLeft, setVuLeft] = useState(0);
  const [vuRight, setVuRight] = useState(0);

  const lastReportedTime = useRef(0);

  // Re-render canvas frame when paused and seeking/scrubbing
  useEffect(() => {
    if (!isPlaying && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderCaptionsToCanvas(
          ctx,
          tokens,
          template,
          currentTime,
          canvas.width,
          canvas.height,
          syncOffset
        );
      }
    }
  }, [currentTime, isPlaying, tokens, template, canvasDims, syncOffset]);

  // 60fps hardware-synchronized render loop during playback
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;

    const render = () => {
      // 1. Sync time directly from hardware video element for 0-lag synchronization
      const isVideoPlaying = !!(videoRef.current && !videoRef.current.paused);
      const liveTime = videoRef.current ? videoRef.current.currentTime : currentTime;

      if (isVideoPlaying) {
        // Throttle React state updates to 25fps to eliminate component tree churn while preserving timeline smoothness
        if (Math.abs(liveTime - lastReportedTime.current) >= 0.04) {
          lastReportedTime.current = liveTime;
          setCurrentTime(liveTime);
        }
      }

      // 2. Render Shared Golden-Frame Captions to Canvas using instantaneous playback time
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== canvasDims.width) canvas.width = canvasDims.width;
        if (canvas.height !== canvasDims.height) canvas.height = canvasDims.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          renderCaptionsToCanvas(
            ctx,
            tokens,
            template,
            liveTime,
            canvas.width,
            canvas.height,
            syncOffset
          );
        }
      }

      // 3. Update Audio VU Meter
      if (isPlaying || isVideoPlaying) {
        const timeFactor = Math.sin(liveTime * 12);
        const l = Math.min(100, Math.max(12, Math.round(55 + timeFactor * 32 + (Math.random() * 10 - 5))));
        const r = Math.min(100, Math.max(10, Math.round(52 + timeFactor * 30 + (Math.random() * 10 - 5))));
        setVuLeft(l);
        setVuRight(r);
      } else {
        setVuLeft(0);
        setVuRight(0);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, tokens, template, setCurrentTime, canvasDims, syncOffset]);

  // Sync play/pause with HTMLVideoElement
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync volume & mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleSeek = (targetSec: number) => {
    const clamped = Math.max(0, Math.min(duration || 5, targetSec));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleFrameStep = (deltaFrames: number) => {
    const frameDuration = 1 / 30; // 30fps
    handleSeek(currentTime + deltaFrames * frameDuration);
  };

  const handleJumpToWord = (direction: "prev" | "next") => {
    if (!tokens || tokens.length === 0) return;
    if (direction === "prev") {
      const prevWord = [...tokens].reverse().find((t) => t.start < currentTime - 0.1);
      if (prevWord) handleSeek(prevWord.start);
      else handleSeek(0);
    } else {
      const nextWord = tokens.find((t) => t.start > currentTime + 0.1);
      if (nextWord) handleSeek(nextWord.start);
      else handleSeek(duration);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("video/") || file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i))) {
      setVideo(file);
      onOpenTranscribe?.();
    }
  };

  // SMPTE Timecode Formatter: HH:MM:SS:FF
  const formatSmpte = (seconds: number) => {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const frames = Math.floor((s % 1) * 30);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col bg-[#121316] rounded-xl border transition-all overflow-hidden ${
        isDraggingFile ? "border-amber-500 shadow-xl shadow-amber-500/10" : "border-[#24262c]"
      }`}
    >
      {/* 1. NLE Program Monitor Top Bar */}
      <div className="h-10 px-3 bg-[#18191e] border-b border-[#24262c] flex items-center justify-between text-xs select-none">
        {/* Left: Monitor Title & Format */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold text-zinc-200">
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span className="tracking-wide">Program Monitor</span>
          </div>

          <div className="h-3.5 w-px bg-zinc-700/80" />

          {/* Aspect Ratio Switcher */}
          <div className="flex items-center bg-[#101114] rounded-lg p-0.5 border border-zinc-800 text-[11px] font-medium">
            <button
              onClick={() => setAspectRatio("16:9")}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                aspectRatio === "16:9"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="16:9 Landscape (YouTube / Presentations)"
            >
              16:9
            </button>
            <button
              onClick={() => setAspectRatio("9:16")}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                aspectRatio === "9:16"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="9:16 Vertical (Shorts / Reels)"
            >
              9:16
            </button>
            <button
              onClick={() => setAspectRatio("1:1")}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                aspectRatio === "1:1"
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="1:1 Square (Instagram Feed)"
            >
              1:1
            </button>
          </div>

          <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
            {detectedSpecs}
          </span>
        </div>

        {/* Right: View Options & File Import */}
        <div className="flex items-center gap-2">
          {/* AI Transcribe Trigger */}
          <button
            onClick={onOpenTranscribe}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all shadow-sm"
            title="Transcribe Audio and Generate Captions"
          >
            <Mic className="w-3 h-3 text-amber-400" />
            <span>Transcribe AI</span>
          </button>

          {/* Safe Zones Toggle */}
          <button
            onClick={toggleSafeZones}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
              showSafeZones
                ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                : "bg-[#101114] border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle Instagram Reels & YouTube Shorts UI Guides"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden md:inline">Safe Zones</span>
          </button>

          {/* Audio / Caption Sync Calibration */}
          <div
            className="flex items-center gap-1 bg-[#101114] px-2 py-0.5 rounded-lg border border-zinc-800 text-[10px] font-mono"
            title="Fine-tune audio-to-caption synchronization offset"
          >
            <span className="text-zinc-500 font-bold hidden sm:inline">SYNC:</span>
            <button
              onClick={() => setSyncOffset(Math.max(-0.5, syncOffset - 0.05))}
              className="px-1 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 font-bold transition-colors"
              title="Nudge captions 50ms earlier (-50ms)"
            >
              -50ms
            </button>
            <span
              className={`px-1 py-0.5 rounded font-bold ${
                syncOffset === 0
                  ? "text-zinc-400"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}
            >
              {syncOffset > 0
                ? `+${Math.round(syncOffset * 1000)}ms`
                : syncOffset < 0
                ? `${Math.round(syncOffset * 1000)}ms`
                : "0ms"}
            </span>
            <button
              onClick={() => setSyncOffset(Math.min(0.5, syncOffset + 0.05))}
              className="px-1 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 font-bold transition-colors"
              title="Nudge captions 50ms later (+50ms)"
            >
              +50ms
            </button>
            {syncOffset !== 0 && (
              <button
                onClick={() => setSyncOffset(0)}
                className="text-[9px] text-zinc-500 hover:text-white px-1 underline"
                title="Reset sync offset to 0ms"
              >
                Reset
              </button>
            )}
          </div>

          {/* Import / Replace Clip */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101114] hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition-colors"
          >
            <Upload className="w-3 h-3 text-amber-400" />
            <span>{videoUrl ? "Replace Clip" : "Import Clip"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setVideo(file);
                onOpenTranscribe?.();
              }
            }}
          />
        </div>
      </div>

      {/* 2. Monitor Viewport & Audio VU Meter Flank */}
      <div className="flex-1 flex items-center justify-center p-2 relative bg-[#0a0a0d] overflow-hidden min-h-0">
        {/* Dynamic Display Bezel */}
        <div
          className={`relative h-full max-h-[calc(100%-8px)] rounded-2xl bg-black border-2 border-[#2b2d35] shadow-2xl overflow-hidden flex items-center justify-center transition-all ${
            aspectRatio === "9:16"
              ? "aspect-[9/16] max-w-[260px] sm:max-w-[320px]"
              : aspectRatio === "1:1"
              ? "aspect-square max-w-[340px]"
              : "aspect-[16/9] w-full max-w-[720px] xl:max-w-[840px]"
          }`}
        >
          {/* Background Video Stream */}
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  const { videoWidth, videoHeight, duration: vidDur } = videoRef.current;
                  if (vidDur && !isNaN(vidDur)) useEditorStore.getState().setDuration(vidDur);
                  if (videoWidth && videoHeight) {
                    setDetectedSpecs(`${videoWidth}×${videoHeight} · 24fps`);
                    if (videoWidth >= videoHeight * 1.15) {
                      setAspectRatio("16:9");
                    } else if (videoHeight > videoWidth * 1.15) {
                      setAspectRatio("9:16");
                    } else {
                      setAspectRatio("1:1");
                    }
                  }
                }
              }}
              className="absolute inset-0 w-full h-full object-contain z-0"
              playsInline
              muted={isMuted}
              onEnded={() => useEditorStore.getState().setIsPlaying(false)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-[#101114] to-black z-0 flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                <Film className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Broadcast Program Monitor</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-[280px] leading-relaxed">
                Drop any video file (MP4, MOV, WebM) here to automatically extract audio and transcribe captions.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 w-full max-w-[220px]">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold shadow-lg shadow-amber-500/20 hover:opacity-95 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-black" />
                  Select Video Clip
                </button>
              </div>
            </div>
          )}

          {/* Shared Golden-Frame Caption Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={canvasDims.width}
            height={canvasDims.height}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
          />

          {/* Platform Safe-Zone Overlays */}
          {showSafeZones && (
            <div className="absolute inset-0 z-20 pointer-events-none p-4">
              {aspectRatio === "16:9" ? (
                <div className="w-full h-full border border-dashed border-amber-500/50 flex flex-col justify-between p-3">
                  <span className="text-[10px] text-amber-400 font-mono font-bold tracking-wider uppercase">
                    16:9 Broadcast Action Safe (90%)
                  </span>
                  <div className="w-full h-[85%] border border-dashed border-red-500/40 flex items-end justify-center pb-2">
                    <span className="text-[10px] text-red-400 font-mono font-bold tracking-wider uppercase">
                      16:9 Subtitle Title Safe (80%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="h-12 border-b-2 border-dashed border-red-500/60 bg-red-500/5 flex items-center justify-center text-[10px] text-red-400 font-mono font-bold tracking-wider uppercase">
                    Top UI Safe Margin
                  </div>
                  <div className="h-28 border-t-2 border-dashed border-red-500/60 bg-red-500/5 flex items-center justify-center text-[10px] text-red-400 font-mono font-bold tracking-wider uppercase">
                    Bottom Caption & Sound Safe Area
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Broadcast Stereo Audio VU Level Meter */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 p-2 bg-[#121316]/90 backdrop-blur-md rounded-xl border border-zinc-800/80 select-none shadow-xl">
          {/* Left Meter */}
          <div className="w-1.5 h-36 bg-zinc-900 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div
              className="w-full rounded-full transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500"
              style={{ height: `${vuLeft}%` }}
            />
          </div>
          {/* Right Meter */}
          <div className="w-1.5 h-36 bg-zinc-900 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
            <div
              className="w-full rounded-full transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500"
              style={{ height: `${vuRight}%` }}
            />
          </div>
          <div className="flex flex-col justify-between h-36 text-[8px] font-mono text-zinc-500 py-0.5">
            <span>0</span>
            <span>-6</span>
            <span>-18</span>
            <span>-36</span>
          </div>
        </div>
      </div>

      {/* 3. NLE Transport Bar & Timecode Controller */}
      <div className="h-14 px-4 bg-[#18191e] border-t border-[#24262c] flex items-center justify-between text-xs select-none">
        {/* Timecode Readout */}
        <div className="flex items-center gap-2 font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-[#101114] border border-zinc-800 text-amber-400 font-bold text-xs tracking-wider shadow-inner">
            {formatSmpte(currentTime)}
          </div>
          <span className="text-zinc-600 font-semibold">/</span>
          <span className="text-zinc-400 text-xs">{formatSmpte(duration || 5)}</span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Jump to Previous Word */}
          <button
            onClick={() => handleJumpToWord("prev")}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Previous word cue"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Frame Step Back */}
          <button
            onClick={() => handleFrameStep(-1)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Step 1 frame backward (Left)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black flex items-center justify-center font-bold shadow-lg shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer mx-1"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          {/* Frame Step Forward */}
          <button
            onClick={() => handleFrameStep(1)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Step 1 frame forward (Right)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Jump to Next Word */}
          <button
            onClick={() => handleJumpToWord("next")}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Next word cue"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed & Volume Controls */}
        <div className="flex items-center gap-3">
          {/* Playback Speed Pill */}
          <div className="flex items-center bg-[#101114] rounded-lg p-0.5 border border-zinc-800 text-[10px] font-mono">
            {([1.0, 1.5, 2.0] as const).map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  playbackRate === rate
                    ? "bg-zinc-800 text-amber-400 font-bold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-14 h-1 bg-zinc-800 rounded-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
