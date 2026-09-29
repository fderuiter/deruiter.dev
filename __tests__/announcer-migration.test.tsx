import React, { StrictMode } from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import {
  A11yProvider,
  liveAnnouncer,
} from "@/components/providers/A11yProvider";
import { DebriefScreen } from "@/components/patrol/DebriefScreen";
import { ContactForm } from "@/components/ContactForm";
import { NewsletterForm } from "@/components/NewsletterForm";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { ProjectImageUploader } from "@/components/admin/ProjectImageUploader";
import { evaluateIncidentDebrief, type PatrolScenario } from "@/lib/patrol";

/**
 * Issue #1125: components that used to mount their own ad-hoc aria-live
 * regions now announce through the root A11yProvider. Each message must be
 * dispatched exactly once, at the politeness the old region used, and the
 * component must no longer render a live region of its own.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="mock-clerk-user-button" />,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const LIVE_REGION_SELECTOR = '[aria-live], [role="status"], [role="alert"]';

type AnnounceSpy = MockInstance<typeof liveAnnouncer.announce>;

function announcementsOf(spy: AnnounceSpy) {
  return spy.mock.calls.map(([message, priority]) => [message, priority]);
}

function expectNoLocalLiveRegion(root: Element) {
  expect(root.querySelectorAll(LIVE_REGION_SELECTOR)).toHaveLength(0);
}

describe("ad-hoc live regions migrated to useAnnouncer (#1125)", () => {
  let announceSpy: AnnounceSpy;

  beforeEach(() => {
    liveAnnouncer.clear();
    announceSpy = vi.spyOn(liveAnnouncer, "announce");
  });

  afterEach(() => {
    cleanup();
    announceSpy.mockRestore();
    liveAnnouncer.clear();
    vi.restoreAllMocks();
  });

  describe("DebriefScreen", () => {
    const scenario: PatrolScenario = {
      id: "wrist-injury-lower-park",
      title: "Lower Park FOOSH Wrist Injury",
      actions: [],
      debriefRules: [],
    };
    const result = evaluateIncidentDebrief("wrist-injury-lower-park", []);
    const expected = `Incident debrief complete. Overall rating: ${result.overallRating}.`;

    it("announces the overall rating once, politely, even under StrictMode", () => {
      const { container } = render(
        <StrictMode>
          <DebriefScreen
            scenario={scenario}
            result={result}
            onReturnToHub={vi.fn()}
          />
        </StrictMode>
      );

      expect(announcementsOf(announceSpy)).toEqual([[expected, "polite"]]);
      expectNoLocalLiveRegion(container);
    });

    it("does not re-announce on unrelated re-renders", () => {
      const { rerender } = render(
        <DebriefScreen
          scenario={scenario}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );
      rerender(
        <DebriefScreen
          scenario={scenario}
          result={{ ...result }}
          onReturnToHub={vi.fn()}
        />
      );

      expect(announceSpy).toHaveBeenCalledTimes(1);
    });

    it("reaches the root polite region rendered by A11yProvider", () => {
      render(
        <A11yProvider>
          <DebriefScreen
            scenario={scenario}
            result={result}
            onReturnToHub={vi.fn()}
          />
        </A11yProvider>
      );

      const polite = document.querySelector('[aria-live="polite"]');
      expect(polite?.textContent).toBe(expected);
      expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    });
  });

  describe("ContactForm", () => {
    it("announces a successful send once, politely, and keeps the visible card", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      render(<ContactForm />);

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Hello there" },
      });
      fireEvent.change(screen.getByLabelText(/^Message/i), {
        target: { value: "A message long enough to pass." },
      });
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      const card = await screen.findByTestId("contact-form-success");
      expect(card.textContent).toContain("Message sent!");
      expectNoLocalLiveRegion(card);
      expect(announcementsOf(announceSpy)).toEqual([
        [
          "Message sent! Thanks for reaching out, Ada. Your message is in my inbox. I’ll get back to you by email.",
          "polite",
        ],
      ]);
    });
  });

  describe("NewsletterForm", () => {
    it("announces the confirmation prompt once, politely, and keeps the visible banner", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      const { container } = render(<NewsletterForm />);

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: "reader@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));

      const banner = await screen.findByTestId("newsletter-success");
      expect(banner.textContent).toContain(
        "Almost there: check your inbox to confirm."
      );
      expectNoLocalLiveRegion(container);
      expect(announcementsOf(announceSpy)).toEqual([
        ["Almost there: check your inbox to confirm.", "polite"],
      ]);
    });
  });

  describe("AdminAccessDenied", () => {
    it("announces each successful copy once, politely, without a local live region", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
      const { container } = render(
        <AdminAccessDenied userId="user_1" primaryEmail="author@example.com" />
      );
      expectNoLocalLiveRegion(container);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: "Copy email configuration snippet",
          })
        );
      });

      expect(announcementsOf(announceSpy)).toEqual([
        ["Configuration snippet copied to clipboard", "polite"],
      ]);
    });
  });

  describe("ProjectImageUploader", () => {
    beforeEach(() => {
      global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/preview");
      global.URL.revokeObjectURL = vi.fn();
    });

    function selectValidFile() {
      fireEvent.change(screen.getByTestId("project-image-input"), {
        target: {
          files: [new File(["img"], "hero.png", { type: "image/png" })],
        },
      });
    }

    it("announces a validation failure once, assertively", async () => {
      const { container } = render(<ProjectImageUploader />);
      fireEvent.change(screen.getByTestId("project-image-input"), {
        target: {
          files: [new File(["pdf"], "doc.pdf", { type: "application/pdf" })],
        },
      });

      const banner = await screen.findByTestId("project-image-upload-error");
      expect(banner.textContent).toMatch(/Invalid file format/);
      expectNoLocalLiveRegion(container);
      expect(announcementsOf(announceSpy)).toEqual([
        [
          "Upload Failed. Invalid file format. Allowed types: PNG, JPEG, WebP, GIF, SVG, and AVIF.",
          "assertive",
        ],
      ]);
    });

    it("announces upload progress then success, each once and politely", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { hero_image_url: "/api/media/new.png" } }),
      });
      const { container } = render(<ProjectImageUploader />);
      selectValidFile();
      fireEvent.click(
        screen.getByRole("button", { name: /Confirm & Upload/i })
      );

      await screen.findByTestId("project-image-upload-success");
      expectNoLocalLiveRegion(container);
      expect(announcementsOf(announceSpy)).toEqual([
        ["Sending multipart image buffer to server...", "polite"],
        ["Image uploaded & persisted successfully!", "polite"],
      ]);
    });

    it("announces a server failure once, assertively", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Server processing error" }),
      });
      render(<ProjectImageUploader />);
      selectValidFile();
      fireEvent.click(
        screen.getByRole("button", { name: /Confirm & Upload/i })
      );

      await screen.findByTestId("project-image-upload-error");
      expect(announcementsOf(announceSpy)).toEqual([
        ["Sending multipart image buffer to server...", "polite"],
        ["Upload Failed. Server processing error", "assertive"],
      ]);
    });

    it("announces a cancellation once even though the aborted fetch also settles", async () => {
      global.fetch = vi.fn().mockImplementation(
        (_url: string, options?: RequestInit) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          })
      );
      render(<ProjectImageUploader />);
      selectValidFile();
      fireEvent.click(
        screen.getByRole("button", { name: /Confirm & Upload/i })
      );
      fireEvent.click(
        await screen.findByRole("button", { name: /Cancel Upload/i })
      );

      await screen.findByTestId("project-image-upload-cancelled");
      // Let the rejected fetch's catch block run before counting.
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      await act(async () => {
        await Promise.resolve();
      });
      expect(announcementsOf(announceSpy)).toEqual([
        ["Sending multipart image buffer to server...", "polite"],
        ["Upload cancelled. Prior asset preserved.", "polite"],
      ]);
    });
  });
});
