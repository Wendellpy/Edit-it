"use client";

import React, { useState } from "react";
import { useEditorStore } from "@/lib/editorStore";
import {
  Palette,
  Sparkles,
  Sliders,
  Type,
  Download,
  FileText,
  Video,
  Layers,
  ArrowRight,
  Check,
  Zap,
  Box,
  Eye,
  Settings,
  ShieldCheck,
  Cpu,
  X,
  Info,
} from "lucide-react";
import { CAPTION_PRESETS, getTemplateById } from "@/lib/templates";
import { type TemplateVibe, type WordAnimationEffect } from "@/lib/templates/schema";
import { generateSrt, generateVtt, generateAss } from "@/lib/export/subtitleFormatters";
import { saveBlobToDisk } from "@/lib/export/fileSaver";

interface TemplateStyleDockProps {
  onOpenExportModal?: () => void;
}

export function TemplateStyleDock({ onOpenExportModal }: TemplateStyleDockProps) {
  const {
    templateId,
    setTemplateId,
    exportProjectJson,
    tokens,
    syncOffset,
    setSyncOffset,
    nudgeAllTimestamps,
    layerOrder,
    setLayerOrder,
    maskQualityTier,
    setMaskQualityTier,
    maskFeather,
    setMaskFeather,
    maskExpandContract,
    setMaskExpandContract,
    showMaskOverlay,
    toggleMaskOverlay,
    hasDismissedMaskNotice,
    dismissMaskNotice,
    exportSettings,
    animationEffectOverride,
    setAnimationEffectOverride,
  } = useEditorStore();

  const currentTemplate = getTemplateById(templateId);

  const [activeTab, setActiveTab] = useState<"presets" | "style" | "motion" | "mask">("presets");
  const [primaryFilter, setPrimaryFilter] = useState<"all" | "text_styles" | "behind_subject">("all");
  const [selectedVibe, setSelectedVibe] = useState<string>("all");

  const vibes = [
    { id: "all", label: "All Vibes" },
    { id: "bold_viral", label: "Bold Viral" },
    { id: "neon", label: "Neon" },
    { id: "aesthetic", label: "Aesthetic" },
    { id: "bollywood", label: "Bollywood" },
    { id: "minimal", label: "Minimal" },
    { id: "podcast", label: "Podcast" },
    { id: "comic", label: "Comic" },
    { id: "news", label: "News" },
  ];

  // 10 Part A IDs
  const partAIds = new Set([
    "die_cut_sticker",
    "hollow_outline_fill",
    "chrome_metallic_3d",
    "neon_tube_flicker",
    "editorial_serif_luxury",
    "devanagari_calligraphy_bold",
    "brush_graffiti_paint",
    "hand_script_marker",
    "retro_80s_synth",
    "glitch_rgb_split",
  ]);

  // Filter Presets by Primary Filter Chip + Vibe Chip
  const filteredPresets = CAPTION_PRESETS.filter((p) => {
    // Primary Filter Chip
    if (primaryFilter === "text_styles" && !partAIds.has(p.id)) return false;
    if (primaryFilter === "behind_subject" && !p.layout.behindSubjectDepth) return false;

    // Vibe Filter Chip
    if (selectedVibe !== "all" && p.vibe !== selectedVibe) return false;

    return true;
  });

  // User's own first caption line for dynamic live animated previews
  const userFirstLine =
    tokens.length > 0
      ? tokens.slice(0, 3).map((t) => t.text).join(" ")
      : "VIRAL CAPTION";

  const handleExportSubtitles = async (format: "srt" | "vtt" | "ass") => {
    let content = "";
    let ext = format;
    let mime = "text/plain";
    let desc = "Subtitle File";

    if (format === "srt") {
      content = generateSrt(tokens);
      mime = "application/x-subrip";
      desc = "SubRip Subtitle (.srt)";
    } else if (format === "vtt") {
      content = generateVtt(tokens, currentTemplate);
      mime = "text/vtt";
      desc = "WebVTT Subtitle (.vtt)";
    } else if (format === "ass") {
      content = generateAss(tokens, currentTemplate);
      mime = "text/x-ssa";
      desc = "Advanced SubStation Alpha (.ass)";
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    await saveBlobToDisk(blob, {
      suggestedName: `bolsub_captions_${Date.now()}.${ext}`,
      mimeType: mime,
      extension: ext,
      description: desc,
    });
  };

  const handleBackupProject = () => {
    const jsonStr = exportProjectJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bolsub_project_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 lg:w-[350px] xl:w-[380px] flex flex-col bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-main)] shrink-0 h-full min-h-0 overflow-hidden select-none shadow-[3px_3px_0px_var(--border-main)] transition-colors">
      {/* 1. Panel Header & Tab Switcher */}
      <div className="p-1.5 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] grid grid-cols-4 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("presets")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all cursor-pointer ${
            activeTab === "presets"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab("style")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all cursor-pointer ${
            activeTab === "style"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
        >
          Inspector
        </button>
        <button
          onClick={() => setActiveTab("motion")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all cursor-pointer ${
            activeTab === "motion"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
        >
          Motion
        </button>
        <button
          onClick={() => setActiveTab("mask")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "mask"
              ? "bg-[var(--accent-forest)] text-[var(--accent-lime)] border-2 border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--accent-lime)] hover:bg-[var(--bg-panel)]"
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-[var(--accent-lime)] shrink-0" />
          <span className="truncate">Mask AI</span>
        </button>
      </div>

      {/* 2. Active Preset Summary Status Bar (Shown on Presets tab) */}
      {activeTab === "presets" && (
        <div className="px-3 py-1.5 bg-[var(--bg-panel)] border-b-2 border-[var(--border-main)] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider shrink-0">Active:</span>
            <span className="font-extrabold text-[var(--text-main)] truncate text-[11px]">{currentTemplate.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {currentTemplate.layout.behindSubjectDepth && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--accent-forest)] text-[var(--accent-lime)] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                Behind
              </span>
            )}
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)] uppercase">
              {currentTemplate.vibe.replace("_", " ")}
            </span>
          </div>
        </div>
      )}

      {/* 3. On-Device Mask Notice (First-time education banner on Presets tab) */}
      {activeTab === "presets" && currentTemplate.layout.behindSubjectDepth && !hasDismissedMaskNotice && (
        <div className="p-2.5 bg-[var(--accent-forest)] text-[var(--text-light)] border-b-2 border-[var(--border-main)] text-xs flex items-start gap-2 relative shrink-0">
          <ShieldCheck className="w-4 h-4 text-[var(--accent-lime)] shrink-0 mt-0.5" />
          <div className="flex-1 pr-3">
            <strong className="text-[var(--accent-lime)] block font-black text-[11px]">100% Local On-Device Masking</strong>
            <span className="text-stone-200 leading-snug block text-[10px] mt-0.5">
              Subject cutouts compute on-device via WebGPU (~5ms/frame). Zero frames leave your device.
            </span>
          </div>
          <button
            onClick={dismissMaskNotice}
            className="text-stone-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. TAB 1: Presets Gallery */}
      {activeTab === "presets" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Primary Filter Chips (All / Text Styles / Behind Subject) */}
          <div className="p-2 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setPrimaryFilter("all")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border-2 border-[var(--border-main)] ${
                primaryFilter === "all"
                  ? "bg-[var(--accent-lime)] text-[#142218] shadow-[2px_2px_0px_var(--border-main)]"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-[1px_1px_0px_var(--border-main)]"
              }`}
            >
              All ({CAPTION_PRESETS.length})
            </button>
            <button
              onClick={() => setPrimaryFilter("text_styles")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border-2 border-[var(--border-main)] ${
                primaryFilter === "text_styles"
                  ? "bg-[var(--accent-lime)] text-[#142218] shadow-[2px_2px_0px_var(--border-main)]"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-[1px_1px_0px_var(--border-main)]"
              }`}
            >
              Text Styles (Part A)
            </button>
            <button
              onClick={() => setPrimaryFilter("behind_subject")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border-2 border-[var(--border-main)] ${
                primaryFilter === "behind_subject"
                  ? "bg-[var(--accent-lime)] text-[#142218] shadow-[2px_2px_0px_var(--border-main)]"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-[1px_1px_0px_var(--border-main)]"
              }`}
            >
              Behind Subject (Part B)
            </button>
          </div>

          {/* Vibe Category Sub-Chips */}
          <div className="px-2.5 py-1.5 bg-[var(--bg-panel)] border-b border-[var(--border-main)]/30 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {vibes.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVibe(v.id)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 transition-colors cursor-pointer border border-[var(--border-main)] ${
                  selectedVibe === v.id
                    ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm font-extrabold"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          <div className="flex-1 overflow-y-auto p-3 pb-8 grid grid-cols-2 gap-2.5 content-start">
            {filteredPresets.map((preset) => {
              const isSelected = templateId === preset.id;
              const isBehind = preset.layout.behindSubjectDepth;
              const isPartA = partAIds.has(preset.id);

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTemplateId(preset.id)}
                  className={`min-h-[162px] w-full p-2.5 rounded-2xl border-2 border-[var(--border-main)] text-left flex flex-col justify-between transition-all group relative select-none cursor-pointer ${
                    isSelected
                      ? "bg-[var(--accent-lime)]/20 shadow-[4px_4px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                      : "bg-[var(--bg-card)] shadow-[2px_2px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_var(--border-main)]"
                  }`}
                >
                  <div className="w-full">
                    {/* Badge & Active Check */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--border-main)] ${
                          isBehind
                            ? "bg-[var(--accent-forest)] text-[var(--accent-lime)]"
                            : isPartA
                            ? "bg-[var(--accent-lime)] text-[#142218]"
                            : "bg-[var(--bg-panel)] text-[var(--text-main)]"
                        }`}
                      >
                        {preset.badge || preset.vibe.replace("_", " ")}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] text-[9px] font-black shadow-[1px_1px_0px_var(--border-main)]">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </span>
                      )}
                    </div>

                    {/* Live Animated Preview Card Rendered from User's Own First Caption Line */}
                    <div className="h-14 rounded-xl bg-black border-2 border-[var(--border-main)] flex items-center justify-center p-2 text-center overflow-hidden relative shadow-inner">
                      {isBehind && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                          <div className="w-10 h-10 rounded-full bg-[var(--accent-lime)] blur-sm" />
                        </div>
                      )}
                      {(() => {
                        const words = userFirstLine.split(" ");
                        const lastWord = words[words.length - 1];
                        const prefix = words.slice(0, -1).join(" ");
                        const hasBox = preset.colors.activeWordBg || preset.animation?.perWordEffect === "highlight_box";

                        if (preset.id === "aura" && userFirstLine === "VIRAL CAPTION") {
                          return (
                            <span
                              className="text-xs font-bold leading-tight px-1 line-clamp-2 z-10 flex items-center justify-center gap-1.5 flex-wrap"
                              style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
                            >
                              <span
                                style={{
                                  fontFamily: "Playfair Display, serif",
                                  fontStyle: "italic",
                                  fontWeight: 500,
                                  color: "#FFFFFF",
                                }}
                              >
                                ✦ kiya,
                              </span>
                              <span
                                style={{
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 900,
                                  color: "#FFE600",
                                  textShadow: "0 0 8px rgba(255,230,0,0.5)",
                                }}
                              >
                                TEMPLATE
                              </span>
                            </span>
                          );
                        }

                        return (
                          <span
                            style={{
                              color: preset.colors.primaryText === "transparent" ? "#38BDF8" : preset.colors.primaryText,
                              fontFamily: preset.typography.primaryFont,
                              textTransform: preset.typography.textTransform,
                              fontWeight: preset.typography.primaryWeight === "900" ? 900 : 700,
                              letterSpacing: preset.typography.wordTransform?.letterSpacingEm ? `${preset.typography.wordTransform.letterSpacingEm}em` : undefined,
                              textShadow: preset.colors.shadowColor ? `0 2px 4px ${preset.colors.shadowColor}` : undefined,
                            }}
                            className="text-xs font-bold leading-tight px-1 line-clamp-2 z-10 flex items-center justify-center gap-1 flex-wrap"
                          >
                            {prefix && <span>{prefix}</span>}
                            {hasBox ? (
                              <span
                                className="px-1.5 py-0.5 rounded text-[11px] font-black inline-block shadow-sm"
                                style={{
                                  backgroundColor: preset.colors.activeWordBg || preset.colors.activeWordText,
                                  color: preset.colors.activeWordText,
                                }}
                              >
                                {lastWord}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: preset.colors.activeWordText,
                                  textShadow: preset.colors.glowColor ? `0 0 8px ${preset.colors.glowColor}` : undefined,
                                }}
                              >
                                {lastWord}
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Preset Name (multi-line supported) */}
                    <h4 className="text-[11.5px] font-extrabold text-[var(--text-main)] mt-2 line-clamp-2 leading-snug min-h-[30px] flex items-center transition-colors">
                      {preset.name}
                    </h4>
                  </div>

                  {/* Sub-tag row: Vibe & Font family */}
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1 pt-1 border-t border-[var(--border-main)]/20">
                    <span className="capitalize text-[var(--text-muted)] font-semibold truncate">
                      {preset.vibe.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--text-muted)] font-bold shrink-0 truncate max-w-[75px]">
                      {preset.typography.primaryFont}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. TAB 2: Style Inspector */}
      {activeTab === "style" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Active Preset Summary */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Active Preset</span>
              <h4 className="text-xs font-bold text-white">{currentTemplate.name}</h4>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono border border-amber-500/20 font-bold uppercase">
              {currentTemplate.vibe}
            </span>
          </div>

          {/* Layer Depth Control (Front Default / Behind / Sandwich) */}
          <div className="space-y-2 p-3 rounded-xl bg-purple-950/20 border border-purple-800/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Depth Layering
              </span>
              <span className="text-[9px] text-zinc-400">
                {layerOrder === "front" ? "In Front (Default)" : "Behind Subject Active"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(["front", "behind", "sandwich"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayerOrder(mode)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold capitalize transition-all ${
                    layerOrder === mode
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400"
                      : "bg-[#18191e] text-zinc-400 border border-zinc-800 hover:text-white"
                  }`}
                >
                  {mode === "front" ? "Front (Def)" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Typography Controls */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Typography & Font
            </span>
            <div className="space-y-2 p-3 rounded-xl bg-[#14151a] border border-zinc-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Primary Font</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentTemplate.typography.primaryFont}</span>
              </div>
              {currentTemplate.typography.secondaryFont && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Indian / Script Font</span>
                  <span className="font-mono text-amber-400 font-semibold">{currentTemplate.typography.secondaryFont}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Font Weight</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentTemplate.typography.primaryWeight}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Base Scale</span>
                <span className="font-mono text-amber-400 font-bold">
                  {Math.round(currentTemplate.typography.fontSizeBasePercent * 1000) / 10}%
                </span>
              </div>
            </div>
          </div>

          {/* Colors & Effects */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Colors & Shaders
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Primary Color</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full border border-zinc-700"
                    style={{ backgroundColor: currentTemplate.colors.primaryText }}
                  />
                  <span className="font-mono text-zinc-300 text-[11px]">{currentTemplate.colors.primaryText}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Active Keyword</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full border border-zinc-700"
                    style={{ backgroundColor: currentTemplate.colors.activeWordText }}
                  />
                  <span className="font-mono text-amber-400 text-[11px] font-bold">{currentTemplate.colors.activeWordText}</span>
                </div>
              </div>

              {currentTemplate.colors.gradient && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Gradient Spec</span>
                  <span className="font-mono text-amber-400 font-bold">{currentTemplate.colors.gradient.stops.length} Stops</span>
                </div>
              )}

              {currentTemplate.colors.extrusion && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">3D Extrusion</span>
                  <span className="font-mono text-sky-400 font-bold">{currentTemplate.colors.extrusion.steps} Passes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: Motion & FX */}
      {activeTab === "motion" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Kinetic Engine Header */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase font-semibold">Kinetic Engine</span>
              {animationEffectOverride && (
                <button
                  onClick={() => setAnimationEffectOverride(null)}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Reset to Default
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white capitalize flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {(animationEffectOverride || currentTemplate.animation.perWordEffect).replace("_", " ")}
              </h4>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {animationEffectOverride ? "CUSTOM" : "PRESET"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Real-time Canvas2D / WebGL kinetic typography synchronized with speech timestamps.
            </p>
          </div>

          {/* Kinetic Typography Animation Styles Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Animation Styles
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: "scale_pop" as WordAnimationEffect,
                  title: "Hormozi Spring Pop",
                  tag: "VIRAL",
                  desc: "Elastic spring pop with dynamic overshoot",
                },
                {
                  id: "squash_bounce" as WordAnimationEffect,
                  title: "MrBeast Squash Bounce",
                  tag: "PUNCHY",
                  desc: "Volume-preserving bounce with mass stretch",
                },
                {
                  id: "kinetic_slam" as WordAnimationEffect,
                  title: "Kinetic Slam Drop",
                  tag: "HIGH ENERGY",
                  desc: "Aggressive drop from above with impact shake",
                },
                {
                  id: "karaoke_fill" as WordAnimationEffect,
                  title: "Ali Abdaal Wipe",
                  tag: "SMOOTH",
                  desc: "Progressive left-to-right syllable clip fill",
                },
                {
                  id: "chromatic_strike" as WordAnimationEffect,
                  title: "Cyberpunk RGB Strike",
                  tag: "GLITCH",
                  desc: "Analog chromatic aberration RGB split",
                },
                {
                  id: "neon_pulse" as WordAnimationEffect,
                  title: "Neon Tube Pulse",
                  tag: "GLOW",
                  desc: "Dual-harmonic breathing luminous glow",
                },
                {
                  id: "smooth_glide" as WordAnimationEffect,
                  title: "Smooth Glide Float",
                  tag: "ELEGANT",
                  desc: "Gentle upward floating kinetic ease",
                },
                {
                  id: "highlight_box" as WordAnimationEffect,
                  title: "Highlighter Pill Pop",
                  tag: "BOX",
                  desc: "Dynamic background pill spring expansion",
                },
                {
                  id: "typewriter" as WordAnimationEffect,
                  title: "Typewriter Reveal",
                  tag: "RETRO",
                  desc: "Character-by-character synchronized reveal",
                },
                {
                  id: "single_word_flow" as WordAnimationEffect,
                  title: "Single-Word Flow",
                  tag: "FOCUS",
                  desc: "Only active spoken word visible at that time",
                },
              ].map((anim) => {
                const isActive = (animationEffectOverride || currentTemplate.animation.perWordEffect) === anim.id;
                return (
                  <button
                    key={anim.id}
                    onClick={() => setAnimationEffectOverride(anim.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? "bg-amber-500/15 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        : "bg-[#14151a] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#181920]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`text-[11px] font-bold ${isActive ? "text-amber-400" : "text-zinc-200"}`}>
                        {anim.title}
                      </span>
                      <span
                        className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                          isActive
                            ? "bg-amber-400 text-black"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {anim.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                      {anim.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Synchronization Offset */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Audio Latency Calibration
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Real-time Offset</span>
                  <span className="text-[10px] text-zinc-500">Compensate for Bluetooth / driver delay</span>
                </div>
                <span className="font-mono text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {syncOffset > 0 ? `+${Math.round(syncOffset * 1000)}ms` : syncOffset < 0 ? `${Math.round(syncOffset * 1000)}ms` : "0ms"}
                </span>
              </div>

              <input
                type="range"
                min="-0.3"
                max="0.3"
                step="0.01"
                value={syncOffset}
                onChange={(e) => setSyncOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setSyncOffset(Math.max(-0.5, syncOffset - 0.05))}
                  className="flex-1 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-[10px] font-bold"
                >
                  -50ms
                </button>
                <button
                  onClick={() => setSyncOffset(0)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-mono text-[10px]"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSyncOffset(Math.min(0.5, syncOffset + 0.05))}
                  className="flex-1 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-[10px] font-bold"
                >
                  +50ms
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: Mask AI Tools (Quality Tier, Feather, Expand/Contract, Overlay) */}
      {activeTab === "mask" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-300 font-bold">
              <Cpu className="w-4 h-4" />
              <span>Person Matting Engine</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Real-time WebGPU person segmentation with temporal smoothing and edge refinement.
            </p>
          </div>

          {/* Depth Layering Control (Front Default / Behind / Sandwich) */}
          <div className="space-y-2 p-3 rounded-xl bg-purple-950/20 border border-purple-800/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Caption Depth Placement
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {layerOrder === "front" ? "In Front (Default)" : "Depth Matting Active"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(["front", "behind", "sandwich"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayerOrder(mode)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold capitalize transition-all cursor-pointer ${
                    layerOrder === mode
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400"
                      : "bg-[#18191e] text-zinc-400 border border-zinc-800 hover:text-white"
                  }`}
                >
                  {mode === "front" ? "Front (Def)" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Tier */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Inference Quality Tier
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["fast", "balanced", "ultra"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setMaskQualityTier(tier)}
                  className={`py-2 px-2 rounded-xl text-[10px] font-bold capitalize border transition-all ${
                    maskQualityTier === tier
                      ? "bg-purple-600/30 text-purple-200 border-purple-500 shadow-md shadow-purple-900/30"
                      : "bg-[#14151a] text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  <span className="block font-bold">{tier}</span>
                  <span className="text-[8px] text-zinc-500 block">
                    {tier === "fast" ? "256px" : tier === "balanced" ? "384px" : "512px"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Feather Slider */}
          <div className="space-y-2 p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Edge Feathering</span>
                <span className="text-[10px] text-zinc-500">Separable Gaussian edge soften</span>
              </div>
              <span className="font-mono text-purple-300 font-bold text-xs bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {maskFeather}px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={maskFeather}
              onChange={(e) => setMaskFeather(parseInt(e.target.value, 10))}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Expand / Contract Slider */}
          <div className="space-y-2 p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white block">Boundary Shift</span>
                <span className="text-[10px] text-zinc-500">Morphological dilation / erosion</span>
              </div>
              <span className="font-mono text-purple-300 font-bold text-xs bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {maskExpandContract > 0 ? `+${maskExpandContract}px` : `${maskExpandContract}px`}
              </span>
            </div>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={maskExpandContract}
              onChange={(e) => setMaskExpandContract(parseInt(e.target.value, 10))}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Mask Preview Overlay Toggle */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white block">Mask Preview Overlay</span>
              <span className="text-[10px] text-zinc-500">Show cyan subject matte overlay</span>
            </div>
            <button
              onClick={toggleMaskOverlay}
              className={`w-10 h-6 rounded-full p-1 transition-colors ${
                showMaskOverlay ? "bg-purple-600" : "bg-zinc-800"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  showMaskOverlay ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Stretch Goal Notice */}
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span>
              <strong>Manual Mask Brush (Stretch Goal):</strong> Automated bilateral edge refinement is active. Manual stroke paint correction is scheduled for the upcoming pass.
            </span>
          </div>
        </div>
      )}

      {/* 7. Bottom Compact Master Export Bar */}
      <div className="p-2.5 bg-[var(--bg-card)] border-t-2 border-[var(--border-main)] flex items-center gap-2 shrink-0">
        {onOpenExportModal && (
          <button
            onClick={onOpenExportModal}
            className="neo-btn flex-1 py-2 px-3 text-xs text-[#142218] font-black gap-1.5 cursor-pointer truncate"
            title="Export final video with burned-in 1080p captions"
          >
            <Video className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Export ({exportSettings?.resolution || "1080p"})</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleExportSubtitles("srt")}
            className="neo-btn-secondary py-1 px-2.5 font-mono text-[10px] font-black cursor-pointer"
            title="Download SubRip Subtitles (.srt)"
          >
            SRT
          </button>
          <button
            onClick={() => handleExportSubtitles("vtt")}
            className="neo-btn-secondary py-1 px-2.5 font-mono text-[10px] font-black cursor-pointer"
            title="Download WebVTT Subtitles (.vtt)"
          >
            VTT
          </button>
          <button
            onClick={() => handleExportSubtitles("ass")}
            className="neo-btn-secondary py-1 px-2.5 font-mono text-[10px] font-black cursor-pointer"
            title="Download Advanced SubStation Alpha (.ass)"
          >
            ASS
          </button>
          <button
            onClick={handleBackupProject}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
            title="Download Project Backup (.json)"
          >
            <Download className="w-3.5 h-3.5 text-[var(--text-main)]" />
          </button>
        </div>
      </div>
    </div>
  );
}
