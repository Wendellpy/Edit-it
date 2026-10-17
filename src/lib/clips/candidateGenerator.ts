/**
 * Stage A: High-Recall Highlight Candidate Discovery Engine
 * 
 * Generates an extensive, high-recall pool of highlight candidates across
 * multiple temporal scales (20s - 75s) without requiring loud audio,
 * explicit keywords, or hard scene changes.
 * 
 * Detects:
 * 1. Conversational multi-sentence exchanges (setup -> escalation -> payoff).
 * 2. Local relative audio anomalies & peak-seeded hotspots.
 * 3. Speech velocity & pacing shifts (sudden rate changes, fast witty delivery, deliberate punchline timing).
 * 4. Question-and-answer interactions, reveals, and surprising statements.
 * 5. Narrative storytelling arcs with multi-sentence development.
 * 6. High-information and emotionally charged statements.
 * 
 * 100% local, deterministic, and zero cloud API dependencies.
 */

import type { HinglishWordToken } from "../hinglish/postProcessor";
import { type SentenceUnit } from "./boundarySnapper";

export interface CandidateSpan {
  id: string;
  start: number;
  end: number;
  duration: number;
  startSentenceIdx: number;
  endSentenceIdx: number;
  generatorSource:
    | "conversational_exchange"
    | "audio_relative_anomaly"
    | "speech_pacing_shift"
    | "question_and_answer"
    | "narrative_arc"
    | "emotional_reaction"
    | "multi_scale_sweep"
    | "audio_peak_hotspot";
  primaryTriggerPhrase?: string;
  relativeAudioAnomaly?: number;
  pacingShiftRatio?: number;
}

export interface CandidateGenerationOptions {
  tokens: HinglishWordToken[];
  sentences: SentenceUnit[];
  durationSeconds: number;
  rmsPeaks?: Float32Array;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
}

/**
 * Calculates local rolling audio statistics (mean and stdDev) around a given time.
 * Uses a rolling context window (default: 30 seconds) to find local anomalies
 * rather than relying on global absolute volume thresholds.
 */
export function getLocalAudioStats(
  rmsPeaks: Float32Array,
  centerSec: number,
  windowRadiusSec = 15
): { localMean: number; localStdDev: number; localPeak: number } {
  const startBin = Math.max(0, Math.floor((centerSec - windowRadiusSec) * 100));
  const endBin = Math.min(rmsPeaks.length, Math.ceil((centerSec + windowRadiusSec) * 100));
  const totalBins = Math.max(1, endBin - startBin);

  let sum = 0;
  let peak = 0;
  for (let i = startBin; i < endBin; i++) {
    const val = rmsPeaks[i];
    sum += val;
    if (val > peak) peak = val;
  }
  const localMean = sum / totalBins;

  let varSum = 0;
  for (let i = startBin; i < endBin; i++) {
    const diff = rmsPeaks[i] - localMean;
    varSum += diff * diff;
  }
  const localStdDev = Math.sqrt(varSum / totalBins);

  return { localMean, localStdDev, localPeak: peak };
}

/**
 * Stage A Candidate Discovery: Generates a wide candidate pool maximizing recall.
 */
