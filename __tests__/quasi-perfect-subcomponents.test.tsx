// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GridCanvas,
  ProofTree,
  ProofTreeNode,
  GridTile,
  TacticCard,
  TacticHand,
  RAMGauge,
  TerminalLog,
  VictoryModal,
  MultiGoalTabs,
  HintSystem,
  ExpressionTree,
} from "@/components/QuasiPerfectPuzzler";
import {
  ASTNode,
  LevelScore,
  PuzzlerLevelDef,
} from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";

// Mock Audio & Announcer hooks to avoid audio errors during vitest run
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
}));

describe("Quasi-Perfect Puzzler Subcomponents Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /* ---------------------------------------------------------------- border */
  /* 1. GridCanvas Tests                                                      */
  /* ---------------------------------------------------------------- border */
  describe("GridCanvas", () => {
    it("mounts GridCanvas and verifies grid tile click events", () => {
      const handleTileClick = vi.fn();
      const customTiles: GridTile[] = [
        {
          id: "tile-1",
          row: 0,
          col: 0,
          label: "P → Q",
          value: "Hypothesis",
          type: "hypothesis",
        },
        {
          id: "tile-2",
          row: 0,
          col: 1,
          label: "P",
          value: "Premise",
          type: "variable",
        },
        {
          id: "tile-3",
          row: 1,
          col: 0,
          label: "Q",
          value: "Goal",
          type: "goal",
        },
      ];

      render(
        <GridCanvas
          tiles={customTiles}
          rows={2}
          cols={2}
          onTileClick={handleTileClick}
        />
      );

      // Verify custom tiles rendered
      expect(screen.getByText("P → Q")).toBeDefined();
      expect(screen.getByText("P")).toBeDefined();
      expect(screen.getByText("Q")).toBeDefined();

      // Click on tile-1
      const tile1Btn = screen.getByLabelText(/Tile P → Q/i);
      fireEvent.click(tile1Btn);

      expect(handleTileClick).toHaveBeenCalledTimes(1);
      expect(handleTileClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tile-1",
          label: "P → Q",
          type: "hypothesis",
        })
      );
    });

    it("generates default grid tiles when tiles array is omitted", () => {
      const handleTileClick = vi.fn();
      render(<GridCanvas rows={3} cols={3} onTileClick={handleTileClick} />);

      const tiles = screen.getAllByTestId("grid-tile");
      expect(tiles).toHaveLength(9);

      // Click second tile (0, 1)
      fireEvent.click(tiles[1]);
      expect(handleTileClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tile-0-1",
          row: 0,
          col: 1,
        })
      );
    });

    it("does not fire onTileClick when tile is disabled", () => {
      const handleTileClick = vi.fn();
      const disabledTiles: GridTile[] = [
        { id: "t-disabled", row: 0, col: 0, label: "Locked", isDisabled: true },
      ];

      render(
        <GridCanvas tiles={disabledTiles} onTileClick={handleTileClick} />
      );

      const tileBtn = screen.getByRole("button", {
        name: /Locked/i,
      }) as HTMLButtonElement;
      expect(tileBtn.disabled).toBe(true);

      fireEvent.click(tileBtn);
      expect(handleTileClick).not.toHaveBeenCalled();
    });

    it("supports controlled selectedTileId prop", () => {
      const customTiles: GridTile[] = [
        { id: "t-1", row: 0, col: 0, label: "Tile 1" },
        { id: "t-2", row: 0, col: 1, label: "Tile 2" },
      ];

      const { rerender } = render(
        <GridCanvas tiles={customTiles} selectedTileId="t-1" />
      );

      const tiles = screen.getAllByTestId("grid-tile");
      expect(tiles[0].getAttribute("data-selected")).toBe("true");

      rerender(<GridCanvas tiles={customTiles} selectedTileId="t-2" />);
      const reRenderedTiles = screen.getAllByTestId("grid-tile");
      expect(reRenderedTiles[1].getAttribute("data-selected")).toBe("true");
    });
  });

  /* ---------------------------------------------------------------- border */
  /* 2. ProofTree Tests                                                       */
  /* ---------------------------------------------------------------- border */
  describe("ProofTree", () => {
    const sampleTree: ProofTreeNode = {
      id: "root",
      label: "Goal: P ∧ Q",
      rule: "And.intro",
      status: "open",
      isExpanded: true,
      children: [
        {
          id: "sub-1",
          label: "Subgoal 1: P",
          rule: "rfl",
          status: "closed",
        },
        {
          id: "sub-2",
          label: "Subgoal 2: Q",
          rule: "exact hQ",
          status: "open",
          isExpanded: true,
          children: [
            {
              id: "sub-2-1",
              label: "Premise hQ: Q",
              status: "proved",
            },
          ],
        },
      ],
    };

    it("mounts ProofTree and verifies node expanded states", () => {
      const handleToggleExpand = vi.fn();
      const handleSelectNode = vi.fn();

      render(
        <ProofTree
          rootNode={sampleTree}
          onToggleExpand={handleToggleExpand}
          onSelectNode={handleSelectNode}
        />
      );

      // Verify root and visible children nodes
      expect(screen.getByText("Goal: P ∧ Q")).toBeDefined();
      expect(screen.getByText("Subgoal 1: P")).toBeDefined();
      expect(screen.getByText("Subgoal 2: Q")).toBeDefined();
      expect(screen.getByText("Premise hQ: Q")).toBeDefined();

      // Find expand toggle button on root node
      const rootNodeEl = screen
        .getByText("Goal: P ∧ Q")
        .closest("[data-node-id]");
      expect(rootNodeEl?.getAttribute("data-expanded")).toBe("true");

      const toggleBtn = screen.getByLabelText(
        "Toggle expand for node Goal: P ∧ Q"
      );
      expect(toggleBtn).toBeDefined();

      // Click expand toggle to collapse root
      fireEvent.click(toggleBtn);

      expect(handleToggleExpand).toHaveBeenCalledWith("root", false);
      expect(rootNodeEl?.getAttribute("data-expanded")).toBe("false");

      // Verify children subtrees are collapsed/hidden
      expect(screen.queryByText("Subgoal 1: P")).toBeNull();
    });

    it("uses nested list semantics and keeps expand controls outside selection buttons", () => {
      render(<ProofTree rootNode={sampleTree} />);

      expect(screen.queryByRole("tree")).toBeNull();
      expect(
        screen.getByRole("region", { name: "Quasi-Perfect Proof Tree" })
      ).toBeDefined();
      expect(screen.getAllByRole("listitem")).toHaveLength(4);

      const selectButton = screen.getByRole("button", {
        name: "Select proof tree node Goal: P ∧ Q by And.intro, status open",
      });
      expect(
        screen.getByRole("button", {
          name: "Select proof tree node Subgoal 1: P by rfl, status Q.E.D.",
        })
      ).toBeDefined();
      const expandButton = screen.getByRole("button", {
        name: "Toggle expand for node Goal: P ∧ Q",
      });
      expect(selectButton.querySelector("button")).toBeNull();
      expect(expandButton.parentElement).toBe(selectButton.parentElement);
      expect(expandButton.getAttribute("aria-expanded")).toBe("true");
    });

    it("triggers onSelectNode when the native selection button is clicked", () => {
      const handleSelectNode = vi.fn();

      render(
        <ProofTree rootNode={sampleTree} onSelectNode={handleSelectNode} />
      );

      const nodeEl = screen.getByRole("button", {
        name: "Select proof tree node Subgoal 1: P by rfl, status Q.E.D.",
      });
      fireEvent.click(nodeEl);
      expect(handleSelectNode).toHaveBeenLastCalledWith("sub-1");
    });

    it("respects controlled expandedNodeIds prop and requests toggle state correctly", () => {
      const handleToggleExpand = vi.fn();
      render(
        <ProofTree
          rootNode={sampleTree}
          expandedNodeIds={["root"]}
          onToggleExpand={handleToggleExpand}
        />
      );

      // root is in expandedNodeIds -> children sub-1 & sub-2 visible
      expect(screen.getByText("Subgoal 1: P")).toBeDefined();
      expect(screen.getByText("Subgoal 2: Q")).toBeDefined();

      // sub-2 is NOT in expandedNodeIds -> sub-2-1 should be hidden
      expect(screen.queryByText("Premise hQ: Q")).toBeNull();

      // Click toggle on sub-2 (collapsed in controlled mode) -> should report true (request expand)
      const sub2ToggleBtn = screen.getByLabelText(
        "Toggle expand for node Subgoal 2: Q"
      );
      fireEvent.click(sub2ToggleBtn);
      expect(handleToggleExpand).toHaveBeenLastCalledWith("sub-2", true);

      // Click toggle on root (expanded in controlled mode) -> should report false (request collapse)
      const rootToggleBtn = screen.getByLabelText(
        "Toggle expand for node Goal: P ∧ Q"
      );
      fireEvent.click(rootToggleBtn);
      expect(handleToggleExpand).toHaveBeenLastCalledWith("root", false);
    });
  });

  /* ---------------------------------------------------------------- border */
  /* 3. Subcomponents Component Testing                                       */
  /* ---------------------------------------------------------------- border */
  describe("Quasi-Perfect Puzzler Subcomponents", () => {
    it("renders TacticCard and handles click", () => {
      const handleClick = vi.fn();
      const tactic = tacticDefs.rfl;

      render(
        <TacticCard
          tactic={tactic}
          isSelected={false}
          disabled={false}
          onSelect={handleClick}
        />
      );

      expect(screen.getByText("rfl")).toBeDefined();
      expect(screen.getByText(tactic.description)).toBeDefined();

      const card = screen.getByRole("button", { name: /Tactic rfl/i });
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders TacticHand with multiple tactic cards", () => {
      const handleSelectTactic = vi.fn();
      const handleDragStart = vi.fn();
      const handleDragEnd = vi.fn();

      render(
        <TacticHand
          availableTactics={["rfl", "intro"]}
          selectedTacticIndex={null}
          currentRam={16}
          onSelectTactic={handleSelectTactic}
          onCardDragStart={handleDragStart}
          onCardDragEnd={handleDragEnd}
        />
      );

      expect(screen.getByText("rfl")).toBeDefined();
      expect(screen.getByText("intro")).toBeDefined();
    });

    it("renders RAMGauge and reflects memory consumption status", () => {
      render(<RAMGauge currentRam={12} initialRam={16} />);

      expect(screen.getByText("12.0")).toBeDefined();
      expect(screen.getByText("/ 16 GB")).toBeDefined();
      expect(screen.getByText("Simulated Memory:")).toBeDefined();
      expect(screen.getByText("SIMULATED RAM NOMINAL")).toBeDefined();
    });

    it("renders TerminalLog and displays compiler outputs", () => {
      const logs = [
        {
          id: "1",
          timestamp: "12:00:00",
          text: "Compiling Lean 4 theorem...",
          type: "info" as const,
        },
        {
          id: "2",
          timestamp: "12:00:01",
          text: "Goal closed successfully Q.E.D.",
          type: "success" as const,
        },
      ];

      render(<TerminalLog logs={logs} />);

      expect(screen.getByText(/Compiling Lean 4 theorem/i)).toBeDefined();
      expect(
        screen.getByText(/Goal closed successfully Q.E.D./i)
      ).toBeDefined();
    });

    it("renders VictoryModal upon proof completion", () => {
      const handleNext = vi.fn();
      const handleRetry = vi.fn();
      const mockScore: LevelScore = {
        levelId: "lvl-1",
        completed: true,
        stars: 3,
        remainingRam: 15.8,
        morality: 100,
        usedSorry: false,
        timestamp: 12345,
      };
      const mockLevel: PuzzlerLevelDef = {
        id: "lvl-1",
        chapter: 1,
        chapterTitle: "Equational Reasoning",
        title: "The Identity Crisis",
        subtitle: "Reflexivity",
        description: "Prove a = a",
        initialRam: 16,
        goldRamTarget: 15,
        silverRamTarget: 10,
        goal: {
          id: "g1",
          type: "Equality",
          value: "=",
          children: [
            { id: "a1", type: "Variable", value: "a" },
            { id: "a2", type: "Variable", value: "a" },
          ],
        },
        hypotheses: [],
        availableTactics: ["rfl"],
        hints: [
          "Every object is equal to itself.",
          "Apply rfl tactic.",
          "Target root equality.",
        ],
        leanTheoremName: "identity_crisis",
        leanTypeSignature: "a = a",
        educationalConcept: {
          title: "Reflexivity",
          summary: "Reflexivity axiom",
          realWorldApplication: "Equality",
        },
      };

      render(
        <VictoryModal
          score={mockScore}
          level={mockLevel}
          totalLevels={18}
          currentLevelIndex={0}
          leanCode="theorem identity_crisis : a = a := by rfl"
          onNextLevel={handleNext}
          onRestartLevel={handleRetry}
        />
      );

      expect(
        screen.getByText(/AST GOAL DISCHARGED · SIMULATED/i)
      ).toBeDefined();
      expect(screen.getByText(/The Identity Crisis/i)).toBeDefined();
      expect(screen.getAllByText(/by rfl/i).length).toBeGreaterThan(0);
    });

    it("renders MultiGoalTabs and handles subgoal switching", () => {
      const handleSelectGoal = vi.fn();
      const subgoals = [
        {
          id: "g1",
          label: "Case 1: P",
          goal: { id: "p1", type: "Variable" as const, value: "P" },
          hypotheses: [],
          isCompleted: false,
        },
        {
          id: "g2",
          label: "Case 2: Q",
          goal: { id: "q1", type: "Variable" as const, value: "Q" },
          hypotheses: [],
          isCompleted: true,
        },
      ];

      render(
        <MultiGoalTabs
          subgoals={subgoals}
          activeGoalIndex={0}
          onSelectGoal={handleSelectGoal}
        />
      );

      expect(screen.getByText(/Case 1: P/i)).toBeDefined();
      expect(screen.getByText(/Case 2: Q/i)).toBeDefined();

      const tab2 = screen.getByText(/Case 2: Q/i).closest("button");
      expect(tab2).not.toBeNull();
      if (tab2) {
        fireEvent.click(tab2);
        expect(handleSelectGoal).toHaveBeenCalledWith(1);
      }
    });

    it("renders HintSystem and handles hint reveals", () => {
      const hints: [string, string, string] = [
        "Every object is equal to itself.",
        "Apply rfl tactic to solve.",
        "Target the equality node.",
      ];

      render(<HintSystem hints={hints} />);

      expect(screen.getByText(/Interactive Proof Coach/i)).toBeDefined();
      expect(
        screen.getByText(/Every object is equal to itself./i)
      ).toBeDefined();
    });

    it("renders ASTNodeView and ExpressionTree with node interaction", () => {
      const handleSelectTarget = vi.fn();
      const handleHoverTarget = vi.fn();

      const goalAST: ASTNode = {
        id: "ast-root",
        type: "Equality",
        value: "=",
        children: [
          { id: "lhs", type: "Variable", value: "a" },
          { id: "rhs", type: "Variable", value: "a" },
        ],
      };

      render(
        <ExpressionTree
          goalAST={goalAST}
          hypotheses={[]}
          selectedTargetId={null}
          hoveredTargetId={null}
          onSelectTarget={handleSelectTarget}
          onHoverTarget={handleHoverTarget}
        />
      );

      expect(screen.getAllByText(/a = a/i).length).toBeGreaterThan(0);

      const aSpans = screen.getAllByText("a");
      expect(aSpans.length).toBeGreaterThan(0);
      fireEvent.click(aSpans[0]);

      expect(handleSelectTarget).toHaveBeenCalled();
    });
  });
});
