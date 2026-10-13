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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] p-6 shadow-[6px_6px_0px_var(--border-main)] space-y-4 text-[var(--text-main)]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[var(--border-main)]/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-[var(--accent-lime)] text-[#142218] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
              <Keyboard className="w-4 h-4 text-[#142218]" />
            </div>
            <h3 className="font-fraunces italic font-bold text-lg text-[var(--text-main)]">Studio Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs shadow-[1px_1px_0px_var(--border-main)]"
            >
              <span className="text-[var(--text-main)] font-semibold">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#142218] font-mono font-black text-[11px] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={onClose}
            className="neo-btn-secondary w-full py-2.5 rounded-full font-extrabold text-xs cursor-pointer"
          >
            Close Cheat Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
