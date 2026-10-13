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
  } = useEditorStore();

  const currentTemplate = getTemplateById(templateId);

  const [activeTab, setActiveTab] = useState<"presets" | "style" | "motion">("presets");
  const [selectedVibe, setSelectedVibe] = useState<string>("all");

  const vibes = [
    { id: "all", label: "All (72)" },
    { id: "bold_viral", label: "Bold Viral" },
    { id: "neon", label: "Neon" },
    { id: "aesthetic", label: "Aesthetic" },
    { id: "bollywood", label: "Bollywood" },
    { id: "minimal", label: "Minimal" },
    { id: "podcast", label: "Podcast" },
    { id: "comic", label: "Comic" },
    { id: "news", label: "News" },
  ];

  const filteredPresets = CAPTION_PRESETS.filter((p) => {
    if (selectedVibe === "all") return true;
    return p.vibe === selectedVibe;
  });

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
    <div className="w-72 lg:w-80 flex flex-col bg-[#121316] rounded-xl border border-[#24262c] shrink-0 h-full min-h-0 overflow-hidden select-none">
      {/* 1. Panel Header & Tab Switcher */}
      <div className="h-10 px-3 bg-[#18191e] border-b border-[#24262c] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("presets")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "presets"
                ? "bg-zinc-800 text-amber-400 border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Presets Gallery
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "style"
                ? "bg-zinc-800 text-amber-400 border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Inspector
          </button>
          <button
            onClick={() => setActiveTab("motion")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "motion"
                ? "bg-zinc-800 text-amber-400 border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Motion FX
          </button>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101114] border border-zinc-800 text-amber-400 font-bold truncate max-w-[120px]">
          {currentTemplate.name}
        </span>
      </div>

      {/* 2. TAB 1: Presets Gallery */}
      {activeTab === "presets" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Vibe Category Filter Pills */}
          <div className="p-2 bg-[#14151a] border-b border-[#24262c] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {vibes.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVibe(v.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition-colors ${
                  selectedVibe === v.id
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                    : "bg-[#101114] text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5">
            {filteredPresets.map((preset) => {
              const isSelected = templateId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setTemplateId(preset.id)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden ${
                    isSelected
                      ? "bg-zinc-900 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500"
                      : "bg-[#141519] border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50"
                  }`}
                >
                  <div>
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 border border-zinc-800 text-zinc-400">
                        {preset.badge || preset.vibe.replace("_", " ")}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>

                    {/* Visual Typographic Demonstration Card */}
                    <div className="h-14 rounded-lg bg-black/70 border border-zinc-800/80 flex items-center justify-center p-1.5 text-center overflow-hidden">
                      <span
                        style={{
                          color: preset.colors.primaryText,
                          fontFamily: preset.typography.primaryFont,
                          textTransform: preset.typography.textTransform,
                          fontWeight: preset.typography.primaryWeight === "900" ? 900 : 700,
                        }}
                        className="text-sm leading-tight truncate"
                      >
                        {preset.colors.activeWordText && (
                          <span style={{ color: preset.colors.activeWordText }}>CAPTION </span>
                        )}
                        PREVIEW
                      </span>
                    </div>

                    {/* Preset Name */}
                    <h4 className="text-xs font-bold text-zinc-200 mt-2 truncate group-hover:text-amber-400 transition-colors">
                      {preset.name}
                    </h4>
                  </div>

                  <span className="text-[10px] text-zinc-500 capitalize mt-1 block">
                    {preset.vibe.replace("_", " ")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TAB 2: Style Inspector Fine-Tuning */}
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
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Font Weight</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentTemplate.typography.primaryWeight}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Case Transform</span>
                <span className="font-mono text-zinc-200 uppercase font-semibold">{currentTemplate.typography.textTransform}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Base Scale</span>
                <span className="font-mono text-amber-400 font-bold">
                  {Math.round(currentTemplate.typography.fontSizeBasePercent * 1000) / 10}%
                </span>
              </div>
            </div>
          </div>

          {/* Color Tokens */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Colors & Strokes
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Primary Text</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full border border-zinc-700"
                    style={{ backgroundColor: currentTemplate.colors.primaryText }}
                  />
                  <span className="font-mono text-zinc-300 text-[11px]">{currentTemplate.colors.primaryText}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Active Highlight</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded-full border border-zinc-700"
                    style={{ backgroundColor: currentTemplate.colors.activeWordText }}
                  />
                  <span className="font-mono text-amber-400 text-[11px] font-bold">{currentTemplate.colors.activeWordText}</span>
                </div>
              </div>

              {currentTemplate.colors.strokeColor && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Stroke Outline</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-zinc-700"
                      style={{ backgroundColor: currentTemplate.colors.strokeColor }}
                    />
                    <span className="font-mono text-zinc-400 text-[11px]">{currentTemplate.colors.strokeColor}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Box & Layout */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Box & Alignment
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Sticker Box</span>
                <span className="font-semibold text-zinc-200">
                  {currentTemplate.box?.enabled ? "Enabled" : "Transparent"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Vertical Y Position</span>
                <span className="font-mono text-amber-400 font-bold">
                  {Math.round(currentTemplate.layout.yPositionPercent * 100)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Words Per Line</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentTemplate.layout.maxWordsPerLine}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 3: Motion & FX */}
      {activeTab === "motion" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-semibold">Kinetic Engine</span>
            <h4 className="text-xs font-bold text-white capitalize">
              {currentTemplate.animation.perWordEffect.replace("_", " ")}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1">
              Synchronized to word start and end timestamps at 60 frames per second.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Scale Punch Magnitude
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 flex items-center justify-between">
              <span className="text-zinc-400">Active Pop Zoom</span>
              <span className="font-mono text-amber-400 font-bold text-sm">
                {currentTemplate.animation.scaleMagnitude}x
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Depth & Layering
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 flex items-center justify-between">
              <span className="text-zinc-400">Behind Subject Framing</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] font-semibold">
                {currentTemplate.layout.behindSubjectDepth ? "Active" : "Standard Overlay"}
              </span>
            </div>
          </div>

          {/* Audio & Caption Timing Calibration */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Audio & Caption Synchronization
            </span>
            <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Real-time Playback Offset</span>
                  <span className="text-[10px] text-zinc-500">Compensate for browser audio latency</span>
                </div>
                <span className="font-mono text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {syncOffset > 0 ? `+${Math.round(syncOffset * 1000)}ms` : syncOffset < 0 ? `${Math.round(syncOffset * 1000)}ms` : "0ms"}
                </span>
              </div>

              {/* Offset Slider */}
              <input
                type="range"
                min="-0.3"
                max="0.3"
                step="0.01"
                value={syncOffset}
                onChange={(e) => setSyncOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />

              {/* Quick Nudge Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setSyncOffset(Math.max(-0.5, syncOffset - 0.05))}
                  className="flex-1 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono text-[10px] font-bold transition-colors"
                >
                  -50ms
                </button>
                <button
                  onClick={() => setSyncOffset(0)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white font-mono text-[10px] transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSyncOffset(Math.min(0.5, syncOffset + 0.05))}
                  className="flex-1 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono text-[10px] font-bold transition-colors"
                >
                  +50ms
                </button>
              </div>

              {/* Batch Shift All Words Permanently */}
              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Nudge all timestamps:</span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => nudgeAllTimestamps(-0.05)}
                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400"
                    title="Permanently nudge all words 50ms earlier"
                  >
                    -50ms
                  </button>
                  <button
                    onClick={() => nudgeAllTimestamps(0.05)}
                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400"
                    title="Permanently nudge all words 50ms later"
                  >
                    +50ms
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Bottom Master Export Actions */}
      <div className="p-3 bg-[#14151a] border-t border-[#24262c] space-y-2">
        {onOpenExportModal && (
          <button
            onClick={onOpenExportModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <Video className="w-4 h-4 stroke-[2.5]" />
            <span>Export Studio Video (WebCodecs)</span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <button
            onClick={() => handleExportSubtitles("srt")}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#101114] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Download SubRip Subtitles"
          >
            <FileText className="w-3 h-3 text-amber-400" />
            <span>.SRT</span>
          </button>
          <button
            onClick={() => handleExportSubtitles("vtt")}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#101114] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Download WebVTT with CSS styles"
          >
            <FileText className="w-3 h-3 text-cyan-400" />
            <span>.VTT</span>
          </button>
          <button
            onClick={() => handleExportSubtitles("ass")}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#101114] border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Download Advanced SubStation Alpha with karaoke tags"
          >
            <FileText className="w-3 h-3 text-purple-400" />
            <span>.ASS</span>
          </button>
        </div>

        <button
          onClick={handleBackupProject}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#101114] hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors"
        >
          <Download className="w-3 h-3" />
          <span>Save Local Project Backup JSON</span>
        </button>
      </div>
    </div>
  );
}
