/**
 * BolSub Studio Watermark Video & Image Processor
 * 100% on-device hardware accelerated watermark removal using
 * WebCodecs / Canvas inpainting + MP4 Muxer with full audio retention.
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { inpaintCanvasROIs, denormalizeROI } from "./inpainter";
import { extractTemporalWatermarkMask } from "./logoMasker";
import type { NormalizedROI, InpaintOptions } from "./types";

export interface WatermarkProgress {
  phase: "preparing" | "processing" | "finalizing" | "complete" | "error";
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  error?: string;
}

export interface ProcessVideoOptions {
  videoFile: File | Blob;
  rois: NormalizedROI[];
  options?: InpaintOptions;
  fps?: number;
  onProgress?: (progress: WatermarkProgress) => void;
  signal?: AbortSignal;
}

export interface ProcessImageOptions {
  imageFile: File | Blob;
  rois: NormalizedROI[];
  options?: InpaintOptions;
}

/**
 * Triggers direct browser download of a generated Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Samples evenly spaced video frames across time to train and extract the static watermark mask.
 */
export async function sampleVideoFrames(
  videoFile: File | Blob,
  sampleCount: number = 6
): Promise<ImageData[]> {
  const videoUrl = URL.createObjectURL(videoFile);
  const videoEl = document.createElement("video");
  videoEl.src = videoUrl;
  videoEl.crossOrigin = "anonymous";
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = "auto";
  videoEl.style.position = "fixed";
  videoEl.style.top = "-9999px";
  document.body.appendChild(videoEl);

  try {
    if (videoEl.readyState < 1 || !videoEl.videoWidth) {
      await new Promise<void>((resolve) => {
        videoEl.addEventListener("loadedmetadata", () => resolve(), { once: true });
        setTimeout(resolve, 2000);
      });
    }

    const duration = Math.max(0.5, videoEl.duration || 1);
    const width = Math.min(1280, videoEl.videoWidth || 640);
    const height = Math.min(720, videoEl.videoHeight || 360);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    const frames: ImageData[] = [];
    const count = Math.max(3, Math.min(16, sampleCount));

    for (let s = 0; s < count; s++) {
      const targetTime = ((s + 0.5) / count) * duration;
      videoEl.currentTime = targetTime;
      await new Promise<void>((resolve) => {
        videoEl.addEventListener("seeked", () => resolve(), { once: true });
        setTimeout(resolve, 80);
      });
      ctx.drawImage(videoEl, 0, 0, width, height);
      frames.push(ctx.getImageData(0, 0, width, height));
    }

    return frames;
  } catch (err) {
    console.warn("Failed to sample video frames for learning:", err);
    return [];
  } finally {
    document.body.removeChild(videoEl);
    URL.revokeObjectURL(videoUrl);
  }
}

/**
 * Inpaints an image file and returns the clean image as a Blob.
 */
export async function processWatermarkImage({
  imageFile,
  rois,
  options,
}: ProcessImageOptions): Promise<Blob> {
  const imgUrl = URL.createObjectURL(imageFile);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load source image"));
      el.src = imgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D canvas context");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    inpaintCanvasROIs(ctx, canvas.width, canvas.height, rois, options);

    const mime = imageFile.type === "image/jpeg" ? "image/jpeg" : "image/png";
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export image blob"));
      }, mime, 0.95);
    });
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

/**
 * Extracts and decodes the audio track from a video file into an AudioBuffer.
 */
async function extractAudioBuffer(videoFile: File | Blob): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    const audioCtx = new AudioContextClass();
    try {
      return await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      audioCtx.close().catch(() => {});
    }
  } catch {
    // Video has no audio track or decoding is unsupported
    return null;
  }
}

import { encodeAndMuxAudioWithWebCodecs } from "@/lib/export/webcodecsExport";

/**
 * Fast client-side MP4 header parser: extracts native FPS and total frame count from stts & mdhd boxes.
 */
