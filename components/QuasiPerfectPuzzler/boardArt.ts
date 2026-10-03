/**
 * Pure presentation helpers for the Quasi-Perfect Puzzler board (#1519).
 *
 * Everything here maps game state to geometry or labels and has no React or
 * DOM dependency, so it is unit-tested directly. None of it changes a rule:
 * the engine in lib/quasi-perfect still decides what a tactic does.
 */
import { clamp } from "@/lib/game-utils";
import type { ASTNode, LevelScore, TacticId } from "@/lib/quasi-perfect/types";

/** Display glyphs for operators that the engine stores in ASCII. */
const MATH_GLYPHS: Record<string, string> = {
  "*": "×",
  "-": "−",
  "<=": "≤",
  ">=": "≥",
  "!=": "≠",
  "^": "xⁿ",
};

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Glyph shown inside a node, by node type, before falling back to its value. */
const TYPE_GLYPHS: Partial<Record<ASTNode["type"], string>> = {
  Implication: "→",
  Conjunction: "∧",
  Disjunction: "∨",
  Negation: "¬",
};

/**
 * Typesets a plain-text formula for display: `a * b` reads `a × b` and
 * `a - b` reads `a − b`. Accessible names keep the engine's own text.
 *
 * @param text - A formula from `renderASTString`.
 * @returns The same formula with typographic operators.
 */
export function prettyMath(text: string): string {
  return text
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/!=/g, "≠")
    .replace(/ \* /g, " × ")
    .replace(/ \^ (\d+)/g, (_, digits: string) =>
      [...digits].map((d) => SUPERSCRIPT_DIGITS[Number(d)]).join("")
    )
    .replace(/(\w|\)) - /g, "$1 − ");
}

/**
 * The symbol a proof-board node shows: connectives as logic glyphs, ASCII
 * operators as typographic ones, booleans as ⊤ and ⊥.
 *
 * @param node - The AST node.
 * @returns The glyph to draw.
 */
export function nodeGlyph(node: ASTNode): string {
  if (node.type === "Boolean") {
    return node.value === true || node.value === "true" ? "⊤" : "⊥";
  }
  const typed = TYPE_GLYPHS[node.type];
  if (typed) return typed;
  const raw = String(node.value);
  return MATH_GLYPHS[raw] ?? raw;
}

/** True for nodes drawn as math variables (italic serif). */
export function isMathVariable(node: ASTNode): boolean {
  return node.type === "Variable";
}

/** Geometry options for {@link layoutProofTree}. */
interface ProofLayoutOptions {
  /** Horizontal space given to each leaf, in CSS pixels. */
  slotWidth: number;
  /** Vertical distance between a parent's centre and its children's. */
  levelGap: number;
  /** Height of an ordinary node. */
  nodeHeight: number;
  /** Height of the root goal node, drawn larger. */
  rootHeight: number;
  /** Space around the tree. */
  padding: number;
}

/** One positioned node; `x` and `y` are its centre. */
export interface ProofLayoutNode {
  id: string;
  node: ASTNode;
  parentId: string | null;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
}

/** One edge, from the bottom of a parent to the top of a child. */
interface ProofLayoutEdge {
  id: string;
  fromId: string;
  toId: string;
  /** SVG path data for a smooth vertical S-curve. */
  d: string;
}

/** Result of {@link layoutProofTree}. */
export interface ProofLayout {
  nodes: ProofLayoutNode[];
  edges: ProofLayoutEdge[];
  width: number;
  height: number;
  leafCount: number;
}

/** Default geometry for the campaign board. */
export const DEFAULT_PROOF_LAYOUT: ProofLayoutOptions = {
  slotWidth: 96,
  levelGap: 84,
  nodeHeight: 48,
  rootHeight: 58,
  padding: 16,
};

/**
 * Width of a node box for a glyph of the given length. Single symbols get a
 * near-square box, longer labels such as `σ` with arguments grow.
 *
 * @param glyph - The glyph drawn in the node.
 * @param isRoot - Whether this is the goal node, drawn larger.
 * @returns The box width in CSS pixels.
 */
export function nodeBoxWidth(glyph: string, isRoot: boolean): number {
  const base = isRoot ? 66 : 50;
  return clamp(base + Math.max(0, glyph.length - 1) * 12, base, 160);
}

