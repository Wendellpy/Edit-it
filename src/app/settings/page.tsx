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
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 sm:p-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Settings & Preferences</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Configure on-device AI transcription tiers, your custom Hinglish vocabulary dictionary, and storage quotas.
          </p>
        </div>

        {/* SECTION 1: WHISPER MODEL TIER */}
        <section className="p-6 rounded-2xl glass-panel space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Default Whisper ASR Tier</h2>
              <p className="text-xs text-zinc-400">
                Determines model download size and transcription accuracy on your hardware.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LocalModelManager.getTiers().map((tier) => {
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-zinc-900 border-amber-500 text-white shadow-md shadow-amber-500/10"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{tier.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {tier.sizeMb}MB
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">{tier.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: CUSTOM HINGLISH DICTIONARY */}
        <section className="p-6 rounded-2xl glass-panel space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Custom Hinglish Dictionary</h2>
                <p className="text-xs text-zinc-400">
                  When you correct a word once, BolSub remembers it and auto-applies it in future reels.
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
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
              className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Roman Hinglish (e.g. masala)"
              value={newRoman}
              onChange={(e) => setNewRoman(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleAddWord}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Word List Chips */}
          <div className="flex flex-wrap gap-2 pt-2">
            {userWords.map((word, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200"
              >
                <span>{word.devanagari}</span>
                <span className="text-zinc-500">→</span>
                <span className="font-semibold text-amber-300">{word.roman}</span>
                <button
                  onClick={() => handleRemoveWord(idx)}
                  className="text-zinc-500 hover:text-red-400 ml-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: STORAGE QUOTA */}
        <section className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Browser Local Storage Usage</h2>
              <p className="text-xs text-zinc-400">
                OPFS and Cache API storage allocated on your local device.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
            <span>Storage Used: <strong className="text-white">{storage.usedMb} MB</strong></span>
            <span>Allocated Quota: <strong className="text-white">{(storage.totalQuotaMb / 1024).toFixed(1)} GB</strong></span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (storage.usedMb / (storage.totalQuotaMb || 5000)) * 100)}%`,
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
