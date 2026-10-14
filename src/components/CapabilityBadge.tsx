"use client";

import { useEffect, useState } from "react";
import { detectSystemCapabilities, type SystemCapabilities } from "@/lib/capabilities";

export function CapabilityBadge() {
  const [caps, setCaps] = useState<SystemCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectSystemCapabilities().then((res) => {
      setCaps(res);
      setLoading(false);
    });
  }, []);

  if (loading || !caps) {
    return null;
  }

  const tooltipText = `100% On-Device Local AI\n• Engine: ${caps.webGpu ? "WebGPU Accelerated" : "WASM (SIMD Mode)"}\n• Video Encoder: ${caps.webCodecsH264 ? "Hardware 4K WebCodecs" : "Standard WebCodecs"}\n• Storage: Private OPFS Sandbox`;

  return (
    <div
      className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--bg-card)] border-2 border-[var(--border-main)] text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all select-none cursor-default"
      title={tooltipText}
    >
      <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shrink-0" />
      <span>100% On-Device</span>
    </div>
  );
}
