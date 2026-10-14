export type NodeType =
  | "Equality"
  | "Inequality"
  | "Implication"
  | "Conjunction"
  | "Disjunction"
  | "Negation"
  | "Operator"
  | "Variable"
  | "Constant"
  | "Boolean"
  | "Function";

export interface ASTNode {
  id: string;
  type: NodeType;
  value: string | number | boolean;
  children?: ASTNode[];
  metadata?: Record<string, unknown>;
}

export type TacticId =
  | "rfl"
  | "rw"
  | "simp"
  | "decide"
  | "omega"
  | "linarith"
  | "intro"
  | "apply"
  | "exact"
  | "cases"
  | "ring"
  | "norm_num"
  | "symm"
  | "split"
  | "left"
  | "right"
  | "sorry";

export type GameMode = "story" | "hacker";

export interface SubGoal {
  id: string;
  label: string;
  goal: ASTNode;
  hypotheses: ASTNode[];
  isCompleted: boolean;
}

export interface TacticResult {
  success: boolean;
  newAST?: ASTNode;
  newHypotheses?: ASTNode[];
  newSubGoals?: SubGoal[];
  ramConsumed: number;
  message: string;
  isProofComplete?: boolean;
  leanProofStep?: string;
}

export type TacticFunction = (
  targetNode: ASTNode,
  globalAST: ASTNode,
  hypotheses: ASTNode[],
  arg?: string
) => TacticResult;

export interface TacticDef {
  id: TacticId;
  name: string;
  label: string;
  description: string;
  baseRamCost: number;
  failureCost: number;
  hypothesisTarget?: string;
  execute: TacticFunction;
}

export interface EducationalConcept {
  title: string;
  summary: string;
  mathNotation?: string;
  mathIntuition?: string;
  leanAnalogy?: string;
  tacticalObjective?: string;
  leanDocUrl?: string;
  realWorldApplication: string;
}

export interface PuzzlerLevelDef {
  id: number | string;
  chapter: number;
  chapterTitle: string;
  title: string;
  subtitle: string;
  description: string;
  initialRam: number;
  goldRamTarget: number;
  silverRamTarget: number;
  hypotheses: ASTNode[];
  goal: ASTNode;
  availableTactics: (
    TacticId | { id: TacticId; hypothesis?: string; labelOverride?: string }
  )[];
  hints: [string, string, string]; // [Tier 1 Concept, Tier 2 Target Node, Tier 3 Tactic Suggestion]
  leanTheoremName: string;
  leanTypeSignature: string;
  educationalConcept: EducationalConcept;
}

export interface CompilerLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  text: string;
}

export interface LeanProofStep {
  id: string;
  tacticId: TacticId;
  leanLine: string;
  cost?: number;
  explanation: string;
  goalBefore: string;
  goalAfter: string;
  subgoalLabel?: string;
}

export interface LevelScore {
  levelId: string | number;
  completed: boolean;
  usedSorry: boolean;
  remainingRam: number;
  stars: number; // 0 (sorry), 1 (bronze), 2 (silver), 3 (gold)
  morality: number; // 100 for true proof, -100 for sorry
  timestamp: number;
  /**
   * True once the level has been proved honestly in no more tactics than its
   * par (#2059). Missing in progress saved before the badge existed, which
   * reads as not golfed.
   */
  golfed?: boolean;
  /** Tactics the run applied; missing in older saves. */
  steps?: number;
}

/**
 * A constrained replay of a level (#2090): one tactic banned, the starting
 * RAM cut to the cheapest proof's cost, or the proof capped at the step par.
 */
export type PuzzlerVariantKind = "banned" | "tight-ram" | "step-limit";

export interface GameProgressState {
  completedLevels: Record<string | number, LevelScore>;
  currentLevelIndex: number;
  unlockedChapter?: number;
  /**
   * Variants cleared per level id (#2090). Missing in progress saved before
   * variants existed, which reads as none cleared. Kept apart from
   * `completedLevels`, so a variant never changes a level's stars.
   */
  clearedVariants?: Record<string | number, PuzzlerVariantKind[]>;
}
