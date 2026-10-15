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
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEditorStore, hydrateExportSettings } from "@/lib/editorStore";
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
  LayoutGrid,
  Tv,
  FileText,
  Pencil,
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

  // Hydrate persisted export settings safely after client mount
  useEffect(() => {
    hydrateExportSettings();
  }, []);

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
    <div className="min-h-screen h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] overflow-hidden select-none transition-colors duration-150">
      {/* 1. Master Application Menu & Status Bar (Retro Rustic Neobrutalism) */}
      <header className="h-13 border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)] px-3 sm:px-4 flex items-center justify-between text-xs shrink-0 z-40 shadow-sm">
        {/* Left: Branding & Project Meta */}
        <div className="flex items-center gap-3">
          {/* Logo & App Home */}
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Return to BolSub Studio Home"
          >
            <div className="w-7 h-7 rounded-full border-2 border-[var(--border-main)] bg-[var(--accent-lime)] flex items-center justify-center text-[#142218] font-black text-xs shadow-[2px_2px_0px_var(--border-main)] group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="font-fraunces italic font-bold tracking-tight text-[var(--text-main)] hidden sm:inline text-base">
              BolSub<span className="text-[var(--accent-lime)] font-black">.Studio</span>
            </span>
          </Link>

          <div className="h-5 w-px bg-[var(--border-main)] opacity-30" />

          {/* Project Title Input with Edit Indicator */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-[var(--bg-card)] px-2.5 py-1 rounded-full border-2 border-[var(--border-main)] text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-main)] hover:border-[var(--accent-lime)] transition-colors">
            <Pencil className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Untitled Project"
              title="Click to rename project"
              className="bg-transparent text-[var(--text-main)] font-bold focus:outline-none max-w-[120px] sm:max-w-[160px] transition-colors"
            />
          </div>

          {/* Local Sandbox Badge */}
          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-lime)]/20 text-[var(--text-main)] text-[10px] font-mono font-bold border-2 border-[var(--border-main)] shrink-0 whitespace-nowrap shadow-[2px_2px_0px_var(--border-main)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] border border-[var(--border-main)] animate-pulse" />
            100% On-Device OPFS
          </div>
        </div>

        {/* Center: Workspaces Mode Switcher with Visual Icons */}
        <nav aria-label="Workspace Views" className="hidden lg:flex items-center bg-[var(--bg-card)] p-1 rounded-full border-2 border-[var(--border-main)] text-[11px] font-bold shadow-[2px_2px_0px_var(--border-main)]">
          <button
            onClick={() => setActiveWorkspace("edit")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeWorkspace === "edit"
                ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm font-extrabold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Complete 4-panel editing workspace (Monitor, Script, Styles, Waveform)"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span>Studio</span>
          </button>
          <button
            onClick={() => setActiveWorkspace("widescreen")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeWorkspace === "widescreen"
                ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm font-extrabold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Focus on 16:9 widescreen video playback"
          >
            <Tv className="w-3.5 h-3.5 shrink-0" />
            <span>Cinema</span>
          </button>
          <button
            onClick={() => setActiveWorkspace("captions")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeWorkspace === "captions"
                ? "bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-sm font-extrabold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Expanded script editor for captions"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Captions</span>
          </button>
        </nav>

        {/* Right: Actions, Shortcuts, Theme & Export */}
        <div className="flex items-center gap-2">
          {/* Primary Ingestion Flow: Import + Transcribe */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-card)]/60 p-0.5 rounded-full border border-[var(--border-main)]/50">
            {/* Import Video Clip */}
            <button
              onClick={() => masterFileInputRef.current?.click()}
              className="neo-btn-secondary px-2.5 py-1 text-[11px] gap-1.5 cursor-pointer"
              title="Import video clip from device"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--text-main)]" />
              <span className="hidden sm:inline">Import</span>
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
              className="neo-btn px-3 py-1 text-[11px] gap-1.5 text-[#142218] cursor-pointer"
              title="Open AI Speech-to-Text Transcription Hub"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Transcribe</span>
            </button>
          </div>

          {/* Projects Dashboard Link */}
          <Link
            href="/projects"
            className="neo-btn-secondary px-2.5 py-1 text-[11px] gap-1.5"
            title="Open Projects Dashboard"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Projects</span>
          </Link>

          {/* Undo / Redo */}
          <div className="flex items-center bg-[var(--bg-card)] rounded-full border-2 border-[var(--border-main)] p-0.5 shadow-[2px_2px_0px_var(--border-main)]">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1 rounded-full hover:bg-[var(--accent-lime)]/30 hover:text-[var(--text-main)] disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-muted)] transition-colors cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1 rounded-full hover:bg-[var(--accent-lime)]/30 hover:text-[var(--text-main)] disabled:opacity-30 disabled:hover:bg-transparent text-[var(--text-muted)] transition-colors cursor-pointer"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Shortcuts Modal Trigger */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="neo-btn-secondary w-7.5 h-7.5 rounded-full flex items-center justify-center p-0 shrink-0 cursor-pointer"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Live Theme Toggle */}
          <ThemeToggle compact />

          {/* Master Neobrutalist Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="neo-btn px-4 py-1.5 text-xs text-[#142218] gap-1.5 font-black"
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
