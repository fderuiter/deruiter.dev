// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  DMC_MILESTONE_SCENARIO,
  RUN_SAVE_VERSION,
  RunSaveSchema,
  advanceRun,
  createRunState,
  deriveRunView,
  parseRunSave,
  replayRun,
  serializeRun,
  type Act,
  type RunAction,
  type RunLog,
  type RunState,
} from "@/lib/trial-and-error";

const act: Act = { ...ACT_I, crisisDeck: undefined };
const NOW = new Date("2026-09-25T20:00:00Z");

/** Logs moves the way the Card Table does, from a fresh run. */
function logged(
  a: Act,
  seed: string,
  actions: Exclude<RunAction, { type: "RESTART_RUN" }>[]
): { log: RunLog; run: RunState } {
  const log: RunLog = { actId: a.id, seed, actions };
  return { log, run: replayRun(a, log) };
}

/** The Small Blind's opening moves: a supporting pair, selected and played. */
const OPENING: Exclude<RunAction, { type: "RESTART_RUN" }>[] = [
  { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" },
  { type: "TOGGLE_SELECT", cardId: "C-L16.2.4" },
  { type: "PLAY_HAND" },
];

describe("run saves", () => {
  it("round-trips a run mid-Blind to the same hand, CPU, score and draws", () => {
    const { log, run } = logged(act, "save-1", OPENING);
    expect(run.table.handsPlayed).toBe(1);
    const restored = parseRunSave(serializeRun(log, NOW), [act]);
    expect(restored?.act).toBe(act);
    expect(restored?.run).toEqual(run);
    expect(restored?.log).toEqual(log);
  });

  it("clears a selection as recorded moves, so the log still replays", () => {
    const { log } = logged(act, "save-2", [
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" },
    ]);
    const restored = parseRunSave(serializeRun(log, NOW), [act])!;
    expect(restored.run.table.selected).toEqual([]);
    expect(restored.log.actions).toHaveLength(2);
    expect(replayRun(act, restored.log)).toEqual(restored.run);
  });

  it("continues exactly as an uninterrupted run would", () => {
    const { log, run } = logged(act, "save-3", OPENING);
    const restored = parseRunSave(serializeRun(log, NOW), [act])!;
    const more: RunAction[] = [
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.2" },
      { type: "DISCARD" },
    ];
    const after = (from: RunState) =>
      more.reduce((r, a) => advanceRun(act, r, a), from);
    expect(after(restored.run)).toEqual(after(run));
  });

  it("returns null, never throwing, for anything it cannot resume", () => {
    const good = JSON.parse(
      serializeRun(logged(act, "save-4", OPENING).log, NOW)
    );
    const cases: (string | null)[] = [
      null,
      "",
      "{not json",
      "42",
      JSON.stringify({ ...good, version: RUN_SAVE_VERSION + 1 }),
      JSON.stringify({ ...good, version: undefined }),
      JSON.stringify({ ...good, actId: "act-removed" }),
      JSON.stringify({ ...good, actions: [{ type: "TELEPORT" }] }),
      JSON.stringify({ ...good, seed: "has spaces" }),
      JSON.stringify({ ...good, savedAt: "yesterday" }),
    ];
    for (const json of cases) {
      expect(parseRunSave(json, [act])).toBeNull();
    }
  });

  it("offers nothing to resume once the run has ended", () => {
    // Single cards until CPU runs out: the Small Blind is lost.
    let run = createRunState(act, "save-5");
    const actions: Exclude<RunAction, { type: "RESTART_RUN" }>[] = [];
    while (run.table.status === "REVIEWING" && actions.length < 40) {
      for (const action of [
        { type: "TOGGLE_SELECT", cardId: run.table.hand[0] },
        { type: "PLAY_HAND" },
      ] as const) {
        actions.push(action);
        run = advanceRun(act, run, action);
      }
    }
    expect(deriveRunView(act, run).phase).toBe("RUN_FAILED");
    const json = serializeRun({ actId: act.id, seed: "save-5", actions }, NOW);
    expect(parseRunSave(json, [act])).toBeNull();
    // One move earlier, the run was still live and resumable.
    const earlier = serializeRun(
      { actId: act.id, seed: "save-5", actions: actions.slice(0, -2) },
      NOW
    );
    expect(parseRunSave(earlier, [act])).not.toBeNull();
  });

  it("never writes a blinded value: the save holds only the seed and moves", () => {
    const dmc: Act = {
      id: "dmc-only",
      title: "DMC",
      blinds: [DMC_MILESTONE_SCENARIO],
    };
    const start = createRunState(dmc, "blind-1");
    // Treatment arms, the data blinding protects, live in client state...
    expect(JSON.stringify(start)).toContain('"arm":"ACTIVE"');
    const json = serializeRun(
      {
        actId: dmc.id,
        seed: "blind-1",
        actions: [{ type: "TOGGLE_SELECT", cardId: "C-T14.1.1" }],
      },
      NOW
    );
    // ...but never in the save.
    expect(json).not.toContain('"arm"');
    expect(json).not.toContain("83.3");
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(
      ["actId", "actions", "savedAt", "seed", "version"].sort()
    );
  });

  it("refuses to serialize a log the format cannot hold", () => {
    const actions = Array.from(
      { length: 5001 },
      (): Exclude<RunAction, { type: "RESTART_RUN" }> => ({
        type: "CLOSE_INSPECT",
      })
    );
    expect(() =>
      serializeRun({ actId: act.id, seed: "s", actions }, NOW)
    ).toThrow();
  });

  it("replays any logged run identically after a round trip", () => {
    /** Every move worth trying from `run`, so each draw is meaningful. */
    const candidates = (
      run: RunState
    ): Exclude<RunAction, { type: "RESTART_RUN" }>[] => [
      ...run.table.hand.map(
        (cardId): Exclude<RunAction, { type: "RESTART_RUN" }> => ({
          type: "TOGGLE_SELECT",
          cardId,
        })
      ),
      { type: "PLAY_HAND" },
      { type: "DISCARD" },
      { type: "NEXT_BLIND" },
      { type: "CASH_OUT" },
      { type: "REROLL" },
      { type: "BUY", slot: 0 },
      { type: "BUY_PACK", slot: 0 },
      { type: "SKIP_PACK" },
      ...(run.table.crisis
        ? run.table.crisis.choices.map(
            (c): Exclude<RunAction, { type: "RESTART_RUN" }> => ({
              type: "RESOLVE_CRISIS",
              choiceId: c.id,
            })
          )
        : []),
    ];
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9-]{1,12}$/),
        fc.array(fc.nat(), { maxLength: 24 }),
        (seed, picks) => {
          let run = createRunState(ACT_I, seed);
          const actions: Exclude<RunAction, { type: "RESTART_RUN" }>[] = [];
          for (const pick of picks) {
            const options = candidates(run);
            const action = options[pick % options.length];
            actions.push(action);
            run = advanceRun(ACT_I, run, action);
          }
          const log: RunLog = { actId: ACT_I.id, seed, actions };
          const json = serializeRun(log, NOW);
          expect(RunSaveSchema.safeParse(JSON.parse(json)).success).toBe(true);
          const restored = parseRunSave(json, [ACT_I]);
          const phase = deriveRunView(ACT_I, run).phase;
          if (phase === "RUN_FAILED" || phase === "RUN_WON") {
            expect(restored).toBeNull();
            return;
          }
          expect(restored).not.toBeNull();
          expect(replayRun(ACT_I, restored!.log)).toEqual(restored!.run);
          expect(restored!.run.table.selected).toEqual([]);
          const {
            selected: _selected,
            lastEvent: _l1,
            ...rest
          } = restored!.run.table;
          const { selected: _s2, lastEvent: _l2, ...expected } = run.table;
          void _selected;
          void _l1;
          void _s2;
          void _l2;
          expect(rest).toEqual(expected);
          expect(restored!.run.draws).toEqual(run.draws);
        }
      ),
      { numRuns: 40 }
    );
  });
});
