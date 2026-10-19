"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Eraser,
  Sparkles,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Maximize2,
  Columns,
  RefreshCw,
  Plus,
  Trash2,
  FileVideo,
  FileImage,
  Cpu,
  Layers,
  ArrowRight,
  Wand2,
  Brain,
  Database,
  Eye,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Bot,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  WATERMARK_PRESETS,
  type WatermarkPresetId,
  type NormalizedROI,
  type InpaintOptions,
  type WatermarkDetectionResult,
  type LearnedLogoData,
} from "@/lib/watermark/types";
import {
  inpaintCanvasROIs,
  clampNormalizedROI,
  denormalizeROI,
} from "@/lib/watermark/inpainter";
import {
  autoDetectMediaWatermark,
  getAspectRatioCategory,
  getDynamicRoisForPreset,
  scanCornerWatermarks,
} from "@/lib/watermark/detector";
import {
  processWatermarkVideo,
  processWatermarkImage,
  downloadBlob,
  sampleVideoFrames,
  type WatermarkProgress,
} from "@/lib/watermark/videoProcessor";
import {
  AI_WATERMARK_DATASET,
  getAllLearnedLogoProfiles,
  saveLearnedLogoProfile,
} from "@/lib/watermark/logoDataset";
import {
  generateWatermarkMask,
  learnWatermarkFromClips,
} from "@/lib/watermark/logoMasker";
import { localHelperClient } from "@/lib/clips/helperClient";

/**
 * Renders a crisp 16x16 pixel micro-matrix preview of an AI logo glyph footprint.
 */
function GlyphMatrixPreview({
  matrix16,
  className = "",
}: {
  matrix16: number[];
  className?: string;
}) {
  if (!matrix16 || matrix16.length !== 256) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
        gap: "1px",
      }}
      className={`p-1 bg-[#0d1410] rounded border border-[var(--border-main)] w-14 h-14 shrink-0 shadow-sm ${className}`}
      title="16x16 Normalized AI Logo Footprint"
    >
      {matrix16.map((val, i) => (
        <div
          key={i}
          style={{
            backgroundColor: val > 0.3 ? "#A3E635" : "transparent",
            borderRadius: "0.5px",
          }}
        />
      ))}
    </div>
  );
}

