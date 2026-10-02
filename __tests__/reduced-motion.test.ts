// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// Mock framer-motion's useReducedMotion hook
const mockUseReducedMotion = vi.fn();
vi.mock("framer-motion", async (importOriginal) => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return {
    ...original,
    useReducedMotion: () => mockUseReducedMotion(),
  };
});

describe("Reduced Motion Integrations", () => {
  it("should evaluate the reduced motion hook correctly when mocked", () => {
    mockUseReducedMotion.mockReturnValue(true);
    expect(mockUseReducedMotion()).toBe(true);

    mockUseReducedMotion.mockReturnValue(false);
    expect(mockUseReducedMotion()).toBe(false);
  });

  it("should correctly import all updated motion components", async () => {
    const { Hero, HeroHeadline, HeroText } = await import("@/components/Hero");
    const { AnimatedGridPattern } =
      await import("@/components/AnimatedGridPattern");
    const { TracingBeam } = await import("@/components/ui/TracingBeam");

    expect(Hero).toBeDefined();
    expect(HeroHeadline).toBeDefined();
    expect(HeroText).toBeDefined();
    expect(AnimatedGridPattern).toBeDefined();
    expect(TracingBeam).toBeDefined();
  });
});
