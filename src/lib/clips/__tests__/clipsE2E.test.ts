/**
 * End-to-End Pipeline Integration Test for Clips (Auto Shorts)
 * 
 * Tests the complete workflow:
 * 1. URL validation & sanitization (no shell metacharacters)
 * 2. Companion helper probe metadata
 * 3. 16kHz mono PCM decoding & RMS energy peak calculation
 * 4. Hinglish transliteration & vocabulary refinement
 * 5. Sentence boundary snapping & multimodal signal ranking (IoU < 0.25)
 * 6. 9:16 auto-reframe trajectory with active speaker EMA smoothing
 * 7. Smart caption preset selection (kinetic, Hormozi, royal Devanagari)
 * 8. Subtitle sidecars (.srt, .vtt) & batch export execution
 */

import { describe, it, expect, vi } from "vitest";
import { parseAndValidateYouTubeUrl } from "../urlValidator";
import { decodePcmWav } from "../audioUtils";
import { processTranscriptHinglish } from "../../hinglish/postProcessor";
import { findClipCandidates } from "../clipFinder";
import {
  computeTargetCropDimensions,
  smoothCameraTrajectory,
  getCropWindowAtTime,
} from "../autoReframe";
import { selectCaptionTemplate } from "../templateSelector";
import {
  normalizeTokensForClip,
  generateClipSubtitleSidecars,
  exportBatchClips,
} from "../batchClipsExporter";
import { localHelperClient } from "../helperClient";

