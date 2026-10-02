// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  SCENARIOS,
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  PopulationTransitionSchema,
  SPONSOR_SAFETY_SCENARIO,
  STALE_ALERT,
  ScenarioSchema,
  SnapshotRefSchema,
  StudyEventSchema,
  advanceRun,
  advanceTable,
  applyTransition,
  cardShortName,
  classifyHand,
  compileDraft,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  membership,
  sameMembership,
  snapshotRef,
  studyHistory,
  validate,
  type PopulationSnapshot,
  type PopulationTransition,
  type RunAction,
  type Scenario,
  type StagedTable,
  type TableAction,
  type TableState,
  type TlfCard,
} from "@/lib/trial-and-error";

const V1 = SPONSOR_SAFETY_SCENARIO.populationSnapshot;
const EVENT = SPONSOR_SAFETY_SCENARIO.events![0];
const UNDOSED = EVENT.transition;

const transition = (
  overrides: Partial<PopulationTransition> = {}
): PopulationTransition => ({ ...UNDOSED, ...overrides });

function v2(): PopulationSnapshot {
  const outcome = applyTransition(V1, UNDOSED);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.snapshot;
}

/** Freezes a value and everything reachable from it. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const play = (
  scenario: Scenario,
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) => actions.reduce((s, a) => advanceTable(scenario, s, a), from);
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));

const BIG = SPONSOR_SAFETY_SCENARIO;
const DISPOSITION = "C-T14.1.2";
const OVERVIEW_A = "C-T14.3.1-A";
const AE_LISTING = "C-L16.2.7";
const SAE_A = "C-T14.3.3-A";
const SAE_LISTING = "C-L16.2.8";
const NERVOUS_A = "C-T14.3.2.5-A";
const OVERVIEW_B = "C-T14.3.1-B";
const DISCONTINUED = "C-L16.1.1";
const CARDIAC_A = "C-T14.3.2.1-A";

/** The Big Blind after its first hand: S-004 has left the Safety set. */
const afterEvent = () =>
  play(BIG, [...select(DISPOSITION), { type: "PLAY_HAND" }]);

const draftOf = (scenario: Scenario, cardId: string): StagedTable => {
  const card = scenario.deck.find((c) => c.id === cardId)!;
  return scenario.drawPile.find((d) => d.id === card.draftId)!;
};
const categories = (report: ReturnType<typeof validate>) =>
  report.findings.map((f) => `${f.category}@${f.cell.row}:${f.cell.col}`);

describe("snapshot contracts", () => {
  it("parses the scripted event and snapshot references", () => {
    expect(StudyEventSchema.safeParse(EVENT).success).toBe(true);
    expect(SnapshotRefSchema.safeParse(snapshotRef(V1)).success).toBe(true);
    expect(
      PopulationTransitionSchema.safeParse(transition({ populations: [] }))
        .success
    ).toBe(false);
    expect(
      StudyEventSchema.safeParse({ ...EVENT, afterHands: 0 }).success
    ).toBe(false);
  });

  it("rejects a study event naming a subject outside the snapshot", () => {
    const result = ScenarioSchema.safeParse({
      ...BIG,
      events: [{ ...EVENT, transition: transition({ subjectId: "S-999" }) }],
    });
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual([
      "events.0.transition.subjectId",
    ]);
  });
});

