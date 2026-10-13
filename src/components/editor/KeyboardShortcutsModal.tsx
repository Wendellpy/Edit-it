"use client";

import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", desc: "Toggle Video Play / Pause" },
    { key: "J / K / L", desc: "Scrub Reverse / Pause / Forward (1 sec)" },
    { key: "← / →", desc: "Nudge selected word timing by 50ms" },
    { key: "Cmd/Ctrl + Z", desc: "Undo last edit" },
    { key: "Cmd/Ctrl + Shift + Z", desc: "Redo edit" },
    { key: "N", desc: "Jump to next low-confidence word" },
    { key: "P", desc: "Jump to previous low-confidence word" },
    { key: "Double Click Word", desc: "Inline text edit mode" },
    { key: "?", desc: "Open / Close keyboard shortcuts cheat sheet" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Studio Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs"
            >
              <span className="text-zinc-300">{sc.desc}</span>
              <kbd className="px-2 py-1 rounded bg-zinc-800 text-amber-300 font-mono font-bold text-[11px] border border-zinc-700">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
