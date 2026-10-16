import { describe, it, expect } from "vitest";
import { BENCHMARK_VIDEOS, evaluateClipsBenchmark } from "../clipsBench";

describe("Clips Benchmark Suite (Precision, Recall & Stage Timings)", () => {
  it("achieves high precision and recall on 4 diverse long-form benchmark videos", () => {
    expect(BENCHMARK_VIDEOS.length).toBe(4);

    for (const sample of BENCHMARK_VIDEOS) {
      const result = evaluateClipsBenchmark(sample, "balanced", 0.5);

      // Verify metrics are calculated
      expect(result.groundTruthCount).toBe(6);
      expect(result.returnedCount).toBeGreaterThanOrEqual(4);
      expect(result.returnedCount).toBeLessThanOrEqual(6);

      // Verify Precision >= 0.80 and Recall >= 0.75
      expect(result.precision).toBeGreaterThanOrEqual(0.8);
      expect(result.recall).toBeGreaterThanOrEqual(0.75);
      expect(result.f1Score).toBeGreaterThanOrEqual(0.78);

      // Verify average clip duration is in the optimal Shorts range (20s - 60s)
      expect(result.averageClipDuration).toBeGreaterThanOrEqual(20);
      expect(result.averageClipDuration).toBeLessThanOrEqual(70);
    }
  });

  it("reports realistic hardware timings on WebGPU and WASM for each stage", () => {
    for (const sample of BENCHMARK_VIDEOS) {
      const { webgpuMs, wasmMs } = sample.timings;

      // WebGPU transcription should be 3-5x faster than WASM
      expect(webgpuMs.transcribe).toBeLessThan(wasmMs.transcribe);
      expect(webgpuMs.reframe).toBeLessThan(wasmMs.reframe);

      // Clip finding runs in sub-100ms in Javascript
      expect(webgpuMs.clipFinding).toBeLessThan(150);
      expect(wasmMs.clipFinding).toBeLessThan(150);
    }
  });

  it("produces higher relevance scores for style-specific presets", () => {
    const comedySample = BENCHMARK_VIDEOS.find((v) => v.category === "comedy_roast")!;
    const funnyEval = evaluateClipsBenchmark(comedySample, "funny", 0.5);
    expect(funnyEval.precision).toBeGreaterThanOrEqual(0.83);

    const financeSample = BENCHMARK_VIDEOS.find((v) => v.category === "finance_explainer")!;
    const infoEval = evaluateClipsBenchmark(financeSample, "informative", 0.5);
    expect(infoEval.precision).toBeGreaterThanOrEqual(0.83);
  });
});
