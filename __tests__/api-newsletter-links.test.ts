// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as confirmGet } from "@/app/api/newsletter/confirm/route";
import {
  GET as unsubscribeGet,
  POST as unsubscribePost,
} from "@/app/api/newsletter/unsubscribe/route";
import {
  ConfirmSubscriberHandler,
  UnsubscribeSubscriberHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

const TOKEN = "a-sufficiently-long-token-value";
const url = (path: string, token = TOKEN) =>
  `http://localhost:3000/api/newsletter/${path}?token=${token}`;

describe("newsletter link routes (#841)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms a subscription and renders an uncached, unindexed page", async () => {
    const confirm = vi
      .spyOn(ConfirmSubscriberHandler.prototype, "execute")
      .mockResolvedValue(createSuccess({ outcome: "confirmed" }));

    const res = await confirmGet(new NextRequest(url("confirm")));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await res.text()).toContain("Subscription confirmed");
    expect(confirm).toHaveBeenCalledWith({ token: TOKEN });
  });

  it("answers 404 for an unknown confirmation token", async () => {
    vi.spyOn(ConfirmSubscriberHandler.prototype, "execute").mockResolvedValue(
      createFailure("INVALID_TOKEN", "Unknown confirmation token")
    );
    const res = await confirmGet(new NextRequest(url("confirm")));
    expect(res.status).toBe(404);
  });

  it("renders a branded HTML 503 page when confirmation storage is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(ConfirmSubscriberHandler.prototype, "execute").mockResolvedValue(
      createFailure("STORAGE_UNAVAILABLE", "Database unreachable", {
        recoverable: true,
        details: new Error("connection timeout"),
      })
    );

    const res = await confirmGet(new NextRequest(url("confirm")));
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("Confirmation temporarily unavailable");
    expect(html).toContain("has not been consumed");
  });

  it("rejects a malformed token before touching the service", async () => {
    const confirm = vi.spyOn(ConfirmSubscriberHandler.prototype, "execute");
    const res = await confirmGet(new NextRequest(url("confirm", "short")));
    expect(res.status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("unsubscribes on a single GET, with no sign-in or second step", async () => {
    const unsubscribe = vi
      .spyOn(UnsubscribeSubscriberHandler.prototype, "execute")
      .mockResolvedValue(createSuccess({ outcome: "unsubscribed" }));

    const res = await unsubscribeGet(new NextRequest(url("unsubscribe")));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("unsubscribed");
    expect(unsubscribe).toHaveBeenCalledWith({ token: TOKEN });
  });

  it("renders a branded HTML 503 page on GET unsubscribe when storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      UnsubscribeSubscriberHandler.prototype,
      "execute"
    ).mockResolvedValue(
      createFailure("STORAGE_UNAVAILABLE", "Database unreachable", {
        recoverable: true,
        details: new Error("connection timeout"),
      })
    );

    const res = await unsubscribeGet(new NextRequest(url("unsubscribe")));
    expect(res.status).toBe(503);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("Unsubscribe temporarily unavailable");
  });

  it("accepts the RFC 8058 one-click POST from mail clients", async () => {
    const unsubscribe = vi
      .spyOn(UnsubscribeSubscriberHandler.prototype, "execute")
      .mockResolvedValue(createSuccess({ outcome: "unsubscribed" }));

    const res = await unsubscribePost(
      new NextRequest(url("unsubscribe"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(unsubscribe).toHaveBeenCalledWith({ token: TOKEN });
  });

  it("returns HTTP 503 JSON on RFC 8058 POST unsubscribe when storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      UnsubscribeSubscriberHandler.prototype,
      "execute"
    ).mockResolvedValue(
      createFailure("STORAGE_UNAVAILABLE", "Database unreachable", {
        recoverable: true,
        details: new Error("connection timeout"),
      })
    );

    const res = await unsubscribePost(
      new NextRequest(url("unsubscribe"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Unable to process unsubscribe request right now",
    });
  });
});
