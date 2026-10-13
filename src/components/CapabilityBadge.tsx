"use client";

import { useEffect, useState } from "react";
import { detectSystemCapabilities, type SystemCapabilities } from "@/lib/capabilities";
import { Cpu, Zap, HardDrive, ShieldCheck, AlertCircle } from "lucide-react";

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
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 animate-pulse">
        <div className="w-2 h-2 rounded-full bg-zinc-600" />
        Analyzing Device Accelerators...
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* WebGPU Status */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          caps.webGpu
            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
            : "bg-amber-950/40 border-amber-500/30 text-amber-300"
        }`}
        title={caps.gpuRenderer || (caps.webGpu ? "WebGPU Active" : "WASM SIMD Fallback")}
      >
        <Zap className="w-3.5 h-3.5" />
        <span>{caps.webGpu ? "WebGPU Accelerated" : "WASM (SIMD Mode)"}</span>
      </div>

      {/* WebCodecs Hardware Export */}
      <div
        className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
          caps.webCodecsH264
            ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-300"
            : "bg-zinc-900 border-zinc-800 text-zinc-400"
        }`}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span>{caps.webCodecsH264 ? "Hardware 4K Encoder" : "WebCodecs Standard"}</span>
      </div>

      {/* Storage & Privacy Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-900/90 border border-zinc-800 text-zinc-300">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>100% On-Device</span>
      </div>
    </div>
  );
}
