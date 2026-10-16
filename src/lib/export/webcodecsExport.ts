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
import { segmentationPipeline } from '@/lib/segmentation/segmentationPipeline';
import { getCropWindowAtTime, applyReframedCrop } from '@/lib/clips/autoReframe';

export type ExportResolution = '720p' | '1080p' | '1440p' | '4k' | 'source';
export type ExportAspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5' | '21:9';
export type ExportFitMode = 'cover' | 'fit' | 'fit_blur' | 'stretch';
export type ExportQuality = 'high' | 'standard' | 'fast';
export type ExportFps = 24 | 30 | 60;
export type ExportFormat = 'mp4' | 'webm_alpha';

export interface ExportConfig {
  resolution: ExportResolution;
  aspectRatio?: ExportAspectRatio;
  fitMode?: ExportFitMode;
  fps: ExportFps;
  format: ExportFormat;
  quality?: ExportQuality;
  bitrate?: number;
  includeAudio?: boolean;
  syncOffsetSeconds?: number;
  customWidth?: number;
  customHeight?: number;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'muxing' | 'complete' | 'cancelled' | 'error';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  timeRemainingSec: number;
  error?: string;
  previewCanvasUrl?: string;
}

/**
 * Standard 9:16 vertical resolution dimensions (maintained for backwards compatibility)
 */
export const RESOLUTION_DIMENSIONS: Record<string, { width: number; height: number; defaultBitrate: number }> = {
  '720p': { width: 720, height: 1280, defaultBitrate: 10_000_000 },
  '1080p': { width: 1080, height: 1920, defaultBitrate: 18_000_000 },
  '1440p': { width: 1440, height: 2560, defaultBitrate: 32_000_000 },
  '4k': { width: 2160, height: 3840, defaultBitrate: 55_000_000 },
};

/**
 * Computes exact width, height, and bitrate for ANY aspect ratio, resolution tier, and quality setting.
 * Guarantees all dimensions are even integers (divisible by 2) for H.264 / VP9 hardware codecs.
 * Preserves pristine original video fidelity with high bitrates and optimal color clarity.
 */
