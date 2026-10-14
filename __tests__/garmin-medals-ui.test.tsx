// Monkey C Mayhem Finisher Medals, Aid Station and secret exit UI (#2025): the
// art draws course medals, the Aid Station flag, the secret pole and the three
// HUD medal slots; the simulator announces each find, touch and secret exit;
// the run-over face tallies the medals; and the field manual covers the rules.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  EMPTY_COURSE,
  MEDAL_SIZE,
  POLE_HEIGHT,
  STAGE_COUNT,
  type CourseLayout,
} from "@/lib/garmin-course";
import { EMPTY_PROPS } from "@/lib/garmin-props";
import { MEDALS_PER_STAGE, medalId } from "@/lib/garmin-medals";
import {
  createInitialState,
  pressAction,
  startGame,
  GROUND_Y,
  PLAYER_X,
  type BonusRoom,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { BASE_HEIGHT } from "@/lib/garmin-powerups";

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return { ...actual, pressAction: vi.fn(actual.pressAction) };
});

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

/** A fitness run on the ground, standing on the lane, at the stage start. */
const onLane = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix"),
  rules: "fitness",
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  gpsMs: 0,
  isGrounded: true,
  playerY: GROUND_Y - BASE_HEIGHT,
  distanceMeters: 0,
  ...over,
});

/** A recording 2D context: every draw call is logged with its arguments. */
function recordingCtx() {
  const trace: string[] = [];
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => {} };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(target, {
      get(t, key: string) {
        if (key in t) return t[key];
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
        }
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return () => gradient;
        }
        return (...args: unknown[]) => {
          trace.push(`${key}(${args.join(",")})`);
        };
      },
      set(t, key: string, value) {
        t[key] = value;
        return true;
      },
    })
  );
  return { ctx, trace };
}

/** The draw trace of one frame of `state`. */
function traceOf(state: GameEngineState) {
  const rec = recordingCtx();
  renderWatchFace(rec.ctx, state);
  return rec.trace;
}

/** Calls to `name` in a trace. */
const callsTo = (trace: string[], name: string) =>
  trace.filter((t) => t.startsWith(`${name}(`));

/** Medal discs are drawn with radius 3.6 arcs, the HUD slots with radius 3. */
const arcsOfRadius = (trace: string[], r: number) =>
  callsTo(trace, "arc").filter((t) => t.split(",")[2] === String(r));

/** A course medal on the lane, ahead of the runner. */
const laneMedal = (id: number) => ({
  id,
  stage: Math.floor(id / 10),
  x: PLAYER_X + 160,
  y: GROUND_Y - 80,
});

/** An Aid Station on the lane, ahead of the runner. */
const aidStation = { x: PLAYER_X + 150, stage: 1 };

afterEach(() => {
  cleanup();
  mockAnnounce.mockClear();
  vi.mocked(pressAction).mockClear();
});

describe("Finisher Medal art (#2025)", () => {
  it("draws one gold medal disc for each course medal, and none without them", () => {
    const without = traceOf(onLane({ course: EMPTY_COURSE }));
    const withOne = traceOf(
      onLane({ course: { ...EMPTY_COURSE, medals: [laneMedal(11)] } })
    );
    const withTwo = traceOf(
      onLane({
        course: {
          ...EMPTY_COURSE,
          medals: [laneMedal(11), { ...laneMedal(12), x: PLAYER_X + 220 }],
        },
      })
    );
    expect(withOne).not.toEqual(without);
    expect(arcsOfRadius(withOne, 3.6).length).toBe(
      arcsOfRadius(without, 3.6).length + 1
    );
    expect(arcsOfRadius(withTwo, 3.6).length).toBe(
      arcsOfRadius(without, 3.6).length + 2
    );
  });

  it("draws the medal inside its MEDAL_SIZE box, the ribbon above the disc", () => {
    const medal = laneMedal(11);
    const trace = traceOf(
      onLane({ course: { ...EMPTY_COURSE, medals: [medal] } })
    );
    // The disc centre sits at the box's middle column, 6.4 px down.
    expect(trace).toContain(
      `arc(${medal.x + MEDAL_SIZE / 2},${medal.y + 6.4},3.6,0,${Math.PI * 2})`
    );
    // The two ribbon tails start at the box's top edge.
    expect(trace).toContain(`fillRect(${medal.x + 2.5},${medal.y},2,4)`);
    expect(trace).toContain(`fillRect(${medal.x + 5.5},${medal.y},2,4)`);
  });

  it("draws a medal brick exactly like a plain brick", () => {
    const block = {
      id: 1,
      x: PLAYER_X + 160,
      y: GROUND_Y - 60,
      kind: "brick" as const,
      used: false,
    };
    const plain = traceOf(
      onLane({
        course: {
          ...EMPTY_COURSE,
          blocks: [{ ...block, contents: "kudos" as const }],
        },
      })
    );
    const medalBrick = traceOf(
      onLane({
        course: {
          ...EMPTY_COURSE,
          blocks: [
            { ...block, contents: "medal" as const, medalId: medalId(1, 1) },
          ],
        },
      })
    );
    expect(medalBrick).toEqual(plain);
  });

  it("draws course medals inside a bonus room too", () => {
    const room = fromAny<BonusRoom, unknown>({
      returnCourse: EMPTY_COURSE,
      returnProps: EMPTY_PROPS,
      returnFoes: [],
    });
    const base = traceOf(onLane({ bonusRoom: room, course: EMPTY_COURSE }));
    const withMedal = traceOf(
      onLane({
        bonusRoom: room,
        course: { ...EMPTY_COURSE, medals: [laneMedal(11)] },
      })
    );
    expect(arcsOfRadius(withMedal, 3.6).length).toBe(
      arcsOfRadius(base, 3.6).length + 1
    );
  });
});

