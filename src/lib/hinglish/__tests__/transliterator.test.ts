import { describe, it, expect } from "vitest";
import {
  transliterateDevanagariWord,
  isDevanagariWord,
} from "../transliterator";

describe("transliterator - Devanagari to Roman Hinglish", () => {
  it("should accurately detect Devanagari words vs Latin script", () => {
    expect(isDevanagariWord("नमस्ते")).toBe(true);
    expect(isDevanagariWord("किया")).toBe(true);
    expect(isDevanagariWord("video")).toBe(false);
    expect(isDevanagariWord("upload")).toBe(false);
  });

  it("should correctly transliterate words with terminal schwa-deletion", () => {
    // In Hindi, word-final schwa /a/ is deleted:
    expect(transliterateDevanagariWord("कमल")).toBe("kamal"); // not kamala
    expect(transliterateDevanagariWord("घर")).toBe("ghar");   // not ghara
    expect(transliterateDevanagariWord("मतलब")).toBe("matlab");
    expect(transliterateDevanagariWord("बस")).toBe("bas");
  });

  it("should preserve matras properly", () => {
    expect(transliterateDevanagariWord("किया")).toBe("kiya");
    expect(transliterateDevanagariWord("करो")).toBe("karo");
    expect(transliterateDevanagariWord("शुरू")).toBe("shuru");
    expect(transliterateDevanagariWord("नमस्ते")).toBe("namaste");
  });

  it("should preserve attached punctuation", () => {
    expect(transliterateDevanagariWord("किया,")).toBe("kiya,");
    expect(transliterateDevanagariWord("है!")).toBe("hai!");
  });

  it("should correctly handle a diverse table of Indian words with algorithmic rules", () => {
    const testCases: Array<[string, string]> = [
      ["कल", "kal"],
      ["दिन", "din"],
      ["समय", "samay"],
      ["नया", "naya"],
      ["सच्चा", "sachcha"],
      ["मस्त", "mast"],
      ["पुल", "pul"],
      ["सफ़र", "safar"],
      ["मन", "man"],
      ["तन", "tan"],
      ["धन", "dhan"],
    ];

    for (const [input, expected] of testCases) {
      const output = transliterateDevanagariWord(input);
      expect(output.toLowerCase()).toBe(expected.toLowerCase());
    }
  });
});
