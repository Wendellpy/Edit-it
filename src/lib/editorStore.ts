import { create } from "zustand";
import type { HinglishWordToken, CaptionScriptMode } from "./hinglish/postProcessor";
import { normalizeTokenToHinglish, toggleTranscriptScript } from "./hinglish/postProcessor";
import { migrateProjectPayload, TEMPLATE_SCHEMA_VERSION } from "./templates/migration";
import type { WordAnimationEffect } from "./templates/schema";
import { getTemplateById } from "./templates";

interface EditorHistorySnapshot {
  tokens: HinglishWordToken[];
  templateId: string;
}

export type ExportAspectRatio = "original" | "9:16" | "16:9" | "1:1" | "4:5" | "21:9";
export type ExportFitMode = "cover" | "fit" | "fit_blur" | "stretch";
export type ExportResolution = "720p" | "1080p" | "1440p" | "4k" | "source";
export type ExportFps = 24 | 30 | 60;
export type ExportQuality = "fast" | "standard" | "high";
export type ExportFormat = "mp4" | "webm_alpha";

export interface ExportSettings {
  format: ExportFormat;
  aspectRatio: ExportAspectRatio;
  fitMode: ExportFitMode;
  resolution: ExportResolution;
  fps: ExportFps;
  quality: ExportQuality;
  includeAudio: boolean;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "mp4",
  aspectRatio: "16:9",
  fitMode: "cover",
  resolution: "1080p",
  fps: 30,
  quality: "standard",
  includeAudio: true,
};

export function hydrateExportSettings() {
  if (typeof window === "undefined") return;
  try {
    const saved = localStorage.getItem("bolsub-export-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      useEditorStore.getState().setExportSettings(parsed);
    }
  } catch {}
}

export interface EditorState {
  // Media State
  videoFile: File | null;
  videoUrl: string | null;
  videoTitle: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  isTranscribing: boolean;

  // Caption Transcript
  tokens: HinglishWordToken[];
  selectedWordId: string | null;
  scriptMode: CaptionScriptMode;
  templateId: string;
  animationEffectOverride: WordAnimationEffect | null;
  setAnimationEffectOverride: (effect: WordAnimationEffect | null) => void;
  isReviewMode: boolean;

  // Timeline
  timelineZoom: number;
  waveformPeaks: Float32Array | null;
  showSafeZones: boolean;
  isAudioMuted: boolean;
  isCaptionsVisible: boolean;
  isVideoVisible: boolean;

  // Undo / Redo (Command Pattern)
  history: EditorHistorySnapshot[];
  historyIndex: number;

  // Actions
  setVideo: (file: File) => void;
  setVideoUrl: (url: string, duration?: number) => void;
  setVideoTitle: (title: string | null) => void;
  loadTokensForVideo: (tokens: HinglishWordToken[], duration?: number, title?: string) => void;
  setIsTranscribing: (val: boolean) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setPlaybackRate: (rate: number) => void;

  setTokens: (tokens: HinglishWordToken[]) => void;
  selectWord: (id: string | null) => void;
  updateWordText: (id: string, newText: string) => void;
  updateWordTimings: (id: string, start: number, end: number) => void;
  splitWord: (id: string, splitRatio?: number) => void;
  mergeWords: (firstId: string, secondId: string) => void;
  deleteWord: (id: string) => void;
  insertWordAfter: (id: string, text: string) => void;
  nudgeWord: (id: string, deltaSeconds: number) => void;

  setScriptMode: (mode: CaptionScriptMode) => void;
  setTemplateId: (templateId: string) => void;
  setTimelineZoom: (zoom: number) => void;
  setWaveformPeaks: (peaks: Float32Array) => void;
  toggleSafeZones: () => void;
  toggleReviewMode: () => void;
  setIsAudioMuted: (isAudioMuted: boolean) => void;
  setIsCaptionsVisible: (isCaptionsVisible: boolean) => void;
  setIsVideoVisible: (isVideoVisible: boolean) => void;

