import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { z } from "zod";
import { ContactForm } from "@/components/ContactForm";
import { NewsletterForm } from "@/components/NewsletterForm";
import { CaseStudyFeedbackSection } from "@/components/CaseStudyFeedbackSection";
import { BlogAuthoringForm } from "@/components/admin/BlogAuthoringForm";
import { toFieldErrors } from "@/lib/schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

type FetchMock = ReturnType<typeof vi.fn>;

/** POST, PATCH or DELETE calls made through fetch, ignoring mount-time reads. */
function mutatingCalls(): unknown[][] {
  return (global.fetch as FetchMock).mock.calls.filter(
    ([, init]) =>
      (init as RequestInit | undefined)?.method !== undefined &&
      (init as RequestInit).method !== "GET"
  );
}

/** Asserts an input is flagged invalid and described by the given message. */
function expectDescribedError(input: HTMLElement, message: string) {
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const describedBy = input.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy as string)?.textContent).toBe(
    message
  );
}

describe("toFieldErrors", () => {
  it("keeps the first message per top-level field and folds nested paths", () => {
    const schema = z.object({
      name: z.string().min(2, "too short").regex(/^a/, "must start with a"),
      tags: z.array(z.string().min(1, "empty tag")),
    });
    const result = schema.safeParse({ name: "b", tags: ["ok", ""] });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toEqual({
      name: "too short",
      tags: "empty tag",
    });
  });

  it("omits issues that are not tied to a field", () => {
    const schema = z
      .object({ a: z.string().optional() })
      .refine((data) => data.a !== undefined, "need a");
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error)).toEqual({});
  });
});

describe("client forms validate against the shared route schemas (#1128)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  afterEach(() => {
    cleanup();
  });

  it("ContactForm rejects an oversized name inline, without a request", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "A".repeat(101) },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Valid subject" },
    });
    fireEvent.change(screen.getByLabelText(/^Message/i), {
      target: { value: "A perfectly valid message body." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    const nameInput = screen.getByLabelText(/Your Name/i);
    expectDescribedError(nameInput, "Name cannot exceed 100 characters.");
    expect(document.activeElement).toBe(nameInput);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ContactForm applies the route's tone check to the message field", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Valid subject" },
    });
    fireEvent.change(screen.getByLabelText(/^Message/i), {
      target: { value: "This is garbage and a waste of time." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    const messageInput = screen.getByLabelText(/^Message/i);
    expect(messageInput.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(messageInput);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ContactForm sends the schema-parsed, trimmed payload when valid", async () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "  Ada  " },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: " ada@example.com " },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Valid subject" },
    });
    fireEvent.change(screen.getByLabelText(/^Message/i), {
      target: { value: "A perfectly valid message body." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    expect(await screen.findByTestId("contact-form-success")).toBeDefined();
    const [url, init] = (global.fetch as FetchMock).mock.calls[0];
    expect(url).toBe("/api/contact");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      intent: "general",
    });
  });

  it("NewsletterForm rejects a malformed email and marks the input invalid", async () => {
    render(<NewsletterForm />);

    const input = screen.getByLabelText(/Email address/i);
    fireEvent.change(input, { target: { value: "reader@@example.com" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Please enter a valid email address."
    );
    expectDescribedError(input, "Please enter a valid email address.");
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "reader@example.com" } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("CaseStudyFeedbackSection blocks an empty takeaway selection without posting", async () => {
    render(<CaseStudyFeedbackSection slug="imednet-python-sdk" />);

    fireEvent.change(screen.getByPlaceholderText(/Describe key insights/i), {
      target: { value: "Constructive and specific comments." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Submit Learning Feedback/i })
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Please select at least one learning takeaway."
    );
    expect(mutatingCalls()).toHaveLength(0);
  });

  it("BlogAuthoringForm flags an invalid slug and missing tags before any request", () => {
    render(
      <BlogAuthoringForm
        isNew={true}
        initialData={{
          title: "Valid Title",
          slug: "Not A Slug",
          dek: "A standfirst long enough to pass.",
          body: "<p>Body</p>",
          pillar: "field-notes",
          tags: " , ",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));

    const slugInput = screen.getByLabelText(/URL Slug/i);
    expectDescribedError(slugInput, "Slug must be lowercase kebab-case");
    expectDescribedError(
      screen.getByLabelText(/Tags/i),
      "Add at least one tag."
    );
    expect(document.activeElement).toBe(slugInput);
    expect(screen.getByRole("alert").textContent).toContain(
      "Please fix the highlighted fields before saving."
    );
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(slugInput, { target: { value: "valid-title" } });
    expect(slugInput.getAttribute("aria-invalid")).toBe("false");
  });

  it("BlogAuthoringForm validates edits with the partial update schema", () => {
    render(
      <BlogAuthoringForm
        initialData={{
          id: "post-1",
          title: "Valid Title",
          slug: "valid-title",
          dek: "Too short",
          body: "<p>Body</p>",
          pillar: "field-notes",
          tags: "testing",
          hero_image_url: "not a url",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish Post/i }));

    const dekInput = screen.getByLabelText(/Dek/i);
    expectDescribedError(dekInput, "Dek must be at least 10 characters.");
    expectDescribedError(
      screen.getByLabelText(/Hero Image URL/i),
      "Hero image URL must be a valid URL."
    );
    expect(document.activeElement).toBe(dekInput);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
