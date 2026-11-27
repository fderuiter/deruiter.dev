/**
 * POSIX shell argument serializer for the copyable CRF CLI commands.
 *
 * Each value becomes exactly one literal argv entry when the command is
 * pasted into a POSIX shell (sh, bash, zsh). Single quotes stop every kind of
 * expansion, so `$(...)`, backticks, `;`, newlines and spaces stay text. An
 * embedded single quote closes the quote, adds an escaped quote and reopens
 * it. Plain tokens are left bare so ordinary commands stay readable (#3812).
 */

const BARE_SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

export type PosixShellArgsResult =
  { success: true; args: string[] } | { success: false; error: string };

/** Quotes one value as a single literal POSIX shell word. */
export function quotePosixShellArg(value: string): string {
  if (value !== "" && BARE_SAFE.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Joins argv entries into a command line, quoting each one. */
export function formatPosixCommand(argv: readonly string[]): string {
  return argv.map(quotePosixShellArg).join(" ");
}

/**
 * Tokenizes a POSIX shell command string into literal argv words, unquoting
 * single-quoted and double-quoted segments (including `'\\''` escapes from
 * `quotePosixShellArg`) and rejecting unclosed quotes or trailing escapes.
 */
export function parsePosixShellArgs(input: string): PosixShellArgsResult {
  const args: string[] = [];
  let current = "";
  let hasToken = false;
  let mode: "unquoted" | "single" | "double" = "unquoted";
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (mode === "unquoted") {
      if (/\s/.test(ch)) {
        if (hasToken) {
          args.push(current);
          current = "";
          hasToken = false;
        }
        i++;
        continue;
      }

      if (ch === "'") {
        mode = "single";
        hasToken = true;
        i++;
        continue;
      }

      if (ch === '"') {
        mode = "double";
        hasToken = true;
        i++;
        continue;
      }

      if (ch === "\\") {
        if (i + 1 >= input.length) {
          return {
            success: false,
            error: "Trailing escape backslash in command input",
          };
        }
        if (input[i + 1] === "\n") {
          i += 2;
          continue;
        }
        hasToken = true;
        current += input[i + 1];
        i += 2;
        continue;
      }

      hasToken = true;
      current += ch;
      i++;
      continue;
    }

    if (mode === "single") {
      if (ch === "'") {
        mode = "unquoted";
        i++;
      } else {
        current += ch;
        i++;
      }
      continue;
    }

    // mode === "double"
    if (ch === '"') {
      mode = "unquoted";
      i++;
      continue;
    }

    if (ch === "\\") {
      if (i + 1 >= input.length) {
        return {
          success: false,
          error: "Unclosed double quote in command input",
        };
      }
      const next = input[i + 1];
      if (next === '"' || next === "\\" || next === "$" || next === "`") {
        current += next;
        i += 2;
      } else if (next === "\n") {
        i += 2;
      } else {
        current += "\\" + next;
        i += 2;
      }
      continue;
    }

    current += ch;
    i++;
  }

  if (mode === "single") {
    return {
      success: false,
      error: "Unclosed single quote in command input",
    };
  }

  if (mode === "double") {
    return {
      success: false,
      error: "Unclosed double quote in command input",
    };
  }

  if (hasToken) {
    args.push(current);
  }

  return { success: true, args };
}