/** Number of leaves under a node; a leaf counts as one. */
export function countLeaves(node: ASTNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Lays an AST out top-down: each leaf takes one slot, each parent sits
 * centred over its children, and depth sets the row. The result is in
 * CSS pixels so an SVG edge layer and HTML node buttons can share it.
 *
 * @param root - The goal AST.
 * @param options - Slot width, row gap, node heights and padding.
 * @returns Positioned nodes, edge paths and the overall size.
 */
export function layoutProofTree(
  root: ASTNode,
  options: ProofLayoutOptions = DEFAULT_PROOF_LAYOUT
): ProofLayout {
  const { slotWidth, levelGap, nodeHeight, rootHeight, padding } = options;
  const nodes: ProofLayoutNode[] = [];
  const edges: ProofLayoutEdge[] = [];
  let nextLeaf = 0;
  let maxDepth = 0;
  // Guards against a malformed (cyclic) tree: each node is placed once.
  const seen = new Set<ASTNode>();

  const rowY = (depth: number) => padding + rootHeight / 2 + depth * levelGap;

  const place = (
    node: ASTNode,
    depth: number,
    parentId: string | null
  ): ProofLayoutNode => {
    seen.add(node);
    maxDepth = Math.max(maxDepth, depth);
    const isRoot = parentId === null;
    const children = (node.children ?? []).filter((c) => !seen.has(c));
    const placedChildren = children.map((child) =>
      place(child, depth + 1, node.id)
    );
    let x: number;
    if (placedChildren.length === 0) {
      x = padding + nextLeaf * slotWidth + slotWidth / 2;
      nextLeaf += 1;
    } else {
      const first = placedChildren[0];
      const last = placedChildren[placedChildren.length - 1];
      x = (first.x + last.x) / 2;
    }
    const placed: ProofLayoutNode = {
      id: node.id,
      node,
      parentId,
      depth,
      x,
      y: rowY(depth),
      width: nodeBoxWidth(nodeGlyph(node), isRoot),
      height: isRoot ? rootHeight : nodeHeight,
      isRoot,
    };
    nodes.push(placed);
    for (const child of placedChildren) {
      const y1 = placed.y + placed.height / 2;
      const y2 = child.y - child.height / 2;
      const mid = (y1 + y2) / 2;
      edges.push({
        id: `${placed.id}->${child.id}`,
        fromId: placed.id,
        toId: child.id,
        d: `M ${placed.x} ${y1} C ${placed.x} ${mid}, ${child.x} ${mid}, ${child.x} ${y2}`,
      });
    }
    return placed;
  };

  place(root, 0, null);
  const leafCount = Math.max(1, nextLeaf);
  return {
    // Parents before children, so document order follows the tree top-down.
    nodes: nodes.sort((a, b) => a.depth - b.depth || a.x - b.x),
    edges,
    width: padding * 2 + leafCount * slotWidth,
    height: rowY(maxDepth) + nodeHeight / 2 + padding,
    leafCount,
  };
}

/**
 * Slot width that fits a tree with `leafCount` leaves into `available`
 * pixels, kept between a readable minimum and a tidy maximum. A tree wider
 * than the board at the minimum scrolls horizontally instead of shrinking.
 *
 * @param available - Board width in CSS pixels.
 * @param leafCount - Leaves in the tree.
 * @param padding - Space kept at each side.
 * @returns Slot width in CSS pixels.
 */
export function fitSlotWidth(
  available: number,
  leafCount: number,
  padding: number = DEFAULT_PROOF_LAYOUT.padding
): number {
  if (!Number.isFinite(available) || available <= 0) {
    return DEFAULT_PROOF_LAYOUT.slotWidth;
  }
  const raw = (available - padding * 2) / Math.max(1, leafCount);
  return clamp(Math.floor(raw), 64, 168);
}

/** Card rarity, read from a tactic's RAM cost. */
type TacticRarity = "common" | "uncommon" | "rare" | "cursed";

/** How a tactic card is drawn. */
interface TacticCardArt {
  /** Large symbol in the middle of the card. */
  glyph: string;
  rarity: TacticRarity;
  /** Filled cost pips, 0 to 3, one per rarity step. */
  pips: number;
}

const TACTIC_GLYPHS: Record<TacticId, string> = {
  rfl: "≡",
  rw: "⇄",
  simp: "⇊",
  decide: "⊨",
  omega: "ω",
  linarith: "≤",
  intro: "λ",
  apply: "⊢",
  exact: "∎",
  cases: "⋔",
  ring: "⊕",
  norm_num: "#",
  symm: "⇆",
  split: "⋀",
  left: "◁",
  right: "▷",
  sorry: "?",
};

/**
 * The glyph, rarity edge and cost pips for a tactic card. Rarity follows the
 * RAM cost (1 GB common, 2–3 GB uncommon, 4 GB and up rare) and `sorry` is
 * always cursed, so the card reads its price before the player plays it.
 *
 * @param tacticId - The tactic.
 * @param ramCost - Its base RAM cost in GB.
 * @returns How to draw the card.
 */
export function tacticCardArt(
  tacticId: TacticId,
  ramCost: number
): TacticCardArt {
  const glyph = TACTIC_GLYPHS[tacticId] ?? "·";
  if (tacticId === "sorry") return { glyph, rarity: "cursed", pips: 0 };
  if (ramCost >= 4) return { glyph, rarity: "rare", pips: 3 };
  if (ramCost >= 2) return { glyph, rarity: "uncommon", pips: 2 };
  return { glyph, rarity: "common", pips: 1 };
}

/** Static pose of one card in a fanned hand. */
interface FanPose {
  /** Rotation in degrees, negative to the left. */
  rotate: number;
  /** Downward offset in pixels, so the fan curves. */
  translateY: number;
}

/**
 * Pose of card `index` in a fan of `count` cards, like the Trial & Error
 * hand: the middle card is upright and the outer cards tilt and drop. The
 * tilt narrows as the hand grows so a wide hand stays readable.
 *
 * @param index - The card's position, from 0.
 * @param count - Cards in the hand.
 * @returns Rotation and drop for that card.
 */
export function fanPose(index: number, count: number): FanPose {
  if (count <= 1) return { rotate: 0, translateY: 0 };
  const mid = (count - 1) / 2;
  const offset = index - mid;
  const step = clamp(16 / count, 2, 5);
  const rotate = Math.round(offset * step * 10) / 10;
  const translateY = Math.round(Math.abs(offset) ** 2 * (step / 1.6) * 10) / 10;
  return { rotate: rotate === 0 ? 0 : rotate, translateY };
}

/**
 * Fill of each chip on the memory-stick RAM meter, 0 to 1, left to right.
 *
 * @param currentRam - RAM left.
 * @param initialRam - The level's starting budget.
 * @param chips - Number of chips on the stick.
 * @returns One fill fraction per chip.
 */
export function ramChipFill(
  currentRam: number,
  initialRam: number,
  chips: number
): number[] {
  const count = Math.max(1, Math.floor(chips));
  const ratio =
    initialRam > 0 && Number.isFinite(currentRam)
      ? clamp(currentRam / initialRam, 0, 1)
      : 0;
  const lit = ratio * count;
  return Array.from({ length: count }, (_, i) => clamp(lit - i, 0, 1));
}

/** One node of the chapter level map. */
interface LevelMapNode {
  /** Index into the level list. */
  index: number;
  /** Chapter row, from 0. */
  row: number;
  /** Horizontal centre as a fraction of the map width, 0 to 1. */
  x: number;
  /** Vertical centre in CSS pixels. */
  y: number;
}

/** Result of {@link layoutLevelMap}. */
interface LevelMapLayout {
  nodes: LevelMapNode[];
  /** SVG path through every node, in a 1000-unit-wide viewBox. */
  path: string;
  height: number;
  /** Vertical centre of each chapter row, for its label. */
  rowY: number[];
}

/**
 * Lays chapters out as one serpentine trail: chapter 1 runs left to right,
 * chapter 2 back right to left, chapter 3 left to right again, with a bend
 * joining each row to the next. Nodes bob up and down along a row so the
 * trail reads as a path rather than a strip.
 *
 * @param chapterSizes - Levels in each chapter, in order.
 * @param rowGap - Distance between chapter rows in CSS pixels.
 * @returns Node positions, the path through them and the map height.
 */
export function layoutLevelMap(
  chapterSizes: number[],
  rowGap = 96
): LevelMapLayout {
  const nodes: LevelMapNode[] = [];
  const rowY: number[] = [];
  const marginX = 0.07;
  const bob = 12;
  const top = 36;
  let index = 0;
  chapterSizes.forEach((size, row) => {
    const baseY = top + row * rowGap;
    rowY.push(baseY);
    const reverse = row % 2 === 1;
    for (let i = 0; i < size; i++) {
      const t = size === 1 ? 0.5 : i / (size - 1);
      const along = marginX + t * (1 - marginX * 2);
      nodes.push({
        index,
        row,
        x: reverse ? 1 - along : along,
        y: baseY + (i % 2 === 0 ? -bob / 2 : bob / 2),
      });
      index += 1;
    }
  });

  const W = 1000;
  let path = "";
  nodes.forEach((node, i) => {
    const px = Math.round(node.x * W);
    if (i === 0) {
      path = `M ${px} ${node.y}`;
      return;
    }
    const prev = nodes[i - 1];
    const ppx = Math.round(prev.x * W);
    if (prev.row !== node.row) {
      // A bend at the end of a row, bulging outward past the last node.
      const bulge = prev.x > 0.5 ? W - 8 : 8;
      path += ` C ${bulge} ${prev.y}, ${bulge} ${node.y}, ${px} ${node.y}`;
    } else {
      const mx = Math.round((ppx + px) / 2);
      path += ` C ${mx} ${prev.y}, ${mx} ${node.y}, ${px} ${node.y}`;
    }
  });

  const height = top + (chapterSizes.length - 1) * rowGap + top;
  return { nodes, path, height, rowY };
}

/** How a level node reads on the map. */
interface LevelMapBadge {
  /** 0 to 3 earned stars; 0 for an unplayed or admitted level. */
  stars: number;
  state: "unplayed" | "solved" | "admitted";
  /** Plain description for assistive technology. */
  description: string;
}

/**
 * Map badge for a level from its saved best score.
 *
 * @param score - The saved best, if any.
 * @returns Stars, state and a description.
 */
export function levelMapBadge(score: LevelScore | undefined): LevelMapBadge {
  if (!score?.completed) {
    return { stars: 0, state: "unplayed", description: "Not solved yet" };
  }
  if (score.usedSorry) {
    return {
      stars: 0,
      state: "admitted",
      description: "Admitted with sorry, no stars",
    };
  }
  const stars = clamp(Math.round(score.stars), 0, 3);
  return {
    stars,
    state: "solved",
    description: `Solved, ${stars} of 3 stars`,
  };
}
