"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useEditorStore } from "@/lib/editorStore";
import {
  ZoomIn,
  ZoomOut,
  Magnet,
  Scissors,
  MousePointer,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  Maximize2,
  Plus,
  Trash2,
} from "lucide-react";

export function WaveformTimeline() {
  const {
    duration,
    currentTime,
    setCurrentTime,
    tokens,
    videoUrl,
    videoTitle,
    selectedWordId,
    selectWord,
    updateWordTimings,
    splitWord,
    deleteWord,
    timelineZoom,
    setTimelineZoom,
    isPlaying,
    waveformPeaks,
    syncOffset,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "razor">("select");
  const [isSnapping, setIsSnapping] = useState(true);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggingWordEdge, setDraggingWordEdge] = useState<{
    id: string;
    edge: "start" | "end";
    initialX: number;
    initialTime: number;
  } | null>(null);

  const [v2Visible, setV2Visible] = useState(true);
  const [v1Visible, setV1Visible] = useState(true);
  const [a1Muted, setA1Muted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Pixels per second based on timeline zoom (base: 100px/s)
  const pxPerSecond = 100 * timelineZoom;
  const timelineWidth = Math.max(900, (duration || 5) * pxPerSecond);

  // Time to pixel coordinate
  const timeToPx = useCallback((time: number) => time * pxPerSecond, [pxPerSecond]);
  // Pixel coordinate to time
  const pxToTime = useCallback(
    (px: number) => Math.max(0, Math.min(duration || 5, px / pxPerSecond)),
    [duration, pxPerSecond]
  );

  // Mouse scrubbing handler
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isLocked) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const time = pxToTime(clickX);
    setCurrentTime(time);
    setIsDraggingPlayhead(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const time = pxToTime(currentX);

    if (isDraggingPlayhead) {
      setCurrentTime(time);
    } else if (draggingWordEdge) {
      const word = tokens.find((t) => t.id === draggingWordEdge.id);
      if (word) {
        if (draggingWordEdge.edge === "start") {
          const newStart = Math.min(word.end - 0.1, Math.max(0, time));
          updateWordTimings(word.id, Math.round(newStart * 1000) / 1000, word.end);
        } else {
          const newEnd = Math.max(word.start + 0.1, Math.min(duration || 5, time));
          updateWordTimings(word.id, word.start, Math.round(newEnd * 1000) / 1000);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingPlayhead(false);
    setDraggingWordEdge(null);
  };

  // Keep playhead scrolled into view when playing
  useEffect(() => {
    if (isPlaying && containerRef.current) {
      const playheadX = timeToPx(currentTime);
      const scrollLeft = containerRef.current.scrollLeft;
      const clientWidth = containerRef.current.clientWidth;

      if (playheadX > scrollLeft + clientWidth - 80 || playheadX < scrollLeft) {
        containerRef.current.scrollLeft = playheadX - 100;
      }
    }
  }, [currentTime, isPlaying, timeToPx]);

  const formatRulerTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
  };

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="h-48 sm:h-52 shrink-0 flex flex-col bg-[var(--bg-panel)] rounded-2xl border-2 border-[var(--border-main)] overflow-hidden select-none shadow-[3px_3px_0px_var(--border-main)] transition-colors"
    >
      {/* 1. NLE Timeline Toolbar */}
      <div className="h-11 px-3 bg-[var(--bg-card)] border-b-2 border-[var(--border-main)] flex items-center justify-between text-xs">
        {/* Tools Palette */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTool("select")}
            className={`p-1.5 rounded-full border-2 border-[var(--border-main)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-main)] ${
              activeTool === "select"
                ? "bg-[var(--accent-lime)] text-[#142218] font-bold"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool("razor")}
            className={`p-1.5 rounded-full border-2 border-[var(--border-main)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-main)] ${
              activeTool === "razor"
                ? "bg-[var(--accent-lime)] text-[#142218] font-bold"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Razor Tool / Split Word (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-[var(--border-main)] opacity-30 mx-1" />

          {/* Snapping Magnet */}
          <button
            onClick={() => setIsSnapping((s) => !s)}
            className={`p-1.5 rounded-full border-2 border-[var(--border-main)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-main)] ${
              isSnapping
                ? "bg-[var(--accent-lime)] text-[#142218] font-bold"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Snap to Word Edges (S)"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Lock */}
          <button
            onClick={() => setIsLocked((l) => !l)}
            className={`p-1.5 rounded-full border-2 border-[var(--border-main)] transition-all cursor-pointer shadow-[2px_2px_0px_var(--border-main)] ${
              isLocked
                ? "bg-rose-500 text-white font-bold"
                : "bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
            title="Lock Timeline Edits"
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center: Sequence Timecode & Stats */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
          <span className="text-[var(--text-muted)] font-bold">TRACKS: 3</span>
          <span className="opacity-40">•</span>
          <span className="text-[var(--text-main)] font-extrabold">{tokens.length} WORDS</span>
          <span className="opacity-40">•</span>
          <span className="text-[var(--text-main)] font-black">{Math.round(timelineZoom * 100)}% ZOOM</span>
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Fit Sequence to Viewport */}
          <button
            onClick={() => {
              const containerW = containerRef.current?.clientWidth || 900;
              const idealZoom = Math.max(0.1, Math.min(2.0, (containerW - 60) / ((duration || 120) * 100)));
              setTimelineZoom(Math.round(idealZoom * 100) / 100);
            }}
            className="neo-btn-secondary px-2.5 py-1 text-[10px] gap-1 cursor-pointer"
            title="Fit entire video sequence to visible window"
          >
            <Maximize2 className="w-3 h-3 text-[var(--text-main)]" />
            <span>Fit Sequence</span>
          </button>

          <button
            onClick={() => setTimelineZoom(Math.max(0.1, timelineZoom - 0.15))}
            className="neo-btn-secondary p-1 rounded-full cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
            className="w-16 h-1 bg-[var(--border-main)]/30 rounded-full accent-[var(--accent-lime)] cursor-pointer"
          />

          <button
            onClick={() => setTimelineZoom(Math.min(3, timelineZoom + 0.15))}
            className="neo-btn-secondary p-1 rounded-full cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Multi-Track Work Area (Track Headers on Left + Track Lanes on Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Track Header Controls Column */}
        <div className="w-36 sm:w-44 bg-[var(--bg-panel)] border-r-2 border-[var(--border-main)] flex flex-col shrink-0 text-[11px] font-bold text-[var(--text-muted)] select-none">
          {/* Top Ruler Placeholder */}
          <div className="h-7 border-b-2 border-[var(--border-main)] px-3 flex items-center text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono font-bold bg-[var(--bg-card)]">
            Tracks
          </div>

          {/* Track V2: Captions / Subtitles Header */}
          <div className="h-16 px-3 border-b-2 border-[var(--border-main)]/40 flex items-center justify-between bg-[var(--bg-panel)]">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#142218] font-mono text-[10px] font-black border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                V2
              </span>
              <span className="text-[var(--text-main)] font-bold text-xs">Captions</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV2Visible((v) => !v)}
                className="neo-btn-secondary p-1 rounded-full cursor-pointer"
                title="Toggle Track Visibility"
              >
                {v2Visible ? <Eye className="w-3 h-3 text-[var(--accent-forest)] dark:text-[var(--accent-lime)]" /> : <EyeOff className="w-3 h-3 text-[var(--text-muted)]" />}
              </button>
            </div>
          </div>

          {/* Track V1: Video Clip Header */}
          <div className="h-14 px-3 border-b-2 border-[var(--border-main)]/40 flex items-center justify-between bg-[var(--bg-panel)]">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] font-mono text-[10px] font-black border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                V1
              </span>
              <span className="text-[var(--text-main)] font-bold text-xs">Video</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV1Visible((v) => !v)}
                className="neo-btn-secondary p-1 rounded-full cursor-pointer"
                title="Toggle Track Visibility"
              >
                {v1Visible ? <Eye className="w-3 h-3 text-[var(--accent-forest)] dark:text-[var(--accent-lime)]" /> : <EyeOff className="w-3 h-3 text-[var(--text-muted)]" />}
              </button>
            </div>
          </div>

          {/* Track A1: Audio Waveform Header */}
          <div className="h-14 px-3 flex items-center justify-between bg-[var(--bg-panel)]">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] font-mono text-[10px] font-black border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                A1
              </span>
              <span className="text-[var(--text-main)] font-bold text-xs">Dialogue</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setA1Muted((m) => !m)}
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black border border-[var(--border-main)] transition-colors cursor-pointer ${
                  a1Muted ? "bg-rose-500 text-white shadow-[1px_1px_0px_var(--border-main)]" : "bg-[var(--bg-card)] text-[var(--text-main)] hover:bg-[var(--accent-lime)] hover:text-[#142218]"
                }`}
                title="Mute Track A1"
              >
                M
              </button>
            </div>
          </div>
        </div>

        {/* Right: Scrollable Timeline Canvas & Lanes */}
        <div
          ref={containerRef}
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleMouseMove}
          className="flex-1 relative overflow-x-auto overflow-y-hidden cursor-crosshair bg-[var(--bg-canvas)]"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative h-full">
            {/* 1. Timecode Ruler Header */}
            <div className="h-7 border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)] relative flex items-center text-[10px] font-mono font-bold text-[var(--text-muted)] select-none">
              {Array.from({ length: Math.ceil(duration || 5) + 1 }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSecond}px` }}
                  className="absolute top-0 bottom-0 pl-1.5 border-l border-[var(--border-main)]/40 flex items-center"
                >
                  <span className="text-[var(--text-muted)]">{sec}s</span>
                </div>
              ))}
            </div>

            {/* 2. Track V2: Captions Lane */}
            <div className="h-16 border-b-2 border-[var(--border-main)]/30 relative bg-[var(--bg-card)]/80 flex items-center">
              {v2Visible && tokens.length === 0 && (
                <span className="text-[11px] text-[var(--text-muted)] font-mono italic px-3 select-none">
                  No captions on sequence
                </span>
              )}
              {v2Visible &&
                tokens.map((token) => {
                  const left = timeToPx(token.start);
                  const width = Math.max(28, timeToPx(token.end) - left);
                  const isSelected = selectedWordId === token.id;
                  const isActive = currentTime >= token.start && currentTime <= token.end;

                  return (
                    <div
                      key={token.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === "razor") {
                          splitWord(token.id);
                        } else {
                          selectWord(token.id);
                          setCurrentTime(token.start);
                        }
                      }}
                      style={{ left: `${left}px`, width: `${width}px` }}
                      className={`absolute top-2 bottom-2 rounded-xl px-2 flex items-center justify-between text-xs font-semibold border-2 transition-all cursor-pointer group shadow-sm ${
                        isActive
                          ? "bg-[var(--accent-lime)] text-[#142218] border-[var(--border-main)] font-black shadow-[2px_2px_0px_var(--border-main)] scale-[1.02] z-10"
                          : isSelected
                          ? "bg-[var(--bg-panel)] text-[var(--accent-forest)] dark:text-[var(--accent-lime)] border-[var(--border-main)] font-black shadow-[2px_2px_0px_var(--border-main)] z-10"
                          : token.isKeyword
                          ? "bg-[var(--accent-lime)]/20 text-[var(--text-main)] border-[var(--border-main)] font-bold"
                          : token.isFiller
                          ? "bg-rose-500/20 text-rose-500 border-dashed border-rose-500 font-bold"
                          : "bg-[var(--bg-panel)] text-[var(--text-main)] border-[var(--border-main)]/60 font-bold hover:border-[var(--border-main)]"
                      }`}
                    >
                      {/* Left Resizer Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingWordEdge({
                            id: token.id,
                            edge: "start",
                            initialX: e.clientX,
                            initialTime: token.start,
                          });
                        }}
                        className="w-1.5 h-full -ml-1 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-[var(--accent-lime)] rounded transition-opacity"
                        title="Drag to trim start time"
                      />

                      <span className="truncate mx-1 text-[11px] leading-tight font-bold">
                        {token.text}
                      </span>

                      {/* Right Resizer Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingWordEdge({
                            id: token.id,
                            edge: "end",
                            initialX: e.clientX,
                            initialTime: token.end,
                          });
                        }}
                        className="w-1.5 h-full -mr-1 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-[var(--accent-lime)] rounded transition-opacity"
                        title="Drag to trim end time"
                      />
                    </div>
                  );
                })}
            </div>

            {/* 3. Track V1: Video Clip Filmstrip Lane */}
            <div className="h-14 border-b-2 border-[var(--border-main)]/30 relative bg-[var(--bg-card)]/50 flex items-center px-1">
              {v1Visible && videoUrl ? (
                <div
                  style={{ width: `${timeToPx(duration || 5)}px` }}
                  className="h-10 rounded-xl bg-[var(--accent-lime)]/15 border-2 border-[var(--border-main)] px-3 flex items-center justify-between text-[11px] text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-main)]"
                >
                  <span className="font-bold flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] border border-[var(--border-main)] shrink-0" />
                    {videoTitle || "Imported Clip"}
                  </span>
                  <span className="font-mono text-[var(--text-muted)] font-bold shrink-0 ml-2">{formatRulerTime(duration || 5)}</span>
                </div>
              ) : (
                v1Visible && (
                  <span className="text-[11px] text-[var(--text-muted)] font-mono italic px-3 select-none">
                    No video clip on timeline
                  </span>
                )
              )}
            </div>

            {/* 4. Track A1: Audio Waveform Lane */}
            <div className="h-14 relative bg-[var(--bg-card)]/30 flex items-center px-1">
              {videoUrl ? (
                <div
                  style={{ width: `${timeToPx(duration || 5)}px` }}
                  className="h-10 w-full rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center gap-0.5 px-2 overflow-hidden"
                >
                  {Array.from({ length: Math.floor(timelineWidth / 4) }).map((_, i) => {
                    let h = 12;
                    const timeAtBar = (i * 4) / pxPerSecond;
                    if (waveformPeaks && waveformPeaks.length > 0) {
                      const peakIdx = Math.floor((timeAtBar / Math.max(1, duration || 5)) * waveformPeaks.length);
                      const p = waveformPeaks[Math.min(waveformPeaks.length - 1, Math.max(0, peakIdx))] || 0;
                      h = Math.round(10 + Math.min(88, p * 88));
                    } else {
                      // Estimate speech energy from word tokens
                      const isVoiceAtBar = tokens.some(
                        (t) => timeAtBar >= t.start && timeAtBar <= t.end
                      );
                      h = isVoiceAtBar
                        ? Math.round(35 + Math.abs(Math.sin(i * 0.35) * 45))
                        : 8;
                    }

                    return (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`w-0.5 rounded-full transition-all ${
                          a1Muted ? "bg-[var(--border-main)]/30" : h > 18 ? "bg-[var(--accent-forest)] dark:bg-[var(--accent-lime)]" : "bg-[var(--border-main)]/20"
                        }`}
                      />
                    );
                  })}
                </div>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)] font-mono italic px-3 select-none">
                  No audio stream
                </span>
              )}
            </div>

            {/* 5. Precision Playhead Scrubber Needle */}
            <div
              style={{ left: `${timeToPx(currentTime)}px` }}
              className="absolute top-0 bottom-0 z-30 pointer-events-none -ml-px flex flex-col items-center"
            >
              {/* Playhead Scrubber Head */}
              <div className="w-3.5 h-3.5 bg-[var(--accent-lime)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] transform rotate-45 -mt-1 rounded-sm" />
              {/* Playhead Needle Line */}
              <div className="w-0.5 flex-1 bg-[var(--accent-lime)] shadow-[1px_0px_0px_var(--border-main)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
