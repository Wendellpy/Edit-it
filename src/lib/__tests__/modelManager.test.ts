import { describe, it, expect, beforeEach } from "vitest";
import { LocalModelManager, MODEL_TIERS } from "../modelManager";

describe("LocalModelManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should list all three tiers with proper sizes and details", () => {
    const tiers = LocalModelManager.getTiers();
    expect(tiers).toHaveLength(3);

    const ids = tiers.map((t) => t.id);
    expect(ids).toEqual(["fast", "balanced", "best"]);

    expect(MODEL_TIERS.fast.sizeMb).toBe(39);
    expect(MODEL_TIERS.balanced.sizeMb).toBe(145);
    expect(MODEL_TIERS.best.sizeMb).toBe(465);
  });

  it("should mark and check cached models properly in localStorage", async () => {
    expect(await LocalModelManager.isModelCached("balanced")).toBe(false);

    await LocalModelManager.markModelCached("balanced");
    expect(await LocalModelManager.isModelCached("balanced")).toBe(true);

    const cached = await LocalModelManager.getCachedModels();
    expect(cached).toContain("balanced");

    await LocalModelManager.deleteModel("balanced");
    expect(await LocalModelManager.isModelCached("balanced")).toBe(false);
  });
});
