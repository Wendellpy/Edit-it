import Dexie, { type EntityTable } from "dexie";

export interface CustomDictionaryEntry {
  id?: number;
  devanagari: string;
  roman: string;
  updatedAt: number;
}

export interface ProjectEntry {
  id?: string;
  name: string;
  durationSeconds: number;
  templateId: string;
  transcriptJson: string; // Serialized WordToken[]
  createdAt: number;
  updatedAt: number;
}

// Dexie Database Schema
class BolSubDatabase extends Dexie {
  userDictionary!: EntityTable<CustomDictionaryEntry, "id">;
  projects!: EntityTable<ProjectEntry, "id">;

  constructor() {
    super("BolSubStudioDB");
    this.version(1).stores({
      userDictionary: "++id, devanagari, roman, updatedAt",
      projects: "id, name, updatedAt",
    });
  }
}

export const db = new BolSubDatabase();

// In-Memory Fast Cache for 60fps synchronous lookup
let inMemoryCache: Record<string, string> = {};
let isCacheLoaded = false;

export async function loadUserDictionaryCache(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const entries = await db.userDictionary.toArray();
    const map: Record<string, string> = {};
    for (const e of entries) {
      map[e.devanagari.trim()] = e.roman.trim().toLowerCase();
    }
    inMemoryCache = map;
    isCacheLoaded = true;
    return map;
  } catch (err) {
    console.warn("Error loading Dexie user dictionary:", err);
    return inMemoryCache;
  }
}

export function lookupUserDictionary(word: string): string | null {
  const clean = word.trim();
  return inMemoryCache[clean] || null;
}

export async function saveUserDictionaryCorrection(
  devanagari: string,
  roman: string
): Promise<void> {
  const cleanDev = devanagari.trim();
  const cleanRom = roman.trim().toLowerCase();

  inMemoryCache[cleanDev] = cleanRom;

  if (typeof window === "undefined") return;

  try {
    const existing = await db.userDictionary.where("devanagari").equals(cleanDev).first();
    if (existing && existing.id) {
      await db.userDictionary.update(existing.id, {
        roman: cleanRom,
        updatedAt: Date.now(),
      });
    } else {
      await db.userDictionary.add({
        devanagari: cleanDev,
        roman: cleanRom,
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn("Error saving user dictionary correction:", err);
  }
}

export async function getAllUserDictionaryEntries(): Promise<CustomDictionaryEntry[]> {
  if (typeof window === "undefined") return [];
  try {
    return await db.userDictionary.toArray();
  } catch {
    return [];
  }
}

export async function deleteUserDictionaryEntry(devanagari: string): Promise<void> {
  const clean = devanagari.trim();
  delete inMemoryCache[clean];
  if (typeof window === "undefined") return;
  try {
    await db.userDictionary.where("devanagari").equals(clean).delete();
  } catch (err) {
    console.warn("Error deleting entry from user dictionary:", err);
  }
}
