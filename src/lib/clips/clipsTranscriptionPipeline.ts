/**
 * Clips Ingestion & Transcription Pipeline
 * Connects OPFS chunked streaming download to the local Whisper ASR engine,
 * VAD boundary refiner, and Hinglish post-processing with zero cloud dependencies.
 */

import { localHelperClient } from "./helperClient";
import { opfsVideoStorage } from "./opfsVideoStorage";
import { decodePcmWav, type DecodedAudioPcm } from "./audioUtils";
import { extractAndResampleAudio } from "../audioPipeline";
import { LocalWhisperPipeline, type TranscriptionProgress } from "../whisper";
import type { WordToken } from "../timestampRefiner";
import { processTranscriptHinglish, type HinglishWordToken } from "../hinglish/postProcessor";
import { censorCurseWord, cleanCaptionWord, isArtifactWord } from "../smart/audioCleanup";
import type { ModelTierId } from "../modelManager";
import type { VideoProbeResult } from "./types";

export interface PipelineStageProgress {
  stage: "idle" | "probing" | "downloading" | "extracting_audio" | "transcribing" | "complete" | "error";
  percent: number;
  message: string;
  detail?: string;
}

export interface ClipsIngestionOptions {
  url: string;
  tierId?: ModelTierId;
  language?: string;
  preferWebGPU?: boolean;
  onProgress?: (progress: PipelineStageProgress) => void;
  probeResult?: VideoProbeResult;
  quality?: "4k" | "1440p" | "1080p" | "720p" | "source";
}

export interface ClipsIngestionResult {
  fileId: string;
  videoTitle: string;
  durationSeconds: number;
  tokens: HinglishWordToken[];
  audioBuffer: Float32Array;
  rmsPeaks: Float32Array;
  properNouns: string[];
  sourceUrl: string;
  deviceUsed: "webgpu" | "wasm";
}

