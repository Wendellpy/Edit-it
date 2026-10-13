"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { TranscriptPanel } from "@/components/editor/TranscriptPanel";
import { VideoPlayerPreview } from "@/components/editor/VideoPlayerPreview";
import { TemplateStyleDock } from "@/components/editor/TemplateStyleDock";
import { WaveformTimeline } from "@/components/editor/WaveformTimeline";
import { ReviewModeDrawer } from "@/components/ReviewModeDrawer";
import { KeyboardShortcutsModal } from "@/components/editor/KeyboardShortcutsModal";
import { ExportModal } from "@/components/editor/ExportModal";
import { TranscribeModal } from "@/components/editor/TranscribeModal";
import { useEditorStore } from "@/lib/editorStore";
import {
  Undo2,
  Redo2,
  Keyboard,
  Sparkles,
  Layers,
  HelpCircle,
  Download,
  Film,
  FolderKanban,
  Settings,
  HardDrive,
  Cpu,
  Sliders,
  CheckCircle2,
  ChevronDown,
  Mic,
  Upload,
} from "lucide-react";

export default function EditorStudioPage() {
  const {
    tokens,
    selectedWordId,
    selectWord,
    updateWordText,
    undo,
    redo,
    canUndo,
    canRedo,
    togglePlay,
    nudgeWord,
    currentTime,
    setCurrentTime,
    duration,
    isReviewMode,
    toggleReviewMode,
    setVideo,
  } = useEditorStore();

  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [activeWorkspace, setActiveWorkspace] = useState<"edit" | "captions" | "widescreen">("edit");
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTranscribeModalOpen, setIsTranscribeModalOpen] = useState(false);
  const [autoStartTranscribe, setAutoStartTranscribe] = useState(false);
  const masterFileInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Space = Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }

      // J / K / L = Scrub backwards / Pause / Scrub forwards
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setCurrentTime(Math.max(0, currentTime - 1.0));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setCurrentTime(Math.min(duration || 5, currentTime + 1.0));
      }

      // Left / Right Arrow = Step 1 Frame (-33ms / +33ms)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey && selectedWordId) {
          nudgeWord(selectedWordId, -0.05);
        } else {
          setCurrentTime(Math.max(0, currentTime - 1 / 30));
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey && selectedWordId) {
          nudgeWord(selectedWordId, 0.05);
        } else {
          setCurrentTime(Math.min(duration || 5, currentTime + 1 / 30));
        }
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo()) redo();
        } else {
          if (canUndo()) undo();
        }
      }

      // Shortcuts Modal
      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, setCurrentTime, currentTime, duration, selectedWordId, nudgeWord, canUndo, canRedo, undo, redo]);

  const selectedWordIndex = tokens.findIndex((t) => t.id === selectedWordId);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#0b0c0e] text-zinc-100 overflow-hidden select-none">
      {/* 1. Master Application Menu & Status Bar (Premiere / DaVinci Chrome) */}
      <header className="h-11 border-b border-[#24262c] bg-[#141519] px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 z-40">
        {/* Left: Branding & Project Meta */}
        <div className="flex items-center gap-3">
          {/* Logo & App Home */}
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Return to BolSub Studio Home"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center text-black font-black text-xs shadow-md shadow-amber-500/20">
              B
            </div>
            <span className="font-extrabold tracking-tight text-white hidden sm:inline">
              BolSub<span className="text-amber-400">.Studio</span>
            </span>
          </Link>

          <div className="h-4 w-px bg-zinc-700/80" />

          {/* Project Title Input */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-[#0e0f12] px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
            <span className="text-zinc-500 font-bold">PROJECT:</span>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="bg-transparent text-amber-300 font-semibold focus:outline-none focus:text-white max-w-[140px] sm:max-w-[200px]"
            />
          </div>

          {/* Local Sandbox Badge */}
          <div className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            100% On-Device OPFS
          </div>
        </div>

        {/* Center: Workspaces Mode Switcher */}
        <div className="hidden lg:flex items-center bg-[#0e0f12] p-0.5 rounded-lg border border-zinc-800 text-[11px] font-semibold">
          <button
            onClick={() => setActiveWorkspace("edit")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeWorkspace === "edit"
                ? "bg-zinc-800 text-amber-400 font-bold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Studio Layout
          </button>
          <button
            onClick={() => setActiveWorkspace("widescreen")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeWorkspace === "widescreen"
                ? "bg-zinc-800 text-amber-400 font-bold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Focus on 16:9 widescreen video playback"
          >
            16:9 Cinema
          </button>
          <button
            onClick={() => setActiveWorkspace("captions")}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeWorkspace === "captions"
                ? "bg-zinc-800 text-amber-400 font-bold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Expanded script editor for captions"
          >
            Captions Focus
          </button>
        </div>

        {/* Right: Actions, Shortcuts & Export */}
        <div className="flex items-center gap-2">
          {/* Import Video Clip */}
          <button
            onClick={() => masterFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101114] hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold transition-colors"
            title="Import video clip from device"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Import Video</span>
          </button>
          <input
            ref={masterFileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setVideo(file);
                setAutoStartTranscribe(true);
                setIsTranscribeModalOpen(true);
              }
            }}
          />

          {/* AI Transcribe Hub Button */}
          <button
            onClick={() => {
              setAutoStartTranscribe(false);
              setIsTranscribeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition-all shadow-sm cursor-pointer"
            title="Open AI Speech-to-Text Transcription Hub"
          >
            <Mic className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span>Transcribe AI</span>
          </button>

          {/* Projects Dashboard Link */}
          <Link
            href="/projects"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#101114] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-semibold transition-colors"
            title="Open Projects Dashboard"
          >
            <FolderKanban className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Projects</span>
          </Link>

          {/* Undo / Redo */}
          <div className="flex items-center bg-[#101114] rounded-lg border border-zinc-800 p-0.5">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1 rounded hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1 rounded hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400 transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Shortcuts Modal Trigger */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-1.5 rounded-lg bg-[#101114] hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-300 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Master Glowing Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] text-xs cursor-pointer ml-1"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* 2. Main Studio 4-Panel Dock Area */}
      <main className="flex-1 flex flex-col p-2 gap-2 overflow-hidden min-h-0">
        {/* Top Split: Script Studio | Program Monitor | Style Inspector */}
        <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0 overflow-hidden">
          {/* Left Dock: Transcript Panel */}
          {activeWorkspace !== "widescreen" && (
            <div className={activeWorkspace === "captions" ? "w-96 lg:w-[460px] shrink-0 h-full flex" : ""}>
              <TranscriptPanel />
            </div>
          )}

          {/* Center Dock: Program Monitor & Collapsible Review Drawer */}
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <VideoPlayerPreview
              onOpenTranscribe={() => {
                setAutoStartTranscribe(true);
                setIsTranscribeModalOpen(true);
              }}
            />

            {/* Review Drawer when low confidence words are being audited */}
            {isReviewMode && (
              <ReviewModeDrawer
                words={tokens}
                currentWordIndex={selectedWordIndex >= 0 ? selectedWordIndex : 0}
                onSelectWord={(idx) => {
                  if (tokens[idx]) {
                    selectWord(tokens[idx].id);
                    setCurrentTime(tokens[idx].start);
                  }
                }}
                onUpdateWordText={(idx, text) => {
                  if (tokens[idx]) {
                    updateWordText(tokens[idx].id, text);
                  }
                }}
                onClose={toggleReviewMode}
              />
            )}
          </div>

          {/* Right Dock: Template & Essential Graphics Inspector */}
          {activeWorkspace !== "captions" && (
            <TemplateStyleDock onOpenExportModal={() => setIsExportModalOpen(true)} />
          )}
        </div>

        {/* Bottom Dock: Multi-Track NLE Timeline */}
        <WaveformTimeline />
      </main>

      {/* AI Speech-to-Text Transcribe Modal */}
      <TranscribeModal
        isOpen={isTranscribeModalOpen}
        autoStart={autoStartTranscribe}
        onClose={() => {
          setIsTranscribeModalOpen(false);
          setAutoStartTranscribe(false);
        }}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* WebCodecs Hardware Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
