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
    <div className="w-full rounded-2xl glass-panel p-6 sm:p-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Core AI Breakthrough
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Deterministic Hinglish Engine
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Whisper emits Hindi in Devanagari by default. BolSub's local transliterator outputs canonical, natural Roman Hinglish without mangling English code-mixes.
          </p>
        </div>

        {/* Script Toggle & Audio Simulation Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScriptMode((m) => (m === "roman" ? "devanagari" : "roman"))}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-xs font-medium text-zinc-200 transition-colors shadow-sm"
          >
            <Languages className="w-3.5 h-3.5 text-amber-400" />
            <span>Script: <strong className="text-white">{scriptMode === "roman" ? "Roman Hinglish" : "Devanagari Hindi"}</strong></span>
          </button>
          <button
            onClick={togglePlayback}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-all shadow-md active:scale-95"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? "Simulating..." : "Play Audio"}</span>
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Box 1: Raw Cloud / Standard Whisper */}
        <div className="rounded-xl bg-zinc-950/70 border border-red-500/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Standard Whisper (Raw)
            </span>
            <span className="text-[11px] text-zinc-500">Unprocessed</span>
          </div>
          <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm leading-relaxed font-hindi">
            मैंने बस वीडियो अपलोड किया, एक चूज़ किया टेम्पलेट, मिनट में कैप्शन्स रेडी!
          </div>
          <p className="text-xs text-zinc-500">
            ❌ Awkward phonetic Hindi script for English slang ("टेम्पलेट", "चूज़", "कैप्शन्स"). Unnatural for Indian Gen-Z reels.
          </p>
        </div>

        {/* Box 2: BolSub Local Engine */}
        <div className="rounded-xl bg-zinc-950/70 border border-emerald-500/30 p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> BolSub Studio (On-Device)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono">
              100% Deterministic
            </span>
          </div>

          {/* Interactive Word Spans */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-emerald-500/20 text-zinc-100 text-sm leading-relaxed flex flex-wrap gap-1.5 min-h-[56px] items-center">
            {sampleWords.map((word, idx) => {
              const text = scriptMode === "roman" ? word.roman : word.devanagari;
              const isActive = isPlaying && activeWordIdx === idx;
              return (
                <span
                  key={idx}
                  className={`px-1.5 py-0.5 rounded transition-all duration-150 ${
                    isActive
                      ? "bg-amber-400 text-zinc-950 font-bold scale-110 shadow-lg shadow-amber-400/20"
                      : word.type === "english"
                      ? "text-cyan-300 font-semibold"
                      : "text-zinc-200"
                  }`}
                  title={`${(word.conf * 100).toFixed(0)}% confidence • ${word.type}`}
                >
                  {text}
                </span>
              );
            })}
          </div>

          <p className="text-xs text-emerald-300/90 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Preserves English loanwords in Latin script; seamlessly transliterates Hindi verbs ("kiya", "mein") with schwa deletion.
          </p>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-zinc-800 text-xs text-zinc-400">
        <span className="flex items-center gap-1 text-zinc-300">
          <Check className="w-3.5 h-3.5 text-amber-400" /> 5,000+ Hinglish Lexicon
        </span>
        <span className="text-zinc-700">•</span>
        <span className="flex items-center gap-1 text-zinc-300">
          <Check className="w-3.5 h-3.5 text-amber-400" /> Contextual Schwa Deletion
        </span>
        <span className="text-zinc-700">•</span>
        <span className="flex items-center gap-1 text-zinc-300">
          <Check className="w-3.5 h-3.5 text-amber-400" /> Persistent User Dictionary
        </span>
        <span className="text-zinc-700">•</span>
        <span className="flex items-center gap-1 text-zinc-300">
          <Check className="w-3.5 h-3.5 text-amber-400" /> Instant Script Toggling
        </span>
      </div>
    </div>
  );
}
