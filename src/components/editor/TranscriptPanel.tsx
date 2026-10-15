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
  X,
  Crosshair,
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

  const activeCueIndex = useMemo(
    () => cues.findIndex((c) => currentTime >= c.start && currentTime <= c.end),
    [cues, currentTime]
  );

  const scrollToActiveCue = () => {
    if (activeCueIndex !== -1) {
      const el = document.getElementById(`transcript-cue-${activeCueIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <div className="w-80 lg:w-[340px] flex flex-col bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-main)] shrink-0 h-full min-h-0 overflow-hidden select-none shadow-[3px_3px_0px_var(--border-main)] transition-colors">
      {/* 1. Panel Header & Clean Navigation */}
      <div className="h-12 px-3 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] flex items-center justify-between text-xs">
        <div className="flex items-center bg-[var(--bg-panel)] p-1 rounded-full border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
          <button
            onClick={() => setActiveTab("cues")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
              activeTab === "cues"
                ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm border border-[var(--border-main)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Cues ({cues.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("smart")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
              activeTab === "smart"
                ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm border border-[var(--border-main)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Wand2 className="w-3 h-3" />
            <span>AI Tools</span>
          </button>
          <button
            onClick={() => setActiveTab("replace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
              activeTab === "replace"
                ? "bg-[var(--accent-lime)] text-[#142218] shadow-sm border border-[var(--border-main)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Find</span>
          </button>
        </div>

        <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
          {tokens.length} words
        </span>
      </div>

      {/* 2. Subtitle Cues Stream Tab */}
      {activeTab === "cues" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Quick Filter & Script Switch Bar */}
          <div className="p-2.5 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search captions (Ctrl+F)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[11px] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-lime)] transition-colors shadow-[2px_2px_0px_var(--border-main)]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Jump to Active Cue Indicator */}
            {activeCueIndex !== -1 && (
              <button
                onClick={scrollToActiveCue}
                className="neo-btn-secondary px-2 py-1 text-[10px] gap-1 shrink-0 text-[var(--accent-lime)] cursor-pointer"
                title="Scroll transcript to current active line"
              >
                <Crosshair className="w-3 h-3" />
                <span className="hidden sm:inline">Active</span>
              </button>
            )}

            <button
              onClick={() => setScriptMode(scriptMode === "roman" ? "devanagari" : "roman")}
              className="neo-btn-secondary px-2.5 py-1 text-[10px] gap-1 shrink-0 cursor-pointer"
              title="Toggle Roman Hinglish / Hindi Devanagari"
            >
              <Languages className="w-3.5 h-3.5 text-[var(--text-main)]" />
              <span className="text-[9px] font-mono">{scriptMode === "roman" ? "EN" : "HI"}</span>
            </button>
          </div>

          {/* Subtitle Dialogue Lines */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {tokens.length === 0 ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)] text-xs">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[var(--text-muted)] mb-3">
                  <FileText className="w-6 h-6 text-[var(--accent-lime)]" />
                </div>
                <p className="font-bold text-[var(--text-main)] text-xs">No Captions Yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[200px] leading-relaxed">
                  Import any video clip to transcribe speech into word-level Hinglish captions.
                </p>
              </div>
            ) : filteredCues.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs">
                No captions matching "{searchQuery}"
              </div>
            ) : (
              filteredCues.map((cue, index) => {
                const isLineActive = currentTime >= cue.start && currentTime <= cue.end;

                return (
                  <div
                    key={cue.id}
                    id={`transcript-cue-${index}`}
                    className={`p-2.5 rounded-xl border-2 transition-all ${
                      isLineActive
                        ? "bg-[var(--accent-lime)]/20 border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                        : "bg-[var(--bg-card)] border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] hover:shadow-[3px_3px_0px_var(--border-main)]"
                    }`}
                  >
                    {/* Line Header: Play, Timecode & Word Count */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pb-1.5 border-b border-[var(--border-main)]/30">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCurrentTime(cue.start)}
                          className="w-5 h-5 rounded-full border border-[var(--border-main)] bg-[var(--accent-lime)] hover:bg-[var(--accent-lime-hover)] text-[#142218] flex items-center justify-center transition-colors cursor-pointer shadow-[1px_1px_0px_var(--border-main)]"
                          title="Play this line"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>
                        <span className="font-bold text-[var(--text-muted)]">#{index + 1}</span>
                        <span className="text-[var(--text-main)] font-semibold">
                          {formatTimecode(cue.start)} → {formatTimecode(cue.end)}
                        </span>
                      </div>
                      <span className="text-[var(--text-muted)] font-mono text-[9px] font-bold">
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
                              className="px-1.5 py-0.5 rounded-lg bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[var(--text-main)] text-xs font-bold focus:outline-none max-w-[90px] shadow-[1px_1px_0px_var(--border-main)]"
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
                            className={`px-1.5 py-0.5 rounded-md text-xs transition-all cursor-pointer ${
                              isWordActive
                                ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] font-black shadow-[1px_1px_0px_var(--border-main)] scale-105"
                                : token.isKeyword
                                ? "text-[var(--text-main)] font-black underline decoration-[var(--accent-lime)] decoration-2 hover:bg-[var(--accent-lime)]/30"
                                : "text-[var(--text-main)] hover:bg-[var(--accent-lime)]/20"
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
          <div className="neo-card p-4 space-y-3 bg-[var(--bg-card)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--border-main)] bg-[var(--accent-lime)] text-[#142218] flex items-center justify-center font-bold shadow-[2px_2px_0px_var(--border-main)]">
                <Zap className="w-4 h-4 fill-current text-[#142218]" />
              </div>
              <div>
                <h4 className="font-extrabold text-[var(--text-main)] text-xs">1-Click Viral Mode</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Tempo + Keywords + Emojis</p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Analyzes speech tempo (WPM), highlights power keywords, and applies the highest-performing caption preset.
            </p>
            <button
              onClick={handleApplyViralMode}
              className="neo-btn w-full py-2 text-xs text-[#142218] gap-1.5 font-black"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>Apply Viral Mode</span>
            </button>
          </div>

          {/* Keywords Highlight */}
          <div className="neo-card p-3.5 space-y-2 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
                Power Keywords
              </span>
              <button
                onClick={handleToggleKeywords}
                className="neo-btn-secondary px-2.5 py-1 text-[10px]"
              >
                Highlight
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Scans technical and action words (e.g. <em>cadastral, blockchain, 3D</em>) for pop accent colors.
            </p>
          </div>

          {/* Smart Emojis */}
          <div className="neo-card p-3.5 space-y-2 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-[var(--accent-lime)]" />
                Creator Emojis
              </span>
              <button
                onClick={handleSmartEmojis}
                className="neo-btn-secondary px-2.5 py-1 text-[10px]"
              >
                Inject Emojis
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Appends contextual emojis (🎥, 🚀, 💡, 💰) next to matching spoken terms.
            </p>
          </div>

          {/* Clean Fillers */}
          <div className="neo-card p-3.5 space-y-2 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                Clean Fillers
              </span>
              <button
                onClick={handleCleanFillers}
                className="neo-btn-secondary px-2.5 py-1 text-[10px]"
              >
                Remove
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Strips hesitation fillers ("umm", "matlab", "basically") to tighten pacing.
            </p>
          </div>
        </div>
      )}

      {/* 4. Find & Replace Tab */}
      {activeTab === "replace" && (
        <div className="flex-1 p-3 space-y-3 text-xs">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text-muted)]">Find Text</label>
            <input
              type="text"
              placeholder="e.g. uelpings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] text-xs text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_var(--border-main)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--text-muted)]">Replace With</label>
            <input
              type="text"
              placeholder="e.g. buildings"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] text-xs text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_var(--border-main)]"
            />
          </div>

          <button
            onClick={handleReplaceAll}
            disabled={!searchQuery.trim()}
            className="neo-btn w-full py-2 text-xs text-[#142218] gap-1.5 font-bold disabled:opacity-40"
          >
            <Replace className="w-3.5 h-3.5" />
            Replace All Occurrences
          </button>
        </div>
      )}
    </div>
  );
}
