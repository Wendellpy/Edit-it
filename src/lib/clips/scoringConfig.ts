/**
 * Transparent Clip Potential Scoring Configuration
 * Provides customizable, rule-based weights for different content styles.
 * 100% local, zero token costs.
 */

export type ClipStylePreset = "balanced" | "informative" | "funny" | "dramatic";

export interface ScoringWeights {
  // Hook weights (0 - 100)
  questionOpener: number;
  boldClaim: number;
  numberHook: number;
  contrastHook: number;
  storyOpener: number;

  // Signal weights (0 - 100)
  audioLoudnessPeak: number;
  speechPaceOptimal: number;
  laughterOrCheer: number;
  keywordDensity: number;
  sentimentIntensity: number;

  // Penalties
  fillerPenaltyWeight: number; // Penalty per filler word percentage
  durationSweetSpotMin: number; // Ideal min duration (seconds)
  durationSweetSpotMax: number; // Ideal max duration (seconds)
}

export const SCORING_PRESETS: Record<ClipStylePreset, ScoringWeights> = {
  balanced: {
    questionOpener: 30,
    boldClaim: 35,
    numberHook: 25,
    contrastHook: 20,
    storyOpener: 25,
    audioLoudnessPeak: 25,
    speechPaceOptimal: 20,
    laughterOrCheer: 25,
    keywordDensity: 20,
    sentimentIntensity: 20,
    fillerPenaltyWeight: 1.5,
    durationSweetSpotMin: 20,
    durationSweetSpotMax: 60,
  },
  informative: {
    questionOpener: 40,
    boldClaim: 25,
    numberHook: 45,
    contrastHook: 30,
    storyOpener: 15,
    audioLoudnessPeak: 15,
    speechPaceOptimal: 25,
    laughterOrCheer: 10,
    keywordDensity: 35,
    sentimentIntensity: 15,
    fillerPenaltyWeight: 2.0,
    durationSweetSpotMin: 25,
    durationSweetSpotMax: 70,
  },
  funny: {
    questionOpener: 20,
    boldClaim: 30,
    numberHook: 10,
    contrastHook: 35,
    storyOpener: 35,
    audioLoudnessPeak: 40,
    speechPaceOptimal: 20,
    laughterOrCheer: 50,
    keywordDensity: 15,
    sentimentIntensity: 35,
    fillerPenaltyWeight: 1.0,
    durationSweetSpotMin: 15,
    durationSweetSpotMax: 45,
  },
  dramatic: {
    questionOpener: 35,
    boldClaim: 45,
    numberHook: 15,
    contrastHook: 40,
    storyOpener: 35,
    audioLoudnessPeak: 35,
    speechPaceOptimal: 15,
    laughterOrCheer: 10,
    keywordDensity: 25,
    sentimentIntensity: 45,
    fillerPenaltyWeight: 1.8,
    durationSweetSpotMin: 20,
    durationSweetSpotMax: 60,
  },
};

export interface ClipConstraints {
  minDurationSeconds: number; // Default: 15
  maxDurationSeconds: number; // Default: 90
  preferredMinSeconds: number; // Default: 20
  preferredMaxSeconds: number; // Default: 60
  maxOverlapIoU: number; // Max allowed IoU before deduplication (0.25)
  topN: number; // Default: 6
}

export const DEFAULT_CLIP_CONSTRAINTS: ClipConstraints = {
  minDurationSeconds: 15,
  maxDurationSeconds: 90,
  preferredMinSeconds: 20,
  preferredMaxSeconds: 60,
  maxOverlapIoU: 0.25,
  topN: 6,
};
