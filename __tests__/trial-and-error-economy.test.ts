import { describe, it, expect } from "vitest";
import {
  ACT_I,
  SCENARIOS,
  CONSUMABLE_SLOTS,
  CPU_COSTS,
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  EMPTY_SHELL_ALERT,
  FootnoteSealSchema,
  SPONSOR_SAFETY_SCENARIO,
  STALE_ALERT,
  SapRulebookSchema,
  ScenarioSchema,
  TableShellSpecSchema,
  advanceRun,
  advanceTable,
  applyTransition,
  carriedInventory,
  compileShell,
  cpuReducer,
  createRunState,
  deriveRunView,
  createTableState,
  deriveTableView,
  previewAllocation,
  validate,
  type FootnoteSeal,
  type Inventory,
  type RunAction,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const SMALL = DEMOGRAPHICS_SCENARIO;
const BIG = SPONSOR_SAFETY_SCENARIO;
const BOSS = DOSE_ESCALATION_SCENARIO;
const BLANK = "C-T14.1.3";
const DRAFT_A = "C-T14.1.1-A";
const DRAFT_C = "C-T14.1.1-C";
const DM_LISTING = "C-L16.2.4";
const ROUNDING = `FN-ROUND-SPONSOR@${SMALL.id}`;
const ADJUDICATED = `FN-ADJUDICATED@${SMALL.id}`;
const OVERLAP = `FN-AE-OVERLAP@${BIG.id}`;

function run(
  actions: TableAction[],
  from: TableState = createTableState(SMALL),
  scenario: Scenario = SMALL
): TableState {
  return actions.reduce((s, a) => advanceTable(scenario, s, a), from);
}

const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));

/** Sends A, B and the DM listing back, which deals the blank shell. */
const DEAL_BLANK: TableAction[] = [
  ...select(DRAFT_A, "C-T14.1.1-B", DM_LISTING),
  { type: "DISCARD" },
];
const withBlank = () => run(DEAL_BLANK);

const allocate = (
  population: "ITT" | "SAFETY" | "FAS" | "PER_PROTOCOL",
  cardId = BLANK
): TableAction => ({ type: "ALLOCATE", cardId, population });

const viewOf = (state: TableState, id: string, scenario: Scenario = SMALL) =>
  deriveTableView(scenario, state).hand.find((h) => h.card.id === id)!;

const lastMessage = (state: TableState) => state.lastEvent?.message ?? "";

