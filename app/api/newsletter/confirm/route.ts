import { NewsletterTokenQuerySchema } from "@/lib/schemas";
import { ConfirmSubscriberHandler } from "@/lib/services";
import { createApiHandler } from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";
import { newsletterLinkPage } from "../link-page";

export const dynamic = "force-dynamic";

/**
 * Double opt-in confirmation link (#841): moves a PENDING subscriber to
 * CONFIRMED. Only confirmed addresses ever receive a dispatch.
 */
export const GET = createApiHandler(
  async (_req, { data }) => {
    const result = await new ConfirmSubscriberHandler().execute({
      token: data.token,
    });
    if (result.success) {
      return newsletterLinkPage(
        200,
        "Subscription confirmed",
        "You're on the Systems Dispatch list. Every dispatch has a one-click unsubscribe link."
      );
    }
    if (result.error.code === "STORAGE_UNAVAILABLE") {
      logger.error(
        "Newsletter confirmation storage failure:",
        result.error.details ?? new Error(result.error.message)
      );
      return newsletterLinkPage(
        503,
        "Confirmation temporarily unavailable",
        "We could not verify your subscription right now. Your confirmation link has not been consumed — please try opening it again in a few minutes."
      );
    }
    return newsletterLinkPage(
      404,
      "Link not recognised",
      "This confirmation link is invalid or has already been replaced by a newer one. Subscribe again to get a fresh link."
    );
  },
  { auth: "public", schema: NewsletterTokenQuerySchema, type: "query" }
);