describe("applyTransition", () => {
  it("produces the next version without touching the old one", () => {
    const frozen = deepFreeze(structuredClone(V1));
    const outcome = applyTransition(frozen, UNDOSED);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.changed).toEqual(["SAFETY"]);
    expect(snapshotRef(outcome.snapshot)).toEqual({
      id: "SNAP-P1-v2",
      version: 2,
      capturedAt: UNDOSED.effectiveAt,
    });
    expect(frozen).toEqual(V1);
    expect(membership(outcome.snapshot, "SAFETY")).not.toContain("S-004");
    expect(membership(outcome.snapshot, "ITT")).toContain("S-004");
    expect(outcome.snapshot.subjects).toHaveLength(12);
    // Other subjects are shared, not copied: only S-004 changed.
    expect(outcome.snapshot.subjects[0]).toBe(frozen.subjects[0]);
  });

  it("joins populations in suit order and reports only real changes", () => {
    const outcome = applyTransition(
      V1,
      transition({ change: "JOIN", populations: ["PER_PROTOCOL", "ITT"] })
    );
    expect(outcome.ok && outcome.changed).toEqual(["PER_PROTOCOL"]);
    expect(
      outcome.ok &&
        outcome.snapshot.subjects.find((s) => s.id === "S-004")!.populations
    ).toEqual(["SCREENED", "ITT", "SAFETY", "PER_PROTOCOL", "FAS"]);
  });

  it("refuses an unknown subject or a change that changes nothing", () => {
    expect(applyTransition(V1, transition({ subjectId: "S-999" }))).toEqual({
      ok: false,
      message: "S-999 is not in snapshot SNAP-P1-v1.",
    });
    expect(
      applyTransition(V1, transition({ populations: ["PER_PROTOCOL"] }))
    ).toEqual({
      ok: false,
      message:
        "S-004 already is outside every named population; SNAP-P1-v1 is unchanged.",
    });
    expect(
      applyTransition(V1, transition({ change: "JOIN", populations: ["ITT"] }))
    ).toMatchObject({ ok: false });
  });

  it("compares membership per population", () => {
    const next = v2();
    expect(sameMembership(V1, V1, "SAFETY")).toBe(true);
    expect(sameMembership(V1, next, "SAFETY")).toBe(false);
    expect(sameMembership(V1, next, "ITT")).toBe(true);
    const dropped = applyTransition(
      next,
      transition({ subjectId: "S-001", populations: ["SAFETY"] })
    );
    // S-001 out and S-004 back: the same size as v2, different subjects.
    const swapped =
      dropped.ok &&
      applyTransition(
        dropped.snapshot,
        transition({ change: "JOIN", populations: ["SAFETY"] })
      );
    expect(swapped && swapped.ok).toBe(true);
    if (swapped && swapped.ok) {
      expect(membership(swapped.snapshot, "SAFETY")).toHaveLength(
        membership(next, "SAFETY").length
      );
      expect(sameMembership(next, swapped.snapshot, "SAFETY")).toBe(false);
    }
  });
});

