import { NextResponse } from "next/server";
import { NewsletterTokenQuerySchema } from "@/lib/schemas";
import { NewsletterService } from "@/lib/services/newsletter-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { newsletterLinkPage } from "../link-page";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (#841). The link in every dispatch unsubscribes on a
 * single GET with no sign-in and no confirmation step.
 */
export const GET = createApiHandler(
  async (_req, { data }) => {
    const outcome = await NewsletterService.unsubscribe(data.token);
    if (outcome === "unsubscribed" || outcome === "already_unsubscribed") {
      return newsletterLinkPage(
        200,
        "You're unsubscribed",
        "You won't receive any more Systems Dispatch emails. Nothing else is needed."
      );
    }
    return newsletterLinkPage(
      404,
      "Link not recognised",
      "This unsubscribe link is invalid. If you keep receiving dispatches, reply to one and ask to be removed."
    );
  },
  { auth: "public", schema: NewsletterTokenQuerySchema, type: "query" }
);

/**
 * RFC 8058 one-click unsubscribe, which mail clients POST to the
 * List-Unsubscribe URL (body `List-Unsubscribe=One-Click`).
 */
export const POST = createApiHandler(
  async (_req, { data }) => {
    const outcome = await NewsletterService.unsubscribe(data.token);
    if (outcome === "invalid") {
      return NextResponse.json({ error: "Unknown token" }, { status: 404 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  },
  { auth: "public", schema: NewsletterTokenQuerySchema, type: "query" }
);
