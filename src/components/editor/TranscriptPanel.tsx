"use client";

import React, { useState, useMemo } from "react";
import { useEditorStore } from "@/lib/editorStore";
import {
  Languages,
  AlertTriangle,
  Play,
  Search,
  Zap,
  Smile,
  Sparkles,
  Trash2,
  Replace,
  Check,
  Edit2,
  Layers,
  FileText,
  Wand2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { applyViralMode } from "@/lib/smart/viralMode";
import { applySmartEmojis } from "@/lib/smart/emojiTagging";
import { removeFillerWords } from "@/lib/smart/audioCleanup";
import { highlightKeywords } from "@/lib/smart/keywordHighlighter";

interface CueBlock {
  id: string;
  start: number;
  end: number;
  text: string;
  tokens: any[];
}

export function TranscriptPanel() {
  const {
    tokens,
    setTokens,
    setTemplateId,
    duration,
    selectedWordId,
    selectWord,
    updateWordText,
    scriptMode,
    setScriptMode,
    currentTime,
    setCurrentTime,
    isReviewMode,
    toggleReviewMode,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<"cues" | "smart" | "replace">("cues");
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editWordValue, setEditWordValue] = useState("");

  // Group individual word tokens into clean, human-readable subtitle lines
  const cues: CueBlock[] = useMemo(() => {
    if (!tokens || tokens.length === 0) return [];
    const result: CueBlock[] = [];
    let currentGroup: any[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = currentGroup[currentGroup.length - 1];

      const pauseGap = prev ? token.start - prev.end : 0;
      const endsWithPunct = prev ? /[.!?]$/.test(prev.text.trim()) : false;

      if (currentGroup.length >= 6 || pauseGap > 0.4 || (endsWithPunct && currentGroup.length >= 3)) {
        if (currentGroup.length > 0) {
          result.push({
            id: `cue_${result.length + 1}`,
            start: currentGroup[0].start,
            end: currentGroup[currentGroup.length - 1].end,
            text: currentGroup.map((t) => t.text).join(" "),
            tokens: [...currentGroup],
          });
          currentGroup = [];
        }
      }
      currentGroup.push(token);
    }

    if (currentGroup.length > 0) {
      result.push({
        id: `cue_${result.length + 1}`,
        start: currentGroup[0].start,
        end: currentGroup[currentGroup.length - 1].end,
        text: currentGroup.map((t) => t.text).join(" "),
        tokens: [...currentGroup],
      });
    }

    return result;
  }, [tokens]);

  const filteredCues = useMemo(() => {
    if (!searchQuery.trim()) return cues;
    const q = searchQuery.toLowerCase();
    return cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [cues, searchQuery]);

  const lowConfidenceCount = tokens.filter((t) => t.confidence < 0.85).length;

  const handleApplyViralMode = () => {
    const res = applyViralMode(tokens, duration);
    setTokens(res.tokens);
    setTemplateId(res.recommendedTemplateId);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.5 },
      colors: ["#39FF14", "#FFE600", "#FF007F"],
    });
  };

  const handleToggleKeywords = () => {
    const updated = highlightKeywords(tokens, 0.25);
    setTokens(updated);
  };

  const handleSmartEmojis = () => {
    const updated = applySmartEmojis(tokens);
    setTokens(updated);
  };

  const handleCleanFillers = () => {
    const updated = removeFillerWords(tokens);
    setTokens(updated);
  };

  const handleReplaceAll = () => {
    if (!searchQuery.trim()) return;
    const regex = new RegExp(searchQuery, "gi");
    const replaced = tokens.map((t) => ({
      ...t,
      text: t.text.replace(regex, replaceQuery),
    }));
    setTokens(replaced);
    setSearchQuery("");
    setReplaceQuery("");
  };

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="w-72 lg:w-80 flex flex-col bg-[#121316] rounded-xl border border-[#24262c] shrink-0 h-full min-h-0 overflow-hidden select-none">
      {/* 1. Panel Header & Clean Navigation */}
      <div className="h-10 px-3 bg-[#18191e] border-b border-[#24262c] flex items-center justify-between text-xs">
        <div className="flex items-center bg-[#101114] p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab("cues")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "cues"
                ? "bg-zinc-800 text-amber-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Captions ({cues.length})
          </button>
          <button
            onClick={() => setActiveTab("smart")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "smart"
                ? "bg-zinc-800 text-amber-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            AI Tools
          </button>
          <button
            onClick={() => setActiveTab("replace")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeTab === "replace"
                ? "bg-zinc-800 text-amber-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Find
          </button>
        </div>

        <span className="text-[10px] font-mono text-zinc-500 font-semibold">
          {tokens.length} words
        </span>
      </div>

      {/* 2. Subtitle Cues Stream Tab */}
      {activeTab === "cues" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Quick Filter & Script Switch Bar */}
          <div className="p-2 bg-[#14151a] border-b border-[#24262c] flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search captions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1 rounded-lg bg-[#101114] border border-zinc-800 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => setScriptMode(scriptMode === "roman" ? "devanagari" : "roman")}
              className="px-2 py-1 rounded-lg bg-[#101114] border border-zinc-800 text-zinc-300 hover:text-white text-[10px] font-semibold"
              title="Toggle Roman Hinglish / Hindi Devanagari"
            >
              <Languages className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          {/* Subtitle Dialogue Lines */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {tokens.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-400 mb-3 shadow-inner">
                  <FileText className="w-6 h-6 text-amber-400/80" />
                </div>
                <p className="font-bold text-zinc-200 text-xs">No Captions Yet</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px] leading-relaxed">
                  Import any video clip to transcribe speech into word-level Hinglish captions.
                </p>
              </div>
            ) : filteredCues.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No captions matching "{searchQuery}"
              </div>
            ) : (
              filteredCues.map((cue, index) => {
                const isLineActive = currentTime >= cue.start && currentTime <= cue.end;

                return (
                  <div
                    key={cue.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isLineActive
                        ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30"
                        : "bg-[#141519] border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    {/* Line Header: Play, Timecode & Word Count */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-1.5 border-b border-zinc-800/40">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentTime(cue.start)}
                          className="w-5 h-5 rounded-md bg-[#1c1d24] hover:bg-amber-500 hover:text-black flex items-center justify-center text-amber-400 transition-colors"
                          title="Play this line"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>
                        <span className="text-zinc-500 font-bold">#{index + 1}</span>
                        <span className="text-zinc-300">
                          {formatTimecode(cue.start)} → {formatTimecode(cue.end)}
                        </span>
                      </div>
                      <span className="text-zinc-500 font-mono text-[9px]">
                        {cue.tokens.length} words
                      </span>
                    </div>

                    {/* Interactive Words within the line */}
                    <div className="pt-2 flex flex-wrap gap-1 leading-relaxed">
                      {cue.tokens.map((token: any) => {
                        const isWordActive = currentTime >= token.start && currentTime <= token.end;
                        const isEditing = editingWordId === token.id;

                        if (isEditing) {
                          return (
                            <input
                              key={token.id}
                              autoFocus
                              type="text"
                              value={editWordValue}
                              onChange={(e) => setEditWordValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateWordText(token.id, editWordValue);
                                  setEditingWordId(null);
                                } else if (e.key === "Escape") {
                                  setEditingWordId(null);
                                }
                              }}
                              onBlur={() => {
                                updateWordText(token.id, editWordValue);
                                setEditingWordId(null);
                              }}
                              className="px-1 py-0.5 rounded bg-zinc-900 border border-amber-400 text-white text-xs font-bold focus:outline-none max-w-[90px]"
                            />
                          );
                        }

                        return (
                          <span
                            key={token.id}
                            onClick={() => {
                              selectWord(token.id);
                              setCurrentTime(token.start);
                            }}
                            onDoubleClick={() => {
                              setEditingWordId(token.id);
                              setEditWordValue(token.text);
                            }}
                            className={`px-1 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                              isWordActive
                                ? "bg-amber-400 text-black font-extrabold shadow-sm scale-105"
                                : token.isKeyword
                                ? "text-amber-300 font-bold hover:bg-zinc-800"
                                : "text-zinc-200 hover:bg-zinc-800 hover:text-white"
                            }`}
                            title={`Click to jump to ${formatTimecode(token.start)}. Double-click to edit.`}
                          >
                            {token.text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. AI Smart Studio Tab */}
      {activeTab === "smart" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {/* Viral Mode Card */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 via-[#18191e] to-orange-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">1-Click Viral Mode</h4>
                <p className="text-[10px] text-zinc-400">Tempo + Keywords + Emojis</p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-300">
              Analyzes speech tempo (WPM), highlights power keywords, and applies the highest-performing caption preset.
            </p>
            <button
              onClick={handleApplyViralMode}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs shadow-md shadow-amber-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              Apply Viral Mode
            </button>
          </div>

          {/* Keywords Highlight */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                Power Keywords
              </span>
              <button
                onClick={handleToggleKeywords}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold"
              >
                Highlight
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Scans technical and action words (e.g. <em>cadastral, blockchain, 3D</em>) for pop accent colors.
            </p>
          </div>

          {/* Smart Emojis */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-cyan-400" />
                Creator Emojis
              </span>
              <button
                onClick={handleSmartEmojis}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold"
              >
                Inject Emojis
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Appends contextual emojis (🎥, 🚀, 💡, 💰) next to matching spoken terms.
            </p>
          </div>

          {/* Clean Fillers */}
          <div className="p-3 rounded-xl bg-[#14151a] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Clean Fillers
              </span>
              <button
                onClick={handleCleanFillers}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold"
              >
                Remove
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Strips hesitation fillers ("umm", "matlab", "basically") to tighten pacing.
            </p>
          </div>
        </div>
      )}

      {/* 4. Find & Replace Tab */}
      {activeTab === "replace" && (
        <div className="flex-1 p-3 space-y-3 text-xs">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400">Find Text</label>
            <input
              type="text"
              placeholder="e.g. uelpings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#101114] border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400">Replace With</label>
            <input
              type="text"
              placeholder="e.g. buildings"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#101114] border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleReplaceAll}
            disabled={!searchQuery.trim()}
            className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Replace className="w-3.5 h-3.5" />
            Replace All Occurrences
          </button>
        </div>
      )}
    </div>
  );
}
