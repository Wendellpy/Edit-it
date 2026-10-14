import { ShieldCheck, HardDrive, Zap, WifiOff } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t-2 border-[var(--border-main)] bg-[var(--bg-panel)] mt-auto py-12 px-4 sm:px-6 transition-colors duration-150">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Top Guarantee Row */}
        <div className="p-6 rounded-2xl neo-card bg-[var(--bg-card)] border-2 border-[var(--border-main)] shadow-[4px_4px_0px_var(--border-main)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#A3E635] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-base font-black text-[var(--text-main)]">100% Privacy Guarantee</h4>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-medium leading-relaxed">
                Zero cloud uploads. Your media, audio waveform, and transcripts stay on your device’s private sandbox.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-bold shadow-[2px_2px_0px_var(--border-main)] select-none">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" /> Offline Capable PWA
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-bold shadow-[2px_2px_0px_var(--border-main)] select-none">
              <Zap className="w-3.5 h-3.5 text-[#10b981]" /> WebGPU Powered
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-bold shadow-[2px_2px_0px_var(--border-main)] select-none">
              <HardDrive className="w-3.5 h-3.5 text-sky-500" /> OPFS Video Storage
            </span>
          </div>
        </div>

        {/* Indian Languages Supported */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Supported Regional Indian Languages & Hinglish
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
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
                className="px-3 py-1 rounded-full bg-[var(--bg-card)] border-1.5 border-[var(--border-main)] text-[var(--text-main)] text-xs font-bold shadow-[1.5px_1.5px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all select-none"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="pt-6 border-t border-[var(--border-main)]/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)] font-medium">
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