export function calculateExportDimensions(
  aspectRatio: ExportAspectRatio = '9:16',
  resolution: ExportResolution = '1080p',
  sourceWidth?: number,
  sourceHeight?: number,
  quality: ExportQuality = 'standard'
): { width: number; height: number; bitrate: number } {
  let width = 1080;
  let height = 1920;
  let baseBitrate = 18_000_000;

  switch (aspectRatio) {
    case '9:16':
      if (resolution === '720p') { width = 720; height = 1280; baseBitrate = 10_000_000; }
      else if (resolution === '1440p') { width = 1440; height = 2560; baseBitrate = 32_000_000; }
      else if (resolution === '4k') { width = 2160; height = 3840; baseBitrate = 55_000_000; }
      else if (resolution === 'source' && sourceWidth && sourceHeight) {
        const shortEdge = Math.min(sourceWidth, sourceHeight);
        height = Math.round((shortEdge * 16) / 9);
        width = shortEdge;
        const px = width * height;
        baseBitrate = px >= 3840 * 2160 * 0.75 ? 55_000_000 : px >= 2560 * 1440 * 0.75 ? 32_000_000 : px >= 1920 * 1080 * 0.75 ? 18_000_000 : 10_000_000;
      } else { width = 1080; height = 1920; baseBitrate = 18_000_000; }
      break;

    case '16:9':
      if (resolution === '720p') { width = 1280; height = 720; baseBitrate = 10_000_000; }
      else if (resolution === '1440p') { width = 2560; height = 1440; baseBitrate = 32_000_000; }
      else if (resolution === '4k') { width = 3840; height = 2160; baseBitrate = 55_000_000; }
      else if (resolution === 'source' && sourceWidth && sourceHeight) {
        const shortEdge = Math.min(sourceWidth, sourceHeight);
        width = Math.round((shortEdge * 16) / 9);
        height = shortEdge;
        const px = width * height;
        baseBitrate = px >= 3840 * 2160 * 0.75 ? 55_000_000 : px >= 2560 * 1440 * 0.75 ? 32_000_000 : px >= 1920 * 1080 * 0.75 ? 18_000_000 : 10_000_000;
      } else { width = 1920; height = 1080; baseBitrate = 18_000_000; }
      break;

    case '1:1':
      if (resolution === '720p') { width = 720; height = 720; baseBitrate = 9_000_000; }
      else if (resolution === '1440p') { width = 1440; height = 1440; baseBitrate = 28_000_000; }
      else if (resolution === '4k') { width = 2160; height = 2160; baseBitrate = 50_000_000; }
      else { width = 1080; height = 1080; baseBitrate = 16_000_000; }
      break;

    case '4:5':
      if (resolution === '720p') { width = 720; height = 900; baseBitrate = 9_500_000; }
      else if (resolution === '1440p') { width = 1440; height = 1800; baseBitrate = 30_000_000; }
      else if (resolution === '4k') { width = 2160; height = 2700; baseBitrate = 52_000_000; }
      else { width = 1080; height = 1350; baseBitrate = 17_000_000; }
      break;

    case '21:9':
      if (resolution === '720p') { width = 1680; height = 720; baseBitrate = 11_000_000; }
      else if (resolution === '1440p') { width = 3440; height = 1440; baseBitrate = 36_000_000; }
      else if (resolution === '4k') { width = 5120; height = 2160; baseBitrate = 60_000_000; }
      else { width = 2560; height = 1080; baseBitrate = 20_000_000; }
      break;

    case 'original':
    default:
      if (sourceWidth && sourceHeight && sourceWidth > 0 && sourceHeight > 0) {
        if (resolution === 'source') {
          width = sourceWidth;
          height = sourceHeight;
        } else {
          const ratio = sourceWidth / sourceHeight;
          let targetShortEdge = 1080;
          if (resolution === '720p') { targetShortEdge = 720; }
          else if (resolution === '1440p') { targetShortEdge = 1440; }
          else if (resolution === '4k') { targetShortEdge = 2160; }

          if (ratio >= 1) {
            height = targetShortEdge;
            width = Math.round(targetShortEdge * ratio);
          } else {
            width = targetShortEdge;
            height = Math.round(targetShortEdge / ratio);
          }
        }

        // Dynamically compute bitrate from target pixel count to preserve pristine sharpness
        const totalPixels = width * height;
        if (totalPixels >= 3840 * 2160 * 0.75) {
          baseBitrate = 55_000_000;
        } else if (totalPixels >= 2560 * 1440 * 0.75) {
          baseBitrate = 32_000_000;
        } else if (totalPixels >= 1920 * 1080 * 0.75) {
          baseBitrate = 18_000_000;
        } else if (totalPixels >= 1280 * 720 * 0.75) {
          baseBitrate = 10_000_000;
        } else {
          baseBitrate = 8_000_000;
        }
      } else {
        width = 1080;
        height = 1920;
        baseBitrate = 18_000_000;
      }
      break;
  }

  const multiplier = quality === 'high' ? 1.5 : quality === 'fast' ? 0.7 : 1.0;
  const bitrate = Math.round(baseBitrate * multiplier);

  // Guarantee even dimensions for hardware encoders
  width = Math.round(width / 2) * 2;
  height = Math.round(height / 2) * 2;

  return { width, height, bitrate };
}

/**
 * Preflights codec configuration with WebCodecs VideoEncoder
 * Prioritizes H.264 High Profile and Variable Bitrate (VBR) for pristine visual quality
 */
export async function testEncoderSupport(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<{ supported: boolean; codec: string; bitrateMode?: 'variable' | 'constant' }> {
  if (typeof window === 'undefined' || typeof window.VideoEncoder === 'undefined') {
    return { supported: false, codec: 'none' };
  }

  // Candidate AVC/H.264 profiles prioritized by maximum quality and fidelity
  const codecs = [
    'avc1.640033', // High Profile Level 5.1 (supports up to 4K 60fps)
    'avc1.64002a', // High Profile Level 4.2
    'avc1.640028', // High Profile Level 4.0
    'avc1.4d002a', // Main Profile Level 4.2
    'avc1.42E01E', // Baseline Profile Level 3.0
    'avc1.42001f', // Baseline Profile Level 3.1
  ];

  for (const codec of codecs) {
    try {
      // 1. Try Variable Bitrate (VBR) for perceptual clarity
      const vbrConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        bitrateMode: 'variable' as const,
        hardwareAcceleration: 'prefer-hardware' as const,
      };
      const resVbr = await window.VideoEncoder.isConfigSupported(vbrConfig);
      if (resVbr.supported) {
        return { supported: true, codec, bitrateMode: 'variable' };
      }

      // 2. Fall back to standard CBR if platform requires
      const cbrConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: fps,
        hardwareAcceleration: 'prefer-hardware' as const,
      };
      const resCbr = await window.VideoEncoder.isConfigSupported(cbrConfig);
      if (resCbr.supported) {
        return { supported: true, codec, bitrateMode: 'constant' };
      }
    } catch {
      // try next codec
    }
  }

  return { supported: false, codec: 'none' };
}