describe("compileDraft", () => {
  it("reproduces every authored draft exactly on its own snapshot", () => {
    for (const scenario of Object.values(SCENARIOS)) {
      for (const draft of scenario.drawPile) {
        expect(compileDraft(draft, V1, V1, scenario.rulebook).cells).toEqual(
          draft.cells
        );
      }
    }
  });

  it("reproduces each defect by its mechanism on the new snapshot", () => {
    const next = v2();
    for (const scenario of [BIG, DOSE_ESCALATION_SCENARIO]) {
      for (const draft of scenario.drawPile) {
        const compiled = compileDraft(draft, V1, next, scenario.rulebook);
        expect(compiled.populationSnapshotId).toBe("SNAP-P1-v2");
        expect(categories(validate(compiled, next, scenario.rulebook))).toEqual(
          categories(validate(draft, V1, scenario.rulebook))
        );
      }
    }
  });

  it("recomputes values: clean cells, a precision slip, an events count", () => {
    const next = v2();
    const skin = compileDraft(
      draftOf(DOSE_ESCALATION_SCENARIO, "C-T14.3.2.6-A"),
      V1,
      next,
      DOSE_ESCALATION_SCENARIO.rulebook
    );
    expect(skin.cells[0]).toEqual(["5", "6", "11"]);
    // 1/12 shown at 2 dp stays a 2-dp slip on the new N: 1/11.
    expect(skin.cells[1][2]).toBe("1 (9.09)");
    const overview = compileDraft(
      draftOf(BIG, OVERVIEW_B),
      V1,
      next,
      BIG.rulebook
    );
    // 13 events counted as subjects, now over 11.
    expect(overview.cells[1][2]).toBe("13 (118.2)");
    expect(overview.cells[1][0]).toBe("3 (60.0)");
  });

  it("keeps a value no mechanism explains, and recompiles corrected cells", () => {
    const next = v2();
    const draft = draftOf(BIG, SAE_A);
    const typo = compileDraft(draft, V1, next, BIG.rulebook);
    expect(typo.cells[1][1]).toBe("3 (50.0)");
    const fixed = compileDraft(
      draft,
      V1,
      next,
      BIG.rulebook,
      new Set(["1:1", "3:2"])
    );
    expect(validate(fixed, next, BIG.rulebook).findings).toEqual([]);
    expect(draft.cells[1][1]).toBe("3 (50.0)");
  });

  it("prints not estimable for a column with no one in the SAP population", () => {
    const empty: PopulationSnapshot = {
      ...V1,
      id: "SNAP-EMPTY-v1",
      subjects: V1.subjects.map((s) =>
        s.arm === "PLACEBO"
          ? { ...s, populations: s.populations.filter((p) => p !== "SAFETY") }
          : s
      ),
    };
    const compiled = compileDraft(
      draftOf(BIG, "C-T14.3.3-B"),
      V1,
      empty,
      BIG.rulebook
    );
    expect(compiled.cells.map((row) => row[0])).toEqual([
      "0",
      "—",
      "—",
      "—",
      "—",
    ]);
    expect(validate(compiled, empty, BIG.rulebook).findings).toEqual([]);
  });

  it("reproduces a mean-age rounding slip on an ITT table", () => {
    const next = v2();
    const draft = draftOf(DEMOGRAPHICS_SCENARIO, "C-T14.1.1-A");
    const compiled = compileDraft(
      draft,
      V1,
      next,
      DEMOGRAPHICS_SCENARIO.rulebook
    );
    // S-004 left Safety only, so the ITT table is unchanged.
    expect(compiled.cells).toEqual(draft.cells);
  });
});

