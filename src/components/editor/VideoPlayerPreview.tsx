"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/editorStore";
import { renderCaptionsToCanvas, buildCaptionCues } from "@/lib/renderer/captionRenderer";
import { getTemplateById } from "@/lib/templates";
import { segmentationPipeline } from "@/lib/segmentation/segmentationPipeline";
import type { SegmentationMaskFrame } from "@/lib/segmentation/types";
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
    layerOrder,
    maskQualityTier,
    maskFeather,
    maskExpandContract,
    showMaskOverlay,
    exportSettings,
    setExportSettings,
    isAudioMuted,
    setIsAudioMuted,
    isCaptionsVisible,
    isVideoVisible,
    animationEffectOverride,
  } = useEditorStore();

  const baseTemplate = getTemplateById(templateId);
  const template = useMemo(() => {
    if (!animationEffectOverride) return baseTemplate;
    return {
      ...baseTemplate,
      animation: {
        ...baseTemplate.animation,
        perWordEffect: animationEffectOverride,
      },
    };
  }, [baseTemplate, animationEffectOverride]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const aspectRatio: "9:16" | "1:1" | "16:9" =
    exportSettings.aspectRatio === "16:9" || exportSettings.aspectRatio === "1:1" || exportSettings.aspectRatio === "9:16"
      ? exportSettings.aspectRatio
      : "9:16";

  const setAspectRatio = (ratio: "9:16" | "1:1" | "16:9") => {
    setExportSettings({ aspectRatio: ratio });
  };
  const [detectedSpecs, setDetectedSpecs] = useState<string>("1920×1080 · 24fps");
  const [zoomLevel, setZoomLevel] = useState<"fit" | "100%" | "75%" | "50%">("fit");
  const isMuted = isAudioMuted;
  const setIsMuted = setIsAudioMuted;
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

  // Behind-the-subject mask cache reference for 60fps non-blocking rendering
  const currentMaskRef = useRef<SegmentationMaskFrame | null>(null);
  const isInferencingRef = useRef<boolean>(false);
  const lastInferenceTimeRef = useRef<number>(-1);

  const effectiveLayerOrder =
    layerOrder ||
    template.layout?.layerOrder ||
    (template.layout?.behindSubjectDepth ? "behind" : "front");
  const isDepthActive = effectiveLayerOrder !== "front";

  // Synchronize segmentation pipeline config with user settings
  useEffect(() => {
    segmentationPipeline.setConfig({
      targetResolution: maskQualityTier === "fast" ? 256 : maskQualityTier === "ultra" ? 512 : 384,
      featherRadius: maskFeather,
      expandContractPx: maskExpandContract,
    });
    currentMaskRef.current = null;
  }, [maskQualityTier, maskFeather, maskExpandContract]);


  // Re-render canvas frame when paused and seeking/scrubbing
  useEffect(() => {
    if (!isPlaying && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let isCancelled = false;

      const render = async () => {
        let mask = currentMaskRef.current;
        if (isDepthActive && videoRef.current) {
          try {
            mask = await segmentationPipeline.getOrProcessFrameMask(
              videoTitle || "preview_stream",
              currentTime,
              videoRef.current,
              canvasDims.width,
              canvasDims.height
            );
            if (isCancelled) return;
            currentMaskRef.current = mask;
          } catch {
            // graceful fallback
          }
        }

        if (isCancelled) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (isCaptionsVisible) {
          renderCaptionsToCanvas(
          ctx,
          tokens,
          template,
          currentTime,
          canvas.width,
          canvas.height,
          syncOffset,
          isDepthActive && mask
            ? {
                videoSource: videoRef.current,
                segmentationMask: mask.maskData,
                maskWidth: mask.width,
                maskHeight: mask.height,
                subjectMetrics: mask.metrics,
                showMaskOverlay,
                layerOrder: effectiveLayerOrder,
              }
            : undefined
          );
        }
      };

      render();

      return () => {
        isCancelled = true;
      };
    }
  }, [
    currentTime,
    isPlaying,
    tokens,
    template,
    canvasDims,
    syncOffset,
    isDepthActive,
    showMaskOverlay,
    layerOrder,
    videoTitle,
  ]);

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

          // Asynchronously query mask in background without blocking 60fps rAF
          if (isDepthActive && videoRef.current && !isInferencingRef.current) {
            const timeDiff = Math.abs(liveTime - lastInferenceTimeRef.current);
            if (timeDiff >= 0.05) {
              isInferencingRef.current = true;
              lastInferenceTimeRef.current = liveTime;
              segmentationPipeline
                .getOrProcessFrameMask(
                  videoTitle || "preview_stream",
                  liveTime,
                  videoRef.current,
                  canvasDims.width,
                  canvasDims.height
                )
                .then((m) => {
                  currentMaskRef.current = m;
                  isInferencingRef.current = false;
                })
                .catch(() => {
                  isInferencingRef.current = false;
                });
            }
          }

          const activeMask = currentMaskRef.current;
          renderCaptionsToCanvas(
            ctx,
            tokens,
            template,
            liveTime,
            canvas.width,
            canvas.height,
            syncOffset,
            isDepthActive && activeMask
              ? {
                  videoSource: videoRef.current,
                  segmentationMask: activeMask.maskData,
                  maskWidth: activeMask.width,
                  maskHeight: activeMask.height,
                  subjectMetrics: activeMask.metrics,
                  showMaskOverlay,
                  layerOrder: effectiveLayerOrder,
                }
              : undefined
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
  }, [
    isPlaying,
    tokens,
    template,
    setCurrentTime,
    canvasDims,
    syncOffset,
    isDepthActive,
    showMaskOverlay,
    layerOrder,
    videoTitle,
  ]);

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
      ref={containerRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-main)] transition-all overflow-hidden shadow-[3px_3px_0px_var(--border-main)] ${
        isDraggingFile ? "ring-4 ring-[var(--accent-lime)] shadow-[5px_5px_0px_var(--border-main)]" : ""
      }`}
    >
      {/* 1. NLE Program Monitor Top Bar */}
      <div className="h-12 px-3 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] flex items-center justify-between text-xs select-none">
        {/* Left: Monitor Title & Format */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-extrabold text-[var(--text-main)]">
            <Film className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
            <span className="tracking-wide">Program Monitor</span>
          </div>

          <div className="h-4 w-px bg-[var(--border-main)] opacity-30" />

          {/* Aspect Ratio Switcher */}
          <div className="flex items-center bg-[var(--bg-panel)] rounded-full p-0.5 border-2 border-[var(--border-main)] text-[11px] font-bold shadow-[2px_2px_0px_var(--border-main)]">
            <button
              onClick={() => setAspectRatio("16:9")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                aspectRatio === "16:9"
                  ? "bg-[var(--accent-lime)] text-[#142218] font-black border border-[var(--border-main)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
              title="16:9 Landscape (YouTube / Presentations)"
            >
              16:9
            </button>
            <button
              onClick={() => setAspectRatio("9:16")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                aspectRatio === "9:16"
                  ? "bg-[var(--accent-lime)] text-[#142218] font-black border border-[var(--border-main)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
              title="9:16 Vertical (Shorts / Reels)"
            >
              9:16
            </button>
            <button
              onClick={() => setAspectRatio("1:1")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                aspectRatio === "1:1"
                  ? "bg-[var(--accent-lime)] text-[#142218] font-black border border-[var(--border-main)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
              title="1:1 Square (Instagram Feed)"
            >
              1:1
            </button>
          </div>

          <span className="text-[11px] text-[var(--text-muted)] font-mono font-semibold hidden xl:inline">
            {detectedSpecs}
          </span>
        </div>

        {/* Right: View Options & File Import */}
        <div className="flex items-center gap-1.5">
          {/* Safe Zones Toggle */}
          <button
            onClick={toggleSafeZones}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-[var(--border-main)] text-[11px] font-bold transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-main)] ${
              showSafeZones
                ? "bg-[var(--accent-lime)] text-[#142218]"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Toggle Instagram Reels & YouTube Shorts UI Guides"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Safe Zones</span>
          </button>

          {/* Audio / Caption Sync Calibration */}
          <div
            className="flex items-center gap-1 bg-[var(--bg-panel)] px-2.5 py-0.5 rounded-full border-2 border-[var(--border-main)] text-[10px] font-mono shadow-[2px_2px_0px_var(--border-main)]"
            title="Fine-tune audio-to-caption synchronization offset"
          >
            <span className="text-[var(--text-muted)] font-bold hidden sm:inline">SYNC:</span>
            <button
              onClick={() => setSyncOffset(Math.max(-0.5, syncOffset - 0.05))}
              className="px-1 py-0.5 rounded hover:bg-[var(--accent-lime)]/20 text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold transition-colors cursor-pointer"
              title="Nudge captions 50ms earlier (-50ms)"
            >
              -50ms
            </button>
            <span
              className={`px-1.5 py-0.5 rounded font-bold ${
                syncOffset === 0
                  ? "text-[var(--text-muted)]"
                  : "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)]"
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
              className="px-1 py-0.5 rounded hover:bg-[var(--accent-lime)]/20 text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold transition-colors cursor-pointer"
              title="Nudge captions 50ms later (+50ms)"
            >
              +50ms
            </button>
            {syncOffset !== 0 && (
              <button
                onClick={() => setSyncOffset(0)}
                className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-main)] px-1 underline cursor-pointer"
                title="Reset sync offset to 0ms"
              >
                Reset
              </button>
            )}
          </div>

          {/* Import / Replace Clip */}
          {videoUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="neo-btn-secondary px-2.5 py-1 text-[11px] gap-1.5 cursor-pointer"
              title="Change video source file"
            >
              <Upload className="w-3 h-3 text-[var(--text-main)]" />
              <span className="hidden lg:inline">Replace</span>
            </button>
          )}

          {/* Fullscreen monitor toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Toggle Program Monitor Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
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
      <div className="flex-1 flex items-center justify-center p-2 relative bg-[var(--bg-canvas)] overflow-hidden min-h-0">
        {/* Dynamic Display Bezel */}
        <div
          className={`relative h-full max-h-[calc(100%-8px)] rounded-2xl bg-black border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] overflow-hidden flex items-center justify-center transition-all ${
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
              id="preview-video-element"
              ref={videoRef}
              src={videoUrl}
              muted={isAudioMuted}
              className={`absolute inset-0 w-full h-full object-contain z-0 transition-opacity duration-200 ${
                isVideoVisible === false ? "opacity-0" : "opacity-100"
              }`}
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
              onLoadedData={() => {
                if (videoRef.current && isDepthActive) {
                  segmentationPipeline.getOrProcessFrameMask(
                    videoTitle || "preview_stream",
                    videoRef.current.currentTime || 0,
                    videoRef.current,
                    canvasDims.width,
                    canvasDims.height
                  ).then((m) => {
                    currentMaskRef.current = m;
                    if (canvasRef.current) {
                      const ctx = canvasRef.current.getContext("2d");
                      if (ctx) {
                        ctx.clearRect(0, 0, canvasDims.width, canvasDims.height);
                        renderCaptionsToCanvas(
                          ctx,
                          tokens,
                          template,
                          videoRef.current?.currentTime || 0,
                          canvasDims.width,
                          canvasDims.height,
                          syncOffset,
                          {
                            videoSource: videoRef.current,
                            segmentationMask: m.maskData,
                            maskWidth: m.width,
                            maskHeight: m.height,
                            subjectMetrics: m.metrics,
                            showMaskOverlay,
                            layerOrder: effectiveLayerOrder,
                          }
                        );
                      }
                    }
                  }).catch(() => {});
                }
              }}
              onSeeked={() => {
                if (videoRef.current && isDepthActive) {
                  segmentationPipeline.getOrProcessFrameMask(
                    videoTitle || "preview_stream",
                    videoRef.current.currentTime || 0,
                    videoRef.current,
                    canvasDims.width,
                    canvasDims.height
                  ).then((m) => {
                    currentMaskRef.current = m;
                    if (canvasRef.current) {
                      const ctx = canvasRef.current.getContext("2d");
                      if (ctx) {
                        ctx.clearRect(0, 0, canvasDims.width, canvasDims.height);
                        renderCaptionsToCanvas(
                          ctx,
                          tokens,
                          template,
                          videoRef.current?.currentTime || 0,
                          canvasDims.width,
                          canvasDims.height,
                          syncOffset,
                          {
                            videoSource: videoRef.current,
                            segmentationMask: m.maskData,
                            maskWidth: m.width,
                            maskHeight: m.height,
                            subjectMetrics: m.metrics,
                            showMaskOverlay,
                            layerOrder: effectiveLayerOrder,
                          }
                        );
                      }
                    }
                  }).catch(() => {});
                }
              }}
              playsInline
              onEnded={() => useEditorStore.getState().setIsPlaying(false)}
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--bg-panel)] z-0 flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] flex items-center justify-center mb-3">
                <Film className="w-8 h-8 stroke-[2.2]" />
              </div>
              <h3 className="font-fraunces italic text-lg sm:text-xl font-black text-[var(--text-main)] flex items-center gap-2">
                Program Monitor
                <span className="neo-pill bg-[var(--accent-lime)]/25 text-[var(--text-main)] text-[9px] py-0 px-2">
                  Studio Ready
                </span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-[290px] leading-relaxed font-medium">
                Drop any video file (MP4, MOV, WebM) here to automatically extract audio and transcribe captions.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-[320px]">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="neo-btn w-full sm:flex-1 py-2 px-3.5 text-xs font-black gap-2 cursor-pointer shadow-[3px_3px_0px_var(--border-main)] text-[#142218]"
                >
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Select Video Clip</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/sih_final.mp4");
                      const blob = await res.blob();
                      const file = new File([blob], "sih_final.mp4", { type: "video/mp4" });
                      setVideo(file);
                      const tokRes = await fetch("/sih_tokens.json");
                      if (tokRes.ok) {
                        const json = await tokRes.json();
                        if (Array.isArray(json)) {
                          useEditorStore.getState().setTokens(json);
                        }
                      }
                    } catch (e) {
                      console.warn("Failed to load demo:", e);
                    }
                  }}
                  className="neo-btn-secondary w-full sm:w-auto py-2 px-3 text-xs font-bold gap-1.5 cursor-pointer shadow-[2px_2px_0px_var(--border-main)]"
                  title="Instantly test with the built-in sample clip"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--text-main)]" />
                  <span>Load Demo Reel</span>
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
                <div className="w-full h-full border-2 border-dashed border-[var(--accent-lime)]/80 flex flex-col justify-between p-3">
                  <span className="text-[10px] text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-main)] px-2 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase inline-block w-fit shadow-sm">
                    16:9 Broadcast Action Safe (90%)
                  </span>
                  <div className="w-full h-[85%] border-2 border-dashed border-red-500/60 flex items-end justify-center pb-2">
                    <span className="text-[10px] text-red-500 bg-[var(--bg-card)] border border-red-500/40 px-2 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase shadow-sm">
                      16:9 Subtitle Title Safe (80%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="h-12 border-b-2 border-dashed border-red-500/60 bg-red-500/10 flex items-center justify-center text-[10px] text-red-500 font-mono font-bold tracking-wider uppercase">
                    Top UI Safe Margin
                  </div>
                  <div className="h-28 border-t-2 border-dashed border-red-500/60 bg-red-500/10 flex items-center justify-center text-[10px] text-red-500 font-mono font-bold tracking-wider uppercase">
                    Bottom Caption & Sound Safe Area
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Broadcast Stereo Audio VU Level Meter */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden 2xl:flex items-center gap-1.5 p-2 bg-[var(--bg-card)] rounded-xl border-2 border-[var(--border-main)] select-none shadow-[3px_3px_0px_var(--border-main)]">
          {/* Left Meter */}
          <div className="w-1.5 h-36 bg-[var(--bg-panel)] rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-[var(--border-main)]/30">
            <div
              className="w-full rounded-full transition-all duration-75 bg-gradient-to-t from-[var(--accent-lime)] to-[var(--accent-forest)]"
              style={{ height: `${vuLeft}%` }}
            />
          </div>
          {/* Right Meter */}
          <div className="w-1.5 h-36 bg-[var(--bg-panel)] rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-[var(--border-main)]/30">
            <div
              className="w-full rounded-full transition-all duration-75 bg-gradient-to-t from-[var(--accent-lime)] to-[var(--accent-forest)]"
              style={{ height: `${vuRight}%` }}
            />
          </div>
          <div className="flex flex-col justify-between h-36 text-[8px] font-mono font-bold text-[var(--text-muted)] py-0.5">
            <span>0</span>
            <span>-6</span>
            <span>-18</span>
            <span>-36</span>
          </div>
        </div>
      </div>

      {/* 3. NLE Transport Bar & Timecode Controller */}
      <div className="h-13 px-4 bg-[var(--bg-card)] border-t-2 border-[var(--border-main)] flex items-center justify-between text-xs select-none">
        {/* Timecode Readout */}
        <div className="flex items-center gap-2 font-mono">
          <div className="px-3 py-1 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-extrabold text-xs tracking-wider shadow-[2px_2px_0px_var(--border-main)]">
            {formatSmpte(currentTime)}
          </div>
          <span className="text-[var(--text-muted)] font-semibold">/</span>
          <span className="text-[var(--text-muted)] text-xs font-bold">{formatSmpte(duration || 5)}</span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Jump to Previous Word */}
          <button
            onClick={() => handleJumpToWord("prev")}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Previous word cue"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Frame Step Back */}
          <button
            onClick={() => handleFrameStep(-1)}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Step 1 frame backward (Left)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full neo-btn text-[#142218] flex items-center justify-center font-bold shadow-[3px_3px_0px_var(--border-main)] transition-all cursor-pointer mx-1"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
          </button>

          {/* Frame Step Forward */}
          <button
            onClick={() => handleFrameStep(1)}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Step 1 frame forward (Right)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Jump to Next Word */}
          <button
            onClick={() => handleJumpToWord("next")}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Next word cue"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed & Volume Controls */}
        <div className="flex items-center gap-3">
          {/* Playback Speed Pill */}
          <div className="flex items-center bg-[var(--bg-panel)] rounded-full p-0.5 border-2 border-[var(--border-main)] text-[10px] font-mono shadow-[2px_2px_0px_var(--border-main)]">
            {([1.0, 1.5, 2.0] as const).map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  playbackRate === rate
                    ? "bg-[var(--accent-lime)] text-[#142218] font-black border border-[var(--border-main)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-500" />
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
              className="w-14 h-1 bg-[var(--border-main)]/30 rounded-full accent-[var(--accent-lime)] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
