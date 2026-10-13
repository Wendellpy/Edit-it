import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { InteractiveHinglishDemo } from "@/components/InteractiveHinglishDemo";
import { CreatorTemplatePreview } from "@/components/CreatorTemplatePreview";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  HardDrive,
  CheckCircle2,
  Lock,
  ChevronDown,
  Play,
  Film,
  Download,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="flex-1 space-y-20 sm:space-y-28 py-10 sm:py-16">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          {/* Subtle Ambient Radial Gradients */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

          <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Built for Indian Creators • Reels & Shorts</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
              Viral <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200">Hinglish Captions</span> in Seconds.{" "}
              <span className="text-zinc-300">100% Local on Your Device.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-xl text-zinc-400 max-w-2xl leading-relaxed">
              The first browser-native AI captioning studio with native romanized Hinglish, “Behind You” depth text, and zero cloud uploads or subscription token fees.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Link
                href="/editor"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-base transition-all duration-200 shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Launch Caption Studio</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#templates"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 font-semibold text-base transition-all flex items-center justify-center gap-2"
              >
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Explore 70+ Presets</span>
              </a>
            </div>

            {/* Micro Feature Proof */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-medium text-zinc-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero Video Uploads
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Zero API / Token Costs
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> WebGPU Whisper Engine
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Hardware 4K WebCodecs Export
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 2: TEMPLATE SHOWCASE (INSPIRED BY REFERENCE IMAGES) */}
        <section id="templates" className="max-w-7xl mx-auto px-4 sm:px-6">
          <CreatorTemplatePreview />
        </section>

        {/* SECTION 3: HINGLISH ACCURACY ENGINE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <InteractiveHinglishDemo />
        </section>

        {/* SECTION 4: PRIVACY & ARCHITECTURE GUARANTEE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why Creators Trust BolSub Studio
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
              Everything runs inside your client sandbox. No cloud servers, no data collection, no surprise subscription charges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl glass-panel p-6 sm:p-8 space-y-4 glass-panel-hover">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">100% Client-Side Privacy</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Your high-res videos, voice recordings, and transcripts never leave your computer or phone. Video decoding, speech recognition, and final rendering happen locally in Web Workers.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl glass-panel p-6 sm:p-8 space-y-4 glass-panel-hover">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Zero Metered API Costs</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Forget paying 10 to 50 cents per minute to cloud transcription APIs. BolSub leverages open-weights Whisper and Silero VAD running directly on your WebGPU hardware accelerator.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl glass-panel p-6 sm:p-8 space-y-4 glass-panel-hover">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Streaming WebCodecs Muxing</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Export frame-identical 9:16 vertical videos in 720p, 1080p, or 4K with hardware-assisted encoding. No server queue delays—your video is saved straight to disk via File System Access.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Clear answers for creators and media engineers.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How does BolSub transcribe videos without an internet connection?",
                a: "BolSub downloads open-source Whisper ONNX weights once into your browser's persistent cache. Transcription is powered by WebGPU (via @huggingface/transformers and ONNX Runtime Web). Once cached, transcription works 100% offline in airplane mode.",
              },
              {
                q: "Why is BolSub's Hinglish better than standard Whisper?",
                a: "Whisper naturally outputs Hindi words in Devanagari characters, which looks unnatural when mixed with English terms on Reels. BolSub's deterministic post-processor utilizes a curated 5,000+ Hinglish lexicon and contextual schwa-deletion transliteration to produce natural, conversationally accurate Roman Hinglish.",
              },
              {
                q: "What export formats are supported?",
                a: "You can export hardcoded MP4 videos (with hardware-accelerated H.264/AAC), transparent alpha overlay WebM videos for Premier Pro/Final Cut, and standard subtitle files (SRT, VTT, and ASS).",
              },
              {
                q: "What are the device requirements?",
                a: "Modern Chromium browsers (Google Chrome, Microsoft Edge, Brave) with WebGPU support enabled deliver real-time transcription speeds (5x to 12x faster than playback). On older devices or Safari, BolSub automatically falls back to multithreaded WASM SIMD.",
              },
            ].map((faq, i) => (
              <div key={i} className="p-5 rounded-xl glass-panel space-y-2">
                <h4 className="text-sm font-semibold text-white flex items-center justify-between">
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl glass-panel p-8 sm:p-12 text-center relative overflow-hidden border border-amber-500/30">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Ready to Upgrade Your Reels & Shorts?
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto mt-3">
              Join thousands of creators producing high-retention Hinglish captions with zero cloud fees.
            </p>
            <div className="mt-8">
              <Link
                href="/editor"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-base transition-all shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95"
              >
                <span>Launch BolSub Studio</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
