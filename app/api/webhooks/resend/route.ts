import { NextResponse } from "next/server";
import { ResendWebhookEventSchema } from "@/lib/schemas";
import { createApiHandler, serviceFailureResponse } from "@/lib/route-wrapper";
import {
  HandleEmailWebhookEventHandler,
  VerifySvixSignatureHandler,
} from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * Resend deliverability webhook receiver.
 * Validates Svix cryptographic signatures and manages bounce/complaint suppression lists.
 * The route is public; the Svix signature check below is its authentication.
 */
export const POST = createApiHandler(
  async (req) => {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: "Missing required Svix webhook verification headers" },
        { status: 400 }
      );
    }

    const rawBody = await req.text();

    const verification = new VerifySvixSignatureHandler().execute({
      payload: rawBody,
      svixId,
      svixTimestamp,
      svixSignature,
    });

    if (!verification.success) {
      return serviceFailureResponse(verification, {
        status: verification.error.code === "MISSING_HEADERS" ? 400 : 401,
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const parseResult = ResendWebhookEventSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload does not match Resend webhook schema",
          details: parseResult.error.issues,
        },
        { status: 422 }
      );
    }

    const result = await new HandleEmailWebhookEventHandler().execute({
      event: parseResult.data,
    });

    if (!result.success) {
      // Durable processing (e.g. the suppression-list write) failed. Respond
      // with a retryable status so Resend/Svix redelivers the event instead
      // of treating a lost write as acknowledged.
      return serviceFailureResponse(result, {
        errorMessage: "Failed to durably process webhook event",
        logContext: "Failed to durably process Resend webhook event:",
      });
    }

    return NextResponse.json(
      {
        received: true,
        processedEvent: parseResult.data.type,
        suppressed: result.data.suppressed || false,
      },
      { status: 200 }
    );
  },
  { auth: "public" }
);
