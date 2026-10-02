// @vitest-environment node
// #1313: bosses hovered at the far edge and never attacked, and minions
// stopped spawning, so each act's boss fight was its easiest part.
import { describe, it, expect } from "vitest";
import {
  spawnBossForAct,
  updateBossAttack,
  getBossAttackInterval,
  isBossTelegraphing,
  updateTargetsPosition,
  resolveLoonCollision,
  classifyCampaignKill,
  BOSS_TELEGRAPH_FRAMES,
  BOSS_FIRST_VOLLEY_FRAMES,
  type Target,
} from "@/lib/laser-loon";

const LOON = { x: 120, y: 210 };

function runUntilVolley(targets: Target[], act: number, maxFrames = 1000) {
  let state = { targets, nextId: 100 };
  for (let frame = 1; frame <= maxFrames; frame++) {
    const r = updateBossAttack(
      state.targets,
      1,
      LOON.x,
      LOON.y,
      act,
      state.nextId
    );
    state = { targets: r.targets, nextId: r.nextId };
    if (r.fired) return { frame, targets: r.targets };
  }
  return { frame: -1, targets: state.targets };
}

describe("Laser Loon boss attacks (#1313)", () => {
  it("fires later-act volleys sooner, and sooner again in phase 2", () => {
    expect(getBossAttackInterval(1)).toBeGreaterThan(getBossAttackInterval(4));
    expect(getBossAttackInterval(2, 2)).toBeLessThan(getBossAttackInterval(2));
  });

  it("winds up visibly before a volley leaves", () => {
    const { boss } = spawnBossForAct(1, 1);
    const interval = getBossAttackInterval(1);
    expect(
      isBossTelegraphing(
        { ...boss, specialAttackTimer: interval - BOSS_TELEGRAPH_FRAMES - 1 },
        1
      )
    ).toBe(false);
    expect(
      isBossTelegraphing(
        { ...boss, specialAttackTimer: interval - BOSS_TELEGRAPH_FRAMES },
        1
      )
    ).toBe(true);
  });

  it("fires a volley aimed at the loon on schedule", () => {
    const { boss } = spawnBossForAct(1, 1);
    const { frame, targets } = runUntilVolley([boss], 1);
    expect(frame).toBe(BOSS_FIRST_VOLLEY_FRAMES);

    // Later volleys wait the full interval
    const next = runUntilVolley(
      targets.filter((t) => !t.isProjectile),
      1
    );
    expect(next.frame).toBe(getBossAttackInterval(1));

    const shots = targets.filter((t) => t.isProjectile);
    expect(shots).toHaveLength(1);
    // Heads left, toward the loon
    expect(shots[0].vx).toBeLessThan(0);
  });

  it("adds shots in later acts and in phase 2", () => {
    const act3 = spawnBossForAct(3, 1).boss;
    expect(
      runUntilVolley([act3], 3).targets.filter((t) => t.isProjectile)
    ).toHaveLength(2);

    const hurt = { ...spawnBossForAct(3, 1).boss };
    hurt.hp = Math.floor(hurt.maxHp / 2);
    const r = updateBossAttack([hurt], 1, LOON.x, LOON.y, 3, 100);
    expect(r.enteredPhaseTwo).toBe(true);
    expect(
      runUntilVolley(r.targets, 3).targets.filter((t) => t.isProjectile)
    ).toHaveLength(3);
  });

  it("holds fire while the boss is frozen", () => {
    const boss = { ...spawnBossForAct(1, 1).boss, frozenTimer: 10_000 };
    expect(runUntilVolley([boss], 1, 600).frame).toBe(-1);
  });

  it("lets a volley shot reach the loon and cost a hit", () => {
    const { boss } = spawnBossForAct(1, 1);
    let targets = runUntilVolley([boss], 1).targets;
    let hit = false;
    for (let frame = 0; frame < 600 && !hit; frame++) {
      targets = updateTargetsPosition(targets, 1, "campaign", 0);
      const contact = resolveLoonCollision({
        targets,
        loonX: LOON.x,
        loonY: LOON.y,
        hitsLeft: 3,
        invulnerableUntil: 0,
        now: 1,
        shielded: false,
      });
      if (contact.outcome === "hit") {
        hit = true;
        expect(contact.hitsLeft).toBe(2);
      }
    }
    expect(hit).toBe(true);
  });

  it("clears shots that leave the playfield", () => {
    const shot: Target = {
      id: 1,
      x: 10,
      y: 200,
      vx: -20,
      vy: 0,
      radius: 9,
      type: spawnBossForAct(1, 1).boss.type,
      label: "",
      color: "#fff",
      hp: 1,
      maxHp: 1,
      points: 5,
      pulsePhase: 0,
      frozenTimer: 0,
      isProjectile: true,
    };
    let targets = [shot];
    for (let i = 0; i < 10; i++) {
      targets = updateTargetsPosition(targets, 1, "campaign", 0);
    }
    expect(targets).toHaveLength(0);
  });

  it("gives no act kill for shooting down a volley", () => {
    expect(classifyCampaignKill({ isProjectile: true }, 1)).toBe("no-credit");
  });
});
