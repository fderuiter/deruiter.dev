// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as homepage from "@/app/page";

describe("Homepage Routing and ISR Configuration", () => {
  it("explicitly defines a daily revalidate interval (#2971)", () => {
    expect(homepage.revalidate).toBe(86400);
  });
});
