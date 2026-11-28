import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BlogPostReactions } from "@/components/blog/BlogPostReactions";

describe("BlogPostReactions UI Component", () => {
  const slug = "cdisc-crf-compiler-architecture";

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    global.fetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/blog/reactions")) {
          if (init?.method === "POST") {
            const body = JSON.parse((init.body as string) || "{}");
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  success: true,
                  reactionType: body.reactionType,
                  counts: {
                    insightful: 1,
                    mind_blowing: 0,
                    actionable: 0,
                    thorough: 0,
                  },
                  userReactions: [body.reactionType],
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                blogPostSlug: slug,
                counts: {
                  insightful: 4,
                  mind_blowing: 2,
                  actionable: 1,
                  thorough: 0,
                },
                userReactions: [],
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders reaction badges with fetched counts", async () => {
    render(<BlogPostReactions slug={slug} />);

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /blog post reactions/i })
      ).toBeDefined();
    });

    const insightfulBtn = screen.getByRole("button", {
      name: /React with Insightful/i,
    });
    expect(insightfulBtn).toBeDefined();
    expect(insightfulBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("4")).toBeDefined();
  });

  it("optimistically updates badge on click and commits reaction", async () => {
    render(<BlogPostReactions slug={slug} />);

    await waitFor(() => {
      expect(screen.getByText("4")).toBeDefined();
    });

    const insightfulBtn = screen.getByRole("button", {
      name: /React with Insightful/i,
    });
    fireEvent.click(insightfulBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/blog/reactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            blogPostSlug: slug,
            reactionType: "insightful",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Reaction recorded!/i)).toBeDefined();
    });
  });

  it("handles duplicate 429 response gracefully with accessible status message", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/blog/reactions")) {
          if (init?.method === "POST") {
            return Promise.resolve({
              ok: false,
              status: 429,
              json: () =>
                Promise.resolve({
                  error: "Duplicate reaction within the sliding window",
                  counts: {
                    insightful: 4,
                    mind_blowing: 2,
                    actionable: 1,
                    thorough: 0,
                  },
                  userReactions: ["insightful"],
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                blogPostSlug: slug,
                counts: {
                  insightful: 4,
                  mind_blowing: 2,
                  actionable: 1,
                  thorough: 0,
                },
                userReactions: [],
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    render(<BlogPostReactions slug={slug} />);

    await waitFor(() => {
      expect(screen.getByText("4")).toBeDefined();
    });

    const insightfulBtn = screen.getByRole("button", {
      name: /React with Insightful/i,
    });
    fireEvent.click(insightfulBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Duplicate reaction within the sliding window/i)
      ).toBeDefined();
    });
  });

  it("reports a network failure, reverts optimistic count, and keeps button enabled", async () => {
    const baseFetch = global.fetch;
    global.fetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? Promise.reject(new TypeError("Failed to fetch"))
          : baseFetch(url, init)
      );

    render(<BlogPostReactions slug={slug} />);
    await waitFor(() => {
      expect(screen.getByText("4")).toBeDefined();
    });

    const thoroughBtn = screen.getByRole("button", {
      name: /React with Thorough: 0 so far/i,
    });
    fireEvent.click(thoroughBtn);

    expect(
      await screen.findByText("Network error submitting reaction.")
    ).toBeDefined();

    const revertedBtn = screen.getByRole("button", {
      name: /React with Thorough: 0 so far/i,
    }) as HTMLButtonElement;
    expect(revertedBtn.disabled).toBe(false);
    expect(revertedBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it.each([
    {
      label: "HTTP 500 server failure",
      status: 500,
      payload: { error: "Internal server error processing blog post reaction" },
      expectedText: /Internal server error/i,
    },
    {
      label: "HTTP 503 storage outage",
      status: 503,
      payload: {
        error:
          "Reaction storage is temporarily unavailable. Your reaction remains queued for retry.",
      },
      expectedText: /Reaction storage is temporarily unavailable/i,
    },
    {
      label: "HTTP 429 rate-limit response omitting authoritative counts",
      status: 429,
      payload: {
        error: "Too many submission attempts. Please try again later.",
      },
      expectedText: /Too many submission attempts/i,
    },
    {
      label: "HTTP 200 payload with success: false",
      status: 200,
      payload: {
        success: false,
        error: "Reaction persistence failed",
      },
      expectedText: /Reaction persistence failed|Failed to submit reaction/i,
    },
  ])(
    "reverts optimistic count and unlocks the clicked button on $label",
    async ({ status, payload, expectedText }) => {
      const baseFetch = global.fetch;
      let shouldFail = true;
      global.fetch = vi
        .fn()
        .mockImplementation((url: string, init?: RequestInit) => {
          if (init?.method === "POST" && shouldFail) {
            return Promise.resolve({
              ok: status >= 200 && status < 300,
              status,
              json: () => Promise.resolve(payload),
            });
          }
          if (init?.method === "POST") {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  success: true,
                  durable: true,
                  reactionType: "thorough",
                  counts: {
                    insightful: 4,
                    mind_blowing: 2,
                    actionable: 1,
                    thorough: 1,
                  },
                  userReactions: ["thorough"],
                }),
            });
          }
          return baseFetch(url, init);
        });

      render(<BlogPostReactions slug={slug} />);
      await waitFor(() => {
        expect(screen.getByText("4")).toBeDefined();
      });

      const thoroughBtn = screen.getByRole("button", {
        name: /React with Thorough: 0 so far/i,
      });
      fireEvent.click(thoroughBtn);

      expect(await screen.findByText(expectedText)).toBeDefined();

      const revertedBtn = screen.getByRole("button", {
        name: /React with Thorough: 0 so far/i,
      }) as HTMLButtonElement;
      expect(revertedBtn.disabled).toBe(false);
      expect(revertedBtn.getAttribute("aria-pressed")).toBe("false");

      // Retry succeeds once the outage clears
      shouldFail = false;
      fireEvent.click(revertedBtn);
      expect(await screen.findByText(/Reaction recorded!/i)).toBeDefined();
      expect(
        screen
          .getByRole("button", { name: /React with Thorough: 1 so far/i })
          .getAttribute("aria-pressed")
      ).toBe("true");
    }
  );
});
