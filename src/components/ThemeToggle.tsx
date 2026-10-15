"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({ className = "", compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === "dark" : true;

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        className={`neo-btn-secondary w-7.5 h-7.5 rounded-full flex items-center justify-center p-0 shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95 ${className}`}
        title={isDark ? "Switch to Rustic Light Theme" : "Switch to Forest Noir Dark Theme"}
        aria-label="Toggle Light/Dark Theme"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-[var(--accent-lime)] stroke-[2.5] transition-transform hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-[var(--text-main)] stroke-[2.5] transition-transform hover:-rotate-12" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`neo-btn-secondary px-3 py-1.5 rounded-full text-xs font-bold gap-1.5 flex items-center cursor-pointer select-none transition-all ${className}`}
      title={isDark ? "Switch to Rustic Light Theme" : "Switch to Forest Noir Dark Theme"}
      aria-label="Toggle Light/Dark Theme"
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[var(--accent-lime)] stroke-[2.5]" />
          <span>Rustic Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[var(--text-main)] stroke-[2.5]" />
          <span>Forest Dark</span>
        </>
      )}
    </button>
  );
}

