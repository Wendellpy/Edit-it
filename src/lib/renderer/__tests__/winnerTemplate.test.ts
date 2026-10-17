import { describe, it, expect, vi } from "vitest";
import { getTemplateById, CAPTION_PRESETS } from "../../templates";
import {
  decomposeWinnerCue,
  renderWinnerCaptions,
  renderCaptionFrame,
  WINNER_MINOR_WORDS,
} from "../captionRenderer";
import { generateAss } from "../../export/subtitleFormatters";
import type { WordToken } from "../../timestampRefiner";

const makeToken = (id: string, text: string, start: number, end: number, isKeyword?: boolean): WordToken => ({
  id,
  text,
  start,
  end,
  confidence: 0.99,
  isKeyword,
});

describe("Winner Caption Style Specification & Rendering Suite", () => {
  it("MUST define the 'winner' preset replacing lime sticker box with exact visual specs from reference screen recording", () => {
    const tmpl = getTemplateById("winner");
    expect(tmpl, "Winner template must exist in CAPTION_PRESETS").toBeDefined();
    expect(tmpl.id).toBe("winner");
    expect(tmpl.name).toBe("Winner");
    expect(tmpl.vibe).toBe("neon");
    expect(tmpl.badge).toBe("EDITORIAL");

    // Typographic hierarchy: Huge Montserrat 900 bold punch + Cursive handwriting script
    expect(tmpl.typography.primaryFont).toContain("Montserrat");
    expect(tmpl.typography.secondaryFont).toContain("Birthstone Bounce");
    expect(tmpl.typography.primaryWeight).toBe("900");
    expect(tmpl.typography.textTransform).toBe("lowercase");
    expect(tmpl.typography.fontSizeBasePercent).toBeGreaterThanOrEqual(0.08);

    // Color palette: Crisp white #FFFFFF + Vibrant scarlet red #FF0022 accent
    expect(tmpl.colors.primaryText).toBe("#FFFFFF");
    expect(tmpl.colors.secondaryText).toBe("#FF0022");
    expect(tmpl.colors.activeWordText).toBe("#FF0022");

    // Layout: Safe vertical centering with 3D depth support
    expect(tmpl.layout.yPositionPercent).toBe(0.50);
    expect(tmpl.layout.behindSubjectDepth).toBe(true);
  });

  it("MUST support legacy 'neon_sticker_lime' alias redirecting to 'winner'", () => {
    const aliased = getTemplateById("neon_sticker_lime");
    expect(aliased.id).toBe("winner");
    expect(aliased.name).toBe("Winner");
  });

  describe("Winner Cue Decomposition (deconstructs exact real video frames)", () => {
    it("deconstructs Frame 2: 'let me try it' -> anchor: let, side: me, script: try, bottom: it", () => {
      const tokens: WordToken[] = [
        makeToken("1", "let", 0.1, 0.5),
        makeToken("2", "me", 0.5, 0.8),
        makeToken("3", "try", 0.8, 1.3),
        makeToken("4", "it", 1.3, 1.6),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.anchorToken.text).toBe("let");
      expect(comp.scriptToken?.text).toBe("try");
      expect(comp.sideTokens.map((t) => t.text)).toEqual(["me"]);
      expect(comp.bottomTokens.map((t) => t.text)).toEqual(["it"]);
    });

    it("deconstructs Frame 8: 'the only consequence' -> top: the, anchor: only, script: consequence", () => {
      const tokens: WordToken[] = [
        makeToken("1", "the", 0.1, 0.3),
        makeToken("2", "only", 0.3, 0.8),
        makeToken("3", "consequence", 0.8, 1.5),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.topTokens.map((t) => t.text)).toEqual(["the"]);
      expect(comp.anchorToken.text).toBe("only");
      expect(comp.scriptToken?.text).toBe("consequence");
      expect(comp.bottomTokens).toHaveLength(0);
    });

    it("deconstructs Frame 14: 'the only consequence is failure' -> top: the, anchor: only, script: consequence, bottom: is failure", () => {
      const tokens: WordToken[] = [
        makeToken("1", "the", 0.1, 0.3),
        makeToken("2", "only", 0.3, 0.8),
        makeToken("3", "consequence", 0.8, 1.5),
        makeToken("4", "is", 1.5, 1.8),
        makeToken("5", "failure", 1.8, 2.4),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.topTokens.map((t) => t.text)).toEqual(["the"]);
      expect(comp.anchorToken.text).toBe("only");
      expect(comp.scriptToken?.text).toBe("consequence");
      expect(comp.bottomTokens.map((t) => t.text)).toEqual(["is", "failure"]);
    });

    it("deconstructs Video 2 Frame 7: 'not trying is failing' -> top: not, anchor: trying, bottom: is, script: failing", () => {
      const tokens: WordToken[] = [
        makeToken("1", "not", 0.1, 0.3),
        makeToken("2", "trying", 0.3, 0.9),
        makeToken("3", "is", 0.9, 1.2),
        makeToken("4", "failing", 1.2, 1.8),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.topTokens.map((t) => t.text)).toEqual(["not"]);
      expect(comp.anchorToken.text).toBe("trying");
      expect(comp.scriptToken?.text).toBe("failing");
      expect(comp.bottomTokens.map((t) => t.text)).toEqual(["is"]);
    });

    it("deconstructs Video 2 Frame 10: 'I wanna make that very clear' -> top: I wanna, anchor: make, script: very, bottom: that clear", () => {
      const tokens: WordToken[] = [
        makeToken("1", "I", 0.1, 0.2),
        makeToken("2", "wanna", 0.2, 0.5),
        makeToken("3", "make", 0.5, 0.9),
        makeToken("4", "that", 0.9, 1.2),
        makeToken("5", "very", 1.2, 1.6),
        makeToken("6", "clear", 1.6, 2.0),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.topTokens.map((t) => t.text)).toEqual(["I", "wanna"]);
      expect(comp.anchorToken.text).toBe("make");
      expect(comp.scriptToken?.text).toBe("very");
      expect(comp.bottomTokens.map((t) => t.text)).toEqual(["that", "clear"]);
    });

    it("respects explicit keyword marking if provided", () => {
      const tokens: WordToken[] = [
        makeToken("1", "real", 0.1, 0.5),
        makeToken("2", "champ", 0.5, 1.0, true),
      ];
      const comp = decomposeWinnerCue(tokens);
      expect(comp.anchorToken.text).toBe("real");
      expect(comp.scriptToken?.text).toBe("champ");
    });
  });

  describe("Canvas Rendering & Layering for Winner", () => {
    function createMockCtx() {
      const log: string[] = [];
      const fontsSet: string[] = [];
      const fillStyles: string[] = [];
      const filledTexts: string[] = [];

      return {
        log,
        fontsSet,
        fillStyles,
        filledTexts,
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn((text: string, x: number, y: number) => {
          filledTexts.push(text);
          log.push(`fillText(${text}, ${x}, ${y})`);
        }),
        strokeText: vi.fn((text: string, x: number, y: number) => {
          log.push(`strokeText(${text}, ${x}, ${y})`);
        }),
        measureText: vi.fn((text: string) => ({
          width: text.length * 20,
          actualBoundingBoxAscent: 15,
          actualBoundingBoxDescent: 5,
        })),
        drawImage: vi.fn(),
        getLog: () => log,
        get font() {
          return fontsSet[fontsSet.length - 1] || "";
        },
        set font(f: string) {
          fontsSet.push(f);
        },
        get fillStyle() {
          return fillStyles[fillStyles.length - 1] || "";
        },
        set fillStyle(c: string) {
          fillStyles.push(c);
        },
        strokeStyle: "",
        lineWidth: 1,
        lineJoin: "round",
        shadowColor: "",
        shadowBlur: 0,
        shadowOffsetY: 0,
        globalAlpha: 1.0,
        globalCompositeOperation: "source-over",
        textAlign: "left",
        textBaseline: "middle",
      };
    }

    it("MUST render dual-font hierarchy: 900 Montserrat anchor + Birthstone Bounce cursive script overlay", () => {
      const ctx = createMockCtx();
      const tmpl = getTemplateById("winner");
      const tokens: WordToken[] = [
        makeToken("1", "the", 0.1, 0.4),
        makeToken("2", "only", 0.4, 1.0),
        makeToken("3", "consequence", 1.0, 1.8),
      ];

      renderCaptionFrame({
        ctx: ctx as any,
        canvasWidth: 1080,
        canvasHeight: 1920,
        currentTime: 1.2,
        tokens,
        template: tmpl,
      });

      const hasMontserratBold = ctx.fontsSet.some(
        (f) => f.includes("900") && f.includes("Montserrat")
      );
      const hasScript = ctx.fontsSet.some(
        (f) => f.includes("Birthstone Bounce") || f.includes("Alex Brush") || f.includes("Great Vibes")
      );

      expect(hasMontserratBold, "Winner must use Montserrat 900 for punch anchor word").toBe(true);
      expect(hasScript, "Winner must use Birthstone Bounce / cursive script for accent calligraphy").toBe(true);

      expect(ctx.filledTexts).toContain("only");
      expect(ctx.filledTexts).toContain("Consequence");
      expect(ctx.fillStyles).toContain("#FF0022");
    });

    it("MUST support 3D Behind-the-Subject Compositing in sandwich depth mode", () => {
      const ctx = createMockCtx();
      const tmpl = getTemplateById("winner");
      const tokens: WordToken[] = [
        makeToken("1", "let", 0.1, 0.6),
        makeToken("2", "try", 0.6, 1.2),
      ];

      const dummyVideoSource = {} as any;
      const dummyMask = new Uint8Array(100 * 100).fill(255);

      renderCaptionFrame({
        ctx: ctx as any,
        canvasWidth: 1080,
        canvasHeight: 1920,
        currentTime: 0.8,
        tokens,
        template: tmpl,
        videoSource: dummyVideoSource,
        segmentationMask: dummyMask,
        maskWidth: 100,
        maskHeight: 100,
        layerOrder: "sandwich",
      });

      const log = ctx.getLog();
      const hasCutoutCall = log.some((l) => l.includes("drawSubjectCutout"));
      expect(hasCutoutCall, "Winner must composite subject cutout in 3D depth mode").toBe(true);
    });
  });

  describe("ASS Subtitle Export Formatting for Winner", () => {
    it("MUST export ASS subtitles with cursive script font tag for keyword/script words", () => {
      const tmpl = getTemplateById("winner");
      const tokens: WordToken[] = [
        makeToken("1", "the", 0.1, 0.4),
        makeToken("2", "only", 0.4, 1.0),
        makeToken("3", "consequence", 1.0, 1.8, true),
      ];

      const ass = generateAss(tokens, tmpl, 1080, 1920, 3);
      expect(ass).toContain("[Script Info]");
      expect(ass).toContain("Montserrat");
      expect(ass).toContain("\\fnBirthstone Bounce");
      expect(ass).toContain("&H002200FF&"); // ASS representation of #FF0022
    });
  });
});
