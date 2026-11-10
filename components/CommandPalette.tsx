"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useId,
  useMemo,
  useDeferredValue,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { getNavGroupForHref } from "@/lib/navigation";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  IconSearch,
  IconTerminal,
  IconFileCode,
  IconDirections,
  IconArticle,
  IconCornerDownLeft,
  IconCalendar,
  IconBrain,
  IconFileSpreadsheet,
  IconCpu,
  IconFlask,
  IconStethoscope,
  IconHeartHandshake,
  IconHeart,
  IconShoppingBag,
  IconDeviceGamepad2,
  IconSparkles,
  IconCoffee,
  IconFlame,
  IconShieldCheck,
  IconCamera,
  IconClipboardCheck,
  IconHeadset,
  IconRings,
  IconPlayerPlay,
  IconCircleDot,
  type TablerIcon,
} from "@tabler/icons-react";
import { filterFuzzySearch } from "@/lib/search-utils";
import { useSearch } from "@/components/providers/SearchProvider";
import { useAudio } from "@/components/providers/AudioProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHotkeys } from "@/hooks/useHotkeys";
import { scrollToElement } from "@/lib/scroll";
import { unlockAchievement, setVaultUnlocked } from "@/lib/meme-data";
import { playMemeSound } from "@/lib/meme-audio";
import { emitAppEvent } from "@/lib/event-bus";
import { useFontPreference } from "@/hooks/useFontPreference";
import { useDebounce } from "@/hooks/useDebounce";
import { useThrottledCallback } from "@/hooks/useThrottle";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { useWorkspaceCommands } from "@/hooks/useWorkspaceCommands";
import { useMacroEngine } from "@/hooks/useMacroEngine";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import {
  STATIC_NAVS,
  type StaticNavEntry,
  type StaticNavIconName,
} from "@/lib/command-palette";

/** True under React's act() test environment, where timing gates collapse to 0ms. */
function isActEnvironment(): boolean {
  return Boolean(
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT
  );
}

interface SearchCaseStudy {
  id: string;
  slug: string;
  title: string;
  primary_language: string;
  tags: string;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: "case-study" | "navigation";
  url: string;
  icon: React.ReactNode;
  techStack?: string[];
  highlights?: string[];
  status?: string;
  description?: string;
  badge?: string;
}

const STATIC_NAV_ICONS: Record<StaticNavIconName, TablerIcon> = {
  IconArticle,
  IconBrain,
  IconCalendar,
  IconCamera,
  IconClipboardCheck,
  IconCpu,
  IconDeviceGamepad2,
  IconDirections,
  IconFileCode,
  IconFileSpreadsheet,
  IconFlask,
  IconHeadset,
  IconHeart,
  IconHeartHandshake,
  IconRings,
  IconSearch,
  IconShieldCheck,
  IconShoppingBag,
  IconSparkles,
  IconStethoscope,
  IconTerminal,
};

/** Builds a palette row from a static entry, applying the dyslexia-mode variant. */
function toPaletteItem(
  entry: StaticNavEntry,
  isDyslexic: boolean
): PaletteItem {
  const { icon, whenDyslexiaModeOn, ...fields } = entry;
  const Icon = STATIC_NAV_ICONS[icon.name];
  return {
    ...fields,
    ...(isDyslexic && whenDyslexiaModeOn ? whenDyslexiaModeOn : {}),
    icon: <Icon className={icon.className} />,
  };
}

interface CommandPaletteModalProps {
  onClose: () => void;
  studies: SearchCaseStudy[];
}

