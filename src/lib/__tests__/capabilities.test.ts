import { describe, it, expect } from "vitest";
import { detectSystemCapabilities } from "../capabilities";

describe("detectSystemCapabilities", () => {
  it("should return valid capability properties in test environment", async () => {
    const caps = await detectSystemCapabilities();
    expect(caps).toBeDefined();
    expect(typeof caps.webGpu).toBe("boolean");
    expect(typeof caps.webCodecs).toBe("boolean");
    expect(typeof caps.sharedArrayBuffer).toBe("boolean");
    expect(typeof caps.deviceMemoryGb).toBe("number");
    expect(typeof caps.cpuCores).toBe("number");
    expect(["fast", "balanced", "best"]).toContain(caps.recommendedTier);
    expect(caps.tierReason.length).toBeGreaterThan(0);
  });
});
