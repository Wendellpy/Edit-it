"use client";

import { useState, useMemo } from "react";
import {
  evaluateWordConfidence,
  getLowConfidenceWordIndices,
  getNextReviewIndex,
  getPrevReviewIndex,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/lib/confidenceReview";
import type { HinglishWordToken } from "@/lib/hinglish/postProcessor";
import { saveUserDictionaryCorrection } from "@/lib/hinglish/dictionaryDb";
import {
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  BookOpen,
  Keyboard,
  X,
} from "lucide-react";

interface ReviewModeDrawerProps {
  words: HinglishWordToken[];
  currentWordIndex: number;
  onSelectWord: (index: number) => void;
  onUpdateWordText: (index: number, newText: string) => void;
  onClose: () => void;
}

export function ReviewModeDrawer({
  words,
  currentWordIndex,
  onSelectWord,
  onUpdateWordText,
  onClose,
}: ReviewModeDrawerProps) {
  const lowConfIndices = useMemo(() => {
    return getLowConfidenceWordIndices(words, LOW_CONFIDENCE_THRESHOLD);
  }, [words]);

  const activeToken = words[currentWordIndex];
  const [editText, setEditText] = useState(activeToken?.text || "");
  const [savedToDict, setSavedToDict] = useState(false);

  const handleNext = () => {
    const nextIdx = getNextReviewIndex(currentWordIndex, lowConfIndices);
    if (nextIdx !== null) {
      onSelectWord(nextIdx);
      setEditText(words[nextIdx].text);
      setSavedToDict(false);
    }
  };

  const handlePrev = () => {
    const prevIdx = getPrevReviewIndex(currentWordIndex, lowConfIndices);
    if (prevIdx !== null) {
      onSelectWord(prevIdx);
      setEditText(words[prevIdx].text);
      setSavedToDict(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!activeToken || !editText.trim()) return;
    onUpdateWordText(currentWordIndex, editText.trim());

    // Auto-save to user dictionary if it was Devanagari originally
    if (activeToken.devanagariText && activeToken.devanagariText !== editText.trim()) {
      await saveUserDictionaryCorrection(activeToken.devanagariText, editText.trim());
      setSavedToDict(true);
      setTimeout(() => setSavedToDict(false), 2000);
    }
  };

  return (
    <div className="w-full rounded-2xl glass-panel p-5 border border-zinc-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Transcript Review Mode</h4>
            <span className="text-[11px] text-zinc-400">
              {lowConfIndices.length} low-confidence word{lowConfIndices.length === 1 ? "" : "s"} flagged
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            disabled={lowConfIndices.length === 0}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40"
            title="Previous flagged word (P)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={lowConfIndices.length === 0}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40"
            title="Next flagged word (N)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Word Editor Card */}
      {activeToken ? (
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Timestamp: <strong className="text-zinc-200">{activeToken.start}s - {activeToken.end}s</strong>
            </span>
            <span className="text-rose-400 font-mono text-[11px] px-2 py-0.5 rounded bg-rose-950/40 border border-rose-500/20">
              {(activeToken.confidence * 100).toFixed(0)}% Confidence
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCorrection();
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white font-semibold focus:outline-none focus:border-amber-500"
              placeholder="Correct word..."
            />
            <button
              onClick={handleSaveCorrection}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-sm"
            >
              Update
            </button>
          </div>

          {savedToDict && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved to custom dictionary! Will auto-apply in all projects.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 text-center py-2">
          No words selected. Click any flagged word in the transcript to inspect.
        </p>
      )}

      {/* Keyboard Shortcuts Hint */}
      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Keyboard className="w-3 h-3 text-zinc-400" />
          Shortcuts: <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">N</kbd> Next • <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300">P</kbd> Prev
        </span>
      </div>
    </div>
  );
}
