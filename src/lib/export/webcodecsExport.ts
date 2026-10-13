/**
 * BolSub Studio Local WebCodecs Hardware Export Pipeline
 * 100% on-device hardware accelerated encoding via WebCodecs (VideoEncoder/VideoDecoder)
 * and MP4 container muxing (mp4-muxer).
 *
 * Guaranteed 0 cloud dependencies, 0 network requests, 0 API costs.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { WordToken } from '@/lib/timestampRefiner';
import type { CaptionTemplate } from '@/lib/templates/schema';
import { renderCaptionsToCanvas } from '@/lib/renderer/captionRenderer';

export type ExportResolution = '720p' | '1080p' | '1440p' | '4k';
export type ExportFormat = 'mp4' | 'webm_alpha';

export interface ExportConfig {
  resolution: ExportResolution;
  fps: 30 | 60;
  format: ExportFormat;
  bitrate?: number;
  syncOffsetSeconds?: number;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'muxing' | 'complete' | 'cancelled' | 'error';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  timeRemainingSec: number;
  error?: string;
}

export const RESOLUTION_DIMENSIONS: Record<ExportResolution, { width: number; height: number; defaultBitrate: number }> = {
  '720p': { width: 720, height: 1280, defaultBitrate: 4_500_000 },
  '1080p': { width: 1080, height: 1920, defaultBitrate: 8_500_000 },
  '1440p': { width: 1440, height: 2560, defaultBitrate: 15_000_000 },
  '4k': { width: 2160, height: 3840, defaultBitrate: 28_000_000 },
};

/**
 * Preflights codec configuration with WebCodecs VideoEncoder
 */
export async function testEncoderSupport(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<{ supported: boolean; codec: string }> {
  if (typeof window === 'undefined' || typeof window.VideoEncoder === 'undefined') {
    return { supported: false, codec: 'none' };
  }

  // Candidate AVC/H.264 profiles
  const codecs = [
    'avc1.4d002a', // Main Profile Level 4.2
    'avc1.640028', // High Profile Level 4.0
    'avc1.42E01E', // Baseline Profile Level 3.0
    'avc1.42001f', // Baseline Profile Level 3.1
  ];

  for (const codec of codecs) {
    try {
      const config = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: 'prefer-hardware' as const,
      };
      const res = await window.VideoEncoder.isConfigSupported(config);
      if (res.supported) {
        return { supported: true, codec };
      }
    } catch {
      // try next codec
    }
  }

  return { supported: false, codec: 'none' };
}

/**
 * Extracts and decodes audio samples from an HTMLVideoElement or AudioBuffer
 */
export async function extractAudioFromMedia(
  videoElement: HTMLVideoElement,
  targetSampleRate: number = 44100
): Promise<AudioBuffer | null> {
  try {
    const src = videoElement.src;
    if (!src) return null;

    const res = await fetch(src);
    const arrayBuffer = await res.arrayBuffer();

    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      sampleRate: targetSampleRate,
    });
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
    return decoded;
  } catch (err) {
    console.warn('Could not extract direct audio track for export:', err);
    return null;
  }
}