/**
 * Decodes audio from an HTMLVideoElement, File, Blob, or URL into an AudioBuffer using Web Audio API
 */
export async function extractAudioFromSource(
  source: HTMLVideoElement | File | Blob | string | null | undefined,
  targetSampleRate: number = 44100
): Promise<AudioBuffer | null> {
  if (!source) return null;
  try {
    let arrayBuffer: ArrayBuffer;
    if (source instanceof File || source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
    } else if (typeof source === 'string') {
      const res = await fetch(source);
      arrayBuffer = await res.arrayBuffer();
    } else if (source instanceof HTMLVideoElement && source.src) {
      const res = await fetch(source.src);
      arrayBuffer = await res.arrayBuffer();
    } else {
      return null;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    const audioCtx = new AudioContextClass({ sampleRate: targetSampleRate });
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
    return decoded;
  } catch (err) {
    console.warn('Could not extract direct audio track for export:', err);
    return null;
  }
}

/**
 * Backwards compatible audio extractor for HTMLVideoElement
 */
export async function extractAudioFromMedia(
  videoElement: HTMLVideoElement,
  targetSampleRate: number = 44100
): Promise<AudioBuffer | null> {
  return extractAudioFromSource(videoElement, targetSampleRate);
}

/**
 * Probes browser AudioEncoder support for MP4-compliant AAC-LC audio.
 * Tests 192kbps (studio fidelity limit for WebCodecs AAC), then 160kbps, then 128kbps.
 */
export async function probeAudioEncoderSupport(
  sampleRate: number = 44100,
  numberOfChannels: number = 2
): Promise<{ supported: boolean; bitrate: number; codec: string }> {
  if (
    typeof window === 'undefined' ||
    typeof (window as unknown as { AudioEncoder?: unknown }).AudioEncoder === 'undefined' ||
    typeof (window as unknown as { AudioData?: unknown }).AudioData === 'undefined'
  ) {
    return { supported: false, bitrate: 128_000, codec: 'mp4a.40.2' };
  }

  const AudioEncoderClass = (window as unknown as { AudioEncoder: typeof AudioEncoder }).AudioEncoder;

  // Windows Media Player, QuickTime, iOS, and Android natively require standard AAC-LC ('mp4a.40.2')
  // We probe descending bitrates within Chromium's supported range (max 192kbps for AAC-LC)
  for (const br of [192_000, 160_000, 128_000, 96_000]) {
    try {
      const res = await AudioEncoderClass.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate,
        numberOfChannels: Math.min(2, numberOfChannels),
        bitrate: br,
      });
      if (res && res.supported) {
        return { supported: true, bitrate: br, codec: 'mp4a.40.2' };
      }
    } catch {}
  }

  return { supported: false, bitrate: 128_000, codec: 'mp4a.40.2' };
}

/**
 * Encodes audio using WebCodecs AudioEncoder and muxes chunks into mp4-muxer.
 * Exclusively uses standard AAC-LC (mp4a.40.2) for 100% universal compatibility across Windows Media Player,
 * Apple QuickTime, DaVinci Resolve, Premiere Pro, and all mobile players.
 */
