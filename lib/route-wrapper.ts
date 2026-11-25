import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";
import { applySecurityHeaders } from "@/lib/security-headers";
import { logger } from "@/lib/logger";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { validateSyncRequest } from "@/lib/security";
import type { ServiceFailure } from "@/lib/services/service-result";

export type ApiAuthRequirement = "clerk_admin" | "cron_secret" | "public";

/**
 * Maps a typed domain `ServiceFailure` error code to its canonical HTTP status.
 *
 * - Not-found codes map to `404`.
 * - Conflict and duplicate-slug codes map to `409`.
 * - Rate-limit and duplicate-reaction codes map to `429`.
 * - Storage, persistence, queue, and transport outage codes map to `503` so
 *   client offline queues and webhook retry schedulers retain items for retry.
 * - Payload/validation codes map to `400` (and `FILE_TOO_LARGE` to `413`).
 */
export function mapServiceErrorCodeToHttpStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
    case "CASE_STUDY_NOT_FOUND":
    case "BLOG_POST_NOT_FOUND":
    case "ASSET_NOT_FOUND":
      return 404;

    case "CONFLICT":
    case "DUPLICATE_SLUG":
      return 409;

    case "RATE_LIMITED":
    case "DUPLICATE_REACTION":
      return 429;

    case "STORAGE_UNAVAILABLE":
    case "STORAGE_UNCONFIGURED":
    case "PERSISTENCE_FAILED":
    case "DATABASE_UNAVAILABLE":
    case "CASE_STUDY_LOOKUP_FAILED":
    case "STORAGE_FAILED":
    case "READ_FAILED":
    case "DELETE_FAILED":
    case "QUEUE_UNAVAILABLE":
    case "QUEUE_LEASE_FAILED":
    case "QUEUE_UPDATE_FAILED":
    case "QUEUE_STATE_READ_FAILED":
    case "TRANSPORT_UNCONFIGURED":
    case "ENQUEUE_FAILED":
    case "FLUSH_FAILED":
    case "ACKNOWLEDGEMENT_FAILED":
    case "RETENTION_FAILED":
    case "AGGREGATE_FAILED":
      return 503;

    case "FILE_TOO_LARGE":
      return 413;

    case "UNAUTHORIZED":
    case "INVALID_SIGNATURE":
      return 401;

    case "FORBIDDEN":
      return 403;

    case "EMPTY_PAYLOAD":
    case "UNSUPPORTED_TYPE":
    case "MALFORMED_HEADER":
    case "SANITIZED_SVG_EMPTY":
    case "INVALID_INPUT":
    case "INVALID_PAYLOAD":
    case "INVALID_STATE":
    case "INVALID_FORM":
    case "INVALID_GAME_STATE":
    case "EMPTY_FORMULA":
    case "VALIDATION_ERROR":
      return 400;

    default:
      if (code.endsWith("_NOT_FOUND")) return 404;
      if (code.endsWith("_UNAVAILABLE") || code.endsWith("_FAILED")) return 503;
      return 500;
  }
}

export interface ServiceFailureResponseOptions {
  /** Explicit status override when a route requires a custom status code. */
  status?: number;
  /** Optional log prefix emitted for 5xx infrastructure failures. */
  logContext?: string;
  /** Optional public error message override for the JSON response body. */
  errorMessage?: string;
  /** Additional top-level JSON fields merged into the response body. */
  extraBody?: Record<string, unknown>;
  /** Validation-style issue details to include in the JSON response body. */
  details?: ApiValidationDetail[];
  /** Custom response headers merged onto the `NextResponse`. */
  headers?: HeadersInit;
}

/**
 * Translates a domain `ServiceFailure` into a `NextResponse` with centralized
 * HTTP status mapping and raw boundary logging (preserving full stack frames
 * for Sentry while `StructuredLogger` scrubs production console output).
 */
export function serviceFailureResponse(
  failure: ServiceFailure<string>,
  options: ServiceFailureResponseOptions = {}
): NextResponse {
  const status =
    options.status ?? mapServiceErrorCodeToHttpStatus(failure.error.code);

  if (status >= 500) {
    const label =
      options.logContext ?? `Service failure (${failure.error.code}):`;
    if (failure.error.details !== undefined) {
      logger.error(label, failure.error.details);
    } else {
      logger.error(label, {
        code: failure.error.code,
        message: failure.error.message,
      });
    }
  }

  const body: Record<string, unknown> = {
    error: options.errorMessage ?? failure.error.message,
    ...(options.details ? { details: options.details } : {}),
    ...(options.extraBody ?? {}),
  };

  return NextResponse.json(body, {
    status,
    headers: options.headers,
  });
}

export interface ApiWrapperOptions<TSchema extends ZodSchema = ZodSchema> {
  schema?: TSchema;
  type?: "body" | "query";
  customValidationError?: (
    error: unknown,
    req: NextRequest
  ) => { error: string; details?: ApiValidationDetail[] };
  customJsonError?: string;
  defaultStatus?: number;
  /** Who may call the route. Defaults to `"public"`; name it anyway (#3472). */
  auth?: ApiAuthRequirement;
  /**
   * Replaces the Content-Security-Policy after the standard security headers
   * are applied, for responses such as raw media that must not run anything.
   */
  contentSecurityPolicy?: string;
}

/** One Zod issue as an API error detail. */
export interface ApiValidationDetail {
  path: string;
  message: string;
}

