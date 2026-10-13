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
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] transition-colors duration-150">
      <Navbar />

      <main className="flex-1 space-y-20 sm:space-y-28 py-10 sm:py-16">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          {/* Subtle Ambient Radial Gradients */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

          <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
            {/* Pill Tag */}
            <div className="neo-pill bg-[#A3E635] text-[#142218] gap-2 px-4 py-1.5 text-xs font-black uppercase tracking-wider animate-in fade-in slide-in-from-bottom-2 duration-500 select-none">
              <Sparkles className="w-3.5 h-3.5 text-[#142218] stroke-[2.5]" />
              <span>Built for Indian Creators • Reels & Shorts</span>
            </div>

            {/* Main Headline in Fraunces Italic Retro Neobrutalism */}
            <h1 className="font-fraunces italic text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[var(--text-main)] leading-[1.08]">
              Viral <span className="underline decoration-[#A3E635] decoration-4 underline-offset-8">Hinglish Captions</span> in Seconds.{" "}
              <span className="font-normal opacity-90 not-italic block mt-1 font-fraunces">100% Local on Your Device.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-xl text-[var(--text-muted)] max-w-2xl leading-relaxed font-medium">
              The first browser-native AI captioning studio with native romanized Hinglish, “Behind You” depth text, and zero cloud uploads or subscription token fees.
            </p>

            {/* Action Buttons - Neobrutal Pills */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Link
                href="/editor"
                className="neo-btn w-full sm:w-auto px-8 py-3.5 text-base flex items-center justify-center gap-2.5"
              >
                <span>Launch Caption Studio</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </Link>
              <a
                href="#templates"
                className="neo-btn-secondary w-full sm:w-auto px-6 py-3.5 text-base flex items-center justify-center gap-2"
              >
                <Layers className="w-5 h-5 text-[#A3E635]" />
                <span>Explore 70+ Presets</span>
              </a>
            </div>

            {/* Micro Feature Proof Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 text-xs font-bold text-[var(--text-main)]">
              <span className="neo-pill bg-[var(--bg-card)] gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A3E635] stroke-[2.5]" /> Zero Video Uploads
              </span>
              <span className="neo-pill bg-[var(--bg-card)] gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A3E635] stroke-[2.5]" /> Zero API / Token Costs
              </span>
              <span className="neo-pill bg-[var(--bg-card)] gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A3E635] stroke-[2.5]" /> WebGPU Whisper Engine
              </span>
              <span className="neo-pill bg-[var(--bg-card)] gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#A3E635] stroke-[2.5]" /> Hardware 4K WebCodecs Export
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 2: TEMPLATE SHOWCASE */}
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
            <h2 className="font-fraunces italic text-2xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              Why Creators Trust BolSub Studio
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-xl mx-auto font-medium">
              Everything runs inside your client sandbox. No cloud servers, no data collection, no surprise subscription charges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="neo-card p-6 sm:p-8 space-y-4 neo-card-hover">
              <div className="w-12 h-12 rounded-full bg-[#A3E635] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[#142218]">
                <Lock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-fraunces text-lg font-bold text-[var(--text-main)]">100% Client-Side Privacy</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                Your high-res videos, voice recordings, and transcripts never leave your computer or phone. Video decoding, speech recognition, and final rendering happen locally in Web Workers.
              </p>
            </div>

            {/* Card 2 */}
            <div className="neo-card p-6 sm:p-8 space-y-4 neo-card-hover">
              <div className="w-12 h-12 rounded-full bg-[#A3E635] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[#142218]">
                <Zap className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-fraunces text-lg font-bold text-[var(--text-main)]">Zero Metered API Costs</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                Forget paying 10 to 50 cents per minute to cloud transcription APIs. BolSub leverages open-weights Whisper and Silero VAD running directly on your WebGPU hardware accelerator.
              </p>
            </div>

            {/* Card 3 */}
            <div className="neo-card p-6 sm:p-8 space-y-4 neo-card-hover">
              <div className="w-12 h-12 rounded-full bg-[#A3E635] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] flex items-center justify-center text-[#142218]">
                <Cpu className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-fraunces text-lg font-bold text-[var(--text-main)]">Streaming WebCodecs Muxing</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                Export frame-identical 9:16 vertical videos in 720p, 1080p, or 4K with hardware-assisted encoding. No server queue delays—your video is saved straight to disk via File System Access.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: FREQUENTLY ASKED QUESTIONS */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <h2 className="font-fraunces italic text-2xl sm:text-4xl font-extrabold text-[var(--text-main)] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
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
              <div key={i} className="neo-card p-6 bg-[var(--bg-card)] space-y-2">
                <h4 className="font-fraunces text-base font-bold text-[var(--text-main)] flex items-center justify-between">
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CALL TO ACTION (CauseHouse Style) */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border-2 border-[var(--border-main)] bg-[var(--accent-lime)] text-[#142218] p-8 sm:p-14 text-center relative overflow-hidden shadow-[6px_6px_0px_var(--border-main)]">
            <h2 className="font-fraunces italic text-3xl sm:text-5xl font-black tracking-tight text-[#142218]">
              Ready to Upgrade Your Reels & Shorts?
            </h2>
            <p className="text-sm sm:text-base text-[#142218]/80 max-w-xl mx-auto mt-3 font-semibold">
              Join thousands of creators producing high-retention Hinglish captions with zero cloud fees.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/editor"
                className="neo-btn-dark px-8 py-4 text-base font-black inline-flex items-center gap-2 shadow-[4px_4px_0px_#142218]"
              >
                <span>Launch BolSub Studio</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