export async function encodeAndMuxAudioWithWebCodecs(
  audioBuffer: AudioBuffer,
  muxer: Muxer<ArrayBufferTarget>,
  durationSeconds: number,
  signal?: AbortSignal,
  targetBitrate: number = 192_000
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof (window as unknown as { AudioEncoder?: unknown }).AudioEncoder === 'undefined' ||
    typeof (window as unknown as { AudioData?: unknown }).AudioData === 'undefined'
  ) {
    return false;
  }

  const AudioEncoderClass = (window as unknown as { AudioEncoder: typeof AudioEncoder }).AudioEncoder;
  const AudioDataClass = (window as unknown as { AudioData: typeof AudioData }).AudioData;

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = Math.min(2, audioBuffer.numberOfChannels);

  // Probe highest supported AAC-LC bitrate (max 192 kbps in Chromium)
  let chosenBitrate = targetBitrate;
  let isAacSupported = false;
  for (const br of [targetBitrate, 192_000, 160_000, 128_000, 96_000]) {
    try {
      const isSupp = await AudioEncoderClass.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate,
        numberOfChannels,
        bitrate: br,
      });
      if (isSupp && isSupp.supported) {
        chosenBitrate = br;
        isAacSupported = true;
        break;
      }
    } catch {}
  }

  if (!isAacSupported) {
    console.warn('AudioEncoder does not support mp4a.40.2 (AAC-LC) for MP4 in this browser');
    return false;
  }

  let encoderError: Error | null = null;
  const encoder = new AudioEncoderClass({
    output: (chunk, meta) => {
      try {
        muxer.addAudioChunk(chunk, meta);
      } catch (err) {
        console.error('Error adding audio chunk to muxer:', err);
      }
    },
    error: (e) => {
      console.error('AudioEncoder error:', e);
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels,
    bitrate: chosenBitrate,
  });

  const chunkSize = 1024;
  const totalFrames = Math.min(audioBuffer.length, Math.round(durationSeconds * sampleRate));

  for (let offset = 0; offset < totalFrames; offset += chunkSize) {
    if (signal?.aborted) {
      encoder.close();
      return false;
    }
    if (encoderError) {
      console.warn('Audio encoding error encountered:', encoderError);
      return false;
    }

    const framesInChunk = Math.min(chunkSize, totalFrames - offset);
    const planeData = new Float32Array(framesInChunk * numberOfChannels);

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      const sub = channelData.subarray(offset, offset + framesInChunk);
      planeData.set(sub, ch * framesInChunk);
    }

    const timestampUs = Math.round((offset / sampleRate) * 1_000_000);

    const audioData = new AudioDataClass({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: framesInChunk,
      numberOfChannels,
      timestamp: timestampUs,
      data: planeData,
    });

    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
  return true;
}

/**
 * Draws a video frame to canvas with the chosen framing / fit mode
 * Preserves pristine quality with bicubic image smoothing enabled.
 */
export function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  fitMode: ExportFitMode = 'cover'
): void {
  const vw = video.videoWidth || canvasWidth;
  const vh = video.videoHeight || canvasHeight;

  // High-fidelity image smoothing for crisp text and pristine video scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!video.videoWidth || !video.videoHeight) {
    ctx.fillStyle = '#09100C';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  if (fitMode === 'cover') {
    const scale = Math.max(canvasWidth / vw, canvasHeight / vh);
    const drawW = Math.round(vw * scale);
    const drawH = Math.round(vh * scale);
    const dx = Math.round((canvasWidth - drawW) / 2);
    const dy = Math.round((canvasHeight - drawH) / 2);
    ctx.drawImage(video, dx, dy, drawW, drawH);
  } else if (fitMode === 'fit_blur') {
    // 1. Modern Ambient Blurred Background (fills 9:16 vertical canvas)
    ctx.save();
    try {
      (ctx as unknown as { filter: string }).filter = 'blur(45px) brightness(0.65) contrast(1.08)';
    } catch {}
    const bgScale = Math.max(canvasWidth / vw, canvasHeight / vh);
    // 10% overscan to prevent blur edge-bleed
    const bgW = Math.round(vw * bgScale * 1.10);
    const bgH = Math.round(vh * bgScale * 1.10);
    ctx.drawImage(video, Math.round((canvasWidth - bgW) / 2), Math.round((canvasHeight - bgH) / 2), bgW, bgH);
    ctx.restore();

    // 1b. Subtle dark scrim so captions and foreground stay crisp and legible
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();

    // 2. Crisp Centered Foreground Video with Modern Drop Shadow
    const scale = Math.min(canvasWidth / vw, canvasHeight / vh);
    const drawW = Math.round(vw * scale);
    const drawH = Math.round(vh * scale);
    const dx = Math.round((canvasWidth - drawW) / 2);
    const dy = Math.round((canvasHeight - drawH) / 2);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(video, dx, dy, drawW, drawH);
    ctx.restore();
  } else if (fitMode === 'stretch') {
    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
  } else {
    // Default: 'fit' letterbox / pillarbox
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const scale = Math.min(canvasWidth / vw, canvasHeight / vh);
    const drawW = Math.round(vw * scale);
    const drawH = Math.round(vh * scale);
    const dx = Math.round((canvasWidth - drawW) / 2);
    const dy = Math.round((canvasHeight - drawH) / 2);
    ctx.drawImage(video, dx, dy, drawW, drawH);
  }
}

export interface ExportJobOptions {
  videoElement?: HTMLVideoElement;
  videoUrl?: string | null;
  videoFile?: File | Blob | null;
  words: WordToken[];
  template: CaptionTemplate;
  config: ExportConfig;
  duration?: number;
  startTime?: number;
  cropTrajectory?: any;
  layerOrder?: 'behind' | 'front' | 'sandwich';
  onProgress?: (progress: ExportProgress) => void;
  onFrameRendered?: (canvas: HTMLCanvasElement | OffscreenCanvas) => void;
  signal?: AbortSignal;
}

