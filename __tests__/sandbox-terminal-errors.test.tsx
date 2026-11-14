// @vitest-environment jsdom
/**
 * Error paths, history navigation, meme command handlers, export and playback
 * edge branches of `components/SandboxTerminal.tsx` (#2532).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { SandboxTerminal } from "@/components/SandboxTerminal";
import { safeStorage } from "@/lib/safe-storage";
import { writeHashParams } from "@/hooks/useStudioHashParams";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import { onAppEvent } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import { FORTUNES } from "@/lib/meme-data";
import {
  generateBashScript,
  generatePythonScript,
} from "@/lib/terminal-script-generator";

const mocks = vi.hoisted(() => ({
  announce: vi.fn(),
  playKeystroke: vi.fn(),
  playAutocomplete: vi.fn(),
  playSuccess: vi.fn(),
  playMemeSound: vi.fn(),
}));

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playKeystroke: mocks.playKeystroke,
      playAutocomplete: mocks.playAutocomplete,
      playSuccess: mocks.playSuccess,
    }),
  };
});

vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({ announce: mocks.announce }),
}));

vi.mock("@/lib/meme-audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meme-audio")>();
  return { ...actual, playMemeSound: mocks.playMemeSound };
});

vi.mock("@/lib/terminal-script-generator", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/terminal-script-generator")>();
  return {
    ...actual,
    generateBashScript: vi.fn(actual.generateBashScript),
    generatePythonScript: vi.fn(actual.generatePythonScript),
  };
});

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

const RESPONSE_LAG_MS = 450;

const getInput = () =>
  screen.getByPlaceholderText<HTMLInputElement>(/Type 'help'/);
const getLog = () => screen.getByRole("log");

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const typeInto = (value: string) => {
  fireEvent.change(getInput(), { target: { value } });
};

const pressKey = (key: string) => {
  fireEvent.keyDown(getInput(), { key });
};

const runCommand = (cmd: string) => {
  typeInto(cmd);
  pressKey("Enter");
  advance(RESPONSE_LAG_MS);
};

/** Time for the simulated typist to finish `cmd` and hand it to executeCommand. */
const typingTime = (cmd: string) => 40 * (cmd.length + 2) + 150;

const errorLines = () =>
  Array.from(getLog().querySelectorAll(".text-red-400\\/90")).map(
    (el) => el.textContent ?? ""
  );

