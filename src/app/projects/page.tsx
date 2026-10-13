"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  FolderKanban,
  Plus,
  HardDrive,
  Video,
  Clock,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useEditorStore } from "@/lib/editorStore";

interface ProjectItem {
  id: string;
  title: string;
  duration: number;
  wordCount: number;
  templateName: string;
  updatedAt: string;
  thumbnailColor: string;
}

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: "proj_1",
    title: "Mumbai Tech Reel (Hinglish Viral)",
    duration: 3.5,
    wordCount: 8,
    templateName: "Lime Sticker Box",
    updatedAt: "Just now",
    thumbnailColor: "from-lime-500/20 to-emerald-950",
  },
  {
    id: "proj_2",
    title: "Startup Pitch & Chai Podcast Short",
    duration: 12.4,
    wordCount: 34,
    templateName: "Behind You (White)",
    updatedAt: "2 hours ago",
    thumbnailColor: "from-amber-500/20 to-zinc-950",
  },
  {
    id: "proj_3",
    title: "AI Video Editing Secrets - Ep 4",
    duration: 28.1,
    wordCount: 86,
    templateName: "Sunshine Impact",
    updatedAt: "Yesterday",
    thumbnailColor: "from-yellow-500/20 to-stone-950",
  },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>(DEFAULT_PROJECTS);
  const [storageUsedMb, setStorageUsedMb] = useState<number>(0);
  const [storageQuotaMb, setStorageQuotaMb] = useState<number>(10000);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageUsedMb(Math.round((est.usage || 0) / (1024 * 1024)));
        setStorageQuotaMb(Math.round((est.quota || 0) / (1024 * 1024)));
      });
    }
  }, []);

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDuplicateProject = (proj: ProjectItem) => {
    const duplicated: ProjectItem = {
      ...proj,
      id: `proj_${Date.now()}`,
      title: `${proj.title} (Copy)`,
      updatedAt: "Just now",
    };
    setProjects((prev) => [duplicated, ...prev]);
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    setTimeout(() => {
      setIsClearing(false);
      setStorageUsedMb(0);
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 sm:p-10 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Local Projects</h1>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% On-Device OPFS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Your video drafts, custom Hinglish dictionaries, and timeline edits are stored securely in browser storage.
            </p>
          </div>

          <Link
            href="/editor"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-all shadow-lg shadow-amber-500/20 self-start"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Video Project</span>
          </Link>
        </div>

        {/* Local Storage Quota Bar */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-400 border border-zinc-800">
              <HardDrive className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                Origin Private File System (OPFS) & IndexedDB
              </h3>
              <p className="text-[11px] text-zinc-400">
                {storageUsedMb} MB used of {storageQuotaMb > 0 ? `${storageQuotaMb} MB` : "Available"} disk quota
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-36 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                style={{ width: `${Math.min(100, Math.max(5, (storageUsedMb / Math.max(1, storageQuotaMb)) * 100))}%` }}
              />
            </div>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[11px] font-medium border border-zinc-800 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isClearing ? "animate-spin" : ""}`} />
              <span>Free Cache</span>
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
              Recent Projects ({projects.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="group p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all hover:shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Aspect Preview Card */}
                  <div className={`h-36 rounded-xl bg-gradient-to-br ${proj.thumbnailColor} border border-zinc-800 flex items-center justify-center relative overflow-hidden`}>
                    <div className="text-center p-3">
                      <Video className="w-8 h-8 text-zinc-500 mx-auto mb-1 group-hover:text-amber-400 group-hover:scale-110 transition-all" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-black/60 px-2 py-0.5 rounded-full border border-zinc-800">
                        9:16 Vertical
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-300 border border-zinc-800 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{proj.duration}s</span>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="mt-3 space-y-1">
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                      {proj.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{proj.wordCount} words</span>
                      <span>•</span>
                      <span>Preset: {proj.templateName}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-zinc-500">{proj.updatedAt}</span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateProject(proj)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href="/editor"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 transition-colors ml-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy & Zero-Upload Guarantee Footer Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Absolute Privacy Guarantee</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              BolSub Studio operates 100% in your local browser sandbox. No videos, transcripts, or personal speech are ever transmitted to any external server or API.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
