import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applySecurityHeaders } from "@/lib/security-headers";
import { logger } from "@/lib/logger";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { validateSyncRequest } from "@/lib/security";
import type { ServiceFailure } from "@/lib/services/service-result";

export type ApiAuthRequirement = "clerk_admin" | "cron_secret" | "public";

/**
 * Maps a typed domain error code from a `ServiceFailure` envelope to its
 * canonical HTTP status code so routes translate domain errors uniformly.
 */
export function mapServiceErrorToHttpStatus(
  code: string,
  fallbackStatus = 500
): number {
  const normalized = code.trim().toUpperCase();

  if (
    normalized === "NOT_FOUND" ||
    normalized.endsWith("_NOT_FOUND") ||
    normalized === "INVALID_TOKEN"
  ) {
    return 404;
  }

  if (normalized === "CONFLICT" || normalized.startsWith("DUPLICATE_")) {
    return 409;
  }

  if (normalized === "RATE_LIMITED" || normalized.startsWith("TOO_MANY_")) {
    return 429;
  }

  if (normalized === "UNAUTHORIZED" || normalized === "INVALID_SIGNATURE") {
    return 401;
  }

  if (normalized === "FORBIDDEN") {
    return 403;
  }

  if (normalized === "PAYLOAD_TOO_LARGE") {
    return 413;
  }

  if (normalized === "UNSUPPORTED_MEDIA_TYPE") {
    return 415;
  }

  if (
    normalized === "UNPROCESSABLE_ENTITY" ||
    normalized === "SCHEMA_VALIDATION_FAILED"
  ) {
    return 422;
  }

  if (
    normalized === "VALIDATION_ERROR" ||
    normalized === "BAD_REQUEST" ||
    normalized.startsWith("INVALID_") ||
    normalized.startsWith("EMPTY_") ||
    normalized.startsWith("MISSING_") ||
    normalized.startsWith("MALFORMED_")
  ) {
    return 400;
  }

  if (
    normalized === "STORAGE_UNAVAILABLE" ||
    normalized === "PERSISTENCE_FAILED" ||
    normalized === "QUEUE_LEASE_FAILED" ||
    normalized === "FLUSH_FAILED" ||
    normalized === "PROVIDER_UNAVAILABLE" ||
    normalized.startsWith("STORAGE_") ||
    normalized.startsWith("DATABASE_") ||
    normalized.startsWith("REDIS_")
  ) {
    return 503;
  }

  return fallbackStatus;
}

/** Options controlling how a `ServiceFailure` is converted to an HTTP response. */
export interface ServiceFailureResponseOptions {
  fallbackStatus?: number;
  statusOverrides?: Readonly<Record<string, number>>;
  errorMessage?: string;
  details?: ApiValidationDetail[];
  extraBody?: Readonly<Record<string, unknown>>;
  logContext?: string;
  logMeta?: Record<string, unknown>;
  suppressErrorLog?: boolean;
}

/**
 * Translates a `ServiceFailure` envelope into a JSON `NextResponse` and
 * performs single-pass error logging for 5xx failures, forwarding raw `Error`
 * instances to `StructuredLogger` so Sentry retains multi-frame stack traces.
 */
export function serviceFailureResponse(
  failure: ServiceFailure<string>,
  options?: ServiceFailureResponseOptions
): NextResponse {
  const status =
    options?.statusOverrides?.[failure.error.code] ??
    mapServiceErrorToHttpStatus(
      failure.error.code,
      options?.fallbackStatus ?? 500
    );

  if (!options?.suppressErrorLog && status >= 500) {
    const rawCause =
      failure.error.details instanceof Error
        ? failure.error.details
        : new Error(failure.error.message);
    logger.error(
      options?.logContext ?? `API service failure (${failure.error.code}):`,
      rawCause,
      options?.logMeta
    );
  }

  return NextResponse.json(
    {
      error: options?.errorMessage ?? failure.error.message,
      ...(options?.details ? { details: options.details } : {}),
      ...(options?.extraBody ?? {}),
    },
    { status }
  );
}

export interface ApiWrapperOptions<TSchema extends z.ZodType = z.ZodType> {
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
export function createApiHandler<TSchema extends z.ZodType>(
  handler: ApiHandler<z.infer<TSchema>>,
  options: ApiWrapperOptions<TSchema> & { schema: TSchema }
): ApiRouteHandler;

export function createApiHandler(
  handler: ApiHandler<undefined>,
  options?: ApiWrapperOptions
): ApiRouteHandler;

export function createApiHandler<TSchema extends z.ZodType>(
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
