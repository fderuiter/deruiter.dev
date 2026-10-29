import { NewsletterTokenQuerySchema } from "@/lib/schemas";
import { NewsletterService } from "@/lib/services/newsletter-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { newsletterLinkPage } from "../link-page";

export const dynamic = "force-dynamic";

/**
 * Double opt-in confirmation link (#841): moves a PENDING subscriber to
 * CONFIRMED. Only confirmed addresses ever receive a dispatch.
 */
export const GET = createApiHandler(
  async (_req, { data }) => {
    const outcome = await NewsletterService.confirm(data.token);
    if (outcome === "confirmed" || outcome === "already_confirmed") {
      return newsletterLinkPage(
        200,
        "Subscription confirmed",
        "You're on the Systems Dispatch list. Every dispatch has a one-click unsubscribe link."
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