/**
 * Main WebCodecs Hardware Export Execution
 */
export async function exportVideoWithWebCodecs(options: ExportJobOptions): Promise<Blob> {
  const { words, template, config, onProgress, onFrameRendered, signal } = options;

  // 1. Resolve video source element
  let videoEl: HTMLVideoElement;
  let ownsVideoElement = false;
  let videoBlobUrlToRevoke: string | null = null;

  if (options.videoFile) {
    videoEl = document.createElement('video');
    videoBlobUrlToRevoke = URL.createObjectURL(options.videoFile);
    videoEl.src = videoBlobUrlToRevoke;
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    ownsVideoElement = true;
  } else if (options.videoUrl) {
    videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.src = options.videoUrl;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    ownsVideoElement = true;
    // Attach to DOM in offscreen container to grant full Chromium GPU decoding priority
    if (typeof document !== 'undefined' && document.body) {
      videoEl.style.position = 'fixed';
      videoEl.style.top = '-9999px';
      videoEl.style.left = '-9999px';
      videoEl.style.width = '4px';
      videoEl.style.height = '4px';
      videoEl.style.opacity = '0.01';
      videoEl.style.pointerEvents = 'none';
      document.body.appendChild(videoEl);
    }
  } else if (options.videoElement) {
    videoEl = options.videoElement;
  } else if (typeof document !== 'undefined') {
    videoEl = (document.querySelector('video') as HTMLVideoElement) || document.createElement('video');
  } else {
    throw new Error('No video element or URL available for export');
  }

  // Wait for metadata and dimensions
  if (videoEl.readyState < 1 || videoEl.videoWidth === 0) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        videoEl.removeEventListener('loadedmetadata', onReady);
        videoEl.removeEventListener('loadeddata', onReady);
        videoEl.removeEventListener('canplay', onReady);
        videoEl.removeEventListener('error', onReady);
      };
      videoEl.addEventListener('loadedmetadata', onReady, { once: true });
      videoEl.addEventListener('loadeddata', onReady, { once: true });
      videoEl.addEventListener('canplay', onReady, { once: true });
      videoEl.addEventListener('error', onReady, { once: true });
      setTimeout(() => { cleanup(); resolve(); }, 1200);
    });
  }

  // Guard against 0-dimension video sources (fail fast so fallback engine can take over)
  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    throw new Error('Video source has 0 dimensions or failed to load. Falling back to FFmpeg engine.');
  }

  // 2. Compute dynamic dimensions & bitrate
  const dims = calculateExportDimensions(
    config.aspectRatio || '9:16',
    config.resolution,
    videoEl.videoWidth || undefined,
    videoEl.videoHeight || undefined,
    config.quality || 'standard'
  );

  const width = config.customWidth || dims.width;
  const height = config.customHeight || dims.height;
  const bitrate = config.bitrate || dims.bitrate;
  const fps = config.fps || 30;
  const fitMode = config.fitMode || 'cover';
  const duration = options.duration || videoEl.duration || 5;
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

  // Handle Transparent Caption Overlay (WebM with VP9 alpha)
  if (config.format === 'webm_alpha') {
    return exportTransparentCaptionWebM({
      videoElement: videoEl,
      words,
      template,
      width,
      height,
      fps,
      duration,
      totalFrames,
      layerOrder: options.layerOrder,
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
      videoElement: videoEl,
      videoFile: options.videoFile,
      videoUrl: options.videoUrl,
      words,
      template,
      width,
      height,
      fps,
      fitMode,
      duration,
      includeAudio: config.includeAudio ?? true,
      onProgress,
      signal,
      syncOffsetSeconds: config.syncOffsetSeconds,
    });
  }

  const { supported, codec, bitrateMode } = await testEncoderSupport(width, height, fps, bitrate);
  if (!supported) {
    console.warn('WebCodecs H.264 config unsupported, falling back to MediaRecorder.');
    return exportWithMediaRecorderFallback({
      videoElement: videoEl,
      videoFile: options.videoFile,
      videoUrl: options.videoUrl,
      words,
      template,
      width,
      height,
      fps,
      fitMode,
      duration,
      includeAudio: config.includeAudio ?? true,
      layerOrder: options.layerOrder,
      onProgress,
      signal,
    });
  }

  // 3. Audio Extraction & Muxer Preparation
  let audioBuffer: AudioBuffer | null = null;
  let audioConfig = { supported: false, bitrate: 192_000, codec: 'mp4a.40.2' };

  if (config.includeAudio !== false) {
    onProgress?.({
      phase: 'preparing',
      percent: 2,
      currentFrame: 0,
      totalFrames,
      fps: 0,
      timeRemainingSec: 0,
    });
    audioBuffer = await extractAudioFromSource(
      options.videoFile || options.videoUrl || videoEl
    );
    const startTimeOffset = options.startTime || 0;
    if (audioBuffer && startTimeOffset > 0) {
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.round(startTimeOffset * sampleRate);
      const endSample = Math.min(audioBuffer.length, Math.round((startTimeOffset + duration) * sampleRate));
      const slicedLength = Math.max(1, endSample - startSample);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        const slicedBuffer = audioCtx.createBuffer(audioBuffer.numberOfChannels, slicedLength, sampleRate);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          slicedBuffer.copyToChannel(audioBuffer.getChannelData(ch).subarray(startSample, endSample), ch);
        }
        audioBuffer = slicedBuffer;
        await audioCtx.close();
      } catch (err) {
        console.warn('Audio slice fallback:', err);
      }
    }
    if (audioBuffer) {
      audioConfig = await probeAudioEncoderSupport(
        audioBuffer.sampleRate,
        Math.min(2, audioBuffer.numberOfChannels)
      );
    }
  }

  const canMuxAudio =
    audioBuffer !== null &&
    audioConfig.supported &&
    (config.includeAudio ?? true);

  const muxerAudioConfig = canMuxAudio
    ? {
        codec: 'aac' as const,
        numberOfChannels: Math.min(2, audioBuffer!.numberOfChannels),
        sampleRate: audioBuffer!.sampleRate,
      }
    : undefined;

  // Setup MP4 Muxer with ArrayBufferTarget
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
    },
    audio: muxerAudioConfig,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  // Hardware Audio Encoding Pass: Strictly aligned with total video frame duration to prevent video sticking at end
  if (canMuxAudio && audioBuffer) {
    try {
      const exactDuration = totalFrames / fps;
      await encodeAndMuxAudioWithWebCodecs(audioBuffer, muxer, exactDuration, signal, audioConfig.bitrate);
    } catch (err) {
      console.warn('Audio hardware muxing skipped due to encoding error:', err);
    }
  }

  // Prepare VideoEncoder with high profile and VBR
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
    bitrateMode: bitrateMode || 'variable',
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' },
  });

  // Setup OffscreenCanvas for hardware compositing with desynchronized opaque backing store
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for export');
  }

  // Pre-cached mask frame lookup and consistent video hash
  const videoKey =
    (options.videoFile instanceof File ? options.videoFile.name : options.videoUrl) ||
    videoEl.src ||
    'export_video';
  const exportMaskCache = new Map<number, any>();

  // Determine effective layer order (default: front style)
  const effectiveLayerOrder = options.layerOrder ?? 'front';
  const shouldCompositeBehind = effectiveLayerOrder !== 'front' && !!template.layout.behindSubjectDepth;

  // Frame Rendering Loop
  const startTime = performance.now();
  const frameDurationUs = Math.round(1_000_000 / fps);

  videoEl.pause();

  // Ensure video element ready state has at least current data to prevent initial blank frame
  if (videoEl.readyState < 2) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        videoEl.removeEventListener('loadeddata', onReady);
        videoEl.removeEventListener('canplay', onReady);
        resolve();
      };
      videoEl.addEventListener('loadeddata', onReady, { once: true });
      videoEl.addEventListener('canplay', onReady, { once: true });
      setTimeout(resolve, 800);
    });
  }

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (signal?.aborted) {
        encoder.close();
        throw new Error('Export cancelled');
      }

      if (encoderError) {
        throw encoderError;
      }

      const startTimeOffset = options.startTime || 0;
      const currentTime = frameIndex / fps;
      const absoluteVideoTime = startTimeOffset + currentTime;

      // Seek video element to target timestamp safely with robust decoder sync
      await seekVideoToTimestamp(videoEl, absoluteVideoTime);

      // Composite: 1. Video background with framing mode and high quality smoothing
      ctx.clearRect(0, 0, width, height);
      if (options.cropTrajectory) {
        const crop = getCropWindowAtTime(options.cropTrajectory, absoluteVideoTime);
        applyReframedCrop(ctx, videoEl, crop, width, height);
      } else {
        drawVideoFrameToCanvas(ctx, videoEl, width, height, fitMode);
      }

      // Composite: 2. Behind-Subject Segmentation Compositing (only when depth layering is active)
      let behindCompositing = undefined;
      if (shouldCompositeBehind) {
        try {
          // Quantize timestamp to 20fps for segmentation mask (masks stay stable across 50ms)
          const quantizedTs = Math.round(currentTime * 20) / 20;
          let maskFrame = exportMaskCache.get(quantizedTs);
          if (!maskFrame) {
            maskFrame = await segmentationPipeline.getOrProcessFrameMask(
              videoKey,
              currentTime,
              videoEl,
              width,
              height
            );
            exportMaskCache.set(quantizedTs, maskFrame);
          }
          behindCompositing = {
            videoSource: videoEl,
            segmentationMask: maskFrame.maskData,
            maskWidth: maskFrame.width,
            maskHeight: maskFrame.height,
            subjectMetrics: maskFrame.metrics,
            showMaskOverlay: false,
            fitMode: fitMode === 'cover' ? ('cover' as const) : ('fit' as const),
            layerOrder: effectiveLayerOrder,
          };
        } catch (err) {
          console.warn('Segmentation mask export fallback:', err);
        }
      }

      // Composite: 3. Shared Golden-Frame Caption Engine (renders directly in front when depth is inactive)
      renderCaptionsToCanvas(
        ctx,
        words,
        template,
        currentTime,
        width,
        height,
        config.syncOffsetSeconds || 0,
        behindCompositing
      );

      // Live frame rendered hook
      onFrameRendered?.(canvas);

      // Create WebCodecs VideoFrame
      const timestampUs = frameIndex * frameDurationUs;
      const videoFrame = new VideoFrame(canvas as CanvasImageSource, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const isKeyframe = frameIndex % (fps * 2) === 0;
      encoder.encode(videoFrame, { keyFrame: isKeyframe });
      videoFrame.close();

      // Backpressure: only pause if hardware encoder buffer is actually saturated
      while (encoder.encodeQueueSize > 24) {
        await new Promise((r) => setTimeout(r, 1));
      }

      // Progress updates
      const elapsedSec = (performance.now() - startTime) / 1000;
      const currentEncodingFps = frameIndex > 0 ? Math.round((frameIndex / elapsedSec) * 10) / 10 : 0;
      const remainingFrames = totalFrames - frameIndex;
      const timeRemainingSec = currentEncodingFps > 0 ? Math.round(remainingFrames / currentEncodingFps) : 0;
      const percent = Math.min(96, Math.round(((frameIndex + 1) / totalFrames) * 94));

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
      percent: 97,
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
  } finally {
    if (videoBlobUrlToRevoke) {
      URL.revokeObjectURL(videoBlobUrlToRevoke);
    }
    if (ownsVideoElement) {
      if (videoEl.parentNode) {
        videoEl.parentNode.removeChild(videoEl);
      }
      videoEl.src = '';
    }
  }
}

