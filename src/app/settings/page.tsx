"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import {
  Settings,
  BookOpen,
  Cpu,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  HardDrive,
} from "lucide-react";
import { LocalModelManager, MODEL_TIERS, type ModelTierId } from "@/lib/modelManager";
import { detectSystemCapabilities, type SystemCapabilities } from "@/lib/capabilities";

export default function SettingsPage() {
  const [selectedTier, setSelectedTier] = useState<ModelTierId>("balanced");
  const [caps, setCaps] = useState<SystemCapabilities | null>(null);
  const [storage, setStorage] = useState({ usedMb: 0, totalQuotaMb: 5000 });
  const [userWords, setUserWords] = useState<Array<{ devanagari: string; roman: string }>>([
    { devanagari: "भाई", roman: "bhai" },
    { devanagari: "सब्सक्राइब", roman: "subscribe" },
    { devanagari: "जुगाड़", roman: "jugaad" },
    { devanagari: "मस्त", roman: "mast" },
  ]);
  const [newDev, setNewDev] = useState("");
  const [newRoman, setNewRoman] = useState("");
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    detectSystemCapabilities().then(setCaps);
    LocalModelManager.getStorageOverview().then(setStorage);
  }, []);

  const handleAddWord = () => {
    if (!newDev.trim() || !newRoman.trim()) return;
    setUserWords([...userWords, { devanagari: newDev.trim(), roman: newRoman.trim().toLowerCase() }]);
    setNewDev("");
    setNewRoman("");
  };

  const handleRemoveWord = (index: number) => {
    setUserWords(userWords.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] transition-colors duration-150">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 sm:p-10 space-y-8">
        <div className="pb-6 border-b-2 border-[var(--border-main)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-fraunces italic text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
                Settings & Preferences
              </h1>
              <span className="neo-pill bg-[var(--accent-lime)]/30 text-[var(--text-main)] text-[10px]">
                100% On-Device
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-medium">
              Configure on-device AI transcription tiers, your custom Hinglish vocabulary dictionary, and storage quotas.
            </p>
          </div>
        </div>

        {/* SECTION 1: WHISPER MODEL TIER */}
        <section className="neo-card p-6 bg-[var(--bg-card)] space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <Cpu className="w-5 h-5 text-[#142218]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[var(--text-main)]">Default Whisper ASR Tier</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Determines model download size and transcription accuracy on your hardware.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {LocalModelManager.getTiers().map((tier) => {
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`p-4 rounded-2xl border-2 border-[var(--border-main)] text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[var(--accent-lime)]/20 shadow-[4px_4px_0px_var(--border-main)] ring-2 ring-[var(--accent-lime)]"
                      : "bg-[var(--bg-panel)] shadow-[2px_2px_0px_var(--border-main)] hover:shadow-[3px_3px_0px_var(--border-main)] hover:-translate-x-0.5 hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-[var(--text-main)]">{tier.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                      {tier.sizeMb}MB
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium line-clamp-2 leading-relaxed">{tier.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: CUSTOM HINGLISH DICTIONARY */}
        <section className="neo-card p-6 bg-[var(--bg-card)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
                <BookOpen className="w-5 h-5 text-[#142218]" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-[var(--text-main)]">Custom Hinglish Dictionary</h2>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  When you correct a word once, BolSub remembers it and auto-applies it in future reels.
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="neo-btn px-4 py-2 text-xs font-black text-[#142218] gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Save className="w-4 h-4" />
              <span>{savedToast ? "Saved!" : "Save Dictionary"}</span>
            </button>
          </div>

          {/* Add Word Form */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <input
              type="text"
              placeholder="Devanagari (e.g. मसाला)"
              value={newDev}
              onChange={(e) => setNewDev(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-lime)] shadow-[2px_2px_0px_var(--border-main)] font-medium"
            />
            <input
              type="text"
              placeholder="Roman Hinglish (e.g. masala)"
              value={newRoman}
              onChange={(e) => setNewRoman(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-lime)] shadow-[2px_2px_0px_var(--border-main)] font-medium"
            />
            <button
              onClick={handleAddWord}
              className="neo-btn-secondary px-4 py-2 text-xs font-bold gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Word List Chips */}
          <div className="flex flex-wrap gap-2 pt-2">
            {userWords.map((word, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border-2 border-[var(--border-main)] text-xs text-[var(--text-main)] shadow-[2px_2px_0px_var(--border-main)] font-semibold"
              >
                <span>{word.devanagari}</span>
                <span className="text-[var(--text-muted)]">→</span>
                <span className="font-bold font-mono text-[var(--accent-lime)] dark:text-[var(--accent-lime)] text-emerald-800">{word.roman}</span>
                <button
                  onClick={() => handleRemoveWord(idx)}
                  className="text-[var(--text-muted)] hover:text-red-500 ml-1 transition-colors cursor-pointer"
                  title="Remove word"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: STORAGE QUOTA */}
        <section className="neo-card p-6 bg-[var(--bg-card)] space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <HardDrive className="w-5 h-5 text-[#142218]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[var(--text-main)]">Browser Local Storage Usage</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                OPFS and Cache API storage allocated on your local device.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1 font-medium">
            <span>Storage Used: <strong className="text-[var(--text-main)] font-mono font-bold">{storage.usedMb} MB</strong></span>
            <span>Allocated Quota: <strong className="text-[var(--text-main)] font-mono font-bold">{(storage.totalQuotaMb / 1024).toFixed(1)} GB</strong></span>
          </div>
          <div className="w-full h-3 rounded-full bg-[var(--bg-panel)] overflow-hidden border-2 border-[var(--border-main)] shadow-inner">
            <div
              className="h-full bg-[var(--accent-lime)] transition-all"
              style={{
                width: `${Math.min(100, Math.max(3, (storage.usedMb / (storage.totalQuotaMb || 5000)) * 100))}%`,
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