describe("stale outputs on the Card Table", () => {
  it("records each dealt card's snapshot", () => {
    const view = deriveTableView(BIG, createTableState(BIG));
    expect(view.snapshot).toEqual(snapshotRef(V1));
    expect(view.hand.every((h) => h.provenance.id === "SNAP-P1-v1")).toBe(true);
    expect(view.hand.some((h) => h.stale)).toBe(false);
    expect(view.invalidations).toEqual([]);
  });

  it("stales the Safety cards in hand when S-004 leaves the Safety set", () => {
    const state = afterEvent();
    expect(state.snapshots.map((s) => s.id)).toEqual([
      "SNAP-P1-v1",
      "SNAP-P1-v2",
    ]);
    expect(state.snapshots[0]).toBe(V1);
    const staleIds = [
      OVERVIEW_A,
      AE_LISTING,
      SAE_A,
      SAE_LISTING,
      NERVOUS_A,
      OVERVIEW_B,
    ];
    expect(state.invalidations).toEqual([
      {
        transitionId: UNDOSED.id,
        subjectId: "S-004",
        reason: "DROPOUT",
        change: "LEAVE",
        populations: ["SAFETY"],
        from: snapshotRef(V1),
        to: {
          id: "SNAP-P1-v2",
          version: 2,
          capturedAt: UNDOSED.effectiveAt,
        },
        staleCardIds: staleIds,
      },
    ]);
    expect(state.lastEvent?.message).toContain(UNDOSED.description);
    expect(state.lastEvent?.message).toContain(
      "Safety population now SNAP-P1-v2. Stale: Table 14.3.1 (Draft A), Listing 16.2.7"
    );

    const view = deriveTableView(BIG, state);
    const byId = Object.fromEntries(view.hand.map((h) => [h.card.id, h]));
    for (const id of staleIds) {
      expect(byId[id]).toMatchObject({ stale: true, stamps: ["STALE"] });
      expect(byId[id].provenance.id).toBe("SNAP-P1-v1");
    }
    // ITT outputs are unrelated to the change and stay valid.
    expect(byId[DISCONTINUED].stale).toBe(false);
    // A draft dealt after the change is compiled against the new snapshot.
    expect(byId[CARDIAC_A]).toMatchObject({
      stale: false,
      provenance: { id: "SNAP-P1-v2", version: 2 },
    });
    expect(state.drafts[CARDIAC_A].cells[0]).toEqual(["5", "6", "11"]);
    expect(view.snapshot.id).toBe("SNAP-P1-v2");
  });

  it("scores a stale card at 0 Chips and refuses to play it", () => {
    const state = play(BIG, select(NERVOUS_A), afterEvent());
    const view = deriveTableView(BIG, state);
    expect(view.canPlay).toBe(false);
    expect(view.playBlockedReason).toBe(STALE_ALERT);
    expect(view.playBlocker).toMatchObject({
      reason: expect.stringMatching(/^Output compiled against obsolete/),
      fix: expect.stringMatching(/^Recompile /),
      key: "R",
    });
    expect(view.staleSelected).toEqual([NERVOUS_A]);
    const stale = view.preview!.ruleResults.at(-1)!;
    // Its 25 Chips and the 12 subjects its draft accounts for are cancelled.
    expect(stale).toMatchObject({ ruleId: "STALE-SNAPSHOT", chipsDelta: -37 });
    expect(stale.evidence).toContain(
      "compiled against SNAP-P1-v1, and SNAP-P1-v2 has changed the Safety population"
    );
    expect(view.preview!.chips.total).toBe(15);

    const refused = advanceTable(BIG, state, { type: "PLAY_HAND" });
    expect(refused.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: `${STALE_ALERT} Stale: Table 14.3.2.5 (Draft A).`,
    });
    expect({ ...refused, lastEvent: null }).toEqual({
      ...state,
      lastEvent: null,
    });
  });

  it("names the stale cards that break a Population Flush", () => {
    const fresh = deriveTableView(
      BIG,
      play(BIG, select(OVERVIEW_A, AE_LISTING, SAE_A, SAE_LISTING, NERVOUS_A))
    );
    expect(fresh.classification?.handType).toBe("POPULATION_FLUSH");
    expect(fresh.flushBrokenBy).toEqual([]);

    const broken = deriveTableView(
      BIG,
      play(
        BIG,
        select(OVERVIEW_A, AE_LISTING, SAE_A, SAE_LISTING, NERVOUS_A),
        afterEvent()
      )
    );
    expect(broken.classification?.handType).toBe("TLF_TWO_PAIR");
    expect(broken.flushBrokenBy).toEqual([
      OVERVIEW_A,
      AE_LISTING,
      SAE_A,
      SAE_LISTING,
      NERVOUS_A,
    ]);
  });

  it("lets a stale card be discarded", () => {
    const state = play(
      BIG,
      [...select(NERVOUS_A), { type: "DISCARD" }],
      afterEvent()
    );
    expect(state.hand).not.toContain(NERVOUS_A);
    expect(state.provenance[NERVOUS_A]).toBeUndefined();
    expect(state.lastEvent?.kind).toBe("DISCARDED");
  });
});

