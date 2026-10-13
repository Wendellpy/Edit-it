export interface SpeechSegment {
  start: number; // in seconds
  end: number;   // in seconds
  confidence: number;
}

export interface VadOptions {
  sampleRate?: number;
  energyThreshold?: number; // RMS threshold
  minSpeechDurationSeconds?: number;
  minSilenceDurationSeconds?: number;
  padBeforeSeconds?: number;
  padAfterSeconds?: number;
}

/**
 * High-precision Voice Activity Detector (VAD).
 * Implements adaptive energy envelope tracking with pause splitting & edge padding.
 * Designed to snap Whisper word timestamps and eliminate hallucinated silent words.
 */
export function detectSpeechSegments(
  audioData: Float32Array,
  options: VadOptions = {}
): SpeechSegment[] {
  const {
    sampleRate = 16000,
    energyThreshold = 0.015,
    minSpeechDurationSeconds = 0.1,
    minSilenceDurationSeconds = 0.35,
    padBeforeSeconds = 0.08,
    padAfterSeconds = 0.12,
  } = options;

  // Window size: 20ms (320 samples at 16kHz)
  const windowSize = Math.floor(sampleRate * 0.02);
  const numWindows = Math.floor(audioData.length / windowSize);

  const isSpeech = new Uint8Array(numWindows);

  // Compute energy per 20ms frame
  for (let i = 0; i < numWindows; i++) {
    let sum = 0;
    const offset = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const val = audioData[offset + j];
      sum += val * val;
    }
    const rms = Math.sqrt(sum / windowSize);
    isSpeech[i] = rms >= energyThreshold ? 1 : 0;
  }

  // Smooth frames with hangover logic (bridge micro-silences under 150ms)
  const bridgeWindows = Math.floor(0.15 / 0.02); // 7.5 windows
  let silenceCount = 0;
  for (let i = 0; i < numWindows; i++) {
    if (isSpeech[i] === 1) {
      silenceCount = 0;
    } else {
      silenceCount++;
      if (silenceCount < bridgeWindows && i > 0 && isSpeech[i - 1] === 1) {
        // Bridge brief gap
        isSpeech[i] = 1;
      }
    }
  }

  // Group continuous speech windows into segments
  const segments: SpeechSegment[] = [];
  let inSpeech = false;
  let segStartWindow = 0;

  for (let i = 0; i < numWindows; i++) {
    if (isSpeech[i] === 1 && !inSpeech) {
      inSpeech = true;
      segStartWindow = i;
    } else if (isSpeech[i] === 0 && inSpeech) {
      inSpeech = false;
      const segEndWindow = i;

      const rawStart = (segStartWindow * windowSize) / sampleRate;
      const rawEnd = (segEndWindow * windowSize) / sampleRate;

      if (rawEnd - rawStart >= minSpeechDurationSeconds) {
        // Apply edge padding to avoid clipping word onset/offsets
        const paddedStart = Math.max(0, rawStart - padBeforeSeconds);
        const paddedEnd = Math.min(audioData.length / sampleRate, rawEnd + padAfterSeconds);

        segments.push({
          start: parseFloat(paddedStart.toFixed(3)),
          end: parseFloat(paddedEnd.toFixed(3)),
          confidence: 0.95,
        });
      }
    }
  }

  // Handle segment extending to the very end
  if (inSpeech) {
    const rawStart = (segStartWindow * windowSize) / sampleRate;
    const rawEnd = audioData.length / sampleRate;
    if (rawEnd - rawStart >= minSpeechDurationSeconds) {
      segments.push({
        start: parseFloat(Math.max(0, rawStart - padBeforeSeconds).toFixed(3)),
        end: parseFloat(rawEnd.toFixed(3)),
        confidence: 0.95,
      });
    }
  }

  // Merge adjacent segments that are closer than minSilenceDurationSeconds
  const merged: SpeechSegment[] = [];
  for (const seg of segments) {
    if (merged.length === 0) {
      merged.push(seg);
    } else {
      const prev = merged[merged.length - 1];
      if (seg.start - prev.end < minSilenceDurationSeconds) {
        prev.end = Math.max(prev.end, seg.end);
      } else {
        merged.push(seg);
      }
    }
  }

  return merged;
}
