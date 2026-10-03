// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  ENV_KEY_CLASSIFICATION,
  PROVIDER_ADAPTERS,
  publishToDestination,
  resolveProviderAdapters,
  type CommandRunner,
  type ProbeFetch,
  type SetupPrompter,
} from "@/lib/dx/setup";

function prompter(options: {
  interactive?: boolean;
  confirm?: boolean;
  typed?: string;
}): SetupPrompter {
  return {
    interactive: options.interactive ?? true,
    confirm: async () => options.confirm ?? true,
    input: async () => options.typed ?? "",
    secret: async () => "",
    choose: async (_question, _choices, fallback) => fallback,
  };
}

function recordingRunner(authenticated = true) {
  const calls: { command: string; args: readonly string[]; input?: string }[] =
    [];
  const run: CommandRunner = async (command, args, options = {}) => {
    calls.push({ command, args, input: options.input });
    const isAuthCheck =
      (command === "gh" && args[0] === "auth") ||
      (command === "vercel" && args[0] === "whoami");
    return {
      code: isAuthCheck && !authenticated ? 1 : 0,
      stdout: "",
      stderr: "",
    };
  };
  return { run, calls };
}

const adapter = (id: string) => resolveProviderAdapters([id]).adapters[0];

describe("setup provider adapters (#984)", () => {
  it("covers every integration lib/env.ts represents", () => {
    const ids = PROVIDER_ADAPTERS.map((entry) => entry.id);
    expect(ids).toEqual([
      "postgres",
      "upstash-redis",
      "upstash-qstash",
      "clerk",
      "resend",
      "sentry",
      "vercel",
      "github",
      "vercel-blob",
    ]);
  });

  it("describes each adapter completely, with only classified keys and existing docs", () => {
    for (const entry of PROVIDER_ADAPTERS) {
      expect(entry.keys.length).toBeGreaterThan(0);
      expect(entry.keys.some((key) => key.required)).toBe(true);
      for (const key of entry.keys) {
        expect(ENV_KEY_CLASSIFICATION[key.name]).toBeDefined();
      }
      expect(entry.guidedSteps.length).toBeGreaterThan(0);
      expect(entry.manualPath).not.toBe("");
      expect(entry.degraded).not.toBe("");
      expect(entry.portability.note).not.toBe("");
      const docFile = entry.docs.split("#")[0];
      expect(fs.existsSync(path.join(process.cwd(), docFile))).toBe(true);
    }
  });

  it("links to headings that exist in the integrations guide", () => {
    const guide = fs.readFileSync(
      path.join(process.cwd(), "docs/how-to/configure-integrations.md"),
      "utf-8"
    );
    const slugs = guide
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) =>
        line
          .slice(3)
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, "")
          .replace(/ /g, "-")
      );
    for (const entry of PROVIDER_ADAPTERS) {
      const [file, anchor] = entry.docs.split("#");
      if (file === "docs/how-to/configure-integrations.md" && anchor) {
        expect(slugs).toContain(anchor);
      }
    }
  });

  it("names platform-specific integrations honestly", () => {
    expect(adapter("upstash-redis").portability.portable).toBe(true);
    expect(adapter("sentry").portability.portable).toBe(true);
    expect(adapter("clerk").portability.portable).toBe(false);
    expect(adapter("postgres").portability.note).toMatch(/WebSocket/);
  });

  it("reports unknown adapter ids", () => {
    expect(resolveProviderAdapters(["clerk", "nope"]).unknown).toEqual([
      "nope",
    ]);
  });

  describe("offline validation", () => {
    it("is not-checked when nothing is configured", () => {
      for (const entry of PROVIDER_ADAPTERS) {
        expect(entry.validate({}).status).toBe("not-checked");
      }
    });

    it("lists missing required keys by name", () => {
      const result = adapter("clerk").validate({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
      });
      expect(result).toEqual({
        status: "failed",
        detail: "Missing CLERK_SECRET_KEY.",
      });
    });

    it("checks shapes without the network", () => {
      expect(
        adapter("clerk").validate({
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
          CLERK_SECRET_KEY: "sk_live_abc",
        }).detail
      ).toMatch(/different instances/);
      expect(
        adapter("upstash-redis").validate({
          UPSTASH_REDIS_REST_URL: "http://cache.internal",
          UPSTASH_REDIS_REST_TOKEN: "t",
        }).status
      ).toBe("failed");
      expect(
        adapter("upstash-redis").validate({
          UPSTASH_REDIS_REST_URL: "http://localhost:8079",
          UPSTASH_REDIS_REST_TOKEN: "t",
        }).status
      ).toBe("schema-valid");
      expect(
        adapter("sentry").validate({
          NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123",
        }).status
      ).toBe("schema-valid");
      expect(
        adapter("postgres").validate({
          DATABASE_URL: "mysql://x",
          DATABASE_URL_UNPOOLED: "postgresql://x@y/z",
        }).detail
      ).toMatch(/DATABASE_URL is not a postgres/);
      expect(adapter("github").validate({ GITHUB_TOKEN: "t" }).status).toBe(
        "configured"
      );
    });
  });

  describe("live probes", () => {
    it("are read-only GETs that report status codes, not bodies", async () => {
      const seen: { url: string; method: string; auth?: string }[] = [];
      const fetch: ProbeFetch = async (url, init) => {
        seen.push({
          url,
          method: init.method,
          auth: init.headers.Authorization,
        });
        return {
          ok: true,
          status: 200,
          text: async () =>
            url.endsWith("/ping") ? '{"result":"PONG"}' : "{}",
        };
      };
      const values = {
        UPSTASH_REDIS_REST_URL: "https://eu1.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        CLERK_SECRET_KEY: "sk_test_abc",
        RESEND_API_KEY: "re_abc",
        GITHUB_TOKEN: "gh-token",
      };
      for (const id of ["upstash-redis", "clerk", "resend", "github"]) {
        const result = await adapter(id).probe!({
          values,
          fetch,
          timeoutMs: 50,
        });
        expect(result.status).toBe("live-verified");
      }
      expect(seen.every((entry) => entry.method === "GET")).toBe(true);
      expect(seen.map((entry) => entry.url)).toEqual([
        "https://eu1.upstash.io/ping",
        "https://api.clerk.com/v1/jwks",
        "https://api.resend.com/domains",
        "https://api.github.com/rate_limit",
      ]);
      expect(seen[0].auth).toBe("Bearer redis-token");
    });

    it("never treats a sending-only Resend key as live-verified", async () => {
      const fetch: ProbeFetch = async () => ({
        ok: false,
        status: 401,
        text: async () => '{"name":"restricted_api_key"}',
      });
      const result = await adapter("resend").probe!({
        values: { RESEND_API_KEY: "re_abc" },
        fetch,
        timeoutMs: 50,
      });
      expect(result.status).toBe("configured");
    });

    it("maps rejections, errors and timeouts to failed without echoing the body", async () => {
      const rejecting: ProbeFetch = async () => ({
        ok: false,
        status: 401,
        text: async () => "secret-echo",
      });
      const failed = await adapter("clerk").probe!({
        values: { CLERK_SECRET_KEY: "sk_test_abc" },
        fetch: rejecting,
        timeoutMs: 50,
      });
      expect(failed).toEqual({
        status: "failed",
        detail: "Provider answered HTTP 401.",
      });

      const hanging: ProbeFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      const slow = await adapter("github").probe!({
        values: { GITHUB_TOKEN: "t" },
        fetch: hanging,
        timeoutMs: 10,
      });
      expect(slow.detail).toBe("No answer within 10 ms.");
    });

    it("never probes providers whose only check would send data", () => {
      for (const id of [
        "sentry",
        "vercel-blob",
        "upstash-qstash",
        "vercel",
        "postgres",
      ]) {
        expect(adapter(id).probe).toBeUndefined();
      }
    });
  });

  describe("publishing", () => {
    const values = {
      CLERK_SECRET_KEY: "sk_test_s3cret",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_pub",
    };
    const keys = ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    it("never publishes from a non-interactive run", async () => {
      const { run, calls } = recordingRunner();
      const outcome = await publishToDestination(
        { destination: "vercel", environment: "preview", values, keys },
        prompter({ interactive: false }),
        run
      );
      expect(outcome.refused).toMatch(/non-interactive/);
      expect(calls).toEqual([]);
    });

    it("checks the CLI is signed in before asking anything", async () => {
      const { run, calls } = recordingRunner(false);
      const outcome = await publishToDestination(
        { destination: "github", environment: "", values, keys },
        prompter({}),
        run
      );
      expect(outcome.refused).toMatch(/gh auth login/);
      expect(calls).toHaveLength(1);
    });

    it("rejects unknown Vercel environments", async () => {
      const { run } = recordingRunner();
      const outcome = await publishToDestination(
        { destination: "vercel", environment: "staging", values, keys },
        prompter({}),
        run
      );
      expect(outcome.refused).toMatch(/Unknown Vercel environment/);
    });

    it("stops when the person declines", async () => {
      const { run, calls } = recordingRunner();
      const outcome = await publishToDestination(
        { destination: "vercel", environment: "preview", values, keys },
        prompter({ confirm: false }),
        run
      );
      expect(outcome.refused).toBe("Not confirmed.");
      expect(calls).toHaveLength(1);
    });

    it("needs the typed phrase for production", async () => {
      const { run } = recordingRunner();
      const refused = await publishToDestination(
        { destination: "vercel", environment: "production", values, keys },
        prompter({ typed: "yes" }),
        run
      );
      expect(refused.refused).toBe("Production publish not confirmed.");

      const accepted = await publishToDestination(
        { destination: "vercel", environment: "production", values, keys },
        prompter({ typed: "publish to production" }),
        run
      );
      expect(accepted.published).toEqual(keys);
    });

    it("sends values over stdin, never as arguments, and reports names only", async () => {
      const { run, calls } = recordingRunner();
      const outcome = await publishToDestination(
        { destination: "github", environment: "preview", values, keys },
        prompter({}),
        run
      );
      const writes = calls.slice(1);
      expect(writes.map((call) => call.args)).toEqual([
        ["secret", "set", "CLERK_SECRET_KEY", "--env", "preview"],
        [
          "variable",
          "set",
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
          "--env",
          "preview",
        ],
      ]);
      expect(writes.map((call) => call.input)).toEqual([
        "sk_test_s3cret",
        "pk_test_pub",
      ]);
      expect(JSON.stringify(calls.map((call) => call.args))).not.toContain(
        "s3cret"
      );
      expect(JSON.stringify(outcome)).not.toContain("s3cret");

      const vercel = recordingRunner();
      await publishToDestination(
        { destination: "vercel", environment: "development", values, keys },
        prompter({}),
        vercel.run
      );
      expect(vercel.calls[1].args).toEqual([
        "env",
        "add",
        "CLERK_SECRET_KEY",
        "development",
      ]);
    });
  });
});