describe("recompile", () => {
  it("refuses cards not in hand, current cards, and a short CPU budget", () => {
    const state = afterEvent();
    expect(
      advanceTable(BIG, state, { type: "RECOMPILE", cardId: "nope" }).lastEvent
        ?.message
    ).toBe("That card is not in your hand.");
    expect(
      advanceTable(BIG, state, { type: "RECOMPILE", cardId: CARDIAC_A })
        .lastEvent?.message
    ).toBe("Table 14.3.2.1 is current with SNAP-P1-v2; nothing to recompile.");
    const broke = { ...state, cpu: { available: 1, spent: 9 } };
    expect(
      advanceTable(BIG, broke, { type: "RECOMPILE", cardId: NERVOUS_A })
        .lastEvent?.message
    ).toBe("Recompile needs 2 CPU.");
  });

  it("reruns a stale draft on the current snapshot for 2 CPU", () => {
    const before = afterEvent();
    const state = advanceTable(BIG, before, {
      type: "RECOMPILE",
      cardId: NERVOUS_A,
    });
    expect(state.cpu.available).toBe(before.cpu.available - 2);
    expect(state.provenance[NERVOUS_A].id).toBe("SNAP-P1-v2");
    expect(state.drafts[NERVOUS_A].populationSnapshotId).toBe("SNAP-P1-v2");
    expect(state.lastEvent).toMatchObject({
      kind: "RECOMPILED",
      message:
        "Recompiled Table 14.3.2.5 AEs by SOC: Nervous System (Draft A) against SNAP-P1-v2 for 2 CPU. Inspect it again to verify the rerun.",
    });
    const card = deriveTableView(BIG, state).hand.find(
      (h) => h.card.id === NERVOUS_A
    )!;
    expect(card).toMatchObject({ stale: false, stamps: [], unverified: true });
    // Its uncorrected event-count defect is reproduced on the new data.
    expect(
      categories(validate(state.drafts[NERVOUS_A], v2(), BIG.rulebook))
    ).toEqual(["VALUE@1:1", "VALUE@1:2"]);
  });

  it("refreshes a face-only card's provenance", () => {
    const state = advanceTable(BIG, afterEvent(), {
      type: "RECOMPILE",
      cardId: AE_LISTING,
    });
    expect(state.provenance[AE_LISTING].id).toBe("SNAP-P1-v2");
    expect(state.drafts[AE_LISTING]).toBeUndefined();
    expect(state.lastEvent?.message).toBe(
      "Recompiled Listing 16.2.7 Adverse Events by Subject against SNAP-P1-v2 for 2 CPU."
    );
  });

  it("keeps the reviewer's corrections and starts the review over", () => {
    const draft = draftOf(BIG, NERVOUS_A);
    const report = validate(draft, V1, BIG.rulebook);
    const reviewed = play(
      BIG,
      [
        { type: "INSPECT_CARD", cardId: NERVOUS_A },
        ...report.findings.map((f): TableAction => ({
          type: "INSPECT_CELL",
          ...f.cell,
        })),
        ...report.findings.map((f): TableAction => ({
          type: "CORRECT_FINDING",
          findingId: f.id,
        })),
      ],
      afterEvent()
    );
    const view = deriveTableView(BIG, reviewed);
    expect(view.inspection).toMatchObject({
      stale: true,
      provenance: { id: "SNAP-P1-v1" },
    });
    const recompiled = advanceTable(BIG, reviewed, {
      type: "RECOMPILE",
      cardId: NERVOUS_A,
    });
    expect(recompiled.inspecting).toBeNull();
    expect(recompiled.inspections[NERVOUS_A]).toBeUndefined();
    expect(
      validate(recompiled.drafts[NERVOUS_A], v2(), BIG.rulebook).findings
    ).toEqual([]);
    expect(recompiled.drafts[NERVOUS_A].cells[1]).toEqual([
      "1 (20.0)",
      "2 (33.3)",
      "3 (27.3)",
    ]);
  });

  it("leaves another card's open drawer alone", () => {
    const state = play(
      BIG,
      [
        { type: "INSPECT_CARD", cardId: CARDIAC_A },
        { type: "RECOMPILE", cardId: NERVOUS_A },
      ],
      afterEvent()
    );
    expect(state.inspecting).toBe(CARDIAC_A);
    const view = deriveTableView(BIG, state);
    expect(view.inspection).toMatchObject({
      stale: false,
      provenance: { id: "SNAP-P1-v2" },
    });
  });

  it("clears the stale block so the hand can be played", () => {
    const state = play(
      BIG,
      [
        { type: "RECOMPILE", cardId: NERVOUS_A },
        ...select(NERVOUS_A),
        { type: "PLAY_HAND" },
      ],
      afterEvent()
    );
    expect(state.lastEvent?.kind).toBe("PLAYED");
    expect(state.handsPlayed).toBe(2);
  });
});