const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  onClose,
  studies,
}) => {
  const [query, setQuery] = useState("");
  // Clearing the field resets results at once; typing waits 150ms (0ms under
  // React's act() test environment so suites stay synchronous).
  const debouncedQuery = useDebounce(
    query,
    query === "" || isActEnvironment() ? 0 : 150
  );
  const deferredQuery = useDeferredValue(debouncedQuery);

  const [activeIndex, setActiveIndex] = useState(0);
  const { playHover, playSubmit } = useAudio();
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const workspaceActions = useWorkspaceCommands();
  const {
    isRecording,
    recordingName,
    recordedStepsCount,
    savedMacros,
    startRecording,
    stopRecording,
    saveMacro,
    executeMacro,
  } = useMacroEngine();

  const router = useRouter();
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;

    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== backdrop
    );
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    for (const element of siblings) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    return () => {
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
    };
  }, []);

  // Rate-limit hover ticks during fast pointer sweeps and held arrow keys;
  // calls inside the 50ms window are dropped rather than queued.
  const throttledPlayHover = useThrottledCallback(
    playHover,
    isActEnvironment() ? 0 : 50,
    { trailing: false }
  );

  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: inputRef,
    onEscape: onClose,
    returnFocus: true,
  });

  // 1. Body scroll locking and focus trap management
  useEffect(() => {
    // Lock parent layout scrollbars
    document.body.style.overflow = "hidden";

    // Auto-focus input after transition has completed
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => {
      document.body.style.overflow = "";
      clearTimeout(timer);
    };
  }, []);

  // A homepage section picked while the homepage is open is scrolled to once
  // the palette has unmounted: until then the rest of the page is inert and
  // cannot take focus. The focus trap's cleanup runs first and queues a focus
  // restoration to the element that opened the palette; this timer is queued
  // after it, so focus ends on the section.
  const pendingAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    const pendingAnchor = pendingAnchorRef;
    return () => {
      const targetId = pendingAnchor.current;
      if (targetId) {
        setTimeout(() => scrollToElement(targetId), 0);
      }
    };
  }, []);

  // 2. Compile indexable items from static navigations and Neon DB records
  const allItems = useMemo(() => {
    const workspaceActionItems: PaletteItem[] = workspaceActions.map(
      (action) => ({
        id: `workspace-action-${action.id}`,
        title: action.title,
        subtitle:
          action.description || `${action.subToolName} Contextual Action`,
        category: "navigation",
        url: `action:workspace:${action.id}`,
        icon: <IconTerminal className="w-4 h-4 text-amber-400" />,
        badge: action.badge || action.subToolName,
        status: action.shortcut
          ? `Shortcut: ${action.shortcut}`
          : "Active Action",
        description:
          action.description ||
          `Execute ${action.title} on ${action.subToolName}`,
        techStack: [action.subToolName, ...(action.tags || [])],
        highlights: [
          `Sub-Tool: ${action.subToolName}`,
          ...(action.shortcut ? [`Shortcut: ${action.shortcut}`] : []),
        ],
      })
    );

    const macroControlItems: PaletteItem[] = [];
    if (isRecording) {
      macroControlItems.push({
        id: "action-macro-stop-save",
        title: `🔴 Stop & Save Macro Recording ("${recordingName}")`,
        subtitle: `${recordedStepsCount} step(s) recorded. Click to save macro.`,
        category: "navigation",
        url: "action:macro:stop-and-save",
        icon: <IconCircleDot className="w-4 h-4 text-rose-400 animate-pulse" />,
        badge: "Recording",
        status: `${recordedStepsCount} Steps`,
        description:
          "Conclude active macro recording session and save sequence to browser storage",
        techStack: ["Macro Engine", "portfolio_macros_v1"],
        highlights: [
          `${recordedStepsCount} steps captured`,
          "Safety Interlock: Max 20 steps",
        ],
      });
    } else {
      macroControlItems.push({
        id: "action-macro-start",
        title: "⏺ Start Macro Recording",
        subtitle: "Record ordered sequence of sub-tool workspace actions",
        category: "navigation",
        url: "action:macro:start",
        icon: <IconCircleDot className="w-4 h-4 text-rose-400" />,
        badge: "Macro Tool",
        status: "Macro Engine",
        description:
          "Capture subsequent workspace action dispatches into a reusable macro sequence",
        techStack: ["Macro Engine", "Event Bus"],
        highlights: [
          "Cross-tool automation",
          "Persisted in local browser storage",
        ],
      });
    }

    const savedMacroItems: PaletteItem[] = savedMacros.map((macro) => ({
      id: `macro-${macro.id}`,
      title: `▶ Macro: ${macro.name}`,
      subtitle: `${macro.steps.length} step(s) · ${
        macro.description || "Saved workspace macro"
      }`,
      category: "navigation",
      url: `action:macro:execute:${macro.id}`,
      icon: <IconPlayerPlay className="w-4 h-4 text-emerald-400" />,
      badge: "Macro",
      status: `${macro.steps.length} Steps`,
      description: `Executes sequence: ${macro.steps
        .map((s) => s.actionId)
        .join(" → ")}`,
      techStack: ["Saved Macro", "Sequential Async Execution"],
      highlights: [
        `${macro.steps.length} ordered action steps`,
        "Safety interlock: Max 20 steps",
      ],
    }));

    const staticNavs: PaletteItem[] = STATIC_NAVS.map((entry) =>
      toPaletteItem(entry, isDyslexic)
    );

    const safeStudies = Array.isArray(studies) ? studies : [];
    const studyItems: PaletteItem[] = safeStudies.map((study) => {
      const parsedTags = study.tags
        ? study.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      return {
        id: study.id,
        title: study.title,
        subtitle: `${study.primary_language} · ${study.tags}`,
        category: "case-study",
        url: `/case-studies/${study.slug}`,
        icon: <IconFileCode className="w-4 h-4 text-accent" />,
        badge: "Case Study",
        status: "Architectural Case",
        description: `In-depth technical breakdown covering architecture decisions, production trade-offs, and software craftsmanship for ${study.title}.`,
        techStack: [study.primary_language, ...parsedTags].filter(Boolean),
        highlights: [
          "Production architecture and trade-off analysis",
          "Source code snippets and design patterns",
          "Measured performance benchmarks & metrics",
        ],
      };
    });

    return [
      ...staticNavs,
      ...workspaceActionItems,
      ...macroControlItems,
      ...savedMacroItems,
      ...studyItems,
    ];
  }, [
    workspaceActions,
    isRecording,
    recordingName,
    recordedStepsCount,
    savedMacros,
    studies,
    isDyslexic,
  ]);

  // 3. In-Memory Fuzzy filtering matching queries against titles, tags, and secret easter egg triggers
  const filteredItems = useMemo(() => {
    const baseMatches = filterFuzzySearch(deferredQuery, allItems);
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return baseMatches;

    const secretItems: PaletteItem[] = [];

    if (q === "418" || q.includes("coffee") || q.includes("tea")) {
      secretItems.push({
        id: "secret-418",
        title: "HTTP 418: I'm a Teapot (RFC 2324)",
        subtitle: "Hyper Text Coffee Pot Control Protocol / RFC 7168",
        category: "navigation",
        url: "action:418",
        icon: <IconCoffee className="w-4 h-4 text-amber-400" />,
        badge: "RFC 2324",
        status: "Brewing Error",
        description:
          "HTCPCP 1.0 error: The requested entity body is short and stout. Cannot brew espresso on a web server.",
        techStack: ["RFC 2324", "RFC 7168", "HTCPCP/1.0"],
        highlights: [
          "Brew coffee action",
          "Teapot whistle sound effect",
          "Instant achievement unlock",
        ],
      });
    }

    if (q.includes("duck") || q.includes("puppy") || q.includes("woof")) {
      secretItems.push({
        id: "secret-duck",
        title: "🐾 Summon Duck the Golden Retriever puppy",
        subtitle: "Click to toss a treat and hear Duck bark happily!",
        category: "navigation",
        url: "action:duck",
        icon: <IconSparkles className="w-4 h-4 text-amber-400" />,
        badge: "Chief Bark Officer",
        status: "Good Boy",
        description:
          "Duck has achieved 100% test coverage by enthusiastically chewing through the staging network cables.",
        techStack: ["Golden Retriever AI", "Treat Physics", "Bark Synthesizer"],
        highlights: [
          "Playful synthesized puppy woof",
          "Achievement unlocked: Duck Whisperer",
          "100% Good Boy rating",
        ],
      });
    }

    if (q.includes("sudo") || q.includes("root")) {
      secretItems.push({
        id: "secret-sudo",
        title: "sudo su - (Permission Denied)",
        subtitle: "Incident reported to security team (and Duck 🐾)",
        category: "navigation",
        url: "action:sudo",
        icon: <IconTerminal className="w-4 h-4 text-rose-400" />,
        badge: "Security Log",
        status: "Denied",
        description:
          "User is not in the sudoers file. This incident has been logged in triplicate under 21 CFR Part 11 audit trails.",
        techStack: ["UNIX PAM", "21 CFR Part 11", "Audit Sentry"],
        highlights: [
          "Audit alert siren",
          "Immutable security log",
          "Terminal achievement progress",
        ],
      });
    }

    if (
      q.includes("chaos") ||
      q.includes("konami") ||
      q.includes("retro") ||
      q.includes("matrix")
    ) {
      secretItems.push({
        id: "secret-chaos",
        title: "🎮 Launch Retro Chaos Mode",
        subtitle:
          "Activate full-screen CRT scanline overlay and unlock secrets",
        category: "navigation",
        url: "action:chaos",
        icon: <IconSparkles className="w-4 h-4 text-emerald-400" />,
        badge: "Easter Egg",
        status: "CRT Ready",
        description:
          "Trigger the full-screen cyberpunk phosphor CRT scanline overlay, unlocking all easter eggs and achievement badges.",
        techStack: ["CRT Post-Processing", "Konami Engine", "Web Audio API"],
        highlights: [
          "Full-screen phosphor CRT scanlines",
          "8-bit fanfare chime",
          "Unlocks Secret Meme Vault",
        ],
      });
    }

    if (q.includes("friday") || q.includes("push") || q.includes("deploy")) {
      secretItems.push({
        id: "secret-friday",
        title: "🚨 Git Push --Force to Main (Friday 4:59 PM)",
        subtitle: "Simulate a high-stakes emergency production deployment",
        category: "navigation",
        url: "action:friday",
        icon: <IconFlame className="w-4 h-4 text-red-400" />,
        badge: "High Risk",
        status: "Alarm Armed",
        description:
          "Push directly to production without testing. Will the server survive the weekend?",
        techStack: ["Git Engine", "Friday Deploy Protocol", "Panic Siren"],
        highlights: [
          "Dramatic alarm siren sound",
          "Achievement unlocked: Friday Deploy Survivor",
          "Zero staging fear",
        ],
      });
    }

    if (q === "ping") {
      secretItems.push({
        id: "secret-ping",
        title:
          "ping 127.0.0.1 -> 64 bytes from localhost: icmp_seq=1 ttl=64 time=0.012 ms",
        subtitle: "Lake Minnetonka cluster is 100% online",
        category: "navigation",
        url: "action:ping",
        icon: <IconTerminal className="w-4 h-4 text-amber-400" />,
        badge: "ICMP Pong",
        status: "0.012ms",
        description:
          "Direct zero-latency heartbeat from the local Next.js 15 kernel runtime.",
        techStack: ["ICMP Ping", "Localhost", "Zero Latency"],
        highlights: [
          "Instant response",
          "Sub-millisecond latency",
          "100% uptime",
        ],
      });
    }

    return [...secretItems, ...baseMatches];
  }, [allItems, deferredQuery]);

  const handleItemHover = useCallback(
    (index: number) => {
      if (index !== activeIndex) {
        setActiveIndex(index);
        throttledPlayHover();
      }
    },
    [activeIndex, throttledPlayHover]
  );

  // 4. Keyboard Control Handlers (↑↓, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
      throttledPlayHover();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
      );
      throttledPlayHover();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[activeIndex];
      if (selected) {
        handleSelectItem(selected);
      }
    }
  };

  const handleSelectItem = (item: PaletteItem) => {
    if (typeof playSubmit === "function") {
      playSubmit();
    }
    onClose();

    // Handle special easter egg action commands
    if (item.url.startsWith("action:")) {
      const actionType = item.url.replace("action:", "");
      if (actionType.startsWith("workspace:")) {
        const actionId = actionType.replace("workspace:", "");
        workspaceCommandRegistry.executeAction(actionId);
        announce(`Executed workspace action "${item.title}".`, "polite");
        return;
      }
      if (actionType === "macro:start") {
        const defaultName = `Macro ${savedMacros.length + 1}`;
        startRecording(defaultName);
        announce(`Started macro recording "${defaultName}".`, "polite");
        return;
      }
      if (actionType === "macro:stop-and-save") {
        let customName: string | null = "Validate & Verify Workflow";
        if (
          typeof window !== "undefined" &&
          typeof window.prompt === "function"
        ) {
          customName = window.prompt(
            "Enter a name for this macro sequence:",
            recordingName || "Validate & Verify Workflow"
          );
        }
        if (customName) {
          saveMacro(customName.trim() || "Validate & Verify Workflow");
          announce(
            `Saved macro "${customName}" with ${recordedStepsCount} steps.`,
            "polite"
          );
        } else {
          stopRecording();
          announce("Stopped macro recording.", "polite");
        }
        return;
      }
      if (actionType.startsWith("macro:execute:")) {
        const macroId = actionType.replace("macro:execute:", "");
        executeMacro(macroId);
        announce(`Executing macro "${item.title}".`, "polite");
        return;
      }
      if (actionType === "toggle-dyslexia") {
        toggleDyslexiaMode();
        announce(
          !isDyslexic
            ? "Dyslexia mode activated. Using OpenDyslexic typeface with increased line spacing and letter tracking."
            : "Dyslexia mode deactivated. Restored Atkinson Hyperlegible and Lexend typography.",
          "polite"
        );
      } else if (actionType === "418") {
        unlockAchievement("rfc-barista");
        playMemeSound("teapot-whistle");
      } else if (actionType === "duck") {
        unlockAchievement("duck-whisperer");
        playMemeSound("bark");
      } else if (actionType === "sudo") {
        unlockAchievement("terminal-cowboy");
        playMemeSound("fda-siren");
      } else if (actionType === "chaos") {
        unlockAchievement("konami-hero");
        setVaultUnlocked(true);
        playMemeSound("fanfare");
        emitAppEvent("trigger_retro_chaos");
      } else if (actionType === "friday") {
        unlockAchievement("friday-survivor");
        playMemeSound("friday-alarm");
      } else if (actionType === "ping") {
        playMemeSound("matrix-glitch");
      } else if (actionType === "photos") {
        emitAppEvent("open-photo-gallery");
      }
      return;
    }

    // On the homepage a homepage section is scrolled to in page. From any
    // other page the palette navigates, and the router scrolls to the hash
    // once the homepage has rendered.
    if (item.url.startsWith("/#") && window.location.pathname === "/") {
      const targetId = item.url.substring(2);
      if (document.getElementById(targetId)) {
        pendingAnchorRef.current = targetId;
        return;
      }
    }
    router.push(item.url);
  };

  // Close when clicking directly on the backdrop container
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const activeItem = filteredItems[activeIndex] || filteredItems[0];

  return (
    <motion.div
      ref={backdropRef}
      key="command-palette-backdrop"
      initial={false}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(1.5rem,env(safe-area-inset-top)+1rem)] sm:pt-[12vh] px-3 sm:px-4 pb-[max(1.5rem,env(safe-area-inset-bottom)+1rem)] bg-zinc-950/85 backdrop-blur-md transition-all duration-300 overflow-y-auto"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        initial={false}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        ref={trapRef}
        className="w-full max-w-3xl bg-[#13151a] border border-zinc-800/90 rounded-3xl overflow-hidden flex flex-col relative my-auto sm:my-0 max-h-[85vh]"
      >
        {/* Input Header container */}
        <div className="relative z-10 flex items-center border-b border-zinc-800/60 p-3 sm:p-4 gap-2 sm:gap-3">
          <IconSearch className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            id={searchId}
            type="text"
            placeholder="Search cases, tools, games, sections..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={true}
            aria-autocomplete="list"
            aria-controls="palette-results-list"
            aria-activedescendant={
              activeItem ? `palette-option-${activeItem.id}` : undefined
            }
            aria-haspopup="listbox"
            aria-label="Spotlight command palette search"
            className="w-full bg-transparent text-sm sm:text-base text-neutral-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          {isRecording && (
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg flex-shrink-0 select-none">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              REC ({recordedStepsCount})
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="ESC, close command search"
            className="min-h-10 min-w-10 flex items-center justify-center text-xs font-mono font-bold tracking-wider text-zinc-300 px-2.5 py-1 bg-zinc-950 border border-zinc-700 hover:border-accent/40 hover:text-accent rounded-xl cursor-pointer select-none transition"
          >
            ESC
          </button>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60 overflow-hidden">
          {/* Left: Results List section */}
          <div className="col-span-12 md:col-span-7 flex flex-col min-h-0 max-h-[380px] overflow-hidden">
            {filteredItems.length > 0 ? (
              <div
                id="palette-results-list"
                role="listbox"
                aria-label="Search outcomes list"
                className="flex-1 max-h-[380px] overflow-y-auto p-2.5 space-y-1 scrollbar-none"
              >
                {filteredItems.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={item.id}
                      id={`palette-option-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      aria-describedby={
                        isActive ? "palette-preview-pane" : undefined
                      }
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => handleItemHover(index)}
                      className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 border ${
                        isActive
                          ? "bg-zinc-950 border-accent/25"
                          : "bg-transparent border-transparent hover:bg-zinc-950/40"
                      }`}
                    >
                      {/* Left icon wrapper */}
                      <span
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors duration-300 flex-shrink-0 ${
                          isActive
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "bg-zinc-950 border-zinc-900 text-zinc-400"
                        }`}
                      >
                        {item.icon}
                      </span>

                      {/* Dynamic label strings */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                              isActive ? "text-accent" : "text-zinc-400"
                            }`}
                          >
                            {getNavGroupForHref(item.url) && (
                              <span data-testid="palette-group">
                                {getNavGroupForHref(item.url)?.label}
                                {" · "}
                              </span>
                            )}
                            {item.badge ||
                              (item.category === "case-study"
                                ? "Case Study"
                                : "Site Channel")}
                          </span>
                          {item.status && (
                            <span className="hidden sm:inline-block text-[9px] font-mono text-zinc-400 border border-zinc-800/80 px-1.5 py-0.2 rounded">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-sm font-semibold truncate transition-colors ${
                            isActive ? "text-white" : "text-neutral-300"
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-xs text-zinc-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>

                      {/* Right Enter Shortcut icon */}
                      {isActive && (
                        <span className="text-xs font-mono text-zinc-400 flex items-center gap-1 animate-pulse flex-shrink-0 select-none">
                          <span className="hidden sm:inline">Select</span>
                          <IconCornerDownLeft className="w-3.5 h-3.5 text-accent" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 max-h-[380px] overflow-y-auto p-2.5 space-y-1 scrollbar-none py-12 text-center select-none">
                <p className="text-sm text-zinc-400 italic">
                  No outcomes match search query.
                </p>
                <p className="text-xs font-mono text-zinc-400 mt-1 uppercase tracking-widest">
                  Try searching other tags
                </p>
              </div>
            )}
          </div>

          {/* Right: Contextual Preview Pane (Desktop >= 768px) */}
          <div
            id="palette-preview-pane"
            aria-live="polite"
            tabIndex={0}
            aria-label="Selected result preview"
            className="hidden md:flex md:col-span-5 flex-col justify-between p-4 bg-zinc-950/60 min-h-0 overflow-y-auto max-h-[380px] scrollbar-none"
          >
            {activeItem ? (
              <motion.div
                key={activeItem.id}
                initial={false}
                animate={{ y: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="flex flex-col h-full justify-between gap-3"
              >
                {/* Top section: Badges, Title, Description */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                      {getNavGroupForHref(activeItem.url) && (
                        <span data-testid="palette-preview-group">
                          {getNavGroupForHref(activeItem.url)?.label}
                          {" · "}
                        </span>
                      )}
                      {activeItem.badge ||
                        (activeItem.category === "case-study"
                          ? "Case Study"
                          : "Navigation")}
                    </span>
                    {activeItem.status && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {activeItem.status}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                      {activeItem.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white leading-tight">
                        {activeItem.title}
                      </h2>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                        {activeItem.url}
                      </p>
                    </div>
                  </div>

                  {activeItem.description && (
                    <p className="text-xs text-zinc-300 leading-relaxed mt-2.5 border-t border-zinc-850 pt-2.5">
                      {activeItem.description}
                    </p>
                  )}

                  {/* Tech Stack Pills */}
                  {activeItem.techStack && activeItem.techStack.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                        Tech Stack & Specs
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeItem.techStack.map((tech, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Capability Highlights */}
                  {activeItem.highlights &&
                    activeItem.highlights.length > 0 && (
                      <div className="mt-3 border-t border-zinc-850 pt-2.5">
                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                          Key Highlights
                        </div>
                        <ul className="space-y-1">
                          {activeItem.highlights.map((highlight, idx) => (
                            <li
                              key={idx}
                              className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug"
                            >
                              <span className="text-accent text-xs leading-none">
                                ▸
                              </span>
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>

                {/* Bottom Quick Navigation Hint */}
                <div className="pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono text-zinc-400 select-none">
                  <span className="flex items-center gap-1 text-accent/90">
                    <span className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">
                      ↵ ENTER
                    </span>
                    <span>Launch</span>
                  </span>
                  <span className="truncate max-w-[140px] text-zinc-400">
                    {activeItem.url}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 p-4">
                <IconTerminal className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs font-mono uppercase tracking-wider">
                  Select a route or case
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer bar */}
        <div className="relative z-10 border-t border-zinc-800/60 p-3 bg-zinc-950/60 flex justify-between items-center text-xs font-mono text-zinc-400 select-none">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ↑↓
              </span>{" "}
              Move
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ↵
              </span>{" "}
              Enter
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="bg-zinc-900 border border-zinc-800 px-1 rounded-md text-[10px]">
                ESC
              </span>{" "}
              Close
            </span>
          </div>
          <div>
            <span>SEARCH RESULTS: {filteredItems.length}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Cmd+K and Ctrl+K both toggle the palette on every platform, matching the
// hand-written listener this replaced, which accepted either modifier (or
// both) and ignored Alt. matchesHotkey matches Ctrl, Meta and Alt exactly, so
// each accepted combination is listed; Shift is tolerated because it is only
// required when named.
const PALETTE_TOGGLE_HOTKEYS = [
  "Meta+K",
  "Ctrl+K",
  "Ctrl+Meta+K",
  "Alt+Meta+K",
  "Ctrl+Alt+K",
  "Ctrl+Alt+Meta+K",
] as const;

export const CommandPalette: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { isOpen, setIsOpen, closeSearch } = useSearch();
  const [studies, setStudies] = useState<SearchCaseStudy[]>([]);
  const originalFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // 1. Keyboard Shortcut Listener (Cmd+K / Ctrl+K) site-wide. Either modifier
  // toggles on every platform, and it also fires from inside the palette's own
  // search input so the same chord closes it. Keys inside a
  // [data-keyboard-boundary] region (games, terminals) are left to that region.
  useHotkeys(PALETTE_TOGGLE_HOTKEYS, () => setIsOpen(!isOpen), {
    enabled: isMounted,
    allowInInputs: true,
    preventDefault: true,
  });

  // Expose test helper globally to open search modal programmatically
  useEffect(() => {
    if (!isMounted) return;
    window.__openSearch = () => {
      setIsOpen(true);
    };
    return () => {
      delete window.__openSearch;
    };
  }, [isMounted, setIsOpen]);

  // Capture original focus state when the palette opens
  useEffect(() => {
    if (!isMounted) return;
    if (isOpen) {
      originalFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen, isMounted]);

  // 2. Fetch search case studies on-demand when palette opens or during idle time
  useEffect(() => {
    if (!isMounted) return;
    if (studies.length > 0) return;

    let isSubscribed = true;

    const loadStudies = async () => {
      try {
        const res = await apiClient.get<SearchCaseStudy[]>("/api/case-studies");
        if (res.ok && isSubscribed && res.data) {
          if (Array.isArray(res.data)) {
            setStudies(res.data);
          }
        }
      } catch (err) {
        logger.error("Failed to load search dynamic case studies:", err);
      }
    };

    if (isOpen) {
      loadStudies();
    } else if (
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
    ) {
      const idleWindow = window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof idleWindow.requestIdleCallback === "function") {
        const idleId = idleWindow.requestIdleCallback(
          () => {
            loadStudies();
          },
          { timeout: 4000 }
        );
        return () => {
          isSubscribed = false;
          if (typeof idleWindow.cancelIdleCallback === "function") {
            idleWindow.cancelIdleCallback(idleId);
          }
        };
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [isMounted, isOpen, studies.length]);

  const handleClose = () => {
    closeSearch();
    originalFocusRef.current?.focus();
  };

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <CommandPaletteModal
          key="command-palette-modal"
          onClose={handleClose}
          studies={studies}
        />
      )}
    </AnimatePresence>,
    document.body
  );
};
