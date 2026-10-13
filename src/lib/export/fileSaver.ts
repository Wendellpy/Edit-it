/**
 * BolSub Studio Local File Saver
 * Uses File System Access API (showSaveFilePicker) with graceful fallback to standard browser download.
 * 100% local, zero-network.
 */

export interface SaveFileOptions {
  suggestedName: string;
  mimeType: string;
  extension: string;
  description: string;
}

/**
 * Checks if File System Access API is supported and available in the current context.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Saves a Blob to user's disk either via direct file picker or fallback download.
 */
export async function saveBlobToDisk(
  blob: Blob,
  options: SaveFileOptions
): Promise<{ success: boolean; method: 'fsa' | 'download' }> {
  const { suggestedName, mimeType, extension, description } = options;

  if (isFileSystemAccessSupported()) {
    try {
      const win = window as unknown as {
        showSaveFilePicker: (opts: unknown) => Promise<{
          createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      };
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: {
              [mimeType]: [`.${extension}`],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'fsa' };
    } catch (err: unknown) {
      // If user cancelled, don't trigger download fallback
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, method: 'fsa' };
      }
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // Fallback: standard browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  return { success: true, method: 'download' };
}