export interface ExportJobOptions {
  videoElement: HTMLVideoElement;
  words: WordToken[];
  template: CaptionTemplate;
  config: ExportConfig;
  duration?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * Main WebCodecs Hardware Export Execution
 */
export async function exportVideoWithWebCodecs(options: ExportJobOptions): Promise<Blob> {
  const { videoElement, words, template, config, onProgress, signal } = options;
  const { width, height, defaultBitrate } = RESOLUTION_DIMENSIONS[config.resolution];
  const fps = config.fps;
  const bitrate = config.bitrate || defaultBitrate;
  const duration = options.duration || videoElement.duration || 5;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  if (signal?.aborted) {
    throw new Error('Export cancelled by user');
  }

  onProgress?.({
    phase: 'preparing',
    percent: 0,
    currentFrame: 0,
    totalFrames,
    fps: 0,
    timeRemainingSec: 0,
  });

  // Handle Transparent Caption Overlay (WebM with VP9 alpha or Canvas stream)
  if (config.format === 'webm_alpha') {
    return exportTransparentCaptionWebM({
      words,
      template,
      width,
      height,
      fps,
      duration,
      totalFrames,
      onProgress,
      signal,
      syncOffsetSeconds: config.syncOffsetSeconds,
    });
  }

  // Preflight WebCodecs
  const isWebCodecsAvailable =
    typeof window !== 'undefined' &&
    typeof window.VideoEncoder !== 'undefined' &&
    typeof window.VideoFrame !== 'undefined';

  if (!isWebCodecsAvailable) {
    console.warn('WebCodecs not supported in this browser, falling back to MediaRecorder.');
    return exportWithMediaRecorderFallback({
      videoElement,
      words,
      template,
      width,
      height,
      fps,
      duration,
      onProgress,
      signal,
      syncOffsetSeconds: config.syncOffsetSeconds,
    });
  }

  const { supported, codec } = await testEncoderSupport(width, height, fps, bitrate);
  if (!supported) {
    console.warn('WebCodecs H.264 config unsupported, falling back to MediaRecorder.');
    return exportWithMediaRecorderFallback({
      videoElement,
      words,
      template,
      width,
      height,
      fps,
      duration,
      onProgress,
      signal,
    });
  }

  // Setup MP4 Muxer with ArrayBufferTarget
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  });

  // Prepare VideoEncoder
  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (err) {
        console.error('Error adding chunk to muxer:', err);
      }
    },
    error: (e) => {
      console.error('VideoEncoder error:', e);
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  encoder.configure({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' },
  });

  // Setup OffscreenCanvas (or hidden DOM canvas) for hardware compositing
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });

  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for export');
  }

  // Frame Rendering Loop
  const startTime = performance.now();
  const frameDurationUs = Math.round(1_000_000 / fps);

  videoElement.pause();

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      encoder.close();
      throw new Error('Export cancelled');
    }

    if (encoderError) {
      throw encoderError;
    }

    const currentTime = frameIndex / fps;

    // Seek video element to target timestamp
    await seekVideoToTimestamp(videoElement, currentTime);

    // Composite: 1. Video background
    ctx.clearRect(0, 0, width, height);
    try {
      ctx.drawImage(videoElement, 0, 0, width, height);
    } catch {
      // If video frame draw fails, fill with neutral dark backdrop
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }

    // Composite: 2. Shared Golden-Frame Caption Engine
    renderCaptionsToCanvas(ctx, words, template, currentTime, width, height, config.syncOffsetSeconds || 0);

    // Create WebCodecs VideoFrame
    const timestampUs = frameIndex * frameDurationUs;
    const videoFrame = new VideoFrame(canvas as CanvasImageSource, {
      timestamp: timestampUs,
      duration: frameDurationUs,
    });

    const isKeyframe = frameIndex % (fps * 2) === 0;
    encoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    // Backpressure: prevent queue bloat to maintain low memory consumption
    while (encoder.encodeQueueSize > 5) {
      await new Promise((r) => setTimeout(r, 8));
    }

    // Progress updates
    const elapsedSec = (performance.now() - startTime) / 1000;
    const currentEncodingFps = frameIndex > 0 ? Math.round((frameIndex / elapsedSec) * 10) / 10 : 0;
    const remainingFrames = totalFrames - frameIndex;
    const timeRemainingSec = currentEncodingFps > 0 ? Math.round(remainingFrames / currentEncodingFps) : 0;
    const percent = Math.min(99, Math.round(((frameIndex + 1) / totalFrames) * 95));

    onProgress?.({
      phase: 'rendering',
      percent,
      currentFrame: frameIndex + 1,
      totalFrames,
      fps: currentEncodingFps,
      timeRemainingSec,
    });
  }

  // Finalize VideoEncoder
  onProgress?.({
    phase: 'muxing',
    percent: 96,
    currentFrame: totalFrames,
    totalFrames,
    fps: 0,
    timeRemainingSec: 1,
  });

  await encoder.flush();
  encoder.close();

  // Finalize MP4 Muxer
  muxer.finalize();
  const buffer = target.buffer;
  const mp4Blob = new Blob([buffer], { type: 'video/mp4' });

  onProgress?.({
    phase: 'complete',
    percent: 100,
    currentFrame: totalFrames,
    totalFrames,
    fps: 0,
    timeRemainingSec: 0,
  });

  return mp4Blob;
}

