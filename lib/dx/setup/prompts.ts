import readline from "readline";

/**
 * Thrown when the user cancels a prompt with Ctrl-C. The workflow catches it,
 * records the current stage as `cancelled`, saves state and exits 130.
 */
export class SetupCancelledError extends Error {
  constructor() {
    super("Setup cancelled by the user.");
    this.name = "SetupCancelledError";
  }
}

/**
 * Everything the setup framework asks a person. Implementations decide how:
 * the terminal prompter reads from a TTY, the non-interactive prompter never
 * blocks and answers every question with its safe default.
 */
export interface SetupPrompter {
  /** False when no person can answer; callers treat missing answers as manual work. */
  readonly interactive: boolean;
  /** Yes/no question. `defaultYes` decides what Enter means. */
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  /** Visible free-text input. Returns "" when nothing was entered. */
  input(question: string): Promise<string>;
  /** Hidden input for secrets: nothing typed is echoed. */
  secret(question: string): Promise<string>;
  /** Pick one of `choices`; returns `fallback` on empty input. */
  choose<T extends string>(
    question: string,
    choices: readonly T[],
    fallback: T
  ): Promise<T>;
}

/**
 * A prompter for agents, CI and `--yes`: never reads input. Confirmations
 * resolve to `false` unless the question's default is yes and `acceptDefaults`
 * is set, so a non-interactive run can never agree to a risky step on its own.
 */
export function createNonInteractivePrompter(
  acceptDefaults = false
): SetupPrompter {
  return {
    interactive: false,
    async confirm(_question, defaultYes = false) {
      return acceptDefaults && defaultYes;
    },
    async input() {
      return "";
    },
    async secret() {
      return "";
    },
    async choose(_question, _choices, fallback) {
      return fallback;
    },
  };
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    let answered = false;
    rl.on("SIGINT", () => {
      rl.close();
      if (!answered) reject(new SetupCancelledError());
    });
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    // Without a TTY there is no way to stop the terminal echoing input, so
    // refuse rather than risk printing a secret.
    return Promise.resolve("");
  }
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: Buffer | string) => {
      for (const ch of chunk.toString("utf8")) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          cleanup();
          resolve(value.trim());
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new SetupCancelledError());
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

/** Terminal prompter used when a person runs setup in a TTY. */
export function createTerminalPrompter(): SetupPrompter {
  return {
    interactive: true,
    async confirm(question, defaultYes = false) {
      const answer = (
        await ask(`  ? ${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)
      ).toLowerCase();
      if (!answer) return defaultYes;
      return answer === "y" || answer === "yes";
    },
    async input(question) {
      return ask(`  ${question} `);
    },
    async secret(question) {
      return askHidden(`  ${question} (input hidden) `);
    },
    async choose(question, choices, fallback) {
      const answer = await ask(
        `  ? ${question} (${choices.join(" / ")}) [${fallback}] `
      );
      return (choices as readonly string[]).includes(answer)
        ? (answer as (typeof choices)[number])
        : fallback;
    },
  };
}