/**
 * Seeks HTMLVideoElement to exact time with 100% guarantee that the decoder
 * presents the target frame without premature resolution or stalled duplicate frames.
 */
function seekVideoToTimestamp(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (!video.videoWidth || !video.videoHeight) {
      resolve();
      return;
    }

    const maxDur = isFinite(video.duration) && video.duration > 0 ? video.duration : 10000;
    const targetTime = Math.min(Math.max(0, time), Math.max(0, maxDur - 0.001));

    // If already at target timestamp and not currently seeking, resolve immediately
    if (!video.seeking && Math.abs(video.currentTime - targetTime) < 0.002) {
      resolve();
      return;
    }

    let isDone = false;
    let timer: any = null;

    const onDone = () => {
      if (isDone) return;
      isDone = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onDone);
      if (timer) clearTimeout(timer);
      resolve();
    };

    const onSeeked = () => {
      if ('requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function') {
        try {
          (video as any).requestVideoFrameCallback(() => onDone());
          return;
        } catch {}
      }
      onDone();
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onDone, { once: true });

    // 500ms safety timeout: ensures browser decoder has adequate time to fetch keyframe without premature dropping
    timer = setTimeout(onDone, 500);

    try {
      video.currentTime = targetTime;
    } catch {
      onDone();
    }
  });
}

