// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOON_INVULNERABLE_MS,
  LOON_MAX_HITS,
  resolveLoonCollision,
  spawnTarget,
  updateTargetsPosition,
  type Target,
} from "@/lib/laser-loon";

function makeTarget(overrides: Partial<Target> = {}): Target {
  return {
    id: 1,
    x: 120,
    y: 180,
    vx: -1,
    vy: 0,
    radius: 20,
    type: "mosquito",
    label: "Laser Mosquito",
    color: "#ef4444",
    hp: 1,
    maxHp: 1,
    points: 10,
    pulsePhase: 0,
    frozenTimer: 0,
    ...overrides,
  } as Target;
}

const base = {
  loonX: 120,
  loonY: 180,
  hitsLeft: LOON_MAX_HITS,
  invulnerableUntil: 0,
  now: 10_000,
  shielded: false,
};

describe("resolveLoonCollision (#1186)", () => {
  it("costs a hit, knocks the enemy out and starts the blink", () => {
    const result = resolveLoonCollision({ ...base, targets: [makeTarget()] });
    expect(result.outcome).toBe("hit");
    expect(result.hitsLeft).toBe(LOON_MAX_HITS - 1);
    expect(result.targets).toHaveLength(0);
    expect(result.invulnerableUntil).toBe(base.now + LOON_INVULNERABLE_MS);
  });

  it("ignores enemies that are not touching the loon", () => {
    const result = resolveLoonCollision({
      ...base,
      targets: [makeTarget({ x: 400 })],
    });
    expect(result.outcome).toBe("none");
    expect(result.hitsLeft).toBe(LOON_MAX_HITS);
    expect(result.targets).toHaveLength(1);
  });

  it("lets enemies pass through while the loon is blinking", () => {
    const targets = [makeTarget()];
    const result = resolveLoonCollision({
      ...base,
      targets,
      invulnerableUntil: base.now + 1,
    });
    expect(result.outcome).toBe("none");
    expect(result.hitsLeft).toBe(LOON_MAX_HITS);
    expect(result.targets).toBe(targets);
  });

  it("lets the Pronto Pup shield absorb the hit", () => {
    const result = resolveLoonCollision({
      ...base,
      targets: [makeTarget()],
      shielded: true,
    });
    expect(result.outcome).toBe("blocked");
    expect(result.hitsLeft).toBe(LOON_MAX_HITS);
    expect(result.targets).toHaveLength(0);
  });

  it("treats frozen enemies as harmless ice", () => {
    const result = resolveLoonCollision({
      ...base,
      targets: [makeTarget({ frozenTimer: 30 })],
    });
    expect(result.outcome).toBe("none");
  });

  it("keeps a boss on the field after it hits the loon", () => {
    const boss = makeTarget({ isBoss: true, radius: 45, hp: 40, maxHp: 40 });
    const result = resolveLoonCollision({ ...base, targets: [boss] });
    expect(result.outcome).toBe("hit");
    expect(result.targets).toEqual([boss]);
  });

  it("does nothing once the loon has no hits left", () => {
    const result = resolveLoonCollision({
      ...base,
      targets: [makeTarget()],
      hitsLeft: 0,
    });
    expect(result.outcome).toBe("none");
    expect(result.hitsLeft).toBe(0);
  });
});

describe("Laser Loon campaign can be lost (#1186)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function seedRandom(seed: number) {
    let state = seed >>> 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    });
  }

  // Mirrors the Act 1 loop in components/LaserLoon.tsx at 60 FPS (dt = 1).
  function playAct1Idle(maxSeconds: number) {
    let targets: Target[] = [];
    let nextId = 1;
    let hitsLeft = LOON_MAX_HITS;
    let invulnerableUntil = 0;
    for (let frame = 0; frame < maxSeconds * 60; frame++) {
      const now = (frame * 1000) / 60;
      if (targets.length < 5 && Math.random() < 0.032) {
        ({ updatedTargets: targets, nextId } = spawnTarget(
          targets,
          nextId,
          768,
          420,
          undefined,
          1
        ));
      }
      targets = updateTargetsPosition(targets, 1, "campaign", 0, 420, 768);
      const result = resolveLoonCollision({
        targets,
        loonX: 120,
        loonY: 180,
        hitsLeft,
        invulnerableUntil,
        now,
        shielded: false,
      });
      ({ targets, hitsLeft, invulnerableUntil } = result);
      if (hitsLeft === 0) return { lost: true, seconds: now / 1000 };
    }
    return { lost: false, seconds: maxSeconds };
  }

  it.each([1, 7, 42, 1234, 99991])(
    "an idle loon loses Act 1 within two minutes (seed %i)",
    (seed) => {
      seedRandom(seed);
      expect(playAct1Idle(120).lost).toBe(true);
    }
  );
});
