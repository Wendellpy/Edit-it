import { ShieldCheck, HardDrive, Cpu, Zap, WifiOff } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-zinc-800/80 bg-zinc-950 mt-auto py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Top Guarantee Row */}
        <div className="p-6 rounded-2xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">100% Privacy Guarantee</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Zero cloud uploads. Your media, audio waveform, and transcripts stay on your device’s private sandbox.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" /> Offline Capable PWA
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> WebGPU Powered
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> OPFS Video Storage
            </span>
          </div>
        </div>

        {/* Indian Languages Supported */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Supported Regional Indian Languages & Hinglish
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
            {[
              "Hinglish (Conversational Roman)",
              "Hindi (हिन्दी)",
              "English (India)",
              "Marathi (मराठी)",
              "Tamil (தமிழ்)",
              "Telugu (తెలుగు)",
              "Bengali (বাংলা)",
              "Gujarati (ગુજરાતી)",
              "Kannada (ಕನ್ನಡ)",
              "Malayalam (മലയാളം)",
              "Punjabi (ਪੰਜਾਬੀ)",
              "Urdu (اردو)",
            ].map((lang) => (
              <span
                key={lang}
                className="px-2.5 py-1 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-300"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            © {new Date().getFullYear()} BolSub Studio. Built for Indian Reels & Shorts creators.
          </div>
          <div className="flex items-center gap-4">
            <span>Client-side ONNX Runtime Web</span>
            <span>•</span>
            <span>WebCodecs Streaming Muxer</span>
            <span>•</span>
            <span>Dexie IndexedDB</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
