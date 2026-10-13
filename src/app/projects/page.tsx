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
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] transition-colors duration-150">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 sm:p-10 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-[var(--border-main)]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-fraunces italic text-3xl sm:text-4xl font-extrabold text-[var(--text-main)]">
                Local Projects
              </h1>
              <span className="neo-pill bg-[var(--accent-lime)]/30 text-[var(--text-main)] text-[10px]">
                100% On-Device OPFS
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-medium">
              Your video drafts, custom Hinglish dictionaries, and timeline edits are stored securely in browser storage.
            </p>
          </div>

          <Link
            href="/editor"
            className="neo-btn px-5 py-2.5 text-xs text-[#142218] gap-2 font-black self-start"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Video Project</span>
          </Link>
        </div>

        {/* Local Storage Quota Bar */}
        <div className="neo-card p-5 bg-[var(--bg-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)]">
              <HardDrive className="w-5 h-5 text-[#142218]" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[var(--text-main)] flex items-center gap-2">
                Origin Private File System (OPFS) & IndexedDB
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                {storageUsedMb} MB used of {storageQuotaMb > 0 ? `${storageQuotaMb} MB` : "Available"} disk quota
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-40 h-3 bg-[var(--bg-panel)] rounded-full overflow-hidden border-2 border-[var(--border-main)]">
              <div
                className="h-full bg-[var(--accent-lime)]"
                style={{ width: `${Math.min(100, Math.max(5, (storageUsedMb / Math.max(1, storageQuotaMb)) * 100))}%` }}
              />
            </div>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="neo-btn-secondary px-3 py-1.5 text-[11px] gap-1.5 font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isClearing ? "animate-spin" : ""}`} />
              <span>Free Cache</span>
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
              Recent Projects ({projects.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="neo-card p-4 bg-[var(--bg-card)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_var(--border-main)] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Aspect Preview Card */}
                  <div className={`h-36 rounded-xl bg-gradient-to-br ${proj.thumbnailColor} border-2 border-[var(--border-main)] flex items-center justify-center relative overflow-hidden shadow-[2px_2px_0px_var(--border-main)]`}>
                    <div className="text-center p-3">
                      <Video className="w-8 h-8 text-[var(--text-main)] mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-main)] bg-[var(--bg-card)] px-2.5 py-0.5 rounded-full border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)]">
                        9:16 Vertical
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[var(--bg-card)] text-[10px] font-mono text-[var(--text-main)] font-bold border border-[var(--border-main)] shadow-[1px_1px_0px_var(--border-main)] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{proj.duration}s</span>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="mt-3.5 space-y-1">
                    <h3 className="text-sm font-extrabold text-[var(--text-main)] truncate">
                      {proj.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
                      <span>{proj.wordCount} words</span>
                      <span>•</span>
                      <span>Preset: {proj.templateName}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-3 border-t-2 border-[var(--border-main)]/20 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted)] font-semibold">{proj.updatedAt}</span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDuplicateProject(proj)}
                      className="neo-btn-secondary p-1.5 rounded-full cursor-pointer"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id)}
                      className="neo-btn-secondary p-1.5 rounded-full hover:text-rose-600 cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href="/editor"
                      className="neo-btn px-3 py-1 text-xs text-[#142218] gap-1 font-black ml-1"
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
        <div className="neo-card p-6 bg-[var(--bg-panel)] flex items-center gap-4">
          <div className="p-3 rounded-full bg-[var(--accent-lime)] text-[#142218] border-2 border-[var(--border-main)] shadow-[2px_2px_0px_var(--border-main)] shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[var(--text-main)]">Absolute Privacy Guarantee</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium leading-relaxed">
              BolSub Studio operates 100% in your local browser sandbox. No videos, transcripts, or personal speech are ever transmitted to any external server or API.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
