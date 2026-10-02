// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import readline from "readline";
import { fromPartial } from "@total-typescript/shoehorn";

const { mockExecFileSync } = vi.hoisted(() => {
  return {
    mockExecFileSync: vi.fn(),
  };
});

vi.mock("child_process", () => {
  return {
    execFileSync: mockExecFileSync,
    execSync: vi.fn(),
    default: {
      execFileSync: mockExecFileSync,
      execSync: vi.fn(),
    },
  };
});

import { handleCommitCommand } from "../scripts/dx";

describe("DX Commit Wizard Direct Array Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes git commit via execFileSync with discrete argument array when user inputs metacharacters", async () => {
    const answers = [
      "fix",
      "dx",
      "support `backticks` & $(whoami); unescaped",
      "N",
    ];
    let answerIdx = 0;

    const mockRl = {
      question: vi.fn((_q: string, cb: (ans: string) => void) => {
        cb(answers[answerIdx++] || "");
      }),
      close: vi.fn(),
    };

    const rlSpy = vi
      .spyOn(readline, "createInterface")
      .mockReturnValue(fromPartial<readline.Interface>(mockRl));

    await handleCommitCommand();

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "fix(dx): support `backticks` & $(whoami); unescaped"],
      { stdio: "inherit" }
    );

    rlSpy.mockRestore();
  });

  it("handles breaking changes and scopes correctly", async () => {
    const answers = ["feat", "auth", "replace session cookie format", "y"];
    let answerIdx = 0;

    const mockRl = {
      question: vi.fn((_q: string, cb: (ans: string) => void) => {
        cb(answers[answerIdx++] || "");
      }),
      close: vi.fn(),
    };

    const rlSpy = vi
      .spyOn(readline, "createInterface")
      .mockReturnValue(fromPartial<readline.Interface>(mockRl));

    await handleCommitCommand();

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "feat(auth)!: replace session cookie format"],
      { stdio: "inherit" }
    );

    rlSpy.mockRestore();
  });

  it("executes non-interactively when type and subject are passed via flags", async () => {
    const rlSpy = vi.spyOn(readline, "createInterface");

    await handleCommitCommand([
      "--type",
      "feat",
      "--scope",
      "dx",
      "--subject",
      "add non interactive bypass",
      "--yes",
    ]);

    expect(rlSpy).not.toHaveBeenCalled();
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "feat(dx): add non interactive bypass"],
      { stdio: "inherit" }
    );

    rlSpy.mockRestore();
  });

  it("supports --dry-run to validate commit message without executing git", async () => {
    const rlSpy = vi.spyOn(readline, "createInterface");

    await handleCommitCommand([
      "--type",
      "docs",
      "--subject",
      "update readme",
      "--dry-run",
    ]);

    expect(rlSpy).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();

    rlSpy.mockRestore();
  });
});
