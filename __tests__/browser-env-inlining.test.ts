// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { clientEnvSchema, mergeInlinedEnv, validateEnv } from "@/lib/env";
import {
  checkClientEnvironmentReads,
  checkClientEnvReads,
} from "@/lib/dx/env-guard";

const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "client-env-"));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe("browser env inlining (#2780)", () => {
  it("reads the inlined values when the browser's process.env object is empty", () => {
    const { data } = validateEnv(
      mergeInlinedEnv(
        {},
        {
          NODE_ENV: "production",
          NEXT_PUBLIC_SENTRY_DSN: "https://key@o0.ingest.sentry.io/1",
        }
      )
    );
    expect(data.NODE_ENV).toBe("production");
    expect(data.NEXT_PUBLIC_SENTRY_DSN).toBe(
      "https://key@o0.ingest.sentry.io/1"
    );
  });

  it("falls back to the schema default only when nothing was inlined", () => {
    expect(validateEnv(mergeInlinedEnv({}, {})).data.NODE_ENV).toBe(
      "development"
    );
  });

  it("keeps the runtime object's value where nothing was inlined", () => {
    expect(
      mergeInlinedEnv({ NODE_ENV: "test", CI: "true" }, { NODE_ENV: undefined })
    ).toEqual({ NODE_ENV: "test", CI: "true" });
  });

  it("inlines NODE_ENV and every clientEnvSchema key, each spelled out for the bundler", () => {
    const source = fs.readFileSync(path.join(root, "lib/env.ts"), "utf8");
    const body = source.match(
      /function inlinedEnv\(\)[^{]*\{([\s\S]*?)\n\}/
    )?.[1];
    expect(body, "inlinedEnv() in lib/env.ts").toBeDefined();
    const inlined = [
      ...(body ?? "").matchAll(/(\w+):\s*process\.env\.(\w+)/g),
    ].map(([, key, read]) => {
      expect(read, `${key} reads its own name`).toBe(key);
      return key;
    });
    expect(inlined.sort()).toEqual(
      ["NODE_ENV", ...Object.keys(clientEnvSchema.shape)].sort()
    );
  });
});

describe("env-client-reads doctor check (#2780)", () => {
  const write = (file: string, content: string) => {
    const full = path.join(scratch, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };

  it("passes on the repository", () => {
    expect(checkClientEnvironmentReads(root)).toMatchObject({
      id: "env-client-reads",
      status: "pass",
    });
  });

  it("flags a server-only read in a client module and allows the browser-visible ones", () => {
    write(
      "components/Bad.tsx",
      [
        '"use client";',
        'import { env, getEnv } from "@/lib/env";',
        "// env.CRON_SECRET in a comment is fine",
        'export const a = env.VERCEL_ENV === "production";',
        "export const b = getEnv().DATABASE_URL;",
        'export const c = env.NODE_ENV === "production";',
        "export const d = env.NEXT_PUBLIC_APP_URL;",
        "export const e = typeof env.VITEST;",
      ].join("\n")
    );
    write(
      "lib/server-only.ts",
      'import { env } from "./env";\nexport const s = env.CRON_SECRET;\n'
    );
    expect(checkClientEnvReads(scratch).violations).toEqual([
      "components/Bad.tsx:4: env.VERCEL_ENV",
      "components/Bad.tsx:5: env.DATABASE_URL",
    ]);
    const result = checkClientEnvironmentReads(scratch);
    expect(result.status).toBe("fail");
    expect(result.details).toHaveLength(2);
  });
});