export async function parseMp4VideoInfo(
  file: File | Blob
): Promise<{ fps: number; totalFrames?: number } | null> {
  try {
    const sliceSize = Math.min(file.size, 512 * 1024);
    const slice = await file.slice(0, sliceSize).arrayBuffer();
    const u8 = new Uint8Array(slice);
    const view = new DataView(slice);

    const findBox = (buf: Uint8Array, tag: string): number => {
      const b0 = tag.charCodeAt(0), b1 = tag.charCodeAt(1), b2 = tag.charCodeAt(2), b3 = tag.charCodeAt(3);
      for (let i = 0; i < buf.length - 8; i++) {
        if (buf[i] === b0 && buf[i + 1] === b1 && buf[i + 2] === b2 && buf[i + 3] === b3) {
          return i;
        }
      }
      return -1;
    };

    let sttsIdx = findBox(u8, "stts");
    let mdhdIdx = findBox(u8, "mdhd");

    // If not found in first slice and file is small enough (< 30MB), read whole buffer
    if ((sttsIdx === -1 || mdhdIdx === -1) && file.size <= 30 * 1024 * 1024) {
      const full = await file.arrayBuffer();
      const fullU8 = new Uint8Array(full);
      const fullView = new DataView(full);
      sttsIdx = findBox(fullU8, "stts");
      mdhdIdx = findBox(fullU8, "mdhd");
      if (sttsIdx !== -1 && mdhdIdx !== -1) {
        const entryCount = fullView.getUint32(sttsIdx + 8);
        if (entryCount > 0) {
          const sampleCount = fullView.getUint32(sttsIdx + 12);
          const sampleDelta = fullView.getUint32(sttsIdx + 16);
          const version = fullU8[mdhdIdx + 4];
          const timescale = version === 1 ? fullView.getUint32(mdhdIdx + 28) : fullView.getUint32(mdhdIdx + 16);
          if (sampleDelta > 0 && timescale > 0) {
            const rawFps = timescale / sampleDelta;
            let fps = Math.round(rawFps * 100) / 100;
            if (Math.abs(rawFps - 23.976) < 0.1 || Math.abs(rawFps - 24) < 0.1) fps = 24;
            else if (Math.abs(rawFps - 25) < 0.1) fps = 25;
            else if (Math.abs(rawFps - 29.97) < 0.1 || Math.abs(rawFps - 30) < 0.1) fps = 30;
            else if (Math.abs(rawFps - 60) < 0.1) fps = 60;
            return { fps, totalFrames: sampleCount };
          }
        }
      }
    } else if (sttsIdx !== -1 && mdhdIdx !== -1) {
      const entryCount = view.getUint32(sttsIdx + 8);
      if (entryCount > 0) {
        const sampleCount = view.getUint32(sttsIdx + 12);
        const sampleDelta = view.getUint32(sttsIdx + 16);
        const version = u8[mdhdIdx + 4];
        const timescale = version === 1 ? view.getUint32(mdhdIdx + 28) : view.getUint32(mdhdIdx + 16);
        if (sampleDelta > 0 && timescale > 0) {
          const rawFps = timescale / sampleDelta;
          let fps = Math.round(rawFps * 100) / 100;
          if (Math.abs(rawFps - 23.976) < 0.1 || Math.abs(rawFps - 24) < 0.1) fps = 24;
          else if (Math.abs(rawFps - 25) < 0.1) fps = 25;
          else if (Math.abs(rawFps - 29.97) < 0.1 || Math.abs(rawFps - 30) < 0.1) fps = 30;
          else if (Math.abs(rawFps - 60) < 0.1) fps = 60;
          return { fps, totalFrames: sampleCount };
        }
      }
    }
  } catch (err) {
    console.warn("Could not parse MP4 frame rate header:", err);
  }
  return null;
}

/**
 * Seeks a video element to a designated timestamp and ensures the browser compositor
 * has fully decoded and rendered the new video frame into the backing texture before resolving.
 */
export async function seekVideoAccurate(video: HTMLVideoElement, targetTime: number): Promise<void> {
  const maxDur = isFinite(video.duration) && video.duration > 0 ? video.duration : 10000;
  const clampedTarget = Math.min(Math.max(0, targetTime), Math.max(0, maxDur - 0.001));

  if (!video.seeking && Math.abs(video.currentTime - clampedTarget) < 0.002) {
    return;
  }

  return new Promise<void>((resolve) => {
    let isDone = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onDone = () => {
      if (isDone) return;
      isDone = true;
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onDone);
      if (timer) clearTimeout(timer);
      resolve();
    };

    const onSeeked = () => {
      if ("requestVideoFrameCallback" in video && typeof (video as any).requestVideoFrameCallback === "function") {
        try {
          (video as any).requestVideoFrameCallback(() => onDone());
          return;
        } catch {}
      }
      onDone();
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onDone, { once: true });

    // 400ms safety timeout: ensures slow frames have enough decoding time and are not skipped
    timer = setTimeout(onDone, 400);

    try {
      video.currentTime = clampedTarget;
    } catch {
      onDone();
    }
  });
}

