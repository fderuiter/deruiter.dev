// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockQueryRaw, mockUpdate, mockSend } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockQueryRaw: vi.fn().mockResolvedValue([]),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockSend: vi
    .fn()
    .mockResolvedValue({ data: { id: "msg_live" }, error: null }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    // Leasing is one FOR UPDATE SKIP LOCKED statement (#1116).
    $queryRaw: mockQueryRaw,
    outboundEmailQueue: {
      create: mockCreate,
      update: mockUpdate,
    },
    suppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { EmailService } from "@/lib/services/email-service";

const HEADERS = {
  "List-Unsubscribe":
    "<https://deruiter.dev/api/newsletter/unsubscribe?token=t>",
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

const queuedRow = (headers: unknown) => ({
  id: "queue-news",
  to: "reader@example.com",
  from: "sender@deruiter.dev",
  replyTo: null,
  subject: "New dispatch",
  html: "<p>post</p>",
  text: null,
  tags: null,
  headers,
  attempts: 0,
  status: "PENDING",
  nextRetryAt: new Date(),
  lastError: null,
});

describe("Outbound queue header fidelity (#841)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    mockQueryRaw.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: "queue-news" });
  });

  it("enqueues a first-attempt PENDING row that keeps its headers", async () => {
    const id = await EmailService.enqueueEmail({
      to: "reader@example.com",
      subject: "New dispatch",
      html: "<p>post</p>",
      headers: HEADERS,
    });

    expect(id).toBe("queue-news");
    const written = mockCreate.mock.calls[0][0].data;
    expect(written).toMatchObject({
      status: "PENDING",
      attempts: 0,
      headers: HEADERS,
    });
    expect(written.lastError).toBeUndefined();
  });

  it("replays stored List-Unsubscribe headers on the send", async () => {
    mockQueryRaw.mockResolvedValueOnce([queuedRow(HEADERS)]);

    await EmailService.processRetryQueue();

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].headers).toEqual(HEADERS);
  });

  it("drops a malformed headers column instead of sending it", async () => {
    mockQueryRaw.mockResolvedValueOnce([queuedRow(["not", "an", "object"])]);

    await EmailService.processRetryQueue();

    expect(mockSend.mock.calls[0][0].headers).toBeUndefined();
  });
});
