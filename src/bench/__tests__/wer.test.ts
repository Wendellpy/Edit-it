import { describe, it, expect } from "vitest";
import { computeWER, normalizeTranscript } from "../wer";

describe("WER calculation", () => {
  it("should normalize transcript by stripping punctuation and lowercasing", () => {
    const text = "Maine bas video upload kiya, template choose kiya!";
    const normalized = normalizeTranscript(text);
    expect(normalized).toEqual(["maine", "bas", "video", "upload", "kiya", "template", "choose", "kiya"]);
  });

  it("should calculate 0% WER on exact match", () => {
    const ref = "Maine bas video upload kiya";
    const hyp = "Maine bas video upload kiya";
    const result = computeWER(ref, hyp);
    expect(result.wer).toBe(0);
    expect(result.substitutions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.insertions).toBe(0);
  });

  it("should accurately count substitutions, insertions, and deletions", () => {
    const ref = "Maine bas video upload kiya";
    const hyp = "Maine bas photo upload kiya yaar"; // 'video' -> 'photo' (1 sub), 'yaar' (1 ins)
    const result = computeWER(ref, hyp);
    expect(result.substitutions).toBe(1);
    expect(result.insertions).toBe(1);
    expect(result.deletions).toBe(0);
    expect(result.wer).toBeCloseTo(2 / 5, 2);
  });
});
