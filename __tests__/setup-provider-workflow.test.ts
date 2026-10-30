// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runSetupWorkflow, type SetupPrompter } from "@/lib/dx/setup";

describe("provider setup validation", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "provider-setup-"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ engines: { node: ">=18" } })
    );
    fs.writeFileSync(path.join(root, "package-lock.json"), "{}");
    fs.writeFileSync(path.join(root, ".env.example"), 'CRON_SECRET=""\n');
    fs.writeFileSync(
      path.join(root, ".env.local"),
      'CRON_SECRET="a-long-existing-test-secret-value"\nRESEND_API_KEY="re_existing"\n'
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  async function setup(replacement: string, dryRun = false) {
    const logs: string[] = [];
    const commands: string[] = [];
    const prompter: SetupPrompter = {
      interactive: true,
      confirm: async (question) => question.includes("RESEND_API_KEY"),
      choose: async (question, choices, fallback) =>
        question.includes("Guided dashboard")
          ? (choices.find((choice) => choice === "manual") ?? fallback)
          : fallback,
      secret: async (question) =>
        question.startsWith("RESEND_API_KEY") ? replacement : "",
      input: async () => "",
    };
    const result = await runSetupWorkflow({
      workspaceRoot: root,
      profile: "local-minimal",
      skipDb: true,
      integrations: ["resend"],
      publish: "vercel",
      publishEnvironment: "preview",
      dryRun,
      prompter,
      log: (line) => logs.push(line),
      run: async (command) => {
        commands.push(command);
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    return {
      result,
      logs,
      commands,
      content: fs.readFileSync(path.join(root, ".env.local"), "utf8"),
    };
  }

  it("preserves the prior value and refuses publication for an invalid replacement", async () => {
    const outcome = await setup("bad-secret-value");
    expect(outcome.content).toContain('RESEND_API_KEY="re_existing"');
    expect(outcome.result.integrations[0].status).toBe("manual");
    expect(outcome.result.integrations[0].written).toEqual([]);
    expect(outcome.commands).not.toContain("vercel");
    expect(outcome.logs.join(" ")).not.toContain("bad-secret-value");
    expect(outcome.logs.join(" ")).toContain("not saved or published");
  });

  it("rejects a placeholder replacement", async () => {
    const outcome = await setup("re_example");
    expect(outcome.content).toContain('RESEND_API_KEY="re_existing"');
    expect(outcome.result.integrations[0].status).toBe("manual");
    expect(outcome.commands).not.toContain("vercel");
  });

  it("saves a valid replacement and respects dry run", async () => {
    const dry = await setup("re_newvalue", true);
    expect(dry.content).toContain('RESEND_API_KEY="re_existing"');
    const saved = await setup("re_newvalue");
    expect(saved.content).toContain('RESEND_API_KEY="re_newvalue"');
    expect(saved.result.integrations[0].written).toContain("RESEND_API_KEY");
  });

  it("does not publish when a value cannot be written safely", async () => {
    const outcome = await setup('re_unsafe"value');
    expect(outcome.content).toContain('RESEND_API_KEY="re_existing"');
    expect(
      outcome.result.stages.find((stage) => stage.id === "integrations")?.status
    ).toBe("failed");
    expect(outcome.commands).not.toContain("vercel");
    expect(JSON.stringify(outcome.result)).not.toContain('re_unsafe"value');
  });

  it("preserves the file and does not publish if the atomic rename fails", async () => {
    const rename = vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("simulated rename failure");
    });
    try {
      const outcome = await setup("re_newvalue");
      expect(outcome.content).toContain('RESEND_API_KEY="re_existing"');
      expect(outcome.commands).not.toContain("vercel");
      expect(
        outcome.result.stages.find((stage) => stage.id === "integrations")
          ?.status
      ).toBe("failed");
    } finally {
      rename.mockRestore();
    }
  });

  it("does not save optional values when required values are absent", async () => {
    fs.writeFileSync(
      path.join(root, ".env.local"),
      'CRON_SECRET="a-long-existing-test-secret-value"\n'
    );
    const prompter: SetupPrompter = {
      interactive: true,
      confirm: async () => false,
      choose: async (question, choices, fallback) =>
        question.includes("Guided dashboard")
          ? (choices.find((choice) => choice === "manual") ?? fallback)
          : fallback,
      secret: async (question) =>
        question.startsWith("RESEND_WEBHOOK_SECRET") ? "whsec_example" : "",
      input: async () => "",
    };
    const result = await runSetupWorkflow({
      workspaceRoot: root,
      profile: "local-minimal",
      skipDb: true,
      integrations: ["resend"],
      prompter,
      log: () => undefined,
    });
    expect(result.integrations[0].status).toBe("manual");
    expect(
      fs.readFileSync(path.join(root, ".env.local"), "utf8")
    ).not.toContain("whsec_example");
  });
});
