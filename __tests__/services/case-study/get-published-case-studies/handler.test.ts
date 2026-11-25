// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  GetPublishedCaseStudiesHandler,
  type GetPublishedCaseStudiesDeps,
} from "@/lib/services";

describe("GetPublishedCaseStudiesHandler (Logic Test)", () => {
  it("returns lightweight search summaries merged with static fallbacks", async () => {
    const deps = fromPartial<GetPublishedCaseStudiesDeps>({
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findMany: async () => [
            {
              id: "search-1",
              slug: "search-study",
              title: "Search Study",
              primary_language: "Go",
              tags: "go,search",
            },
          ],
        },
      },
    });

    const handler = new GetPublishedCaseStudiesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((s) => s.slug === "search-study")).toBe(true);
    }
  });

  it("returns INVALID_INPUT for invalid input payload", async () => {
    const handler = new GetPublishedCaseStudiesHandler();
    const result = await handler.execute(fromAny("invalid"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
