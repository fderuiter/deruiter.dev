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

/** Quotes one value as a single literal POSIX shell word. */
export function quotePosixShellArg(value: string): string {
  if (value !== "" && BARE_SAFE.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Joins argv entries into a command line, quoting each one. */
export function formatPosixCommand(argv: readonly string[]): string {
  return argv.map(quotePosixShellArg).join(" ");
}