export default function WatermarkRemoverPage() {
  // Media State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "image" | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 720,
  });

  // Detection & Analysis State
  const [detectionResult, setDetectionResult] = useState<WatermarkDetectionResult | null>(null);

  // Presets & ROIs
  const [selectedPreset, setSelectedPreset] = useState<WatermarkPresetId>("kling");
  const [rois, setRois] = useState<NormalizedROI[]>(WATERMARK_PRESETS.kling.defaultRois);
  const [activeRoiIndex, setActiveRoiIndex] = useState<number>(0);

  // Inpainting Options
  const [featherRadius, setFeatherRadius] = useState<number>(6);
  const [preserveGrain, setPreserveGrain] = useState<boolean>(true);
  const [grainAmount, setGrainAmount] = useState<number>(0.15);
  const [blendStrength, setBlendStrength] = useState<number>(1.0);
  const [useShapeMask, setUseShapeMask] = useState<boolean>(true);
  const [maskSensitivity, setMaskSensitivity] = useState<number>(0.50);

  // Playback & Split View
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [splitPosition, setSplitPosition] = useState<number>(0.5); // 0.0 to 1.0
  const [showSplitView, setShowSplitView] = useState<boolean>(true);

  // AI Logo Knowledge Base & Multi-Clip Learning State
  const [learnedLogos, setLearnedLogos] = useState<Record<string, LearnedLogoData>>({});
  const [isLearningFromClips, setIsLearningFromClips] = useState<boolean>(false);
  const [learningStatus, setLearningStatus] = useState<string | null>(null);
  const [learnedSilhouetteUrl, setLearnedSilhouetteUrl] = useState<string | null>(null);
  const [showSilhouetteOverlay, setShowSilhouetteOverlay] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<"controls" | "dataset" | "learner">("controls");

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<WatermarkProgress | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportEngine, setExportEngine] = useState<"webcodecs" | "ffmpeg">("webcodecs");
  const [helperConnected, setHelperConnected] = useState<boolean>(false);

  // 100% Autonomous Pipeline State (Zero-Click Behind-the-Scenes Mode)
  const [pipelineState, setPipelineState] = useState<{
    stage: "idle" | "analyzing" | "learning" | "processing" | "complete" | "error";
    message: string;
    aspectRatio?: string;
    detectedAI?: string;
    shapeInfo?: string;
    percent?: number;
    currentFrame?: number;
    totalFrames?: number;
    fps?: number;
  }>({
    stage: "idle",
    message: "",
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bolsub_watermark_auto_download") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("bolsub_watermark_auto_download", String(autoDownload));
    }
  }, [autoDownload]);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Dragging & Resizing ROI state
  const [dragMode, setDragMode] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialRoi: NormalizedROI } | null>(null);

  // Check Helper Status and load Learned AI Logo Dataset on mount
  useEffect(() => {
    setLearnedLogos(getAllLearnedLogoProfiles());
    localHelperClient.checkStatus().then((status) => {
      if (status && status.binaries?.ffmpeg?.available) {
        setHelperConnected(true);
      }
    });
  }, []);

  // Dynamic Preset Application (aspect-ratio sensitive)
  const applyPreset = useCallback((presetId: WatermarkPresetId, width?: number, height?: number) => {
    setSelectedPreset(presetId);
    const w = width ?? naturalDimensions.width;
    const h = height ?? naturalDimensions.height;
    const dynamicRois = getDynamicRoisForPreset(presetId, w, h);
    setRois(dynamicRois);
    setActiveRoiIndex(0);
  }, [naturalDimensions]);

  // Integrated Auto-Detection (Filename + Metadata + Aspect Ratio + Visual Frame)
  const runAutoDetection = useCallback((file: File | null, width: number, height: number, ctx?: CanvasRenderingContext2D | null) => {
    const result = autoDetectMediaWatermark({
      filename: file?.name || "",
      width,
      height,
      ctx,
    });
    setDetectionResult(result);
    setSelectedPreset(result.presetId);
    setRois(result.rois);
    setActiveRoiIndex(0);
    return result;
  }, []);

  // Clean up media URL
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    };
  }, [mediaUrl, exportedUrl]);

  // 100% Autonomous Pipeline: Runs everything behind the scenes without user intervention
  const runAutomaticRemovalPipeline = async (file: File) => {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!isVideo && !isImage) {
      alert("Please upload a valid video (MP4, WebM, MOV) or image (PNG, JPG, WebP) file.");
      return;
    }

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    setExportedBlob(null);
    setExportedUrl(null);
    setIsPlaying(false);

    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaUrl(url);

    setPipelineState({
      stage: "analyzing",
      message: "Analyzing video dimensions, aspect ratio & AI footprints...",
    });

    try {
      // Step 1: Detect exact video dimensions
      let width = 1280;
      let height = 720;

      if (isVideo) {
        const tempVideo = document.createElement("video");
        tempVideo.src = url;
        tempVideo.muted = true;
        await new Promise<void>((resolve) => {
          tempVideo.onloadedmetadata = () => {
            width = tempVideo.videoWidth || 1280;
            height = tempVideo.videoHeight || 720;
            resolve();
          };
          tempVideo.onerror = () => resolve();
          setTimeout(resolve, 2000);
        });
      } else {
        const tempImg = new Image();
        tempImg.src = url;
        await new Promise<void>((resolve) => {
          tempImg.onload = () => {
            width = tempImg.naturalWidth || 1280;
            height = tempImg.naturalHeight || 720;
            resolve();
          };
          tempImg.onerror = () => resolve();
          setTimeout(resolve, 2000);
        });
      }

      setNaturalDimensions({ width, height });

      // Step 2: Auto-detect AI platform & aspect ratio
      const detResult = autoDetectMediaWatermark({
        filename: file.name,
        width,
        height,
      });

      setDetectionResult(detResult);
      setSelectedPreset(detResult.presetId);
      setRois(detResult.rois);

      setPipelineState({
        stage: "learning",
        message: `Identified ${detResult.platformName} (${detResult.aspectRatioLabel}) • Extracting logo silhouette...`,
        aspectRatio: detResult.aspectRatioLabel,
        detectedAI: detResult.platformName,
      });

      // Step 3: Multi-frame temporal learning
      let learnedShapeDesc = "Dataset Shape Silhouette";
      if (isVideo) {
        try {
          const sampleFrames = await sampleVideoFrames(file, 8);
          if (sampleFrames.length >= 3) {
            // Check if watermark appears in top-left or alternates corners across time (e.g. past 10 seconds)
            const testCanvas = document.createElement("canvas");
            testCanvas.width = width;
            testCanvas.height = height;
            const testCtx = testCanvas.getContext("2d");
            if (testCtx && detResult.presetId !== "tiktok") {
              testCtx.putImageData(sampleFrames[0], 0, 0);
              const earlyScan = scanCornerWatermarks(testCtx, width, height);
              testCtx.putImageData(sampleFrames[sampleFrames.length - 1], 0, 0);
              const lateScan = scanCornerWatermarks(testCtx, width, height);

              // If watermark moved between TL and BR or was detected in TL, equip dual-corner TikTok preset
              if (
                earlyScan.corner === "tl" ||
                lateScan.corner === "tl" ||
                (earlyScan.detected && lateScan.detected && earlyScan.corner !== lateScan.corner)
              ) {
                detResult.presetId = "tiktok";
                detResult.platformName = "TikTok / Reels (Dynamic Watermark)";
                detResult.rois = getDynamicRoisForPreset("tiktok", width, height);
                setSelectedPreset("tiktok");
                setRois(detResult.rois);
              }
            }

            if (detResult.rois.length > 0) {
              const pxRoi = denormalizeROI(detResult.rois[0], width, height);
              const { maskResult } = learnWatermarkFromClips(sampleFrames, pxRoi, detResult.presetId);
              if (maskResult.coverageRatio >= 0.015 && maskResult.coverageRatio <= 0.70) {
                learnedShapeDesc = `${Math.round((1 - maskResult.coverageRatio) * 100)}% background preserved`;
                setLearnedLogos(getAllLearnedLogoProfiles());
              }
            }
          }
        } catch (e) {
          console.warn("Temporal learning pre-pass skipped:", e);
        }
      }

      setPipelineState({
        stage: "processing",
        message: `Erasing ${detResult.platformName} watermark with hardware acceleration...`,
        aspectRatio: detResult.aspectRatioLabel,
        detectedAI: detResult.platformName,
        shapeInfo: learnedShapeDesc,
        percent: 0,
      });

      // Step 4: Perform lossless inpainting & export
      abortControllerRef.current = new AbortController();
      const inpaintOpts: InpaintOptions = {
        featherRadius,
        preserveGrain,
        grainAmount,
        blendStrength,
        useShapeMask,
        maskSensitivity,
        platformId: detResult.presetId,
      };

      setIsExporting(true);
      let resultBlob: Blob;
      if (isVideo) {
        resultBlob = await processWatermarkVideo({
          videoFile: file,
          rois: detResult.rois,
          options: inpaintOpts,
          onProgress: (prog) => {
            setExportProgress(prog);
            setPipelineState((prev) => ({
              ...prev,
              percent: prog.percent,
              currentFrame: prog.currentFrame,
              totalFrames: prog.totalFrames,
              fps: prog.fps,
              message: `Inpainting video frame ${prog.currentFrame} / ${prog.totalFrames} (${prog.fps} FPS)...`,
            }));
          },
          signal: abortControllerRef.current.signal,
        });
      } else {
        resultBlob = await processWatermarkImage({
          imageFile: file,
          rois: detResult.rois,
          options: inpaintOpts,
        });
      }

      setExportedBlob(resultBlob);
      const cleanUrl = URL.createObjectURL(resultBlob);
      setExportedUrl(cleanUrl);

      // Trigger download only if auto-download option is enabled
      const extension = isVideo ? "mp4" : "png";
      const cleanFileName = `clean_${file.name.replace(/\.[^.]+$/, "")}.${extension}`;
      if (autoDownload) {
        downloadBlob(resultBlob, cleanFileName);
      }

      setPipelineState({
        stage: "complete",
        message: autoDownload
          ? `Successfully removed ${detResult.platformName} watermark! Output downloaded.`
          : `Successfully removed ${detResult.platformName} watermark! Clean preview ready.`,
        aspectRatio: detResult.aspectRatioLabel,
        detectedAI: detResult.platformName,
        shapeInfo: learnedShapeDesc,
        percent: 100,
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.65 },
        colors: ["#A3E635", "#38bdf8", "#ffffff"],
      });
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes("cancelled")) {
        setPipelineState({ stage: "idle", message: "Export cancelled" });
      } else {
        console.error("Auto pipeline error:", err);
        setPipelineState({
          stage: "error",
          message: (err as Error)?.message || "Failed to process media automatically",
        });
      }
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Load User File & Kick Off Automatic Pipeline Immediately
  const handleFileUpload = (file: File) => {
    runAutomaticRemovalPipeline(file);
  };

  // Generate Synthetic Google Gemini 9:16 Vertical Video/Image Sample with Watermark
  const handleLoadGeminiSample = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rich vertical gradient (AI Veo / Gemini video look)
    const gradient = ctx.createLinearGradient(0, 0, 720, 1280);
    gradient.addColorStop(0, "#081210");
    gradient.addColorStop(0.3, "#0f2e22");
    gradient.addColorStop(0.7, "#194d35");
    gradient.addColorStop(1, "#07110e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 720, 1280);

    // Dynamic glowing orbs
    ctx.fillStyle = "rgba(163, 230, 53, 0.25)";
    ctx.beginPath();
    ctx.arc(360, 480, 260, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#A3E635";
    ctx.beginPath();
    ctx.arc(360, 480, 70, 0, Math.PI * 2);
    ctx.fill();

    // Google Gemini 4-pointed sparkle mark and badge in bottom right (Vertical 9:16 coordinates)
    const wmX = 460;
    const wmY = 1170;
    const wmW = 230;
    const wmH = 70;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.roundRect(wmX, wmY, wmW, wmH, 12);
    ctx.fill();

    // Four-pointed Gemini sparkle symbol
    ctx.fillStyle = "#A3E635";
    ctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("✦", wmX + 18, wmY + 44);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Google Gemini", wmX + 46, wmY + 43);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sampleFile = new File([blob], "gemini_veo_cinematic_forest_short.png", { type: "image/png" });
      runAutomaticRemovalPipeline(sampleFile);
    }, "image/png");
  };

  // Generate Synthetic Kling 16:9 Landscape AI Sample with Watermark
  const handleLoadKlingSample = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, "#121b18");
    gradient.addColorStop(0.5, "#1f3a2b");
    gradient.addColorStop(1, "#0d1410");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.fillStyle = "#2d523c";
    ctx.beginPath();
    ctx.arc(640, 600, 400, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#A3E635";
    ctx.beginPath();
    ctx.arc(640, 260, 90, 0, Math.PI * 2);
    ctx.fill();

    const wmX = 990;
    const wmY = 640;
    const wmW = 240;
    const wmH = 55;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(wmX, wmY, wmW, wmH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("✦ KLING AI VIDEO", wmX + 16, wmY + 36);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sampleFile = new File([blob], "kling_ai_landscape_action.png", { type: "image/png" });
      runAutomaticRemovalPipeline(sampleFile);
    }, "image/png");
  };

  // Learn Watermark Logo Silhouette from Multiple Video Frames
  const handleLearnFromVideo = async () => {
    if (!mediaFile || mediaType !== "video") {
      alert("Please upload or test with a video clip first to learn across multiple frames.");
      return;
    }

    setIsLearningFromClips(true);
    setLearningStatus("Sampling video frames across timeline...");

    try {
      const sw = naturalDimensions.width || 1280;
      const sh = naturalDimensions.height || 720;
      const activeRoi = rois[activeRoiIndex] || rois[0];
      const pxRoi = denormalizeROI(activeRoi, sw, sh);

      const frames = await sampleVideoFrames(mediaFile, 8);
      if (frames.length < 2) {
        throw new Error("Could not extract enough video frames for temporal learning.");
      }

      setLearningStatus("Correlating temporal variance with AI Logo Dataset...");
      const { maskResult, learnedProfile } = learnWatermarkFromClips(frames, pxRoi, selectedPreset);

      // Create preview data URL for the learned mask
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = maskResult.width;
      maskCanvas.height = maskResult.height;
      const mCtx = maskCanvas.getContext("2d");
      if (mCtx) {
        const mImg = mCtx.createImageData(maskResult.width, maskResult.height);
        for (let i = 0; i < maskResult.mask.length; i++) {
          const val = maskResult.mask[i];
          const o = i * 4;
          mImg.data[o] = 163;
          mImg.data[o + 1] = 230;
          mImg.data[o + 2] = 53;
          mImg.data[o + 3] = val > 20 ? 255 : 0;
        }
        mCtx.putImageData(mImg, 0, 0);
        setLearnedSilhouetteUrl(maskCanvas.toDataURL());
      }

      setLearnedLogos(getAllLearnedLogoProfiles());
      setSelectedPreset(learnedProfile.presetId);
      setLearningStatus(
        `Learned ${learnedProfile.platformName} signature from ${frames.length} frames (${Math.round(maskResult.coverageRatio * 100)}% coverage)`
      );

      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 },
        colors: ["#A3E635", "#38bdf8", "#ffffff"],
      });
    } catch (err: unknown) {
      console.error("Learning error:", err);
      setLearningStatus(`Learning error: ${(err as Error)?.message || String(err)}`);
    } finally {
      setIsLearningFromClips(false);
    }
  };

  // Learn Watermark Across Multiple Video Clips
  const handleBatchLearnFromClips = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsLearningFromClips(true);
    setLearningStatus(`Extracting dataset from ${files.length} video clips...`);

    try {
      const allFrames: ImageData[] = [];
      const sw = naturalDimensions.width || 1280;
      const sh = naturalDimensions.height || 720;
      const activeRoi = rois[activeRoiIndex] || rois[0];
      const pxRoi = denormalizeROI(activeRoi, sw, sh);

      for (let f = 0; f < files.length; f++) {
        setLearningStatus(`Sampling clip ${f + 1}/${files.length}: ${files[f].name}...`);
        const frames = await sampleVideoFrames(files[f], 4);
        allFrames.push(...frames);
      }

      if (allFrames.length < 2) {
        throw new Error("Could not extract frames from selected clips.");
      }

      setLearningStatus("Synthesizing multi-clip logo footprint...");
      const { maskResult, learnedProfile } = learnWatermarkFromClips(allFrames, pxRoi, selectedPreset);

      learnedProfile.clipCount = files.length;
      saveLearnedLogoProfile(learnedProfile);
      setLearnedLogos(getAllLearnedLogoProfiles());
      setSelectedPreset(learnedProfile.presetId);
      setLearningStatus(
        `Learned ${learnedProfile.platformName} model across ${files.length} clips (${allFrames.length} total frames)!`
      );

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#A3E635", "#818cf8", "#ffffff"],
      });
    } catch (err: unknown) {
      setLearningStatus(`Batch learning failed: ${(err as Error)?.message || String(err)}`);
    } finally {
      setIsLearningFromClips(false);
    }
  };

  // Render Canvas (Original + Inpainting + Split View)
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const source = mediaType === "video" ? videoRef.current : imageRef.current;
    if (!source) return;

    const sw = naturalDimensions.width || 1280;
    const sh = naturalDimensions.height || 720;

    if (canvas.width !== sw || canvas.height !== sh) {
      canvas.width = sw;
      canvas.height = sh;
    }

    // 1. Draw source
    ctx.drawImage(source, 0, 0, sw, sh);

    // If split view is enabled, we create a side-by-side or split comparison
    if (showSplitView) {
      // Create offscreen buffer for the inpainted version
      const offscreen = document.createElement("canvas");
      offscreen.width = sw;
      offscreen.height = sh;
      const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(source, 0, 0, sw, sh);

        const inpaintOpts: InpaintOptions = {
          featherRadius,
          preserveGrain,
          grainAmount,
          blendStrength,
          useShapeMask,
          maskSensitivity,
          platformId: selectedPreset,
        };

        inpaintCanvasROIs(offCtx, sw, sh, rois, inpaintOpts);

        // Draw inpainted version over right side of splitPosition
        const splitX = Math.round(sw * splitPosition);
        const cleanWidth = sw - splitX;

        if (cleanWidth > 0) {
          ctx.drawImage(
            offscreen,
            splitX,
            0,
            cleanWidth,
            sh,
            splitX,
            0,
            cleanWidth,
            sh
          );
        }

        // Draw Split Divider Line
        ctx.strokeStyle = "#A3E635";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, sh);
        ctx.stroke();

        // Split handle pill
        ctx.fillStyle = "#A3E635";
        ctx.beginPath();
        ctx.arc(splitX, sh / 2, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#142218";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("↔", splitX, sh / 2 + 4);
      }
    } else {
      // Inpaint directly across all ROIs
      const inpaintOpts: InpaintOptions = {
        featherRadius,
        preserveGrain,
        grainAmount,
        blendStrength,
        useShapeMask,
        maskSensitivity,
        platformId: selectedPreset,
      };
      inpaintCanvasROIs(ctx, sw, sh, rois, inpaintOpts);
    }

    // Optional Visual Verification: Highlight exact logo shape silhouette in emerald green
    if (showSilhouetteOverlay && useShapeMask) {
      const imgData = ctx.getImageData(0, 0, sw, sh);
      for (const roi of rois) {
        const pxRoi = denormalizeROI(roi, sw, sh);
        const maskRes = generateWatermarkMask(imgData, pxRoi, selectedPreset, maskSensitivity);
        const { mask, width: mw, height: mh } = maskRes;
        for (let row = 0; row < mh; row++) {
          for (let col = 0; col < mw; col++) {
            const mIdx = row * mw + col;
            if (mask[mIdx] > 30) {
              const pixelIdx = ((pxRoi.y + row) * sw + (pxRoi.x + col)) * 4;
              imgData.data[pixelIdx] = Math.min(255, Math.round(imgData.data[pixelIdx] * 0.35 + 163 * 0.65));
              imgData.data[pixelIdx + 1] = Math.min(255, Math.round(imgData.data[pixelIdx + 1] * 0.35 + 230 * 0.65));
              imgData.data[pixelIdx + 2] = Math.min(255, Math.round(imgData.data[pixelIdx + 2] * 0.35 + 53 * 0.65));
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [
    mediaType,
    naturalDimensions,
    rois,
    showSplitView,
    splitPosition,
    featherRadius,
    preserveGrain,
    grainAmount,
    blendStrength,
    useShapeMask,
    maskSensitivity,
    selectedPreset,
    showSilhouetteOverlay,
  ]);

  // Video Animation Loop for Preview
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      if (mediaType === "video" && videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
        renderPreview();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mediaType, renderPreview]);

  // Redraw when settings change
  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Transport Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    renderPreview();
  };

  // Mouse drag & resize handlers for interactive ROI
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showAdvancedSettings) return;
    const container = containerRef.current;
    if (!container || rois.length === 0) return;

    const rect = container.getBoundingClientRect();
    const clickNormX = (e.clientX - rect.left) / rect.width;
    const clickNormY = (e.clientY - rect.top) / rect.height;

    // Check if clicked inside or on handles of any ROI
    const activeRoi = rois[activeRoiIndex] || rois[0];
    const { x, y, width, height } = activeRoi;

    const handleThreshold = 0.035;

    // Check corners
    if (Math.abs(clickNormX - x) < handleThreshold && Math.abs(clickNormY - y) < handleThreshold) {
      setDragMode("nw");
    } else if (Math.abs(clickNormX - (x + width)) < handleThreshold && Math.abs(clickNormY - y) < handleThreshold) {
      setDragMode("ne");
    } else if (Math.abs(clickNormX - x) < handleThreshold && Math.abs(clickNormY - (y + height)) < handleThreshold) {
      setDragMode("sw");
    } else if (Math.abs(clickNormX - (x + width)) < handleThreshold && Math.abs(clickNormY - (y + height)) < handleThreshold) {
      setDragMode("se");
    } else if (
      clickNormX >= x &&
      clickNormX <= x + width &&
      clickNormY >= y &&
      clickNormY <= y + height
    ) {
      setDragMode("move");
    } else {
      // Check if user clicked on another ROI
      const otherIndex = rois.findIndex(
        (r) =>
          clickNormX >= r.x &&
          clickNormX <= r.x + r.width &&
          clickNormY >= r.y &&
          clickNormY <= r.y + r.height
      );
      if (otherIndex !== -1) {
        setActiveRoiIndex(otherIndex);
        setDragMode("move");
      } else {
        return;
      }
    }

    dragStartRef.current = {
      mouseX: clickNormX,
      mouseY: clickNormY,
      initialRoi: { ...activeRoi },
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragMode || !dragStartRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentNormX = (e.clientX - rect.left) / rect.width;
    const currentNormY = (e.clientY - rect.top) / rect.height;

    const dx = currentNormX - dragStartRef.current.mouseX;
    const dy = currentNormY - dragStartRef.current.mouseY;
    const { initialRoi } = dragStartRef.current;

    let newRoi: NormalizedROI = { ...initialRoi };

    if (dragMode === "move") {
      newRoi.x = initialRoi.x + dx;
      newRoi.y = initialRoi.y + dy;
    } else if (dragMode === "nw") {
      newRoi.x = initialRoi.x + dx;
      newRoi.y = initialRoi.y + dy;
      newRoi.width = initialRoi.width - dx;
      newRoi.height = initialRoi.height - dy;
    } else if (dragMode === "ne") {
      newRoi.y = initialRoi.y + dy;
      newRoi.width = initialRoi.width + dx;
      newRoi.height = initialRoi.height - dy;
    } else if (dragMode === "sw") {
      newRoi.x = initialRoi.x + dx;
      newRoi.width = initialRoi.width - dx;
      newRoi.height = initialRoi.height + dy;
    } else if (dragMode === "se") {
      newRoi.width = initialRoi.width + dx;
      newRoi.height = initialRoi.height + dy;
    }

    newRoi = clampNormalizedROI(newRoi);

    setRois((prev) => {
      const updated = [...prev];
      updated[activeRoiIndex] = newRoi;
      return updated;
    });

    renderPreview();
  };

  const handleCanvasMouseUp = () => {
    setDragMode(null);
    dragStartRef.current = null;
  };

  // Add / Remove Custom ROIs
  const handleAddRoi = () => {
    const newRoi: NormalizedROI = {
      id: `box_${Date.now()}`,
      name: `Watermark #${rois.length + 1}`,
      x: 0.75,
      y: 0.85,
      width: 0.20,
      height: 0.10,
    };
    setRois((prev) => [...prev, newRoi]);
    setActiveRoiIndex(rois.length);
    setSelectedPreset("custom");
  };

  const handleDeleteRoi = (idx: number) => {
    if (rois.length <= 1) return;
    setRois((prev) => prev.filter((_, i) => i !== idx));
    setActiveRoiIndex(0);
  };

  // Perform Export
  const handleExport = async () => {
    if (!mediaFile) return;

    setIsExporting(true);
    setExportProgress({
      phase: "preparing",
      percent: 0,
      currentFrame: 0,
      totalFrames: 100,
      fps: 0,
    });

    abortControllerRef.current = new AbortController();

    try {
      const inpaintOpts: InpaintOptions = {
        featherRadius,
        preserveGrain,
        grainAmount,
        blendStrength,
        useShapeMask,
        maskSensitivity,
        platformId: selectedPreset,
      };

      let resultBlob: Blob;

      if (mediaType === "image") {
        resultBlob = await processWatermarkImage({
          imageFile: mediaFile,
          rois,
          options: inpaintOpts,
        });
      } else {
        resultBlob = await processWatermarkVideo({
          videoFile: mediaFile,
          rois,
          options: inpaintOpts,
          onProgress: (prog) => setExportProgress(prog),
          signal: abortControllerRef.current.signal,
        });
      }

      setExportedBlob(resultBlob);
      const url = URL.createObjectURL(resultBlob);
      setExportedUrl(url);

      const extension = mediaType === "image" ? "png" : "mp4";
      const cleanFileName = `clean_${mediaFile.name.replace(/\.[^.]+$/, "")}.${extension}`;
      downloadBlob(resultBlob, cleanFileName);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#A3E635", "#22c55e", "#ffffff"],
      });
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes("cancelled")) {
        console.log("Export cancelled by user");
      } else {
        console.error("Export error:", err);
        alert(`Export failed: ${(err as Error)?.message || String(err)}`);
      }
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    setMediaFile(null);
    setMediaType(null);
    setMediaUrl(null);
    setExportedBlob(null);
    setExportedUrl(null);
    setIsPlaying(false);
    setDetectionResult(null);
    setPipelineState({
      stage: "idle",
      message: "",
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      runAutomaticRemovalPipeline(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const currentPixelRoi = rois[activeRoiIndex]
    ? denormalizeROI(rois[activeRoiIndex], naturalDimensions.width, naturalDimensions.height)
    : null;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Top Hero Banner */}
        <section className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-6 shadow-[4px_4px_0px_var(--border-main)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#A3E635] text-[#142218] border border-[var(--border-main)] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 100% Autonomous Pipeline
              </span>
              {helperConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> FFmpeg Hardware Acceleration Ready
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> WebCodecs In-Browser Engine
                </span>
              )}
            </div>
            <h1 className="font-fraunces italic font-extrabold text-2xl md:text-3xl text-[var(--text-main)] tracking-tight">
              AI Watermark Remover
            </h1>
            <p className="text-xs text-[var(--text-muted)] max-w-2xl">
              Zero settings, zero manual configuration. Just upload your video — the platform, aspect ratio, and watermark shape are analyzed and erased automatically behind the scenes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
            {(mediaUrl || pipelineState.stage !== "idle") && (
              <button
                onClick={handleReset}
                className="neo-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
                title="Reset and upload another video"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#A3E635]" />
                <span>Upload Another Video</span>
              </button>
            )}
            <button
              onClick={handleLoadGeminiSample}
              className="neo-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
              title="Test with simulated Google Gemini 9:16 Vertical render"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>Try Gemini (9:16)</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoDownload(!autoDownload)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 select-none ${
                autoDownload
                  ? "bg-[#A3E635]/20 text-[#A3E635] border-[#A3E635]/60 shadow-[2px_2px_0px_#A3E635]"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-main)] hover:text-[var(--text-main)] hover:border-[#A3E635]/30"
              }`}
              title={autoDownload ? "Auto-Download is ON: cleaned video will download immediately" : "Auto-Download is OFF: preview first, download when ready"}
            >
              <Download className={`w-3.5 h-3.5 ${autoDownload ? "text-[#A3E635]" : "text-[var(--text-muted)]"}`} />
              <span>Auto-Download: <span className={autoDownload ? "text-[#A3E635] font-black" : "font-normal"}>{autoDownload ? "ON" : "OFF"}</span></span>
            </button>
            <button
              onClick={handleLoadKlingSample}
              className="neo-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
              title="Test with simulated Kling AI 16:9 Landscape render"
            >
              <Play className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>Try Kling (16:9)</span>
            </button>
          </div>
        </section>

        {/* CASE 1: IDLE STATE - Autonomous Zero-Click Dropzone */}
        {!mediaUrl && pipelineState.stage === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-3 border-dashed rounded-3xl p-10 md:p-14 flex flex-col items-center justify-center gap-6 text-center transition-all min-h-[460px] shadow-[6px_6px_0px_var(--border-main)] ${
              isDragging
                ? "border-[#A3E635] bg-[#A3E635]/15 scale-[1.01]"
                : "border-[var(--border-main)] bg-[var(--bg-panel)]/60 hover:border-[#A3E635]/70 hover:bg-[var(--bg-panel)]"
            }`}
          >
            <div className="w-20 h-20 rounded-3xl bg-[var(--accent-lime)]/20 border-2 border-[var(--border-main)] flex items-center justify-center text-[#A3E635] shadow-[4px_4px_0px_var(--border-main)] group">
              <Upload className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </div>

            <div className="flex flex-col gap-2 max-w-lg">
              <h2 className="font-fraunces italic font-extrabold text-2xl text-[var(--text-main)]">
                Drop your video here to erase watermarks automatically
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Everything runs behind the scenes. No options to choose, no coordinates to set, no sliders to adjust.
              </p>
            </div>

            {/* 4 Behind-The-Scenes Checkpoints */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl w-full my-2">
              <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex flex-col items-center gap-1.5 text-center">
                <Maximize2 className="w-4 h-4 text-[#A3E635]" />
                <span className="font-bold text-xs text-[var(--text-main)]">Dynamic Aspect Ratio</span>
                <span className="text-[10px] text-[var(--text-muted)]">16:9, 9:16 Shorts, 1:1</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex flex-col items-center gap-1.5 text-center">
                <Bot className="w-4 h-4 text-[#A3E635]" />
                <span className="font-bold text-xs text-[var(--text-main)]">AI Origin Detection</span>
                <span className="text-[10px] text-[var(--text-muted)]">Gemini, Kling, Runway, Sora...</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex flex-col items-center gap-1.5 text-center">
                <Brain className="w-4 h-4 text-[#A3E635]" />
                <span className="font-bold text-xs text-[var(--text-main)]">Logo Silhouette Learning</span>
                <span className="text-[10px] text-[var(--text-muted)]">Preserves 90%+ Background</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex flex-col items-center gap-1.5 text-center">
                <Sparkles className="w-4 h-4 text-[#A3E635]" />
                <span className="font-bold text-xs text-[var(--text-main)]">Lossless Output</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {autoDownload ? "Auto-Download Enabled" : "Preview & 1-Click Save"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="neo-btn py-3 px-8 text-sm font-black flex items-center gap-2 cursor-pointer shadow-[4px_4px_0px_var(--border-main)] hover:scale-105 transition-transform">
                <Upload className="w-4 h-4" />
                <span>Select Video / Image File</span>
                <input
                  type="file"
                  accept="video/*,image/*,.mp4,.webm,.mov,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition select-none bg-[var(--bg-card)] px-3.5 py-2.5 rounded-xl border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] hover:border-[#A3E635]/40">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                  className="w-4 h-4 accent-[#A3E635] rounded cursor-pointer"
                />
                <span>Auto-download when done</span>
              </label>
            </div>

            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Supports MP4, WebM, MOV, PNG, JPG, WebP • 100% local on-device processing
            </span>
          </div>
        )}

        {/* CASE 2: ACTIVE PIPELINE OR LOADED MEDIA */}
        {(mediaUrl || pipelineState.stage !== "idle") && (
          <div className="flex flex-col gap-6">
            {/* Autonomous Stage Monitor Dashboard */}
            <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-5 shadow-[4px_4px_0px_var(--border-main)] flex flex-col gap-4">
              {/* Header Status Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border-main)] pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl border-2 border-[var(--border-main)] flex items-center justify-center font-black ${
                      pipelineState.stage === "complete"
                        ? "bg-emerald-500 text-black shadow-[2px_2px_0px_var(--border-main)]"
                        : pipelineState.stage === "error"
                        ? "bg-red-500 text-white"
                        : "bg-[#A3E635] text-[#142218] animate-pulse"
                    }`}
                  >
                    {pipelineState.stage === "complete" ? (
                      <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    ) : pipelineState.stage === "error" ? (
                      <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <Wand2 className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-fraunces italic font-extrabold text-sm sm:text-base text-[var(--text-main)]">
                      {pipelineState.stage === "complete"
                        ? (autoDownload ? "Watermark Erased & Auto-Downloaded!" : "Watermark Erased & Clean Preview Ready!")
                        : pipelineState.stage === "error"
                        ? "Processing Interrupted"
                        : "Automated AI Pipeline Running..."}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {pipelineState.message || "Running automated checks behind the scenes..."}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAutoDownload(!autoDownload)}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 select-none ${
                      autoDownload
                        ? "bg-[#A3E635]/20 text-[#A3E635] border-[#A3E635]/60 shadow-[2px_2px_0px_#A3E635]"
                        : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-main)] hover:text-[var(--text-main)]"
                    }`}
                    title={autoDownload ? "Auto-Download is ON: cleaned file downloads immediately" : "Auto-Download is OFF: preview first, download when ready"}
                  >
                    <Download className={`w-3.5 h-3.5 ${autoDownload ? "text-[#A3E635]" : "text-[var(--text-muted)]"}`} />
                    <span>Auto: {autoDownload ? "ON" : "OFF"}</span>
                  </button>
                  {pipelineState.stage === "complete" && exportedBlob && (
                    <button
                      onClick={() => {
                        const extension = mediaType === "video" ? "mp4" : "png";
                        const cleanFileName = `clean_${mediaFile?.name.replace(/\.[^.]+$/, "") || "video"}.${extension}`;
                        downloadBlob(exportedBlob, cleanFileName);
                      }}
                      className="neo-btn px-3 py-1.5 text-xs flex items-center gap-1.5 font-black"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{autoDownload ? "Download Again" : "Download Clean File"}</span>
                    </button>
                  )}
                  {pipelineState.stage !== "complete" && pipelineState.stage !== "error" && isExporting && (
                    <button
                      onClick={handleCancelExport}
                      className="px-2.5 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar (when active) */}
              {pipelineState.stage !== "complete" && pipelineState.stage !== "error" && pipelineState.stage !== "idle" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono font-bold">
                    <span className="text-[var(--text-muted)] capitalize">{pipelineState.stage}...</span>
                    <span className="text-[#A3E635]">{pipelineState.percent ?? (pipelineState.stage === "analyzing" ? 20 : 45)}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[var(--bg-card)] overflow-hidden border border-[var(--border-main)]">
                    <div
                      style={{
                        width: `${pipelineState.percent ?? (pipelineState.stage === "analyzing" ? 20 : 45)}%`,
                      }}
                      className="h-full bg-[#A3E635] transition-all duration-300"
                    />
                  </div>
                  {pipelineState.totalFrames && pipelineState.totalFrames > 0 ? (
                    <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                      <span>Frame {pipelineState.currentFrame} / {pipelineState.totalFrames}</span>
                      <span>{pipelineState.fps || 0} FPS</span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 4 Auto-Discovered Checkpoints Behind The Scenes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Maximize2 className="w-3 h-3 text-[#A3E635]" /> Aspect Ratio
                  </span>
                  <span className="font-bold text-xs text-[var(--text-main)] truncate">
                    {pipelineState.aspectRatio || detectionResult?.aspectRatioLabel || "Dynamic Fit"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {naturalDimensions.width} × {naturalDimensions.height} px
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Bot className="w-3 h-3 text-[#A3E635]" /> Identified AI
                  </span>
                  <span className="font-bold text-xs text-[var(--text-main)] truncate">
                    {pipelineState.detectedAI || detectionResult?.platformName || "Scanning..."}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {Math.round((detectionResult?.confidence || 0.95) * 100)}% Confidence
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Brain className="w-3 h-3 text-[#A3E635]" /> Watermark Mask
                  </span>
                  <span className="font-bold text-xs text-[var(--text-main)] truncate">
                    {pipelineState.shapeInfo || "Silhouette Mask"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Preserves Innocent Pixels
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-[#A3E635]" /> Output Status
                  </span>
                  <span className="font-bold text-xs text-[var(--text-main)] truncate">
                    {pipelineState.stage === "complete"
                      ? (autoDownload ? "✓ Auto-Downloaded" : "✓ Clean & Ready")
                      : pipelineState.stage === "processing"
                      ? "Lossless Inpainting"
                      : "WebCodecs Ready"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {pipelineState.stage === "complete"
                      ? (autoDownload ? "Saved to device" : "Ready to save")
                      : "0 Cloud Uploads"}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Video Preview & Split Screen Comparison */}
            <div className="flex flex-col gap-3">
              <div
                ref={containerRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] select-none cursor-default group"
              >
                {/* Canvas Display */}
                <canvas
                  ref={previewCanvasRef}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* Hidden Source Media */}
                {mediaType === "video" && (
                  <video
                    ref={videoRef}
                    src={mediaUrl || undefined}
                    className="hidden"
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const target = e.currentTarget;
                      const w = target.videoWidth || 1280;
                      const h = target.videoHeight || 720;
                      setNaturalDimensions({ width: w, height: h });
                      setDuration(target.duration || 0);
                      renderPreview();
                    }}
                    onEnded={() => setIsPlaying(false)}
                  />
                )}

                {mediaType === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={imageRef}
                    src={mediaUrl || undefined}
                    alt="Watermark source"
                    className="hidden"
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      const w = target.naturalWidth || 1280;
                      const h = target.naturalHeight || 720;
                      setNaturalDimensions({ width: w, height: h });
                      renderPreview();
                    }}
                  />
                )}

                {/* Interactive Watermark Bounding Boxes Overlay (Visible only when Advanced Settings is open) */}
                {showAdvancedSettings &&
                  rois.map((roi, index) => {
                    const isActive = index === activeRoiIndex;
                    return (
                      <div
                        key={roi.id || index}
                        style={{
                          left: `${roi.x * 100}%`,
                          top: `${roi.y * 100}%`,
                          width: `${roi.width * 100}%`,
                          height: `${roi.height * 100}%`,
                        }}
                        className={`absolute border-2 transition-colors ${
                          isActive
                            ? "border-[#A3E635] bg-[#A3E635]/15 shadow-[0_0_12px_rgba(163,230,53,0.4)]"
                            : "border-white/50 bg-white/10"
                        } pointer-events-auto cursor-move`}
                        title={roi.name || `Watermark ${index + 1}`}
                      >
                        <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-[#142218] border border-[#A3E635] text-[9px] font-black text-[#A3E635] whitespace-nowrap">
                          {roi.name || `Box ${index + 1}`}
                        </div>

                        {isActive && (
                          <>
                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#A3E635] border border-[#142218] cursor-nwse-resize rounded-full" />
                            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#A3E635] border border-[#142218] cursor-nesw-resize rounded-full" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#A3E635] border border-[#142218] cursor-nesw-resize rounded-full" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#A3E635] border border-[#142218] cursor-nwse-resize rounded-full" />
                          </>
                        )}
                      </div>
                    );
                  })}

                {/* Split Screen Slider Drag Indicator Pill */}
                {showSplitView && (
                  <div
                    style={{ left: `${splitPosition * 100}%` }}
                    className="absolute top-3 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#142218]/90 border border-[#A3E635] text-[9px] font-black text-[#A3E635] shadow-lg pointer-events-none"
                  >
                    Original ◄ | ► Clean
                  </div>
                )}
              </div>

              {/* Transport & Split Bar */}
              <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-xl p-3 shadow-[2px_2px_0px_var(--border-main)] flex flex-wrap items-center justify-between gap-3 text-xs">
                {mediaType === "video" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] hover:bg-[#A3E635] hover:text-[#142218] transition-colors"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <span className="font-mono text-xs font-bold">
                      {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                    </span>

                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      step={0.05}
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-32 sm:w-48 accent-[#A3E635] cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-main)] font-mono text-[11px] font-bold">
                      {naturalDimensions.width} × {naturalDimensions.height} px
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSplitView(!showSplitView)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      showSplitView
                        ? "bg-[#A3E635] text-[#142218] border-[var(--border-main)]"
                        : "bg-[var(--bg-card)] border-[var(--border-main)] text-[var(--text-main)]"
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>{showSplitView ? "Split Comparison" : "Full Clean View"}</span>
                  </button>

                  {showSplitView && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold">Split:</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={splitPosition}
                        onChange={(e) => {
                          setSplitPosition(parseFloat(e.target.value));
                          renderPreview();
                        }}
                        className="w-20 accent-[#A3E635] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Completion Action Card */}
            {pipelineState.stage === "complete" && (
              <div className="p-4 rounded-2xl bg-[var(--accent-lime)]/10 border-2 border-[#A3E635] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[2px_2px_0px_var(--border-main)]">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
                  <CheckCircle2 className="w-4 h-4 text-[#A3E635]" />
                  <span>
                    {autoDownload
                      ? "Output saved! Watermark was erased and downloaded automatically."
                      : "Watermark erased cleanly! Clean preview is ready. Click below to save."}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {exportedBlob && (
                    <button
                      onClick={() => {
                        const extension = mediaType === "video" ? "mp4" : "png";
                        const cleanFileName = `clean_${mediaFile?.name.replace(/\.[^.]+$/, "") || "video"}.${extension}`;
                        downloadBlob(exportedBlob, cleanFileName);
                      }}
                      className="neo-btn px-4 py-2 text-xs font-black flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{autoDownload ? "Download Again" : "Download Clean File"}</span>
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="neo-btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#A3E635]" />
                    <span>Process Another Video</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Advanced Manual Overrides Section (Collapsed by Default) */}
        <div className="border-t-2 border-[var(--border-main)] pt-4 mt-2">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="w-full p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] flex items-center justify-between hover:bg-[var(--bg-card)] transition-colors text-xs font-bold shadow-[2px_2px_0px_var(--border-main)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#A3E635]" />
              <span>Advanced Manual Overrides & AI Dataset Explorer (Optional)</span>
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="text-[10px] uppercase font-bold">
                {showAdvancedSettings ? "Hide Advanced Options" : "Show Advanced Options"}
              </span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showAdvancedSettings && (
            <div className="mt-4 flex flex-col gap-4">
              {/* Preset Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Presets:
                </span>
                {(Object.keys(WATERMARK_PRESETS) as WatermarkPresetId[]).map((key) => {
                  const preset = WATERMARK_PRESETS[key];
                  const isSelected = selectedPreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-[#A3E635] text-[#142218] border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] font-black"
                          : "bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-main)] hover:bg-[var(--accent-lime)]/20"
                      }`}
                    >
                      <span>{preset.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-md uppercase font-black ${
                          isSelected ? "bg-[#142218] text-[#A3E635]" : "bg-[var(--bg-panel)] text-[var(--text-muted)]"
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Advanced 3-Tab Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Tab selection & controls (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div className="flex rounded-xl bg-[var(--bg-panel)] p-1 border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] gap-1">
                    <button
                      onClick={() => setSidebarTab("controls")}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        sidebarTab === "controls"
                          ? "bg-[#A3E635] text-[#142218] font-black shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Parameters & ROIs</span>
                    </button>
                    <button
                      onClick={() => setSidebarTab("dataset")}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        sidebarTab === "dataset"
                          ? "bg-[#A3E635] text-[#142218] font-black shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>AI Dataset</span>
                    </button>
                    <button
                      onClick={() => setSidebarTab("learner")}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        sidebarTab === "learner"
                          ? "bg-[#A3E635] text-[#142218] font-black shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Batch Learner</span>
                    </button>
                  </div>

                  {sidebarTab === "controls" && (
                    <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-4 shadow-[4px_4px_0px_var(--border-main)] flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                          <Eraser className="w-3.5 h-3.5 text-[#A3E635]" /> Watermark Regions ({rois.length})
                        </span>
                        <button
                          onClick={handleAddRoi}
                          className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-main)] text-[10px] font-bold hover:bg-[#A3E635] hover:text-[#142218] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add Box
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                        {rois.map((roi, idx) => {
                          const isActive = idx === activeRoiIndex;
                          return (
                            <div
                              key={roi.id || idx}
                              onClick={() => setActiveRoiIndex(idx)}
                              className={`p-2 rounded-xl border-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isActive
                                  ? "bg-[var(--accent-lime)]/15 border-[#A3E635]"
                                  : "bg-[var(--bg-card)] border-[var(--border-main)]"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-[var(--text-main)]">{roi.name || `Box ${idx + 1}`}</span>
                                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                                  X: {Math.round(roi.x * 100)}% Y: {Math.round(roi.y * 100)}% | W: {Math.round(roi.width * 100)}% H: {Math.round(roi.height * 100)}%
                                </span>
                              </div>

                              {rois.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRoi(idx);
                                  }}
                                  className="p-1 rounded text-red-400 hover:bg-red-500/20"
                                  title="Delete Region"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] mt-1">
                        <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-[#A3E635]" /> Highlight Logo Mask
                        </span>
                        <input
                          type="checkbox"
                          checked={showSilhouetteOverlay}
                          onChange={(e) => {
                            setShowSilhouetteOverlay(e.target.checked);
                            renderPreview();
                          }}
                          className="accent-[#A3E635] w-4 h-4 cursor-pointer"
                        />
                      </div>

                      {currentPixelRoi && (
                        <div className="p-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-main)] font-mono text-[10px] text-[var(--text-muted)] flex flex-wrap justify-between gap-1">
                          <span>PX: {currentPixelRoi.x}, {currentPixelRoi.y}</span>
                          <span>SIZE: {currentPixelRoi.width} × {currentPixelRoi.height} px</span>
                        </div>
                      )}
                    </div>
                  )}

                  {sidebarTab === "dataset" && (
                    <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-4 shadow-[4px_4px_0px_var(--border-main)] flex flex-col gap-3.5">
                      <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-[#A3E635]" /> AI Logo Dataset ({Object.keys(AI_WATERMARK_DATASET).length - 1})
                        </span>
                        <span className="text-[10px] text-[#A3E635] font-mono font-bold">
                          Empirical Shapes
                        </span>
                      </div>
                      <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {(Object.keys(AI_WATERMARK_DATASET) as WatermarkPresetId[])
                          .filter((k) => k !== "custom")
                          .map((presetKey) => {
                            const entry = AI_WATERMARK_DATASET[presetKey];
                            const isSelected = selectedPreset === presetKey;
                            const hasLearned = Boolean(learnedLogos[presetKey]);

                            return (
                              <div
                                key={presetKey}
                                className={`p-2.5 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-[var(--accent-lime)]/15 border-[#A3E635] shadow-[2px_2px_0px_var(--border-main)]"
                                    : "bg-[var(--bg-card)] border-[var(--border-main)] hover:border-[#A3E635]/60"
                                }`}
                                onClick={() => applyPreset(presetKey)}
                              >
                                <GlyphMatrixPreview matrix16={entry.glyphMatrix16} />
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-xs text-[var(--text-main)] truncate">
                                      {entry.name}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded uppercase font-black bg-[#A3E635]/20 text-[#A3E635]">
                                      {entry.badge}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-[var(--text-muted)] truncate">
                                    {entry.description}
                                  </span>
                                  {hasLearned && (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1 rounded self-start">
                                      ✓ Learned Profile
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {sidebarTab === "learner" && (
                    <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-4 shadow-[4px_4px_0px_var(--border-main)] flex flex-col gap-3.5">
                      <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5 border-b border-[var(--border-main)] pb-2.5">
                        <Brain className="w-3.5 h-3.5 text-[#A3E635]" /> Temporal Multi-Clip Learner
                      </span>
                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-2">
                        <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 text-[#A3E635]" /> Re-Extract from Loaded Video
                        </span>
                        <button
                          onClick={handleLearnFromVideo}
                          disabled={isLearningFromClips || mediaType !== "video"}
                          className="neo-btn w-full py-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isLearningFromClips ? "Analyzing..." : "Re-Learn Logo Mask"}</span>
                        </button>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] flex flex-col gap-2">
                        <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-[#A3E635]" /> Batch Learn Multiple Clips
                        </span>
                        <label className="neo-btn-secondary w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer text-center">
                          <Upload className="w-3.5 h-3.5 text-[#A3E635]" />
                          <span>Select Clips</span>
                          <input
                            type="file"
                            multiple
                            accept="video/*,.mp4,.webm,.mov"
                            className="hidden"
                            onChange={(e) => handleBatchLearnFromClips(e.target.files)}
                          />
                        </label>
                      </div>
                      {learningStatus && (
                        <div className="p-2.5 rounded-xl bg-[var(--accent-lime)]/15 border border-[#A3E635] text-xs font-mono text-[#A3E635] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{learningStatus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Fine-Tuning Sliders & Manual Export (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-2xl p-4 shadow-[4px_4px_0px_var(--border-main)] flex flex-col gap-3.5">
                    <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5 border-b border-[var(--border-main)] pb-2">
                      <Sliders className="w-3.5 h-3.5 text-[#A3E635]" /> Inpainting Sliders
                    </span>

                    <div className="flex flex-col gap-1 p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-main)]">Selective Logo Inpainting</span>
                        <input
                          type="checkbox"
                          checked={useShapeMask}
                          onChange={(e) => {
                            setUseShapeMask(e.target.checked);
                            renderPreview();
                          }}
                          className="accent-[#A3E635] w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Inplants only logo glyphs, keeping background intact.
                      </span>
                    </div>

                    {useShapeMask && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span>Logo Sensitivity</span>
                          <span className="font-mono text-[#A3E635]">{Math.round(maskSensitivity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.2}
                          max={0.8}
                          step={0.05}
                          value={maskSensitivity}
                          onChange={(e) => {
                            setMaskSensitivity(parseFloat(e.target.value));
                            renderPreview();
                          }}
                          className="w-full accent-[#A3E635] cursor-pointer"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Edge Feathering</span>
                        <span className="font-mono text-[#A3E635]">{featherRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={16}
                        step={1}
                        value={featherRadius}
                        onChange={(e) => {
                          setFeatherRadius(parseInt(e.target.value, 10));
                          renderPreview();
                        }}
                        className="w-full accent-[#A3E635] cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>Ambient Grain Match</span>
                        <span className="font-mono text-[#A3E635]">{Math.round(grainAmount * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.3}
                        step={0.01}
                        value={grainAmount}
                        onChange={(e) => {
                          setGrainAmount(parseFloat(e.target.value));
                          renderPreview();
                        }}
                        className="w-full accent-[#A3E635] cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>Blend Opacity</span>
                        <span className="font-mono text-[#A3E635]">{Math.round(blendStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={1.0}
                        step={0.05}
                        value={blendStrength}
                        onChange={(e) => {
                          setBlendStrength(parseFloat(e.target.value));
                          renderPreview();
                        }}
                        className="w-full accent-[#A3E635] cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={handleExport}
                      disabled={!mediaFile || isExporting}
                      className="neo-btn w-full mt-2 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Manual Re-Export</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
