/**
 * Local-First User Feedback & Evaluation Store
 * 
 * Allows users to record feedback on clip selections:
 * - "good_clip" (True Positive)
 * - "bad_clip" (False Positive)
 * - "missed_highlight" (False Negative)
 * - "bad_boundaries" (Good event, suboptimal start/end cut)
 * 
 * Stores data 100% locally in browser localStorage / IndexedDB.
 * Provides metrics computation for evaluation benchmarking:
 * - Recall@K
 * - Precision@K
 * - F1-Score
 * - Duplicate Rate
 * - Timeline Diversity Index
 * - Boundary Error (mean start/end delta in seconds)
 */

export type ClipFeedbackType =
  | "good_clip"
  | "bad_clip"
  | "missed_highlight"
  | "bad_boundaries";

export interface ClipFeedbackRecord {
  id: string;
  videoId: string;
  clipId?: string;
  feedbackType: ClipFeedbackType;
  timestamp: number;
  start?: number;
  end?: number;
  suggestedStart?: number;
  suggestedEnd?: number;
  notes?: string;
  presetUsed?: string;
}

export interface EvaluationBenchmarkMetrics {
  totalGroundTruth: number;
  totalReturned: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precisionAtK: number; // Precision@K [0.0, 1.0]
  recallAtK: number; // Recall@K [0.0, 1.0]
  f1Score: number; // Harmonic mean of Precision and Recall
  duplicateRate: number; // Fraction of returned clips overlapping existing picks [0.0, 1.0]
  timelineDiversityIndex: number; // Normalized spread across video timeline [0.0, 1.0]
  meanBoundaryDeltaSeconds: number; // Average seconds off from ground truth boundary
}

const STORAGE_KEY = "bolsub_clips_user_feedback_v1";
let inMemoryRecords: ClipFeedbackRecord[] = [];

export class FeedbackStore {
  /**
   * Retrieves all stored feedback records locally.
   */
  static getAll(): ClipFeedbackRecord[] {
    if (typeof window === "undefined" || !window.localStorage) {
      return [...inMemoryRecords];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [...inMemoryRecords];
    } catch {
      return [...inMemoryRecords];
    }
  }

  /**
   * Saves a new user feedback record locally.
   */
  static save(record: Omit<ClipFeedbackRecord, "id" | "timestamp">): ClipFeedbackRecord {
    const fullRecord: ClipFeedbackRecord = {
      ...record,
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    inMemoryRecords.push(fullRecord);

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const existing = this.getAll();
        if (!existing.some((r) => r.id === fullRecord.id)) {
          existing.push(fullRecord);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      } catch (err) {
        console.warn("Could not save clip feedback locally:", err);
      }
    }

    return fullRecord;
  }

