// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as confirmGet } from "@/app/api/newsletter/confirm/route";
import {
  GET as unsubscribeGet,
  POST as unsubscribePost,
} from "@/app/api/newsletter/unsubscribe/route";
import { NewsletterService } from "@/lib/services/newsletter-service";

const TOKEN = "a-sufficiently-long-token-value";
const url = (path: string, token = TOKEN) =>
  `http://localhost:3000/api/newsletter/${path}?token=${token}`;

describe("newsletter link routes (#841)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms a subscription and renders an uncached, unindexed page", async () => {
    const confirm = vi
      .spyOn(NewsletterService, "confirm")
      .mockResolvedValue("confirmed");

    const res = await confirmGet(new NextRequest(url("confirm")));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await res.text()).toContain("Subscription confirmed");
    expect(confirm).toHaveBeenCalledWith(TOKEN);
  });

  it("answers 404 for an unknown confirmation token", async () => {
    vi.spyOn(NewsletterService, "confirm").mockResolvedValue("invalid");
    const res = await confirmGet(new NextRequest(url("confirm")));
    expect(res.status).toBe(404);
  });

  it("rejects a malformed token before touching the service", async () => {
    const confirm = vi.spyOn(NewsletterService, "confirm");
    const res = await confirmGet(new NextRequest(url("confirm", "short")));
    expect(res.status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("unsubscribes on a single GET, with no sign-in or second step", async () => {
    const unsubscribe = vi
      .spyOn(NewsletterService, "unsubscribe")
      .mockResolvedValue("unsubscribed");

    const res = await unsubscribeGet(new NextRequest(url("unsubscribe")));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("unsubscribed");
    expect(unsubscribe).toHaveBeenCalledWith(TOKEN);
  });

  it("accepts the RFC 8058 one-click POST from mail clients", async () => {
    const unsubscribe = vi
      .spyOn(NewsletterService, "unsubscribe")
      .mockResolvedValue("unsubscribed");

    const res = await unsubscribePost(
      new NextRequest(url("unsubscribe"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(unsubscribe).toHaveBeenCalledWith(TOKEN);
  });
});