const v2 = () => {
  const outcome = applyTransition(
    SMALL.populationSnapshot,
    BIG.events![0].transition
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.snapshot;
};

describe("T&E-04 contracts", () => {
  const shell = SMALL.shells.find((s) => s.id === "T-14.1.3")!;

  it("accepts a shell with a layout and the analysis sets it may run on", () => {
    expect(TableShellSpecSchema.safeParse(shell).success).toBe(true);
    expect(
      TableShellSpecSchema.safeParse({ ...shell, compatiblePopulations: [] })
        .success
    ).toBe(false);
    expect(
      TableShellSpecSchema.safeParse({
        ...shell,
        layout: { columns: [], rows: shell.layout!.rows },
      }).success
    ).toBe(false);
  });

  it("never lets a fatal rule be waived by a footnote", () => {
    const rulebook = SMALL.rulebook;
    expect(SapRulebookSchema.safeParse(rulebook).success).toBe(true);
    const fatal = {
      ...rulebook,
      rules: rulebook.rules.map((r) =>
        r.severity === "FATAL" ? { ...r, waivableBy: ["FN-X"] } : r
      ),
    };
    const result = SapRulebookSchema.safeParse(fatal);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "A fatal rule cannot be waived by a footnote"
    );
    // An empty list waives nothing, so it is allowed.
    expect(
      SapRulebookSchema.safeParse({
        ...rulebook,
        rules: rulebook.rules.map((r) => ({ ...r, waivableBy: [] })),
      }).success
    ).toBe(true);
  });

  it("validates footnote seals", () => {
    for (const seal of [...(SMALL.consumables ?? []), ...BIG.consumables!]) {
      expect(FootnoteSealSchema.safeParse(seal).success).toBe(true);
    }
    const seal = SMALL.consumables![1];
    for (const bad of [
      { ...seal, effect: { kind: "PLUS_MULT", value: 0 } },
      { ...seal, effect: { kind: "RETRIGGER" } },
      { ...seal, name: "" },
      { ...seal, footnote: "x".repeat(201) },
      { ...seal, eligible: { populations: [] } },
      { ...seal, sellValue: -1 },
    ]) {
      expect(FootnoteSealSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("gives every Act I Blind a valid scenario", () => {
    for (const blind of Object.values(SCENARIOS)) {
      expect(ScenarioSchema.safeParse(blind).success).toBe(true);
    }
  });

  it("rejects a blank shell card that is not a Table on one of its shell's sets", () => {
    const blank = SMALL.deck.find((c) => c.id === BLANK)!;
    const issues = (deck: Scenario["deck"], shells = SMALL.shells) =>
      ScenarioSchema.safeParse({ ...SMALL, deck, shells }).error?.issues.map(
        (i) => i.message
      ) ?? [];
    const swap = (c: typeof blank) =>
      SMALL.deck.map((d) => (d.id === BLANK ? c : d));

    expect(issues(swap({ ...blank, population: "FAS" }))).toEqual([
      "A blank shell is a Table whose suit is one of its shell's analysis sets",
    ]);
    expect(issues(swap({ ...blank, cardType: "LISTING" }))).toEqual([
      "A blank shell is a Table whose suit is one of its shell's analysis sets",
    ]);
    expect(issues(swap({ ...blank, shellId: "T-14.1.1" }))).toEqual([
      "A blank shell must name a scenario shell with a layout",
    ]);
    expect(issues(swap({ ...blank, shellId: "T-NOPE" }))).toEqual([
      "A blank shell must name a scenario shell with a layout",
    ]);
    expect(issues(swap({ ...blank, draftId: "T-14.1.1-A" }))).toEqual([
      "A card needs exactly one of face data, a draft, a blank shell or KM data",
    ]);
    // A shell without compatiblePopulations accepts its target only.
    const targetOnly = SMALL.shells.map((s) =>
      s.id === "T-14.1.3" ? { ...s, compatiblePopulations: undefined } : s
    );
    expect(issues(SMALL.deck, targetOnly)).toEqual([]);
    expect(
      issues(swap({ ...blank, population: "SAFETY" }), targetOnly)
    ).toEqual([
      "A blank shell is a Table whose suit is one of its shell's analysis sets",
    ]);
  });
});

describe("CPU replenishment and costs", () => {
  it("costs 2 to play, 1 to discard or inspect, 2 to recompile; allocating and sealing are free", () => {
    expect(CPU_COSTS).toEqual({
      PLAY_HAND: 2,
      DISCARD: 1,
      INSPECT: 1,
      RECOMPILE: 2,
    });
  });

  it("replenishes the ledger to the Blind's allocation", () => {
    expect(
      cpuReducer(
        { available: 1, spent: 9 },
        { type: "REPLENISH", available: 10 }
      )
    ).toEqual({ available: 10, spent: 0 });
    expect(
      cpuReducer(
        { available: 4, spent: 0 },
        { type: "REPLENISH", available: -3 }
      )
    ).toEqual({ available: 0, spent: 0 });
    expect(
      cpuReducer(
        { available: 4, spent: 0 },
        { type: "REPLENISH", available: 2.7 }
      )
    ).toEqual({ available: 2, spent: 0 });
  });

  it("starts every Blind at full CPU, whatever the last one spent", () => {
    expect(createTableState(SMALL).cpu).toEqual({ available: 10, spent: 0 });
    // No crisis deck: these flows test the carry alone.
    const act = { ...ACT_I, crisisDeck: undefined };
    let r: RunState = createRunState(act);
    const go = (...actions: RunAction[]) => {
      r = actions.reduce((s, a) => advanceRun(act, s, a), r);
    };
    go(
      ...(select(DRAFT_C, DM_LISTING) as RunAction[]),
      { type: "PLAY_HAND" },
      ...(select("C-T14.1.1-B", "C-T14.1.2") as RunAction[]),
      { type: "PLAY_HAND" },
      ...(select("C-T14.3.1", "C-L16.2.7") as RunAction[]),
      { type: "PLAY_HAND" }
    );
    expect(r.table.status).toBe("CLEARED");
    expect(r.table.cpu.spent).toBe(6);
    go({ type: "NEXT_BLIND" });
    expect(r.table.cpu).toEqual({ available: 10, spent: 0 });
  });
});

describe("Blank shells", () => {
  it("deals the blank shell with no data, suit or provenance", () => {
    const state = withBlank();
    expect(state.hand).toContain(BLANK);
    expect(state.provenance[BLANK]).toBeUndefined();
    const view = viewOf(state, BLANK);
    expect(view).toMatchObject({
      blank: true,
      compatiblePopulations: ["ITT", "SAFETY"],
      inspectable: false,
      stale: false,
      seals: [],
      footnoteSlots: 1,
      stamps: [],
    });
    expect(view.face.kind).toBe("TABLE");
    if (view.face.kind === "TABLE") {
      expect(view.face.rows.map((r) => r.label)).toEqual([
        "Subjects, N",
        "Age (years), mean",
        "Female, n (%)",
        "Male, n (%)",
        "Age ≥ 65, n (%)",
      ]);
      expect(
        view.face.rows.flatMap((r) => r.values).every((v) => v === "·")
      ).toBe(true);
    }
    // Face-only cards take no footnotes; draft cards take their shell's slot.
    expect(viewOf(state, "C-T14.1.2").footnoteSlots).toBe(0);
    expect(viewOf(state, DRAFT_C).footnoteSlots).toBe(1);
    expect(viewOf(state, DRAFT_C).blank).toBe(false);
    expect(viewOf(state, DRAFT_C).compatiblePopulations).toEqual(["ITT"]);
  });

  it("refuses to play or inspect an empty shell", () => {
    const state = run([...select(BLANK, "C-T14.1.2")], withBlank());
    const view = deriveTableView(SMALL, state);
    expect(view.emptySelected).toEqual([BLANK]);
    expect(view.staleSelected).toEqual([]);
    expect(view.canPlay).toBe(false);
    expect(view.playBlockedReason).toBe(EMPTY_SHELL_ALERT);
    expect(view.playBlocker).toMatchObject({
      fix: expect.stringMatching(/^Allocate /),
      key: "A",
    });
    const played = run([{ type: "PLAY_HAND" }], state);
    expect(played.lastEvent?.message).toBe(view.playBlocker?.reason);
    expect(played.lastEvent?.kind).toBe("REFUSED");
    expect(lastMessage(played)).toBe(
      `${EMPTY_SHELL_ALERT} Empty: Table 14.1.3.`
    );
    expect(played.cpu).toEqual(state.cpu);
    expect(
      lastMessage(run([{ type: "INSPECT_CARD", cardId: BLANK }], state))
    ).toBe(
      "Table 14.1.3 is an empty shell: allocate an analysis set to compile it first."
    );
    expect(
      lastMessage(run([{ type: "RECOMPILE", cardId: BLANK }], state))
    ).toContain("nothing to recompile");
  });

  it("refuses an allocation that is not the shell's to take", () => {
    const state = withBlank();
    expect(lastMessage(run([allocate("ITT", DRAFT_A)], state))).toBe(
      "That card is not in your hand."
    );
    expect(lastMessage(run([allocate("ITT", DRAFT_C)], state))).toBe(
      "Table 14.1.1 (Draft C) is already compiled; only a blank shell takes an allocation."
    );
    expect(lastMessage(run([allocate("FAS")], state))).toBe(
      "Table 14.1.3 cannot be built on the FAS population: its shell accepts ITT, Safety."
    );
    const twice = run([allocate("SAFETY"), allocate("ITT")], state);
    expect(lastMessage(twice)).toBe(
      "Table 14.1.3 is already compiled on the Safety population. Allocation is final: recompile it if the data moves."
    );
    expect(twice.allocations).toEqual({ [BLANK]: "SAFETY" });
  });

  it("refuses to compile onto a population with no subjects", () => {
    const noPp: Scenario = {
      ...SMALL,
      populationSnapshot: {
        ...SMALL.populationSnapshot,
        subjects: SMALL.populationSnapshot.subjects.map((s) => ({
          ...s,
          populations: s.populations.filter((p) => p !== "PER_PROTOCOL"),
        })),
      },
      shells: SMALL.shells.map((s) =>
        s.id === "T-14.1.3"
          ? { ...s, compatiblePopulations: ["ITT", "PER_PROTOCOL"] }
          : s
      ),
    };
    const state = run(DEAL_BLANK, createTableState(noPp), noPp);
    const refused = run([allocate("PER_PROTOCOL")], state, noPp);
    expect(lastMessage(refused)).toBe(
      `The Per-Protocol population is empty in SNAP-P1-v1. ${EMPTY_SHELL_ALERT}`
    );
    const [itt, pp] = previewAllocation(noPp, state, BLANK);
    expect(itt.refusal).toBeNull();
    expect(pp).toMatchObject({
      population: "PER_PROTOCOL",
      subjects: 0,
      refusal: refused.lastEvent?.message,
      classification: null,
      estimate: null,
    });
  });

  it("compiles the shell on the allocated set, free, with current provenance", () => {
    const before = withBlank();
    const state = run([allocate("ITT")], before);
    expect(state.cpu).toEqual(before.cpu);
    expect(state.lastEvent).toMatchObject({
      kind: "ALLOCATED",
      message:
        "Allocated ITT data (N=12, SNAP-P1-v1) to Table 14.1.3. It compiled as a ITT output.",
    });
    expect(state.provenance[BLANK]).toMatchObject({ id: "SNAP-P1-v1" });
    const draft = state.drafts[BLANK];
    // The ITT compile reproduces the clean Draft C exactly.
    const clean = SMALL.drawPile.find((d) => d.id === "T-14.1.1-C")!;
    expect(draft.cells).toEqual(clean.cells);
    expect(draft).toMatchObject({
      shellId: "T-14.1.3",
      populationSnapshotId: "SNAP-P1-v1",
      draftLabel: "Compiled on SNAP-P1-v1",
    });
    const view = viewOf(state, BLANK);
    expect(view).toMatchObject({
      blank: false,
      inspectable: true,
      unverified: true,
    });
    expect(view.card.population).toBe("ITT");
    // Its review finds nothing: the programmer ran the SAP's own method.
    const inspected = run(
      [
        { type: "INSPECT_CARD", cardId: BLANK },
        ...Array.from({ length: 15 }, (_, i): TableAction => ({
          type: "INSPECT_CELL",
          row: Math.floor(i / 3),
          col: i % 3,
        })),
      ],
      state
    );
    expect(viewOf(inspected, BLANK).stamps).toEqual(["QC_PASS"]);
  });

  it("gives the compiled output the suit of the set chosen, which can make a flush", () => {
    const hand = run(
      [
        ...select("C-T14.1.1-B", DRAFT_A, DM_LISTING),
        { type: "DISCARD" },
        ...select("C-T14.3.1", "C-L16.2.7", "C-T14.3.2", "C-L16.2.8", BLANK),
      ],
      createTableState(SMALL)
    );
    const blocked = deriveTableView(SMALL, hand);
    expect(blocked.classification?.handType).toBe("TLF_PAIR");
    // An empty shell is not stale: nothing names it as the flush breaker.
    expect(blocked.flushBrokenBy).toEqual([]);

    const [itt, safety] = previewAllocation(SMALL, hand, BLANK);
    expect(itt.classification?.handType).toBe("TLF_PAIR");
    expect(safety).toMatchObject({
      population: "SAFETY",
      subjects: 12,
      snapshot: { id: "SNAP-P1-v1", version: 1 },
      refusal: null,
      classification: { handType: "POPULATION_FLUSH" },
    });
    expect(safety.estimate!.score).toBeGreaterThan(itt.estimate!.score);

    const allocated = run([allocate("SAFETY")], hand);
    const view = deriveTableView(SMALL, allocated);
    expect(view.classification?.handType).toBe("POPULATION_FLUSH");
    expect(view.preview?.score).toBe(safety.estimate?.score);
    expect(viewOf(allocated, BLANK).card.population).toBe("SAFETY");
    const played = run([{ type: "PLAY_HAND" }], allocated);
    expect(played.lastPlay?.classification.handType).toBe("POPULATION_FLUSH");
    expect(played.status).toBe("CLEARED");
  });

  it("previews without committing, and only for a blank shell in hand", () => {
    const state = withBlank();
    const frozen = JSON.stringify(state);
    const options = previewAllocation(SMALL, state, BLANK);
    expect(options.map((o) => o.population)).toEqual(["ITT", "SAFETY"]);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(previewAllocation(SMALL, state, DRAFT_C)).toEqual([]);
    expect(previewAllocation(SMALL, state, "nope")).toEqual([]);
    expect(
      previewAllocation(SMALL, run([allocate("ITT")], state), BLANK)
    ).toEqual([]);
    expect(previewAllocation(SMALL, createTableState(SMALL), BLANK)).toEqual(
      []
    );
    // With the selection full, the estimate is the shell alone.
    const full = run(
      select(DRAFT_C, "C-T14.1.2", "C-T14.3.1", "C-L16.2.7", "C-L16.1.1"),
      state
    );
    const [alone] = previewAllocation(SMALL, full, BLANK);
    expect(alone.classification).toEqual({
      handType: "HIGH_TABLE",
      scoringCardIds: [BLANK],
    });
  });

  it("shows the boss's debuff before the player commits", () => {
    const history = {
      snapshots: [SMALL.populationSnapshot, v2()],
      invalidations: [],
    };
    const state = run(
      [...select("C-T14.3.2.5-B"), { type: "DISCARD" }, ...select(BLANK)],
      createTableState(BOSS, history),
      BOSS
    );
    const [itt, safety] = previewAllocation(BOSS, state, BLANK);
    expect(itt).toMatchObject({ subjects: 12, snapshot: { id: "SNAP-P1-v2" } });
    expect(safety).toMatchObject({ subjects: 11 });
    // Built on ITT, the committee cancels its Chips.
    expect(
      itt.estimate!.ruleResults.some((r) => r.ruleId === "DEC-SAFETY-ONLY")
    ).toBe(true);
    expect(safety.estimate!.score).toBeGreaterThan(itt.estimate!.score);

    const compiled = run([allocate("SAFETY")], state, BOSS);
    expect(compiled.drafts[BLANK].cells).toEqual([
      ["5", "6", "11"],
      ["49.4", "40.7", "44.6"],
      ["3 (60.0)", "4 (66.7)", "7 (63.6)"],
      ["2 (40.0)", "2 (33.3)", "4 (36.4)"],
      ["1 (20.0)", "2 (33.3)", "3 (27.3)"],
    ]);
    const report = validate(compiled.drafts[BLANK], v2(), {
      ...BOSS.rulebook,
      populationSuit: "SAFETY",
    });
    expect(report.findings).toEqual([]);
  });

  it("goes stale when its set's membership moves, and recompiles on the new data", () => {
    const planned: Scenario = {
      ...SMALL,
      deck: [
        SMALL.deck.find((c) => c.id === BLANK)!,
        ...SMALL.deck.filter((c) => c.id !== BLANK),
      ],
      events: BIG.events,
    };
    const state = run(
      [allocate("SAFETY"), ...select("C-T14.1.2"), { type: "PLAY_HAND" }],
      createTableState(planned),
      planned
    );
    const view = viewOf(state, BLANK, planned);
    expect(view.stale).toBe(true);
    expect(view.stamps).toContain("STALE");
    expect(state.invalidations[0].staleCardIds).toContain(BLANK);
    expect(lastMessage(state)).toContain("Table 14.1.3");
    const blocked = run(
      [...select(BLANK), { type: "PLAY_HAND" }],
      state,
      planned
    );
    expect(lastMessage(blocked)).toBe(`${STALE_ALERT} Stale: Table 14.1.3.`);
    const rerun = run([{ type: "RECOMPILE", cardId: BLANK }], state, planned);
    expect(rerun.drafts[BLANK].cells[0]).toEqual(["5", "6", "11"]);
    expect(rerun.allocations[BLANK]).toBe("SAFETY");
    expect(viewOf(rerun, BLANK, planned).stale).toBe(false);
  });

  it("drops allocation and seals when the card leaves the hand", () => {
    const state = run(
      [
        allocate("SAFETY"),
        { type: "APPLY_SEAL", consumableId: ADJUDICATED, cardId: BLANK },
        ...select(BLANK),
        { type: "DISCARD" },
      ],
      withBlank()
    );
    expect(state.hand).not.toContain(BLANK);
    expect(state.allocations).toEqual({});
    expect(state.seals).toEqual({});
    expect(state.drafts[BLANK]).toBeUndefined();
  });
});

describe("Footnote seals", () => {
  it("grants the Blind's seals into the tray", () => {
    const state = createTableState(SMALL);
    expect(state.consumables.map((c) => c.id)).toEqual([ROUNDING, ADJUDICATED]);
    expect(state.budget).toBe(0);
    const view = deriveTableView(SMALL, state);
    expect(view.consumables).toBe(state.consumables);
    expect(view.consumableSlots).toBe(CONSUMABLE_SLOTS);
    expect(view.budget).toBe(0);
  });

  it("fills only free slots, never duplicating a grant", () => {
    const [rounding] = createTableState(SMALL).consumables;
    const full: Inventory = {
      consumables: [rounding, { ...rounding, id: "x" }],
      budget: 3,
    };
    expect(createTableState(SMALL, undefined, full).consumables).toEqual(
      full.consumables
    );
    const one: Inventory = { consumables: [rounding], budget: 0 };
    expect(
      createTableState(SMALL, undefined, one).consumables.map((c) => c.id)
    ).toEqual([ROUNDING, ADJUDICATED]);
    expect(createTableState(SMALL, undefined, full).budget).toBe(3);
  });

  it("refuses a seal the card cannot take", () => {
    const state = withBlank();
    const seal = (consumableId: string, cardId: string) =>
      lastMessage(run([{ type: "APPLY_SEAL", consumableId, cardId }], state));
    expect(seal("nope", DRAFT_C)).toBe(
      "That footnote seal is not in your tray."
    );
    expect(seal(ADJUDICATED, DRAFT_A)).toBe("That card is not in your hand.");
    expect(seal(ADJUDICATED, BLANK)).toBe(
      "Table 14.1.3 is an empty shell: allocate an analysis set before adding footnotes."
    );
    expect(seal(ADJUDICATED, "C-T14.1.2")).toBe(
      "Table 14.1.2 has no footnote slot: only outputs compiled from a table shell take footnotes."
    );
    expect(seal(ADJUDICATED, DRAFT_C)).toBe(
      "Adjudicated Endpoint applies to Safety outputs only; Table 14.1.1 (Draft C) is built on ITT."
    );
    const full = run(
      [{ type: "APPLY_SEAL", consumableId: ROUNDING, cardId: DRAFT_C }],
      state
    );
    expect(
      lastMessage(
        run(
          [{ type: "APPLY_SEAL", consumableId: ADJUDICATED, cardId: DRAFT_C }],
          full
        )
      )
    ).toBe("Table 14.1.1 (Draft C) has no free footnote slot.");
  });

  it("refuses by card type, topic and waivable rule", () => {
    const listingOnly: FootnoteSeal = {
      ...SMALL.consumables![1],
      id: "FN-LISTING",
      eligible: { cardTypes: ["LISTING"] },
    };
    const inv = (seal: FootnoteSeal): Inventory => ({
      consumables: [{ id: seal.id, kind: "SEAL", seal }],
      budget: 0,
    });
    const onDraftC = (seal: FootnoteSeal, scenario = SMALL) =>
      lastMessage(
        run(
          [{ type: "APPLY_SEAL", consumableId: seal.id, cardId: DRAFT_C }],
          createTableState(
            { ...scenario, consumables: [] },
            undefined,
            inv(seal)
          ),
          scenario
        )
      );
    expect(onDraftC(listingOnly)).toBe(
      "Adjudicated Endpoint applies to listing outputs only."
    );
    const aeOnly: FootnoteSeal = {
      ...listingOnly,
      eligible: { topics: ["AE"] },
    };
    expect(onDraftC(aeOnly)).toBe(
      "Adjudicated Endpoint does not apply to Table 14.1.1 (Draft C)."
    );
    // The Big Blind's SAP declares no waivable rule.
    const rounding = SMALL.consumables![0];
    const big = run(
      [
        {
          type: "APPLY_SEAL",
          consumableId: rounding.id,
          cardId: "C-T14.3.1-A",
        },
      ],
      createTableState(BIG, undefined, inv(rounding)),
      BIG
    );
    expect(lastMessage(big)).toBe(
      "No SAP rule for Table 14.3.1 (Draft A) accepts the Sponsor rounding standard footnote, so it has nothing to waive there."
    );
  });

  it("adds +Mult as its own traceable rule result, never hidden in the card", () => {
    const state = run(
      [
        allocate("SAFETY"),
        { type: "APPLY_SEAL", consumableId: ADJUDICATED, cardId: BLANK },
      ],
      withBlank()
    );
    expect(state.lastEvent).toMatchObject({
      kind: "SEALED",
      message:
        'Sealed Table 14.1.3 with Adjudicated Endpoint: +3 Mult. Footnote: "Serious events were adjudicated by an independent committee blinded to treatment."',
    });
    expect(state.consumables.map((c) => c.id)).toEqual([ROUNDING]);
    expect(state.cpu.spent).toBe(1);
    expect(viewOf(state, BLANK).seals.map((s) => s.id)).toEqual([
      "FN-ADJUDICATED",
    ]);
    const sealed = deriveTableView(SMALL, run(select(BLANK), state)).preview!;
    const unsealed = deriveTableView(
      SMALL,
      run([allocate("SAFETY"), ...select(BLANK)], withBlank())
    ).preview!;
    const result = sealed.ruleResults.find(
      (r) => r.ruleId === "SEAL-FN-ADJUDICATED"
    );
    expect(result).toMatchObject({ passed: true, chipsDelta: 0, multDelta: 3 });
    expect(result?.evidence).toContain("independent committee");
    expect(sealed.mult.total).toBe(unsealed.mult.total + 3);
  });

  it("adds +Chips on an eligible AE table, cancelled with the card when it goes stale", () => {
    const state = createTableState(BIG);
    expect(state.consumables.map((c) => c.id)).toEqual([
      OVERLAP,
      "GUIDE-ICH-E2A@sponsor-safety-big-blind",
    ]);
    const sealed = run(
      [
        { type: "APPLY_SEAL", consumableId: OVERLAP, cardId: "C-T14.3.1-A" },
        ...select("C-T14.3.1-A"),
      ],
      state,
      BIG
    );
    const preview = deriveTableView(BIG, sealed).preview!;
    expect(
      preview.ruleResults.find((r) => r.ruleId === "SEAL-FN-AE-OVERLAP")
    ).toMatchObject({ chipsDelta: 20, multDelta: 0 });
    const unsealed = deriveTableView(
      BIG,
      run(select("C-T14.3.1-A"), state, BIG)
    ).preview!;
    expect(preview.chips.total).toBe(unsealed.chips.total + 20);
    // The SAE table's topic is SAE, not AE.
    expect(
      lastMessage(
        run(
          [
            {
              type: "APPLY_SEAL",
              consumableId: OVERLAP,
              cardId: "C-T14.3.3-A",
            },
          ],
          state,
          BIG
        )
      )
    ).toBe(
      "AE Not Mutually Exclusive does not apply to Table 14.3.3 (Draft A)."
    );
    // After the S-004 event the sealed table is stale: seal Chips cancel too.
    const stale = run(
      [...select("C-T14.3.1-A"), ...select("C-T14.1.2"), { type: "PLAY_HAND" }],
      sealed,
      BIG
    );
    const staleView = deriveTableView(
      BIG,
      run(select("C-T14.3.1-A"), stale, BIG)
    );
    const cancel = staleView.preview!.ruleResults.find(
      (r) => r.ruleId === "STALE-SNAPSHOT"
    )!;
    expect(cancel.chipsDelta).toBeLessThanOrEqual(-(35 + 20));
  });

  it("waives only the redline its SAP rule declares, and says so", () => {
    const sealed = run([
      { type: "APPLY_SEAL", consumableId: ROUNDING, cardId: DRAFT_A },
      ...select(DRAFT_A),
      { type: "PLAY_HAND" },
    ]);
    const plain = run([...select(DRAFT_A), { type: "PLAY_HAND" }]);
    const rounding = (s: TableState) =>
      s.lastPlay!.evaluation.ruleResults.find((r) => r.ruleId === "SAP-DM-03")!;
    expect(rounding(plain)).toMatchObject({ passed: false, multDelta: -1 });
    expect(rounding(sealed)).toMatchObject({ passed: true, multDelta: 0 });
    expect(rounding(sealed).evidence).toMatch(
      /^Waived by footnote seal Sponsor rounding standard: "Percentages and means are rounded half away from zero/
    );
    // The fatal denominator error still zeroes the hand.
    expect(sealed.lastPlay!.evaluation.zeroRule.triggered).toBe(true);
    expect(
      sealed.lastPlay!.evaluation.ruleResults.filter(
        (r) => r.ruleId === "SAP-DM-01" && r.multMultiplier === 0
      ).length
    ).toBeGreaterThan(0);
    // Precision is not waivable, so its redline stands.
    expect(
      sealed.lastPlay!.evaluation.ruleResults.find(
        (r) => r.ruleId === "SAP-DM-02"
      )
    ).toMatchObject({ passed: false });
    expect(
      lastMessage(
        run([{ type: "APPLY_SEAL", consumableId: ROUNDING, cardId: DRAFT_A }])
      )
    ).toBe(
      'Sealed Table 14.1.1 (Draft A) with Sponsor rounding standard: waives SAP-DM-03 redlines. Footnote: "Percentages and means are rounded half away from zero, per the sponsor\'s reporting standard (SAP §9.1, note 2)."'
    );
  });

  it("keeps seals through a recompile", () => {
    const planned: Scenario = {
      ...SMALL,
      deck: [
        SMALL.deck.find((c) => c.id === BLANK)!,
        ...SMALL.deck.filter((c) => c.id !== BLANK),
      ],
      events: BIG.events,
    };
    const state = run(
      [
        allocate("SAFETY"),
        { type: "APPLY_SEAL", consumableId: ADJUDICATED, cardId: BLANK },
        ...select("C-T14.1.2"),
        { type: "PLAY_HAND" },
        { type: "RECOMPILE", cardId: BLANK },
      ],
      createTableState(planned),
      planned
    );
    expect(state.lastEvent?.kind).toBe("RECOMPILED");
    expect(viewOf(state, BLANK, planned).seals.map((s) => s.id)).toEqual([
      "FN-ADJUDICATED",
    ]);
  });

  it("sells a seal into the study budget", () => {
    const sold = run([{ type: "SELL_CONSUMABLE", consumableId: ADJUDICATED }]);
    expect(sold.consumables.map((c) => c.id)).toEqual([ROUNDING]);
    expect(sold.budget).toBe(2);
    expect(sold.lastEvent).toMatchObject({
      kind: "SOLD",
      message: "Sold Adjudicated Endpoint for $2k. Study budget $2k.",
    });
    expect(
      lastMessage(run([{ type: "SELL_CONSUMABLE", consumableId: "nope" }]))
    ).toBe("That consumable is not in your tray.");
    expect(carriedInventory(sold)).toEqual({
      consumables: sold.consumables,
      budget: 2,
      handLevels: sold.handLevels,
      relics: [],
      sites: [],
      enrollments: [],
      campaign: [],
    });
  });

  it("restores the opening tray on a Blind restart", () => {
    const state = run([
      { type: "SELL_CONSUMABLE", consumableId: ADJUDICATED },
      { type: "APPLY_SEAL", consumableId: ROUNDING, cardId: DRAFT_A },
      { type: "RESET" },
    ]);
    expect(state.consumables.map((c) => c.id)).toEqual([ROUNDING, ADJUDICATED]);
    expect(state.budget).toBe(0);
    expect(state.seals).toEqual({});
  });

  it("carries the tray and budget to the next Blind and clears them on restart", () => {
    // No crisis deck: these flows test the carry alone.
    const act = { ...ACT_I, crisisDeck: undefined };
    let r: RunState = createRunState(act);
    const go = (...actions: RunAction[]) => {
      r = actions.reduce((s, a) => advanceRun(act, s, a), r);
    };
    go(
      { type: "SELL_CONSUMABLE", consumableId: ROUNDING },
      ...(select(DRAFT_C, DM_LISTING) as RunAction[]),
      { type: "PLAY_HAND" },
      ...(select("C-T14.1.1-B", "C-T14.1.2") as RunAction[]),
      { type: "PLAY_HAND" },
      ...(select("C-T14.3.1", "C-L16.2.7") as RunAction[]),
      { type: "PLAY_HAND" }
    );
    // Leaving without shopping still collects the sponsor's payout.
    const payout = deriveRunView(act, r).pendingCashOut;
    expect(payout?.lines.map((l) => [l.id, l.amount])).toEqual([
      ["BASE", 3],
      ["CPU", 2],
      ["INTEREST", 0],
    ]);
    go({ type: "NEXT_BLIND" });
    expect(r.blindIndex).toBe(1);
    expect(r.table.budget).toBe(1 + 5);
    expect(r.table.consumables.map((c) => c.id)).toEqual([
      ADJUDICATED,
      OVERLAP,
    ]);
    go({ type: "RESTART_RUN" });
    expect(r.table.budget).toBe(0);
    expect(r.table.consumables.map((c) => c.id)).toEqual([
      ROUNDING,
      ADJUDICATED,
    ]);
  });

  it("replays identically and survives a JSON round trip", () => {
    const moves: TableAction[] = [
      ...DEAL_BLANK,
      allocate("SAFETY"),
      { type: "APPLY_SEAL", consumableId: ADJUDICATED, cardId: BLANK },
      { type: "SELL_CONSUMABLE", consumableId: ROUNDING },
      ...select(BLANK, "C-T14.3.1"),
      { type: "PLAY_HAND" },
    ];
    expect(run(moves)).toEqual(run(moves));
    expect(JSON.parse(JSON.stringify(run(moves)))).toEqual(run(moves));
  });
});

describe("compileShell", () => {
  it("prints every cell by the SAP's own method on the chosen set", () => {
    const shell = SMALL.shells.find((s) => s.id === "T-14.1.3")!;
    const table = compileShell(
      { ...shell, layout: shell.layout! },
      "X",
      SMALL.populationSnapshot,
      SMALL.rulebook
    );
    expect(table.cells).toEqual(
      SMALL.drawPile.find((d) => d.id === "T-14.1.1-C")!.cells
    );
    expect(
      validate(table, SMALL.populationSnapshot, SMALL.rulebook).findings
    ).toEqual([]);
  });
});