describe("SandboxTerminal error paths and untaken branches", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const storage = new MockStorage();
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
    safeStorage.clear();
    writeHashParams({ terminal_cmd: null });
    workspaceCommandRegistry.clearActions();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    workspaceCommandRegistry.clearActions();
    writeHashParams({ terminal_cmd: null });
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("unknown and failing commands", () => {
    it("reports an unknown command as an error and announces the failure", () => {
      render(<SandboxTerminal />);
      runCommand("definitely-not-a-command");

      expect(errorLines()).toEqual([
        "✖ Command not found: 'definitely-not-a-command'. Type 'help' to review supported registry entries or try 'loon', 'cowsay', or 'duck'.",
      ]);
      expect(mocks.announce).toHaveBeenCalledWith(
        "Command execution failed. Unknown command: 'definitely-not-a-command'.",
        "polite"
      );
      expect(mocks.playSuccess).not.toHaveBeenCalled();
    });

    it.each([
      ["sudo rm -rf /", "Permission denied: Duck", "fda-siren"],
      ["git push --force origin main", "CRITICAL ALERT", "friday-alarm"],
      ["git push -f", "Force-pushing to main", "friday-alarm"],
      ["418", "HTTP 418: I'm a teapot", "teapot-whistle"],
      ["coffee", "Cannot brew coffee", "teapot-whistle"],
      ["tea", "RFC 2324", "teapot-whistle"],
    ])("renders %s as an error line", (cmd, expected, sound) => {
      render(<SandboxTerminal />);
      runCommand(cmd);

      const errors = errorLines();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(expected);
      expect(mocks.playMemeSound).toHaveBeenCalledWith(sound);
      expect(mocks.playSuccess).not.toHaveBeenCalled();
    });

    it("does not treat a plain git push as the force-push easter egg", () => {
      render(<SandboxTerminal />);
      runCommand("git push origin main");

      expect(errorLines()[0]).toContain("Command not found: 'git push origin");
      expect(mocks.playMemeSound).not.toHaveBeenCalled();
    });

    it("ignores a blank submission entirely", () => {
      render(<SandboxTerminal />);
      typeInto("   ");
      pressKey("Enter");
      advance(RESPONSE_LAG_MS);

      expect(mocks.announce).not.toHaveBeenCalled();
      expect(getLog().textContent).not.toContain("imednet-sdk $");
    });

    it("rejects a registered command whose required flag is empty, naming it by title when it has no CLI name", () => {
      workspaceCommandRegistry.registerAction({
        id: "custom:titled",
        title: "Titled Operation",
        subToolId: "test",
        subToolName: "Test",
        flags: { token: { required: true }, mode: { required: false } },
      });
      render(<SandboxTerminal />);
      runCommand("custom:titled --token=");

      expect(errorLines()).toEqual([
        "✖ Parameter validation error: Missing required flag(s) --token for 'Titled Operation'.",
      ]);
      expect(mocks.announce).toHaveBeenCalledWith(
        "Parameter validation failed for command 'custom:titled --token='.",
        "polite"
      );

      // With the flag satisfied and no handler or payload, a generic receipt is rendered.
      runCommand("custom:titled --token abc");
      const text = getLog().textContent ?? "";
      expect(text).toContain('"actionId"');
      expect(text).toContain('"custom:titled"');
      expect(text).toContain('"Titled Operation"');
      expect(text).toContain('"EXECUTED"');
      expect(text).toContain('"abc"');
    });
  });

  describe("command history navigation", () => {
    it("does nothing on ArrowUp or ArrowDown before any command has run", () => {
      render(<SandboxTerminal />);
      typeInto("draft");
      pressKey("ArrowUp");
      expect(getInput().value).toBe("draft");
      pressKey("ArrowDown");
      expect(getInput().value).toBe("draft");
    });

    it("walks back through history, clamps at the oldest entry, and clears past the newest", () => {
      render(<SandboxTerminal />);
      runCommand("ls");
      runCommand("matrix");
      runCommand("ls");

      // Re-running "ls" moved it to the end rather than duplicating it.
      pressKey("ArrowUp");
      expect(getInput().value).toBe("ls");
      pressKey("ArrowUp");
      expect(getInput().value).toBe("matrix");
      pressKey("ArrowUp");
      expect(getInput().value).toBe("matrix");

      pressKey("ArrowDown");
      expect(getInput().value).toBe("ls");
      pressKey("ArrowDown");
      expect(getInput().value).toBe("");
      // Already below the newest entry: ArrowDown is a no-op.
      typeInto("fresh");
      pressKey("ArrowDown");
      expect(getInput().value).toBe("fresh");
    });

    it("leaves input untouched when Tab has no completion or no prefix", () => {
      render(<SandboxTerminal />);
      typeInto("zzz");
      pressKey("Tab");
      expect(getInput().value).toBe("zzz");
      typeInto("  ");
      pressKey("Tab");
      expect(getInput().value).toBe("  ");
      expect(mocks.playAutocomplete).not.toHaveBeenCalled();

      typeInto("he");
      pressKey("Tab");
      expect(getInput().value).toBe("help");
      expect(mocks.playAutocomplete).toHaveBeenCalledTimes(1);
    });

    it("plays a keystroke for printable keys only", () => {
      render(<SandboxTerminal />);
      pressKey("a");
      pressKey("Shift");
      expect(mocks.playKeystroke).toHaveBeenCalledTimes(1);
      expect(mocks.playKeystroke).toHaveBeenCalledWith("a".charCodeAt(0));
    });
  });

  describe("meme command handlers", () => {
    it.each([
      ["cowsay", "Moo! Ships with 100% test coverage.", "laser"],
      ["cowsay ship it", "ship it", "laser"],
      ["sl", "CHOO-CHOO! Developer Express on track 1.", "level-up"],
      ["duck", "Duck wags his tail enthusiastically!", "bark"],
      ["matrix", "The Matrix has you.", "matrix-glitch"],
      ["vault", "SECRET MEME VAULT UNLOCKED!", "fanfare"],
    ])("renders %s output and plays its sound", (cmd, expected, sound) => {
      render(<SandboxTerminal />);
      runCommand(cmd);

      expect(getLog().textContent).toContain(expected);
      expect(errorLines()).toEqual([]);
      expect(mocks.playMemeSound).toHaveBeenCalledWith(sound);
    });

    it("lists a fake directory for ls and dir without a sound", () => {
      render(<SandboxTerminal />);
      runCommand("dir");
      expect(getLog().textContent).toContain("duck_treats.db");
      expect(mocks.playMemeSound).not.toHaveBeenCalled();
    });

    it("prints a deterministic fortune", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      render(<SandboxTerminal />);
      runCommand("fortune");
      expect(getLog().textContent).toContain(`Fortune: "${FORTUNES[0]}"`);
    });

    it("emits the retro chaos event when the vault opens", () => {
      const chaos = vi.fn();
      const off = onAppEvent("trigger_retro_chaos", chaos);
      render(<SandboxTerminal />);
      runCommand("chaos");
      off();
      expect(chaos).toHaveBeenCalledTimes(1);
    });
  });

  describe("SDK command flag variants", () => {
    it("resolves imednet studies list with extra flags to the studies payload", () => {
      render(<SandboxTerminal />);
      runCommand("imednet studies list --limit 2");
      expect(getLog().textContent).toContain('"ONCO-2026"');
      expect(mocks.announce).toHaveBeenCalledWith(
        "Command execution completed. Standard JSON payload results rendered.",
        "polite"
      );
    });

    it("keeps an explicit SUB- prefix and defaults the subject id to 123", () => {
      render(<SandboxTerminal />);
      runCommand("imednet subjects get --id SUB-777");
      expect(getLog().textContent).toContain('"SUB-777"');
      expect(getLog().textContent).not.toContain("SUB-SUB-777");

      runCommand("imednet subjects get");
      expect(getLog().textContent).toContain('"SUB-123"');
    });

    it("searches records for a custom study and defaults to BRIGHT-01", () => {
      render(<SandboxTerminal />);
      runCommand("imednet records search --study ONCO-9");
      expect(getLog().textContent).toContain('"ONCO-9"');

      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      runCommand("imednet records search");
      expect(getLog().textContent).toContain('"BRIGHT-01"');
    });

    it("announces the subject-specific summary when run from its badge", () => {
      render(<SandboxTerminal />);
      fireEvent.click(
        screen.getByRole("button", { name: "imednet subjects get --id 123" })
      );
      advance(RESPONSE_LAG_MS);
      expect(mocks.announce).toHaveBeenCalledWith(
        expect.stringContaining(
          "HIPAA-anonymized demographics for subject 123"
        ),
        "polite"
      );
    });

    // #2532: complianceScore is never the last key in the subject payload,
    // so its value carries JSON's trailing comma and the link never rendered.
    it("renders the compliance placeholder in the subject payload as a live link", () => {
      render(<SandboxTerminal />);
      runCommand("imednet subjects get --id 123");
      const link = screen.getByRole("link", {
        name: "[LIVE_VERIFICATION_LINK]",
      });
      expect(link.getAttribute("href")).toBe("/proof");
      expect(link.nextSibling?.textContent).toBe(",");
    });

    it("highlights booleans and null that are followed by another key", () => {
      workspaceCommandRegistry.registerAction({
        id: "custom:literals",
        title: "Literals",
        cliName: "imednet literals",
        subToolId: "test",
        subToolName: "Test",
        payload: { active: true, archived: false, closedAt: null, n: 1 },
      });
      const { container } = render(<SandboxTerminal />);
      runCommand("imednet literals");
      const amber = [...container.querySelectorAll(".text-amber-500")].map(
        (el) => el.textContent
      );
      expect(amber).toEqual(expect.arrayContaining(["true,", "false,"]));
      const red = [...container.querySelectorAll(".text-red-400.italic")].map(
        (el) => el.textContent
      );
      expect(red).toContain("null,");
    });

    it("renders the compliance placeholder as a link when it ends its object", () => {
      workspaceCommandRegistry.registerAction({
        id: "custom:compliance",
        title: "Compliance",
        cliName: "imednet compliance",
        subToolId: "test",
        subToolName: "Test",
        payload: { complianceScore: "[VERIFY_SECURITY_LOGS]" },
      });
      render(<SandboxTerminal />);
      runCommand("imednet compliance");
      const link = screen.getByRole("link", {
        name: "[LIVE_VERIFICATION_LINK]",
      });
      expect(link.getAttribute("href")).toBe("/proof");
    });

    it("renders a registered payload with typed token highlighting", () => {
      workspaceCommandRegistry.registerAction({
        id: "custom:payload",
        title: "Payload Demo",
        cliName: "imednet payload-demo",
        subToolId: "test",
        subToolName: "Test",
        payload: {
          count: 7,
          nested: { owner: null },
          flags: { enabled: true },
        },
      });
      render(<SandboxTerminal />);
      runCommand("imednet payload-demo");

      const log = getLog();
      expect(log.querySelector(".text-blue-400")?.textContent).toBe("7,");
      expect(log.querySelector(".text-red-400")?.textContent).toBe("null");
      expect(log.querySelector(".text-amber-500")?.textContent).toBe("true");
      expect(mocks.playSuccess).toHaveBeenCalledTimes(1);
    });

    it("runs the input through the execute button", () => {
      render(<SandboxTerminal />);
      const execute = screen.getByTitle<HTMLButtonElement>(
        "Execute Command (Enter)"
      );
      expect(execute.disabled).toBe(true);
      typeInto("ls");
      fireEvent.click(execute);
      advance(RESPONSE_LAG_MS);
      expect(getLog().textContent).toContain("duck_treats.db");
    });
  });

  describe("persistence and URL hash", () => {
    it("keeps only the newest 100 log entries", () => {
      safeStorage.setItem(
        "sandbox_terminal_logs_default",
        Array.from({ length: 100 }, (_, i) => ({
          id: `seed-${i}`,
          type: "info",
          text: `seed<${i}>`,
        }))
      );
      render(<SandboxTerminal />);
      runCommand("ls");

      const text = getLog().textContent ?? "";
      expect(text).not.toContain("seed<0>");
      expect(text).not.toContain("seed<1>");
      expect(text).toContain("seed<2>");
      expect(text).toContain("duck_treats.db");
    });

    it("executes a command from the URL hash on mount", () => {
      writeHashParams({ terminal_cmd: "ls" });
      render(<SandboxTerminal />);
      advance(0);
      advance(RESPONSE_LAG_MS);
      expect(getLog().textContent).toContain("duck_treats.db");
    });

    it("does not replay the URL hash command over an existing session", () => {
      safeStorage.setItem("sandbox_terminal_logs_default", [
        { id: "prior", type: "command", text: "matrix" },
      ]);
      writeHashParams({ terminal_cmd: "ls" });
      render(<SandboxTerminal />);
      advance(0);
      advance(RESPONSE_LAG_MS);
      expect(getLog().textContent).not.toContain("duck_treats.db");
    });
  });

  describe("export menu", () => {
    const downloads: string[] = [];

    beforeEach(() => {
      downloads.length = 0;
      Object.defineProperty(URL, "createObjectURL", {
        value: vi.fn(() => "blob:mock"),
        configurable: true,
        writable: true,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        value: vi.fn(),
        configurable: true,
        writable: true,
      });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function (this: HTMLAnchorElement) {
          downloads.push(this.download);
        }
      );
    });

    const openMenu = () =>
      fireEvent.click(
        screen.getByTitle("Export Executed Commands as Pipeline Script")
      );

    it("exports executed commands as a bash script with a sanitised filename", () => {
      render(<SandboxTerminal slug="my study!" />);
      runCommand("ls");
      openMenu();
      fireEvent.click(screen.getByText("Bash Script (.sh)"));

      expect(generateBashScript).toHaveBeenCalledWith(["ls"], {
        slug: "my study!",
      });
      expect(downloads).toEqual(["imednet_pipeline_my_study_.sh"]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(screen.queryByText("Bash Script (.sh)")).toBeNull();
    });

    it("falls back to stored command history for a python export", () => {
      safeStorage.setItem("sandbox_terminal_history", ["imednet studies list"]);
      render(<SandboxTerminal />);
      openMenu();
      fireEvent.click(screen.getByText("Python Script (.py)"));

      expect(generatePythonScript).toHaveBeenCalledWith(
        ["imednet studies list"],
        { slug: "imednet-python-sdk" }
      );
      expect(downloads).toEqual(["imednet_pipeline_imednet-python-sdk.py"]);
    });

    it("falls back to the full registry when nothing has run", () => {
      render(
        <SandboxTerminal
          commands={{ "x run": { description: "d", payload: 1 } }}
        />
      );
      openMenu();
      fireEvent.click(screen.getByText("Bash Script (.sh)"));
      expect(generateBashScript).toHaveBeenCalledWith(["x run"], {
        slug: "imednet-python-sdk",
      });
    });

    it("closes the menu on an outside click but not on an inside one", () => {
      render(<SandboxTerminal />);
      openMenu();
      fireEvent.mouseDown(screen.getByText("Bash Script (.sh)"));
      expect(screen.getByText("Bash Script (.sh)")).toBeTruthy();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText("Bash Script (.sh)")).toBeNull();
    });
  });

  describe("terminal body click focus", () => {
    it("focuses the input on a body click", () => {
      render(<SandboxTerminal />);
      fireEvent.click(getLog());
      expect(document.activeElement).toBe(getInput());
    });

    it("leaves focus alone while text is selected or a control was clicked", () => {
      render(<SandboxTerminal />);
      vi.spyOn(window, "getSelection").mockReturnValue(
        fromPartial<Selection>({ toString: () => "copied text" })
      );
      fireEvent.click(getLog());
      expect(document.activeElement).not.toBe(getInput());

      vi.mocked(window.getSelection).mockReturnValue(null);
      fireEvent.click(screen.getByTitle("Clear Terminal Logs & History"));
      expect(document.activeElement).not.toBe(getInput());
    });
  });

  describe("console API and terminal:run events", () => {
    it("exposes window.imednet on its case study page and removes it on unmount", () => {
      window.history.pushState({}, "", "/case-studies/imednet-python-sdk");
      const errorSpy = vi
        .spyOn(logger, "error")
        .mockReturnValue(fromPartial({}));
      const infoSpy = vi.spyOn(logger, "info").mockReturnValue(fromPartial({}));
      const warnSpy = vi.spyOn(logger, "warn").mockReturnValue(fromPartial({}));

      const { unmount } = render(<SandboxTerminal />);
      expect(window.imednet).toBe(window.terminal);

      window.imednet?.run(fromAny(42));
      expect(errorSpy).toHaveBeenCalledWith(
        "terminal.run: command must be a string."
      );

      window.imednet?.help();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Supported API commands")
      );

      act(() => {
        window.imednet?.run("ls");
      });
      advance(40);
      // A second request while the first is still typing is refused.
      act(() => {
        window.imednet?.run("matrix");
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "Terminal is currently executing a command or typing. Please wait."
      );
      advance(typingTime("ls") + RESPONSE_LAG_MS);
      expect(getLog().textContent).toContain("duck_treats.db");
      expect(getLog().textContent).not.toContain("The Matrix has you.");

      unmount();
      expect(window.imednet).toBeUndefined();
      expect(window.terminal).toBeUndefined();
    });

    it("does not expose the console API on other pages", () => {
      window.history.pushState({}, "", "/somewhere-else");
      render(<SandboxTerminal />);
      expect(window.imednet).toBeUndefined();
    });

    it("ignores terminal:run events without a string command", () => {
      render(<SandboxTerminal />);
      act(() => {
        window.dispatchEvent(
          new CustomEvent("terminal:run", { detail: { command: 5 } })
        );
        window.dispatchEvent(new CustomEvent("terminal:run"));
      });
      advance(1000);
      expect(getInput().value).toBe("");
      expect(getLog().textContent).not.toContain("imednet-sdk $");
    });

    it("restarts typing when a registry action fires mid-typing", async () => {
      render(<SandboxTerminal />);
      await act(async () => {
        await workspaceCommandRegistry.executeAction(
          "terminal:cmd:imednet studies list",
          { command: "imednet studies list --limit 1" }
        );
      });
      advance(80);
      await act(async () => {
        await workspaceCommandRegistry.executeAction(
          "terminal:cmd:imednet studies list"
        );
      });
      advance(typingTime("imednet studies list") + RESPONSE_LAG_MS);

      const commands = Array.from(
        getLog().querySelectorAll(".text-zinc-100")
      ).map((el) => el.textContent);
      expect(commands).toEqual(["imednet studies list"]);
    });
  });

  describe("playback edge branches", () => {
    const TWO_STEPS = [
      { command: "help", description: "help" },
      { command: "ls", description: "list" },
    ];

    const stepLabel = () => screen.getByText(/Ready to start|Step \d of \d/);

    /** Click play and let the first step finish, leaving it in the 1.5s gap. */
    const playFirstStep = () => {
      fireEvent.click(screen.getByTitle("Play Sequence"));
      advance(typingTime("help") + RESPONSE_LAG_MS);
      expect(screen.getByTitle("Pause Playback").hasAttribute("disabled")).toBe(
        false
      );
    };

    it("step forward during the inter-step gap stops auto-advance", () => {
      render(<SandboxTerminal playback={TWO_STEPS} />);
      playFirstStep();

      fireEvent.click(screen.getByTitle("Step Forward"));
      expect(screen.getByTitle("Play Sequence")).toBeTruthy();
      advance(typingTime("ls") + RESPONSE_LAG_MS + 2000);

      expect(stepLabel().textContent).toBe('Step 2 of 2: "ls"');
      const commands = Array.from(
        getLog().querySelectorAll(".text-zinc-100")
      ).map((el) => el.textContent);
      expect(commands).toEqual(["help", "ls"]);
    });

    it("step back during the gap stops playback and restores the banner", () => {
      render(<SandboxTerminal playback={TWO_STEPS} />);
      playFirstStep();

      fireEvent.click(screen.getByTitle("Step Back"));
      expect(screen.getByTitle("Play Sequence")).toBeTruthy();
      expect(stepLabel().textContent).toContain("Ready to start");
      advance(3000);
      expect(getLog().textContent).not.toContain("imednet-sdk $");
      expect(getLog().textContent).toContain("Version 2.3.1");
    });

    it("rolls back an unknown playback step as a not-found error", () => {
      render(
        <SandboxTerminal
          playback={[
            { command: "bogus-step", description: "unknown" },
            { command: "ls", description: "list" },
          ]}
        />
      );
      fireEvent.click(screen.getByTitle("Step Forward"));
      advance(typingTime("bogus-step") + RESPONSE_LAG_MS);
      fireEvent.click(screen.getByTitle("Step Forward"));
      advance(typingTime("ls") + RESPONSE_LAG_MS);

      fireEvent.click(screen.getByTitle("Step Back"));
      expect(errorLines()).toEqual([
        "✖ Command not found: 'bogus-step'. Type 'help' to review supported registry entries.",
      ]);
      expect(stepLabel().textContent).toBe('Step 1 of 2: "bogus-step"');
    });

    it("restarts from the first step when play is pressed at the end, then stops", () => {
      render(
        <SandboxTerminal playback={[{ command: "ls", description: "list" }]} />
      );
      fireEvent.click(screen.getByTitle("Step Forward"));
      advance(typingTime("ls") + RESPONSE_LAG_MS);
      runCommand("matrix");

      fireEvent.click(screen.getByTitle("Play Sequence"));
      // Logs reset to the banner before replaying.
      expect(getLog().textContent).not.toContain("The Matrix has you.");
      advance(typingTime("ls") + RESPONSE_LAG_MS);
      expect(screen.getByTitle("Pause Playback")).toBeTruthy();
      advance(1500);

      expect(screen.getByTitle("Play Sequence")).toBeTruthy();
      expect(getLog().textContent).toContain("duck_treats.db");
    });

    it("reset mid-typing cancels the typist", () => {
      render(<SandboxTerminal playback={TWO_STEPS} />);
      fireEvent.click(screen.getByTitle("Play Sequence"));
      advance(80);
      expect(getInput().value).toBe("he");

      fireEvent.click(screen.getByTitle("Reset"));
      advance(3000);
      expect(getInput().value).toBe("");
      expect(getInput().hasAttribute("disabled")).toBe(false);
      expect(stepLabel().textContent).toContain("Ready to start");
      expect(getLog().textContent).not.toContain("imednet-sdk $");
    });

    it("reset during the inter-step gap cancels the next step", () => {
      render(<SandboxTerminal playback={TWO_STEPS} />);
      playFirstStep();

      fireEvent.click(screen.getByTitle("Reset"));
      advance(3000);
      expect(screen.getByTitle("Play Sequence")).toBeTruthy();
      expect(getLog().textContent).not.toContain("duck_treats.db");
    });

    it("pause during the gap holds the sequence", () => {
      render(<SandboxTerminal playback={TWO_STEPS} />);
      playFirstStep();

      fireEvent.click(screen.getByTitle("Pause Playback"));
      advance(3000);
      expect(stepLabel().textContent).toBe('Step 1 of 2: "help"');
      expect(getLog().textContent).not.toContain("duck_treats.db");
    });
  });
});
