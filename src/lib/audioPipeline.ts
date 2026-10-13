export interface AudioExtractionResult {
  audioBuffer: Float32Array; // 16kHz mono Float32 PCM
  sampleRate: 16000;
  durationSeconds: number;
  rmsPeaks: Float32Array; // Normalized energy envelope for alignment
}

export interface AudioChunk {
  chunkIndex: number;
  startSecond: number;
  endSecond: number;
  data: Float32Array;
  isLast: boolean;
}

/**
 * Extracts and resamples audio from a video or audio file to 16 kHz Mono Float32.
 * Uses Web Audio OfflineAudioContext for deterministic, hardware-accelerated resampling.
 */
export async function extractAndResampleAudio(file: Blob): Promise<AudioExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  // Decode whatever format the browser natively supports (MP4, WebM, MOV, AAC, MP3, WAV)
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  await audioCtx.close();

  const targetSampleRate = 16000;
  const targetLength = Math.ceil(decodedBuffer.duration * targetSampleRate);

  // Use OfflineAudioContext for high-quality polyphase sinc / linear resampling to 16kHz mono
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  const monoChannel = resampledBuffer.getChannelData(0);

  // Compute RMS energy envelope (10ms windows)
  const windowSize = Math.floor(targetSampleRate * 0.01); // 160 samples = 10ms
  const numWindows = Math.floor(monoChannel.length / windowSize);
  const rmsPeaks = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    let sumSquares = 0;
    const offset = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const val = monoChannel[offset + j];
      sumSquares += val * val;
    }
    rmsPeaks[i] = Math.sqrt(sumSquares / windowSize);
  }

  return {
    audioBuffer: monoChannel,
    sampleRate: targetSampleRate,
    durationSeconds: decodedBuffer.duration,
    rmsPeaks,
  };
}

/**
 * Splits long audio into 30-second windows with overlap for Whisper ASR.
 */
export function chunkAudio(
  audioData: Float32Array,
  sampleRate = 16000,
  windowSeconds = 30,
  overlapSeconds = 2
): AudioChunk[] {
  const windowSamples = windowSeconds * sampleRate;
  const overlapSamples = overlapSeconds * sampleRate;
  const stepSamples = windowSamples - overlapSamples;
  const chunks: AudioChunk[] = [];

  let offset = 0;
  let chunkIndex = 0;

  while (offset < audioData.length) {
    const end = Math.min(offset + windowSamples, audioData.length);
    const chunkData = audioData.slice(offset, end);
    const isLast = end >= audioData.length;

    chunks.push({
      chunkIndex,
      startSecond: offset / sampleRate,
      endSecond: end / sampleRate,
      data: chunkData,
      isLast,
    });

    if (isLast) break;
    offset += stepSamples;
    chunkIndex++;
  }

  return chunks;
}
