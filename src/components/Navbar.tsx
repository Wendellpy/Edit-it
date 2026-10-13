"use client";

import Link from "next/link";
import { useState } from "react";
import { CapabilityBadge } from "./CapabilityBadge";
import { ModelManagerModal } from "./ModelManagerModal";
import { MODEL_TIERS, type ModelTierId } from "@/lib/modelManager";
import { Sparkles, Cpu, Film, FolderKanban, Settings, ArrowRight } from "lucide-react";

export function Navbar() {
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ModelTierId>("balanced");

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-zinc-950 fill-zinc-950" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center tracking-tight">
                <span className="text-lg font-black text-white">Bol</span>
                <span className="text-lg font-black text-amber-400">Sub</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/60 uppercase tracking-widest">
                  Studio
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 -mt-0.5 font-medium">100% Local AI Captions</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <Link href="/editor" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Film className="w-4 h-4 text-amber-400/80" /> Editor
            </Link>
            <Link href="/projects" className="hover:text-white transition-colors flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4" /> Projects
            </Link>
            <Link href="/settings" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </nav>

          {/* Right Action Stack */}
          <div className="flex items-center gap-3">
            <CapabilityBadge />

            {/* Model Manager Quick Selector */}
            <button
              onClick={() => setIsModelModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 text-xs text-zinc-300 transition-colors shadow-sm"
              title="Change active Whisper model tier and check storage"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>{MODEL_TIERS[selectedTier].name}</span>
            </button>

            {/* Launch Editor CTA */}
            <Link
              href="/editor"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-semibold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/10 active:scale-95"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <ModelManagerModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        selectedTier={selectedTier}
        onSelectTier={setSelectedTier}
      />
    </>
  );
}