describe("recovering from the data change", () => {
  /** Inspect every cell of a card and correct everything revealed. */
  function fix(state: TableState, cardId: string): TableState {
    let next = advanceTable(BIG, state, { type: "INSPECT_CARD", cardId });
    const table = deriveTableView(BIG, next).inspection!.table;
    table.rows.forEach((_, row) =>
      table.columns.forEach((__, col) => {
        next = advanceTable(BIG, next, { type: "INSPECT_CELL", row, col });
      })
    );
    for (const f of deriveTableView(BIG, next).inspection!.visibleFindings) {
      next = advanceTable(BIG, next, {
        type: "CORRECT_FINDING",
        findingId: f.id,
      });
    }
    return advanceTable(BIG, next, { type: "CLOSE_INSPECT" });
  }

  it("recovers by sending stale drafts back and flushing fresh ones", () => {
    let state = play(
      BIG,
      [
        ...select(OVERVIEW_A, AE_LISTING, SAE_A, SAE_LISTING, NERVOUS_A),
        { type: "DISCARD" },
      ],
      afterEvent()
    );
    const fresh = [
      CARDIAC_A,
      "C-T14.3.3-B",
      "C-T14.3.2.2-A",
      "C-T14.3.3-C",
      "C-T14.3.1-C",
    ];
    const view = deriveTableView(BIG, state);
    for (const id of fresh) {
      expect(view.hand.find((h) => h.card.id === id)).toMatchObject({
        stale: false,
        provenance: { id: "SNAP-P1-v2" },
      });
    }
    state = fresh.reduce(fix, state);
    state = play(BIG, [...select(...fresh), { type: "PLAY_HAND" }], state);
    expect(state.lastPlay?.classification.handType).toBe("POPULATION_FLUSH");
    expect(state.lastPlay?.evaluation.zeroRule.triggered).toBe(false);
    // 5,100 on fresh v2 outputs; the stale v1 drafts could not be played.
    expect(state.lastPlay?.evaluation.score).toBe(5100);
  });
});

describe("study events", () => {
  it("fire once, after the named hand", () => {
    const second = play(
      BIG,
      [...select(DISCONTINUED), { type: "PLAY_HAND" }],
      afterEvent()
    );
    expect(second.snapshots).toHaveLength(2);
    expect(second.invalidations).toHaveLength(1);
  });

  it("skip a transition that would change nothing", () => {
    const noop: Scenario = {
      ...BIG,
      events: [
        {
          afterHands: 1,
          transition: transition({ populations: ["PER_PROTOCOL"] }),
        },
      ],
    };
    const state = play(noop, [...select(DISPOSITION), { type: "PLAY_HAND" }]);
    expect(state.snapshots).toHaveLength(1);
    expect(state.lastEvent?.message).toBe(
      "High Table scored 80 (40 Chips × 2 Mult). Round 80 of 7500."
    );
  });

  it("announce when nothing in hand goes stale", () => {
    const itt: Scenario = {
      ...DEMOGRAPHICS_SCENARIO,
      events: [
        {
          afterHands: 1,
          transition: transition({
            subjectId: "S-003",
            reason: "PROTOCOL_DEVIATION",
            populations: ["PER_PROTOCOL"],
            description: "S-003 took a prohibited medication.",
          }),
        },
      ],
    };
    const state = play(itt, [...select("C-T14.1.2"), { type: "PLAY_HAND" }]);
    expect(state.lastEvent?.message).toContain(
      "S-003 took a prohibited medication. Per-Protocol population now SNAP-P1-v2. No output in hand is stale."
    );
    expect(state.invalidations[0].staleCardIds).toEqual([]);
  });

  it("are pure: frozen inputs, same actions, same state", () => {
    const actions: TableAction[] = [
      ...select(DISPOSITION),
      { type: "PLAY_HAND" },
      { type: "RECOMPILE", cardId: NERVOUS_A },
      ...select(NERVOUS_A, OVERVIEW_A),
      { type: "DISCARD" },
    ];
    const frozen = deepFreeze(structuredClone(BIG));
    const a = play(frozen, actions);
    const b = play(BIG, actions);
    expect(a).toEqual(b);
  });

  it("restart the Blind from the snapshot it opened on", () => {
    const reset = advanceTable(BIG, afterEvent(), { type: "RESET" });
    expect(reset.snapshots.map((s) => s.id)).toEqual(["SNAP-P1-v1"]);
    expect(reset.invalidations).toEqual([]);
    expect(reset.lastEvent?.kind).toBe("RESET");
  });
});

