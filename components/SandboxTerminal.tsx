"use client";

import React, { useState, useRef, useEffect } from "react";
import { hexToRgba } from "@/lib/utils";
import { designManifest } from "@/lib/design-manifest";
import {
  IconTerminal,
  IconCornerDownLeft,
  IconCircle,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerSkipForward,
  IconPlayerSkipBack,
  IconRotate,
} from "@tabler/icons-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useSafeTimeout, type SafeTimeoutId } from "@/hooks/useSafeTimeout";
import { logger } from "@/lib/logger";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { useAudio } from "@/components/providers/AudioProvider";
import {
  ASCII_COWSAY,
  ASCII_DUCK,
  ASCII_LASER_LOON,
  ASCII_TRAIN,
  FORTUNES,
  unlockAchievement,
  setVaultUnlocked,
} from "@/lib/meme-data";
import { playMemeSound } from "@/lib/meme-audio";

interface LogItem {
  id: string;
  type: "command" | "output" | "error" | "info";
  text: string;
  jsonPayload?: unknown;
}

const COMMAND_REGISTRY: Record<
  string,
  { description: string; payload: unknown }
> = {
  "imednet studies list": {
    description:
      "Retrieve a list of all active clinical trials from the iMednet EDC platform.",
    payload: [
      {
        studyID: "BRIGHT-01",
        name: "Phase III Pediatric Leukemia Study",
        status: "ACTIVE",
        subjectsCount: 142,
        version: "v4.2.1",
      },
      {
        studyID: "ONCO-2026",
        name: "Advanced Melanoma Immunotherapy Trial",
        status: "ENROLLING",
        subjectsCount: 89,
        version: "v1.0.8",
      },
      {
        studyID: "CARDIO-REF",
        name: "Congestive Heart Failure Observational Registry",
        status: "COMPLETED",
        subjectsCount: 310,
        version: "v2.5.0",
      },
    ],
  },
  "imednet subjects get --id 123": {
    description:
      "Query specific details and records for subject 123 (HIPAA-anonymized).",
    payload: {
      subjectID: "SUB-123",
      studyID: "BRIGHT-01",
      siteID: 401,
      enrollmentDate: "2025-11-12",
      status: "COMPLETED",
      recordsCount: 18,
      complianceScore: "[VERIFY_SECURITY_LOGS]",
      demographics: {
        age: 11,
        gender: "F",
        ethnicity: "ANONYMIZED_UNDER_HIPAA_SAFE_HARBOR",
      },
      lastVisit: "2026-05-10T14:30Z",
    },
  },
  "imednet records search --study BRIGHT-01": {
    description:
      "Search dynamic patient records and EDC form entries matching active trials.",
    payload: {
      studyID: "BRIGHT-01",
      totalRecordsMatched: 3,
      domain: "VS (Vital Signs)",
      results: [
        {
          subjectID: "SUB-101",
          visitName: "Week 4 Follow-up",
          heartRate: 72,
          tempCelsius: 36.8,
          systolicBP: 110,
          diastolicBP: 72,
          timestamp: "2026-05-20T08:30Z",
        },
        {
          subjectID: "SUB-102",
          visitName: "Week 4 Follow-up",
          heartRate: 84,
          tempCelsius: 37.1,
          systolicBP: 115,
          diastolicBP: 76,
          timestamp: "2026-05-20T09:15Z",
        },
        {
          subjectID: "SUB-103",
          visitName: "Week 4 Follow-up",
          heartRate: 68,
          tempCelsius: 36.6,
          systolicBP: 108,
          diastolicBP: 70,
          timestamp: "2026-05-20T10:00Z",
        },
      ],
    },
  },
};

const DEFAULT_PLAYBACK = [
  {
    command: "imednet studies list",
    description:
      "Retrieve active clinical trials from the iMednet EDC platform",
  },
  {
    command: "imednet subjects get --id 123",
    description: "Query details and demographics for subject 123",
  },
  {
    command: "imednet records search --study BRIGHT-01",
    description: "Search patient records matching active trial BRIGHT-01",
  },
];

