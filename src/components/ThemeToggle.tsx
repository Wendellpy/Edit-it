"use client";

import React from "react";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({ className = "", compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer select-none border-2 border-black dark:border-[#2E4B37] bg-[#F4F1EA] dark:bg-[#132018] text-[#142218] dark:text-[#E8F0EA] shadow-[2px_2px_0px_#142218] dark:shadow-[2px_2px_0px_#050806] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_#142218] dark:hover:shadow-[3px_3px_0px_#A3E635] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${className}`}
      title={theme === "dark" ? "Switch to Retro Rustic Light Theme" : "Switch to Forest Noir Dark Theme"}
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[#A3E635] stroke-[2.5]" />
          {!compact && <span>Rustic Light</span>}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[#142218] stroke-[2.5]" />
          {!compact && <span>Forest Dark</span>}
        </>
      )}
    </button>
  );
}
