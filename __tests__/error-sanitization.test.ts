/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sanitizeError, sanitizeString } from "@/lib/error-sanitization";

describe("Error Sanitization Utility", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
  });

  describe("sanitizeString", () => {
    it("should scrub Windows absolute system paths", () => {
      const input =
        "Failed to load at C:\\Users\\runner\\project\\app.tsx line 10";
      expect(sanitizeString(input)).toBe(
        "Failed to load at [scrubbed] line 10"
      );
    });

    it("should scrub Unix absolute system paths", () => {
      const input =
        "Failed to compile file at /Users/runner/work/app/app/error.tsx:12:34";
      expect(sanitizeString(input)).toBe(
        "Failed to compile file at [scrubbed]:12:34"
      );
    });

    it("should scrub paths starting with common system root folders", () => {
      expect(
        sanitizeString("Inside /app/lib/utils.ts exception occurred")
      ).toBe("Inside [scrubbed] exception occurred");
      expect(
        sanitizeString(
          "Inside /home/ubuntu/project/index.js exception occurred"
        )
      ).toBe("Inside [scrubbed] exception occurred");
    });

    it("should preserve relative web routes", () => {
      expect(sanitizeString("/api/telemetry")).toBe("/api/telemetry");
      expect(sanitizeString("/case-studies/laser-loon")).toBe(
        "/case-studies/laser-loon"
      );
    });
  });

  describe("sanitizeError in non-production", () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = "development";
    });

    it("should return the original error unmodified in development", () => {
      const rawError = new Error(
        "Something went wrong at /Users/runner/work/file.ts"
      );
      rawError.stack =
        "Error: message\n  at Object.something (/Users/runner/work/file.ts:1:1)";

      const result = sanitizeError(rawError) as Error;
      expect(result).toBe(rawError);
      expect(result.message).toContain("/Users/runner/work/file.ts");
      expect(result.stack).toContain("/Users/runner/work/file.ts");
    });
  });

  describe("sanitizeError in production", () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = "production";
    });

    it("should sanitize the message and name, and not mutate the original error", () => {
      const rawError = new Error(
        "Something went wrong at /Users/runner/work/file.ts"
      );
      rawError.stack =
        "Error: message\n  at Object.something (/Users/runner/work/file.ts:1:1)";

      const result = sanitizeError(rawError) as Error;
      expect(result).not.toBe(rawError); // Should be a new Error instance

      // Check original error is untouched
      expect(rawError.message).toBe(
        "Something went wrong at /Users/runner/work/file.ts"
      );
      expect(rawError.stack).toContain("/Users/runner/work/file.ts");

      // Check result error is sanitized
      expect(result.message).toBe("Something went wrong at [scrubbed]");
      expect(result.stack).toBe("Error: message"); // Deep stack trace removed
    });

    it("should handle plain string errors", () => {
      const result = sanitizeError(
        "Exception at /app/lib/utils.ts occurred"
      ) as string;
      expect(result).toBe("Exception at [scrubbed] occurred");
    });

    it("should skip trace arrays and Sentry fields", () => {
      const rawError: any = new Error("Sentry crash info");
      rawError.sentryError = { id: 123 };
      rawError.traceFrames = [{ file: "/app/app.ts" }];
      rawError.customProp = "Info inside /app/app.ts";

      const result = sanitizeError(rawError) as Error & Record<string, unknown>;
      expect(result.sentryError).toBeUndefined();
      expect(result.traceFrames).toBeUndefined();
      expect(result.customProp).toBe("Info inside [scrubbed]");
    });

    it("handles null, undefined, primitives, non-string messages/names, causes, and circular references", () => {
      expect(sanitizeError(null)).toBeNull();
      expect(sanitizeError(undefined)).toBeUndefined();
      expect(sanitizeError(0)).toBe(0);
      expect(sanitizeError(false)).toBe(false);

      // Non-string message & name
      const nonStrErr: any = { message: 12345, name: true, code: 500 };
      const resNonStr = sanitizeError(nonStrErr) as any;
      expect(resNonStr.message).toBe("");
      expect(resNonStr.name).toBe("Error");
      expect(resNonStr.code).toBe(500);
      expect(resNonStr.stack).toBeUndefined();

      // Error with cause
      const parentErr = new Error("Parent error at /app/main.ts");
      parentErr.cause = new Error("Child cause at /app/child.ts");
      const resCause = sanitizeError(parentErr) as any;
      expect(resCause.message).toBe("Parent error at [scrubbed]");
      expect(resCause.cause.message).toBe("Child cause at [scrubbed]");

      // Circular reference object property
      const circularObj: any = { info: "path /app/test.ts" };
      circularObj.self = circularObj;
      const errWithCircular: any = {
        message: "Circular test",
        details: circularObj,
      };

      let resCircular: any;
      expect(() => {
        resCircular = sanitizeError(errWithCircular);
      }).not.toThrow();
      expect(resCircular.details).toBeUndefined();
    });
  });
});
