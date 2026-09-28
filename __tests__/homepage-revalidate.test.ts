import { describe, it, expect } from "vitest";
import * as homepage from "@/app/(desktop)/page";

describe("Homepage Routing and ISR Configuration", () => {
  it("explicitly defines a revalidate interval of 3600 seconds", () => {
    expect(homepage.revalidate).toBe(3600);
  });
});
