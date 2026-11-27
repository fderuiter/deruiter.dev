import { NextResponse } from "next/server";
import { NewsletterTokenQuerySchema } from "@/lib/schemas";
import { UnsubscribeSubscriberHandler } from "@/lib/services";
import { createApiHandler, serviceFailureResponse } from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";
import { newsletterLinkPage } from "../link-page";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (#841). The link in every dispatch unsubscribes on a
 * single GET with no sign-in and no confirmation step.
 */
export const GET = createApiHandler(
  async (_req, { data }) => {
    const result = await new UnsubscribeSubscriberHandler().execute({
      token: data.token,
    });
    if (result.success) {
      return newsletterLinkPage(
        200,
        "You're unsubscribed",
        "You won't receive any more Systems Dispatch emails. Nothing else is needed."
      );
    }
    if (result.error.code === "STORAGE_UNAVAILABLE") {
      logger.error(
        "Newsletter unsubscribe storage failure:",
        result.error.details ?? new Error(result.error.message)
      );
      return newsletterLinkPage(
        503,
        "Unsubscribe temporarily unavailable",
        "We could not update your subscription right now. Please try opening this link again in a few minutes."
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
    const result = await new UnsubscribeSubscriberHandler().execute({
      token: data.token,
    });
    if (!result.success) {
      if (result.error.code === "INVALID_TOKEN") {
        return NextResponse.json({ error: "Unknown token" }, { status: 404 });
      }
      return serviceFailureResponse(result, {
        errorMessage: "Unable to process unsubscribe request right now",
        logContext: "Newsletter RFC 8058 unsubscribe storage failure:",
      });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  },
  { auth: "public", schema: NewsletterTokenQuerySchema, type: "query" }
);
