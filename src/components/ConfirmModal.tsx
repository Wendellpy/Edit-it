"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2, X, Info, Loader2 } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  badge?: string;
  itemDetails?: {
    label: string;
    value: string;
  }[];
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  badge,
  itemDetails,
}: ConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button & handle Escape key
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconBg: "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
          icon: <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />,
          confirmBtn:
            "bg-red-600 hover:bg-red-700 text-white border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)]",
          badgeBg: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
        };
      case "warning":
        return {
          iconBg: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          confirmBtn:
            "bg-amber-500 hover:bg-amber-600 text-[#142218] font-black border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)]",
          badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        };
      case "info":
      default:
        return {
          iconBg: "bg-[#A3E635]/15 text-[#142218] dark:text-[#A3E635] border-[#A3E635]/30",
          icon: <Info className="w-5 h-5 text-[#A3E635]" />,
          confirmBtn:
            "bg-[#A3E635] hover:bg-[#8cd122] text-[#142218] font-black border-[var(--border-main)] shadow-[3px_3px_0px_var(--border-main)]",
          badgeBg: "bg-[#A3E635]/15 text-[#142218] dark:text-[#A3E635] border-[#A3E635]/30",
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[6px_6px_0px_var(--border-main)] overflow-hidden flex flex-col text-[var(--text-main)] animate-in zoom-in-95 duration-150">
        {/* Header bar */}
        <div className="p-4 sm:p-5 border-b-2 border-[var(--border-main)] bg-[var(--bg-panel)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_var(--border-main)] ${vStyles.iconBg}`}
            >
              {vStyles.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="confirm-dialog-title"
                  className="text-sm sm:text-base font-black text-[var(--text-main)] tracking-tight leading-snug"
                >
                  {title}
                </h3>
              </div>
              {badge && (
                <span
                  className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider border ${vStyles.badgeBg}`}
                >
                  {badge}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer shadow-[2px_2px_0px_var(--border-main)] disabled:opacity-40"
            title="Cancel"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          <p className="text-[var(--text-muted)] leading-relaxed font-medium">
            {description}
          </p>

          {/* Optional item metadata details */}
          {itemDetails && itemDetails.length > 0 && (
            <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-1.5">
              {itemDetails.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-[var(--text-muted)]">{item.label}:</span>
                  <span className="font-bold text-[var(--text-main)] truncate max-w-[200px]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {variant === "danger" && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-[11px] text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This will free up local storage. You can always re-download the video by pasting the link again.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 border-t-2 border-[var(--border-main)] bg-[var(--bg-panel)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-panel)] text-xs font-bold text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-main)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirmClick}
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-xl border-2 text-xs font-black transition-all cursor-pointer flex items-center gap-2 hover:shadow-[1px_1px_0px_var(--border-main)] hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${vStyles.confirmBtn}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {variant === "danger" ? (
                  <Trash2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
