import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import axe from "axe-core";
import { NewsletterForm } from "@/components/NewsletterForm";

type FetchMock = ReturnType<typeof vi.fn>;

function submitEmail(value: string) {
  const input = screen.getByLabelText(/Email address/i);
  fireEvent.change(input, { target: { value } });
  // Submit the form directly: jsdom, like the browser's own constraint
  // validation, would otherwise decide whether the submit event fires.
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("NewsletterForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the invalid-email message and does not call the API (#1469)", async () => {
    // Regression: the email check set the message but never set status to
    // "error", and the alert only renders in the error state, so the message
    // never appeared and the form silently did nothing.
    render(<NewsletterForm />);

    submitEmail("reader@example");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Please enter a valid email address.");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: /Subscribe/i })
        .hasAttribute("disabled")
    ).toBe(false);
  });

  it("shows the invalid-email message for a blank address", async () => {
    render(<NewsletterForm />);

    submitEmail("   ");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Please enter a valid email address."
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clears the invalid-email message once a valid address is submitted", async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const handleSuccess = vi.fn();
    render(<NewsletterForm onSuccess={handleSuccess} />);

    submitEmail("not-an-email");
    await screen.findByRole("alert");

    submitEmail("  reader@example.com ");

    const banner = await screen.findByTestId("newsletter-success");
    expect(banner.textContent).toContain(
      "Almost there: check your inbox to confirm."
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(handleSuccess).toHaveBeenCalledTimes(1);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as FetchMock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/newsletter");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json"
    );
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ email: "reader@example.com", _gotcha: "" });
    expect(typeof body._clientTimestamp).toBe("number");
  });

  it("shows the server's error message on a 429 rate limit", async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many subscription attempts." }),
    });
    render(<NewsletterForm />);

    submitEmail("reader@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many subscription attempts."
    );
  });

  it("shows the server's error message on a 400 validation failure", async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Invalid request",
        details: [{ path: "email", message: "Invalid email" }],
      }),
    });
    render(<NewsletterForm />);

    submitEmail("reader@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid request"
    );
  });

  it("falls back to an HTTP status message when the error body is not JSON", async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    render(<NewsletterForm />);

    submitEmail("reader@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Subscription failed (HTTP 502). Please try again."
    );
  });

  it("shows the network message when the request cannot be sent", async () => {
    (global.fetch as FetchMock).mockRejectedValueOnce(
      new TypeError("Failed to fetch")
    );
    render(<NewsletterForm />);

    submitEmail("reader@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Network connection error. Please verify your connection and try again."
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /Subscribe/i })
          .hasAttribute("disabled")
      ).toBe(false)
    );
  });

  it("assigns unique IDs across concurrent instances so each label focuses its own input", async () => {
    const computed = window.getComputedStyle;
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => computed.call(window, element));

    try {
      const { container } = render(
        <div>
          <NewsletterForm variant="card" />
          <NewsletterForm variant="compact" />
        </div>
      );

      const emailInputs = screen.getAllByLabelText(
        "Email address"
      ) as HTMLInputElement[];
      expect(emailInputs).toHaveLength(2);
      expect(emailInputs[0].id).toBeTruthy();
      expect(emailInputs[1].id).toBeTruthy();
      expect(emailInputs[0].id).not.toBe(emailInputs[1].id);

      const honeypotInputs = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[name="_gotcha"]')
      );
      expect(honeypotInputs).toHaveLength(2);
      expect(honeypotInputs[0].id).toBeTruthy();
      expect(honeypotInputs[1].id).toBeTruthy();
      expect(honeypotInputs[0].id).not.toBe(honeypotInputs[1].id);

      expect(container.querySelector("#newsletter-email-input")).toBeNull();
      expect(container.querySelector("#newsletter-company-url")).toBeNull();

      const emailLabels = Array.from(
        container.querySelectorAll("label")
      ).filter((label) => label.textContent === "Email address");
      expect(emailLabels).toHaveLength(2);
      expect(emailLabels[0].htmlFor).toBe(emailInputs[0].id);
      expect(emailLabels[1].htmlFor).toBe(emailInputs[1].id);
      expect(emailLabels[0].control).toBe(emailInputs[0]);
      expect(emailLabels[1].control).toBe(emailInputs[1]);

      const activatedInputs: HTMLInputElement[] = [];
      emailInputs[0].addEventListener("click", () => {
        activatedInputs.push(emailInputs[0]);
        emailInputs[0].focus();
      });
      emailInputs[1].addEventListener("click", () => {
        activatedInputs.push(emailInputs[1]);
        emailInputs[1].focus();
      });

      emailLabels[0].click();
      expect(activatedInputs).toEqual([emailInputs[0]]);
      expect(document.activeElement).toBe(emailInputs[0]);

      emailLabels[1].click();
      expect(activatedInputs).toEqual([emailInputs[0], emailInputs[1]]);
      expect(document.activeElement).toBe(emailInputs[1]);

      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
