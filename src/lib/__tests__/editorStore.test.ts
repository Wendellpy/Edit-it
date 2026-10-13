import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "../editorStore";

describe("editorStore - Zustand Command Pattern & Token Editing", () => {
  beforeEach(() => {
    // Reset to initial state
    const initialTokens = [
      { id: "1", text: "Maine", romanText: "Maine", devanagariText: "मैंने", start: 0.1, end: 0.5, confidence: 0.98, isCodeMixedEnglish: false },
      { id: "2", text: "video", romanText: "video", devanagariText: "video", start: 0.6, end: 1.0, confidence: 0.99, isCodeMixedEnglish: true },
      { id: "3", text: "upload", romanText: "upload", devanagariText: "upload", start: 1.1, end: 1.5, confidence: 0.97, isCodeMixedEnglish: true },
    ];
    useEditorStore.setState({
      tokens: initialTokens,
      history: [{ tokens: initialTokens, templateId: "behind_you_white" }],
      historyIndex: 0,
    });
  });

  it("should update word text and support undo", () => {
    const store = useEditorStore.getState();
    expect(store.tokens[0].text).toBe("Maine");

    store.updateWordText("1", "Humne");
    expect(useEditorStore.getState().tokens[0].text).toBe("Humne");

    // Test Undo
    expect(useEditorStore.getState().canUndo()).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().tokens[0].text).toBe("Maine");

    // Test Redo
    expect(useEditorStore.getState().canRedo()).toBe(true);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().tokens[0].text).toBe("Humne");
  });

  it("should split a word into two tokens", () => {
    const store = useEditorStore.getState();
    store.splitWord("1", 0.5);

    const updated = useEditorStore.getState().tokens;
    expect(updated.length).toBe(4);
    expect(updated[0].id).toBe("1_1");
    expect(updated[1].id).toBe("1_2");
    expect(updated[0].end).toBe(updated[1].start);
  });

  it("should merge two adjacent words", () => {
    const store = useEditorStore.getState();
    store.mergeWords("2", "3");

    const updated = useEditorStore.getState().tokens;
    expect(updated.length).toBe(2);
    expect(updated[1].text).toBe("video upload");
    expect(updated[1].start).toBe(0.6);
    expect(updated[1].end).toBe(1.5);
  });

  it("should nudge word timings", () => {
    const store = useEditorStore.getState();
    store.nudgeWord("2", 0.1); // Shift 0.1s later

    const updated = useEditorStore.getState().tokens;
    expect(updated[1].start).toBe(0.7);
    expect(updated[1].end).toBe(1.1);
  });

  it("should export and re-import project JSON", () => {
    const store = useEditorStore.getState();
    const jsonStr = store.exportProjectJson();

    expect(typeof jsonStr).toBe("string");
    expect(jsonStr).toContain("BolSub Studio");

    const success = store.importProjectJson(jsonStr);
    expect(success).toBe(true);
  });
});
