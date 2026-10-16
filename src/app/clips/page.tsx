"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Scissors,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Download,
  Film,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  HardDrive,
  Info,
  Play,
  Pause,
  Eye,
  Crop,
  Palette,
  CheckSquare,
  Square,
  Volume2,
  FileText,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { localHelperClient } from "@/lib/clips/helperClient";
import { opfsVideoStorage } from "@/lib/clips/opfsVideoStorage";
import type { HelperStatus, VideoProbeResult } from "@/lib/clips/types";
import {
  ClipsTranscriptionPipeline,
  type PipelineStageProgress,
  type ClipsIngestionResult,
} from "@/lib/clips/clipsTranscriptionPipeline";
import type { ModelTierId } from "@/lib/modelManager";
import { parseAndValidateYouTubeUrl } from "@/lib/clips/urlValidator";
import { findClipCandidates, type ClipCandidate } from "@/lib/clips/clipFinder";
import type { ClipStylePreset } from "@/lib/clips/scoringConfig";
import {
  selectCaptionTemplate,
  determineOptimalTemplateId,
  type SelectedTemplateResult,
} from "@/lib/clips/templateSelector";
import { computeTargetCropDimensions } from "@/lib/clips/autoReframe";
import { CAPTION_PRESETS } from "@/lib/templates/presets";
import {
  exportBatchClips,
  exportSingleClip,
  saveClipFilesToDisk,
  type SingleClipExportResult,
  type BatchExportProgress,
} from "@/lib/clips/batchClipsExporter";
import { saveBlobToDisk } from "@/lib/export/fileSaver";
import type { ExportResolution } from "@/lib/export/webcodecsExport";
import { buildCaptionCues } from "@/lib/renderer/captionRenderer";