/**
 * Seeks HTMLVideoElement to exact time and waits for seeked event
 */
function seekVideoToTimestamp(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));

    // Fallback safety timeout if seeked doesn't fire
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 150);
  });
}

/**
 * Exports pure transparent caption overlay (WebM VP9 with alpha)
 * Ideal for Premiere Pro, DaVinci Resolve, Final Cut Pro editors.
 */
async function exportTransparentCaptionWebM(options: {
  words: WordToken[];
  template: CaptionTemplate;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
  syncOffsetSeconds?: number;
}): Promise<Blob> {
  const {
    words,
    template,
    width,
    height,
    fps,
    totalFrames,
    onProgress,
    signal,
    syncOffsetSeconds = 0,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create canvas for transparent export');

  // Use MediaRecorder on canvas stream
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const startTime = performance.now();
  const frameIntervalMs = 1000 / fps;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Export cancelled');
    }

    const currentTime = frameIndex / fps;

    // Clear with 100% transparent alpha channel
    ctx.clearRect(0, 0, width, height);
    renderCaptionsToCanvas(ctx, words, template, currentTime, width, height, syncOffsetSeconds);

    const elapsedSec = (performance.now() - startTime) / 1000;
    const currentFps = frameIndex > 0 ? Math.round((frameIndex / elapsedSec) * 10) / 10 : 0;
    const timeRemaining = currentFps > 0 ? Math.round((totalFrames - frameIndex) / currentFps) : 0;

    onProgress?.({
      phase: 'rendering',
      percent: Math.min(98, Math.round((frameIndex / totalFrames) * 98)),
      currentFrame: frameIndex + 1,
      totalFrames,
      fps: currentFps,
      timeRemainingSec: timeRemaining,
    });

    await new Promise((r) => setTimeout(r, frameIntervalMs * 0.4));
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      onProgress?.({
        phase: 'complete',
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        fps: 0,
        timeRemainingSec: 0,
      });
      resolve(blob);
    };
    recorder.stop();
  });
}

/**
 * Universal MediaRecorder fallback for browsers without WebCodecs VideoEncoder
 */
async function exportWithMediaRecorderFallback(options: {
  videoElement: HTMLVideoElement;
  words: WordToken[];
  template: CaptionTemplate;
  width: number;
  height: number;
  fps: number;
  duration: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
  syncOffsetSeconds?: number;
}): Promise<Blob> {
  const {
    videoElement,
    words,
    template,
    width,
    height,
    fps,
    duration,
    onProgress,
    signal,
    syncOffsetSeconds = 0,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const stream = canvas.captureStream(fps);
  const preferredMime = MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
    ? 'video/webm;codecs=h264'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const startTime = performance.now();

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Export cancelled');
    }

    const currentTime = frameIndex / fps;
    await seekVideoToTimestamp(videoElement, currentTime);

    ctx.clearRect(0, 0, width, height);
    try {
      ctx.drawImage(videoElement, 0, 0, width, height);
    } catch {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }

    renderCaptionsToCanvas(ctx, words, template, currentTime, width, height, syncOffsetSeconds);

    const elapsed = (performance.now() - startTime) / 1000;
    const curFps = frameIndex > 0 ? Math.round((frameIndex / elapsed) * 10) / 10 : 0;
    const timeRemaining = curFps > 0 ? Math.round((totalFrames - frameIndex) / curFps) : 0;

    onProgress?.({
      phase: 'rendering',
      percent: Math.min(98, Math.round((frameIndex / totalFrames) * 98)),
      currentFrame: frameIndex + 1,
      totalFrames,
      fps: curFps,
      timeRemainingSec: timeRemaining,
    });

    await new Promise((r) => setTimeout(r, 10));
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: preferredMime });
      onProgress?.({
        phase: 'complete',
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        fps: 0,
        timeRemainingSec: 0,
      });
      resolve(blob);
    };
    recorder.stop();
  });
}