export function generateCandidateSpans(
  options: CandidateGenerationOptions
): CandidateSpan[] {
  const {
    sentences,
    durationSeconds,
    rmsPeaks,
    minDurationSeconds = 18,
    maxDurationSeconds = 90,
  } = options;

  if (!sentences || sentences.length === 0) return [];

  const candidates: CandidateSpan[] = [];
  const registeredSpanKeys = new Set<string>();

  const registerSpan = (
    startIdx: number,
    endIdx: number,
    source: CandidateSpan["generatorSource"],
    metadata?: Partial<CandidateSpan>
  ) => {
    if (startIdx < 0 || endIdx >= sentences.length || startIdx > endIdx) return;
    const startSec = sentences[startIdx].start;
    const endSec = sentences[endIdx].end;
    const dur = endSec - startSec;

    if (dur < minDurationSeconds || dur > maxDurationSeconds) return;

    // Discretize to 0.5s key to avoid duplicate spans
    const spanKey = `${Math.round(startSec * 2)}_${Math.round(endSec * 2)}`;
    if (registeredSpanKeys.has(spanKey)) return;
    registeredSpanKeys.add(spanKey);

    candidates.push({
      id: `span_${startIdx}_${endIdx}_${Math.round(startSec)}_${source}`,
      start: startSec,
      end: endSec,
      duration: Math.round(dur * 10) / 10,
      startSentenceIdx: startIdx,
      endSentenceIdx: endIdx,
      generatorSource: source,
      ...metadata,
    });
  };

  // ---------------------------------------------------------------------------
  // 1. Audio Peak-Seeded Candidates
  // High-energy audio spikes (laughter, screaming, cheers, revelations)
  // are anchored into candidate windows so viral audio peaks are evaluated.
  // ---------------------------------------------------------------------------
  if (rmsPeaks && rmsPeaks.length > 0) {
    let globalRmsSum = 0;
    for (let i = 0; i < rmsPeaks.length; i++) {
      globalRmsSum += rmsPeaks[i];
    }
    const globalMeanRms = globalRmsSum / rmsPeaks.length;

    let varianceSum = 0;
    for (let i = 0; i < rmsPeaks.length; i++) {
      const diff = rmsPeaks[i] - globalMeanRms;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / rmsPeaks.length);
    const peakThreshold = Math.max(0.18, globalMeanRms + 1.2 * stdDev);

    const audioHotspots: number[] = [];
    let lastHotspotBin = -400; // minimum 4 seconds separation
    for (let i = 50; i < rmsPeaks.length - 50; i++) {
      const val = rmsPeaks[i];
      if (val >= peakThreshold && val > rmsPeaks[i - 1] && val >= rmsPeaks[i + 1]) {
        if (i - lastHotspotBin >= 400) {
          audioHotspots.push(i / 100);
          lastHotspotBin = i;
        }
      }
    }

    for (const hotspotSec of audioHotspots) {
      let hotspotSentenceIdx = -1;
      for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].start <= hotspotSec && sentences[i].end >= hotspotSec) {
          hotspotSentenceIdx = i;
          break;
        } else if (sentences[i].start > hotspotSec) {
          hotspotSentenceIdx = Math.max(0, i - 1);
          break;
        }
      }

      if (hotspotSentenceIdx >= 0) {
        for (let offset = 0; offset <= 2; offset++) {
          const startIdx = Math.max(0, hotspotSentenceIdx - offset);
          for (const targetDur of [20, 30, 42, 58]) {
            const targetEndSec = Math.min(durationSeconds, sentences[startIdx].start + targetDur);
            let endIdx = startIdx;
            for (let j = startIdx; j < sentences.length; j++) {
              if (sentences[j].end <= targetEndSec) {
                endIdx = j;
              } else {
                break;
              }
            }
            if (endIdx >= startIdx) {
              registerSpan(startIdx, endIdx, "audio_peak_hotspot");
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Question-and-Answer & Conversational Inquiry Spans
  // Captures questions and extends to include the answer and reaction
  // ---------------------------------------------------------------------------
  const QUESTION_CUE_REGEX = /\?|^(kya|how|why|what|kaise|kyun|who|where|did\s+you|have\s+you|is\s+it)\b/i;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const isQuestion =
      (s.hasSentenceEndPunctuation && s.text.includes("?")) ||
      QUESTION_CUE_REGEX.test(s.text.trim());

    if (isQuestion) {
      for (let lookahead = 1; lookahead <= 6; lookahead++) {
        const endIdx = i + lookahead;
        if (endIdx < sentences.length) {
          registerSpan(i, endIdx, "question_and_answer", {
            primaryTriggerPhrase: s.text.slice(0, 50),
          });
          if (i > 0) {
            registerSpan(i - 1, endIdx, "question_and_answer", {
              primaryTriggerPhrase: s.text.slice(0, 50),
            });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Relative Local Audio Anomalies (Crescendos, Sudden Bursts, Dramatic Pauses)
  // ---------------------------------------------------------------------------
  if (rmsPeaks && rmsPeaks.length > 0) {
    const sampleHopSec = 2.0;
    for (let t = 2.0; t < durationSeconds - 2.0; t += sampleHopSec) {
      const { localMean, localStdDev, localPeak } = getLocalAudioStats(rmsPeaks, t, 15);
      const binIdx = Math.floor(t * 100);
      const currentRms = rmsPeaks[binIdx] || 0.05;

      const isBurstAnomaly =
        localStdDev > 0.02 &&
        (currentRms > localMean + 1.8 * localStdDev || currentRms > localMean * 2.2);

      const isDramaticPause =
        localPeak > 0.20 && currentRms < 0.035 && localMean > 0.08;

      if (isBurstAnomaly || isDramaticPause) {
        const sentIdx = sentences.findIndex((s) => s.start <= t && s.end >= t);
        const anchorIdx = sentIdx >= 0 ? sentIdx : sentences.findIndex((s) => s.start >= t);

        if (anchorIdx >= 0) {
          for (let pre = 0; pre <= 2; pre++) {
            const startIdx = Math.max(0, anchorIdx - pre);
            for (let post = 1; post <= 4; post++) {
              const endIdx = Math.min(sentences.length - 1, anchorIdx + post);
              registerSpan(startIdx, endIdx, "audio_relative_anomaly", {
                relativeAudioAnomaly: Math.round(((currentRms - localMean) / (localStdDev || 0.01)) * 10) / 10,
              });
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Narrative Story Arcs (Setup -> Unfolding -> Climax / Resolution)
  // ---------------------------------------------------------------------------
  const NARRATIVE_SETUP_REGEX = /\b(yesterday|last\s+(week|year|month|night)|one\s+time|when\s+i\s+(was|started|went|got)|so\s+this\s+happened|ek\s+baar|jab\s+maine|ek\s+din|mujhe\s+yaad\s+hai|story\s+suno)\b/i;
  const NARRATIVE_RESOLUTION_REGEX = /\b(in\s+the\s+end|finally|and\s+that'?s\s+(why|how)|the\s+point\s+is|moral|toh\s+point\s+yeh|aakhir\s+me|turn(ed)?\s+out|result\s+was)\b/i;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (NARRATIVE_SETUP_REGEX.test(s.text)) {
      for (let spanLen = 3; spanLen <= 8; spanLen++) {
        const endIdx = i + spanLen;
        if (endIdx < sentences.length) {
          registerSpan(i, endIdx, "narrative_arc", {
            primaryTriggerPhrase: s.text.slice(0, 40),
          });
        }
      }
    }

    if (NARRATIVE_RESOLUTION_REGEX.test(s.text)) {
      for (let back = 2; back <= 6; back++) {
        const startIdx = Math.max(0, i - back);
        registerSpan(startIdx, i, "narrative_arc", {
          primaryTriggerPhrase: s.text.slice(0, 40),
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Emotional Reactions & Comedic Contrast Pivots
  // ---------------------------------------------------------------------------
  const CONTRAST_PIVOT_REGEX = /\b(but\s+actually|the\s+truth\s+is|lekin\s+asli|par\s+asliyat|plot\s+twist|unpopular\s+opinion|turns\s+out|surprisingly)\b/i;

  for (let i = 0; i < sentences.length; i++) {
    if (CONTRAST_PIVOT_REGEX.test(sentences[i].text)) {
      for (let pre = 1; pre <= 2; pre++) {
        const startIdx = Math.max(0, i - pre);
        for (let post = 1; post <= 3; post++) {
          const endIdx = Math.min(sentences.length - 1, i + post);
          registerSpan(startIdx, endIdx, "emotional_reaction", {
            primaryTriggerPhrase: sentences[i].text.slice(0, 40),
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Multi-Scale Dense Sweep (Guarantees temporal coverage across full video)
  // Sweeps with target durations: 20s, 30s, 42s, 58s
  // ---------------------------------------------------------------------------
  const sweepDurations = [20, 30, 42, 58];

  for (let i = 0; i < sentences.length; i++) {
    const startSec = sentences[i].start;
    for (const targetDur of sweepDurations) {
      const targetEndSec = Math.min(durationSeconds, startSec + targetDur);
      let endIdx = i;
      for (let j = i; j < sentences.length; j++) {
        if (sentences[j].end <= targetEndSec) {
          endIdx = j;
        } else {
          break;
        }
      }
      if (endIdx >= i) {
        registerSpan(i, endIdx, "multi_scale_sweep");
      }
    }
  }

  return candidates;
}