  // Timing & Audio Sync
  syncOffset: number; // Global caption timing offset in seconds (-0.5s to +0.5s)
  setSyncOffset: (offset: number) => void;
  nudgeAllTimestamps: (deltaSeconds: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  exportProjectJson: () => string;
  importProjectJson: (jsonStr: string) => boolean;

  // Layer & Mask Controls (Phase 4)
  layerOrder: "behind" | "front" | "sandwich";
  setLayerOrder: (order: "behind" | "front" | "sandwich") => void;
  maskQualityTier: "fast" | "balanced" | "ultra";
  setMaskQualityTier: (tier: "fast" | "balanced" | "ultra") => void;
  maskFeather: number;
  setMaskFeather: (radius: number) => void;
  maskExpandContract: number;
  setMaskExpandContract: (delta: number) => void;
  showMaskOverlay: boolean;
  toggleMaskOverlay: () => void;
  hasDismissedMaskNotice: boolean;
  dismissMaskNotice: () => void;

  // Export Settings (Persisted & Synchronized)
  exportSettings: ExportSettings;
  setExportSettings: (partial: Partial<ExportSettings>) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  videoFile: null,
  videoUrl: null,
  videoTitle: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1.0,
  isTranscribing: false,

  tokens: [],
  selectedWordId: null,
  scriptMode: "roman",
  templateId: "alex_hormozi_punch",
  animationEffectOverride: null,
  setAnimationEffectOverride: (animationEffectOverride) => set({ animationEffectOverride }),
  isReviewMode: false,

  timelineZoom: 1.0,
  waveformPeaks: null,
  showSafeZones: false,
  syncOffset: 0,
  isAudioMuted: false,
  isCaptionsVisible: true,
  isVideoVisible: true,
  setIsAudioMuted: (isAudioMuted) => set({ isAudioMuted }),
  setIsCaptionsVisible: (isCaptionsVisible) => set({ isCaptionsVisible }),
  setIsVideoVisible: (isVideoVisible) => set({ isVideoVisible }),

  layerOrder: "front",
  setLayerOrder: (layerOrder) => set({ layerOrder }),
  maskQualityTier: "balanced",
  setMaskQualityTier: (maskQualityTier) => set({ maskQualityTier }),
  maskFeather: 4,
  setMaskFeather: (maskFeather) => set({ maskFeather }),
  maskExpandContract: 0,
  setMaskExpandContract: (maskExpandContract) => set({ maskExpandContract }),
  showMaskOverlay: false,
  toggleMaskOverlay: () => set((s) => ({ showMaskOverlay: !s.showMaskOverlay })),
  hasDismissedMaskNotice: false,
  dismissMaskNotice: () => set({ hasDismissedMaskNotice: true }),

  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
  setExportSettings: (partial) => {
    set((state) => {
      const updated = { ...state.exportSettings, ...partial };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("bolsub-export-settings", JSON.stringify(updated));
        } catch {}
      }
      return { exportSettings: updated };
    });
  },

  history: [{ tokens: [], templateId: "alex_hormozi_punch" }],
  historyIndex: 0,

  setVideo: (file) => {
    const url = URL.createObjectURL(file);
    set({
      videoFile: file,
      videoUrl: url,
      videoTitle: file.name,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      tokens: [],
      history: [{ tokens: [], templateId: get().templateId }],
      historyIndex: 0,
    });
  },

  setVideoUrl: (url, duration) => {
    set({ videoUrl: url, duration: duration || 0, currentTime: 0 });
  },

  setVideoTitle: (title) => set({ videoTitle: title }),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),

  loadTokensForVideo: (newTokens, newDuration, title) => {
    const maxEnd = newTokens.length > 0 ? Math.max(...newTokens.map((t) => t.end)) : 10;
    const resolvedDuration = newDuration || Math.ceil(maxEnd + 1);
    const { templateId } = get();
    set({
      tokens: newTokens,
      duration: resolvedDuration,
      videoTitle: title || get().videoTitle,
      currentTime: 0,
      selectedWordId: null,
      history: [{ tokens: newTokens, templateId }],
      historyIndex: 0,
    });
  },

  setDuration: (duration) => set({ duration }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, Math.min(get().duration, time)) }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),

  setTokens: (newTokens) => {
    const { history, historyIndex, templateId } = get();
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ tokens: newTokens, templateId });
    set({ tokens: newTokens, history: nextHistory, historyIndex: nextHistory.length - 1 });
  },

  selectWord: (id) => set({ selectedWordId: id }),

  updateWordText: (id, newText) => {
    const { tokens, scriptMode } = get();
    const updated = tokens.map((t) => {
      if (t.id !== id) return t;
      const normalized = normalizeTokenToHinglish(newText);
      return {
        ...t,
        text: newText,
        romanText: normalized.roman,
        devanagariText: normalized.devanagari,
        isCodeMixedEnglish: normalized.isCodeMixedEnglish,
        confidence: 1.0, // Manual creator correction gets 100% confidence
      };
    });
    get().setTokens(updated);
  },

  updateWordTimings: (id, start, end) => {
    const { tokens } = get();
    const updated = tokens.map((t) => {
      if (t.id !== id) return t;
      return {
        ...t,
        start: parseFloat(Math.max(0, start).toFixed(3)),
        end: parseFloat(Math.max(start + 0.05, end).toFixed(3)),
      };
    });
    get().setTokens(updated);
  },

  splitWord: (id, splitRatio = 0.5) => {
    const { tokens } = get();
    const index = tokens.findIndex((t) => t.id === id);
    if (index === -1) return;

    const original = tokens[index];
    const originalDuration = original.end - original.start;
    const splitPoint = original.start + originalDuration * splitRatio;

    let text1 = original.text;
    let text2 = original.text;
    if (original.text.includes(" ")) {
      const words = original.text.trim().split(/\s+/);
      const mid = Math.max(1, Math.round(words.length * splitRatio));
      text1 = words.slice(0, mid).join(" ");
      text2 = words.slice(mid).join(" ") || text1;
    } else if (original.text.length > 3) {
      const charMid = Math.max(1, Math.round(original.text.length * splitRatio));
      text1 = original.text.slice(0, charMid);
      text2 = original.text.slice(charMid);
    }

    const norm1 = normalizeTokenToHinglish(text1);
    const norm2 = normalizeTokenToHinglish(text2);

    const part1: HinglishWordToken = {
      ...original,
      id: `${original.id}_1`,
      text: text1,
      romanText: norm1.roman,
      devanagariText: norm1.devanagari,
      end: parseFloat(splitPoint.toFixed(3)),
    };

    const part2: HinglishWordToken = {
      ...original,
      id: `${original.id}_2`,
      text: text2,
      romanText: norm2.roman,
      devanagariText: norm2.devanagari,
      start: parseFloat(splitPoint.toFixed(3)),
      end: original.end,
    };

    const nextTokens = [...tokens.slice(0, index), part1, part2, ...tokens.slice(index + 1)];
    get().setTokens(nextTokens);
    set({ selectedWordId: part2.id });
  },

  mergeWords: (firstId, secondId) => {
    const { tokens } = get();
    const idx1 = tokens.findIndex((t) => t.id === firstId);
    const idx2 = tokens.findIndex((t) => t.id === secondId);
    if (idx1 === -1 || idx2 === -1) return;

    const t1 = tokens[idx1];
    const t2 = tokens[idx2];

    const merged: HinglishWordToken = {
      id: t1.id,
      text: `${t1.text} ${t2.text}`,
      romanText: `${t1.romanText} ${t2.romanText}`,
      devanagariText: `${t1.devanagariText} ${t2.devanagariText}`,
      start: Math.min(t1.start, t2.start),
      end: Math.max(t1.end, t2.end),
      confidence: (t1.confidence + t2.confidence) / 2,
      isCodeMixedEnglish: t1.isCodeMixedEnglish && t2.isCodeMixedEnglish,
    };

    const nextTokens = tokens.filter((t) => t.id !== secondId).map((t) => (t.id === firstId ? merged : t));
    get().setTokens(nextTokens);
  },

  deleteWord: (id) => {
    const { tokens } = get();
    const nextTokens = tokens.filter((t) => t.id !== id);
    get().setTokens(nextTokens);
    if (get().selectedWordId === id) {
      set({ selectedWordId: null });
    }
  },

  insertWordAfter: (id, text) => {
    const { tokens } = get();
    const index = tokens.findIndex((t) => t.id === id);
    if (index === -1) return;

    const prev = tokens[index];
    const next = tokens[index + 1];
    const start = prev.end + 0.05;
    const end = next ? Math.min(next.start - 0.05, start + 0.3) : start + 0.3;

    const normalized = normalizeTokenToHinglish(text);
    const newWord: HinglishWordToken = {
      id: `w_ins_${Date.now()}`,
      text,
      romanText: normalized.roman,
      devanagariText: normalized.devanagari,
      start: parseFloat(start.toFixed(3)),
      end: parseFloat(Math.max(start + 0.1, end).toFixed(3)),
      confidence: 1.0,
      isCodeMixedEnglish: normalized.isCodeMixedEnglish,
    };

    const nextTokens = [...tokens.slice(0, index + 1), newWord, ...tokens.slice(index + 1)];
    get().setTokens(nextTokens);
  },

  nudgeWord: (id, deltaSeconds) => {
    const { tokens } = get();
    const updated = tokens.map((t) => {
      if (t.id !== id) return t;
      const newStart = Math.max(0, t.start + deltaSeconds);
      const newEnd = Math.max(newStart + 0.05, t.end + deltaSeconds);
      return {
        ...t,
        start: parseFloat(newStart.toFixed(3)),
        end: parseFloat(newEnd.toFixed(3)),
      };
    });
    get().setTokens(updated);
  },

  setScriptMode: (mode) => {
    const { tokens } = get();
    const toggled = toggleTranscriptScript(tokens, mode);
    set({ scriptMode: mode, tokens: toggled });
  },

  setTemplateId: (templateId) => {
    const { history, historyIndex, tokens } = get();
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ tokens, templateId });
    set({
      templateId,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
  },

  setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(0.5, Math.min(5.0, zoom)) }),
  setWaveformPeaks: (peaks) => set({ waveformPeaks: peaks }),
  toggleSafeZones: () => set((s) => ({ showSafeZones: !s.showSafeZones })),
  toggleReviewMode: () => set((s) => ({ isReviewMode: !s.isReviewMode })),

  setSyncOffset: (offset) => set({ syncOffset: parseFloat(offset.toFixed(3)) }),

  nudgeAllTimestamps: (deltaSeconds) => {
    const { tokens } = get();
    const updated = tokens.map((t) => {
      const newStart = Math.max(0, t.start + deltaSeconds);
      const newEnd = Math.max(newStart + 0.05, t.end + deltaSeconds);
      return {
        ...t,
        start: parseFloat(newStart.toFixed(3)),
        end: parseFloat(newEnd.toFixed(3)),
      };
    });
    get().setTokens(updated);
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      set({
        tokens: prev.tokens,
        templateId: prev.templateId,
        historyIndex: historyIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      set({
        tokens: next.tokens,
        templateId: next.templateId,
        historyIndex: historyIndex + 1,
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  exportProjectJson: () => {
    const state = get();
    const exportData = {
      version: TEMPLATE_SCHEMA_VERSION,
      product: "BolSub Studio",
      exportedAt: Date.now(),
      templateId: state.templateId,
      scriptMode: state.scriptMode,
      duration: state.duration,
      tokens: state.tokens,
      exportSettings: state.exportSettings,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importProjectJson: (jsonStr: string) => {
    try {
      const rawData = JSON.parse(jsonStr);
      if (Array.isArray(rawData.tokens)) {
        const migrated = migrateProjectPayload(rawData);
        get().setTokens(migrated.tokens);
        if (migrated.templateId) set({ templateId: migrated.templateId });
        if (migrated.scriptMode) set({ scriptMode: migrated.scriptMode });
        if (rawData.exportSettings) get().setExportSettings(rawData.exportSettings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
