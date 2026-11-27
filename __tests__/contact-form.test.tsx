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

  it("offers peer intents only and no hiring intent (ADR 0047)", () => {
    render(<ContactForm />);

    expect(
      screen.getByRole("radiogroup", { name: /What’s this about\?/i })
    ).toBeDefined();

    for (const intent of ["general", "collaboration", "consulting", "other"]) {
      const radio = screen.getByRole("radio", { name: intent });
      expect(radio).toBeDefined();
      expect(radio.getAttribute("aria-checked")).toBe(
        intent === "general" ? "true" : "false"
      );
      expect(radio.getAttribute("tabindex")).toBe(
        intent === "general" ? "0" : "-1"
      );
    }
    expect(screen.queryByRole("radio", { name: /recruit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /recruit/i })).toBeNull();

    const consultingRadio = screen.getByRole("radio", { name: "consulting" });
    const generalRadio = screen.getByRole("radio", { name: "general" });

    fireEvent.click(consultingRadio);
    expect(consultingRadio.getAttribute("aria-checked")).toBe("true");
    expect(consultingRadio.getAttribute("tabindex")).toBe("0");
    expect(generalRadio.getAttribute("aria-checked")).toBe("false");
    expect(generalRadio.getAttribute("tabindex")).toBe("-1");
  });

  it("supports keyboard navigation with arrow keys within the intent radiogroup", () => {
    render(<ContactForm />);

    const generalRadio = screen.getByRole("radio", { name: "general" });
    const collabRadio = screen.getByRole("radio", { name: "collaboration" });
    const otherRadio = screen.getByRole("radio", { name: "other" });

    // Initial state: general is checked
    expect(generalRadio.getAttribute("aria-checked")).toBe("true");

    // ArrowRight moves to next option (collaboration)
    fireEvent.keyDown(generalRadio, { key: "ArrowRight" });
    expect(collabRadio.getAttribute("aria-checked")).toBe("true");
    expect(generalRadio.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).toBe(collabRadio);

    // ArrowDown moves forward similarly
    fireEvent.keyDown(collabRadio, { key: "ArrowDown" });
    const consultingRadio = screen.getByRole("radio", { name: "consulting" });
    expect(consultingRadio.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(consultingRadio);

    // ArrowUp moves back
    fireEvent.keyDown(consultingRadio, { key: "ArrowUp" });
    expect(collabRadio.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(collabRadio);

    // ArrowLeft moves back to previous option (general)
    fireEvent.keyDown(collabRadio, { key: "ArrowLeft" });
    expect(generalRadio.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(generalRadio);

    // ArrowLeft from first option wraps to last option (other)
    fireEvent.keyDown(generalRadio, { key: "ArrowLeft" });
    expect(otherRadio.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(otherRadio);

    // ArrowRight from last option wraps to first option (general)
    fireEvent.keyDown(otherRadio, { key: "ArrowRight" });
    expect(generalRadio.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(generalRadio);
  });

  it("keeps the intent group reachable when no radio is checked", () => {
    // A saved draft or an older link can still carry the retired intent.
    render(<ContactForm initialIntent="recruiting" />);

    const radios = screen.getAllByRole("radio");
    expect(
      radios.every((r) => r.getAttribute("aria-checked") === "false")
    ).toBe(true);
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "0",
      ...radios.slice(1).map(() => "-1"),
    ]);
  });

  it("renders with zero axe violations", async () => {
    const computed = window.getComputedStyle;
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => computed.call(window, element));
    try {
      const { container } = render(<ContactForm />);
      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    } finally {
      spy.mockRestore();
    }
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

    it("scopes draft persistence, submit cleanup, and reset cleanup to draftKey", async () => {
      const scheduleDraftKey = "portfolio_contact_form_draft_schedule";
      safeStorage.setItem(CONTACT_FORM_DRAFT_KEY, {
        name: "Contact Page Visitor",
        email: "contact@example.com",
        intent: "general",
        subject: "",
        message: "",
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(
        <ContactForm
          draftKey={scheduleDraftKey}
          initialIntent="collaboration"
          initialSubject="30-Min General Chat"
          initialMessage="30-minute general chat (Timezone: America/Chicago)."
        />
      );

      expect(
        (screen.getByLabelText(/Your Name/i) as HTMLInputElement).value
      ).toBe("");
      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("30-Min General Chat");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe("30-minute general chat (Timezone: America/Chicago).");
      expect(
        screen
          .getByRole("radio", { name: "collaboration" })
          .getAttribute("aria-checked")
      ).toBe("true");

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada Lovelace" },
      });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: "ada@example.com" },
      });

      const scheduleDraft =
        safeStorage.getItem<Record<string, unknown>>(scheduleDraftKey);
      expect(scheduleDraft).toEqual({
        name: "Ada Lovelace",
        email: "ada@example.com",
      });
      expect(scheduleDraft?.intent).toBeUndefined();
      expect(scheduleDraft?.subject).toBeUndefined();
      expect(scheduleDraft?.message).toBeUndefined();

      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));
      await screen.findByTestId("contact-form-success");

      expect(safeStorage.getItem(scheduleDraftKey)).toBeNull();
      expect(safeStorage.getItem(CONTACT_FORM_DRAFT_KEY)).toMatchObject({
        name: "Contact Page Visitor",
        email: "contact@example.com",
      });

      fireEvent.click(
        screen.getByRole("button", { name: /Send Another Message/i })
      );
      expect(safeStorage.getItem(scheduleDraftKey)).toBeNull();
      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("30-Min General Chat");
    });

    it("syncs live initialSubject and initialMessage updates until each field is edited directly", () => {
      const scheduleDraftKey = "portfolio_contact_form_draft_schedule";
      const { rerender } = render(
        <ContactForm
          draftKey={scheduleDraftKey}
          initialIntent="collaboration"
          initialSubject="30-Min General Chat"
          initialMessage="Default 30-min message"
        />
      );

      fireEvent.change(screen.getByLabelText(/Your Name/i), {
        target: { value: "Ada Lovelace" },
      });

      rerender(
        <ContactForm
          draftKey={scheduleDraftKey}
          initialIntent="collaboration"
          initialSubject="Chat Agenda: Code, Systems & Web Craft"
          initialMessage="Proposed Agenda: Next.js & React 19 Architecture (10m)"
        />
      );

      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("Chat Agenda: Code, Systems & Web Craft");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe("Proposed Agenda: Next.js & React 19 Architecture (10m)");

      fireEvent.change(screen.getByLabelText(/Subject/i), {
        target: { value: "Custom Subject From Visitor" },
      });

      rerender(
        <ContactForm
          draftKey={scheduleDraftKey}
          initialIntent="collaboration"
          initialSubject="Chat Agenda: Healthcare & Clinical Data"
          initialMessage="Proposed Agenda (Timezone: UTC): GxP & eClinical Architecture (15m)"
        />
      );

      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("Custom Subject From Visitor");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe(
        "Proposed Agenda (Timezone: UTC): GxP & eClinical Architecture (15m)"
      );

      fireEvent.change(screen.getByLabelText(/Message/i), {
        target: { value: "Custom agenda notes written manually." },
      });

      rerender(
        <ContactForm
          draftKey={scheduleDraftKey}
          initialIntent="collaboration"
          initialSubject="30-Min General Chat"
          initialMessage="30-minute general chat"
        />
      );

      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("Custom Subject From Visitor");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe("Custom agenda notes written manually.");
    });

    it("falls back to initial props when legacy draft fields are blank and keeps retired recruiting tab-stop fallback", () => {
      safeStorage.setItem(CONTACT_FORM_DRAFT_KEY, {
        name: "Legacy Visitor",
        email: "legacy@example.com",
        intent: "recruiting",
        subject: "",
        message: "   ",
      });

      render(
        <ContactForm
          initialSubject="Pre-filled Prop Subject"
          initialMessage="Pre-filled Prop Message"
        />
      );

      expect(
        (screen.getByLabelText(/Your Name/i) as HTMLInputElement).value
      ).toBe("Legacy Visitor");
      expect(
        (screen.getByLabelText(/Subject/i) as HTMLInputElement).value
      ).toBe("Pre-filled Prop Subject");
      expect(
        (screen.getByLabelText(/Message/i) as HTMLTextAreaElement).value
      ).toBe("Pre-filled Prop Message");

      const radios = screen.getAllByRole("radio");
      expect(
        radios.every((r) => r.getAttribute("aria-checked") === "false")
      ).toBe(true);
      expect(radios[0]?.getAttribute("tabindex")).toBe("0");
    });
  });
});