describe("a stale card cannot make a Population Flush", () => {
  it("is excluded by hand detection", () => {
    const five = [OVERVIEW_A, AE_LISTING, SAE_A, SAE_LISTING, NERVOUS_A].map(
      (id) => BIG.deck.find((c) => c.id === id) as TlfCard
    );
    expect(classifyHand(five)?.handType).toBe("POPULATION_FLUSH");
    expect(
      classifyHand(five.map((c, i) => ({ ...c, stale: i === 4 })))?.handType
    ).toBe("TLF_TWO_PAIR");
  });

  it("names drafts by number and draft letter", () => {
    const byId = (id: string) => BIG.deck.find((c) => c.id === id)!;
    expect(cardShortName(byId(OVERVIEW_B))).toBe("Table 14.3.1 (Draft B)");
    expect(cardShortName(byId(AE_LISTING))).toBe("Listing 16.2.7");
  });
});

describe("the run carries the study's snapshots between Blinds", () => {
  it("deals the committee against v2 and restarts the run on v1", () => {
    const easy = <T extends Scenario>(b: T): T => ({
      ...b,
      blind: { ...b.blind, quota: 1 },
    });
    const quick = {
      ...ACT_I,
      crisisDeck: undefined,
      blinds: ACT_I.blinds.map(easy),
      bossPool: (ACT_I.bossPool ?? []).map(easy),
    };
    const go = (run: ReturnType<typeof createRunState>, ...a: RunAction[]) =>
      a.reduce((r, action) => advanceRun(quick, r, action), run);
    let run = go(
      createRunState(quick),
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-C" },
      { type: "PLAY_HAND" },
      { type: "NEXT_BLIND" },
      { type: "TOGGLE_SELECT", cardId: DISPOSITION },
      { type: "PLAY_HAND" },
      { type: "NEXT_BLIND" }
    );
    expect(run.blindIndex).toBe(2);
    expect(studyHistory(run.table).snapshots.map((s) => s.id)).toEqual([
      "SNAP-P1-v1",
      "SNAP-P1-v2",
    ]);
    expect(run.table.invalidations).toHaveLength(1);
    const view = deriveRunView(quick, run);
    expect(view.table.snapshot.id).toBe("SNAP-P1-v2");
    expect(view.table.hand.some((h) => h.stale)).toBe(false);
    const nervous = run.table.drafts["C-T14.3.2.5-B"];
    expect(nervous.populationSnapshotId).toBe("SNAP-P1-v2");
    expect(nervous.cells[0]).toEqual(["5", "6", "11"]);

    // The Blind's own RESET keeps the history it opened with.
    const reset = advanceTable(quick.bossPool[0], run.table, { type: "RESET" });
    expect(reset.snapshots).toHaveLength(2);

    run = go(run, { type: "RESTART_RUN" });
    expect(run.table.snapshots.map((s) => s.id)).toEqual(["SNAP-P1-v1"]);
    expect(run.table.invalidations).toEqual([]);
  });
});
