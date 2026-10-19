"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Eye, Layers, Palette, Wand2, ArrowUpRight } from "lucide-react";

interface TemplateStyle {
  id: string;
  name: string;
  category: string;
  badge?: string;
  previewWords: {
    prefix?: string;
    keyword: string;
    suffix?: string;
  };
  styleType: "behind_you" | "neon_sticker" | "winner" | "sunshine_impact" | "editorial_dual" | "crimson_glow" | "chrome_3d" | "hormozi_highlighter" | "ali_abdaal_karaoke" | "mr_beast_squash" | "single_word_flow";
}

const TEMPLATES: TemplateStyle[] = [
  {
    id: "creator_fuel_cyan",
    name: "Single-Word Smooth Flow",
    category: "Bold Viral",
    badge: "1-WORD FLOW",
    previewWords: {
      prefix: "",
      keyword: "DYNAMIC",
      suffix: "",
    },
    styleType: "single_word_flow",
  },
  {
    id: "alex_hormozi_punch",
    name: "Hormozi Viral Highlighter Box",
    category: "Bold Viral",
    badge: "VIRAL BOX",
    previewWords: {
      prefix: "make captions",
      keyword: "UNMISSABLE",
      suffix: "today",
    },
    styleType: "hormozi_highlighter",
  },
  {
    id: "whisper_simple",
    name: "Ali Abdaal — Fluid Karaoke Wipe",
    category: "Minimal",
    badge: "KARAOKE WIPE",
    previewWords: {
      prefix: "productive",
      keyword: "WORKFLOW",
      suffix: "built-in",
    },
    styleType: "ali_abdaal_karaoke",
  },
  {
    id: "mr_beast_bold",
    name: "MrBeast High-Energy Squash",
    category: "Bold Viral",
    badge: "SQUASH BOUNCE",
    previewWords: {
      prefix: "50 MILLION",
      keyword: "CREATORS",
      suffix: "",
    },
    styleType: "mr_beast_squash",
  },
  {
    id: "behind_you_white",
    name: "Behind You — Clean White",
    category: "Bold Viral",
    badge: "BEHIND YOU",
    previewWords: {
      prefix: "ek choose kiya,",
      keyword: "TEMPLATE",
      suffix: "",
    },
    styleType: "behind_you",
  },
  {
    id: "winner",
    name: "Winner",
    category: "Neon",
    badge: "EDITORIAL",
    previewWords: {
      prefix: "the",
      keyword: "only",
      suffix: "is failure",
    },
    styleType: "winner",
  },
  {
    id: "sunshine_impact_yellow",
    name: "Sunshine Impact",
    category: "Bold Viral",
    badge: "BEHIND YOU",
    previewWords: {
      prefix: "ek choose kiya,",
      keyword: "TEMPLATE",
      suffix: "kiya,",
    },
    styleType: "sunshine_impact",
  },
  {
    id: "editorial_dual_cyan",
    name: "Editorial Dual-Font (Mirza)",
    category: "Aesthetic",
    badge: "BEHIND YOU",
    previewWords: {
      prefix: "Maine bas",
      keyword: "video upload",
      suffix: "kiya,",
    },
    styleType: "editorial_dual",
  },
  {
    id: "chrome_3d_metal",
    name: "Chrome 3D Reflection",
    category: "Neon",
    badge: "NEW",
    previewWords: {
      prefix: "ek",
      keyword: "template",
      suffix: "choose kiya,",
    },
    styleType: "chrome_3d",
  },
];