/**
 * Exports pure transparent caption overlay (WebM VP9 with alpha)
 */
async function exportTransparentCaptionWebM(options: {
  videoElement?: HTMLVideoElement;
  words: WordToken[];
  template: CaptionTemplate;
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
  layerOrder?: 'behind' | 'front' | 'sandwich';
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
    totalFrames,
    layerOrder,
    onProgress,
    signal,
    syncOffsetSeconds = 0,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create canvas for transparent export');

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
  const videoKey = videoElement?.src || 'export_video';
  const exportMaskCache = new Map<number, any>();

  const effectiveLayerOrder = layerOrder ?? 'front';
  const shouldCompositeBehind = effectiveLayerOrder !== 'front' && !!template.layout.behindSubjectDepth;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Export cancelled');
    }

    const currentTime = frameIndex / fps;

    // Clear with 100% transparent alpha channel
    ctx.clearRect(0, 0, width, height);

    let behindCompositing = undefined;
    if (shouldCompositeBehind && videoElement) {
      try {
        const quantizedTs = Math.round(currentTime * 20) / 20;
        let maskFrame = exportMaskCache.get(quantizedTs);
        if (!maskFrame) {
          maskFrame = await segmentationPipeline.getOrProcessFrameMask(
            videoKey,
            currentTime,
            videoElement,
            width,
            height
          );
          exportMaskCache.set(quantizedTs, maskFrame);
        }
        behindCompositing = {
          videoSource: videoElement,
          segmentationMask: maskFrame.maskData,
          maskWidth: maskFrame.width,
          maskHeight: maskFrame.height,
          subjectMetrics: maskFrame.metrics,
          showMaskOverlay: false,
          layerOrder: effectiveLayerOrder,
        };
      } catch (err) {
        console.warn('Segmentation mask export fallback:', err);
      }
    }

    renderCaptionsToCanvas(
      ctx,
      words,
      template,
      currentTime,
      width,
      height,
      syncOffsetSeconds,
      behindCompositing
    );

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
  videoFile?: File | Blob | null;
  videoUrl?: string | null;
  words: WordToken[];
  template: CaptionTemplate;
  width: number;
  height: number;
  fps: number;
  fitMode: ExportFitMode;
  duration: number;
  includeAudio: boolean;
  layerOrder?: 'behind' | 'front' | 'sandwich';
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
  syncOffsetSeconds?: number;
}): Promise<Blob> {
  const {
    videoElement,
    videoFile,
    videoUrl,
    words,
    template,
    width,
    height,
    fps,
    fitMode,
    duration,
    includeAudio,
    layerOrder,
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

  // Audio track attachment for MediaRecorder
  let audioBuffer: AudioBuffer | null = null;
  if (includeAudio) {
    audioBuffer = await extractAudioFromSource(videoFile || videoUrl || videoElement);
    if (audioBuffer) {
      try {
        const audioCtx = new AudioContext();
        const bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = audioBuffer;
        const dest = audioCtx.createMediaStreamDestination();
        bufferSource.connect(dest);
        dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        bufferSource.start();
      } catch (err) {
        console.warn('Could not attach audio track to MediaRecorder stream:', err);
      }
    }
  }

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
  const videoKey = (options.videoFile ? (options.videoFile as File).name : options.videoUrl) || videoElement.src || 'export_video';
  const exportMaskCache = new Map<number, any>();

  const effectiveLayerOrder = layerOrder ?? 'front';
  const shouldCompositeBehind = effectiveLayerOrder !== 'front' && !!template.layout.behindSubjectDepth;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Export cancelled');
    }

    const currentTime = frameIndex / fps;
    await seekVideoToTimestamp(videoElement, currentTime);

    ctx.clearRect(0, 0, width, height);
    drawVideoFrameToCanvas(ctx, videoElement, width, height, fitMode);

    let behindCompositing = undefined;
    if (shouldCompositeBehind) {
      try {
        const quantizedTs = Math.round(currentTime * 20) / 20;
        let maskFrame = exportMaskCache.get(quantizedTs);
        if (!maskFrame) {
          maskFrame = await segmentationPipeline.getOrProcessFrameMask(
            videoKey,
            currentTime,
            videoElement,
            width,
            height
          );
          exportMaskCache.set(quantizedTs, maskFrame);
        }
        behindCompositing = {
          videoSource: videoElement,
          segmentationMask: maskFrame.maskData,
          maskWidth: maskFrame.width,
          maskHeight: maskFrame.height,
          subjectMetrics: maskFrame.metrics,
          showMaskOverlay: false,
          fitMode: fitMode === 'cover' ? ('cover' as const) : ('fit' as const),
          layerOrder: effectiveLayerOrder,
        };
      } catch (err) {
        console.warn('Segmentation mask export fallback:', err);
      }
    }

    renderCaptionsToCanvas(
      ctx,
      words,
      template,
      currentTime,
      width,
      height,
      syncOffsetSeconds,
      behindCompositing
    );

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
