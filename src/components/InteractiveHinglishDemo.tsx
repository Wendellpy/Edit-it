"use client";

import { useState } from "react";
import { Sparkles, Languages, Check, ArrowRight, Play, Pause, RefreshCw } from "lucide-react";

export function InteractiveHinglishDemo() {
  const [scriptMode, setScriptMode] = useState<"roman" | "devanagari">("roman");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIdx, setActiveWordIdx] = useState(0);

  const sampleWords = [
    { roman: "Maine", devanagari: "मैंने", conf: 0.98, type: "hindi" },
    { roman: "bas", devanagari: "बस", conf: 0.99, type: "hindi" },
    { roman: "video", devanagari: "वीडियो", conf: 0.99, type: "english" },
    { roman: "upload", devanagari: "अपलोड", conf: 0.97, type: "english" },
    { roman: "kiya,", devanagari: "किया,", conf: 0.99, type: "hindi" },
    { roman: "ek", devanagari: "एक", conf: 0.98, type: "hindi" },
    { roman: "choose", devanagari: "चूज़", conf: 0.96, type: "english" },
    { roman: "kiya", devanagari: "किया", conf: 0.99, type: "hindi" },
    { roman: "template,", devanagari: "टेम्पलेट,", conf: 0.98, type: "english" },
    { roman: "minute", devanagari: "मिनट", conf: 0.97, type: "english" },
    { roman: "mein", devanagari: "में", conf: 0.99, type: "hindi" },
    { roman: "captions", devanagari: "कैप्शन्स", conf: 0.99, type: "english" },
    { roman: "READY!", devanagari: "रेडी!", conf: 0.99, type: "english" },
  ];

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    let idx = 0;
    setActiveWordIdx(0);
    const interval = setInterval(() => {
      idx++;
      if (idx >= sampleWords.length) {
        clearInterval(interval);
        setIsPlaying(false);
        setActiveWordIdx(sampleWords.length - 1);
      } else {
        setActiveWordIdx(idx);
      }
    }, 280);
  };

  return (
    <div className="w-full neo-card bg-[var(--bg-card)] p-6 sm:p-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#A3E635]/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[var(--border-subtle)]">
        <div>
          <div className="neo-pill bg-[#A3E635] text-[#142218] border border-[var(--border-main)] mb-2 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Core AI Breakthrough</span>
          </div>
          <h3 className="font-fraunces italic text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
            Deterministic Hinglish Engine
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-xl font-medium">
            Whisper emits Hindi in Devanagari by default. BolSub's local transliterator outputs canonical, natural Roman Hinglish without mangling English code-mixes.
          </p>
        </div>

        {/* Script Toggle & Audio Simulation Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScriptMode((m) => (m === "roman" ? "devanagari" : "roman"))}
            className="neo-btn-secondary px-3.5 py-2 text-xs font-bold gap-2 cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-[var(--text-main)] stroke-[2.5]" />
            <span>
              Script:{" "}
              <strong className="font-black text-[var(--text-main)]">
                {scriptMode === "roman" ? "Roman Hinglish" : "Devanagari Hindi"}
              </strong>
            </span>
          </button>
          <button
            onClick={togglePlayback}
            className="neo-btn px-4 py-2 text-xs font-black gap-1.5 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
            )}
            <span>{isPlaying ? "Simulating..." : "Play Audio"}</span>
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Box 1: Raw Cloud / Standard Whisper */}
        <div className="rounded-2xl border-2 border-red-500/40 bg-[var(--bg-card-elevated)] p-5 sm:p-6 space-y-3.5 shadow-[var(--shadow-brutal-sm)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Standard Whisper (Raw)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
              Unprocessed
            </span>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-subtle)] text-[var(--text-main)] text-sm sm:text-base leading-relaxed font-hindi shadow-sm">
            मैंने बस वीडियो अपलोड किया, एक चूज़ किया टेम्पलेट, मिनट में कैप्शन्स रेडी!
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed flex items-start gap-1.5">
            <span className="text-red-500 font-black shrink-0">✕</span>
            <span>Awkward phonetic Hindi script for English slang ("टेम्पलेट", "चूज़", "कैप्शन्स"). Unnatural for Indian Gen-Z reels.</span>
          </p>
        </div>

        {/* Box 2: BolSub Local Engine */}
        <div className="rounded-2xl border-2 border-[var(--border-main)] bg-[var(--bg-card-elevated)] p-5 sm:p-6 space-y-3.5 shadow-[var(--shadow-brutal)] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A3E635] border border-[var(--border-main)] animate-pulse" /> BolSub Studio (On-Device)
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#A3E635] text-[#142218] border border-[var(--border-main)] font-black">
              100% Deterministic
            </span>
          </div>

          {/* Interactive Word Spans */}
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] text-[var(--text-main)] text-sm sm:text-base leading-relaxed flex flex-wrap gap-2 min-h-[64px] items-center shadow-sm">
            {sampleWords.map((word, idx) => {
              const text = scriptMode === "roman" ? word.roman : word.devanagari;
              const isActive = isPlaying && activeWordIdx === idx;
              return (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded-md transition-all duration-150 ${
                    isActive
                      ? "bg-[#A3E635] text-[#142218] border-2 border-[var(--border-main)] font-black scale-105 shadow-[2px_2px_0px_var(--border-main)]"
                      : word.type === "english"
                      ? "text-[var(--text-main)] font-extrabold bg-[#A3E635]/20 border border-[#A3E635]/40"
                      : "text-[var(--text-main)] font-semibold"
                  }`}
                  title={`${(word.conf * 100).toFixed(0)}% confidence • ${word.type}`}
                >
                  {text}
                </span>
              );
            })}
          </div>

          <p className="text-xs text-[var(--text-main)] font-semibold flex items-start gap-1.5">
            <Check className="w-4 h-4 text-[#A3E635] stroke-[3] shrink-0 mt-0.5" />
            <span>Preserves English loanwords in Latin script; seamlessly transliterates Hindi verbs ("kiya", "mein") with schwa deletion.</span>
          </p>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-6 pt-5 border-t-2 border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)]">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-[#A3E635] stroke-[3]" /> 5,000+ Hinglish Lexicon
        </span>
        <span className="text-[var(--border-subtle)] font-black">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-[#A3E635] stroke-[3]" /> Contextual Schwa Deletion
        </span>
        <span className="text-[var(--border-subtle)] font-black">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-[#A3E635] stroke-[3]" /> Persistent User Dictionary
        </span>
        <span className="text-[var(--border-subtle)] font-black">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-[#A3E635] stroke-[3]" /> Instant Script Toggling
        </span>
      </div>
    </div>
  );
}