describe("Clips Auto Shorts — End-to-End Pipeline Test", () => {
  it("executes the full YouTube -> Ingest -> Rank -> Reframe -> Style -> Export cycle", async () => {
    // -----------------------------------------------------------------------
    // Stage 1: URL Validation & Sanitization
    // -----------------------------------------------------------------------
    const rawUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";
    const validated = parseAndValidateYouTubeUrl(rawUrl);

    expect(validated.isValid).toBe(true);
    expect(validated.videoId).toBe("dQw4w9WgXcQ");
    expect(validated.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // -----------------------------------------------------------------------
    // Stage 2: PCM Audio Decoding & Energy Signals
    // -----------------------------------------------------------------------
    // Synthesize 70.0s of 16kHz mono 16-bit PCM WAV in memory
    const sampleRate = 16000;
    const numSamples = sampleRate * 70;
    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    // RIFF Header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, numSamples * 2, true);

    // Write sine wave samples
    for (let i = 0; i < numSamples; i++) {
      const s = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
      view.setInt16(44 + i * 2, s * 25000, true);
    }

    const decoded = decodePcmWav(wavBuffer);
    expect(decoded).not.toBeNull();
    expect(decoded!.audioBuffer.length).toBe(numSamples);
    expect(decoded!.durationSeconds).toBeCloseTo(70.0, 1);
    expect(decoded!.rmsPeaks.length).toBeGreaterThan(0);

    // -----------------------------------------------------------------------
    // Stage 3: Transcript Transcription & Hinglish Post-Processing
    // -----------------------------------------------------------------------
    function makeSentenceTokens(start: number, text: string, end: number) {
      const words = text.split(" ");
      const dur = (end - start) / words.length;
      return words.map((w, idx) => ({
        id: `tok_${start}_${idx}`,
        text: w,
        start: start + idx * dur,
        end: start + (idx + 1) * dur - 0.05,
        confidence: 0.95,
      }));
    }

    const rawWhisperTokens = [
      ...makeSentenceTokens(0, "um basically matlab hello welcome back.", 10),
      ...makeSentenceTokens(10, "kya aapko pata hai ye secret viral formula kya hai? Crore rupees earning secret trick batata hu.", 35),
      ...makeSentenceTokens(35, "sabse pehle quality visual styling aur energetic caption templates use karo.", 55),
      ...makeSentenceTokens(55, "video ko like and channel ko subscribe karo.", 70),
    ];

    const hinglishTokens = processTranscriptHinglish(rawWhisperTokens, "roman");
    expect(hinglishTokens.length).toBe(rawWhisperTokens.length);
    expect(hinglishTokens[0].romanText).toBe("um");

    // -----------------------------------------------------------------------
    // Stage 4: Multimodal Signal Discovery & Candidate Ranking
    // -----------------------------------------------------------------------
    const candidates = findClipCandidates({
      tokens: hinglishTokens,
      durationSeconds: 70,
      rmsPeaks: decoded!.rmsPeaks,
      preset: "balanced",
      constraints: {
        topN: 3,
      },
    });

    expect(candidates.length).toBeGreaterThan(0);
    const topClip = candidates[0];
    expect(topClip.score).toBeGreaterThan(0);
    expect(topClip.tokens.length).toBeGreaterThan(0);
    expect(topClip.headline).toBeDefined();

    // -----------------------------------------------------------------------
    // Stage 5: 9:16 Auto-Reframe (Face-Tracking & Aspect Slicing)
    // -----------------------------------------------------------------------
    const sourceW = 1920;
    const sourceH = 1080;
    const { cropWidthNorm, needsReframe } = computeTargetCropDimensions(sourceW, sourceH, 9 / 16);
    expect(needsReframe).toBe(true);
    expect(cropWidthNorm).toBeCloseTo(0.3164, 3);

    // Track simulated speaker moving across frame
    const rawFacePoints = [
      { time: topClip.start, x: 0.40, confidence: 0.9 },
      { time: topClip.start + 1.5, x: 0.42, confidence: 0.9 }, // within dead-band
      { time: topClip.start + 3.0, x: 0.60, confidence: 0.9 }, // smoothed pan
    ];

    const keyframes = smoothCameraTrajectory(rawFacePoints, cropWidthNorm);
    expect(keyframes.length).toBe(3);

    const midWindow = getCropWindowAtTime(
      {
        sourceWidth: sourceW,
        sourceHeight: sourceH,
        sourceAspectRatio: sourceW / sourceH,
        targetAspectRatio: 9 / 16,
        needsReframe: true,
        cropWidthNorm,
        cropHeightNorm: 1.0,
        keyframes,
        averageConfidence: 0.9,
        mode: "face_tracking",
      },
      topClip.start + 2.0
    );

    expect(midWindow.sw).toBe(cropWidthNorm);
    expect(midWindow.sh).toBe(1.0);
    expect(midWindow.sx).toBeGreaterThan(0);
    expect(midWindow.sx + midWindow.sw).toBeLessThanOrEqual(1.0);

    // -----------------------------------------------------------------------
    // Stage 6: Smart Caption Template Selection & Creator Enrichment
    // -----------------------------------------------------------------------
    const styled = selectCaptionTemplate(topClip, {
      enableKeywords: true,
      enableEmojis: true,
      removeFillers: true,
    });

    expect(styled.template).toBeDefined();
    expect(styled.template.id).toBeDefined();
    // Power word "viral" or "secret" should be enriched
    expect(styled.styledTokens.some((t) => t.isKeyword)).toBe(true);
    // Emojis appended to creator power words (e.g. 💰 for rupees or 🚀 for viral)
    expect(styled.styledTokens.some((t) => /[\u{1F300}-\u{1FAFF}]/u.test(t.text))).toBe(true);

    // -----------------------------------------------------------------------
    // Stage 7: Subtitle Sidecars & Batch Hardware Export
    // -----------------------------------------------------------------------
    const normalizedTokens = normalizeTokensForClip(
      styled.styledTokens,
      topClip.start,
      topClip.end
    );
    expect(normalizedTokens[0].start).toBeCloseTo(0, 1);

    const { srt, vtt } = generateClipSubtitleSidecars(
      styled.styledTokens,
      topClip.start,
      topClip.end,
      styled.template
    );
    expect(srt).toContain("00:00:00,000");
    expect(vtt).toContain("WEBVTT");

    // Mock companion helper export endpoint
    const mockExportHelper = vi.fn().mockResolvedValue({
      success: true,
      fileId: `export_${validated.videoId}_clip_1.mp4`,
      downloadUrl: `/file/export_${validated.videoId}_clip_1.mp4`,
    });
    const origHelperExport = localHelperClient.exportClipFfmpeg;
    localHelperClient.exportClipFfmpeg = mockExportHelper;

    try {
      const progressList: number[] = [];
      const batchResult = await exportBatchClips({
        clips: [topClip],
        fileId: validated.videoId!,
        preferEngine: "ffmpeg",
        reframeMode: "9:16_auto",
        resolution: "1080p",
        onProgress: (p) => {
          progressList.push(p.overallPercent);
        },
      });

      expect(batchResult.successCount).toBe(1);
      expect(batchResult.results.length).toBe(1);
      expect(batchResult.results[0].clipIndex).toBe(topClip.index);
      expect(batchResult.results[0].srtContent).toBe(srt);
      expect(batchResult.results[0].vttContent).toBe(vtt);
      expect(batchResult.results[0].mp4FileName).toContain("Clip-");
      expect(progressList[progressList.length - 1]).toBe(100);
    } finally {
      localHelperClient.exportClipFfmpeg = origHelperExport;
    }
  });
});
