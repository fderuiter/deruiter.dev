import { describe, it, expect, afterEach } from "vitest";
import { sanitizeError, sanitizeString } from "@/lib/error-sanitization";

const setEnv = (value: string | undefined) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

describe("sanitizeString edge cases", () => {
  it("returns empty and falsy input unchanged", () => {
    expect(sanitizeString("")).toBe("");
    expect(sanitizeString(undefined as unknown as string)).toBeUndefined();
    expect(sanitizeString(null as unknown as string)).toBeNull();
  });

  it("scrubs extension paths outside the system roots", () => {
    expect(sanitizeString("at /srv/site/a.js")).toBe("at [scrubbed]");
    expect(sanitizeString("at /srv/x/y/z/main.py")).toBe("at [scrubbed]");
    expect(sanitizeString("see /w/ab-c.d/_x.PNG".toLowerCase())).toBe(
      "see [scrubbed]"
    );
    expect(sanitizeString("at /srv/site/report.md ok")).toBe(
      "at [scrubbed] ok"
    );
  });

  it("scrubs multi-character directory names and multi-character file stems", () => {
    expect(sanitizeString("/dir1/dir2/file.png")).toBe("[scrubbed]");
    expect(sanitizeString("/aa/bbb.gif")).toBe("[scrubbed]");
  });

  it("does not scrub a bare single-segment file name", () => {
    expect(sanitizeString("/file.png")).toBe("/file.png");
  });
});

describe("sanitizeError in production", () => {
  const original = process.env.NODE_ENV;
  afterEach(() => setEnv(original));

  it("returns falsy values as-is in every environment", () => {
    setEnv("production");
    expect(sanitizeError(null)).toBeNull();
    expect(sanitizeError(undefined)).toBeUndefined();
    expect(sanitizeError("")).toBe("");
    expect(sanitizeError(0)).toBe(0);
    setEnv("development");
    expect(sanitizeError(null)).toBeNull();
  });

  it("defaults message to empty and name to Error when not strings", () => {
    setEnv("production");
    const out = sanitizeError({ message: 42, name: 7 }) as Error;
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe("");
    expect(out.name).toBe("Error");
  });

  it("preserves a string name and sanitizes the message", () => {
    setEnv("production");
    const out = sanitizeError({
      message: "boom at /app/lib/x.ts",
      name: "TypeError",
    }) as Error;
    expect(out.message).toBe("boom at [scrubbed]");
    expect(out.name).toBe("TypeError");
  });

  it("keeps only the sanitized first stack line and drops non-string stacks", () => {
    setEnv("production");
    const withStack = sanitizeError({
      message: "m",
      stack: "Error: at /app/lib/x.ts\n    at foo (/app/lib/y.ts:1:1)",
    }) as Error;
    expect(withStack.stack).toBe("Error: at [scrubbed]");
    const emptyStack = sanitizeError({ message: "m", stack: "" }) as Error;
    expect(emptyStack.stack).toBe("");
    const noStack = sanitizeError({ message: "m", stack: 5 }) as Error;
    expect(noStack.stack).toBeUndefined();
  });

  it("skips reserved, trace, frame, sentry and array fields case-insensitively", () => {
    setEnv("production");
    const out = sanitizeError({
      message: "m",
      code: "E1",
      StackTrace: "x",
      traceId: "t",
      Frames: "f",
      myframe: "f",
      SentryEvent: "s",
      list: [1],
    }) as unknown as Record<string, unknown>;
    expect(out.code).toBe("E1");
    for (const k of [
      "StackTrace",
      "traceId",
      "Frames",
      "myframe",
      "SentryEvent",
      "list",
    ]) {
      expect(out).not.toHaveProperty(k);
    }
  });

  it("does not copy reserved keys onto the result as extra fields", () => {
    setEnv("production");
    const out = sanitizeError({
      message: "m",
      name: "N",
      cause: undefined,
    }) as unknown as Record<string, unknown>;
    expect(out.name).toBe("N");
    expect(out.cause).toBeUndefined();
    expect(Object.keys(out)).not.toContain("cause");
  });

  it("sanitizes string fields and deep-sanitizes object fields", () => {
    setEnv("production");
    const out = sanitizeError({
      message: "m",
      path: "at /app/lib/x.ts",
      meta: { label: "ok", n: 1 },
      count: 3,
      flag: false,
      nothing: null,
    }) as unknown as Record<string, unknown>;
    expect(out.path).toBe("at [scrubbed]");
    expect(out.meta).toEqual({ label: "ok", n: 1 });
    expect(out.count).toBe(3);
    expect(out.flag).toBe(false);
    expect(out.nothing).toBeNull();
  });

  it("skips object fields that cannot be serialized", () => {
    setEnv("production");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const out = sanitizeError({
      message: "m",
      circular,
    }) as unknown as Record<string, unknown>;
    expect(out).not.toHaveProperty("circular");
  });

  it("recursively sanitizes cause only when truthy", () => {
    setEnv("production");
    const out = sanitizeError({
      message: "outer",
      cause: { message: "inner /app/lib/x.ts", name: "Inner" },
    }) as unknown as { cause: Error };
    expect(out.cause).toBeInstanceOf(Error);
    expect(out.cause.message).toBe("inner [scrubbed]");
    const strCause = sanitizeError({
      message: "o",
      cause: "at /app/lib/x.ts",
    }) as unknown as { cause: string };
    expect(strCause.cause).toBe("at [scrubbed]");
    const none = sanitizeError({ message: "o", cause: 0 });
    expect(none).not.toHaveProperty("cause", 0);
    expect((none as Error).cause).toBeUndefined();
  });

  it("returns the original error outside production", () => {
    setEnv("test");
    const e = { message: "/app/lib/x.ts" };
    expect(sanitizeError(e)).toBe(e);
  });
});
