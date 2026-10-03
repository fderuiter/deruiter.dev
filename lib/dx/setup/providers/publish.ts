import { classifyEnvKey } from "../environment";
import type { SetupPrompter } from "../prompts";
import type { PublishDestination } from "./types";

/** Result of one external command. */
export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs a command without a shell. `input` is written to stdin, which is how
 * every credential reaches a CLI: never as an argument, where it would show
 * up in process listings and shell history.
 */
export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { input?: string; cwd?: string }
) => Promise<CommandResult>;

/** Vercel environments a value can be scoped to. */
export const VERCEL_ENVIRONMENTS = [
  "development",
  "preview",
  "production",
] as const;

/** One Vercel environment. */
export type VercelEnvironment = (typeof VERCEL_ENVIRONMENTS)[number];

/** A request to publish named keys to one destination. */
export interface PublishRequest {
  destination: PublishDestination;
  /** Vercel environment, or a GitHub Actions environment name ("" = repository). */
  environment: string;
  values: Readonly<Record<string, string>>;
  keys: readonly string[];
}

/** What happened to a publish request. Lists names only. */
export interface PublishOutcome {
  destination: PublishDestination;
  environment: string;
  published: string[];
  failed: string[];
  refused?: string;
}

const PRODUCTION_PHRASE = "publish to production";

async function isAuthenticated(
  destination: PublishDestination,
  run: CommandRunner
): Promise<boolean> {
  const result =
    destination === "github"
      ? await run("gh", ["auth", "status"])
      : await run("vercel", ["whoami"]);
  return result.code === 0;
}

function describeTarget(request: PublishRequest): string {
  if (request.destination === "vercel") {
    return `Vercel ${request.environment} environment`;
  }
  return request.environment
    ? `GitHub Actions environment "${request.environment}"`
    : "GitHub Actions repository secrets and variables";
}

/**
 * Publishes values to GitHub or Vercel, but only after every safeguard
 * passes: a person is present, the destination CLI is already signed in,
 * the Vercel environment is a real one, the person confirms the exact key
 * names and target, and a production target is confirmed a second time by
 * typing a fixed phrase. Values travel over stdin; summaries carry names.
 */
export async function publishToDestination(
  request: PublishRequest,
  prompter: SetupPrompter,
  run: CommandRunner
): Promise<PublishOutcome> {
  const outcome: PublishOutcome = {
    destination: request.destination,
    environment: request.environment,
    published: [],
    failed: [],
  };
  const keys = request.keys.filter(
    (key) => (request.values[key] ?? "").trim() !== ""
  );

  if (!prompter.interactive) {
    outcome.refused =
      "Publishing needs a person to confirm it, so non-interactive runs never publish.";
    return outcome;
  }
  if (keys.length === 0) {
    outcome.refused = "No values to publish.";
    return outcome;
  }
  if (
    request.destination === "vercel" &&
    !(VERCEL_ENVIRONMENTS as readonly string[]).includes(request.environment)
  ) {
    outcome.refused = `Unknown Vercel environment "${request.environment}".`;
    return outcome;
  }
  if (!(await isAuthenticated(request.destination, run))) {
    outcome.refused =
      request.destination === "github"
        ? "The GitHub CLI is not signed in; run gh auth login first."
        : "The Vercel CLI is not signed in; run vercel login and vercel link first.";
    return outcome;
  }

  const target = describeTarget(request);
  if (
    !(await prompter.confirm(
      `Publish ${keys.join(", ")} to the ${target}?`,
      false
    ))
  ) {
    outcome.refused = "Not confirmed.";
    return outcome;
  }
  if (request.environment === "production") {
    const typed = await prompter.input(
      `This changes production. Type "${PRODUCTION_PHRASE}" to continue:`
    );
    if (typed !== PRODUCTION_PHRASE) {
      outcome.refused = "Production publish not confirmed.";
      return outcome;
    }
  }

  for (const key of keys) {
    const value = request.values[key];
    let args: string[];
    if (request.destination === "vercel") {
      args = ["env", "add", key, request.environment];
    } else {
      const kind = classifyEnvKey(key).secret ? "secret" : "variable";
      args = [kind, "set", key];
      if (request.environment) args.push("--env", request.environment);
    }
    const command = request.destination === "vercel" ? "vercel" : "gh";
    const result = await run(command, args, { input: value });
    if (result.code === 0) outcome.published.push(key);
    else outcome.failed.push(key);
  }
  return outcome;
}