describe("Aid Station art (#2025)", () => {
  const course: CourseLayout = {
    ...EMPTY_COURSE,
    checkpoints: [aidStation],
  };
  const flagDown = `fillRect(${aidStation.x + 16},${GROUND_Y - 19},6,4)`;
  const flagUp = `fillRect(${aidStation.x + 16},${GROUND_Y - 26},6,4)`;

  it("draws the Aid Station table only when the course has a checkpoint", () => {
    const none = traceOf(onLane({ course: EMPTY_COURSE }));
    const station = traceOf(onLane({ course }));
    expect(station).not.toEqual(none);
  });

  it("hangs the flag down until the runner touches the Aid Station", () => {
    const untouched = traceOf(onLane({ course, checkpoint: null }));
    expect(untouched).toContain(flagDown);
    expect(untouched).not.toContain(flagUp);
  });

  it("flies the flag up once the state's checkpoint matches the station", () => {
    const touched = traceOf(
      onLane({ course, checkpoint: { x: aidStation.x, stage: 1 } })
    );
    expect(touched).toContain(flagUp);
    expect(touched).not.toContain(flagDown);
  });

  it("keeps the flag down for an Aid Station of another stage", () => {
    const other = traceOf(
      onLane({ course, checkpoint: { x: aidStation.x, stage: 2 } })
    );
    expect(other).toContain(flagDown);
  });
});

describe("Secret exit pole art (#2025)", () => {
  const pole = { x: PLAYER_X + 150, stage: 1 };
  const top = GROUND_Y - POLE_HEIGHT;

  it("draws a secret pole in its own steel and teal, not like the finish pole", () => {
    const finish = traceOf(
      onLane({ course: { ...EMPTY_COURSE, poles: [pole] } })
    );
    const secret = traceOf(
      onLane({
        course: { ...EMPTY_COURSE, poles: [{ ...pole, secret: true }] },
      })
    );
    expect(secret).not.toEqual(finish);
    // The trail-marker flag flies to the mast's right.
    expect(secret).toContain(`fillRect(${pole.x + 1},${top + 2},10,9)`);
    expect(finish).not.toContain(`fillRect(${pole.x + 1},${top + 2},10,9)`);
  });
});

describe("Medal slots on the HUD (#2025)", () => {
  const fills = (trace: string[]) => callsTo(trace, "fill").length;
  const slotArcs = (trace: string[]) =>
    callsTo(trace, "arc").filter(
      (t) => t.split(",")[1] === "22" && t.split(",")[2] === "3"
    );

  it("draws three slots for the current stage, filled gold only when found", () => {
    const none = traceOf(onLane({ medalsFound: [] }));
    const found = traceOf(onLane({ medalsFound: [medalId(1, 2)] }));
    expect(slotArcs(none).length).toBe(MEDALS_PER_STAGE);
    expect(slotArcs(found).length).toBe(MEDALS_PER_STAGE);
    expect(fills(found)).toBe(fills(none) + 1);
  });

  it("shows only the current stage's medals in the slots", () => {
    const none = traceOf(onLane({ medalsFound: [] }));
    const otherStage = traceOf(onLane({ medalsFound: [medalId(2, 1)] }));
    expect(fills(otherStage)).toBe(fills(none));
  });

  it("places the slots in a row centred above the run clock", () => {
    const trace = traceOf(onLane({ medalsFound: [] }));
    const xs = slotArcs(trace).map((t) => Number(t.split(",")[0].slice(4)));
    const centre = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(centre).toBeCloseTo(140, 5);
    expect(xs.length).toBe(3);
  });

  it("draws the slots in a bonus room too", () => {
    const room = fromAny<BonusRoom, unknown>({
      returnCourse: EMPTY_COURSE,
      returnProps: EMPTY_PROPS,
      returnFoes: [],
    });
    const trace = traceOf(onLane({ bonusRoom: room, medalsFound: [] }));
    expect(slotArcs(trace).length).toBe(MEDALS_PER_STAGE);
  });
});

