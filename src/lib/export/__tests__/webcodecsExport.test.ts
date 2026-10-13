import { describe, it, expect } from 'vitest';
import {
  RESOLUTION_DIMENSIONS,
  testEncoderSupport,
} from '../webcodecsExport';
import { isFileSystemAccessSupported } from '../fileSaver';

describe('webcodecsExport configuration & preflight', () => {
  it('defines correct 9:16 vertical dimensions for all export tiers', () => {
    expect(RESOLUTION_DIMENSIONS['720p']).toEqual({
      width: 720,
      height: 1280,
      defaultBitrate: 4_500_000,
    });
    expect(RESOLUTION_DIMENSIONS['1080p']).toEqual({
      width: 1080,
      height: 1920,
      defaultBitrate: 8_500_000,
    });
    expect(RESOLUTION_DIMENSIONS['1440p']).toEqual({
      width: 1440,
      height: 2560,
      defaultBitrate: 15_000_000,
    });
    expect(RESOLUTION_DIMENSIONS['4k']).toEqual({
      width: 2160,
      height: 3840,
      defaultBitrate: 28_000_000,
    });
  });

  it('safely handles environments where VideoEncoder is undefined', async () => {
    // In node/JSDOM, VideoEncoder is not defined by default
    const res = await testEncoderSupport(1080, 1920, 30, 8_000_000);
    expect(res).toEqual({ supported: false, codec: 'none' });
  });

  it('correctly detects File System Access API presence', () => {
    // In standard JSDOM, showSaveFilePicker is undefined unless polyfilled
    const supported = isFileSystemAccessSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('preflights codec configurations with simulated VideoEncoder', async () => {
    const originalVideoEncoder = (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder;

    // Provide mock VideoEncoder with isConfigSupported
    (globalThis as unknown as { VideoEncoder: unknown }).VideoEncoder = {
      isConfigSupported: async (cfg: { codec: string }) => {
        return {
          supported: cfg.codec === 'avc1.4d002a',
          config: cfg,
        };
      },
    };

    const res = await testEncoderSupport(1080, 1920, 30, 8_000_000);
    expect(res.supported).toBe(true);
    expect(res.codec).toBe('avc1.4d002a');

    // Restore
    (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder = originalVideoEncoder;
  });
});
