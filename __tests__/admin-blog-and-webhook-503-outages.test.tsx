import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import AdminBlogPage from "@/app/admin/blog/page";
import EditBlogPostPage from "@/app/admin/blog/[id]/page";
import {
  GET as getAdminBlogList,
  POST as createAdminBlogDraft,
} from "@/app/api/admin/blog/route";
import {
  DELETE as deleteAdminBlogItem,
  GET as getAdminBlogItem,
  PATCH as patchAdminBlogItem,
} from "@/app/api/admin/blog/[id]/route";
import { POST as postQStashRetry } from "@/app/api/webhooks/qstash/retry/route";
import { GET as getNewsletterConfirm } from "@/app/api/newsletter/confirm/route";

const { mockNotFound, mockScheduleEmailRetry } = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  mockScheduleEmailRetry: vi.fn(async () => true),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

vi.mock("@/components/ui/IntentLink", () => ({
  IntentLink: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminAuthSession: vi.fn(async () => ({
    isAdmin: true,
    userId: "admin-1",
    primaryEmail: "admin@deruiter.dev",
    displayName: "Admin",
  })),
  isCurrentUserAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/qstash-retry", () => ({
  isQStashReceivingConfigured: vi.fn(() => true),
  verifyQStashSignature: vi.fn(async () => true),
  scheduleEmailRetry: mockScheduleEmailRetry,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      count: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      findUnique: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      findFirst: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      create: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      updateManyAndReturn: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      delete: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
    },
    $queryRaw: vi.fn(async () => {
      throw new Error("Database connection refused");
    }),
    outboundEmailQueue: {
      update: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
      findUnique: vi.fn(async () => {
        throw new Error("Database connection refused");
      }),
    },
    $transaction: vi.fn(async () => {
      throw new Error("Database connection refused");
    }),
  },
}));

describe("Admin Blog, QStash Retry, and Newsletter Confirm 503 Outage States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders 503 outage banner on /admin/blog instead of empty draft state", async () => {
    const ui = await AdminBlogPage();
    render(ui);

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("data-status")).toBe("503");
    expect(alert.textContent).toContain(
      "503 — Service Temporarily Unavailable"
    );
    expect(screen.queryByText(/No blog posts or drafts found/i)).toBeNull();
  });

  it("renders 503 outage banner on /admin/blog/[id] instead of calling notFound()", async () => {
    const ui = await EditBlogPostPage({
      params: Promise.resolve({ id: "post-123" }),
    });
    render(ui);

    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("data-status")).toBe("503");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("returns HTTP 503 across /api/admin/blog and /api/admin/blog/[id] endpoints during DB outages", async () => {
    const listRes = await getAdminBlogList(
      new NextRequest(
        "http://localhost:3000/api/admin/blog?page=1&pageSize=10"
      ),
      { params: Promise.resolve({}) }
    );
    expect(listRes.status).toBe(503);

    const createRes = await createAdminBlogDraft(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Draft Title",
          slug: "draft-title",
          dek: "Standfirst copy that satisfies validation.",
          body: "<p>Body</p>",
          pillar: "agent-first-dx",
          tags: ["dx"],
          heroImageUrl: null,
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(createRes.status).toBe(503);

    const itemParams = { params: Promise.resolve({ id: "draft-123" }) };

    const getRes = await getAdminBlogItem(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-123"),
      itemParams
    );
    expect(getRes.status).toBe(503);

    const patchRes = await patchAdminBlogItem(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-123", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Edited Title" }),
      }),
      itemParams
    );
    expect(patchRes.status).toBe(503);

    const deleteRes = await deleteAdminBlogItem(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-123", {
        method: "DELETE",
      }),
      itemParams
    );
    expect(deleteRes.status).toBe(503);
  });

  it("conservatively reschedules QStash retry and returns HTTP 503 when queue DB lease/read fails", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const res = await postQStashRetry(
      new NextRequest("http://localhost:3000/api/webhooks/qstash/retry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "upstash-signature": "sig-valid",
        },
        body: JSON.stringify({ queueId: "queue-outage-1" }),
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(503);
    expect(mockScheduleEmailRetry).toHaveBeenCalledWith("queue-outage-1", 1);
  });

  it("returns branded HTML 503 page on /api/newsletter/confirm during storage outage", async () => {
    const token = "a".repeat(64);
    const res = await getNewsletterConfirm(
      new NextRequest(
        `http://localhost:3000/api/newsletter/confirm?token=${token}`
      ),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Service temporarily unavailable");
    expect(html).not.toContain("Link not recognised");
  });
});
