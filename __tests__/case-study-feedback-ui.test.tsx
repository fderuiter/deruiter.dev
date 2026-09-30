import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaseStudyFeedbackSection,
  PREDEFINED_TAKEAWAYS,
} from "@/components/CaseStudyFeedbackSection";

describe("CaseStudyFeedbackSection UI Component", () => {
  const slug = "imednet-python-sdk";

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    global.fetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/case-studies/reactions")) {
          if (init?.method === "POST") {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  success: true,
                  reactionType: "insightful",
                  counts: {
                    insightful: 1,
                    mind_blowing: 0,
                    actionable: 0,
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
                caseStudySlug: slug,
                counts: {
                  insightful: 0,
                  mind_blowing: 0,
                  actionable: 0,
                  thorough: 0,
                },
                userReactions: [],
              }),
          });
        }

        if (url.includes("/api/case-studies/feedback")) {
          if (init?.method === "POST") {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () =>
                Promise.resolve({
                  success: true,
                  message:
                    "Thank you! Your learning feedback has been recorded.",
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                success: true,
                hasSubmitted: false,
                feedback: [],
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders reaction options and predefined takeaways", async () => {
    render(<CaseStudyFeedbackSection slug={slug} />);

    expect(
      screen.getByText("Learning Feedback & Article Reactions")
    ).toBeDefined();
    expect(screen.getByText("Insightful")).toBeDefined();
    expect(screen.getByText("Mind-Blowing")).toBeDefined();
    expect(screen.getByText("Actionable")).toBeDefined();
    expect(screen.getByText("Thorough")).toBeDefined();

    for (const takeaway of PREDEFINED_TAKEAWAYS) {
      expect(screen.getByText(takeaway, { exact: false })).toBeDefined();
    }
  });

  it("increments reaction count and updates button state on click", async () => {
    render(<CaseStudyFeedbackSection slug={slug} />);

    const insightfulBtn = screen.getByRole("button", {
      name: /React with Insightful/i,
    });
    fireEvent.click(insightfulBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/case-studies/reactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            caseStudySlug: slug,
            reactionType: "insightful",
          }),
        })
      );
    });
  });

  it("displays validation error when submitting without selecting takeaways", async () => {
    render(<CaseStudyFeedbackSection slug={slug} />);

    const textarea = screen.getByPlaceholderText(/Describe key insights/i);
    fireEvent.change(textarea, {
      target: { value: "Valid constructive comments text here" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Submit Learning Feedback/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Please select at least one learning takeaway/i)
      ).toBeDefined();
    });
  });

  it("submits feedback successfully and displays success message", async () => {
    render(<CaseStudyFeedbackSection slug={slug} />);

    // Select takeaway
    const takeawayBtn = screen.getByText(PREDEFINED_TAKEAWAYS[0], {
      exact: false,
    });
    fireEvent.click(takeawayBtn);

    // Enter comment
    const textarea = screen.getByPlaceholderText(/Describe key insights/i);
    fireEvent.change(textarea, {
      target: {
        value:
          "Excellent post-mortem insights on rate limiting and database failover.",
      },
    });

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /Submit Learning Feedback/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Feedback Submitted!")).toBeDefined();
      expect(
        screen.getByText("Thank you! Your learning feedback has been recorded.")
      ).toBeDefined();
    });
  });

  it("shows the first validation detail from a 4xx error envelope", async () => {
    const baseFetch = global.fetch;
    global.fetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) =>
        url === "/api/case-studies/feedback" && init?.method === "POST"
          ? Promise.resolve(
              new Response(
                JSON.stringify({
                  error: "Validation failed",
                  details: [
                    { path: "comments", message: "Comments are too short." },
                  ],
                }),
                { status: 400 }
              )
            )
          : baseFetch(url, init)
      );

    render(<CaseStudyFeedbackSection slug={slug} />);
    fireEvent.click(
      screen.getByText(PREDEFINED_TAKEAWAYS[0], { exact: false })
    );
    fireEvent.change(screen.getByPlaceholderText(/Describe key insights/i), {
      target: { value: "Excellent post-mortem insights on failover." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Submit Learning Feedback/i })
    );

    expect(await screen.findByText("Comments are too short.")).toBeDefined();
    expect(screen.queryByText("Feedback Submitted!")).toBeNull();
  });
});