  /**
   * Clears feedback history.
   */
  static clear(): void {
    inMemoryRecords = [];
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  /**
   * Evaluates returned candidates against ground-truth highlight segments.
   */
  static computeBenchmarkMetrics(
    groundTruths: Array<{ start: number; end: number; id?: string }>,
    returnedClips: Array<{ start: number; end: number; id?: string }>,
    totalDurationSeconds: number,
    iouMatchThreshold = 0.35
  ): EvaluationBenchmarkMetrics {
    const totalGroundTruth = groundTruths.length;
    const totalReturned = returnedClips.length;

    if (totalGroundTruth === 0 || totalReturned === 0) {
      return {
        totalGroundTruth,
        totalReturned,
        truePositives: 0,
        falsePositives: totalReturned,
        falseNegatives: totalGroundTruth,
        precisionAtK: 0,
        recallAtK: 0,
        f1Score: 0,
        duplicateRate: 0,
        timelineDiversityIndex: 0,
        meanBoundaryDeltaSeconds: 0,
      };
    }

    let truePositives = 0;
    let totalBoundaryDelta = 0;
    const matchedGtIndices = new Set<number>();

    for (const clip of returnedClips) {
      let bestIoU = 0;
      let bestGtIdx = -1;
      let minDelta = Infinity;

      for (let g = 0; g < groundTruths.length; g++) {
        const gt = groundTruths[g];
        const overlapStart = Math.max(clip.start, gt.start);
        const overlapEnd = Math.min(clip.end, gt.end);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        const union = Math.max(clip.end, gt.end) - Math.min(clip.start, gt.start);
        const iou = union > 0 ? overlap / union : 0;

        if (iou > bestIoU) {
          bestIoU = iou;
          bestGtIdx = g;
          minDelta = Math.abs(clip.start - gt.start) + Math.abs(clip.end - gt.end);
        }
      }

      if (bestIoU >= iouMatchThreshold && bestGtIdx >= 0 && !matchedGtIndices.has(bestGtIdx)) {
        truePositives++;
        matchedGtIndices.add(bestGtIdx);
        totalBoundaryDelta += minDelta;
      }
    }

    const falsePositives = totalReturned - truePositives;
    const falseNegatives = totalGroundTruth - truePositives;

    const precisionAtK = Math.round((truePositives / totalReturned) * 100) / 100;
    const recallAtK = Math.round((truePositives / totalGroundTruth) * 100) / 100;
    const f1Score =
      precisionAtK + recallAtK > 0
        ? Math.round(((2 * precisionAtK * recallAtK) / (precisionAtK + recallAtK)) * 100) / 100
        : 0;

    // Duplicate Rate: count pairs of returned clips with temporal IoU > 0.35
    let duplicateCount = 0;
    for (let i = 0; i < returnedClips.length; i++) {
      for (let j = i + 1; j < returnedClips.length; j++) {
        const cA = returnedClips[i];
        const cB = returnedClips[j];
        const ovStart = Math.max(cA.start, cB.start);
        const ovEnd = Math.min(cA.end, cB.end);
        const ov = Math.max(0, ovEnd - ovStart);
        const un = Math.max(cA.end, cB.end) - Math.min(cA.start, cB.start);
        if (un > 0 && ov / un > 0.35) {
          duplicateCount++;
        }
      }
    }
    const duplicateRate =
      totalReturned > 1
        ? Math.round((duplicateCount / ((totalReturned * (totalReturned - 1)) / 2)) * 100) / 100
        : 0;

    // Timeline Diversity: Measure bucket coverage across 5 equal video sectors
    const numSectors = 5;
    const sectorDuration = Math.max(1, totalDurationSeconds / numSectors);
    const coveredSectors = new Set<number>();
    for (const clip of returnedClips) {
      const sector = Math.min(numSectors - 1, Math.floor(clip.start / sectorDuration));
      coveredSectors.add(sector);
    }
    const timelineDiversityIndex = Math.round((coveredSectors.size / numSectors) * 100) / 100;

    const meanBoundaryDeltaSeconds =
      truePositives > 0 ? Math.round((totalBoundaryDelta / (truePositives * 2)) * 10) / 10 : 0;

    return {
      totalGroundTruth,
      totalReturned,
      truePositives,
      falsePositives,
      falseNegatives,
      precisionAtK,
      recallAtK,
      f1Score,
      duplicateRate,
      timelineDiversityIndex,
      meanBoundaryDeltaSeconds,
    };
  }
}

export interface FlexibleClipFeedbackInput {
  videoId: string;
  clipId?: string;
  feedbackType?: ClipFeedbackType;
  rating?: ClipFeedbackType;
  start?: number;
  clipStart?: number;
  end?: number;
  clipEnd?: number;
  suggestedStart?: number;
  actualBestStart?: number;
  suggestedEnd?: number;
  actualBestEnd?: number;
  notes?: string;
  comment?: string;
  presetUsed?: string;
}

export function recordClipFeedback(
  input: FlexibleClipFeedbackInput
): ClipFeedbackRecord {
  const normalized: Omit<ClipFeedbackRecord, "id" | "timestamp"> = {
    videoId: input.videoId,
    clipId: input.clipId,
    feedbackType: input.feedbackType || input.rating || "good_clip",
    start: input.start ?? input.clipStart,
    end: input.end ?? input.clipEnd,
    suggestedStart: input.suggestedStart ?? input.actualBestStart,
    suggestedEnd: input.suggestedEnd ?? input.actualBestEnd,
    notes: input.notes ?? input.comment,
    presetUsed: input.presetUsed,
  };
  return FeedbackStore.save(normalized);
}

export function loadClipFeedbackRecords(): ClipFeedbackRecord[] {
  return FeedbackStore.getAll();
}

export function clearClipFeedbackRecords(): void {
  FeedbackStore.clear();
}

export function calculateEvaluationMetrics(
  videoId: string,
  returnedClips: Array<{ start: number; end: number }>,
  totalDurationSeconds: number
): EvaluationBenchmarkMetrics & { totalFeedbackCount: number } {
  const records = FeedbackStore.getAll().filter((r) => r.videoId === videoId);
  const groundTruths = records
    .filter(
      (r) =>
        r.feedbackType === "good_clip" ||
        r.feedbackType === "missed_highlight" ||
        r.feedbackType === "bad_boundaries"
    )
    .map((r) => ({
      start: r.suggestedStart ?? r.start ?? 0,
      end: r.suggestedEnd ?? r.end ?? 0,
    }));

  const metrics = FeedbackStore.computeBenchmarkMetrics(
    groundTruths,
    returnedClips,
    totalDurationSeconds
  );

  return {
    ...metrics,
    totalFeedbackCount: records.length,
  };
}