export class ClipsTranscriptionPipeline {
  /**
   * Runs the full download-to-transcription workflow locally.
   */
  static async ingestAndTranscribe(options: ClipsIngestionOptions): Promise<ClipsIngestionResult> {
    const {
      url,
      tierId = "balanced",
      language = "auto",
      preferWebGPU = true,
      onProgress,
      probeResult: initialProbe,
      quality = "1080p",
    } = options;

    const report = (stage: PipelineStageProgress["stage"], percent: number, message: string, detail?: string) => {
      onProgress?.({ stage, percent, message, detail });
    };

    // Parallel fast-path: Query YouTube captions hint concurrently (1-2s, runs while download starts)
    const captionsHintPromise = localHelperClient.getCaptionsHint(url).catch(() => ({
      success: false,
      text: "",
      properNouns: [] as string[],
      timedWords: [] as Array<{ text: string; start: number; end: number }>,
    }));

    // 1. Probe video if not provided
    let probe = initialProbe;
    if (!probe) {
      report("probing", 5, "Probing video details from YouTube...");
      probe = await localHelperClient.probeVideo(url);
    }

    const videoTitle = probe.title || "YouTube Video";
    const durationSeconds = probe.duration || 0;

    // 2. Initiate Download via Local Helper
    report("downloading", 10, `Requesting ${quality} video from local companion helper...`);

    const dlResponse = await localHelperClient.startDownload({
      url,
      quality,
    });

    const fileId = dlResponse.fileId || probe.id;

    // Listen to SSE download progress if not already cached
    if (!dlResponse.cached) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = localHelperClient.subscribeToProgress((event) => {
          if (event.fileId === fileId || event.jobId === dlResponse.jobId) {
            if (event.status === "downloading") {
              const pct = Math.min(40, 10 + Math.round((event.progressPercent / 100) * 30));
              report("downloading", pct, `Downloading video: ${event.progressPercent}% (${event.speed || ""})`);
            } else if (event.status === "merging") {
              report("downloading", 40, "Merging audio and video tracks via local FFmpeg...");
            } else if (event.status === "ready") {
              cleanup();
              resolve();
            } else if (event.status === "error") {
              cleanup();
              reject(new Error(event.error || "Video download failed"));
            }
          }
        });

        // Safety timeout (10 mins)
        setTimeout(() => {
          cleanup();
          resolve();
        }, 600000);
      });
    }

    report("downloading", 45, "Streaming video into browser OPFS storage...");

    // 3. Stream into OPFS if not already stored
    const alreadyInOpfs = await opfsVideoStorage.hasVideo(fileId);
    if (!alreadyInOpfs) {
      const fileUrl = localHelperClient.getFileUrl(fileId);
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error(`Failed to stream video file from helper: HTTP ${res.status}`);
      }
      await opfsVideoStorage.streamResponseToOpfs(fileId, res, (written, total) => {
        if (total) {
          const pct = Math.min(50, 45 + Math.round((written / total) * 5));
          report("downloading", pct, `Saving video to local OPFS: ${Math.round((written / total) * 100)}%`);
        }
      });
    }

    // 4. Audio Extraction & Captions Hint (Run in parallel)
    report("extracting_audio", 50, "Extracting audio for local Whisper analysis...");

    const [audioResult, captionsHint] = await Promise.all([
      this.extractAudioForFile(fileId),
      captionsHintPromise,
    ]);

    // 5. High-Precision Acoustic Word Timestamps (YouTube ground-truth or local Whisper ASR)
    let wordsTokens: WordToken[] = [];
    let detectedLang = language === "auto" ? "hi" : language;
    let deviceUsed: "webgpu" | "wasm" = "wasm";

    if (captionsHint?.timedWords && captionsHint.timedWords.length > 5) {
      report("transcribing", 80, `Using ${captionsHint.timedWords.length} frame-accurate word timestamps from YouTube audio...`);
      const validTimedWords = captionsHint.timedWords
        .map((tw) => ({
          ...tw,
          text: cleanCaptionWord(tw.text),
        }))
        .filter((tw) => tw.text && !isArtifactWord(tw.text));

      // Sort strictly chronologically
      validTimedWords.sort((a, b) => a.start - b.start || a.end - b.end);

      // Deduplicate identical words within sliding temporal window (0.45s)
      const dedupedTimedWords: typeof validTimedWords = [];
      for (const tw of validTimedWords) {
        const norm = tw.text.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!norm) continue;

        let isDup = false;
        for (let j = dedupedTimedWords.length - 1; j >= 0; j--) {
          const prev = dedupedTimedWords[j];
          if (tw.start - prev.start > 0.45) break;
          if (prev.text.toLowerCase().replace(/[^a-z0-9]/g, "") === norm) {
            isDup = true;
            break;
          }
        }

        if (!isDup) {
          dedupedTimedWords.push(tw);
        }
      }

      wordsTokens = dedupedTimedWords.map((tw, idx) => ({
        id: `yt_tok_${idx}_${Date.now()}`,
        text: censorCurseWord(tw.text),
        start: tw.start,
        end: tw.end,
        confidence: 0.99,
      }));
    } else {
      report("transcribing", 60, "Running local Whisper ASR on device...");

      const whisperResult = await LocalWhisperPipeline.transcribeAudio(audioResult.audioBuffer, {
        tierId,
        language,
        preferWebGPU,
        onProgress: (p: TranscriptionProgress) => {
          const mappedPercent = Math.min(95, 60 + Math.round((p.progressPercent / 100) * 35));
          report("transcribing", mappedPercent, p.message || "Transcribing speech...", p.deviceUsed);
        },
      });
      wordsTokens = whisperResult.words;
      detectedLang = whisperResult.languageDetected;
      deviceUsed = whisperResult.deviceUsed;
    }

    // 6. Hinglish Post-Processing & Creator Vocabulary Matching
    report("transcribing", 96, "Refining Hinglish words and creator terminology...");

    const properNouns = captionsHint.properNouns || [];
    let hinglishTokens = processTranscriptHinglish(wordsTokens, "roman");

    // Apply proper noun hints from creator captions
    if (properNouns.length > 0) {
      const properNounMap = new Map<string, string>();
      for (const pn of properNouns) {
        properNounMap.set(pn.toLowerCase(), pn);
      }

      hinglishTokens = hinglishTokens.map((tok) => {
        const clean = tok.text.replace(/[^a-zA-Z]/g, "").toLowerCase();
        if (properNounMap.has(clean)) {
          const originalProper = properNounMap.get(clean)!;
          return {
            ...tok,
            text: originalProper,
            romanText: originalProper,
          };
        }
        return tok;
      });
    }

    report("complete", 100, `Ready! Transcribed ${hinglishTokens.length} words.`);

    return {
      fileId,
      videoTitle,
      durationSeconds: durationSeconds || (wordsTokens.length > 0 ? wordsTokens[wordsTokens.length - 1].end : 0),
      tokens: hinglishTokens,
      audioBuffer: audioResult.audioBuffer,
      rmsPeaks: audioResult.rmsPeaks,
      properNouns,
      sourceUrl: url,
      deviceUsed,
    };
  }

  /**
   * Extracts audio either via local helper FFmpeg (fast path) or in-browser OfflineAudioContext (fallback).
   */
  private static async extractAudioForFile(fileId: string): Promise<DecodedAudioPcm> {
    try {
      // 1. Try Helper FFmpeg fast-path
      const extracted = await localHelperClient.extractAudio(fileId);
      if (extracted?.audioFileId) {
        const wavUrl = localHelperClient.getFileUrl(extracted.audioFileId);
        const res = await fetch(wavUrl);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const decoded = decodePcmWav(ab);
          if (decoded && decoded.audioBuffer.length > 0) {
            return decoded;
          }
        }
      }
    } catch {
      // Fallback to browser decoding
    }

    // 2. In-browser WebAudio Fallback
    const file = await opfsVideoStorage.getVideoFile(fileId);
    if (!file) {
      throw new Error("Could not find video file in OPFS or helper cache.");
    }

    const browserResampled = await extractAndResampleAudio(file);
    return {
      audioBuffer: browserResampled.audioBuffer,
      sampleRate: 16000,
      durationSeconds: browserResampled.durationSeconds,
      rmsPeaks: browserResampled.rmsPeaks,
    };
  }
}
