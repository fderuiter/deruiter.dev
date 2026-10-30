"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { PanInfo } from "framer-motion";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  STORY_RAM_MULTIPLIER,
  getRunStartingRam,
  ACT_ONE_CAPSTONE_LEVEL_ID,
  ACT_TWO_FIRST_CHAPTER,
  isTacticBanned,
  isVariantCleared,
  isVariantRunCleared,
} from "@/lib/quasi-perfect";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { RAMGauge } from "./RAMGauge";
import { VictoryModal } from "./VictoryModal";
import { MultiGoalTabs } from "./MultiGoalTabs";
import { DiagnosticDrawers } from "./DiagnosticDrawers";
import { HintSystem } from "./HintSystem";
import { SandboxMode } from "./SandboxMode";
import { TheoryBriefingModal } from "./TheoryBriefingModal";
import { LevelMap } from "./LevelMap";
import { VariantPicker } from "./VariantPicker";
import { useArcadeFx } from "@/hooks/useArcadeFx";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useCabinetTouch } from "@/components/arcade/mobile";
import {
  IconBulb,
  IconChevronDown,
  IconFlask,
  IconRoute,
  IconRotate,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import {
  ACT_TWO_LOCKED_MESSAGE,
  CURRICULUM_LABEL,
  useQuasiSession,
} from "./useQuasiSession";

// Matches the level heading's scroll-mt-nav-24 offset (6rem), which clears the fixed Navbar.
const NAVBAR_CLEARANCE_PX = 96;
export const QuasiPerfectPuzzler: React.FC = () => {
  // Event-only board feedback: a small shake on a failed tactic, an emerald
  // flash when a goal closes. Off under reduced motion, below 768px and when
  // the cabinet's Setup Wizard turns screen shake off.
  const fx = useArcadeFx();
  const { stageRef: fxStageRef, flashRef: fxFlashRef } = fx;

  const {
    actTwoOpen,
    activeGoalIndex,
    activeHypotheses,
    activeSubgoal,
    activeTab,
    activeVariant,
    announce,
    campaignStars,
    currentLevel,
    currentLevelGolfed,
    currentLevelIndex,
    currentLevelPar,
    currentRam,
    currentScore,
    executeTacticOnNode,
    gameMode,
    generatedLeanScript,
    goalAST,
    handleCancelModeChange,
    handleConfirmModeChange,
    handleRedo,
    handleResetLevel,
    handleSelectVariant,
    handleToggleMode,
    handleUndo,
    history,
    hoveredTargetId,
    isOOM,
    levelSolved,
    levelVariants,
    loadLevel,
    logs,
    modeRules,
    parsedProgress,
    pendingMode,
    playNote,
    playableLevels,
    proofSteps,
    redoHistory,
    runStartingRam,
    selectedTacticIndex,
    selectedTargetId,
    setActiveGoalIndex,
    setActiveTab,
    setHoveredTargetId,
    setSelectedTacticIndex,
    setSelectedTargetId,
    setShowHints,
    showHints,
    stepLimitFailed,
    subgoals,
    targetingHint,
    variantsUnlocked,
  } = useQuasiSession({ fx });

  // Board first (#1519): the Lean inspector starts collapsed at every width.
  const [showLeanInspector, setShowLeanInspector] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Escape hides the result card for this run so the solved board can be read.
  const [dismissedScoreAt, setDismissedScoreAt] = useState<number | null>(null);
  const showResultRef = useRef<HTMLButtonElement | null>(null);
  const dismissResult = useCallback((timestamp: number) => {
    setDismissedScoreAt(timestamp);
    // Hand focus to the button that reopens the card, so keyboard players
    // are not dropped at the top of the cabinet.
    requestAnimationFrame(() => {
      const button = showResultRef.current;
      button?.focus({ preventScroll: true });
      if (typeof button?.scrollIntoView === "function") {
        button.scrollIntoView({ block: "nearest" });
      }
    });
  }, []);

  // Drag-and-drop collision detection
  const handleCardDragEnd = useCallback(
    (
      tacticIdx: number,
      event: MouseEvent | TouchEvent | PointerEvent,
      _info: PanInfo
    ) => {
      const clientX =
        "clientX" in event
          ? event.clientX
          : (event as TouchEvent).changedTouches?.[0]?.clientX;
      const clientY =
        "clientY" in event
          ? event.clientY
          : (event as TouchEvent).changedTouches?.[0]?.clientY;

      if (typeof clientX === "number" && typeof clientY === "number") {
        const elementsUnderPoint = document.elementsFromPoint(clientX, clientY);
        let targetNodeId: string | null = null;

        for (const el of elementsUnderPoint) {
          const nodeId =
            el.getAttribute("data-node-id") ||
            el.closest("[data-node-id]")?.getAttribute("data-node-id");
          if (nodeId) {
            targetNodeId = nodeId;
            break;
          }
        }

        executeTacticOnNode(tacticIdx, targetNodeId);
      }
      setHoveredTargetId(null);
    },
    [executeTacticOnNode, setHoveredTargetId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Typing in the Sandbox fields must reach the field, not the shortcuts.
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, [contenteditable='true'], [role='dialog']"
      )
    ) {
      return;
    }
    if (e.altKey) return;
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleUndo();
    } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRedo();
    } else if (e.ctrlKey || e.metaKey) {
      return;
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      handleResetLevel();
    } else if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      setShowHints((prev) => !prev);
    } else if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      setShowLeanInspector((prev) => !prev);
    } else if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      // Stop this press reaching the window, where the briefing's own
      // B-to-close listener is already attached by the time it bubbles (#1939).
      e.stopPropagation();
      setShowBriefingModal((prev) => !prev);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      handleToggleMode(gameMode === "story" ? "hacker" : "story");
    }
  };

  const containerRef = useRef<HTMLElement | null>(null);
  const levelHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [levelIndexOpen, setLevelIndexOpen] = useState<boolean>(false);
  const [modeRulesOpen, setModeRulesOpen] = useState<boolean>(false);
  const levelToggleRef = useRef<HTMLButtonElement | null>(null);
  const headerRowRef = useRef<HTMLDivElement | null>(null);
  // The drawer drops from just under the header row, which wraps to two
  // lines on narrower cabinets, so its offset is measured when it opens.
  const [drawerTop, setDrawerTop] = useState<number>(52);
  const currentLevelButtonRef = useRef<HTMLButtonElement | null>(null);

  // Opening the level drawer moves focus to the current level on the map;
  // Escape or Close returns it to the toggle.
  const toggleLevelDrawer = useCallback(() => {
    const next = !levelIndexOpen;
    setLevelIndexOpen(next);
    if (next) {
      const headerHeight = headerRowRef.current?.offsetHeight;
      if (headerHeight) setDrawerTop(headerHeight + 8);
      requestAnimationFrame(() => {
        const button = currentLevelButtonRef.current;
        button?.focus({ preventScroll: true });
        // The focused level must be on screen, not under the fold (#2197).
        if (typeof button?.scrollIntoView === "function") {
          button.scrollIntoView({ block: "nearest" });
        }
      });
    }
  }, [levelIndexOpen]);

  const closeLevelDrawer = useCallback(() => {
    setLevelIndexOpen(false);
    levelToggleRef.current?.focus({ preventScroll: true });
  }, []);

  // Choosing a level from the index collapses it again (small screens) and
  // moves focus and scroll to the active task so keyboard and screen-reader
  // users land on the level they picked.
  const handleSelectLevel = useCallback(
    (index: number) => {
      loadLevel(index);
      setLevelIndexOpen(false);
      requestAnimationFrame(() => {
        const heading = levelHeadingRef.current;
        if (!heading) return;
        heading.focus({ preventScroll: true });
        if (typeof heading.scrollIntoView === "function") {
          // scroll-mt-nav-24 on the heading keeps it clear of the fixed Navbar.
          heading.scrollIntoView({ block: "start" });
        }
      });
    },
    [loadLevel]
  );
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);
  // True inside the immersive touch cabinet (#2042). Every touch-only change
  // below hangs off this, so a desktop cabinet keeps its markup and classes.
  const inCabinet = useCabinetTouch();

  // Deep proof trees push the tactic hand below the fold on desktop screens.
  // While the game fills the view but the hand's slot is cut off at the
  // bottom, the hand docks to the bottom of the viewport; its slot keeps the
  // height so nothing jumps (#1939).
  const handSlotRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const [handDock, setHandDock] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const updateHandDock = useCallback(() => {
    const slot = handSlotRef.current;
    const hand = handRef.current;
    const section = containerRef.current;
    if (!slot || !hand || !section) return;
    const viewportBottom = window.innerHeight;
    const slotRect = slot.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    // The open level map sits over the board; a docked hand would cover its
    // lower rows, so the hand stays in its slot while the map is open (#2197).
    const shouldDock =
      !levelIndexOpen &&
      slotRect.height > 0 &&
      slotRect.bottom > viewportBottom + 1 &&
      sectionRect.top < viewportBottom / 2;
    setHandDock((prev) => {
      if (!shouldDock) return prev === null ? prev : null;
      const height = hand.offsetHeight;
      const next = { left: slotRect.left, width: slotRect.width, height };
      return prev &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
        ? prev
        : next;
    });
  }, [levelIndexOpen]);

  // A deep goal (Act 2's induction cases) can sit wholly under the docked
  // hand. When a level loads or the goal changes, the page scrolls just far
  // enough for the tree to clear the hand, without pushing the goal formula
  // under the fixed navbar (#2196).
  const revealProofTree = useCallback(() => {
    const section = containerRef.current;
    const slot = handSlotRef.current;
    const hand = handRef.current;
    if (!section || !slot || !hand) return;
    if (inCabinet) {
      // The touch cabinet scrolls its board, not the page: bring the tree
      // region into the board's view, keeping its top edge visible (#2195).
      const touchBoard = section.querySelector(".qp-touch-board");
      const region = section.querySelector(".qp-touch-tree");
      if (!touchBoard || !region) return;
      const boardRect = touchBoard.getBoundingClientRect();
      const regionRect = region.getBoundingClientRect();
      const by = Math.min(
        regionRect.bottom - boardRect.bottom,
        regionRect.top - boardRect.top
      );
      if (by > 0) touchBoard.scrollTop += by;
      return;
    }
    const viewportBottom = window.innerHeight;
    if (section.getBoundingClientRect().top >= viewportBottom / 2) return;
    const tree = section.querySelector('[data-testid="proof-board-tree"]');
    const board = tree?.closest(".qp-board");
    if (!tree || !board) return;
    const slotRect = slot.getBoundingClientRect();
    const handTop =
      slotRect.bottom > viewportBottom + 1
        ? viewportBottom - hand.offsetHeight
        : slotRect.top;
    const hidden = tree.getBoundingClientRect().bottom - (handTop - 8);
    const room = board.getBoundingClientRect().top - NAVBAR_CLEARANCE_PX;
    const by = Math.min(hidden, room);
    if (by > 0) window.scrollBy({ top: by, behavior: "auto" });
  }, [inCabinet]);

  // Desktop: the height the tree may use so that, scrolled just under the
  // navbar, it ends above the docked hand. The tree's rows close up to fit.
  const [treeFitHeight, setTreeFitHeight] = useState<number | undefined>();
  const measureTreeFit = useCallback(() => {
    const section = containerRef.current;
    const hand = handRef.current;
    if (inCabinet || !section || !hand) return;
    const region = section.querySelector(
      '[data-testid="proof-board-tree"]'
    )?.parentElement;
    const board = region?.closest(".qp-board");
    if (!region || !board) return;
    const headerHeight =
      region.getBoundingClientRect().top - board.getBoundingClientRect().top;
    const next = Math.floor(
      window.innerHeight -
        NAVBAR_CLEARANCE_PX -
        headerHeight -
        hand.offsetHeight -
        16
    );
    setTreeFitHeight((prev) => (prev === next ? prev : next));
  }, [inCabinet]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    measureTreeFit();
    window.addEventListener("resize", measureTreeFit);
    return () => window.removeEventListener("resize", measureTreeFit);
  }, [activeTab, currentLevelIndex, subgoals, activeGoalIndex, measureTreeFit]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    // Two frames: a level picked from the map scrolls its heading first.
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(revealProofTree);
    });
    return () => {
      window.cancelAnimationFrame(outer);
      if (inner) window.cancelAnimationFrame(inner);
    };
  }, [
    activeTab,
    currentLevelIndex,
    subgoals,
    activeGoalIndex,
    // Rows close up after the fit height is measured; reveal again then.
    treeFitHeight,
    revealProofTree,
  ]);

  useEffect(() => {
    if (activeTab !== "campaign" || typeof window === "undefined") return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateHandDock();
      });
    };
    schedule();
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    if (observer && containerRef.current)
      observer.observe(containerRef.current);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [activeTab, updateHandDock]);

  const latestLog = logs.length > 1 ? logs[logs.length - 1] : undefined;
  const modeButtonClass = (isOn: boolean) =>
    `qp-focus min-h-[40px] px-3 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1 ${
      isOn ? "qp-btn-primary" : "text-zinc-300 hover:text-zinc-100"
    }`;
  const quietButtonClass =
    "qp-btn-quiet qp-focus min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <section
      ref={containerRef}
      aria-labelledby="quasi-puzzler-heading"
      tabIndex={0}
      data-keyboard-boundary="true"
      onKeyDown={handleKeyDown}
      className={`qp-root relative w-full font-mono outline-none ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] max-w-none bg-[color:var(--qp-stage)] p-3 sm:p-6 overflow-y-auto select-none"
          : "bg-[color:var(--qp-stage)] p-3 sm:p-4"
      }${inCabinet ? " qp-touch" : ""}`}
    >
      <FullscreenButton
        isFullscreen={isFullscreen}
        onToggle={toggleFullscreen}
        variant="floating"
      />

      <h2 id="quasi-puzzler-heading" className="sr-only">
        Quasi-Perfect Puzzler
      </h2>

      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint className="w-full mb-3" />

      <div className="relative">
        {/* 1. Compact header: level drawer, mode, campaign/sandbox, tools */}
        <div
          ref={headerRowRef}
          className={`flex flex-wrap items-center gap-2${inCabinet ? " qp-touch-header" : ""}`}
        >
          {activeTab === "campaign" && (
            <button
              ref={levelToggleRef}
              type="button"
              aria-expanded={levelIndexOpen}
              aria-controls="quasi-level-index"
              onClick={toggleLevelDrawer}
              className={`${quietButtonClass} ${levelIndexOpen ? "border-[color:var(--qp-accent)]" : ""}`}
            >
              <IconRoute className="w-4 h-4 qp-text-accent" />
              <span className="sr-only">
                {levelIndexOpen ? "Hide levels" : "Browse levels"} ·{" "}
              </span>
              <span className="tabular-nums">
                <span className="hidden xl:inline">
                  Ch {currentLevel.chapter} ·{" "}
                </span>
                Level {currentLevel.id} of {playableLevels.length}
              </span>
              <IconChevronDown
                aria-hidden="true"
                className={`w-3.5 h-3.5 text-zinc-400 ${levelIndexOpen ? "rotate-180" : ""}`}
              />
            </button>
          )}

          <div
            role="group"
            aria-label="Game mode"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-0.5"
          >
            <button
              type="button"
              onClick={() => handleToggleMode("story")}
              aria-pressed={gameMode === "story"}
              className={modeButtonClass(gameMode === "story")}
            >
              Story<span className="sr-only"> Mode</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode("hacker")}
              aria-pressed={gameMode === "hacker"}
              className={modeButtonClass(gameMode === "hacker")}
            >
              Hacker<span className="sr-only"> Mode</span>
            </button>
          </div>

          <div
            role="group"
            aria-label="Campaign or sandbox"
            className="flex items-center gap-0.5 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setActiveTab("campaign")}
              aria-pressed={activeTab === "campaign"}
              className={modeButtonClass(activeTab === "campaign")}
            >
              Campaign
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sandbox")}
              aria-pressed={activeTab === "sandbox"}
              className={modeButtonClass(activeTab === "sandbox")}
            >
              <IconFlask className="hidden xl:block w-3.5 h-3.5" />
              <span>Sandbox</span>
            </button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {activeTab === "campaign" && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBriefingModal(true)}
                  title="Theory Briefing (B)"
                  className={quietButtonClass}
                >
                  <IconSparkles className="w-3.5 h-3.5 qp-text-accent" />
                  {/* Icon-only below xl keeps the header on one row at
                      1024px, so the tactic hand stays on screen (#1939). */}
                  <span>
                    <span className="sr-only">Theory </span>
                    <span className="sr-only xl:not-sr-only">Briefing</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHints((prev) => !prev)}
                  aria-pressed={showHints}
                  className={`${quietButtonClass} ${showHints ? "border-amber-500/60 text-amber-200" : ""}`}
                >
                  <IconBulb
                    className={`w-3.5 h-3.5 ${showHints ? "text-amber-300" : ""}`}
                  />
                  <span>
                    Hints
                    <span className="hidden xl:inline">
                      {showHints ? " On" : " Off"}
                    </span>
                  </span>
                </button>
              </>
            )}
            <FieldManualButton manualId="quasi-puzzler" label="Manual" />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          </div>
        </div>

        {pendingMode && (
          <div
            role="alertdialog"
            aria-labelledby="mode-change-title"
            aria-describedby="mode-change-desc"
            className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3"
          >
            <p
              id="mode-change-title"
              className="text-sm font-bold text-amber-300"
            >
              Switch to {pendingMode === "story" ? "Story" : "Hacker"} Mode and
              restart this level?
            </p>
            <p
              id="mode-change-desc"
              className="mt-1 text-xs text-zinc-400 break-words"
            >
              Your current proof steps and RAM usage will be discarded and the
              level restarts with a fresh{" "}
              {getRunStartingRam(currentLevel, pendingMode, activeVariant)} GB
              budget.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmModeChange}
                className="qp-focus min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg bg-amber-400 text-black"
              >
                Restart in {pendingMode === "story" ? "Story" : "Hacker"} Mode
              </button>
              <button
                type="button"
                onClick={handleCancelModeChange}
                className={quietButtonClass}
              >
                Keep current proof
              </button>
            </div>
          </div>
        )}

        {/* 2. Sandbox View (if selected) */}
        {activeTab === "sandbox" ? (
          <div className={`mt-4${inCabinet ? " qp-touch-board" : ""}`}>
            <SandboxMode />
          </div>
        ) : (
          <>
            {/* Task row: the level, the RAM stick, undo/redo/reset */}
            <div className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold">
                  <span className="qp-text-accent-strong uppercase tracking-wider">
                    Chapter {currentLevel.chapter} · {currentLevel.chapterTitle}
                  </span>
                  <span className="text-zinc-400" aria-hidden="true">
                    |
                  </span>
                  <span className="text-zinc-300">{currentLevel.subtitle}</span>
                  {gameMode === "story" ? (
                    <span className="rounded border border-[color:var(--qp-hairline)] px-1.5 text-[9px] text-zinc-300">
                      STORY MODE · {STORY_RAM_MULTIPLIER}× RAM
                    </span>
                  ) : (
                    <span className="rounded border border-amber-500/40 px-1.5 text-[9px] text-amber-300">
                      HACKER MODE
                    </span>
                  )}
                </div>
                <h3
                  ref={levelHeadingRef}
                  tabIndex={-1}
                  id="quasi-current-level-heading"
                  className="scroll-mt-nav-24 mt-0.5 rounded-sm text-lg font-bold tracking-[-0.02em] text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--qp-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {currentLevel.title}
                </h3>
                <p className="text-xs text-zinc-400 break-words">
                  {currentLevel.description}
                </p>
                <p
                  data-testid="quasi-level-targets"
                  className="mt-1 text-[11px] text-zinc-400 break-words tabular-nums"
                >
                  <span className="font-bold text-amber-300">Gold</span>: use{" "}
                  {Math.max(
                    0,
                    currentLevel.initialRam - currentLevel.goldRamTarget
                  )}{" "}
                  GB or less
                  {currentLevelPar !== null && (
                    <>
                      {" · "}
                      <span data-testid="quasi-level-par">
                        par {currentLevelPar} tactic
                        {currentLevelPar === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                  {currentLevelGolfed && (
                    <span className="ml-2 rounded border border-emerald-500/40 px-1.5 text-[10px] font-bold text-emerald-300">
                      GOLFED
                    </span>
                  )}
                </p>
                {levelVariants.length > 0 && (
                  <VariantPicker
                    variants={levelVariants}
                    activeKind={activeVariant ? activeVariant.kind : null}
                    unlocked={variantsUnlocked}
                    isCleared={(kind) =>
                      isVariantCleared(parsedProgress, currentLevel.id, kind)
                    }
                    onSelect={handleSelectVariant}
                  />
                )}
              </div>

              <RAMGauge currentRam={currentRam} initialRam={runStartingRam} />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0 || levelSolved}
                  className={quietButtonClass}
                >
                  <IconArrowBackUp className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoHistory.length === 0 || levelSolved}
                  className={quietButtonClass}
                >
                  <IconArrowForwardUp className="w-3.5 h-3.5" />
                  <span>Redo</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetLevel}
                  className={quietButtonClass}
                >
                  <IconRotate className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Level drawer: the chapter map and the mode rules, over the board */}
            <div
              id="quasi-level-index"
              data-testid="quasi-level-index"
              role="region"
              aria-label="Level map"
              style={
                inCabinet
                  ? {
                      top: drawerTop,
                      // The cabinet's own height bounds the map; it scrolls.
                      maxHeight: `calc(100dvh - ${drawerTop + 16}px)`,
                      overflowY: "auto",
                    }
                  : { top: drawerTop }
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeLevelDrawer();
                }
              }}
              className={`${
                levelIndexOpen ? "block" : "hidden"
              } absolute inset-x-0 z-30 rounded-2xl border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">
                    Level Map
                  </span>
                  <span className="qp-chip-accent rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    {CURRICULUM_LABEL}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeLevelDrawer}
                  className={quietButtonClass}
                >
                  <IconX className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>

              <LevelMap
                levels={puzzleLevels}
                currentLevelIndex={currentLevelIndex}
                progress={parsedProgress}
                onSelectLevel={handleSelectLevel}
                currentButtonRef={currentLevelButtonRef}
                isLevelLocked={(lvl) =>
                  !actTwoOpen && lvl.chapter >= ACT_TWO_FIRST_CHAPTER
                }
                lockedMessage={ACT_TWO_LOCKED_MESSAGE}
                onLockedSelect={(lvl) =>
                  announce(
                    `Level ${lvl.id} is locked. ${ACT_TWO_LOCKED_MESSAGE}`
                  )
                }
              />

              <div
                className="mt-3 min-w-0 border-t border-[color:var(--qp-hairline)] pt-3"
                data-testid="mode-rules"
              >
                <p
                  id="quasi-mode-rules-text"
                  className={`text-xs text-zinc-400 break-words ${
                    modeRulesOpen ? "" : "line-clamp-2"
                  }`}
                >
                  <span
                    className={`font-bold ${
                      gameMode === "story" ? "text-zinc-100" : "text-amber-300"
                    }`}
                  >
                    {modeRules.heading}
                  </span>{" "}
                  {modeRules.budget} {modeRules.failure} {modeRules.exhaustion}{" "}
                  {modeRules.scoring} Changing mode mid-proof restarts the
                  level.
                </p>
                <button
                  type="button"
                  aria-expanded={modeRulesOpen}
                  aria-controls="quasi-mode-rules-text"
                  onClick={() => setModeRulesOpen((prev) => !prev)}
                  className="qp-focus qp-text-accent-strong min-h-[36px] px-1 text-xs font-bold underline underline-offset-2 rounded"
                >
                  {modeRulesOpen ? "Show fewer rules" : "Read all mode rules"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {activeTab === "campaign" && (
        /* 3. Campaign View */
        <>
          {/* Progressive Hints Drawer (if toggled) */}
          {showHints && (
            <div className="mt-3">
              <HintSystem
                hints={currentLevel.hints}
                onClose={() => setShowHints(false)}
              />
            </div>
          )}

          {/* OOM Server Crash Alert */}
          {isOOM && (
            <div className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-center">
              <p className="text-sm font-bold text-rose-300">
                💥 SIMULATED RAM EXHAUSTED
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Available RAM was completely exhausted before discharging the
                goal. Every tactic, sorry included, is locked until you reset
                the level.
              </p>
              <button
                type="button"
                onClick={handleResetLevel}
                className="qp-focus mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
              >
                Reset Simulation &amp; Retry Level
              </button>
            </div>
          )}

          {/* Step-limit variant failure (#2090) */}
          {stepLimitFailed && !isOOM && (
            <div
              data-testid="quasi-step-limit-failed"
              className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-center"
            >
              <p className="text-sm font-bold text-rose-300">
                STEP LIMIT REACHED
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {proofSteps.length} of {activeVariant?.stepLimit} tactics used
                and goals remain. The next tactic would be over the limit, so
                this run has failed. Undo or reset to try again.
              </p>
              <button
                type="button"
                onClick={handleResetLevel}
                className="qp-focus mt-3 min-h-[44px] rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
              >
                Reset and Retry Variant
              </button>
            </div>
          )}

          {/* Multi-Goal Branch Tabs: the split, drawn as a fork */}
          {subgoals.length > 1 && (
            <div className="mt-3">
              <MultiGoalTabs
                subgoals={subgoals}
                activeGoalIndex={activeGoalIndex}
                onSelectGoal={setActiveGoalIndex}
              />
            </div>
          )}

          {/* The proof board */}
          <div
            ref={fxStageRef}
            className={`relative mt-3${inCabinet ? " qp-touch-board" : ""}`}
          >
            {subgoals.map((sg, idx) => {
              const isActive = idx === activeGoalIndex;
              return (
                <div
                  key={sg.id}
                  id={`subgoal-panel-${sg.id}`}
                  role={subgoals.length > 1 ? "tabpanel" : undefined}
                  aria-labelledby={
                    subgoals.length > 1 ? `subgoal-tab-${sg.id}` : undefined
                  }
                  tabIndex={subgoals.length > 1 ? 0 : undefined}
                  hidden={!isActive}
                  className={isActive ? "" : "hidden"}
                >
                  {isActive && (
                    <ExpressionTree
                      goalAST={goalAST}
                      fitHeight={treeFitHeight}
                      hypotheses={activeHypotheses}
                      selectedTargetId={selectedTargetId}
                      hoveredTargetId={hoveredTargetId}
                      onSelectTarget={(nodeId) => {
                        playNote(440, 0.05);
                        if (selectedTacticIndex !== null) {
                          executeTacticOnNode(selectedTacticIndex, nodeId);
                        } else {
                          setSelectedTargetId((prev) =>
                            prev === nodeId ? null : nodeId
                          );
                        }
                      }}
                      onHoverTarget={setHoveredTargetId}
                      isProofComplete={levelSolved || activeSubgoal.isCompleted}
                      isTacticActive={selectedTacticIndex !== null}
                      targetingHint={targetingHint}
                      statusMessage={latestLog}
                    />
                  )}
                </div>
              );
            })}
            <div
              ref={fxFlashRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
            />
          </div>
          {/* Accessible DOM fallback: off-screen until keyboard focus enters it,
              then shown so sighted keyboard users can see the focused control (#1939). */}
          <div
            data-testid="quasi-accessible-controls"
            className="sr-only focus-within:not-sr-only focus-within:mt-3 focus-within:block focus-within:rounded-xl focus-within:border focus-within:border-zinc-800 focus-within:bg-[#13151a] focus-within:p-3 focus-within:text-sm focus-within:text-zinc-200 [&_button]:m-1 [&_button]:min-h-11 [&_button]:rounded-md [&_button]:border [&_button]:border-zinc-700 [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:opacity-50 [&_output]:mr-3 [&_output]:text-zinc-400"
            aria-label="Quasi-Puzzler Accessible Subtree"
          >
            <fieldset>
              <legend>
                Quasi-Puzzler Lean Proof Assistant State and Controls
              </legend>

              <div role="group" aria-label="Proof Assistant Status and Context">
                <output htmlFor="quasi-level">
                  Level: {currentLevel.title}
                </output>
                <output htmlFor="quasi-goal">
                  Active Goal: {activeSubgoal.label}
                </output>
                <output htmlFor="quasi-ram">
                  RAM Memory: {currentRam.toFixed(1)} GB
                </output>
                <output htmlFor="quasi-status">
                  Proof Status:{" "}
                  {levelSolved
                    ? "Solved"
                    : activeSubgoal.isCompleted
                      ? "Subgoal Closed"
                      : "In Progress"}
                </output>
                <output htmlFor="quasi-steps">
                  Steps Applied: {proofSteps.length}
                </output>
              </div>

              <div
                role="group"
                aria-label="Interactive Tactics and Proof Actions"
              >
                {currentLevel.availableTactics.map((tacticItem, idx) => {
                  const id =
                    typeof tacticItem === "string" ? tacticItem : tacticItem.id;
                  const def = tacticDefs[id];
                  // The card's own label carries its argument (use 3 vs use 4,
                  // rw [ih] vs rw [add_succ]), so the buttons stay distinct
                  // (#2200).
                  const label =
                    (typeof tacticItem === "object" &&
                      tacticItem.labelOverride) ||
                    def?.name ||
                    id;
                  const banned = isTacticBanned(activeVariant, id);
                  return (
                    <button
                      key={id + "-" + idx}
                      type="button"
                      disabled={banned}
                      onClick={() => {
                        // These buttons are the screen-reader route, so they
                        // apply the tactic to the whole active goal rather
                        // than only selecting it (#1324).
                        setSelectedTacticIndex(idx);
                        executeTacticOnNode(idx, null);
                        announce(`Applied tactic: ${label}`, "polite");
                      }}
                    >
                      Apply Tactic: {label} to the goal
                      {banned ? " (banned in this variant)" : ""}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    handleUndo();
                    announce("Reverted last tactic step.", "polite");
                  }}
                  disabled={history.length === 0}
                >
                  Undo Tactic Step
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRedo();
                    announce("Restored tactic step.", "polite");
                  }}
                  disabled={redoHistory.length === 0}
                >
                  Redo Tactic Step
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetLevel();
                    announce("Reset current proof level.", "polite");
                  }}
                >
                  Reset Level
                </button>
              </div>
            </fieldset>
          </div>

          {/* Tactic Hand, fanned under the board; docks when cut off */}
          <div
            ref={handSlotRef}
            className="mt-1"
            style={handDock ? { height: handDock.height } : undefined}
          >
            <div
              ref={handRef}
              data-testid="quasi-tactic-hand-dock"
              data-docked={handDock ? "true" : "false"}
              className={
                handDock
                  ? "fixed bottom-0 z-40 rounded-t-xl border border-b-0 border-[color:var(--qp-hairline)] bg-[color:var(--qp-stage)] px-3 pt-1 pb-4 shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.9)]"
                  : undefined
              }
              style={
                handDock
                  ? { left: handDock.left, width: handDock.width }
                  : undefined
              }
            >
              <TacticHand
                availableTactics={currentLevel.availableTactics}
                bannedTacticId={activeVariant?.bannedTactic}
                currentRam={currentRam}
                selectedTacticIndex={selectedTacticIndex}
                onSelectTactic={(idx) => {
                  playNote(523.25, 0.05);
                  if (selectedTargetId !== null) {
                    executeTacticOnNode(idx, selectedTargetId);
                  } else {
                    setSelectedTacticIndex((prev) =>
                      prev === idx ? null : idx
                    );
                  }
                }}
                onCardDragStart={(idx) => {
                  setSelectedTacticIndex(idx);
                  playNote(523.25, 0.03);
                }}
                onCardDragEnd={handleCardDragEnd}
                isProofComplete={levelSolved || stepLimitFailed}
              />
            </div>
          </div>

          {/* Accordion Drawers for Secondary IDE Panels & Diagnostic Terminal Log */}
          <div className={`mt-4${inCabinet ? " qp-touch-drawers" : ""}`}>
            <DiagnosticDrawers
              key={currentLevelIndex}
              level={currentLevel}
              proofSteps={proofSteps}
              isComplete={levelSolved}
              logs={logs}
              isLeanInspectorOpen={showLeanInspector}
              onToggleLeanInspector={() =>
                setShowLeanInspector((prev) => !prev)
              }
              currentLevelIndex={currentLevelIndex}
            />
          </div>

          {/* Theory Briefing Modal */}
          <TheoryBriefingModal
            level={currentLevel}
            gameMode={gameMode}
            isOpen={showBriefingModal}
            onClose={() => setShowBriefingModal(false)}
            onToggleMode={handleToggleMode}
          />

          {/* Victory Modal */}
          {levelSolved &&
            currentScore &&
            dismissedScoreAt === currentScore.timestamp && (
              <div className="mt-2 flex justify-center">
                <button
                  ref={showResultRef}
                  type="button"
                  onClick={() => setDismissedScoreAt(null)}
                  className="qp-btn-primary qp-focus min-h-11 rounded-xl px-4 py-2 text-xs font-bold"
                >
                  Show result
                </button>
              </div>
            )}
          {levelSolved &&
            currentScore &&
            dismissedScoreAt !== currentScore.timestamp && (
              <VictoryModal
                score={currentScore}
                savedBest={parsedProgress.completedLevels?.[currentLevel.id]}
                level={currentLevel}
                totalLevels={playableLevels.length}
                currentLevelIndex={currentLevelIndex}
                leanCode={generatedLeanScript}
                ramUsed={runStartingRam - currentScore.remainingRam}
                par={currentLevelPar}
                variant={activeVariant}
                variantCleared={
                  !!activeVariant &&
                  isVariantRunCleared(
                    activeVariant,
                    currentScore.steps ?? 0,
                    currentScore.usedSorry
                  )
                }
                campaignStars={campaignStars}
                onRestartCampaign={() => loadLevel(0)}
                onOpenLevelMap={() => {
                  dismissResult(currentScore.timestamp);
                  if (!levelIndexOpen) toggleLevelDrawer();
                }}
                onDismiss={() => dismissResult(currentScore.timestamp)}
                actTwoUnlocked={
                  currentLevel.id === ACT_ONE_CAPSTONE_LEVEL_ID &&
                  !currentScore.usedSorry &&
                  !activeVariant &&
                  actTwoOpen
                }
                onNextLevel={() => {
                  if (currentLevelIndex < playableLevels.length - 1) {
                    loadLevel(currentLevelIndex + 1);
                  }
                }}
                onRestartLevel={handleResetLevel}
              />
            )}
        </>
      )}
    </section>
  );
};