/**
 * Maps a Zod error's issues to API error details: each issue's dotted path
 * and message. An issue at the top level has an empty path; `fallbackPath`
 * names it instead (`"payload"`, `"query"`), and is empty by default.
 */
export function zodIssueDetails(
  error: unknown,
  fallbackPath = ""
): ApiValidationDetail[] {
  const issues =
    (error as { issues?: Array<{ path: PropertyKey[]; message: string }> })
      ?.issues ?? [];
  return issues.map((issue) => ({
    path: issue.path.map(String).join(".") || fallbackPath,
    message: issue.message,
  }));
}

function validationError(
  options: ApiWrapperOptions,
  error: unknown,
  req: NextRequest,
  fallbackPath: string
): NextResponse {
  const formatted = options.customValidationError
    ? options.customValidationError(error, req)
    : {
        error: "Validation failed",
        details: zodIssueDetails(error, fallbackPath),
      };
  return applySecurityHeaders(
    NextResponse.json(formatted, { status: 400 }),
    req
  );
}

export type ApiHandler<TData = unknown> = (
  req: NextRequest,
  context: {
    data: TData;
    params: Record<string, string | string[] | undefined>;
  }
) => Promise<NextResponse>;

export type ApiRouteHandler = {
  (
    req?: NextRequest,
    routeParams?: {
      params?:
        | Promise<Record<string, string | string[] | undefined>>
        | Record<string, string | string[] | undefined>;
    }
  ): Promise<NextResponse>;
  (
    req: NextRequest,
    routeContext: {
      params: Promise<Record<string, string | string[] | undefined>>;
    }
  ): Promise<NextResponse>;
  auth?: ApiAuthRequirement;
};

/**
 * Higher-order API route handler wrapper.
 * Provides automated Zod request schema validation, uniform error transformation,
 * Sentry exception logging, error sanitization, and security header enforcement.
 */
export function createApiHandler<TSchema extends ZodSchema>(
  handler: ApiHandler<z.infer<TSchema>>,
  options: ApiWrapperOptions<TSchema> & { schema: TSchema }
): ApiRouteHandler;

export function createApiHandler(
  handler: ApiHandler<undefined>,
  options?: ApiWrapperOptions
): ApiRouteHandler;

export function createApiHandler<TSchema extends ZodSchema>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: ApiHandler<any>,
  options?: ApiWrapperOptions<TSchema>
) {
  const wrapped: ApiRouteHandler = async (
    rawReq?: NextRequest,
    routeParams?: {
      params?:
        | Promise<Record<string, string | string[] | undefined>>
        | Record<string, string | string[] | undefined>;
    }
  ): Promise<NextResponse> => {
    const req = rawReq || new NextRequest("http://localhost:3000");
    try {
      if (options?.auth === "clerk_admin") {
        if (!(await isCurrentUserAdmin())) {
          const response = NextResponse.json(
            { error: "Administrator access required" },
            { status: 403 }
          );
          return applySecurityHeaders(response, req);
        }
      } else if (options?.auth === "cron_secret") {
        const authResult = validateSyncRequest(req);
        if (!authResult.isValid) {
          const response =
            authResult.errorResponse ??
            NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          return applySecurityHeaders(response, req);
        }
      }

      const resolvedParams = routeParams?.params
        ? await Promise.resolve(routeParams.params)
        : {};

      let validatedData: unknown = undefined;

      if (options?.schema) {
        if (options.type === "query" || req.method === "GET") {
          const url = new URL(req.url);
          const queryObj: Record<string, string> = {};
          url.searchParams.forEach((val, key) => {
            queryObj[key] = val;
          });
          const result = options.schema.safeParse(queryObj);
          if (!result.success) {
            return validationError(options, result.error, req, "query");
          }
          validatedData = result.data;
        } else {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            const customJsonMsg =
              options.customJsonError || "Invalid JSON payload";
            const response = NextResponse.json(
              {
                error: customJsonMsg,
                details: [
                  { path: "body", message: "Request body must be valid JSON" },
                ],
              },
              { status: 400 }
            );
            return applySecurityHeaders(response, req);
          }

          const result = options.schema.safeParse(body);
          if (!result.success) {
            return validationError(options, result.error, req, "payload");
          }
          validatedData = result.data;
        }
      }

      const response = await handler(req, {
        data: validatedData,
        params: resolvedParams,
      });

      applySecurityHeaders(response, req);
      if (options?.contentSecurityPolicy) {
        response.headers.set(
          "Content-Security-Policy",
          options.contentSecurityPolicy
        );
      }
      return response;
    } catch (err: unknown) {
      // Check for unique constraint failure (e.g. Prisma P2002)
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj?.code === "P2002" ||
        (typeof errorObj?.message === "string" &&
          errorObj.message.includes("Unique constraint failed"))
      ) {
        const response = NextResponse.json(
          {
            error: "A case study with this slug already exists",
            details: [
              {
                path: "slug",
                message: "A case study with this slug already exists",
              },
            ],
          },
          { status: 400 }
        );
        return applySecurityHeaders(response, req);
      }

      logger.error("Unhandled API route exception:", err);
      const response = NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
      return applySecurityHeaders(response, req);
    }
  };
  wrapped.auth = options?.auth ?? "public";
  return wrapped;
}

export const withApiWrapper = createApiHandler;
