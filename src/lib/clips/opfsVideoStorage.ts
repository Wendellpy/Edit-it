/**
 * OPFS (Origin Private File System) Streaming Storage for Clips
 * Guarantees bounded browser memory: Streams downloaded video chunks directly from HTTP
 * response to disk via FileSystemWritableFileStream without buffering full videos in RAM.
 */

export interface OpfsStorageStats {
  count: number;
  totalBytes: number;
  available: boolean;
}

export class OpfsVideoStorage {
  private static instance: OpfsVideoStorage;
  private rootDir: FileSystemDirectoryHandle | null = null;
  private clipsDir: FileSystemDirectoryHandle | null = null;
  private isOpfsSupported: boolean = false;

  private constructor() {
    this.initOpfs();
  }

  static getInstance(): OpfsVideoStorage {
    if (!OpfsVideoStorage.instance) {
      OpfsVideoStorage.instance = new OpfsVideoStorage();
    }
    return OpfsVideoStorage.instance;
  }

  private async initOpfs(): Promise<boolean> {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === "function"
    ) {
      try {
        this.rootDir = await navigator.storage.getDirectory();
        this.clipsDir = await this.rootDir.getDirectoryHandle("bolsub_clips_cache", {
          create: true,
        });
        this.isOpfsSupported = true;
        return true;
      } catch (err) {
        console.warn("OPFS initialization failed, fallback enabled:", err);
        this.isOpfsSupported = false;
        return false;
      }
    }
    this.isOpfsSupported = false;
    return false;
  }

  private async ensureDir(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.clipsDir) {
      await this.initOpfs();
    }
    return this.clipsDir;
  }

  /**
   * Streams a Response body (chunk-by-chunk) into OPFS disk storage.
   * Memory is bounded to the size of a single network chunk (~64KB).
   */
  async streamResponseToOpfs(
    fileId: string,
    response: Response,
    onProgress?: (bytesWritten: number, totalBytes?: number) => void
  ): Promise<{ success: boolean; bytesWritten: number; fileName: string }> {
    const dir = await this.ensureDir();
    if (!dir || !response.body) {
      throw new Error("OPFS or response stream is unavailable");
    }

    const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${cleanId}.mp4`;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });

    // Acquire stream writable
    const writable = await (fileHandle as any).createWritable();
    const reader = response.body.getReader();
    const contentLengthHeader = response.headers.get("Content-Length");
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;

    let bytesWritten = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await writable.write(value);
          bytesWritten += value.byteLength;
          if (onProgress) {
            onProgress(bytesWritten, totalBytes);
          }
        }
      }
      await writable.close();
      return { success: true, bytesWritten, fileName };
    } catch (err) {
      try {
        await writable.abort();
      } catch {}
      throw err;
    }
  }

  /**
   * Retrieves a video File from OPFS disk.
   */
  async getVideoFile(fileId: string): Promise<File | null> {
    const dir = await this.ensureDir();
    if (!dir) return null;

    const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${cleanId}.mp4`;

    try {
      const fileHandle = await dir.getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  /**
   * Creates an object URL directly pointing to the OPFS video file.
   */
  async getVideoBlobUrl(fileId: string): Promise<string | null> {
    const file = await this.getVideoFile(fileId);
    if (!file) return null;
    return URL.createObjectURL(file);
  }

  /**
   * Checks if video exists in OPFS.
   */
  async hasVideo(fileId: string): Promise<boolean> {
    const dir = await this.ensureDir();
    if (!dir) return false;
    const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    try {
      await dir.getFileHandle(`${cleanId}.mp4`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Removes a specific video from OPFS.
   */
  async removeVideo(fileId: string): Promise<void> {
    const dir = await this.ensureDir();
    if (!dir) return;
    const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    try {
      await dir.removeEntry(`${cleanId}.mp4`);
    } catch {}
  }

  /**
   * Calculates total OPFS clips storage usage.
   */
  async getStorageStats(): Promise<OpfsStorageStats> {
    const dir = await this.ensureDir();
    if (!dir) return { count: 0, totalBytes: 0, available: false };

    let count = 0;
    let totalBytes = 0;

    try {
      for await (const [name, handle] of (dir as any).entries()) {
        if (handle.kind === "file") {
          const file = await (handle as FileSystemFileHandle).getFile();
          totalBytes += file.size;
          count += 1;
        }
      }
      return { count, totalBytes, available: true };
    } catch {
      return { count: 0, totalBytes: 0, available: false };
    }
  }

  /**
   * Cleans all clips stored in OPFS.
   */
  async clearAllClips(): Promise<void> {
    const dir = await this.ensureDir();
    if (!dir) return;
    try {
      for await (const [name, handle] of (dir as any).entries()) {
        if (handle.kind === "file") {
          await dir.removeEntry(name);
        }
      }
    } catch {}
  }
}

export const opfsVideoStorage = OpfsVideoStorage.getInstance();