describe("Run-over face tallies medals (#2025)", () => {
  it("shows the medal total out of 15 and the secret exits on a finished 5K", () => {
    const trace = traceOf(
      onLane({
        gameState: "summary",
        medalsFound: [medalId(1, 1), medalId(2, 3)],
        secretExits: [1],
      })
    );
    const total = STAGE_COUNT * MEDALS_PER_STAGE;
    expect(total).toBe(15);
    expect(trace.some((t) => t.includes("MEDALS 2/15"))).toBe(true);
    expect(trace.some((t) => t.includes("SECRET EXITS 1"))).toBe(true);
  });

  it("leaves out the secret exit line when none was found", () => {
    const trace = traceOf(onLane({ gameState: "summary", secretExits: [] }));
    expect(trace.some((t) => t.includes("SECRET EXITS"))).toBe(false);
    expect(trace.some((t) => t.includes("MEDALS 0/15"))).toBe(true);
  });
});

describe("Finisher Medals in the simulator (#2025)", () => {
  const actionName = "X / Throw Heat Bolt, Cape Spin or Spin Jump Button";
  const clickAction = () =>
    fireEvent.click(screen.getByRole("button", { name: actionName }));

  it("announces a medal found, counted on its stage", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      medalsFound: [medalId(1, 1)],
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).toContain(
      "Finisher medal found, 1 of 3 on this stage."
    );
  });

  it("counts a second medal on the same stage, and does not repeat the first", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      medalsFound: [medalId(1, 1), medalId(1, 3)],
    }));
    render(
      <GarminWatchSimulator
        initialState={onLane({ medalsFound: [medalId(1, 1)] })}
      />
    );
    clickAction();
    expect(announced()).toContain(
      "Finisher medal found, 2 of 3 on this stage."
    );
    expect(announced()).not.toContain("Finisher medal found, 1 of 3");
  });

  it("announces the Aid Station when the checkpoint is first touched", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      checkpoint: { x: PLAYER_X + 40, stage: 1 },
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).toContain(
      "Aid station checkpoint reached. You will restart here."
    );
  });

  it("announces a secret exit once it is recorded", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secretExits: [2],
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).toContain("Secret exit found. Shortcut open.");
  });

  it("does not announce medals the state already holds on mount", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({
          medalsFound: [medalId(1, 1)],
          checkpoint: aidStation,
          secretExits: [1],
        })}
      />
    );
    clickAction();
    expect(announced()).not.toContain("Finisher medal found");
    expect(announced()).not.toContain("Aid station checkpoint reached");
    expect(announced()).not.toContain("Secret exit found");
  });

  it("announces none of the medal lines when nothing changes", () => {
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).not.toContain("Finisher medal found");
    expect(announced()).not.toContain("Aid station checkpoint reached");
    expect(announced()).not.toContain("Secret exit found");
  });

  it("gives the canvas a description with the stage's medal count", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({ medalsFound: [medalId(1, 1), medalId(1, 2)] })}
      />
    );
    const canvas = document.querySelector("canvas");
    expect(canvas?.getAttribute("aria-label")).toContain(
      "Finisher medals: 2 of 3 on this stage."
    );
  });
});

describe("Aid Station, Finisher Medals and Secret Exits in the field manual (#2025)", () => {
  const manual = GAME_MANUALS["garmin-watch"];
  const rule = (title: string) => manual.rules.find((r) => r.title === title);

  it("has a rule for each of the three new systems", () => {
    expect(rule("Aid Station")).toBeDefined();
    expect(rule("Finisher Medals")).toBeDefined();
    expect(rule("Secret Exits")).toBeDefined();
  });

  it("describes the Aid Station's flag, toast and restart", () => {
    const aid = rule("Aid Station");
    expect(aid?.detail).toMatch(/Aid station!/);
    expect(aid?.detail).toMatch(/restart/);
    expect(aid?.detail).toMatch(/flag/);
  });

  it("describes where the medals hide, what they score and the tally", () => {
    const medals = rule("Finisher Medals");
    expect(medals?.detail).toMatch(/PR Board/);
    expect(medals?.detail).toMatch(/bonus room/);
    expect(medals?.detail).toMatch(/500 points/);
    expect(medals?.detail).toMatch(/MEDALS/);
    expect(medals?.detail).toMatch(/out of 15/);
  });

  it("describes the secret pole and the run's record of it", () => {
    const exits = rule("Secret Exits");
    expect(exits?.detail).toMatch(/second finish pole/);
    expect(exits?.detail).toMatch(/SECRET EXITS/);
    expect(exits?.detail).toMatch(/Stage 5 has none/);
  });
});
