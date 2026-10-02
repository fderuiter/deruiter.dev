import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { ContactForm, CONTACT_FORM_DRAFT_KEY } from "@/components/ContactForm";
import { safeStorage } from "@/lib/safe-storage";

describe("ContactForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    safeStorage.clear();
  });

  afterEach(() => {
    cleanup();
    safeStorage.clear();
  });

  it("should render all form controls and honeypot trap correctly", () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/Your Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Email Address/i)).toBeDefined();
    expect(screen.getByLabelText(/Subject/i)).toBeDefined();
    expect(screen.getByLabelText(/Message/i)).toBeDefined();
    expect(screen.getByLabelText(/Leave this blank/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Send Message/i })).toBeDefined();
  });

  it("should prevent submission and display inline errors if required fields are missing", async () => {
    render(<ContactForm />);

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Please enter your name/i)).toBeDefined();
    expect(
      screen.getByText(/Please provide a valid email address/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Subject must be at least 3 characters/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Message must be at least 10 characters/i)
    ).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid field when submission fails validation (#583)", async () => {
    render(<ContactForm />);

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    // Regression: previously focus silently stayed on the submit button
    // (or wherever it was) after a failed validation, so a keyboard/screen
    // reader user got no indication where to fix the error.
    const nameInput = await screen.findByLabelText(/Your Name/i);
    expect(document.activeElement).toBe(nameInput);
  });

  it("moves focus to the first invalid field in DOM order, not just the first field", async () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Ada Lovelace" },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    const emailInput = await screen.findByLabelText(/Email Address/i);
    expect(document.activeElement).toBe(emailInput);
  });

  it("should submit payload and display success confirmation upon 200 response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: "Received",
        messageId: "msg_123",
      }),
    });

    const handleSuccess = vi.fn();
    render(<ContactForm onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Formal Verification Inquiry" },
    });
    fireEvent.change(screen.getByLabelText(/Message/i), {
      target: { value: "I would like to discuss building proof engines." },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Message sent!/i)).toBeDefined();
    });

    expect(handleSuccess).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({
        method: "POST",
      })
    );

    // Test Reset
    const resetBtn = screen.getByRole("button", {
      name: /Send Another Message/i,
    });
    fireEvent.click(resetBtn);

    expect(screen.getByLabelText(/Your Name/i)).toBeDefined();
  });

  it("should display transmission error banner when backend returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many contact submission attempts." }),
    });

    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Formal Verification Inquiry" },
    });
    fireEvent.change(screen.getByLabelText(/Message/i), {
      target: { value: "I would like to discuss building proof engines." },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Too many contact submission attempts/i)
    ).toBeDefined();
  });

  describe("server responses (#1469)", () => {
    const fillValidForm = () => {
      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "  Ada Lovelace " },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com " },
      });
      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Formal Verification Inquiry" },
      });
      fireEvent.change(screen.getByLabelText(/Message/i), {
        target: { value: "I would like to discuss building proof engines." },
      });
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));
    };

    it("posts trimmed JSON to /api/contact", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      render(<ContactForm initialIntent="consulting" />);
      fillValidForm();

      await screen.findByTestId("contact-form-success");
      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toBe("/api/contact");
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("Content-Type")).toBe(
        "application/json"
      );
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        name: "Ada Lovelace",
        email: "ada@example.com",
        intent: "consulting",
        subject: "Formal Verification Inquiry",
        message: "I would like to discuss building proof engines.",
        _gotcha: "",
      });
      expect(typeof body._clientTimestamp).toBe("number");
    });

    it("shows the server's error message on a 400 validation failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Invalid request",
          details: [{ path: "email", message: "Invalid email" }],
        }),
      });
      render(<ContactForm />);
      fillValidForm();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Couldn’t send your message:");
      expect(alert.textContent).toContain("Invalid request");
    });

    it("falls back to an HTTP status message when the error body is not JSON", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      });
      render(<ContactForm />);
      fillValidForm();

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Unable to send message (HTTP 502). Please try again later or email directly."
      );
    });

    it("shows the network message and re-enables the form when the request cannot be sent", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TypeError("Failed to fetch")
      );
      render(<ContactForm />);
      fillValidForm();

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Network connection error. Please check your connection or email directly to fpderuiter@gmail.com."
      );
      expect(
        screen
          .getByRole("button", { name: /Send Message/i })
          .hasAttribute("disabled")
      ).toBe(false);
    });
  });

  describe("persistent draft state", () => {
    it("saves draft inputs to safeStorage and retains them upon network failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TypeError("Failed to fetch")
      );

      render(<ContactForm />);

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada Lovelace" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Resilient Draft Subject" },
      });
      fireEvent.change(screen.getByLabelText(/Message/i), {
        target: {
          value: "This text should be preserved even when network fails.",
        },
      });

      const submitBtn = screen.getByRole("button", { name: /Send Message/i });
      fireEvent.click(submitBtn);

      await screen.findByRole("alert");

      const storedDraft = safeStorage.getItem(CONTACT_FORM_DRAFT_KEY);
      expect(storedDraft).toMatchObject({
        name: "Ada Lovelace",
        email: "ada@example.com",
        subject: "Resilient Draft Subject",
        message: "This text should be preserved even when network fails.",
      });
    });

    it("clears saved draft state from safeStorage when submission succeeds", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<ContactForm />);

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada Lovelace" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Success Draft Test" },
      });
      fireEvent.change(screen.getByLabelText(/Message/i), {
        target: { value: "Message that will succeed and clear the draft." },
      });

      expect(safeStorage.getItem(CONTACT_FORM_DRAFT_KEY)).not.toBeNull();

      const submitBtn = screen.getByRole("button", { name: /Send Message/i });
      fireEvent.click(submitBtn);

      await screen.findByTestId("contact-form-success");

      expect(safeStorage.getItem(CONTACT_FORM_DRAFT_KEY)).toBeNull();
    });

    it("clears saved draft state from safeStorage on manual reset", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<ContactForm />);

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada Lovelace" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Reset Test Subject" },
      });
      fireEvent.change(screen.getByLabelText(/Message/i), {
        target: { value: "Reset Test Message Body" },
      });

      const submitBtn = screen.getByRole("button", { name: /Send Message/i });
      fireEvent.click(submitBtn);

      await screen.findByTestId("contact-form-success");

      const resetBtn = screen.getByRole("button", {
        name: /Send Another Message/i,
      });
      fireEvent.click(resetBtn);

      expect(safeStorage.getItem(CONTACT_FORM_DRAFT_KEY)).toBeNull();
      expect(
        (screen.getByLabelText(/Your Name/i) as HTMLInputElement).value
      ).toBe("");
    });

    it("prioritizes active saved draft over default initial props", () => {
      safeStorage.setItem(CONTACT_FORM_DRAFT_KEY, {
        name: "Saved Name",
        email: "saved@example.com",
        intent: "consulting",
        subject: "Saved Subject",
        message: "Saved Message Content",
      });

      render(
        <ContactForm
          initialSubject="Pre-filled Prop Subject"
          initialMessage="Pre-filled Prop Message"
        />
      );

      expect(
        (screen.getByLabelText(/Your Name/i) as HTMLInputElement).value
      ).toBe("Saved Name");
      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("Saved Subject");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe("Saved Message Content");
    });
  });
});