// Pure ID Generator outside rendering pipeline to satisfy react-hooks/purity rules
let idCounter = 0;
function generateLogId(): string {
  idCounter += 1;
  return `log-entry-${idCounter}`;
}

interface SandboxTerminalProps {
  slug?: string;
  commands?: Record<string, { description: string; payload: unknown }>;
  playback?: Array<{ command: string; description: string }>;
}

export const SandboxTerminal: React.FC<SandboxTerminalProps> = ({
  slug,
  commands,
  playback,
}) => {
  const { announce } = useAnnouncer();
  const { playKeystroke, playAutocomplete, playSuccess } = useAudio();
  // Response lag, post-typing and between-step delays are cleared on unmount.
  const { setSafeTimeout, clearSafeTimeout } = useSafeTimeout();
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: "init",
      type: "info",
      text: "iMednet Python SDK CLI Sandbox [Version 2.3.1]\nType 'help' to list available commands. Click the badges below for instant inputs.",
    },
  ]);
  const [commandHistory, setCommandHistory] = usePersistentState<string[]>(
    "sandbox_terminal_history",
    []
  );
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  // Playback Step Player states
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const inputRef = useRef<HTMLInputElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackTimeoutRef = useRef<SafeTimeoutId | null>(null);
  const startPlaybackLoopRef = useRef<((targetIdx?: number) => void) | null>(
    null
  );

  const activeRegistry = commands || COMMAND_REGISTRY;
  const activePlayback = playback || DEFAULT_PLAYBACK;

  // Focus terminal input on body clicks without shifting viewport
  const handleTerminalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      return;
    }
    if ((e.target as HTMLElement).closest("a, button, input")) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  };

  // Scroll to bottom internally when logs update
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Execute terminal commands
  const executeCommand = React.useCallback(
    (cmdText: string) => {
      const trimmed = cmdText.trim();
      if (!trimmed) return;

      // Add command to output log
      const cmdId = generateLogId();
      setLogs((prev) => [
        ...prev,
        { id: cmdId, type: "command", text: trimmed },
      ]);
      setInput("");

      // Add to command history list
      setCommandHistory((prev) => {
        const filtered = prev.filter((c) => c !== trimmed);
        return [...filtered, trimmed];
      });
      setHistoryIndex(-1);
      setIsExecuting(true);
      announce("Command execution started", "polite");

      // Simulated short response lag for realism
      setSafeTimeout(() => {
        setIsExecuting(false);
        const outputId = generateLogId();

        if (trimmed === "clear") {
          setLogs([]);
          announce("Console cleared", "polite");
          return;
        }

        if (trimmed === "help") {
          const cmdLines = Object.entries(activeRegistry)
            .map(([cmd, data]) => `  ${cmd.padEnd(40)} -> ${data.description}`)
            .join("\n");

          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text:
                `Available Curated Clinical EDC SDK Commands:\n\n` +
                cmdLines +
                `\n` +
                `  clear                                    -> Clear the terminal console\n` +
                `  help                                     -> View available command registry`,
            },
          ]);
          // prettier-ignore
          announce("Help menu loaded displaying available SDK commands.", "polite");
          return;
        }

        // --- Easter Egg & UNIX Meme Command Handlers ---
        const lower = trimmed.toLowerCase();

        if (lower.startsWith("cowsay")) {
          const customText =
            trimmed.replace(/^cowsay\s*/i, "").trim() ||
            "Moo! Ships with 100% test coverage.";
          unlockAchievement("terminal-cowboy");
          playMemeSound("laser");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: ASCII_COWSAY(customText),
            },
          ]);
          announce(`Cowsay output: ${customText}`, "polite");
          return;
        }

        if (lower === "loon" || lower === "laser" || lower === "laser-loon") {
          unlockAchievement("terminal-cowboy");
          playMemeSound("laser");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: ASCII_LASER_LOON(),
            },
          ]);
          announce("Laser Loon cryo-optics rendered.", "polite");
          return;
        }

        if (lower === "sl") {
          unlockAchievement("terminal-cowboy");
          playMemeSound("level-up");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text:
                ASCII_TRAIN() + "\nCHOO-CHOO! Developer Express on track 1.",
            },
          ]);
          announce("Steam locomotive animation executed.", "polite");
          return;
        }

        if (lower === "ls" || lower === "dir") {
          unlockAchievement("terminal-cowboy");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: "src/   components/   app/   lib/   duck_treats.db   secrets/   package.json",
            },
          ]);
          announce("Directory contents listed.", "polite");
          return;
        }

        if (lower === "fortune") {
          unlockAchievement("terminal-cowboy");
          playMemeSound("level-up");
          const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: `🥠 Fortune: "${fortune}"`,
            },
          ]);
          announce(`Fortune received: ${fortune}`, "polite");
          return;
        }

        if (lower === "duck" || lower === "pet duck" || lower === "woof") {
          unlockAchievement("duck-whisperer");
          playMemeSound("bark");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text:
                ASCII_DUCK() + "\nDuck wags his tail enthusiastically! *Woof!*",
            },
          ]);
          announce("Duck the golden retriever puppy was summoned!", "polite");
          return;
        }

        if (lower === "matrix") {
          unlockAchievement("terminal-cowboy");
          playMemeSound("matrix-glitch");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: "01000011 01101000 01100001 01101111 01110011\nWake up, developer...\nThe Matrix has you.\nFollow the white puppy 🐾",
            },
          ]);
          announce("Matrix terminal stream initialized.", "polite");
          return;
        }

        if (lower.startsWith("sudo")) {
          unlockAchievement("terminal-cowboy");
          playMemeSound("fda-siren");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "error",
              text: "Permission denied: Duck 🐾 is guarding the root filesystem. Nice try, sudoer!",
            },
          ]);
          announce("Sudo command denied by Duck the puppy.", "polite");
          return;
        }

        if (
          lower.includes("git push") &&
          (lower.includes("-f") || lower.includes("force"))
        ) {
          unlockAchievement("friday-survivor");
          playMemeSound("friday-alarm");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "error",
              text: "🚨 CRITICAL ALERT: Force-pushing to main on a Friday at 4:59 PM!\nremote: Resolving deltas: 100% (42/42), done.\nremote: Error: You bypassed 18 CI invariant checks and broke staging!\nremote: Duck is currently debugging your merge conflict in production.",
            },
          ]);
          announce(
            "Friday force push disaster simulation triggered!",
            "polite"
          );
          return;
        }

        if (
          lower === "secret" ||
          lower === "meme" ||
          lower === "vault" ||
          lower === "chaos"
        ) {
          unlockAchievement("terminal-cowboy");
          setVaultUnlocked(true);
          playMemeSound("fanfare");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("trigger_retro_chaos"));
          }
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "info",
              text: "🔓 SECRET MEME VAULT UNLOCKED!\nOpening Retro Chaos Mode... Visit /arcade/meme-vault to explore the full soundboard and meme cards!",
            },
          ]);
          announce("Secret Meme Vault unlocked and opened.", "polite");
          return;
        }

        if (lower === "418" || lower === "coffee" || lower === "tea") {
          unlockAchievement("rfc-barista");
          playMemeSound("teapot-whistle");
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "error",
              text: "HTTP 418: I'm a teapot (RFC 2324 / RFC 7168 HTCPCP/1.0).\nCannot brew coffee: Connected device is a clinical database engine, not a kettle.",
            },
          ]);
          announce("HTTP 418 I'm a teapot response received.", "polite");
          return;
        }

        const match = activeRegistry[trimmed];
        if (match) {
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "output",
              text: "",
              jsonPayload: match.payload,
            },
          ]);
          playSuccess();
          if (trimmed === "imednet studies list") {
            // prettier-ignore
            announce("Command execution completed. Returned active clinical trials: BRIGHT-01, ONCO-2026, and CARDIO-REF.", "polite");
          } else if (trimmed === "imednet subjects get --id 123") {
            // prettier-ignore
            announce("Command execution completed. Returned clinical records and HIPAA-anonymized demographics for subject 123.", "polite");
          } else if (trimmed === "imednet records search --study BRIGHT-01") {
            // prettier-ignore
            announce("Command execution completed. Returned 3 vital sign records matching study BRIGHT-01.", "polite");
          } else {
            // prettier-ignore
            announce("Command execution completed. Standard JSON payload results rendered.", "polite");
          }
        } else {
          setLogs((prev) => [
            ...prev,
            {
              id: outputId,
              type: "error",
              text: `Command not found: '${trimmed}'. Type 'help' to review supported registry entries or try 'loon', 'cowsay', or 'duck'.`,
            },
          ]);
          // prettier-ignore
          announce(`Command execution failed. Unknown command: '${trimmed}'.`, "polite");
        }
      }, 450);
    },
    [
      setCommandHistory,
      setHistoryIndex,
      setIsExecuting,
      setInput,
      setLogs,
      announce,
      playSuccess,
      activeRegistry,
      setSafeTimeout,
    ]
  );

  // Unified typing simulation engine
  const typeAndExecute = React.useCallback(
    (command: string, onComplete?: () => void) => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      setIsTyping(true);
      setInput("");
      inputRef.current?.focus({ preventScroll: true });

      let currentIndex = 0;
      let currentTyped = "";

      typingTimerRef.current = setInterval(() => {
        if (currentIndex < command.length) {
          const char = command[currentIndex];
          currentTyped += char;
          setInput(currentTyped);
          playKeystroke(char.charCodeAt(0));

          // Emulate key events in the DOM
          const inputEl = inputRef.current;
          if (inputEl) {
            const keyEventInit = { key: char, bubbles: true, cancelable: true };
            inputEl.dispatchEvent(new KeyboardEvent("keydown", keyEventInit));
            inputEl.dispatchEvent(new KeyboardEvent("keypress", keyEventInit));
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.dispatchEvent(new KeyboardEvent("keyup", keyEventInit));
          }

          currentIndex++;
        } else {
          if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }

          setSafeTimeout(() => {
            setIsTyping(false);
            executeCommand(command);
            onComplete?.();
          }, 150);
        }
      }, 40); // 40ms realistic physical typing pace
    },
    [executeCommand, playKeystroke, setSafeTimeout]
  );

  // Automated step playback runner loop
  const startPlaybackLoop = React.useCallback(
    (targetIdx?: number) => {
      if (!isPlayingRef.current) return;

      const nextIdx =
        targetIdx !== undefined ? targetIdx : currentStepIndex + 1;
      if (nextIdx >= activePlayback.length) {
        setIsPlaying(false);
        return;
      }

      setCurrentStepIndex(nextIdx);
      const step = activePlayback[nextIdx];

      typeAndExecute(step.command, () => {
        if (isPlayingRef.current) {
          playbackTimeoutRef.current = setSafeTimeout(() => {
            startPlaybackLoopRef.current?.(nextIdx + 1);
          }, 1500); // 1.5 seconds natural delay before typing next command
        }
      });
    },
    [currentStepIndex, activePlayback, typeAndExecute, setSafeTimeout]
  );

  // Sync ref to avoid ESLint immutability recursion rule
  useEffect(() => {
    startPlaybackLoopRef.current = startPlaybackLoop;
  }, [startPlaybackLoop]);

  // Play / Pause Toggle handler
  const handlePlay = () => {
    if (isTyping || isExecuting) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (playbackTimeoutRef.current) {
        clearSafeTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;

      // If we are already at the end, restart from the first command
      if (currentStepIndex >= activePlayback.length - 1) {
        setLogs([
          {
            id: "init",
            type: "info",
            text: "iMednet Python SDK CLI Sandbox [Version 2.3.1]\nType 'help' to list available commands. Click the badges below for instant inputs.",
          },
        ]);
        setCurrentStepIndex(0);
        const step = activePlayback[0];
        typeAndExecute(step.command, () => {
          if (isPlayingRef.current) {
            playbackTimeoutRef.current = setSafeTimeout(() => {
              startPlaybackLoopRef.current?.(1);
            }, 1500);
          }
        });
      } else {
        // Just resume or play the next command
        startPlaybackLoopRef.current?.(currentStepIndex + 1);
      }
    }
  };

  // Step Forward handler
  const stepForward = () => {
    if (isTyping || isExecuting) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (playbackTimeoutRef.current) {
        clearSafeTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    }

    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= activePlayback.length) return;

    setCurrentStepIndex(nextIdx);
    const step = activePlayback[nextIdx];
    typeAndExecute(step.command);
  };

  // Step Backward handler with instant rollback and re-execution log append
  const stepBackward = () => {
    if (isTyping || isExecuting) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (playbackTimeoutRef.current) {
        clearSafeTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    }

    const prevIdx = currentStepIndex - 1;
    if (prevIdx < -1) return;

    setCurrentStepIndex(prevIdx);

    const initialLogs: LogItem[] = [
      {
        id: "init",
        type: "info",
        text: "iMednet Python SDK CLI Sandbox [Version 2.3.1]\nType 'help' to list available commands. Click the badges below for instant inputs.",
      },
    ];

    if (prevIdx === -1) {
      setLogs(initialLogs);
      return;
    }

    // Instantly reconstruct logs without delays (zero-blocking rollback)
    const updatedLogs = [...initialLogs];
    for (let i = 0; i <= prevIdx; i++) {
      const cmdText = activePlayback[i].command;
      updatedLogs.push({
        id: `rollback-cmd-${i}`,
        type: "command",
        text: cmdText,
      });

      const match = activeRegistry[cmdText];
      if (match) {
        updatedLogs.push({
          id: `rollback-out-${i}`,
          type: "output",
          text: "",
          jsonPayload: match.payload,
        });
      } else {
        updatedLogs.push({
          id: `rollback-out-${i}`,
          type: "error",
          text: `Command not found: '${cmdText}'. Type 'help' to review supported registry entries.`,
        });
      }
    }
    setLogs(updatedLogs);
  };

  // Reset handler
  const handleReset = () => {
    setIsPlaying(false);
    if (playbackTimeoutRef.current) {
      clearSafeTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setIsTyping(false);
    setCurrentStepIndex(-1);
    setInput("");
    setLogs([
      {
        id: "init",
        type: "info",
        text: "iMednet Python SDK CLI Sandbox [Version 2.3.1]\nType 'help' to list available commands. Click the badges below for instant inputs.",
      },
    ]);
  };

  // Setup/Teardown interactive console API and custom greeting log
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Strict constraint check: Only enable this on the active case study bento page
    const targetSlug = slug || "imednet-python-sdk";
    if (!window.location.pathname.includes(`/case-studies/${targetSlug}`)) {
      return;
    }

    const terminalApi = {
      run: (cmdText: string) => {
        if (typeof cmdText !== "string") {
          logger.error("terminal.run: command must be a string.");
          return;
        }
        window.dispatchEvent(
          new CustomEvent("terminal:run", { detail: { command: cmdText } })
        );
      },
      help: () => {
        logger.info(
          "Supported API commands:\n" +
            "  imednet.run('imednet studies list')\n" +
            "  imednet.run('imednet subjects get --id 123')\n" +
            "  imednet.run('imednet records search --study BRIGHT-01')\n" +
            "  imednet.run('help')\n" +
            "  imednet.run('clear')"
        );
      },
    };

    window.terminal = terminalApi;
    window.imednet = terminalApi;

    // Interactive custom styled greeting in console
    logger.info(
      `%c╔══════════════════════════════════════════════════════════════════════════╗\n` +
        `║               iMednet SDK Developer Console Sandbox                      ║\n` +
        `╚══════════════════════════════════════════════════════════════════════════╝\n` +
        `Welcome, developer! You've unlocked the interactive CLI simulator console API.\n` +
        `Try programmatically controlling the on-page terminal bento-card from here!\n\n` +
        `Run this function to query the simulated SDK API directly:\n` +
        `  %cimednet.run("imednet studies list")%c\n\n` +
        `Supported Commands:\n` +
        `  • imednet.run("imednet studies list")\n` +
        `  • imednet.run("imednet subjects get --id 123")\n` +
        `  • imednet.run("imednet records search --study BRIGHT-01")\n` +
        `  • imednet.run("help")\n` +
        `  • imednet.run("clear")`
    );

    return () => {
      // Clean up global namespace completely on unmount (prevent leakage to other pages)
      delete window.terminal;
      delete window.imednet;
    };
  }, [slug]);

  // Handle incoming terminal:run custom events
  useEffect(() => {
    const handleRunEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ command: string }>;
      if (!customEvent.detail || typeof customEvent.detail.command !== "string")
        return;

      const command = customEvent.detail.command;

      if (isExecuting || isTyping) {
        logger.warn(
          "Terminal is currently executing a command or typing. Please wait."
        );
        return;
      }

      typeAndExecute(command);
    };

    window.addEventListener("terminal:run", handleRunEvent);

    return () => {
      window.removeEventListener("terminal:run", handleRunEvent);
    };
  }, [isExecuting, isTyping, typeAndExecute]);

  // Clean up the typing interval on unmount; useSafeTimeout clears the
  // pending delays itself.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  // Handle key triggers (Enter, Up, Down, Tab, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1) {
      playKeystroke(e.key.charCodeAt(0));
    }

    if (e.key === "Enter") {
      executeCommand(input);
    } else if (e.key === "Tab") {
      const trimmed = input.trim().toLowerCase();
      if (trimmed) {
        const VALID_COMMANDS = [
          ...Object.keys(activeRegistry),
          "clear",
          "help",
        ];

        const matched = VALID_COMMANDS.find((c) =>
          c.toLowerCase().startsWith(trimmed)
        );
        if (matched) {
          e.preventDefault();
          setInput(matched);
          playAutocomplete();
        }
      }
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex =
        historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(commandHistory[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(commandHistory[nextIndex]);
      }
    }
  };

  // Beautiful token highlighting for JSON payloads
  const renderJsonPayload = (payload: unknown): React.ReactNode => {
    const str = JSON.stringify(payload, null, 2);

    const highlightValue = (valStr: string) => {
      const trimmed = valStr.trim();
      if (trimmed === '"[VERIFY_SECURITY_LOGS]"') {
        return (
          <a
            href="/proof"
            className="text-brand-cyan underline font-bold cursor-pointer hover:text-brand-cyan/80 focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:ring-offset-1 focus:ring-offset-zinc-950 rounded"
          >
            [LIVE_VERIFICATION_LINK]
          </a>
        );
      }
      if (trimmed.startsWith('"')) {
        return <span className="text-emerald-400">{trimmed}</span>;
      }
      if (trimmed === "true" || trimmed === "false") {
        return <span className="text-amber-500 font-bold">{trimmed}</span>;
      }
      if (trimmed === "null") {
        return <span className="text-red-400 italic">{trimmed}</span>;
      }
      if (!isNaN(Number(trimmed.replace(/,$/, "")))) {
        return <span className="text-blue-400 font-medium">{trimmed}</span>;
      }
      return <span className="text-zinc-300">{valStr}</span>;
    };

    return (
      <pre className="font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto select-text pt-2">
        <code>
          {str.split("\n").map((line, idx) => {
            const keyRegex = /^(\s*)"([^"]+)":/;
            const keyMatch = line.match(keyRegex);
            if (keyMatch) {
              const spaces = keyMatch[1];
              const key = keyMatch[2];
              const rest = line.substring(keyMatch[0].length);
              return (
                <div
                  key={idx}
                  className="hover:bg-zinc-900/40 px-1 rounded transition-colors"
                >
                  {spaces}
                  <span className="text-purple-400">&quot;{key}&quot;</span>:
                  {highlightValue(rest)}
                </div>
              );
            }
            return (
              <div key={idx} className="px-1">
                {line}
              </div>
            );
          })}
        </code>
      </pre>
    );
  };

  return (
    <div
      className="w-full flex flex-col items-center"
      data-keyboard-boundary="true"
    >
      {/* Incident Playback Controller Panel */}
      <div className="w-full bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-mono font-bold text-brand-cyan uppercase tracking-wider">
            Incident Playback Controller
          </span>
          <span className="text-[10px] font-mono text-muted">
            {currentStepIndex === -1
              ? "Ready to start step-by-step diagnostic sequence."
              : `Step ${currentStepIndex + 1} of ${activePlayback.length}: "${activePlayback[currentStepIndex].command}"`}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {/* Step Back Button */}
          <button
            onClick={stepBackward}
            disabled={isTyping || isExecuting || currentStepIndex <= -1}
            className="p-2 bg-zinc-950 border border-zinc-900 hover:border-brand-cyan/40 text-zinc-400 hover:text-brand-cyan rounded-lg transition-all disabled:opacity-30 disabled:hover:border-zinc-900 disabled:hover:text-zinc-400 cursor-pointer focus:outline-none"
            title="Step Back"
          >
            <IconPlayerSkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={handlePlay}
            disabled={isTyping || isExecuting}
            className={`px-4 py-2 flex items-center gap-2 font-mono text-xs font-bold border rounded-lg transition-all cursor-pointer focus:outline-none ${
              isPlaying
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                : "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20"
            }`}
            title={isPlaying ? "Pause Playback" : "Play Sequence"}
          >
            {isPlaying ? (
              <>
                <IconPlayerPause className="w-4 h-4" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <IconPlayerPlay className="w-4 h-4" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Step Forward Button */}
          <button
            onClick={stepForward}
            disabled={
              isTyping ||
              isExecuting ||
              currentStepIndex >= activePlayback.length - 1
            }
            className="p-2 bg-zinc-950 border border-zinc-900 hover:border-brand-cyan/40 text-zinc-400 hover:text-brand-cyan rounded-lg transition-all disabled:opacity-30 disabled:hover:border-zinc-900 disabled:hover:text-zinc-400 cursor-pointer focus:outline-none"
            title="Step Forward"
          >
            <IconPlayerSkipForward className="w-4 h-4" />
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="p-2 bg-zinc-950 border border-zinc-900 hover:border-brand-cyan/40 text-zinc-400 hover:text-brand-cyan rounded-lg transition-all cursor-pointer focus:outline-none"
            title="Reset"
          >
            <IconRotate className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Curved Command Badges Row */}
      <div className="flex flex-wrap gap-2 mb-4 w-full select-none">
        {Object.keys(activeRegistry).map((cmd) => (
          <button
            key={cmd}
            onClick={() => executeCommand(cmd)}
            disabled={isExecuting || isTyping}
            className="px-3 py-1.5 text-[10px] font-mono font-bold bg-zinc-900/40 border border-zinc-900 hover:border-brand-cyan/40 text-brand-cyan/90 hover:text-brand-cyan rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 hover:bg-brand-cyan/5 hover:shadow-[0_0_12px_rgba(6,182,212,0.15)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:ring-offset-1 focus:ring-offset-zinc-950"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Main Window Frame */}
      <div
        role="region"
        aria-label="Interactive Terminal Sandbox"
        aria-busy={isExecuting || isTyping}
        onClick={handleTerminalClick}
        style={
          {
            "--term-glow": `0 0 35px ${hexToRgba(designManifest.colors["brand-cyan"], 0.02)}`,
          } as React.CSSProperties
        }
        className="w-full border border-zinc-900 focus-within:border-brand-cyan/40 bg-zinc-950/80 rounded-2xl overflow-hidden shadow-[var(--term-glow)] focus-within:shadow-[0_0_40px_rgba(6,182,212,0.08),0_0_80px_rgba(6,182,212,0.02)] relative backdrop-blur-md cursor-text transition-all duration-300"
      >
        {/* Terminal Header */}
        <div className="border-b border-zinc-900/60 bg-zinc-950/90 px-4 py-3.5 flex justify-between items-center select-none min-w-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconCircle className="w-3 h-3 fill-red-500/80 stroke-none shrink-0" />
            <IconCircle className="w-3 h-3 fill-yellow-500/80 stroke-none shrink-0" />
            <IconCircle className="w-3 h-3 fill-green-500/80 stroke-none shrink-0" />
            <span className="text-[10px] font-mono font-bold text-muted tracking-wider ml-2 uppercase truncate min-w-0">
              imednet-python-sdk // interactive CLI shell
            </span>
          </div>
          <IconTerminal className="w-4 h-4 text-zinc-600 shrink-0" />
        </div>

        {/* Console logs output viewport */}
        <div
          ref={logsContainerRef}
          role="log"
          aria-label="Terminal output log"
          className="p-5 font-mono text-[11px] leading-relaxed max-h-[380px] overflow-y-auto space-y-4 text-zinc-300"
        >
          {logs.map((log) => (
            <div key={log.id} className="space-y-1 min-w-0">
              {log.type === "command" && (
                <div className="flex items-center gap-2 text-zinc-400 font-bold select-none min-w-0">
                  <span className="text-zinc-600 font-bold shrink-0">~</span>
                  <span className="text-zinc-400 font-bold shrink-0">
                    imednet-sdk $
                  </span>
                  <span className="text-zinc-100 font-bold select-text min-w-0 break-all">
                    {log.text}
                  </span>
                </div>
              )}
              {log.type === "info" && (
                <div className="text-muted whitespace-pre-wrap leading-relaxed select-text min-w-0 break-all">
                  {log.text}
                </div>
              )}
              {log.type === "error" && (
                <div className="text-red-400/90 font-medium select-text min-w-0 break-all">
                  ✖ {log.text}
                </div>
              )}
              {log.type === "output" && log.jsonPayload !== undefined && (
                <div className="bg-zinc-950 border border-zinc-900/50 rounded-xl p-3.5 mt-1 min-w-0">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2 text-[9px] text-muted select-none min-w-0 gap-2">
                    <span className="truncate">
                      200 OK // TRANSACTION RETRUSTED
                    </span>
                    <span className="shrink-0">JSON PAYLOAD</span>
                  </div>
                  {renderJsonPayload(log.jsonPayload)}
                </div>
              )}
            </div>
          ))}

          {/* Loading execution state */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-brand-cyan/80 font-bold italic select-none min-w-0">
              <span className="animate-pulse shrink-0">◌</span>
              <span className="truncate">Executing clinical API query...</span>
            </div>
          )}
        </div>

        {/* Live Input Field Prompt */}
        <div className="border-t border-zinc-900/60 bg-zinc-950/60 px-5 py-3.5 flex items-center gap-2 min-w-0">
          <span className="text-zinc-600 font-bold font-mono text-[11px] select-none shrink-0">
            ~
          </span>
          <span className="text-zinc-400 font-bold font-mono text-[11px] select-none shrink-0 truncate max-w-[110px] xs:max-w-none">
            imednet-sdk $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting || isTyping}
            placeholder="Type 'help' or execute dynamic clinical queries..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-[11px] text-zinc-100 placeholder-zinc-700 caret-brand-cyan select-text"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <button
            onClick={() => executeCommand(input)}
            disabled={isExecuting || isTyping || !input.trim()}
            className="p-1.5 text-zinc-600 hover:text-brand-cyan hover:bg-brand-cyan/10 active:scale-90 disabled:text-zinc-800 disabled:hover:text-zinc-800 disabled:hover:bg-transparent transition-all rounded-lg cursor-pointer focus:outline-none focus:text-brand-cyan focus:ring-2 focus:ring-brand-cyan/50 focus:ring-offset-1 focus:ring-offset-zinc-950 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Execute Command (Enter)"
          >
            <IconCornerDownLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
