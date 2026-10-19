"use client";

import React, { useState, useMemo } from "react";
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
  RotateCcw,
  Search,
} from "lucide-react";

import { CAPTION_PRESETS, getTemplateById } from "@/lib/templates";
import { type TemplateVibe, type WordAnimationEffect } from "@/lib/templates/schema";
import { generateSrt, generateVtt, generateAss } from "@/lib/export/subtitleFormatters";
import { saveBlobToDisk } from "@/lib/export/fileSaver";
import { opfsMaskCache } from "@/lib/segmentation/opfsMaskCache";


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
  const [presetSearchQuery, setPresetSearchQuery] = useState("");

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
  const partAIds = useMemo(
    () =>
      new Set([
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
      ]),
    []
  );

  // Filter Presets by Search Query + Primary Filter Chip + Vibe Chip
  const filteredPresets = useMemo(() => {
    return CAPTION_PRESETS.filter((p) => {
      // 1. Live text search
      if (presetSearchQuery.trim()) {
        const q = presetSearchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesVibe = p.vibe.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesTags = (p as any).tags?.some?.((t: string) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesVibe && !matchesId && !matchesTags) {
          return false;
        }
      }

      // 2. Primary Filter Chip
      if (primaryFilter === "text_styles" && !partAIds.has(p.id)) return false;
      if (primaryFilter === "behind_subject" && !p.layout.behindSubjectDepth) return false;

      // 3. Vibe Filter Chip
      if (selectedVibe !== "all" && p.vibe !== selectedVibe) return false;

      return true;
    });
  }, [presetSearchQuery, primaryFilter, selectedVibe, partAIds]);


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
      {/* 1. Panel Header & Tab Switcher with Icons */}
      <div className="p-1.5 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] grid grid-cols-4 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("presets")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "presets"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
          title="Browse 73 viral caption presets"
        >
          <Palette className="w-3.5 h-3.5 shrink-0" />
          <span>Presets</span>
        </button>
        <button
          onClick={() => setActiveTab("style")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "style"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
          title="Customize fonts, colors, borders, and position"
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span>Style</span>
        </button>
        <button
          onClick={() => setActiveTab("motion")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "motion"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
          title="Word animations, pop-in speed, and motion effects"
        >
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>Motion</span>
        </button>
        <button
          onClick={() => setActiveTab("mask")}
          className={`py-1.5 px-1 rounded-full text-[11px] font-extrabold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "mask"
              ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm font-black"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]"
          }`}
          title="Behind-the-subject depth matting, feathering, and overlay tools"
        >
          <Cpu className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Depth AI</span>
        </button>
      </div>

      {/* 2. Persistent Active Style & 1-Click Depth Placement Bar */}
      <div className="px-3 py-2 bg-[var(--bg-panel)] border-b-2 border-[var(--border-main)] flex flex-col gap-1.5 text-xs shrink-0">
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider shrink-0">Active:</span>
            <span className="font-extrabold text-[var(--text-main)] truncate text-[11px]">{currentTemplate.name}</span>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)] uppercase shrink-0">
            {currentTemplate.vibe.replace("_", " ")}
          </span>
        </div>

        {/* 1-Click Depth Placement Quick Controls */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1 bg-[var(--bg-card)] p-0.5 rounded-full border border-[var(--border-main)] text-[10px] shadow-sm">
            {(["front", "behind", "sandwich"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayerOrder(mode)}
                className={`px-2 py-0.5 rounded-full font-bold capitalize transition-all cursor-pointer ${
                  layerOrder === mode
                    ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm font-black"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {mode === "front" ? "Front" : mode}
              </button>
            ))}
          </div>

          {layerOrder !== "front" && activeTab !== "mask" && (
            <button
              onClick={() => setActiveTab("mask")}
              className="text-[10px] font-bold text-[var(--accent-lime)] hover:underline flex items-center gap-0.5 cursor-pointer bg-[var(--accent-forest)]/40 px-2 py-0.5 rounded-md border border-[var(--border-main)]"
              title="Tune edge feathering, shift, and preview matte"
            >
              <span>Matte Settings</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

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
          {/* Quick Preset Search Input */}
          <div className="p-2 bg-[var(--bg-card)] border-b border-[var(--border-main)] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search 73 presets (e.g. Hormozi, Neon, Behind)..."
                value={presetSearchQuery}
                onChange={(e) => setPresetSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[11px] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-lime)] transition-colors shadow-[1px_1px_0px_var(--border-main)]"
              />
              {presetSearchQuery && (
                <button
                  onClick={() => setPresetSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)] shrink-0">
              {filteredPresets.length}
            </span>
          </div>

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
              onClick={() => setPrimaryFilter("behind_subject")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer border-2 border-[var(--border-main)] ${
                primaryFilter === "behind_subject"
                  ? "bg-[var(--accent-lime)] text-[#142218] shadow-[2px_2px_0px_var(--border-main)]"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-[1px_1px_0px_var(--border-main)]"
              }`}
            >
              Behind Subject (Depth)
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
                  onClick={() => {
                    setTemplateId(preset.id);
                    setLayerOrder(preset.layout?.layerOrder || (preset.layout?.behindSubjectDepth ? "behind" : "front"));
                  }}
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

                        if (preset.id === "winner") {
                          return (
                            <span className="flex flex-col items-start justify-center pl-1.5 select-none relative z-10 w-full overflow-hidden leading-tight">
                              <span className="text-[8px] font-black lowercase text-zinc-300 tracking-tight leading-none mb-0.5">
                                the
                              </span>
                              <span className="relative inline-block leading-none">
                                <span
                                  className="text-base font-black lowercase text-white tracking-tighter leading-none"
                                  style={{
                                    fontFamily: "Montserrat, sans-serif",
                                    textShadow: "0 2px 4px rgba(0,0,0,0.9)",
                                  }}
                                >
                                  only
                                </span>
                                <span
                                  className="absolute -left-0.5 top-1.5 text-[13px] font-medium text-[#FF0022] -rotate-7 tracking-normal whitespace-nowrap"
                                  style={{
                                    fontFamily: "'SignPainter', 'SignPainter-HouseScript', 'SignPainter House Script', 'Satisfy', cursive, sans-serif",
                                    textShadow: "0 1px 3px rgba(0,0,0,0.95)",
                                    WebkitTextStroke: "0.5px rgba(0,0,0,0.85)",
                                  }}
                                >
                                  Consequence
                                </span>
                              </span>
                              <span className="text-[8px] font-black lowercase text-zinc-300 tracking-tight leading-none mt-0.5">
                                is failure
                              </span>
                            </span>
                          );
                        }

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
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
          {/* Active Preset Summary */}
          <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider block">Active Preset</span>
              <h4 className="text-xs font-black text-[var(--text-main)]">{currentTemplate.name}</h4>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#142218] text-[10px] font-mono border border-[var(--border-main)] font-black uppercase shadow-[1px_1px_0px_var(--border-main)]">
              {currentTemplate.vibe.replace("_", " ")}
            </span>
          </div>

          {/* Layer Depth Control (Front Default / Behind / Sandwich) */}
          <div className="space-y-2 p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-wider block">
                Depth Placement
              </span>
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                {layerOrder === "front" ? "In Front" : layerOrder === "behind" ? "Behind Subject" : "Sandwich 3D"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 pt-0.5 bg-[var(--bg-panel)] p-1 rounded-full border border-[var(--border-main)]">
              {(["front", "behind", "sandwich"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayerOrder(mode)}
                  className={`py-1 px-2 rounded-full text-[10px] font-extrabold capitalize transition-all cursor-pointer ${
                    layerOrder === mode
                      ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm font-black border border-[var(--border-main)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {mode === "front" ? "Front" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Typography Controls */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Typography & Fonts
            </span>
            <div className="space-y-2.5 p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)] font-semibold">Primary Font</span>
                <span className="font-mono text-[var(--text-main)] font-black">{currentTemplate.typography.primaryFont}</span>
              </div>
              {currentTemplate.typography.secondaryFont && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)] font-semibold">Indian / Script Font</span>
                  <span className="font-mono text-[var(--text-main)] font-black">{currentTemplate.typography.secondaryFont}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)] font-semibold">Font Weight</span>
                <span className="font-mono text-[var(--text-main)] font-bold">{currentTemplate.typography.primaryWeight}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)] font-semibold">Base Scale</span>
                <span className="font-mono text-[var(--text-main)] font-black px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] text-[10px] shadow-[1px_1px_0px_var(--border-main)]">
                  {Math.round(currentTemplate.typography.fontSizeBasePercent * 1000) / 10}%
                </span>
              </div>
            </div>
          </div>

          {/* Colors & Effects */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Colors & Shaders
            </span>
            <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] font-semibold">Primary Color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-[var(--border-main)] shadow-sm"
                    style={{ backgroundColor: currentTemplate.colors.primaryText }}
                  />
                  <span className="font-mono text-[var(--text-main)] text-[11px] font-bold">{currentTemplate.colors.primaryText}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] font-semibold">Active Keyword</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-[var(--border-main)] shadow-sm"
                    style={{ backgroundColor: currentTemplate.colors.activeWordText }}
                  />
                  <span className="font-mono text-[var(--text-main)] text-[11px] font-black">{currentTemplate.colors.activeWordText}</span>
                </div>
              </div>

              {currentTemplate.colors.gradient && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] font-semibold">Gradient Spec</span>
                  <span className="font-mono text-[var(--text-main)] font-black">{currentTemplate.colors.gradient.stops.length} Stops</span>
                </div>
              )}

              {currentTemplate.colors.extrusion && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] font-semibold">3D Extrusion</span>
                  <span className="font-mono text-[var(--text-main)] font-black">{currentTemplate.colors.extrusion.steps} Passes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: Motion & FX */}
      {activeTab === "motion" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
          {/* Kinetic Engine Header */}
          <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Kinetic Engine</span>
              {animationEffectOverride && (
                <button
                  onClick={() => setAnimationEffectOverride(null)}
                  className="text-[10px] font-mono text-[var(--text-main)] hover:underline cursor-pointer font-bold"
                >
                  Reset to Default
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[var(--text-main)] capitalize flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
                {(animationEffectOverride || currentTemplate.animation.perWordEffect).replace("_", " ")}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                {animationEffectOverride ? "CUSTOM" : "PRESET"}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Real-time Canvas2D kinetic typography synchronized with speech timestamps.
            </p>
          </div>

          {/* Kinetic Typography Animation Styles Grid */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
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
                    className={`p-2.5 rounded-2xl text-left border-2 border-[var(--border-main)] transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? "bg-[var(--accent-lime)]/20 shadow-[3px_3px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                        : "bg-[var(--bg-card)] shadow-[2px_2px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_var(--border-main)]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[11px] font-black text-[var(--text-main)]">
                        {anim.title}
                      </span>
                      <span
                        className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full font-black border border-[var(--border-main)] ${
                          isActive
                            ? "bg-[var(--accent-lime)] text-[#142218] shadow-[1px_1px_0px_var(--border-main)]"
                            : "bg-[var(--bg-panel)] text-[var(--text-muted)]"
                        }`}
                      >
                        {anim.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                      {anim.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Synchronization Offset */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Audio Latency Calibration
            </span>
            <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-black text-[var(--text-main)] block">Real-time Offset</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Compensate for Bluetooth / driver delay</span>
                </div>
                <span className="font-mono text-[#142218] font-black text-xs bg-[var(--accent-lime)] px-2.5 py-0.5 rounded-full border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
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
                className="w-full accent-[var(--accent-lime)] cursor-pointer"
              />

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setSyncOffset(Math.max(-0.5, syncOffset - 0.05))}
                  className="neo-btn-secondary flex-1 py-1 text-[10px] font-mono font-bold"
                >
                  -50ms
                </button>
                <button
                  onClick={() => setSyncOffset(0)}
                  className="neo-btn-secondary px-3 py-1 text-[10px] font-mono font-bold"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSyncOffset(Math.min(0.5, syncOffset + 0.05))}
                  className="neo-btn-secondary flex-1 py-1 text-[10px] font-mono font-bold"
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
        <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--accent-forest)] text-[var(--text-light)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[var(--accent-lime)] font-black text-xs">
              <Cpu className="w-4 h-4" />
              <span>Person Matting Engine</span>
            </div>
            <p className="text-[11px] text-stone-200 leading-relaxed">
              Real-time on-device WebGPU person segmentation with temporal smoothing and edge refinement.
            </p>
          </div>

          {/* Depth Layering Control (Front Default / Behind / Sandwich) */}
          <div className="space-y-2 p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-wider block">
                Caption Depth Placement
              </span>
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                {layerOrder === "front" ? "In Front" : "Depth Matting Active"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-0.5 bg-[var(--bg-panel)] p-1 rounded-full border border-[var(--border-main)]">
              {(["front", "behind", "sandwich"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayerOrder(mode)}
                  className={`py-1 px-2 rounded-full text-[10px] font-extrabold capitalize transition-all cursor-pointer ${
                    layerOrder === mode
                      ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm font-black border border-[var(--border-main)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {mode === "front" ? "Front" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Tier */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Inference Quality Tier
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["fast", "balanced", "ultra"] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setMaskQualityTier(tier)}
                  className={`py-2 px-2 rounded-2xl text-[10px] font-black capitalize border-2 border-[var(--border-main)] transition-all cursor-pointer ${
                    maskQualityTier === tier
                      ? "bg-[var(--accent-lime)] text-[#142218] shadow-[3px_3px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] shadow-[2px_2px_0px_var(--border-main)] hover:text-[var(--text-main)] hover:shadow-[3px_3px_0px_var(--border-main)]"
                  }`}
                >
                  <span className="block font-black text-[11px]">{tier}</span>
                  <span className={`text-[8px] font-mono block ${maskQualityTier === tier ? "text-[#142218]" : "text-[var(--text-muted)]"}`}>
                    {tier === "fast" ? "256px" : tier === "balanced" ? "384px" : "512px"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders: Edge Feathering & Boundary Shift */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block px-1">
              Edge Refinement
            </span>
            <div className="space-y-3 p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              {/* Edge Feathering */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-[var(--text-main)] block text-xs">Edge Feathering</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Separable Gaussian edge soften</span>
                  </div>
                  <span className="font-mono text-[#142218] font-black text-xs bg-[var(--accent-lime)] px-2.5 py-0.5 rounded-full border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
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
                  className="w-full accent-[var(--accent-lime)] cursor-pointer"
                />
              </div>

              <div className="h-px bg-[var(--border-main)]/20" />

              {/* Boundary Shift */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-[var(--text-main)] block text-xs">Boundary Shift</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Morphological dilation / erosion</span>
                  </div>
                  <span className="font-mono text-[#142218] font-black text-xs bg-[var(--accent-lime)] px-2.5 py-0.5 rounded-full border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
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
                  className="w-full accent-[var(--accent-lime)] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Mask Preview Overlay Toggle */}
          <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-between">
            <div>
              <span className="font-black text-[var(--text-main)] block text-xs">Mask Preview Overlay</span>
              <span className="text-[10px] text-[var(--text-muted)]">Show cyan subject matte overlay in monitor</span>
            </div>
            <button
              onClick={toggleMaskOverlay}
              className={`w-11 h-6 rounded-full p-0.5 border-2 border-[var(--border-main)] transition-colors cursor-pointer shadow-[1px_1px_0px_var(--border-main)] ${
                showMaskOverlay ? "bg-[var(--accent-lime)]" : "bg-[var(--bg-panel)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border border-[var(--border-main)] transition-transform ${
                  showMaskOverlay ? "translate-x-5 bg-[#142218]" : "translate-x-0 bg-[var(--text-muted)]"
                }`}
              />
            </button>
          </div>

          {/* Reset / Purge Matte Cache Button */}
          <div className="p-3 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-between">
            <div>
              <span className="font-black text-[var(--text-main)] block text-xs">Reset Matte Cache</span>
              <span className="text-[10px] text-[var(--text-muted)]">Purge old caches & recompute clean ML masks</span>
            </div>
            <button
              onClick={async () => {
                await opfsMaskCache.clearAllCache();
                setSyncOffset(syncOffset); // Trigger state refresh
              }}
              className="neo-btn-secondary px-3 py-1.5 text-[11px] gap-1.5"
              title="Purge all cached masks from browser storage"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Clean Notice */}
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] text-[10px] text-[var(--text-muted)] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[var(--accent-lime)] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--text-main)]">Automated Edge Refinement:</strong> Real-time bilateral edge smoothing and WebGPU temporal consistency are enabled.
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
