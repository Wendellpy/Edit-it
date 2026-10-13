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
      className="h-48 sm:h-52 shrink-0 flex flex-col bg-[#121316] rounded-xl border border-[#24262c] overflow-hidden select-none"
    >
      {/* 1. NLE Timeline Toolbar */}
      <div className="h-10 px-3 bg-[#18191e] border-b border-[#24262c] flex items-center justify-between text-xs">
        {/* Tools Palette */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool("select")}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeTool === "select"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-[#101114] border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool("razor")}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeTool === "razor"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-[#101114] border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Razor Tool / Split Word (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-zinc-700/80 mx-1" />

          {/* Snapping Magnet */}
          <button
            onClick={() => setIsSnapping((s) => !s)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isSnapping
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-[#101114] border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Snap to Word Edges (S)"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Lock */}
          <button
            onClick={() => setIsLocked((l) => !l)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isLocked
                ? "bg-red-500/20 border-red-500/50 text-red-400"
                : "bg-[#101114] border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Lock Timeline Edits"
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center: Sequence Timecode & Stats */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
          <span className="text-zinc-500">TRACKS: 3</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300 font-semibold">{tokens.length} WORDS</span>
          <span className="text-zinc-500">•</span>
          <span className="text-amber-400 font-bold">{Math.round(timelineZoom * 100)}% ZOOM</span>
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
            className="px-2 py-0.5 rounded-md bg-[#101114] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-[10px] font-semibold transition-colors flex items-center gap-1"
            title="Fit entire video sequence to visible window"
          >
            <Maximize2 className="w-3 h-3 text-amber-400" />
            <span>Fit Sequence</span>
          </button>

          <button
            onClick={() => setTimelineZoom(Math.max(0.1, timelineZoom - 0.15))}
            className="p-1 rounded-md bg-[#101114] border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
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
            className="w-16 h-1 bg-zinc-800 rounded-full accent-amber-500 cursor-pointer"
          />

          <button
            onClick={() => setTimelineZoom(Math.min(3, timelineZoom + 0.15))}
            className="p-1 rounded-md bg-[#101114] border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Multi-Track Work Area (Track Headers on Left + Track Lanes on Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Track Header Controls Column */}
        <div className="w-36 sm:w-44 bg-[#141519] border-r border-[#24262c] flex flex-col shrink-0 text-[11px] font-semibold text-zinc-400 select-none">
          {/* Top Ruler Placeholder */}
          <div className="h-6 border-b border-[#24262c] px-3 flex items-center text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
            Tracks
          </div>

          {/* Track V2: Captions / Subtitles Header */}
          <div className="h-16 px-3 border-b border-[#24262c] flex items-center justify-between bg-[#16171c]">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                V2
              </span>
              <span className="text-zinc-200">Captions</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV2Visible((v) => !v)}
                className="p-1 text-zinc-400 hover:text-white"
                title="Toggle Track Visibility"
              >
                {v2Visible ? <Eye className="w-3 h-3 text-amber-400" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Track V1: Video Clip Header */}
          <div className="h-14 px-3 border-b border-[#24262c] flex items-center justify-between bg-[#141519]">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                V1
              </span>
              <span className="text-zinc-300">Video</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setV1Visible((v) => !v)}
                className="p-1 text-zinc-400 hover:text-white"
                title="Toggle Track Visibility"
              >
                {v1Visible ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Track A1: Audio Waveform Header */}
          <div className="h-14 px-3 flex items-center justify-between bg-[#121316]">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                A1
              </span>
              <span className="text-zinc-300">Dialogue</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setA1Muted((m) => !m)}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-colors ${
                  a1Muted ? "bg-rose-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
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
          className="flex-1 relative overflow-x-auto overflow-y-hidden cursor-crosshair bg-[#0a0a0d]"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative h-full">
            {/* 1. Timecode Ruler Header */}
            <div className="h-6 border-b border-[#24262c] bg-[#14151a] relative flex items-center text-[10px] font-mono text-zinc-500 select-none">
              {Array.from({ length: Math.ceil(duration || 5) + 1 }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSecond}px` }}
                  className="absolute top-0 bottom-0 pl-1 border-l border-zinc-700/80 flex items-center"
                >
                  <span className="text-zinc-400">{sec}s</span>
                </div>
              ))}
            </div>

            {/* 2. Track V2: Captions Lane */}
            <div className="h-16 border-b border-[#24262c]/80 relative bg-[#121317]/60 flex items-center">
              {v2Visible && tokens.length === 0 && (
                <span className="text-[11px] text-zinc-600 font-mono italic px-3 select-none">
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
                      className={`absolute top-2 bottom-2 rounded-lg px-2 flex items-center justify-between text-xs font-semibold border transition-all cursor-pointer group shadow-sm ${
                        isActive
                          ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black border-amber-300 font-bold shadow-lg shadow-amber-400/20 scale-[1.02] z-10"
                          : isSelected
                          ? "bg-zinc-800 text-amber-300 border-amber-500 font-bold z-10"
                          : token.isKeyword
                          ? "bg-amber-500/20 text-amber-200 border-amber-500/40 hover:border-amber-400"
                          : token.isFiller
                          ? "bg-rose-500/20 text-rose-300 border-dashed border-rose-500/50"
                          : "bg-zinc-900/90 text-zinc-200 border-zinc-700/70 hover:border-zinc-500 hover:text-white"
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
                        className="w-1.5 h-full -ml-1 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-amber-400 rounded transition-opacity"
                        title="Drag to trim start time"
                      />

                      <span className="truncate mx-1 text-[11px] leading-tight font-medium">
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
                        className="w-1.5 h-full -mr-1 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-amber-400 rounded transition-opacity"
                        title="Drag to trim end time"
                      />
                    </div>
                  );
                })}
            </div>

            {/* 3. Track V1: Video Clip Filmstrip Lane */}
            <div className="h-14 border-b border-[#24262c]/80 relative bg-[#0f1013] flex items-center px-1">
              {v1Visible && videoUrl ? (
                <div
                  style={{ width: `${timeToPx(duration || 5)}px` }}
                  className="h-10 rounded-lg bg-gradient-to-r from-cyan-950/80 via-zinc-900 to-cyan-950/80 border border-cyan-500/30 px-3 flex items-center justify-between text-[11px] text-cyan-300 shadow-inner"
                >
                  <span className="font-semibold flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    {videoTitle || "Imported Clip"}
                  </span>
                  <span className="font-mono text-zinc-500 shrink-0 ml-2">{formatRulerTime(duration || 5)}</span>
                </div>
              ) : (
                v1Visible && (
                  <span className="text-[11px] text-zinc-600 font-mono italic px-3 select-none">
                    No video clip on timeline
                  </span>
                )
              )}
            </div>

            {/* 4. Track A1: Audio Waveform Lane */}
            <div className="h-14 relative bg-[#0d0e11] flex items-center px-1">
              {videoUrl ? (
                <div
                  style={{ width: `${timeToPx(duration || 5)}px` }}
                  className="h-10 w-full rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center gap-0.5 px-2 overflow-hidden"
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
                          a1Muted ? "bg-zinc-700" : h > 18 ? "bg-emerald-400" : "bg-emerald-900/40"
                        }`}
                      />
                    );
                  })}
                </div>
              ) : (
                <span className="text-[11px] text-zinc-600 font-mono italic px-3 select-none">
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
              <div className="w-3.5 h-3.5 bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/50 transform rotate-45 -mt-1 rounded-sm" />
              {/* Playhead Needle Line */}
              <div className="w-0.5 flex-1 bg-amber-400 shadow-sm shadow-amber-400/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