export function CreatorTemplatePreview() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>(TEMPLATES[0]);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [animatingWord, setAnimatingWord] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatingWord((prev) => !prev);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full neo-card bg-[var(--bg-card)] p-6 sm:p-8 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[var(--border-subtle)]">
        <div>
          <div className="neo-pill bg-[#A3E635] text-[#142218] border border-[var(--border-main)] mb-2 inline-flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>70+ Curated Creator Presets</span>
          </div>
          <h3 className="font-fraunces italic text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
            Designed for Indian Short-Form Video
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-xl font-medium">
            Inspired by trending Reels & Shorts styles: "Behind You" depth layering, neon sticker boxes, dual-font editorial typography, and high-contrast colorways.
          </p>
        </div>

        {/* Safe-Zone Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSafeZones((s) => !s)}
            className={`neo-btn-secondary px-3.5 py-2 text-xs font-bold gap-2 transition-all ${
              showSafeZones
                ? "!bg-[#A3E635] !text-[#142218] !border-[var(--border-main)] shadow-[var(--shadow-brutal-sm)]"
                : ""
            }`}
          >
            <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{showSafeZones ? "Hide Safe Zones" : "Show Reels Safe Zones"}</span>
          </button>
        </div>
      </div>

      {/* Main Showcase Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6 items-center">
        {/* Template Selector Tabs (Left 5 Cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Select Preset Style
          </p>
          {TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-[var(--text-main)] text-[var(--bg-canvas)] border-[var(--border-main)] shadow-[var(--shadow-brutal-sm)] translate-x-1"
                    : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-main)] hover:bg-[var(--bg-card-elevated)]"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{tmpl.name}</span>
                    {tmpl.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase border ${
                          isSelected
                            ? "bg-[#A3E635] text-[#142218] border-[#A3E635]"
                            : "bg-[var(--bg-card-elevated)] text-[var(--text-main)] border-[var(--border-subtle)]"
                        }`}
                      >
                        {tmpl.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isSelected ? "text-[var(--bg-canvas)]/70" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {tmpl.category} Vibe
                  </span>
                </div>
                <div
                  className={`w-2.5 h-2.5 rounded-full border ${
                    isSelected
                      ? "bg-[#A3E635] border-[#A3E635] shadow-sm"
                      : "border-[var(--border-subtle)] bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* 9:16 Vertical Video Phone Mockup Preview (Right 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-[280px] sm:w-[320px] aspect-[9/16] rounded-3xl bg-zinc-950 border-[3px] border-[var(--border-main)] shadow-[var(--shadow-brutal-lg)] overflow-hidden flex flex-col justify-between p-4 select-none">
            {/* Mock Creator Background with dark nighttime rooftop ambience */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black z-0">
              {/* String lights simulation */}
              <div className="absolute top-12 left-0 right-0 flex justify-around opacity-30">
                <div className="w-3 h-3 rounded-full bg-amber-300 blur-sm animate-pulse" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 blur-sm" />
                <div className="w-3 h-3 rounded-full bg-amber-200 blur-sm animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-amber-300 blur-sm" />
              </div>
              {/* Subject silhouette / avatar simulation */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 h-56 rounded-t-full bg-gradient-to-t from-zinc-900 to-zinc-800/80 border-t border-zinc-700/40 flex flex-col items-center pt-4">
                <div className="w-20 h-20 rounded-full bg-zinc-700/60 border border-zinc-600/40" />
                <div className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">Creator Subject</div>
              </div>
            </div>

            {/* Platform Safe-Zone Overlays */}
            {showSafeZones && (
              <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4">
                <div className="h-14 border-b border-dashed border-red-500/40 flex items-center justify-center text-[10px] text-red-400 font-mono">
                  Instagram Top Safe Margin
                </div>
                <div className="h-24 border-t border-dashed border-red-500/40 flex items-center justify-center text-[10px] text-red-400 font-mono">
                  Bottom Caption Safe Zone
                </div>
              </div>
            )}

            {/* Top Reel Header */}
            <div className="relative z-10 flex items-center justify-between">
              {selectedTemplate.badge && (
                <div className="px-2 py-0.5 rounded font-black text-[10px] uppercase bg-[#A3E635] text-[#142218] border border-[var(--border-main)] shadow-sm">
                  {selectedTemplate.badge}
                </div>
              )}
              <div className="text-[10px] px-2.5 py-0.5 rounded-full bg-black/80 text-zinc-300 border border-zinc-700 font-mono font-bold">
                9:16 Canvas
              </div>
            </div>

            {/* Dynamic Center/Upper Caption Rendering based on Template Type */}
            <div className="relative z-20 flex flex-col items-center justify-center text-center my-auto px-2">
              {/* 0. Single-Word Smooth Flow */}
              {selectedTemplate.styleType === "single_word_flow" && (
                <div className="flex flex-col items-center justify-center text-center py-4">
                  <div
                    className={`text-4xl sm:text-6xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 drop-shadow-[0_4px_20px_rgba(56,189,248,0.55)] transition-all duration-300 transform ${
                      animatingWord ? "scale-110 -translate-y-1.5 opacity-100" : "scale-95 translate-y-1 opacity-70"
                    }`}
                    style={{
                      fontFamily: "Montserrat, 'Arial Black', sans-serif",
                      WebkitTextStroke: "2px #000000",
                    }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                  <div className="mt-3 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-[10px] text-sky-300 font-mono tracking-widest uppercase flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                    Only active spoken word visible
                  </div>
                </div>
              )}

              {/* 0. Hormozi Viral Highlighter Box */}
              {selectedTemplate.styleType === "hormozi_highlighter" && (
                <div className="space-y-2 text-center">
                  <div className="text-white text-xs font-bold uppercase tracking-wider drop-shadow">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div
                    className={`inline-block px-3.5 py-1.5 rounded-lg bg-[#FFE600] text-black font-black uppercase text-3xl sm:text-4xl shadow-xl transition-all ${
                      animatingWord ? "scale-110 -rotate-1" : "scale-100 rotate-0"
                    }`}
                    style={{ fontFamily: "Impact, sans-serif" }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                  <div className="text-white text-xs font-bold uppercase tracking-wider drop-shadow">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}

              {/* 0.1 Ali Abdaal Fluid Karaoke Wipe */}
              {selectedTemplate.styleType === "ali_abdaal_karaoke" && (
                <div className="space-y-1 text-center">
                  <div className="text-zinc-300 text-xs font-medium">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
                    <span
                      className={`inline-block transition-colors duration-300 ${
                        animatingWord ? "text-[#FBBF24]" : "text-white"
                      }`}
                    >
                      {selectedTemplate.previewWords.keyword}
                    </span>
                  </div>
                  <div className="text-zinc-400 text-xs font-medium">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}

              {/* 0.2 MrBeast High-Energy Squash */}
              {selectedTemplate.styleType === "mr_beast_squash" && (
                <div className="space-y-1 text-center">
                  <div className="text-white text-sm font-black uppercase tracking-tight drop-shadow-[0_2px_4px_black]">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div
                    className={`text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#FFE600] drop-shadow-[0_4px_10px_black] transition-all duration-300 ${
                      animatingWord ? "scale-x-90 scale-y-125 -translate-y-2" : "scale-100 translate-y-0"
                    }`}
                    style={{
                      fontFamily: "Arial Black, sans-serif",
                      WebkitTextStroke: "2px black",
                    }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                </div>
              )}

              {/* 1. Behind You White */}
              {selectedTemplate.styleType === "behind_you" && (
                <div className="space-y-1">
                  <div className="text-zinc-200 text-xs font-serif italic tracking-wide">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div
                    className={`text-4xl sm:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-2xl transition-transform ${
                      animatingWord ? "scale-105" : "scale-100"
                    }`}
                    style={{ fontFamily: "Impact, sans-serif" }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                </div>
              )}

              {/* 2. Winner Editorial Style */}
              {(selectedTemplate.styleType === "winner" || selectedTemplate.styleType === "neon_sticker") && (
                <div className="flex flex-col items-start justify-center pl-4 py-2 select-none relative">
                  <span className="text-zinc-200 text-sm font-black lowercase tracking-tight mb-[-4px] drop-shadow-md">
                    {selectedTemplate.previewWords.prefix || "the"}
                  </span>
                  <div className="relative inline-block my-1">
                    <span
                      className="text-white text-5xl sm:text-6xl font-black lowercase tracking-tighter drop-shadow-2xl"
                      style={{ fontFamily: "Montserrat, sans-serif" }}
                    >
                      {selectedTemplate.previewWords.keyword || "only"}
                    </span>
                    <span
                      className={`absolute -left-1 top-8 sm:top-10 text-[#FF0022] text-4xl sm:text-5xl font-medium tracking-normal -rotate-7 drop-shadow-xl transition-transform ${
                        animatingWord ? "scale-108 -rotate-5" : "scale-100 -rotate-7"
                      }`}
                      style={{
                        fontFamily: "'SignPainter', 'SignPainter-HouseScript', 'SignPainter House Script', 'Satisfy', cursive, sans-serif",
                        textShadow: "0 3px 10px rgba(0,0,0,0.95)",
                        WebkitTextStroke: "1px rgba(0,0,0,0.85)",
                      }}
                    >
                      Consequence
                    </span>
                  </div>
                  <span className="text-zinc-200 text-sm font-black lowercase tracking-tight mt-[-2px] drop-shadow-md">
                    {selectedTemplate.previewWords.suffix || "is failure"}
                  </span>
                </div>
              )}

              {/* 3. Sunshine Impact */}
              {selectedTemplate.styleType === "sunshine_impact" && (
                <div className="space-y-1">
                  <div
                    className={`text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#FFE600] text-glow-yellow drop-shadow-2xl transition-transform ${
                      animatingWord ? "scale-105" : "scale-100"
                    }`}
                    style={{ fontFamily: "Impact, sans-serif" }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                  <div className="text-yellow-200 text-xs font-serif italic">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}

              {/* 4. Editorial Dual-Font */}
              {selectedTemplate.styleType === "editorial_dual" && (
                <div className="space-y-1 text-center">
                  <div className="text-white text-sm font-bold tracking-tight">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span className="text-2xl font-serif italic text-cyan-400 font-bold">video</span>
                    <span className="text-2xl font-black uppercase text-white">upload</span>
                  </div>
                  <div className="text-zinc-300 text-sm font-bold">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}

              {/* 5. Crimson Glow */}
              {selectedTemplate.styleType === "crimson_glow" && (
                <div className="space-y-1">
                  <div
                    className={`text-4xl sm:text-5xl font-serif font-black uppercase tracking-wider text-[#FF1E27] text-glow-red transition-transform ${
                      animatingWord ? "scale-105" : "scale-100"
                    }`}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                  <div className="text-red-200/90 text-sm font-serif italic">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}

              {/* 6. Chrome 3D Metal */}
              {selectedTemplate.styleType === "chrome_3d" && (
                <div className="space-y-1 text-center">
                  <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div
                    className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-600 drop-shadow-[0_4px_12px_rgba(255,255,255,0.3)]"
                    style={{ fontFamily: "Impact, sans-serif" }}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
                  <div className="text-zinc-300 text-xs font-semibold">
                    {selectedTemplate.previewWords.suffix}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom "Use This Template" Action inside Phone Preview */}
            <div className="relative z-10 w-full pt-2">
              <Link
                href="/editor"
                className="neo-btn w-full py-2.5 px-3 text-xs font-black shadow-[2px_2px_0px_#142218] flex items-center justify-center gap-1.5"
              >
                <span>Use this template</span>
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              </Link>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] mt-3 text-center font-medium">
            Live preview rendered with zero latency on client Canvas 2D engine.
          </p>
        </div>
      </div>
    </div>
  );
}
