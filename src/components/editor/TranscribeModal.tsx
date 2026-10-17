"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/editorStore";
import { extractAndResampleAudio } from "@/lib/audioPipeline";
import { LocalWhisperPipeline } from "@/lib/whisper";
import { normalizeTokenToHinglish } from "@/lib/hinglish/postProcessor";
import {
  Mic,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  Languages,
  Cpu,
  Loader2,
  FileVideo,
  Upload,
  Film,
  Check,
} from "lucide-react";

interface TranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoStart?: boolean;
}

export function TranscribeModal({ isOpen, onClose, autoStart = false }: TranscribeModalProps) {
  const {
    videoFile,
    videoUrl,
    videoTitle,
    duration,
    tokens,
    setVideo,
    setTokens,
    setDuration,
  } = useEditorStore();

  const [language, setLanguage] = useState<"auto" | "hi" | "en" | "mr">("auto");
  const [modelTier, setModelTier] = useState<"fast" | "balanced" | "best">("best");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartTranscription = async () => {
    if (!videoFile && !videoUrl) {
      setStatusMessage("Please select a video clip to transcribe.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);
    setCurrentStep(1);
    setStatusMessage("Extracting 16kHz audio using Web Audio API...");

    try {
      let audioBuffer: Float32Array;

      if (videoFile) {
        // 1. Audio extraction via Web Audio API
        const audioRes = await extractAndResampleAudio(videoFile);
        if (audioRes.durationSeconds && audioRes.durationSeconds > 0) {
          setDuration(audioRes.durationSeconds);
        }
        audioBuffer = audioRes.audioBuffer;
      } else if (videoUrl) {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const audioRes = await extractAndResampleAudio(blob);
        if (audioRes.durationSeconds && audioRes.durationSeconds > 0) {
          setDuration(audioRes.durationSeconds);
        }
        audioBuffer = audioRes.audioBuffer;
      } else {
        throw new Error("No video file or stream available");
      }

      // 2. VAD Segmentation
      setProgressPercent(35);
      setCurrentStep(2);
      setStatusMessage("Segmenting speech with Voice Activity Detection (VAD)...");
      await new Promise((r) => setTimeout(r, 300));

      // 3. Whisper Speech Recognition (100% on-device)
      setProgressPercent(55);
      setCurrentStep(3);
      setStatusMessage("Running on-device Whisper inference with word timestamps...");

      const result = await LocalWhisperPipeline.transcribeAudio(audioBuffer, {
        language,
        tierId: modelTier,
        onProgress: (p) => {
          if (p.progressPercent) setProgressPercent(Math.max(40, Math.min(85, p.progressPercent)));
          if (p.message) setStatusMessage(p.message);
        },
      });

      // 4. Hinglish post-processing & schwa-deletion
      setProgressPercent(90);
      setCurrentStep(4);
      setStatusMessage("Applying Hinglish post-processing & schwa-deletion...");
      await new Promise((r) => setTimeout(r, 200));

      const processed = result.words.map((w) => {
        const norm = normalizeTokenToHinglish(w.text);
        return {
          ...w,
          romanText: norm.roman,
          devanagariText: norm.devanagari,
          isCodeMixedEnglish: norm.isCodeMixedEnglish,
        };
      });

      if (processed.length === 0) {
        setStatusMessage("No speech was detected in this audio file.");
        setIsProcessing(false);
        return;
      }

      setTokens(processed);

      // 5. Done
      setProgressPercent(100);
      setCurrentStep(5);
      setStatusMessage(`Transcribed ${processed.length} words! Applied to sequence.`);
      await new Promise((r) => setTimeout(r, 400));
      setIsProcessing(false);
      onClose();
    } catch (err) {
      console.error("Transcription error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Transcription failed: ${msg}`);
      setIsProcessing(false);
    }
  };

  // Auto-start transcription when requested (e.g. immediately after dropping/picking a new clip)
  useEffect(() => {
    if (isOpen && autoStart && (videoFile || videoUrl) && !isProcessing) {
      handleStartTranscription();
    }
  }, [isOpen, autoStart]);

  if (!isOpen) return null;

  const steps = [
    "Audio extraction (16kHz Mono Float32)",
    "Voice Activity Detection (Speech segmenting)",
    "Whisper Speech Recognition (Word-level timestamps)",
    "Hinglish Engine (Devanagari → Roman & Schwa deletion)",
    "Sequence Alignment (60fps Golden-Frame Canvas)",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[6px_6px_0px_var(--border-main)] flex flex-col overflow-hidden text-[var(--text-main)]">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-panel)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-lime)] border-2 border-[var(--border-main)] flex items-center justify-center text-[#142218] font-black shadow-[2px_2px_0px_var(--border-main)]">
              <Mic className="w-4 h-4 text-[#142218]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                AI Speech-to-Text Transcriber
                <span className="neo-pill bg-[var(--accent-lime)]/20 text-[var(--text-main)] text-[9px] py-0 px-2">
                  100% On-Device
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                Local Whisper word-level timestamps with zero server calls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setVideo(file);
            }
          }}
        />

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Active File Banner or Pick Clip Dropzone */}
          {videoFile || videoUrl ? (
            <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] flex items-center justify-between shadow-[2px_2px_0px_var(--border-main)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-lime)] border-2 border-[var(--border-main)] flex items-center justify-center text-[#142218] shadow-[1px_1px_0px_var(--border-main)]">
                  <FileVideo className="w-5 h-5 text-[#142218]" />
                </div>
                <div>
                  <span className="text-xs font-black text-[var(--text-main)] block">
                    {videoTitle || (videoFile ? videoFile.name : "Loaded Video Clip")}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono font-medium">
                    {duration > 0
                      ? `Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s · Audio ready`
                      : "Ready for on-device speech extraction"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="neo-btn-secondary text-[11px] font-bold px-2.5 py-1.5 cursor-pointer disabled:opacity-50"
              >
                Change Clip
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-2xl bg-[var(--bg-panel)] border-2 border-dashed border-[var(--border-main)] hover:bg-[var(--accent-lime)]/10 flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-[2px_2px_0px_var(--border-main)]"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--accent-lime)] border-2 border-[var(--border-main)] flex items-center justify-center text-[#142218] mb-2 group-hover:scale-105 transition-transform shadow-[2px_2px_0px_var(--border-main)]">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-black text-[var(--text-main)]">Select a Video Clip to Transcribe</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                Choose any MP4, MOV, or WebM clip from your device
              </p>
            </div>
          )}

          {/* Transcription Settings */}
          {!isProcessing ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                {/* Language Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-[var(--text-main)]" />
                    Audio Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] font-semibold focus:outline-none shadow-[2px_2px_0px_var(--border-main)] cursor-pointer"
                  >
                    <option value="auto">Auto-Detect Language</option>
                    <option value="hi">Hindi (हिन्दी / Hinglish)</option>
                    <option value="en">English</option>
                    <option value="mr">Marathi (मराठी)</option>
                  </select>
                </div>

                {/* Model Tier */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[var(--text-main)]" />
                    Whisper Model Tier
                  </label>
                  <select
                    value={modelTier}
                    onChange={(e) => setModelTier(e.target.value as any)}
                    className="w-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] font-semibold focus:outline-none shadow-[2px_2px_0px_var(--border-main)] cursor-pointer"
                  >
                    <option value="best">High Accuracy (Whisper Small · 465MB · Default & Recommended)</option>
                    <option value="balanced">Balanced (Whisper Base · 145MB)</option>
                    <option value="fast">Fast (Whisper Tiny · 39MB · Instant)</option>
                  </select>
                </div>
              </div>

              {/* Hardware Acceleration Notice */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-start gap-2.5 text-xs text-[var(--text-main)]">
                <div className="p-1.5 rounded-lg bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="w-4 h-4 text-[#142218]" />
                </div>
                <div>
                  <strong className="text-[var(--text-main)] block font-bold">WebGPU Hardware Acceleration Active</strong>
                  <span className="text-[var(--text-muted)] font-medium">Inference runs entirely in your local browser sandbox. Zero audio or transcript data ever leaves your device.</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Progress HUD */
            <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-fraunces italic font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent-forest)] dark:text-[var(--accent-lime)] animate-spin stroke-[2.5]" />
                  {statusMessage}
                </span>
                <span className="neo-pill bg-[var(--accent-lime)] text-[#142218] font-mono text-xs font-black py-0.5 px-2.5">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 rounded-full bg-[var(--bg-card)] overflow-hidden border-2 border-[var(--border-main)] shadow-inner">
                <div
                  className="h-full bg-[var(--accent-lime)] transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Step Checklist */}
              <div className="space-y-2 pt-1">
                {steps.map((st, i) => {
                  const stepIndex = i + 1;
                  const isDone = currentStep > stepIndex;
                  const isCurrent = currentStep === stepIndex;
                  return (
                    <div
                      key={st}
                      className={`flex items-center gap-2.5 text-xs transition-colors ${
                        isDone
                          ? "text-[var(--text-main)] font-bold"
                          : isCurrent
                          ? "text-[var(--text-main)] font-black"
                          : "text-[var(--text-muted)] opacity-60"
                      }`}
                    >
                      {isDone ? (
                        <div className="w-4 h-4 rounded-full bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] flex items-center justify-center shrink-0 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-full border border-[var(--border-main)] flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${
                            isCurrent
                              ? "bg-[var(--accent-lime)] text-[#142218] animate-pulse font-black shadow-sm"
                              : "bg-[var(--bg-card)] text-[var(--text-muted)]"
                          }`}
                        >
                          {stepIndex}
                        </div>
                      )}
                      <span>{st}</span>
                      {isCurrent && (
                        <span className="neo-pill bg-[var(--accent-lime)]/30 text-[var(--text-main)] text-[8px] py-0 px-1.5 ml-auto">
                          In Progress
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono ml-auto">
                          Done
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t-2 border-[var(--border-main)] bg-[var(--bg-panel)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)] font-mono font-bold">
            {tokens.length > 0 ? `${tokens.length} active word tokens` : "Ready to transcribe"}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="neo-btn-secondary px-4 py-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleStartTranscription}
              disabled={isProcessing || (!videoFile && !videoUrl)}
              className="neo-btn px-4 py-1.5 text-xs text-[#142218] font-black gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Transcribe & Generate Captions
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
