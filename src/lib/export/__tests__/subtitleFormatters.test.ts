import { describe, it, expect } from 'vitest';
import {
  formatSrtTime,
  formatVttTime,
  formatAssTime,
  hexToAssColor,
  groupWordsIntoCues,
  generateSrt,
  generateVtt,
  generateAss,
} from '../subtitleFormatters';
import type { WordToken } from '@/lib/timestampRefiner';
import type { CaptionTemplate } from '@/lib/templates/schema';

describe('subtitleFormatters', () => {
  const sampleWords: WordToken[] = [
    { id: 'w1', text: 'Namaste', start: 0.1, end: 0.6, confidence: 0.98 },
    { id: 'w2', text: 'dosto', start: 0.65, end: 1.1, confidence: 0.95 },
    { id: 'w3', text: 'aaj', start: 1.15, end: 1.45, confidence: 0.99 },
    { id: 'w4', text: 'hum', start: 1.5, end: 1.75, confidence: 0.96 },
    { id: 'w5', text: 'video', start: 1.8, end: 2.2, confidence: 0.97 },
    { id: 'w6', text: 'dekhne', start: 2.25, end: 2.7, confidence: 0.94 },
    { id: 'w7', text: 'wale', start: 2.75, end: 3.1, confidence: 0.95 },
    { id: 'w8', text: 'hain.', start: 3.15, end: 3.6, confidence: 0.96 },
  ];

  const sampleTemplate: CaptionTemplate = {
    id: 'test_preset',
    name: 'Test Preset',
    vibe: 'neon',
    typography: {
      primaryFont: 'Montserrat',
      primaryWeight: '900',
      textTransform: 'uppercase',
      fontSizeBasePercent: 0.05,
    },
    colors: {
      primaryText: '#39FF14',
      activeWordText: '#FFE600',
      strokeColor: '#000000',
      strokeWidthPercent: 0.003,
      shadowBlur: 12,
    },
    box: {
      enabled: true,
      bgColor: '#000000',
      paddingX: 16,
      paddingY: 8,
      borderRadius: 12,
    },
    layout: {
      yPositionPercent: 0.75,
      maxWordsPerLine: 4,
      maxLines: 2,
      behindSubjectDepth: false,
    },
    animation: {
      perWordEffect: 'scale_pop',
      scaleMagnitude: 1.25,
    },
  };

  describe('Timecode Formatting', () => {
    it('formats SRT timecodes accurately with comma separator', () => {
      expect(formatSrtTime(0)).toBe('00:00:00,000');
      expect(formatSrtTime(1.234)).toBe('00:00:01,234');
      expect(formatSrtTime(65.789)).toBe('00:01:05,789');
      expect(formatSrtTime(3661.05)).toBe('01:01:01,050');
    });

    it('formats WebVTT timecodes accurately with dot separator', () => {
      expect(formatVttTime(0)).toBe('00:00:00.000');
      expect(formatVttTime(1.234)).toBe('00:00:01.234');
      expect(formatVttTime(65.789)).toBe('00:01:05.789');
    });

    it('formats ASS timecodes accurately in centiseconds', () => {
      expect(formatAssTime(0)).toBe('0:00:00.00');
      expect(formatAssTime(1.234)).toBe('0:00:01.23');
      expect(formatAssTime(65.789)).toBe('0:01:05.78');
    });
  });

  describe('Color Conversion', () => {
    it('converts RGB hex to ASS BGR format with alpha channel', () => {
      // #39FF14: R=39, G=FF, B=14 -> &H0014FF39&
      expect(hexToAssColor('#39FF14', 0)).toBe('&H0014FF39&');
      // #FFE600: R=FF, G=E6, B=00 -> &H0000E6FF&
      expect(hexToAssColor('#FFE600', 0)).toBe('&H0000E6FF&');
      // Semi-transparent black alpha 0.5 -> ~127 (7F)
      expect(hexToAssColor('#000000', 0.5)).toBe('&H7F000000&');
    });
  });

  describe('Cue Grouping', () => {
    it('groups words into cues respecting maxWordsPerCue', () => {
      const cues = groupWordsIntoCues(sampleWords, 4);
      expect(cues.length).toBe(2);
      expect(cues[0].words.length).toBe(4);
      expect(cues[0].text).toBe('Namaste dosto aaj hum');
      expect(cues[1].words.length).toBe(4);
      expect(cues[1].text).toBe('video dekhne wale hain.');
    });

    it('handles empty words gracefully', () => {
      expect(groupWordsIntoCues([])).toEqual([]);
    });
  });

  describe('Document Generation', () => {
    it('generates valid SubRip (SRT) format', () => {
      const srt = generateSrt(sampleWords);
      expect(srt).toContain('1\n00:00:00,100 --> 00:00:01,750\nNamaste dosto aaj hum');
      expect(srt).toContain('2\n00:00:01,800 --> 00:00:03,600\nvideo dekhne wale hain.');
    });

    it('generates valid WebVTT (.vtt) format with styling block', () => {
      const vtt = generateVtt(sampleWords, sampleTemplate);
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('STYLE');
      expect(vtt).toContain('font-family: "Montserrat", sans-serif;');
      expect(vtt).toContain('color: #39FF14;');
      expect(vtt).toContain('00:00:00.100 --> 00:00:01.750 align:center line:85%');
      expect(vtt).toContain('Namaste dosto aaj hum');
    });

    it('generates valid Advanced SubStation Alpha (.ass) format with style headers and dynamic word reveals', () => {
      const ass = generateAss(sampleWords, sampleTemplate, 1080, 1920);
      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('PlayResX: 1080');
      expect(ass).toContain('PlayResY: 1920');
      expect(ass).toContain('[V4+ Styles]');
      expect(ass).toContain('Style: Default,Montserrat');
      expect(ass).toContain('[Events]');
      expect(ass).toContain('{\\c&H0000E6FF&\\fscx125\\fscy125}NAMASTE');
      expect(ass).toContain('{\\c&H0014FF39&\\fscx100\\fscy100}NAMASTE {\\c&H0000E6FF&\\fscx125\\fscy125}DOSTO');
    });

    it('generates valid karaoke fill (.ass) format when configured', () => {
      const karaokeTemplate: CaptionTemplate = {
        ...sampleTemplate,
        animation: { perWordEffect: 'karaoke_fill', scaleMagnitude: 1.0 },
      };
      const ass = generateAss(sampleWords, karaokeTemplate, 1080, 1920);
      expect(ass).toContain('{\\k50}NAMASTE {\\k45}DOSTO {\\k30}AAJ {\\k25}HUM');
    });
  });
});
