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
  styleType: "behind_you" | "neon_sticker" | "sunshine_impact" | "editorial_dual" | "crimson_glow" | "chrome_3d";
}

const TEMPLATES: TemplateStyle[] = [
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
    id: "neon_sticker_lime",
    name: "Lime Sticker Box",
    category: "Neon",
    badge: "BEHIND YOU",
    previewWords: {
      prefix: "ek choose kiya,",
      keyword: "template",
      suffix: "",
    },
    styleType: "neon_sticker",
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
    id: "crimson_glow_serif",
    name: "Crimson Neon Glow (Jetty)",
    category: "Bollywood",
    badge: "BEHIND YOU",
    previewWords: {
      prefix: "",
      keyword: "UPLOAD",
      suffix: "kiya,",
    },
    styleType: "crimson_glow",
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
    <div className="w-full rounded-2xl glass-panel p-6 sm:p-8 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Palette className="w-3.5 h-3.5" />
            70+ Curated Creator Presets
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Designed for Indian Short-Form Video
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Inspired by trending Reels & Shorts styles: "Behind You" depth layering, neon sticker boxes, dual-font editorial typography, and high-contrast colorways.
          </p>
        </div>

        {/* Safe-Zone Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSafeZones((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showSafeZones
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showSafeZones ? "Hide Safe Zones" : "Show Reels Safe Zones"}</span>
          </button>
        </div>
      </div>

      {/* Main Showcase Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6 items-center">
        {/* Template Selector Tabs (Left 5 Cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            Select Preset Style
          </p>
          {TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplate.id === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-zinc-900/90 border-amber-500/60 shadow-lg shadow-amber-500/5 text-white"
                    : "bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{tmpl.name}</span>
                    {tmpl.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-500 text-zinc-950">
                        {tmpl.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">{tmpl.category} Vibe</span>
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? "bg-amber-400 shadow-sm shadow-amber-400/50" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* 9:16 Vertical Video Phone Mockup Preview (Right 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-[280px] sm:w-[320px] aspect-[9/16] rounded-3xl bg-zinc-950 border-[3px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between p-4 select-none">
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
                <div className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-amber-500 text-zinc-950 shadow-md">
                  {selectedTemplate.badge}
                </div>
              )}
              <div className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-zinc-400 border border-zinc-800 font-mono">
                9:16 Canvas
              </div>
            </div>

            {/* Dynamic Center/Upper Caption Rendering based on Template Type */}
            <div className="relative z-20 flex flex-col items-center justify-center text-center my-auto px-2">
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

              {/* 2. Neon Lime Sticker Box */}
              {selectedTemplate.styleType === "neon_sticker" && (
                <div className="space-y-2">
                  <div className="text-zinc-300 text-xs font-serif italic">
                    {selectedTemplate.previewWords.prefix}
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-xl bg-[#39FF14] text-zinc-950 font-black italic uppercase tracking-tighter text-3xl sm:text-4xl shadow-xl shadow-lime-500/20 transition-transform ${
                      animatingWord ? "scale-105 -rotate-1" : "scale-100 rotate-0"
                    }`}
                  >
                    {selectedTemplate.previewWords.keyword}
                  </div>
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
                className="w-full py-2.5 px-3 rounded-xl bg-black/80 hover:bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-lg hover:border-amber-500/50"
              >
                <span>Use this template</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              </Link>
            </div>
          </div>

          <p className="text-xs text-zinc-500 mt-3 text-center">
            Live preview rendered with zero latency on client Canvas 2D engine.
          </p>
        </div>
      </div>
    </div>
  );
}
