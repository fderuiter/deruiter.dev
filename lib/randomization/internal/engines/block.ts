/**
 * Permuted-block schedule generation and actual-profile allocation
 * (ticket #4000, RND-BLOCK-001 to RND-BLOCK-012).
 *
 * Both paths share one rule resolver, one block-size selector and one
 * Fisher-Yates shuffle, so an interleaved profile session uses exactly the
 * primitives a standard schedule uses. Marginal (factor-level) caps (#4001)
 * reuse the same primitives behind a different capacity ledger.
 */

import {
  RANDOMIZATION_RESOURCE_LIMITS,
  type AllocationRow,
  type ArmSpec,
  type BlockRandomizationRequest,
  type BlockSizeRule,
  type MarginalSitePolicy,
  type ParticipantProfile,
  type PrngStream,
  type ProfileAssignmentOutcome,
  type RandomizationRequest,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "../../types";
import { reduceAllocationRatios } from "../contracts";
import { validateRandomizationPlan } from "../validate-plan";
import { formatStratumHumanCode } from "../identity/stratum-identity";
import { createSubjectIdGenerator } from "../identity/subject-id";
import { createRandomizationStreams } from "./seed";
import {
  enumerateStratumIntersections,
  resolveBlockCapacities,
  type StratumIntersection,
} from "./caps";
import { resolveMarginalCaps, type MarginalCapResolution } from "./marginal";
import {
  createLedger,
  mapProfileToIntersection,
  type CapacityLedger,
  type ResolvedCapacities,
} from "./capacity";

/** Resolved capacities of either kind: an intersection matrix or level caps. */
export type BlockCapacities = ResolvedCapacities;

/** Composition of one legal block size (RND-BLOCK-002). */
export interface BlockCompositionPreview {
  readonly blockSize: number;
  readonly legal: boolean;
  /** Slots per arm, in arm order; empty when the size is not legal. */
  readonly slotsPerArm: readonly number[];
  /** Slots that cannot be filled at the reduced ratio (`blockSize mod T`). */
  readonly remainderSlots: number;
}

/**
 * Previews how a block size splits across arms at the reduced ratio. A size
 * is legal only when it is a positive multiple of the reduced ratio sum.
 */
export function previewBlockComposition(
  arms: readonly Pick<ArmSpec, "allocationRatio">[],
  blockSize: number
): BlockCompositionPreview {
  const reduced = reduceAllocationRatios(arms);
  if (!reduced.ok || !Number.isSafeInteger(blockSize) || blockSize <= 0) {
    return { blockSize, legal: false, slotsPerArm: [], remainderSlots: 0 };
  }
  const total = reduced.ratios.reduce((a, b) => a + b, 0);
  const remainderSlots = blockSize % total;
  if (remainderSlots !== 0) {
    return { blockSize, legal: false, slotsPerArm: [], remainderSlots };
  }
  const multiplier = blockSize / total;
  return {
    blockSize,
    legal: true,
    slotsPerArm: reduced.ratios.map((q) => q * multiplier),
    remainderSlots: 0,
  };
}

/**
 * Builds one balanced block and shuffles a copy with Fisher-Yates, from the
 * last index down to 1, using `j = floor(U * (i + 1))` (RND-BLOCK-009,
 * RND-BLOCK-010). Consumes exactly `blockSize - 1` draws.
 */
export function buildPermutedBlock(
  armIds: readonly string[],
  reducedRatios: readonly number[],
  blockSize: number,
  stream: PrngStream
): readonly string[] {
  const total = reducedRatios.reduce((a, b) => a + b, 0);
  if (
    armIds.length !== reducedRatios.length ||
    total <= 0 ||
    !Number.isSafeInteger(blockSize) ||
    blockSize <= 0 ||
    blockSize % total !== 0
  ) {
    throw new RangeError(
      "Block size must be a positive multiple of the reduced ratio sum."
    );
  }
  const multiplier = blockSize / total;
  const block: string[] = [];
  armIds.forEach((armId, index) => {
    for (let k = 0; k < reducedRatios[index] * multiplier; k += 1) {
      block.push(armId);
    }
  });
  for (let i = block.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(stream.nextFloat() * (i + 1));
    const swap = block[i];
    block[i] = block[j];
    block[j] = swap;
  }
  return Object.freeze(block);
}

interface RuleState {
  sequenceIndex: number;
  readonly usage: Map<number, number>;
}

interface ResolvedRule {
  /** Which rule applies; part of the state key so overrides never share counters. */
  readonly source: string;
  readonly rule: BlockSizeRule;
}

/** Rule precedence: intersection override, then site override, then the default rule. */
function resolveRule(
  request: BlockRandomizationRequest,
  siteId: string,
  stratumKey: string
): ResolvedRule {
  const settings = request.blockSettings;
  const intersection = settings.intersectionOverrides ?? [];
  const siteSpecific = intersection.findIndex(
    (o) => o.stratumKey === stratumKey && o.siteId === siteId
  );
  if (siteSpecific >= 0) {
    return {
      source: `intersection:${siteSpecific}`,
      rule: intersection[siteSpecific].rule,
    };
  }
  const anySite = intersection.findIndex(
    (o) => o.stratumKey === stratumKey && o.siteId === undefined
  );
  if (anySite >= 0) {
    return {
      source: `intersection:${anySite}`,
      rule: intersection[anySite].rule,
    };
  }
  const site = (settings.siteOverrides ?? []).findIndex(
    (o) => o.siteId === siteId
  );
  if (site >= 0) {
    return { source: `site:${site}`, rule: settings.siteOverrides![site].rule };
  }
  return { source: "default", rule: settings.defaultRule };
}

function trackingKey(
  request: BlockRandomizationRequest,
  source: string,
  siteId: string,
  stratumKey: string
): string {
  switch (request.blockSettings.trackingScope) {
    case "global":
      return JSON.stringify([source]);
    case "per-site":
      return JSON.stringify([source, siteId]);
    default:
      return JSON.stringify([source, siteId, stratumKey]);
  }
}

/**
 * Picks the next block size (RND-BLOCK-003, RND-BLOCK-004, RND-BLOCK-008).
 * A fixed sequence cycles its sizes. A random pool draws once among sizes
 * still under their soft limit, and falls back to the whole pool when every
 * size has reached it; the limits are preferences, not hard stops.
 */
function selectBlockSize(
  rule: BlockSizeRule,
  state: RuleState,
  stream: PrngStream
): number {
  if (rule.mode === "fixed-sequence") {
    const size = rule.sizes[state.sequenceIndex % rule.sizes.length];
    state.sequenceIndex += 1;
    return size;
  }
  const limits = new Map(
    (rule.softUsageLimits ?? []).map((l) => [l.blockSize, l.maxUses])
  );
  const available = rule.sizes.filter((size) => {
    const limit = limits.get(size);
    return limit === undefined || (state.usage.get(size) ?? 0) < limit;
  });
  const pool = available.length > 0 ? available : rule.sizes;
  const size = pool[Math.floor(stream.nextFloat() * pool.length)];
  state.usage.set(size, (state.usage.get(size) ?? 0) + 1);
  return size;
}

function blockFinding(fieldPath: string, message: string): ValidationFinding {
  return {
    code: "INVALID_BLOCK_SETTINGS",
    severity: "error",
    fieldPath,
    message,
  };
}

function validateRuleSizes(
  rule: BlockSizeRule,
  ratioSum: number,
  path: string,
  findings: ValidationFinding[]
): void {
  const seen = new Set<number>();
  rule.sizes.forEach((size, index) => {
    if (!Number.isSafeInteger(size) || size <= 0 || size % ratioSum !== 0) {
      findings.push(
        blockFinding(
          `${path}.sizes[${index}]`,
          `Block size must be a positive multiple of the reduced ratio sum (${ratioSum}).`
        )
      );
    }
    if (seen.has(size)) {
      findings.push(
        blockFinding(
          `${path}.sizes[${index}]`,
          "Block sizes in one rule must be distinct."
        )
      );
    }
    seen.add(size);
  });
  (rule.softUsageLimits ?? []).forEach((limit, index) => {
    if (!rule.sizes.includes(limit.blockSize)) {
      findings.push(
        blockFinding(
          `${path}.softUsageLimits[${index}]`,
          "A usage limit must name one of the rule's block sizes."
        )
      );
    }
  });
}

interface PreparedBlockPlan {
  readonly request: BlockRandomizationRequest;
  readonly reducedRatios: readonly number[];
  readonly intersections: readonly StratumIntersection[];
  readonly capacities: BlockCapacities;
}

function prepareBlockPlan(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits
):
  | { ok: true; plan: PreparedBlockPlan }
  | { ok: false; findings: readonly ValidationFinding[] } {
  const validation = validateRandomizationPlan(request, limits);
  if (!validation.ok) return { ok: false, findings: validation.findings };
  if (request.method !== "BLOCK") {
    return {
      ok: false,
      findings: [
        {
          code: "UNSUPPORTED_METHOD_COMBINATION",
          severity: "error",
          fieldPath: "method",
          message: "Permuted-block generation needs a BLOCK request.",
        },
      ],
    };
  }

  const reduced = reduceAllocationRatios(request.arms);
  if (!reduced.ok) return { ok: false, findings: reduced.findings };
  const ratioSum = reduced.ratios.reduce((a, b) => a + b, 0);

  const intersections = enumerateStratumIntersections(request.factors);
  const knownKeys = new Set(intersections.map((i) => i.stratumKey));
  const knownSites = new Set(request.sites.map((s) => s.id));
  const findings: ValidationFinding[] = [];
  const settings = request.blockSettings;
  validateRuleSizes(
    settings.defaultRule,
    ratioSum,
    "blockSettings.defaultRule",
    findings
  );
  const seenSites = new Set<string>();
  (settings.siteOverrides ?? []).forEach((override, index) => {
    const path = `blockSettings.siteOverrides[${index}]`;
    if (!knownSites.has(override.siteId)) {
      findings.push(
        blockFinding(`${path}.siteId`, "Override names an unknown site.")
      );
    }
    if (seenSites.has(override.siteId)) {
      findings.push(blockFinding(path, "Only one override per site."));
    }
    seenSites.add(override.siteId);
    validateRuleSizes(override.rule, ratioSum, `${path}.rule`, findings);
  });
  const seenIntersections = new Set<string>();
  (settings.intersectionOverrides ?? []).forEach((override, index) => {
    const path = `blockSettings.intersectionOverrides[${index}]`;
    if (!knownKeys.has(override.stratumKey)) {
      findings.push(
        blockFinding(
          `${path}.stratumKey`,
          "Override names an unknown stratum intersection."
        )
      );
    }
    if (override.siteId !== undefined && !knownSites.has(override.siteId)) {
      findings.push(
        blockFinding(`${path}.siteId`, "Override names an unknown site.")
      );
    }
    const key = JSON.stringify([override.stratumKey, override.siteId ?? null]);
    if (seenIntersections.has(key)) {
      findings.push(
        blockFinding(path, "Only one override per intersection and site.")
      );
    }
    seenIntersections.add(key);
    validateRuleSizes(override.rule, ratioSum, `${path}.rule`, findings);
  });
  if (findings.length > 0) return { ok: false, findings };

  const capacities =
    request.caps.strategy === "marginal"
      ? resolveMarginalCaps(request)
      : resolveBlockCapacities(request, intersections);
  if (!capacities.ok) return { ok: false, findings: capacities.findings };

  const totalCapacity =
    capacities.strategy === "marginal"
      ? BigInt(capacities.terminationBound)
      : capacities.caps.reduce((sum, c) => sum + BigInt(c.cap), BigInt(0));
  if (totalCapacity > BigInt(limits.maxRows)) {
    return {
      ok: false,
      findings: [
        {
          code: "RESOURCE_LIMIT_EXCEEDED",
          severity: "error",
          fieldPath: "caps",
          message: `Total capacity (${totalCapacity.toString()}) exceeds the row limit of ${limits.maxRows}.`,
          estimatedValue: totalCapacity.toString(),
          limitValue: String(limits.maxRows),
        },
      ],
    };
  }

  return {
    ok: true,
    plan: { request, reducedRatios: reduced.ratios, intersections, capacities },
  };
}

/** Generates blocks for one (site, intersection) cell with the shared rule state. */
class BlockFactory {
  private readonly ruleStates = new Map<string, RuleState>();
  private readonly blockNumbers = new Map<string, number>();
  private readonly armIds: readonly string[];

  constructor(
    private readonly plan: PreparedBlockPlan,
    private readonly stream: PrngStream
  ) {
    this.armIds = plan.request.arms.map((a) => a.id);
  }

  next(
    siteId: string,
    stratumKey: string
  ): { blockIndex: number; blockSize: number; arms: readonly string[] } {
    const resolved = resolveRule(this.plan.request, siteId, stratumKey);
    const stateKey = trackingKey(
      this.plan.request,
      resolved.source,
      siteId,
      stratumKey
    );
    let state = this.ruleStates.get(stateKey);
    if (!state) {
      state = { sequenceIndex: 0, usage: new Map() };
      this.ruleStates.set(stateKey, state);
    }
    const blockSize = selectBlockSize(resolved.rule, state, this.stream);
    const arms = buildPermutedBlock(
      this.armIds,
      this.plan.reducedRatios,
      blockSize,
      this.stream
    );
    const cellKey = JSON.stringify([siteId, stratumKey]);
    const blockIndex = (this.blockNumbers.get(cellKey) ?? 0) + 1;
    this.blockNumbers.set(cellKey, blockIndex);
    return { blockIndex, blockSize, arms };
  }
}

/** A block cut short by its cap (RND-BLOCK-011). Its arms are not balanced. */
export interface PartialBlockRecord {
  readonly siteId: string;
  readonly stratumKey: string;
  readonly blockIndex: number;
  readonly blockSize: number;
  readonly emittedSlots: number;
}

/** Why a marginal schedule stopped. */
export type MarginalStopReason =
  /** The termination bound was zero, so nothing could be emitted. */
  | "ZERO_CAPACITY"
  /** The caps allowed at least the enrollment target. */
  | "BOUND_REACHED"
  /**
   * The caps ran out before the enrollment target, for example because one
   * factor's level caps add up to less than another's. The rows are not
   * topped up with invented subjects.
   */
  | "MARGINAL_CAPACITY_EXHAUSTED";

/** How a marginal schedule ran and why it stopped (RND-CAPS-007 to -009). */
export interface MarginalScheduleSummary {
  readonly sitePolicy: MarginalSitePolicy;
  readonly terminationBound: number;
  /** The request's enrollment target. */
  readonly requestedRows: number;
  readonly emittedRows: number;
  /** Rows short of the enrollment target, or 0. */
  readonly shortfall: number;
  readonly stopReason: MarginalStopReason;
}

/** Result of generating a standard block schedule. */
export type BlockScheduleResult =
  | {
      readonly ok: true;
      readonly reducedRatios: readonly number[];
      readonly capacities: BlockCapacities;
      readonly rows: readonly AllocationRow[];
      readonly partialBlocks: readonly PartialBlockRecord[];
      /** Present only for marginal caps. */
      readonly marginal?: MarginalScheduleSummary;
    }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

/**
 * Generates a standard permuted-block schedule (RND-BLOCK-012). Each pass
 * visits intersections in Cartesian order and, inside each, sites in
 * declared order, emitting one whole block per cell that still has capacity.
 * Passes repeat until every cell is full. A block that would overrun its cap
 * is shuffled in full first, then truncated and reported in `partialBlocks`;
 * when the design sets `allowPartialFinalBlock: false`, that is refused.
 * Site recruitment weights do not affect this traversal.
 *
 * With marginal caps there is no intersection matrix, so the schedule
 * samples profiles instead (#4001). On each turn a site draws one
 * intersection uniformly from those that still fit every capped level, and
 * takes the next slot of that cell's current block. `round-robin-v1` gives
 * each active site one turn in declared order until none can take another
 * subject; `site-major-v1` fills each site before the next. Blocks left
 * unfinished at the end are reported in `partialBlocks`.
 */
export function generateBlockSchedule(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): BlockScheduleResult {
  const prepared = prepareBlockPlan(request, limits);
  if (!prepared.ok) return prepared;
  const { plan } = prepared;
  const streams = createRandomizationStreams(plan.request.seed.value);
  const factory = new BlockFactory(plan, streams.allocation);
  const ledger = createLedger(plan.capacities);
  const ids = createSubjectIdGenerator(
    plan.request.subjectIdMask.pattern,
    streams.identifier
  );
  const armCode = new Map(plan.request.arms.map((a) => [a.id, a.code]));

  const rows: AllocationRow[] = [];
  const partialBlocks: PartialBlockRecord[] = [];
  let marginal: MarginalScheduleSummary | undefined;
  if (plan.capacities.strategy === "marginal") {
    marginal = emitMarginalRows(
      plan,
      plan.capacities,
      factory,
      ledger,
      streams.allocation,
      (site, intersection, block, position) =>
        rows.push(
          Object.freeze({
            sequence: rows.length + 1,
            subjectId: ids.nextId({
              siteCode: site.code,
              stratumLabel: formatStratumHumanCode(intersection.labels),
            }),
            siteId: site.id,
            stratumKey: intersection.stratumKey,
            stratumLevels: intersection.levels,
            armId: block.arms[position],
            armCode: armCode.get(block.arms[position])!,
            blockIndex: block.blockIndex,
            blockSize: block.blockSize,
            positionInBlock: position + 1,
          })
        ),
      partialBlocks
    );
  }
  let emittedThisPass = plan.capacities.strategy !== "marginal";
  while (emittedThisPass) {
    emittedThisPass = false;
    for (const intersection of plan.intersections) {
      for (const site of plan.request.sites) {
        const left = ledger.left(site.id, intersection);
        if (left <= 0) continue;
        const block = factory.next(site.id, intersection.stratumKey);
        const emit = Math.min(left, block.arms.length);
        if (emit < block.arms.length) {
          partialBlocks.push(
            Object.freeze({
              siteId: site.id,
              stratumKey: intersection.stratumKey,
              blockIndex: block.blockIndex,
              blockSize: block.blockSize,
              emittedSlots: emit,
            })
          );
        }
        const stratumLabel = formatStratumHumanCode(intersection.labels);
        for (let position = 0; position < emit; position += 1) {
          const armId = block.arms[position];
          rows.push(
            Object.freeze({
              sequence: rows.length + 1,
              subjectId: ids.nextId({ siteCode: site.code, stratumLabel }),
              siteId: site.id,
              stratumKey: intersection.stratumKey,
              stratumLevels: intersection.levels,
              armId,
              armCode: armCode.get(armId)!,
              blockIndex: block.blockIndex,
              blockSize: block.blockSize,
              positionInBlock: position + 1,
            })
          );
        }
        ledger.take(site.id, intersection, emit);
        emittedThisPass = true;
      }
    }
  }

  if (
    partialBlocks.length > 0 &&
    !plan.request.blockSettings.allowPartialFinalBlock
  ) {
    return {
      ok: false,
      findings: [
        blockFinding(
          "blockSettings.allowPartialFinalBlock",
          "A cap cuts a block short, and this design does not allow partial final blocks. Change a cap or the block sizes, or allow partial blocks."
        ),
      ],
    };
  }

  return {
    ok: true,
    reducedRatios: plan.reducedRatios,
    capacities: plan.capacities,
    rows: Object.freeze(rows),
    partialBlocks: Object.freeze(partialBlocks),
    ...(marginal ? { marginal: Object.freeze(marginal) } : {}),
  };
}

interface DrawnBlock {
  readonly blockIndex: number;
  readonly blockSize: number;
  readonly arms: readonly string[];
}

/**
 * Emits a marginal schedule one subject per site turn. Each emitted row
 * takes one unit from every capped level it carries, so no level ever goes
 * past its cap, and the loop ends within the termination bound.
 */
function emitMarginalRows(
  plan: PreparedBlockPlan,
  capacities: MarginalCapResolution,
  factory: BlockFactory,
  ledger: CapacityLedger,
  stream: PrngStream,
  emit: (
    site: BlockRandomizationRequest["sites"][number],
    intersection: StratumIntersection,
    block: DrawnBlock,
    position: number
  ) => void,
  partialBlocks: PartialBlockRecord[]
): MarginalScheduleSummary {
  const queues = new Map<
    string,
    { block: DrawnBlock; next: number; siteId: string; stratumKey: string }
  >();
  let emitted = 0;

  function turn(site: BlockRandomizationRequest["sites"][number]): boolean {
    if (emitted >= capacities.terminationBound) return false;
    const options = plan.intersections.filter(
      (i) => ledger.left(site.id, i) > 0
    );
    if (options.length === 0) return false;
    const intersection =
      options[Math.floor(stream.nextFloat() * options.length)];
    const cellKey = JSON.stringify([site.id, intersection.stratumKey]);
    let queue = queues.get(cellKey);
    if (!queue || queue.next >= queue.block.arms.length) {
      queue = {
        block: factory.next(site.id, intersection.stratumKey),
        next: 0,
        siteId: site.id,
        stratumKey: intersection.stratumKey,
      };
      queues.set(cellKey, queue);
    }
    emit(site, intersection, queue.block, queue.next);
    queue.next += 1;
    ledger.take(site.id, intersection, 1);
    emitted += 1;
    return true;
  }

  if (capacities.sitePolicy === "site-major-v1") {
    for (const site of plan.request.sites) {
      while (turn(site)) {
        // fill this site before moving on
      }
    }
  } else {
    let active = [...plan.request.sites];
    while (active.length > 0) {
      active = active.filter((site) => turn(site));
    }
  }

  for (const queue of queues.values()) {
    if (queue.next < queue.block.arms.length) {
      partialBlocks.push(
        Object.freeze({
          siteId: queue.siteId,
          stratumKey: queue.stratumKey,
          blockIndex: queue.block.blockIndex,
          blockSize: queue.block.blockSize,
          emittedSlots: queue.next,
        })
      );
    }
  }

  const bound = capacities.terminationBound;
  const requested = plan.request.enrollmentTarget;
  return {
    // resolveMarginalCaps requires a site policy for every BLOCK request.
    sitePolicy: capacities.sitePolicy!,
    terminationBound: bound,
    requestedRows: requested,
    emittedRows: emitted,
    shortfall: Math.max(0, requested - emitted),
    stopReason:
      bound === 0
        ? "ZERO_CAPACITY"
        : emitted < requested
          ? "MARGINAL_CAPACITY_EXHAUSTED"
          : "BOUND_REACHED",
  };
}

/** A session that assigns actual participant profiles one at a time. */
export interface BlockAllocationSession {
  /** Assigns the next slot for this profile's own site and intersection. */
  assign(profile: ParticipantProfile): ProfileAssignmentOutcome;
}

/** Result of opening a profile allocation session. */
export type BlockAllocationSessionResult =
  | { readonly ok: true; readonly session: BlockAllocationSession }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

/**
 * Opens an allocation session for actual profiles. Each (site, intersection)
 * cell draws whole blocks from the shared rule state and RNG stream only
 * when it needs one, and an unmapped or exhausted profile consumes nothing.
 */
export function createBlockAllocationSession(
  request: RandomizationRequest,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): BlockAllocationSessionResult {
  const prepared = prepareBlockPlan(request, limits);
  if (!prepared.ok) return prepared;
  const { plan } = prepared;
  const streams = createRandomizationStreams(plan.request.seed.value);
  const factory = new BlockFactory(plan, streams.allocation);
  const ledger = createLedger(plan.capacities);
  const armCode = new Map(plan.request.arms.map((a) => [a.id, a.code]));
  const byKey = new Map(plan.intersections.map((i) => [i.stratumKey, i]));
  const queues = new Map<
    string,
    { blockIndex: number; arms: readonly string[]; next: number }
  >();
  let allocations = 0;

  function assign(profile: ParticipantProfile): ProfileAssignmentOutcome {
    const mapped = mapProfileToIntersection(plan.request, byKey, profile);
    if (!mapped.ok) return mapped.outcome;
    const { intersection } = mapped;
    const stratumKey = intersection.stratumKey;
    if (ledger.left(profile.siteId, intersection) <= 0) {
      return {
        status: "cap-exhausted",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        stratumKey,
        reason:
          plan.capacities.strategy === "marginal"
            ? "MARGINAL_CAPACITY_EXHAUSTED"
            : "CAPACITY_EXHAUSTED",
      };
    }
    const cellKey = JSON.stringify([profile.siteId, stratumKey]);
    let queue = queues.get(cellKey);
    if (!queue || queue.next >= queue.arms.length) {
      const block = factory.next(profile.siteId, stratumKey);
      queue = { blockIndex: block.blockIndex, arms: block.arms, next: 0 };
      queues.set(cellKey, queue);
    }
    const slotIndex = queue.next;
    const armId = queue.arms[slotIndex];
    queue.next += 1;
    ledger.take(profile.siteId, intersection, 1);
    allocations += 1;
    return {
      status: "assigned",
      allocationId: `alloc-${allocations}`,
      slotIndex: slotIndex + 1,
      subjectId: profile.subjectId,
      siteId: profile.siteId,
      stratumKey,
      armId,
      armCode: armCode.get(armId)!,
    };
  }

  return { ok: true, session: Object.freeze({ assign }) };
}