/**
 * Removes watermark from a video frame-by-frame and exports clean MP4 with hardware acceleration.
 */
export async function processWatermarkVideo({
  videoFile,
  rois,
  options,
  fps = 30,
  onProgress,
  signal,
}: ProcessVideoOptions): Promise<Blob> {
  const videoUrl = URL.createObjectURL(videoFile);
  const videoEl = document.createElement("video");
  videoEl.src = videoUrl;
  videoEl.crossOrigin = "anonymous";
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = "auto";

  // Hide in DOM to retain decoding priority
  videoEl.style.position = "fixed";
  videoEl.style.top = "-9999px";
  videoEl.style.opacity = "0.001";
  document.body.appendChild(videoEl);

  try {
    onProgress?.({
      phase: "preparing",
      percent: 2,
      currentFrame: 0,
      totalFrames: 100,
      fps: 0,
    });

    // Detect exact native frame rate from MP4 metadata if available
    const mp4Info = await parseMp4VideoInfo(videoFile);
    const targetFps = mp4Info?.fps || (fps && fps > 0 ? fps : 30);

    // Wait for metadata
    if (videoEl.readyState < 1 || !videoEl.videoWidth) {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("Failed to load video file")); };
        const cleanup = () => {
          videoEl.removeEventListener("loadedmetadata", onLoaded);
          videoEl.removeEventListener("error", onError);
        };
        videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
        videoEl.addEventListener("error", onError, { once: true });
        setTimeout(() => { cleanup(); resolve(); }, 3000);
      });
    }

    const duration = Math.max(0.1, videoEl.duration || 1);
    let width = videoEl.videoWidth || 1280;
    let height = videoEl.videoHeight || 720;

    // Enforce even dimensions for H.264
    width = width - (width % 2);
    height = height - (height % 2);

    const totalFrames = mp4Info?.totalFrames && Math.abs(mp4Info.totalFrames / targetFps - duration) < 0.6
      ? mp4Info.totalFrames
      : Math.max(1, Math.round(duration * targetFps));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create canvas 2D rendering context");

    // Pre-extract multi-frame temporal masks across the clip for rock-solid stability
    let explicitMasks: (Uint8Array | null)[] | undefined = undefined;
    if (options?.useShapeMask !== false && rois.length > 0) {
      try {
        const sampleCount = Math.min(8, Math.max(3, Math.floor(duration * 2)));
        const sampleFrames: ImageData[] = [];
        for (let s = 0; s < sampleCount; s++) {
          videoEl.currentTime = ((s + 0.5) / sampleCount) * duration;
          await new Promise<void>((r) => {
            videoEl.addEventListener("seeked", () => r(), { once: true });
            setTimeout(r, 60);
          });
          ctx.drawImage(videoEl, 0, 0, width, height);
          sampleFrames.push(ctx.getImageData(0, 0, width, height));
        }

        if (sampleFrames.length >= 3) {
          explicitMasks = rois.map((roi) => {
            const pxRoi = denormalizeROI(roi, width, height);
            const res = extractTemporalWatermarkMask(sampleFrames, pxRoi);
            return res.mask;
          });
        }
      } catch (err) {
        console.warn("Temporal mask pre-pass skipped:", err);
      }
    }

    // Audio extraction
    const audioBuffer = await extractAudioBuffer(videoFile);

    // Check WebCodecs availability
    const hasWebCodecs =
      typeof window !== "undefined" &&
      "VideoEncoder" in window &&
      "VideoFrame" in window;

    if (hasWebCodecs) {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "avc",
          width,
          height,
        },
        audio: audioBuffer
          ? {
              codec: "aac",
              numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
              sampleRate: audioBuffer.sampleRate,
            }
          : undefined,
        fastStart: "in-memory",
        firstTimestampBehavior: "offset",
      });

      // Mux audio first if available
      if (audioBuffer) {
        try {
          await encodeAndMuxAudioWithWebCodecs(audioBuffer, muxer, duration, signal);
        } catch (e) {
          console.warn("Audio encode skipped:", e);
        }
      }

      let encoderError: Error | null = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          try {
            muxer.addVideoChunk(chunk, meta);
          } catch (err) {
            console.error("Error adding chunk to muxer:", err);
          }
        },
        error: (e) => {
          encoderError = e instanceof Error ? e : new Error(String(e));
        },
      });

      // Test AVC codec
      encoder.configure({
        codec: "avc1.4d002a", // H.264 Main Profile
        width,
        height,
        bitrate: Math.min(25_000_000, Math.max(8_000_000, width * height * 4)),
        framerate: targetFps,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      });

      onProgress?.({
        phase: "processing",
        percent: 5,
        currentFrame: 0,
        totalFrames,
        fps: 0,
      });

      const startTime = performance.now();

      for (let i = 0; i < totalFrames; i++) {
        if (signal?.aborted) throw new Error("Export cancelled by user");
        if (encoderError) throw encoderError;

        // Keep encoder queue bounded to prevent memory pressure
        while (encoder.encodeQueueSize > 6) {
          await new Promise((r) => setTimeout(r, 15));
        }

        const targetTime = (i / totalFrames) * duration;
        await seekVideoAccurate(videoEl, targetTime);

        // Draw video frame & inpaint designated watermark ROIs
        ctx.drawImage(videoEl, 0, 0, width, height);
        inpaintCanvasROIs(ctx, width, height, rois, options, explicitMasks);

        const frameDurationUs = Math.round(1_000_000 / targetFps);
        const timestampUs = Math.round(i * frameDurationUs);
        const videoFrame = new VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: frameDurationUs,
        });

        encoder.encode(videoFrame, { keyFrame: i % Math.round(targetFps * 2) === 0 });
        videoFrame.close();

        // Update progress stats
        const elapsed = (performance.now() - startTime) / 1000;
        const currentFps = elapsed > 0 ? (i + 1) / elapsed : 0;
        const percent = Math.min(98, Math.round(5 + ((i + 1) / totalFrames) * 93));

        onProgress?.({
          phase: "processing",
          percent,
          currentFrame: i + 1,
          totalFrames,
          fps: Math.round(currentFps),
        });
      }

      onProgress?.({
        phase: "finalizing",
        percent: 99,
        currentFrame: totalFrames,
        totalFrames,
        fps: 0,
      });

      await encoder.flush();
      encoder.close();
      muxer.finalize();

      onProgress?.({
        phase: "complete",
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        fps: 0,
      });

      return new Blob([target.buffer], { type: "video/mp4" });
    } else {
      // MediaRecorder fallback for browsers without WebCodecs
      return await exportWithMediaRecorder(videoEl, canvas, ctx, rois, options, duration, targetFps, onProgress, signal, explicitMasks);
    }
  } finally {
    document.body.removeChild(videoEl);
    URL.revokeObjectURL(videoUrl);
  }
}

/**
 * Fallback recorder using canvas.captureStream and MediaRecorder.
 */
async function exportWithMediaRecorder(
  videoEl: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rois: NormalizedROI[],
  options?: InpaintOptions,
  duration = 1,
  fps = 30,
  onProgress?: (progress: WatermarkProgress) => void,
  signal?: AbortSignal,
  explicitMasks?: (Uint8Array | null)[]
): Promise<Blob> {
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>(async (resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (e) => reject(new Error("MediaRecorder error: " + e));

    recorder.start();
    const totalFrames = Math.max(1, Math.round(duration * fps));

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (signal?.aborted) {
          recorder.stop();
          throw new Error("Cancelled by user");
        }

        const targetTime = (i / totalFrames) * duration;
        await seekVideoAccurate(videoEl, targetTime);

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        inpaintCanvasROIs(ctx, canvas.width, canvas.height, rois, options, explicitMasks);

        onProgress?.({
          phase: "processing",
          percent: Math.round(((i + 1) / totalFrames) * 98),
          currentFrame: i + 1,
          totalFrames,
          fps,
        });
      }

      recorder.stop();
    } catch (err) {
      reject(err);
    }
  });
}
