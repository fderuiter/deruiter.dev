// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockQueryRaw, mockUpdate, mockSuppressionFind, mockSend } =
  vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockQueryRaw: vi.fn().mockResolvedValue([]),
    mockUpdate: vi.fn().mockResolvedValue({}),
    mockSuppressionFind: vi.fn().mockResolvedValue(null),
    mockSend: vi
      .fn()
      .mockResolvedValue({ data: { id: "msg_live" }, error: null }),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    // Leasing is one FOR UPDATE SKIP LOCKED statement (#1116).
    $queryRaw: mockQueryRaw,
    outboundEmailQueue: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: mockCreate,
      update: mockUpdate,
    },
    suppressionList: {
      findUnique: mockSuppressionFind,
      create: vi.fn(),
    },
  },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  EnqueueEmailHandler,
  ProcessRetryQueueHandler,
  SendRawEmailHandler,
  resetResendClient,
} from "@/lib/services";

const TAGS = [
  { name: "category", value: "contact-inquiry" },
  { name: "environment", value: "production" },
];

const BASE_OPTIONS = {
  to: "visitor@example.com",
  subject: "Thanks for reaching out",
  html: "<p>hello</p>",
  text: "hello",
  tags: TAGS,
};

describe("Outbound email queue tag fidelity and honest queueing (#689)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetResendClient();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.VITEST = "0";
    mockQueryRaw.mockResolvedValue([]);
    mockUpdate.mockResolvedValue({});
    mockSuppressionFind.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "queue-1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("native JSON tag round trip", () => {
    it("persists structured tags as native JSON, not a stringified scalar", async () => {
      await new EnqueueEmailHandler().execute({
        options: BASE_OPTIONS,
        mode: "retry",
        errorReason: "boom",
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const written = mockCreate.mock.calls[0][0].data;

      expect(typeof written.tags).not.toBe("string");
      expect(written.tags).toEqual(TAGS);
    });

    it("carries persisted tags through to the retry dispatch", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: "queue-1",
          to: "visitor@example.com",
          from: "sender@deruiter.dev",
          replyTo: null,
          subject: "Thanks for reaching out",
          html: "<p>hello</p>",
          text: "hello",
          tags: TAGS,
          attempts: 1,
          status: "RETRYING",
          nextRetryAt: new Date(),
          lastError: "temporary",
        },
      ]);

      await new ProcessRetryQueueHandler().execute();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].tags).toEqual(TAGS);
    });

    it("still reads legacy rows whose tags were stored as a JSON string", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: "queue-legacy",
          to: "visitor@example.com",
          from: "sender@deruiter.dev",
          replyTo: null,
          subject: "Legacy row",
          html: "<p>hello</p>",
          text: null,
          tags: JSON.stringify(TAGS),
          attempts: 1,
          status: "RETRYING",
          nextRetryAt: new Date(),
          lastError: null,
        },
      ]);

      await new ProcessRetryQueueHandler().execute();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].tags).toEqual(TAGS);
    });

    it("omits tags rather than sending a malformed value", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: "queue-bad",
          to: "visitor@example.com",
          from: "sender@deruiter.dev",
          replyTo: null,
          subject: "Bad tags",
          html: "<p>hello</p>",
          text: null,
          tags: "{not json",
          attempts: 1,
          status: "RETRYING",
          nextRetryAt: new Date(),
          lastError: null,
        },
      ]);

      await new ProcessRetryQueueHandler().execute();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].tags).toBeUndefined();
    });
  });

  describe("queue persistence failure", () => {
    it("reports failure when the queue write fails", async () => {
      mockCreate.mockRejectedValueOnce(new Error("connection terminated"));

      const result = await new EnqueueEmailHandler().execute({
        options: BASE_OPTIONS,
        mode: "retry",
        errorReason: "boom",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ENQUEUE_FAILED");
      }
    });

    it("does not report a retryable send as queued when nothing was persisted", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Request timeout, please try again" },
      });
      mockCreate.mockRejectedValueOnce(new Error("connection terminated"));

      const result = await new SendRawEmailHandler().execute(BASE_OPTIONS);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
        expect(result.error.message).toBeTruthy();
      }
    });

    it("still reports a genuinely persisted retry as queued", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Request timeout, please try again" },
      });
      mockCreate.mockResolvedValueOnce({ id: "queue-real" });

      const result = await new SendRawEmailHandler().execute(BASE_OPTIONS);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.queued).toBe(true);
        expect(result.data.queueId).toBe("queue-real");
      }
    });
  });
});