export default function ClipsPage() {
  const [helperStatus, setHelperStatus] = useState<HelperStatus | null>(null);
  const [isCheckingHelper, setIsCheckingHelper] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isUpdatingYtdlp, setIsUpdatingYtdlp] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Probing state
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<VideoProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Ingestion & Transcription state
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<PipelineStageProgress | null>(null);
  const [ingestResult, setIngestResult] = useState<ClipsIngestionResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  // Auto Pipeline & UI settings
  const [autoRunOnPaste, setAutoRunOnPaste] = useState(true);
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [transcriptionTier, setTranscriptionTier] = useState<ModelTierId>("balanced");

  // Clips Candidate Discovery state
  const [selectedPreset, setSelectedPreset] = useState<ClipStylePreset>("balanced");
  const [discoveredClips, setDiscoveredClips] = useState<ClipCandidate[]>([]);

  // Phase 4: Selected Clip & 9:16 Reframe / Caption Styling state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [customTemplateId, setCustomTemplateId] = useState<string | null>(null);
  const [enableKeywords, setEnableKeywords] = useState(true);
  const [enableEmojis, setEnableEmojis] = useState(true);
  const [removeFillers, setRemoveFillers] = useState(true);
  const [reframeMode, setReframeMode] = useState<"9:16_auto" | "16:9_fit_blur" | "original">("9:16_auto");
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Memoized Active Clip & Kinetic Caption Styling (prevents CPU recalculation in 60fps render loop)
  const activeClip = useMemo(() => {
    if (!selectedClipId) return null;
    return discoveredClips.find((c) => c.id === selectedClipId) || null;
  }, [selectedClipId, discoveredClips]);

  const activeStyling = useMemo(() => {
    if (!activeClip) return null;
    return selectCaptionTemplate(activeClip, {
      templateId: customTemplateId || undefined,
      enableKeywords,
      enableEmojis,
      removeFillers,
    });
  }, [activeClip, customTemplateId, enableKeywords, enableEmojis, removeFillers]);

  const previewCues = useMemo(() => {
    if (!activeStyling) return [];
    const wordsPerCue = activeStyling.template.layout.singleWordOnly ? 1 : 2;
    return buildCaptionCues(activeStyling.styledTokens, wordsPerCue);
  }, [activeStyling]);

  // Phase 5: Batch Hardware Export state
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchExportProgress | null>(null);
  const [exportResults, setExportResults] = useState<SingleClipExportResult[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResolution, setExportResolution] = useState<ExportResolution>("1080p");
  const [exportEngine, setExportEngine] = useState<"auto" | "ffmpeg" | "webcodecs">("auto");
  const exportAbortRef = useRef<AbortController | null>(null);

  // Memory cleanup for generated blob URLs
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());

  const registerBlobUrl = useCallback((url: string) => {
    if (url && url.startsWith("blob:")) {
      activeBlobUrlsRef.current.add(url);
    }
  }, []);

  const revokeAllBlobUrls = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    activeBlobUrlsRef.current.clear();
  }, []);

  // Revoke URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  // Load OPFS blob URL for zero-latency, CORS-free local video preview
  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;

    if (!ingestResult?.fileId) {
      setPreviewBlobUrl(null);
      return;
    }

    opfsVideoStorage
      .getVideoBlobUrl(ingestResult.fileId)
      .then((blobUrl) => {
        if (!active) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }
        if (blobUrl) {
          urlToRevoke = blobUrl;
          registerBlobUrl(blobUrl);
          setPreviewBlobUrl(blobUrl);
        } else {
          // Fallback to helper URL
          setPreviewBlobUrl(localHelperClient.getFileUrl(ingestResult.fileId));
        }
      })
      .catch(() => {
        if (active) {
          setPreviewBlobUrl(localHelperClient.getFileUrl(ingestResult.fileId));
        }
      });

    return () => {
      active = false;
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [ingestResult?.fileId, registerBlobUrl]);

  // Auto-seek preview player whenever active clip changes
  useEffect(() => {
    if (!selectedClipId) return;
    const clip = discoveredClips.find((c) => c.id === selectedClipId);
    if (clip && previewVideoRef.current) {
      previewVideoRef.current.currentTime = clip.start;
      setPreviewTime(clip.start);
    }
  }, [selectedClipId, discoveredClips]);

  // High-precision live background blur canvas update
  const updateBgCanvas = useCallback(() => {
    if (reframeMode !== "16:9_fit_blur") return;
    const vid = previewVideoRef.current;
    const canvas = bgCanvasRef.current;
    if (vid && canvas && vid.readyState >= 2) {
      const bgCtx = canvas.getContext("2d", { alpha: false });
      if (bgCtx) {
        bgCtx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [reframeMode]);

  // Update background blur canvas whenever reframeMode changes to fit_blur or clip changes
  useEffect(() => {
    updateBgCanvas();
  }, [reframeMode, selectedClipId, updateBgCanvas]);

  // High-precision 60fps playhead synchronization for frame-accurate captions & ambient blur
  useEffect(() => {
    if (!isPlayingPreview) return;
    let animId: number;

    const syncPlayhead = () => {
      const vid = previewVideoRef.current;
      if (vid && !vid.paused && !vid.ended) {
        const t = vid.currentTime;
        setPreviewTime(t);
        const activeClip = discoveredClips.find((c) => c.id === selectedClipId);
        if (activeClip && t >= activeClip.end) {
          vid.currentTime = activeClip.start;
          setPreviewTime(activeClip.start);
        }
        if (reframeMode === "16:9_fit_blur" && bgCanvasRef.current && vid.readyState >= 2) {
          const bgCtx = bgCanvasRef.current.getContext("2d", { alpha: false });
          if (bgCtx) {
            bgCtx.drawImage(vid, 0, 0, bgCanvasRef.current.width, bgCanvasRef.current.height);
          }
        }
      }
      if (isPlayingPreview) {
        animId = requestAnimationFrame(syncPlayhead);
      }
    };

    animId = requestAnimationFrame(syncPlayhead);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlayingPreview, selectedClipId, discoveredClips, reframeMode]);

  // Keyboard Shortcuts: Space (Play/Pause), Esc (Close Preview), ArrowLeft/Right (Seek +/- 2s)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!selectedClipId) return;

      const activeClip = discoveredClips.find((c) => c.id === selectedClipId);
      if (!activeClip) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (previewVideoRef.current) {
          if (isPlayingPreview) {
            previewVideoRef.current.pause();
          } else {
            if (
              previewVideoRef.current.currentTime < activeClip.start ||
              previewVideoRef.current.currentTime >= activeClip.end
            ) {
              previewVideoRef.current.currentTime = activeClip.start;
            }
            previewVideoRef.current.play().catch(() => {});
          }
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (previewVideoRef.current) {
          previewVideoRef.current.pause();
        }
        setSelectedClipId(null);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (previewVideoRef.current) {
          const newTime = Math.max(activeClip.start, previewVideoRef.current.currentTime - 2);
          previewVideoRef.current.currentTime = newTime;
          setPreviewTime(newTime);
        }
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (previewVideoRef.current) {
          const newTime = Math.min(activeClip.end, previewVideoRef.current.currentTime + 2);
          previewVideoRef.current.currentTime = newTime;
          setPreviewTime(newTime);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, discoveredClips, isPlayingPreview]);

  const handleToggleSelectForExport = (clipId: string) => {
    setSelectedForExport((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleSelectAllForExport = () => {
    if (selectedForExport.size === discoveredClips.length) {
      setSelectedForExport(new Set());
    } else {
      setSelectedForExport(new Set(discoveredClips.map((c) => c.id)));
    }
  };

  const handleStartBatchExport = async (clipsToExport?: ClipCandidate[]) => {
    if (!ingestResult) return;
    const targetClips = clipsToExport || discoveredClips.filter((c) => selectedForExport.has(c.id));
    if (targetClips.length === 0) return;

    revokeAllBlobUrls();
    setIsBatchExporting(true);
    setExportError(null);
    setExportResults([]);
    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const videoFile = (await opfsVideoStorage.getVideoFile(ingestResult.fileId)) || undefined;
      const batchRes = await exportBatchClips({
        clips: targetClips,
        fileId: ingestResult.fileId,
        videoUrl: previewBlobUrl || localHelperClient.getFileUrl(ingestResult.fileId),
        videoElement: (previewVideoRef.current && previewVideoRef.current.videoWidth > 0) ? previewVideoRef.current : undefined,
        videoFile,
        templateId: customTemplateId || undefined,
        enableKeywords,
        enableEmojis,
        removeFillers,
        reframeMode,
        resolution: exportResolution,
        preferEngine: exportEngine,
        onProgress: setBatchProgress,
        signal: controller.signal,
      });

      batchRes.results.forEach((r) => {
        if (r.mp4Url) registerBlobUrl(r.mp4Url);
      });

      setExportResults(batchRes.results);
      if (batchRes.errors.length > 0 && batchRes.results.length === 0) {
        setExportError(batchRes.errors[0].error);
      }
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes("cancelled")) {
        setExportError("Batch export cancelled by user.");
      } else {
        setExportError((err as Error)?.message || "Batch export failed");
      }
    } finally {
      setIsBatchExporting(false);
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
    }
  };

  const handleSaveAllResults = async () => {
    for (const result of exportResults) {
      try {
        await saveClipFilesToDisk(result);
      } catch (err) {
        console.warn("Save clip error:", err);
      }
    }
  };

  const handleDownloadSingleMp4 = async (res: SingleClipExportResult) => {
    if (res.mp4Blob) {
      await saveBlobToDisk(res.mp4Blob, {
        suggestedName: res.mp4FileName,
        mimeType: "video/mp4",
        extension: "mp4",
        description: "MPEG-4 Vertical Shorts Video",
      });
      return;
    }

    if (res.mp4Url) {
      try {
        const resp = await fetch(res.mp4Url);
        if (resp.ok) {
          const blob = await resp.blob();
          await saveBlobToDisk(blob, {
            suggestedName: res.mp4FileName,
            mimeType: "video/mp4",
            extension: "mp4",
            description: "MPEG-4 Vertical Shorts Video",
          });
          return;
        }
      } catch (err) {
        console.warn("Direct blob download failed, falling back to helper download URL:", err);
      }

      // Fallback: direct download with attachment header
      const downloadUrl = res.mp4Url.includes("download=1")
        ? res.mp4Url
        : `${res.mp4Url}${res.mp4Url.includes("?") ? "&" : "?"}download=1&name=${encodeURIComponent(res.mp4FileName)}`;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = res.mp4FileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);
    }
  };

  const handleStartIngest = async () => {
    if (!probeResult || !urlInput.trim()) return;
    setIsIngesting(true);
    setIngestError(null);
    setIngestResult(null);
    setDiscoveredClips([]);
    setExportResults([]);

    try {
      const result = await ClipsTranscriptionPipeline.ingestAndTranscribe({
        url: urlInput.trim(),
        probeResult,
        tierId: transcriptionTier,
        language: "auto",
        onProgress: setIngestProgress,
      });
      setIngestResult(result);

      // Auto find top 6 clips
      const clips = findClipCandidates({
        tokens: result.tokens,
        durationSeconds: result.durationSeconds,
        rmsPeaks: result.rmsPeaks,
        preset: selectedPreset,
        constraints: { topN: 6 },
      });
      setDiscoveredClips(clips);
      setSelectedForExport(new Set(clips.map((c) => c.id)));
      if (clips.length > 0) {
        setSelectedClipId(clips[0].id);
      }
    } catch (err: unknown) {
      setIngestError((err as Error).message || "Ingestion or transcription failed");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleAutoProcessPipeline = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || urlInput).trim();
    if (!targetUrl) return;

    setProbeError(null);
    setIngestError(null);

    const validation = parseAndValidateYouTubeUrl(targetUrl);
    if (!validation.isValid) {
      setProbeError(validation.error || "Invalid YouTube link");
      return;
    }

    if (!helperStatus?.ok) {
      setProbeError("Local companion helper is not running. Please start it with 'npm run helper'.");
      return;
    }

    if (!helperStatus.binaries.ytdlp.available || !helperStatus.binaries.ffmpeg.available) {
      setProbeError("yt-dlp or FFmpeg is missing. Please verify helper tooling status.");
      return;
    }

    setIsProbing(true);
    setProbeResult(null);
    setIngestResult(null);
    setDiscoveredClips([]);
    setExportResults([]);

    try {
      // Step 1: Probe video info
      const probed = await localHelperClient.probeVideo(targetUrl);
      setProbeResult(probed);
      setIsProbing(false);

      // Step 2: Auto Ingest and Transcribe
      setIsIngesting(true);
      const result = await ClipsTranscriptionPipeline.ingestAndTranscribe({
        url: targetUrl,
        probeResult: probed,
        tierId: transcriptionTier,
        language: "auto",
        onProgress: setIngestProgress,
      });
      setIngestResult(result);

      // Step 3: Discover & Rank Top Clips
      const clips = findClipCandidates({
        tokens: result.tokens,
        durationSeconds: result.durationSeconds,
        rmsPeaks: result.rmsPeaks,
        preset: selectedPreset,
        constraints: { topN: 6 },
      });
      setDiscoveredClips(clips);
      setSelectedForExport(new Set(clips.map((c) => c.id)));

      // Step 4: Auto select #1 Clip for 9:16 Shorts Dock
      if (clips.length > 0) {
        setSelectedClipId(clips[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "Automated pipeline failed";
      setProbeError(msg);
      setIngestError(msg);
    } finally {
      setIsProbing(false);
      setIsIngesting(false);
    }
  };

  const handlePresetChange = (preset: ClipStylePreset) => {
    setSelectedPreset(preset);
    if (ingestResult) {
      const clips = findClipCandidates({
        tokens: ingestResult.tokens,
        durationSeconds: ingestResult.durationSeconds,
        rmsPeaks: ingestResult.rmsPeaks,
        preset,
        constraints: { topN: 6 },
      });
      setDiscoveredClips(clips);
      setSelectedForExport(new Set(clips.map((c) => c.id)));
      if (clips.length > 0) {
        setSelectedClipId(clips[0].id);
      }
    }
  };

  const checkStatus = useCallback(async () => {
    setIsCheckingHelper(true);
    try {
      const status = await localHelperClient.checkStatus();
      setHelperStatus(status);
    } catch {
      setHelperStatus(null);
    } finally {
      setIsCheckingHelper(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleUpdateYtdlp = async () => {
    setIsUpdatingYtdlp(true);
    setUpdateMsg(null);
    try {
      const res = await localHelperClient.updateYtDlp();
      setUpdateMsg(res.message || "Updated successfully");
      await checkStatus();
    } catch (err: unknown) {
      setUpdateMsg((err as Error).message || "Failed to update yt-dlp");
    } finally {
      setIsUpdatingYtdlp(false);
    }
  };

  const handleProbe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    if (autoRunOnPaste) {
      return handleAutoProcessPipeline();
    }

    setProbeError(null);
    setProbeResult(null);

    const validation = parseAndValidateYouTubeUrl(urlInput);
    if (!validation.isValid) {
      setProbeError(validation.error || "Invalid YouTube link");
      return;
    }

    if (!helperStatus?.ok) {
      setProbeError("Local companion helper is not running. Please start it with 'npm run helper'.");
      return;
    }

    if (!helperStatus.binaries.ytdlp.available) {
      setProbeError("yt-dlp binary is missing on this machine. Please run the install command shown above.");
      return;
    }

    setIsProbing(true);
    try {
      const result = await localHelperClient.probeVideo(urlInput);
      setProbeResult(result);
    } catch (err: unknown) {
      setProbeError((err as Error).message || "Could not retrieve video information");
    } finally {
      setIsProbing(false);
    }
  };

  const ytdlpOk = helperStatus?.binaries.ytdlp.available ?? false;
  const ffmpegOk = helperStatus?.binaries.ffmpeg.available ?? false;
  const isHelperReady = helperStatus?.ok && ytdlpOk && ffmpegOk;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] transition-colors duration-150">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 sm:p-10 space-y-8">
        {/* Header with Rustic Neobrutalist Title */}
        <div className="pb-6 border-b-2 border-[var(--border-main)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#A3E635] border-2 border-[var(--border-main)] flex items-center justify-center shadow-[2px_2px_0px_var(--border-main)]">
                <Scissors className="w-5 h-5 text-[#142218] stroke-[2.5]" />
              </div>
              <h1 className="text-3xl font-black font-fraunces italic tracking-tight">
                Auto Shorts & Clips
              </h1>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1.5 font-medium">
              Paste YouTube links to automatically find high-potential moments, auto-reframe to 9:16, and apply viral Hinglish captions — 100% locally.
            </p>
          </div>

          {/* Helper Connection Status Badge */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-[var(--border-main)] text-xs font-black shadow-[2px_2px_0px_var(--border-main)] ${
                helperStatus?.ok
                  ? "bg-[#A3E635]/20 text-[#142218] dark:text-[#A3E635]"
                  : "bg-red-500/15 text-red-700 dark:text-red-400"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  helperStatus?.ok ? "bg-[#A3E635] animate-pulse" : "bg-red-500"
                }`}
              />
              <span>
                {isCheckingHelper && !helperStatus
                  ? "Checking Helper..."
                  : helperStatus?.ok
                  ? "Helper Connected (127.0.0.1:4321)"
                  : "Helper Offline"}
              </span>
            </div>

            <button
              onClick={checkStatus}
              disabled={isCheckingHelper}
              className="p-1.5 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] hover:bg-[var(--accent-lime)]/20 transition-all cursor-pointer"
              title="Refresh helper status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHelper ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Offline Helper Guide or Dependency Checklist */}
        {!helperStatus?.ok ? (
          <div className="p-6 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border-2 border-amber-600/30 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base">Companion Helper is Not Running</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  To download videos directly to your machine without any third-party cloud services or API fees, start the companion helper in a terminal:
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-dark-accent)] text-[#A3E635] font-mono text-xs flex items-center justify-between border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-white/50" />
                <span>npm run helper</span>
              </div>
              <button
                onClick={() => copyToClipboard("npm run helper", "npm-helper")}
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-sans font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedCmd === "npm-helper" ? (
                  <>
                    <Check className="w-3 h-3 text-[#A3E635]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              The helper binds strictly to <code className="font-bold">127.0.0.1:4321</code> and only accepts requests from this app.
            </p>
          </div>
        ) : isHelperReady && !showToolDetails ? (
          /* Sleek Zero-Setup Banner when helper and binaries are 100% ready */
          <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_var(--border-main)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#A3E635] text-[#142218] flex items-center justify-center font-black shrink-0 shadow-[1px_1px_0px_var(--border-main)]">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <p className="text-xs font-black text-[var(--text-main)] flex items-center gap-2">
                  <span>Zero Setup Needed — All Local Tools Connected</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#A3E635] text-[#142218] text-[9px] font-extrabold uppercase">
                    100% Local
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  yt-dlp v{helperStatus.binaries.ytdlp.version} &amp; FFmpeg {helperStatus.binaries.ffmpeg.version?.split(" ")[2] || "9.0.2"} ready in helper/bin. Simply paste any YouTube link below to automatically generate Shorts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                onClick={() => setShowToolDetails(true)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[var(--accent-lime)]/20 transition-all cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                Tool Details
              </button>
            </div>
          </div>
        ) : (
          /* Helper is Online: Dependency Checklist */
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Terminal className="w-4 h-4 text-[#A3E635]" />
                <span>Helper Environment &amp; Tooling</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  Cache: {(helperStatus.cache.totalBytes / (1024 * 1024)).toFixed(1)} MB /{" "}
                  {(helperStatus.cache.maxBytes / (1024 * 1024 * 1024)).toFixed(0)} GB ({helperStatus.cache.fileCount} files)
                </span>
                {isHelperReady && (
                  <button
                    onClick={() => setShowToolDetails(false)}
                    className="underline text-[11px] cursor-pointer hover:text-[var(--text-main)]"
                  >
                    Minimize
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* yt-dlp Status Card */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-card-elevated)] border-2 border-[var(--border-main)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ytdlpOk ? (
                      <CheckCircle2 className="w-4 h-4 text-[#A3E635]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-bold text-xs">yt-dlp</span>
                  </div>
                  {ytdlpOk && (
                    <button
                      onClick={handleUpdateYtdlp}
                      disabled={isUpdatingYtdlp}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--bg-canvas)] border border-[var(--border-main)] hover:bg-[var(--accent-lime)]/20 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isUpdatingYtdlp ? "animate-spin" : ""}`} />
                      <span>{isUpdatingYtdlp ? "Updating..." : "Update yt-dlp"}</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-[var(--text-muted)]">
                  {ytdlpOk ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Version: {helperStatus.binaries.ytdlp.version}
                    </span>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      <p className="text-red-600 dark:text-red-400 font-medium">Not found on machine</p>
                      <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-dark-accent)] text-[#A3E635] font-mono text-[10px]">
                        <span>winget install yt-dlp</span>
                        <button
                          onClick={() => copyToClipboard("winget install yt-dlp", "winget-ytdlp")}
                          className="text-white hover:text-[#A3E635]"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* FFmpeg Status Card */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-card-elevated)] border-2 border-[var(--border-main)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ffmpegOk ? (
                      <CheckCircle2 className="w-4 h-4 text-[#A3E635]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-bold text-xs">FFmpeg (Audio / Remux)</span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--text-muted)]">
                  {ffmpegOk ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Version: {helperStatus.binaries.ffmpeg.version?.split(" ")[2] || "Installed"}
                    </span>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      <p className="text-red-600 dark:text-red-400 font-medium">Not found on machine</p>
                      <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-dark-accent)] text-[#A3E635] font-mono text-[10px]">
                        <span>winget install Gyan.FFmpeg</span>
                        <button
                          onClick={() => copyToClipboard("winget install Gyan.FFmpeg", "winget-ffmpeg")}
                          className="text-white hover:text-[#A3E635]"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {updateMsg && (
              <p className="text-xs font-mono text-[#A3E635] bg-[var(--bg-dark-accent)] p-2 rounded-lg border border-[var(--border-main)]">
                {updateMsg}
              </p>
            )}
          </div>
        )}

        {/* URL Input Form & Automatic Pipeline Trigger */}
        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Download className="w-5 h-5 text-[#A3E635]" />
              <span>Paste YouTube Link</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Paste any standard YouTube video, Shorts URL, or youtu.be link to automatically download, transcribe, and produce viral 9:16 clips.
            </p>
          </div>

          <form onSubmit={handleProbe} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").trim();
                  if (pasted) {
                    setUrlInput(pasted);
                    if (autoRunOnPaste) {
                      const val = parseAndValidateYouTubeUrl(pasted);
                      if (val.isValid && isHelperReady) {
                        setTimeout(() => {
                          handleAutoProcessPipeline(pasted);
                        }, 200);
                      }
                    }
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#A3E635] shadow-[2px_2px_0px_var(--border-main)] transition-all font-mono text-xs sm:text-sm"
              />

              <button
                type="button"
                onClick={() => handleAutoProcessPipeline()}
                disabled={isProbing || isIngesting || !urlInput.trim()}
                className="neo-btn px-6 py-3 text-xs flex items-center justify-center gap-2 bg-[#A3E635] text-[#142218] hover:bg-[#8cd122] disabled:opacity-50 disabled:cursor-not-allowed shadow-[3px_3px_0px_var(--border-main)] font-black cursor-pointer shrink-0"
              >
                {isProbing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#142218]" />
                    <span>Inspecting Video...</span>
                  </>
                ) : isIngesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#142218]" />
                    <span>Generating Shorts...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#142218]" />
                    <span>⚡ Auto-Generate Shorts</span>
                  </>
                )}
              </button>
            </div>

            {/* Auto-Run Toggle & Manual Inspect option */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text-muted)] pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRunOnPaste}
                  onChange={(e) => setAutoRunOnPaste(e.target.checked)}
                  className="rounded accent-[#A3E635] cursor-pointer w-4 h-4"
                />
                <span className="font-bold text-[var(--text-main)]">Auto-start on paste</span>
                <span className="opacity-75 hidden sm:inline">(Runs full pipeline immediately upon pasting link)</span>
              </label>

              {!isProbing && !isIngesting && urlInput.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setAutoRunOnPaste(false);
                    setTimeout(() => handleProbe(), 0);
                  }}
                  className="text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer self-start sm:self-auto"
                >
                  Inspect info only (no auto-download)
                </button>
              )}
            </div>

            {/* Transcription Accuracy Tier Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#A3E635]" />
                <span className="font-bold text-[var(--text-main)]">Transcription Accuracy:</span>
              </div>
              <div className="inline-flex rounded-xl p-1 bg-[var(--bg-canvas)] border-2 border-[var(--border-main)] gap-1 shadow-[2px_2px_0px_var(--border-main)]">
                <button
                  type="button"
                  onClick={() => setTranscriptionTier("balanced")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transcriptionTier === "balanced"
                      ? "bg-[#A3E635] text-[#142218] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                  title="Whisper Base: High accuracy on code-mixed Hinglish & English dialogue"
                >
                  Balanced (Whisper Base 145MB)
                </button>
                <button
                  type="button"
                  onClick={() => setTranscriptionTier("best")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transcriptionTier === "best"
                      ? "bg-[#A3E635] text-[#142218] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                  title="Whisper Small: Maximum phonetic accuracy and dialect resolution"
                >
                  ⚡ Super Accurate (Whisper Small 465MB)
                </button>
                <button
                  type="button"
                  onClick={() => setTranscriptionTier("fast")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transcriptionTier === "fast"
                      ? "bg-[#A3E635] text-[#142218] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                  title="Whisper Tiny: Quickest preview speed for quick checks"
                >
                  Fast (Whisper Tiny 39MB)
                </button>
              </div>
            </div>

            {probeError && (
              <div className="p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{probeError}</span>
              </div>
            )}
          </form>

          {/* Probed Video Card */}
          {probeResult && (
            <div className="p-5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] flex flex-col md:flex-row gap-5 items-start">
              {probeResult.thumbnail && (
                <div className="w-full md:w-56 aspect-video rounded-lg overflow-hidden border-2 border-[var(--border-main)] shrink-0 shadow-[2px_2px_0px_var(--border-main)] bg-black">
                  <img
                    src={probeResult.thumbnail}
                    alt={probeResult.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <h3 className="font-extrabold text-base line-clamp-2">{probeResult.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {probeResult.uploader || "YouTube Creator"} •{" "}
                    {Math.floor(probeResult.duration / 60)}m {probeResult.duration % 60}s duration
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
                    Formats: {probeResult.availableQualities.join(", ")}
                  </span>
                  {probeResult.subtitlesAvailable.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#A3E635]/20 text-[#142218] dark:text-[#A3E635] border border-[var(--border-main)]">
                      Captions: {probeResult.subtitlesAvailable.slice(0, 4).join(", ")}
                    </span>
                  )}
                  {probeResult.warning && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-600/30 flex items-center gap-1">
                      <Info className="w-3 h-3" /> {probeResult.warning}
                    </span>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleStartIngest}
                    disabled={isIngesting}
                    className="neo-btn px-4 py-2 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#142218]" />
                        <span>Processing ({ingestProgress?.percent || 0}%)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#142218]" />
                        <span>Stream to OPFS & Transcribe</span>
                      </>
                    )}
                  </button>

                  <div className="text-[11px] font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                    <span>100% on-device Whisper (No API costs)</span>
                  </div>
                </div>

                {/* Live Pipeline Stepper */}
                {isIngesting && ingestProgress && (
                  <div className="mt-4 p-4 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2 text-[#A3E635]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{ingestProgress.message}</span>
                      </span>
                      <span>{ingestProgress.percent}%</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-main)] overflow-hidden">
                      <div
                        className="h-full bg-[#A3E635] transition-all duration-300"
                        style={{ width: `${ingestProgress.percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>Stage: {ingestProgress.stage}</span>
                      {ingestProgress.detail && <span>Device: {ingestProgress.detail.toUpperCase()}</span>}
                    </div>
                  </div>
                )}

                {ingestError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{ingestError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ingestion & Transcription Result Card */}
          {ingestResult && (
            <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border-2 border-[#A3E635] shadow-[4px_4px_0px_var(--border-main)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[var(--border-main)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#A3E635] border-1.5 border-[var(--border-main)] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[#142218]" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Ingested into OPFS & Transcribed</h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Saved in browser OPFS storage • Whisper execution on {ingestResult.deviceUsed.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
                    {ingestResult.tokens.length} words
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
                    {Math.round(ingestResult.durationSeconds)}s audio
                  </span>
                </div>
              </div>

              {/* Creator Proper Noun Badges */}
              {ingestResult.properNouns.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[var(--text-muted)]">Creator Captions Vocabulary Hints:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingestResult.properNouns.slice(0, 10).map((pn, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#A3E635]/15 text-[#142218] dark:text-[#A3E635] border border-[var(--border-main)]"
                      >
                        {pn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Word Tokens Sample Preview */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-[var(--text-muted)]">Word Timestamps Preview (First 40 words):</p>
                <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {ingestResult.tokens.slice(0, 40).map((tok) => (
                    <span
                      key={tok.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] text-xs font-medium"
                      title={`${tok.start.toFixed(2)}s - ${tok.end.toFixed(2)}s`}
                    >
                      <span>{tok.text}</span>
                      <span className="text-[9px] text-[var(--text-muted)] font-mono">
                        {tok.start.toFixed(1)}s
                      </span>
                    </span>
                  ))}
                  {ingestResult.tokens.length > 40 && (
                    <span className="text-xs text-[var(--text-muted)] font-bold self-center ml-2">
                      + {ingestResult.tokens.length - 40} more words
                    </span>
                  )}
                </div>
              </div>

              {/* Phase 3: Discovered Clips Grid */}
              <div className="pt-4 border-t-2 border-[var(--border-main)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-sm flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-[#A3E635]" />
                      <span>Discovered Clip Candidates ({discoveredClips.length})</span>
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Ranked by Clip Potential with sentence boundary snapping and de-duplication (IoU &lt; 0.25).
                    </p>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
                    {(["balanced", "informative", "funny", "dramatic"] as ClipStylePreset[]).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetChange(preset)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition-all cursor-pointer ${
                          selectedPreset === preset
                            ? "bg-[#A3E635] text-[#142218] shadow-[1px_1px_0px_var(--border-main)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {discoveredClips.length > 0 ? (
                  <div className="space-y-6">
                    {/* Batch Export Control Bar */}
                    <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0px_var(--border-main)]">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSelectAllForExport}
                          className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-main)] hover:text-[#A3E635] transition-all cursor-pointer"
                        >
                          {selectedForExport.size === discoveredClips.length ? (
                            <CheckSquare className="w-4 h-4 text-[#A3E635]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                          <span>Select All ({discoveredClips.length})</span>
                        </button>
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          ({selectedForExport.size} selected)
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Resolution select */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Res:</span>
                          <select
                            value={exportResolution}
                            onChange={(e) => setExportResolution(e.target.value as any)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-bold"
                          >
                            <option value="1080p">1080x1920 (FHD)</option>
                            <option value="720p">720x1280 (HD)</option>
                          </select>
                        </div>

                        {/* Engine select */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Engine:</span>
                          <select
                            value={exportEngine}
                            onChange={(e) => setExportEngine(e.target.value as any)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-bold"
                          >
                            <option value="auto">Fast Local FFmpeg (Smooth &amp; Instant)</option>
                            <option value="ffmpeg">Force Companion FFmpeg</option>
                            <option value="webcodecs">GPU WebCodecs (In-Browser)</option>
                          </select>
                        </div>

                        {/* Export button */}
                        <button
                          onClick={() => handleStartBatchExport()}
                          disabled={isBatchExporting || selectedForExport.size === 0}
                          className="px-4 py-2 rounded-xl bg-[#A3E635] text-[#142218] font-black text-xs shadow-[3px_3px_0px_var(--border-main)] hover:shadow-[1px_1px_0px_var(--border-main)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isBatchExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>Export {selectedForExport.size} Shorts (MP4 + Subtitles)</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {discoveredClips.map((clip) => {
                        const styling = selectCaptionTemplate(clip, {
                          templateId: clip.customTemplateId || (clip.id === selectedClipId && customTemplateId ? customTemplateId : undefined),
                          enableKeywords: clip.customEnableKeywords ?? enableKeywords,
                          enableEmojis: clip.customEnableEmojis ?? enableEmojis,
                          removeFillers: clip.customRemoveFillers ?? removeFillers,
                        });
                        const isSelected = clip.id === selectedClipId;
                        const isChecked = selectedForExport.has(clip.id);

                        return (
                          <div
                            key={clip.id}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                              isSelected
                                ? "bg-[var(--bg-card-elevated)] border-[#A3E635] shadow-[4px_4px_0px_#A3E635]"
                                : "bg-[var(--bg-card)] border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5"
                            }`}
                            onClick={() => {
                              setSelectedClipId(clip.id);
                              setCustomTemplateId(clip.customTemplateId || null);
                              if (clip.customReframeMode) setReframeMode(clip.customReframeMode);
                              if (clip.customEnableKeywords !== undefined) setEnableKeywords(clip.customEnableKeywords);
                              if (clip.customEnableEmojis !== undefined) setEnableEmojis(clip.customEnableEmojis);
                              if (clip.customRemoveFillers !== undefined) setRemoveFillers(clip.customRemoveFillers);
                              if (previewVideoRef.current) {
                                previewVideoRef.current.currentTime = clip.start;
                              }
                            }}
                          >
                            <div className="space-y-2">
                              {/* Header & Score with selection checkbox */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelectForExport(clip.id);
                                    }}
                                    className="p-0.5 rounded hover:bg-[var(--bg-panel)] text-[var(--text-main)] cursor-pointer"
                                    title={isChecked ? "Deselect for Batch Export" : "Select for Batch Export"}
                                  >
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-[#A3E635]" />
                                    ) : (
                                      <Square className="w-4 h-4 text-[var(--text-muted)]" />
                                    )}
                                  </button>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[var(--bg-panel)] border border-[var(--border-main)]">
                                    Clip #{clip.index}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#A3E635]/20 text-[#142218] dark:text-[#A3E635] border border-[var(--border-main)] text-[11px] font-black">
                                  <span>Potential: {clip.score}/100</span>
                                </div>
                              </div>

                              <h5 className="font-extrabold text-xs line-clamp-2">
                                "{clip.headline}"
                              </h5>

                              {/* Timestamps & Duration */}
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center justify-between font-mono">
                                <span>
                                  {Math.floor(clip.start / 60)}:{(Math.floor(clip.start % 60)).toString().padStart(2, "0")} -{" "}
                                  {Math.floor(clip.end / 60)}:{(Math.floor(clip.end % 60)).toString().padStart(2, "0")}
                                </span>
                                <span className="font-bold text-[var(--text-main)]">{Math.round(clip.duration)}s</span>
                              </div>

                              {/* Phase 4: Recommended Caption Preset */}
                              <div className="p-2 rounded-lg bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)] space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold flex items-center gap-1 text-[var(--text-main)]">
                                    <Palette className="w-3 h-3 text-[#A3E635]" />
                                    <span>{styling.template.name}</span>
                                  </span>
                                  <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                                    {styling.template.vibe}
                                  </span>
                                </div>
                                <p className="text-[9px] text-[var(--text-muted)] line-clamp-1 italic">
                                  {styling.selectionReason}
                                </p>
                              </div>

                              {/* Phase 4: Reframe & Enrichment Badges */}
                              <div className="flex flex-wrap gap-1">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 flex items-center gap-1">
                                  <Crop className="w-2.5 h-2.5" />
                                  <span>9:16 Face-Tracked</span>
                                </span>
                                {styling.highlightCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>{styling.highlightCount} Keywords</span>
                                  </span>
                                )}
                                {styling.emojiCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                    {styling.emojiCount} Emojis
                                  </span>
                                )}
                                {styling.fillerWordsRemoved > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                    {styling.fillerWordsRemoved} Fillers cut
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[var(--text-muted)]">
                                Hook: <span className="capitalize text-[var(--text-main)]">{clip.hookType}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClipId(clip.id);
                                  setCustomTemplateId(null);
                                  if (previewVideoRef.current) {
                                    previewVideoRef.current.currentTime = clip.start;
                                  }
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-[#A3E635] text-[#142218]"
                                    : "bg-[var(--bg-card-elevated)] hover:bg-[#A3E635] hover:text-[#142218] border border-[var(--border-main)]"
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                <span>{isSelected ? "Active Preview" : "Inspect 9:16"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Phase 4: Interactive 9:16 Shorts Studio Preview Dock */}
                    {activeClip && ingestResult && activeStyling && (() => {
                      const videoSourceUrl = previewBlobUrl || localHelperClient.getFileUrl(ingestResult.fileId);
                      const activeCue = previewCues.find((c) => previewTime >= c.start && previewTime <= c.displayEnd);

                      return (
                        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[5px_5px_0px_var(--border-main)] space-y-5">
                          {/* Top Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-[var(--border-main)]">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#A3E635] text-[#142218] border border-[var(--border-main)]">
                                Clip #{activeClip.index} Preview
                              </span>
                              <h4 className="font-extrabold text-sm line-clamp-1">
                                "{activeClip.headline}"
                              </h4>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                                {previewTime.toFixed(1)}s / {activeClip.end.toFixed(1)}s
                              </span>
                              <button
                                onClick={() => setSelectedClipId(null)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--bg-card-elevated)] border border-[var(--border-main)] hover:bg-red-500/20 hover:text-red-600 transition-all cursor-pointer"
                              >
                                Close
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* 9:16 Shorts Phone Viewport (Left 5 Cols) */}
                            <div className="lg:col-span-5 flex flex-col items-center">
                              <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border-4 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] flex items-center justify-center">
                                {/* Modern YouTube Shorts Fit + Blur Ambient Backdrop */}
                                {reframeMode === "16:9_fit_blur" && (
                                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    <canvas
                                      ref={bgCanvasRef}
                                      width={180}
                                      height={320}
                                      className="w-full h-full object-cover scale-125 filter blur-xl brightness-60 contrast-110"
                                    />
                                    {/* Ambient dark scrim */}
                                    <div className="absolute inset-0 bg-black/25 pointer-events-none" />
                                  </div>
                                )}

                                {/* HTML Video Player */}
                                <video
                                  ref={previewVideoRef}
                                  src={videoSourceUrl}
                                  crossOrigin="anonymous"
                                  preload="auto"
                                  className={`w-full transition-all duration-200 ${
                                    reframeMode === "9:16_auto"
                                      ? "h-full object-cover object-center"
                                      : reframeMode === "16:9_fit_blur"
                                      ? "relative z-10 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]"
                                      : "h-full object-contain"
                                  }`}
                                  playsInline
                                  onLoadedMetadata={(e) => {
                                    const vid = e.currentTarget;
                                    if (activeClip && (vid.currentTime < activeClip.start || vid.currentTime >= activeClip.end)) {
                                      vid.currentTime = activeClip.start;
                                    }
                                    updateBgCanvas();
                                  }}
                                  onSeeked={updateBgCanvas}
                                  onTimeUpdate={(e) => {
                                    const t = (e.target as HTMLVideoElement).currentTime;
                                    setPreviewTime(t);
                                    if (t >= activeClip.end) {
                                      (e.target as HTMLVideoElement).currentTime = activeClip.start;
                                    }
                                    updateBgCanvas();
                                  }}
                                  onPlay={() => setIsPlayingPreview(true)}
                                  onPause={() => setIsPlayingPreview(false)}
                                  onError={() => {
                                    if (previewBlobUrl && ingestResult) {
                                      console.warn("OPFS preview blob failed, falling back to helper stream URL");
                                      setPreviewBlobUrl(localHelperClient.getFileUrl(ingestResult.fileId));
                                    }
                                  }}
                                />

                                {/* 9:16 Reframed Live Captions Overlay */}
                                <div className="absolute inset-x-3 bottom-14 z-20 flex flex-col items-center justify-center pointer-events-none text-center">
                                  {activeCue && activeCue.words.length > 0 ? (
                                    <div
                                      style={{
                                        backgroundColor: activeStyling.template.box?.enabled && activeStyling.template.box?.bgColor
                                          ? activeStyling.template.box.bgColor
                                          : "transparent",
                                        borderRadius: activeStyling.template.box?.enabled && activeStyling.template.box?.borderRadius
                                          ? `${activeStyling.template.box.borderRadius}px`
                                          : undefined,
                                        padding: activeStyling.template.box?.enabled ? "8px 14px" : "0px",
                                      }}
                                      className="flex flex-wrap justify-center items-center gap-2 transition-all duration-75 pointer-events-none"
                                    >
                                      {activeCue.words.map((word, wIdx) => {
                                        const isSpeakingNow = previewTime >= word.start && previewTime <= word.end;
                                        const hasPassed = previewTime > word.end;
                                        const isUpcoming = previewTime < word.start;
                                        const isSingleWord = activeStyling.template.layout.singleWordOnly;

                                        // In single-word mode: ONLY show the currently spoken word
                                        if (isSingleWord && !isSpeakingNow) return null;
                                        // Frame-accurate timing: do NOT display upcoming words before the audio speaks them
                                        if (isUpcoming) return null;

                                        const isKeyword = word.isKeyword;

                                        const textColor = isSpeakingNow
                                          ? (activeStyling.template.colors.activeWordText || "#FFE600")
                                          : isKeyword
                                          ? (activeStyling.template.colors.secondaryText || "#38BDF8")
                                          : (activeStyling.template.colors.primaryText || "#FFFFFF");

                                        const textShadow = isSpeakingNow
                                          ? (activeStyling.template.colors.shadowColor
                                              ? `0 0 14px ${activeStyling.template.colors.shadowColor}, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px #000000`
                                              : "0 0 12px #FFE600, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px #000000")
                                          : "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.95)";

                                        return (
                                          <span
                                            key={wIdx}
                                            style={{
                                              color: textColor,
                                              fontFamily: activeStyling.template.typography.primaryFont || "Impact, sans-serif",
                                              textTransform: (activeStyling.template.typography.textTransform as any) || "uppercase",
                                              fontSize: isSpeakingNow ? "1.25rem" : "1.12rem",
                                              fontWeight: activeStyling.template.typography.primaryWeight || "900",
                                              textShadow,
                                              opacity: isSpeakingNow ? 1.0 : hasPassed ? 0.95 : 0.75,
                                              transform: isSpeakingNow ? "scale(1.12)" : "scale(1.0)",
                                            }}
                                            className="inline-block transition-transform duration-75 origin-center select-none"
                                          >
                                            {word.text}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Reframed Viewport Mode Indicator */}
                                <div className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-black text-white border border-white/20 flex items-center gap-1">
                                  <Crop className="w-2.5 h-2.5 text-[#A3E635]" />
                                  <span>{reframeMode === "9:16_auto" ? "9:16 Reframed (Face-Tracked)" : reframeMode === "16:9_fit_blur" ? "9:16 Fit + Ambient Blur" : reframeMode}</span>
                                </div>

                                {/* Floating Play/Pause Center Overlay */}
                                <button
                                  onClick={() => {
                                    if (previewVideoRef.current) {
                                      if (isPlayingPreview) {
                                        previewVideoRef.current.pause();
                                      } else {
                                        if (previewVideoRef.current.currentTime < activeClip.start || previewVideoRef.current.currentTime >= activeClip.end) {
                                          previewVideoRef.current.currentTime = activeClip.start;
                                        }
                                        previewVideoRef.current.play();
                                      }
                                    }
                                  }}
                                  className="absolute inset-0 z-20 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-[#A3E635] text-white hover:text-[#142218] flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100 border border-white/30"
                                >
                                  {isPlayingPreview ? (
                                    <Pause className="w-5 h-5 fill-current" />
                                  ) : (
                                    <Play className="w-5 h-5 fill-current ml-0.5" />
                                  )}
                                </button>
                              </div>

                              {/* Playback Controls */}
                              <div className="w-full max-w-[280px] mt-3 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => {
                                    if (previewVideoRef.current) {
                                      previewVideoRef.current.currentTime = activeClip.start;
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-[var(--bg-card-elevated)] border border-[var(--border-main)] hover:bg-[#A3E635] hover:text-[#142218] transition-all cursor-pointer"
                                >
                                  Restart
                                </button>
                                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                  {Math.round(activeClip.duration)}s Short
                                </span>
                              </div>

                              {/* Keyboard Shortcuts Hint */}
                              <div className="w-full max-w-[280px] mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-center gap-3 text-[10px] text-[var(--text-muted)] font-medium">
                                <span title="Press Space to toggle playback"><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-card-elevated)] border border-[var(--border-main)] font-mono font-bold text-[9px]">Space</kbd> Play</span>
                                <span title="Press Left/Right arrows to seek 2 seconds"><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-card-elevated)] border border-[var(--border-main)] font-mono font-bold text-[9px]">← / →</kbd> 2s</span>
                                <span title="Press Escape to close preview"><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-card-elevated)] border border-[var(--border-main)] font-mono font-bold text-[9px]">Esc</kbd> Exit</span>
                              </div>
                            </div>

                            {/* Controls & Preset Switcher (Right 7 Cols) */}
                            <div className="lg:col-span-7 space-y-4">
                              {/* 1. Reframe Mode Controls */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                  <Crop className="w-3.5 h-3.5 text-[#A3E635]" />
                                  <span>Aspect Ratio Reframing</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { id: "9:16_auto", label: "9:16 Face-Tracked", desc: "Auto-centers speaker" },
                                    { id: "16:9_fit_blur", label: "Fit Blur (9:16)", desc: "Blurred background" },
                                    { id: "original", label: "Source Ratio", desc: "No reframing" },
                                  ].map((mode) => (
                                    <button
                                      key={mode.id}
                                      onClick={() => {
                                        const m = mode.id as any;
                                        setReframeMode(m);
                                        if (selectedClipId) {
                                          setDiscoveredClips((prev) =>
                                            prev.map((c) => (c.id === selectedClipId ? { ...c, customReframeMode: m } : c))
                                          );
                                        }
                                      }}
                                      className={`p-2.5 rounded-xl text-left border-2 transition-all cursor-pointer ${
                                        reframeMode === mode.id
                                          ? "bg-[#A3E635]/15 border-[#A3E635] text-[var(--text-main)] shadow-[2px_2px_0px_#A3E635]"
                                          : "bg-[var(--bg-card-elevated)] border-[var(--border-main)] text-[var(--text-muted)] hover:border-[#A3E635]"
                                      }`}
                                    >
                                      <p className="text-xs font-black">{mode.label}</p>
                                      <p className="text-[10px] opacity-80">{mode.desc}</p>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 2. Caption Template Selection */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5 text-[#A3E635]" />
                                    <span>Caption Style Preset</span>
                                  </span>
                                  <span className="text-[10px] text-[#A3E635] font-bold">
                                    Active: {activeStyling.template.name}
                                  </span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {[
                                    { id: "behind_you_white", name: "Clean White", badge: "VIRAL" },
                                    { id: "alex_hormozi_punch", name: "Hormozi Box", badge: "PUNCH" },
                                    { id: "mr_beast_bold", name: "MrBeast Squash", badge: "ENERGY" },
                                    { id: "die_cut_sticker", name: "Die-Cut Sticker", badge: "COMEDY" },
                                    { id: "sunshine_impact_yellow", name: "Sunshine Impact", badge: "CINEMA" },
                                    { id: "neon_sticker_lime", name: "Neon Lime", badge: "NEON" },
                                    { id: "devanagari_calligraphy_bold", name: "Devanagari Royal", badge: "HINDI" },
                                    { id: "clean_sub_inter", name: "Clean Inter", badge: "MINIMAL" },
                                  ].map((preset) => {
                                    const isChosen = activeStyling.template.id === preset.id;
                                    return (
                                      <button
                                        key={preset.id}
                                        onClick={() => {
                                          setCustomTemplateId(preset.id);
                                          if (selectedClipId) {
                                            setDiscoveredClips((prev) =>
                                              prev.map((c) =>
                                                c.id === selectedClipId ? { ...c, customTemplateId: preset.id } : c
                                              )
                                            );
                                          }
                                        }}
                                        className={`p-2 rounded-xl text-left border-2 transition-all cursor-pointer ${
                                          isChosen
                                            ? "bg-[#A3E635] text-[#142218] border-[#142218] shadow-[2px_2px_0px_var(--border-main)] font-black"
                                            : "bg-[var(--bg-card-elevated)] border-[var(--border-main)] hover:border-[#A3E635] text-[var(--text-main)]"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black truncate">{preset.name}</span>
                                          <span className="text-[8px] uppercase font-bold px-1 rounded bg-black/10">
                                            {preset.badge}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 3. Smart AI / Creator Enrichment Toggles */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" />
                                  <span>Creator Smart Enrichment</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <button
                                    onClick={() => {
                                      const nextVal = !enableKeywords;
                                      setEnableKeywords(nextVal);
                                      if (selectedClipId) {
                                        setDiscoveredClips((prev) =>
                                          prev.map((c) =>
                                            c.id === selectedClipId ? { ...c, customEnableKeywords: nextVal } : c
                                          )
                                        );
                                      }
                                    }}
                                    className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                      enableKeywords
                                        ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-bold"
                                        : "bg-[var(--bg-card-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {enableKeywords ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    <span className="text-xs">Keywords ({activeStyling.highlightCount})</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      const nextVal = !enableEmojis;
                                      setEnableEmojis(nextVal);
                                      if (selectedClipId) {
                                        setDiscoveredClips((prev) =>
                                          prev.map((c) =>
                                            c.id === selectedClipId ? { ...c, customEnableEmojis: nextVal } : c
                                          )
                                        );
                                      }
                                    }}
                                    className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                      enableEmojis
                                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold"
                                        : "bg-[var(--bg-card-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {enableEmojis ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    <span className="text-xs">Emojis ({activeStyling.emojiCount})</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      const nextVal = !removeFillers;
                                      setRemoveFillers(nextVal);
                                      if (selectedClipId) {
                                        setDiscoveredClips((prev) =>
                                          prev.map((c) =>
                                            c.id === selectedClipId ? { ...c, customRemoveFillers: nextVal } : c
                                          )
                                        );
                                      }
                                    }}
                                    className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                                      removeFillers
                                        ? "bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 font-bold"
                                        : "bg-[var(--bg-card-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {removeFillers ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    <span className="text-xs">Filter Fillers ({activeStyling.fillerWordsRemoved})</span>
                                  </button>
                                </div>
                              </div>

                              {/* 4. Word-by-Word Styled Token Stream */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                  Styled Captions Preview ({activeStyling.styledTokens.length} words):
                                </label>
                                <div className="p-3 rounded-xl bg-[var(--bg-card-elevated)] border-2 border-[var(--border-subtle)] flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                  {activeStyling.styledTokens.map((t, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.5 rounded text-xs transition-all ${
                                        t.isKeyword
                                          ? "bg-amber-400 text-black font-black shadow-xs"
                                          : "bg-[var(--bg-panel)] text-[var(--text-main)] border border-[var(--border-subtle)] font-medium"
                                      }`}
                                      title={`${t.start.toFixed(2)}s - ${t.end.toFixed(2)}s`}
                                    >
                                      {t.text}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Phase 5 Call to Action */}
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-xs text-[var(--text-muted)] font-medium">
                                  Reframed & Styled — Ready for Batch Hardware Export
                                </span>
                                <button
                                  className="px-4 py-2.5 rounded-xl bg-[#A3E635] text-[#142218] font-extrabold text-xs shadow-[3px_3px_0px_var(--border-main)] hover:shadow-[1px_1px_0px_var(--border-main)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                  disabled={isBatchExporting}
                                  onClick={() => {
                                    handleStartBatchExport([activeClip]);
                                  }}
                                >
                                  {isBatchExporting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}
                                  <span>{isBatchExporting ? "Exporting..." : "Export This 9:16 Short"}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Phase 5: Batch Hardware Export Live Status & Completed Results */}
                    {(isBatchExporting || exportResults.length > 0 || exportError) && (
                      <div className="p-5 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[5px_5px_0px_var(--border-main)] space-y-4">
                        {/* Exporting In Progress */}
                        {isBatchExporting && batchProgress && (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 text-[#A3E635] animate-spin" />
                                <div>
                                  <h4 className="font-extrabold text-sm">
                                    Exporting Clip {batchProgress.currentClipIndex} of {batchProgress.totalClips}...
                                  </h4>
                                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                                    "{batchProgress.currentClipTitle}"
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={handleCancelExport}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30 hover:bg-red-500/25 transition-all cursor-pointer self-start sm:self-auto"
                              >
                                Cancel Export
                              </button>
                            </div>

                            {/* Dual Progress Bars */}
                            <div className="space-y-3 p-3.5 rounded-xl bg-[var(--bg-card-elevated)] border border-[var(--border-subtle)]">
                              {/* Current Clip Progress */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className="text-[var(--text-muted)]">Current Clip Encoding:</span>
                                  <span className="font-mono">{batchProgress.currentClipPercent}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-[var(--bg-panel)] overflow-hidden border border-[var(--border-subtle)]">
                                  <div
                                    className="h-full bg-emerald-500 transition-all duration-200"
                                    style={{ width: `${batchProgress.currentClipPercent}%` }}
                                  />
                                </div>
                              </div>

                              {/* Overall Batch Progress */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className="text-[var(--text-muted)]">Total Batch Progress:</span>
                                  <span className="font-mono text-[#A3E635]">{batchProgress.overallPercent}%</span>
                                </div>
                                <div className="w-full h-3 rounded-full bg-[var(--bg-panel)] overflow-hidden border border-[var(--border-subtle)]">
                                  <div
                                    className="h-full bg-[#A3E635] transition-all duration-200"
                                    style={{ width: `${batchProgress.overallPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Export Errors */}
                        {exportError && (
                          <div className="p-3 rounded-xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-between text-xs text-red-600 dark:text-red-400 font-bold">
                            <span>{exportError}</span>
                            <button
                              onClick={() => setExportError(null)}
                              className="text-xs hover:underline cursor-pointer ml-3"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        {/* Completed Export Results */}
                        {exportResults.length > 0 && (
                          <div className="space-y-4 pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CheckCheck className="w-5 h-5 text-[#A3E635]" />
                                <div>
                                  <h4 className="font-extrabold text-sm text-[var(--text-main)]">
                                    Batch Export Complete ({exportResults.length} Shorts)
                                  </h4>
                                  <p className="text-[11px] text-[var(--text-muted)]">
                                    Finished 9:16 vertical MP4s with burned-in captions, plus synchronized .srt &amp; .vtt sidecars.
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={handleSaveAllResults}
                                className="px-4 py-2 rounded-xl bg-[#A3E635] text-[#142218] font-black text-xs shadow-[2px_2px_0px_var(--border-main)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                              >
                                <HardDrive className="w-4 h-4" />
                                <span>Save All to Disk</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {exportResults.map((res) => (
                                <div
                                  key={res.clipId}
                                  className="p-3.5 rounded-xl bg-[var(--bg-card-elevated)] border-2 border-[var(--border-main)] flex flex-col justify-between space-y-2.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black">Clip #{res.clipIndex}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#A3E635]/20 text-[#142218] dark:text-[#A3E635] border border-[var(--border-main)]">
                                      {res.engineUsed === "webcodecs" ? "WebCodecs GPU" : "FFmpeg Engine"}
                                    </span>
                                  </div>

                                  <p className="text-xs font-mono text-[var(--text-muted)] truncate" title={res.mp4FileName}>
                                    {res.mp4FileName}
                                  </p>

                                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
                                    <button
                                      onClick={() => handleDownloadSingleMp4(res)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[#A3E635] text-[#142218] font-bold text-xs flex items-center gap-1.5 hover:shadow-xs transition-all cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>MP4 Video</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        const blob = new Blob([res.srtContent], { type: "text/plain;charset=utf-8" });
                                        saveBlobToDisk(blob, {
                                          suggestedName: res.srtFileName,
                                          mimeType: "text/plain",
                                          extension: "srt",
                                          description: "SRT Subtitles",
                                        });
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-bold flex items-center gap-1.5 hover:bg-[var(--bg-card)] transition-all cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>SRT</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        const blob = new Blob([res.vttContent], { type: "text/vtt;charset=utf-8" });
                                        saveBlobToDisk(blob, {
                                          suggestedName: res.vttFileName,
                                          mimeType: "text/vtt",
                                          extension: "vtt",
                                          description: "VTT Subtitles",
                                        });
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-bold flex items-center gap-1.5 hover:bg-[var(--bg-card)] transition-all cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>VTT</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    Click "Stream to OPFS & Transcribe" above to discover high-potential clips automatically.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
