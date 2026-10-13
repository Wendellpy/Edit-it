"use client";

import Link from "next/link";
import { useState } from "react";
import { CapabilityBadge } from "./CapabilityBadge";
import { ThemeToggle } from "./ThemeToggle";
import { ModelManagerModal } from "./ModelManagerModal";
import { MODEL_TIERS, type ModelTierId } from "@/lib/modelManager";
import { Sparkles, Cpu, Film, FolderKanban, Settings, ArrowRight } from "lucide-react";

export function Navbar() {
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ModelTierId>("balanced");

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)]/95 backdrop-blur-xl transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          {/* Brand Logo with Fraunces Italic Typography */}
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <div className="w-8 h-8 rounded-full bg-[#A3E635] border-2 border-[var(--border-main)] flex items-center justify-center text-[#142218] font-black font-fraunces text-base shadow-[2px_2px_0px_var(--border-main)] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[3px_3px_0px_var(--border-main)] transition-all">
              B
            </div>
            <div className="flex items-center tracking-tight">
              <span className="font-fraunces italic font-extrabold text-xl text-[var(--text-main)]">
                BolSub
              </span>
              <span className="font-fraunces italic font-bold text-xl text-[#A3E635] ml-0.5">
                .Studio
              </span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#A3E635] text-[#142218] border-1.5 border-[var(--border-main)] uppercase tracking-wider shadow-[1.5px_1.5px_0px_var(--border-main)]">
                Rustic Neo
              </span>
            </div>
          </Link>

          {/* Navigation Links with Neobrutal Pills */}
          <nav className="hidden md:flex items-center gap-2 text-xs font-bold">
            <Link
              href="/editor"
              className="px-3 py-1.5 rounded-full text-[var(--text-main)] hover:bg-[var(--accent-lime)]/20 border-2 border-transparent hover:border-[var(--border-main)] hover:shadow-[2px_2px_0px_var(--border-main)] transition-all flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5 text-[#A3E635]" /> Editor
            </Link>
            <Link
              href="/projects"
              className="px-3 py-1.5 rounded-full text-[var(--text-main)] hover:bg-[var(--accent-lime)]/20 border-2 border-transparent hover:border-[var(--border-main)] hover:shadow-[2px_2px_0px_var(--border-main)] transition-all flex items-center gap-1.5"
            >
              <FolderKanban className="w-3.5 h-3.5" /> Projects
            </Link>
            <Link
              href="/settings"
              className="px-3 py-1.5 rounded-full text-[var(--text-main)] hover:bg-[var(--accent-lime)]/20 border-2 border-transparent hover:border-[var(--border-main)] hover:shadow-[2px_2px_0px_var(--border-main)] transition-all flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </Link>
          </nav>

          {/* Right Action Stack */}
          <div className="flex items-center gap-2.5">
            <CapabilityBadge />

            {/* Theme Toggle (Light Rustic / Dark Forest) */}
            <ThemeToggle />

            {/* Model Manager Quick Selector */}
            <button
              onClick={() => setIsModelModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5 text-xs text-[var(--text-main)] font-bold transition-all cursor-pointer"
              title="Change active Whisper model tier and check storage"
            >
              <Cpu className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>{MODEL_TIERS[selectedTier].name}</span>
            </button>

            {/* Launch Editor CTA - Signature Neobrutalist Pill */}
            <Link
              href="/editor"
              className="neo-btn px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#142218] stroke-[2.5]" />
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
