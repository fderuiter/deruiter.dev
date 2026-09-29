import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";
import { applySecurityHeaders } from "@/lib/security-headers";
import { logger } from "@/lib/logger";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { validateSyncRequest } from "@/lib/security";

export type ApiAuthRequirement = "clerk_admin" | "cron_secret" | "public";

export interface ApiWrapperOptions<TSchema extends ZodSchema = ZodSchema> {
  schema?: TSchema;
  type?: "body" | "query";
  customValidationError?: (
    error: unknown,
    req: NextRequest
  ) => { error: string; details?: Array<{ path: string; message: string }> };
  customJsonError?: string;
  defaultStatus?: number;
  auth?: ApiAuthRequirement;
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
            const formatted = options.customValidationError
              ? options.customValidationError(result.error, req)
              : {
                  error: "Validation failed",
                  details: result.error.issues.map((issue) => ({
                    path: issue.path.join(".") || "query",
                    message: issue.message,
                  })),
                };
            const response = NextResponse.json(formatted, { status: 400 });
            return applySecurityHeaders(response, req);
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
            const formatted = options.customValidationError
              ? options.customValidationError(result.error, req)
              : {
                  error: "Validation failed",
                  details: result.error.issues.map((issue) => ({
                    path: issue.path.join(".") || "payload",
                    message: issue.message,
                  })),
                };
            const response = NextResponse.json(formatted, { status: 400 });
            return applySecurityHeaders(response, req);
          }
          validatedData = result.data;
        }
      }

      const response = await handler(req, {
        data: validatedData,
        params: resolvedParams,
      });

      return applySecurityHeaders(response, req);
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
  wrapped.auth = options?.auth || "public";
  return wrapped;
}

export const withApiWrapper = createApiHandler;
