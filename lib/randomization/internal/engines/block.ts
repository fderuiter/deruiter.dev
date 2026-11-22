/**
 * Permuted-block schedule generation and actual-profile allocation
 * (ticket #4000, RND-BLOCK-001 to RND-BLOCK-012).
 *
 * Both paths share one rule resolver, one block-size selector and one
 * Fisher-Yates shuffle, so an interleaved profile session uses exactly the
 * primitives a standard schedule uses.
 */

import {
  RANDOMIZATION_RESOURCE_LIMITS,
  type AllocationRow,
  type ArmSpec,
  type BlockRandomizationRequest,
  type BlockSizeRule,
  type ParticipantProfile,
  type PrngStream,
  type ProfileAssignmentOutcome,
  type RandomizationRequest,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "../../types";
import { reduceAllocationRatios } from "../contracts";
import { validateRandomizationPlan } from "../validate-plan";
import {
  formatStratumHumanCode,
  serializeStructuralStratumKey,
} from "../identity/stratum-identity";
import { createSubjectIdGenerator } from "../identity/subject-id";
import { createRandomizationStreams } from "./seed";
import {
  enumerateStratumIntersections,
  resolveBlockCapacities,
  type CapResolutionResult,
  type StratumIntersection,
} from "./caps";

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
  readonly capacities: Extract<CapResolutionResult, { ok: true }>;
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

  const capacities = resolveBlockCapacities(request, intersections);
  if (!capacities.ok) return { ok: false, findings: capacities.findings };

  const totalCapacity = capacities.caps.reduce(
    (sum, c) => sum + BigInt(c.cap),
    BigInt(0)
  );
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

/** Capacity counters shared by schedules and sessions. */
class CapacityLedger {
  private readonly remaining = new Map<string, number>();
  private readonly perSite: boolean;

  constructor(capacities: Extract<CapResolutionResult, { ok: true }>) {
    this.perSite = capacities.capScope === "per-site";
    for (const cap of capacities.caps) {
      this.remaining.set(this.key(cap.siteId ?? "", cap.stratumKey), cap.cap);
    }
  }

  private key(siteId: string, stratumKey: string): string {
    return JSON.stringify([this.perSite ? siteId : "", stratumKey]);
  }

  left(siteId: string, stratumKey: string): number {
    return this.remaining.get(this.key(siteId, stratumKey)) ?? 0;
  }

  take(siteId: string, stratumKey: string, count: number): void {
    const key = this.key(siteId, stratumKey);
    this.remaining.set(key, (this.remaining.get(key) ?? 0) - count);
  }
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

/** Result of generating a standard block schedule. */
export type BlockScheduleResult =
  | {
      readonly ok: true;
      readonly reducedRatios: readonly number[];
      readonly capacities: Extract<CapResolutionResult, { ok: true }>;
      readonly rows: readonly AllocationRow[];
      readonly partialBlocks: readonly PartialBlockRecord[];
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
  const ledger = new CapacityLedger(plan.capacities);
  const ids = createSubjectIdGenerator(
    plan.request.subjectIdMask.pattern,
    streams.identifier
  );
  const armCode = new Map(plan.request.arms.map((a) => [a.id, a.code]));

  const rows: AllocationRow[] = [];
  const partialBlocks: PartialBlockRecord[] = [];
  let emittedThisPass = true;
  while (emittedThisPass) {
    emittedThisPass = false;
    for (const intersection of plan.intersections) {
      for (const site of plan.request.sites) {
        const left = ledger.left(site.id, intersection.stratumKey);
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
        ledger.take(site.id, intersection.stratumKey, emit);
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
  const ledger = new CapacityLedger(plan.capacities);
  const armCode = new Map(plan.request.arms.map((a) => [a.id, a.code]));
  const sites = new Set(plan.request.sites.map((s) => s.id));
  const byKey = new Map(plan.intersections.map((i) => [i.stratumKey, i]));
  const queues = new Map<
    string,
    { blockIndex: number; arms: readonly string[]; next: number }
  >();
  let allocations = 0;

  function assign(profile: ParticipantProfile): ProfileAssignmentOutcome {
    if (!sites.has(profile.siteId)) {
      return {
        status: "unmapped-site",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
      };
    }
    const missing: string[] = [];
    const entries = plan.request.factors.map((factor) => {
      const levelId = profile.stratumLevels[factor.id];
      if (
        typeof levelId !== "string" ||
        !factor.levels.some((l) => l.id === levelId)
      ) {
        missing.push(factor.id);
      }
      return { factorId: factor.id, levelId };
    });
    if (missing.length > 0) {
      return {
        status: "unmapped-stratum",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        missingFactorIds: Object.freeze(missing),
      };
    }
    const stratumKey = serializeStructuralStratumKey(entries);
    if (!byKey.has(stratumKey)) {
      return {
        status: "unmapped-stratum",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        missingFactorIds: Object.freeze([]),
      };
    }
    if (ledger.left(profile.siteId, stratumKey) <= 0) {
      return {
        status: "cap-exhausted",
        subjectId: profile.subjectId,
        siteId: profile.siteId,
        stratumKey,
        reason: "CAPACITY_EXHAUSTED",
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
    ledger.take(profile.siteId, stratumKey, 1);
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
