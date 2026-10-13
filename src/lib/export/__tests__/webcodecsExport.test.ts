import { describe, it, expect } from 'vitest';
import {
  RESOLUTION_DIMENSIONS,
  calculateExportDimensions,
  testEncoderSupport,
  extractAudioFromSource,
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

  it('calculates correct dimensions and bitrates across all aspect ratios', () => {
    // 16:9 Landscape YouTube
    const yt1080 = calculateExportDimensions('16:9', '1080p');
    expect(yt1080.width).toBe(1920);
    expect(yt1080.height).toBe(1080);
    expect(yt1080.bitrate).toBe(8_500_000);

    const yt720 = calculateExportDimensions('16:9', '720p');
    expect(yt720.width).toBe(1280);
    expect(yt720.height).toBe(720);

    // 1:1 Square Feed
    const square = calculateExportDimensions('1:1', '1080p');
    expect(square.width).toBe(1080);
    expect(square.height).toBe(1080);

    // 4:5 Instagram Portrait
    const port45 = calculateExportDimensions('4:5', '1080p');
    expect(port45.width).toBe(1080);
    expect(port45.height).toBe(1350);

    // 21:9 Ultrawide
    const ultrawide = calculateExportDimensions('21:9', '1080p');
    expect(ultrawide.width).toBe(2560);
    expect(ultrawide.height).toBe(1080);

    // Original Source Dimensions
    const origSource = calculateExportDimensions('original', 'source', 1920, 1080);
    expect(origSource.width).toBe(1920);
    expect(origSource.height).toBe(1080);

    // Original Source with 720p scaling
    const orig720 = calculateExportDimensions('original', '720p', 1920, 1080);
    expect(orig720.height).toBe(720);
    expect(orig720.width).toBe(1280);
  });

  it('guarantees all dimensions are even integers for hardware codecs', () => {
    const testCases: Array<{ w: number; h: number }> = [
      { w: 1081, h: 1919 },
      { w: 1279, h: 721 },
      { w: 853, h: 480 },
    ];

    for (const tc of testCases) {
      const res = calculateExportDimensions('original', 'source', tc.w, tc.h);
      expect(res.width % 2).toBe(0);
      expect(res.height % 2).toBe(0);
    }
  });

  it('applies quality multipliers to bitrate', () => {
    const std = calculateExportDimensions('9:16', '1080p', undefined, undefined, 'standard');
    const high = calculateExportDimensions('9:16', '1080p', undefined, undefined, 'high');
    const fast = calculateExportDimensions('9:16', '1080p', undefined, undefined, 'fast');

    expect(high.bitrate).toBeGreaterThan(std.bitrate);
    expect(fast.bitrate).toBeLessThan(std.bitrate);
  });

  it('safely handles environments where VideoEncoder is undefined', async () => {
    const res = await testEncoderSupport(1080, 1920, 30, 8_000_000);
    expect(res).toEqual({ supported: false, codec: 'none' });
  });

  it('correctly detects File System Access API presence', () => {
    const supported = isFileSystemAccessSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('handles null audio source gracefully without throwing', async () => {
    const audio = await extractAudioFromSource(null);
    expect(audio).toBeNull();
  });

  it('preflights codec configurations with simulated VideoEncoder', async () => {
    const originalVideoEncoder = (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder;

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

    (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder = originalVideoEncoder;
  });
});
