"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { ModelManagerModal } from "./ModelManagerModal";
import { MODEL_TIERS, type ModelTierId } from "@/lib/modelManager";
import { Cpu, Film, Scissors, FolderKanban, Settings, ArrowRight, Eraser } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Editor",
    href: "/editor",
    icon: Film,
    iconColor: "text-[#A3E635]",
  },
  {
    name: "Clips",
    href: "/clips",
    icon: Scissors,
    iconColor: "text-[#A3E635]",
    badge: "AUTO",
  },
  {
    name: "Watermark Remover",
    href: "/watermark-remover",
    icon: Eraser,
    iconColor: "text-[#A3E635]",
    badge: "AI",
  },
  {
    name: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Navbar() {
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ModelTierId>("best");
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)]/95 backdrop-blur-xl transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          {/* Brand Logo with Fraunces Italic Typography */}
          <Link href="/" className="flex items-center gap-2.5 group select-none shrink-0">
            <div className="relative w-8.5 h-8.5 shrink-0 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
              <Image
                src="/favicon.svg"
                alt="BolSub Studio Logo"
                width={34}
                height={34}
                className="w-full h-full object-contain"
                unoptimized
                priority
              />
            </div>
            <div className="flex items-center tracking-tight">
              <span className="font-fraunces italic font-extrabold text-xl text-[var(--text-main)]">
                BolSub
              </span>
              <span className="font-fraunces italic font-bold text-xl text-[#A3E635] ml-0.5">
                .Studio
              </span>
            </div>
          </Link>

          {/* Navigation Links with Neobrutal Active Pills */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs font-bold">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 transition-all select-none ${
                    isActive
                      ? "px-3.5 py-1.5 rounded-full bg-[#E2F0D9] dark:bg-[#A3E635]/25 text-[#142218] dark:text-[#A3E635] font-extrabold shadow-sm"
                      : "px-3 py-1.5 rounded-full text-[var(--text-main)] hover:bg-[var(--accent-lime)]/15 hover:text-[var(--text-main)]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? "text-[#142218] dark:text-[#A3E635]"
                        : item.iconColor || "text-[var(--text-main)]"
                    }`}
                  />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-[#A3E635] text-[#142218] rounded-full border border-[var(--border-main)] leading-none ml-0.5">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Stack: Theme Toggle, Model Tier, and Launch Studio */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Theme Toggle (Light Rustic / Dark Forest) */}
            <ThemeToggle />

            {/* Model Manager Quick Selector */}
            <button
              onClick={() => setIsModelModalOpen(true)}
              className="neo-btn-secondary px-3.5 py-1.5 rounded-full text-xs font-bold gap-1.5 flex items-center cursor-pointer select-none"
              title="Change active Whisper model tier and check storage"
            >
              <Cpu className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>{MODEL_TIERS[selectedTier].name}</span>
            </button>

            {/* Launch Editor CTA - Signature Neobrutalist Pill */}
            <Link
              href="/editor"
              className="neo-btn px-4 py-1.5 text-xs font-black flex items-center gap-1.5 select-none"
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
