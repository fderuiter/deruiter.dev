/**
 * The reward pick after each roguelike room (#2084): one of a weapon, a heal
 * or a passive. Offers are drawn from the run seed, so a seed reproduces them,
 * and what the player picks builds up in a {@link RunBuild} that lasts the run.
 */

import { drawInt } from "@/lib/utils/prng";
import type { WeaponId } from "./types";
import { DEFAULT_WEAPONS } from "./weapons";

/** Tool slots in a loadout: three class tools and two picked up on the route. */
export const RUN_LOADOUT_SLOTS = 5;

/** HP a heal reward restores, capped at max HP. */
export const REWARD_HEAL_HP = 40;

/**
 * Weapons a reward can offer. EMP is left out: Space fires it for every class.
 */
export const REWARD_WEAPON_POOL: readonly WeaponId[] = [
  "npm_install",
  "port_scan",
  "git_force_push",
  "stack_overflow",
  "buffer_overflow",
  "zero_day",
  "mitm_spoof",
  "ransomware_lock",
];

/** The passives a reward can offer. */
export type RunPassiveId =
  "overclocked_bus" | "chip_cache" | "hardened_shell" | "ram_bank";

/** A passive bonus that lasts the rest of the run and stacks with itself. */
export interface RunPassive {
  readonly id: RunPassiveId;
  readonly name: string;
  readonly description: string;
  /** Extra RAM regained per step. */
  readonly ramRegen?: number;
  /** Extra max HP, also healed when picked. */
  readonly maxHp?: number;
  /** Extra max RAM, also filled when picked. */
  readonly maxRam?: number;
  /** Bypass chips granted on entering each later room. */
  readonly chipsPerRoom?: number;
}

/** Every passive, as data. */
export const RUN_PASSIVES: Readonly<Record<RunPassiveId, RunPassive>> = {
  overclocked_bus: {
    id: "overclocked_bus",
    name: "Overclocked Bus",
    description: "+1 RAM regen on every step.",
    ramRegen: 1,
  },
  chip_cache: {
    id: "chip_cache",
    name: "Chip Cache",
    description: "+1 bypass chip on entering each room.",
    chipsPerRoom: 1,
  },
  hardened_shell: {
    id: "hardened_shell",
    name: "Hardened Shell",
    description: "+20 max HP, and 20 HP now.",
    maxHp: 20,
  },
  ram_bank: {
    id: "ram_bank",
    name: "DDR5 Bank",
    description: "+16 max RAM, filled now.",
    maxRam: 16,
  },
};

const PASSIVE_IDS = Object.keys(RUN_PASSIVES) as RunPassiveId[];

/**
 * One reward card. A weapon reward adds a tool to the loadout at full ammo;
 * when the loadout is full it refills every tool instead (`weaponId` null).
 */
export type RunReward =
  | {
      readonly kind: "weapon";
      readonly weaponId: WeaponId | null;
      readonly name: string;
      readonly description: string;
    }
  | {
      readonly kind: "heal";
      readonly hp: number;
      readonly name: string;
      readonly description: string;
    }
  | {
      readonly kind: "passive";
      readonly passiveId: RunPassiveId;
      readonly name: string;
      readonly description: string;
    };

/** What the run's rewards have added to the class loadout. */
export interface RunBuild {
  /** Weapons picked on the route, in slot order after the class tools. */
  readonly bonusWeapons: readonly WeaponId[];
  /** Passives picked, one entry per pick; a passive picked twice stacks. */
  readonly passives: readonly RunPassiveId[];
}

/** A run before any reward. */
export const EMPTY_RUN_BUILD: RunBuild = { bonusWeapons: [], passives: [] };

/**
 * The run's tools in slot order: the class tools, then the route weapons, up
 * to {@link RUN_LOADOUT_SLOTS}.
 *
 * @param starterWeapons - The class's starter tools.
 * @param build - The run build.
 * @returns The loadout.
 */
export function runLoadout(
  starterWeapons: readonly WeaponId[],
  build: RunBuild
): WeaponId[] {
  const loadout: WeaponId[] = [];
  for (const id of [...starterWeapons, ...build.bonusWeapons]) {
    if (!loadout.includes(id) && loadout.length < RUN_LOADOUT_SLOTS) {
      loadout.push(id);
    }
  }
  return loadout;
}

/** Bonuses the run's passives add up to. */
export interface RunBuildBonuses {
  readonly ramRegen: number;
  readonly maxHp: number;
  readonly maxRam: number;
  readonly chipsPerRoom: number;
}

/**
 * Totals the run's passives.
 *
 * @param build - The run build.
 * @returns The summed bonuses.
 */
export function runBuildBonuses(build: RunBuild): RunBuildBonuses {
  return build.passives.reduce<RunBuildBonuses>(
    (sum, id) => {
      const p = RUN_PASSIVES[id];
      return {
        ramRegen: sum.ramRegen + (p.ramRegen ?? 0),
        maxHp: sum.maxHp + (p.maxHp ?? 0),
        maxRam: sum.maxRam + (p.maxRam ?? 0),
        chipsPerRoom: sum.chipsPerRoom + (p.chipsPerRoom ?? 0),
      };
    },
    { ramRegen: 0, maxHp: 0, maxRam: 0, chipsPerRoom: 0 }
  );
}

/**
 * The three rewards offered after a room: a weapon, a heal and a passive, in
 * that order. The weapon is one the loadout does not carry; a full loadout is
 * offered a refill instead.
 *
 * @param seed - The run seed.
 * @param step - The zero-based run position of the room just cleared.
 * @param loadout - The current loadout.
 * @returns The weapon, heal and passive cards.
 */
export function drawRunRewards(
  seed: string,
  step: number,
  loadout: readonly WeaponId[]
): [RunReward, RunReward, RunReward] {
  const drawSeed = `${seed}|reward|${step}`;
  const unowned = REWARD_WEAPON_POOL.filter((id) => !loadout.includes(id));
  let weapon: RunReward;
  if (loadout.length < RUN_LOADOUT_SLOTS && unowned.length > 0) {
    const weaponId = unowned[drawInt(drawSeed, 0, unowned.length)];
    const spec = DEFAULT_WEAPONS[weaponId];
    weapon = {
      kind: "weapon",
      weaponId,
      name: spec.name,
      description: `New tool in slot ${loadout.length + 1}, ${spec.maxAmmo} ammo.`,
    };
  } else {
    weapon = {
      kind: "weapon",
      weaponId: null,
      name: "Ammo Cache",
      description: "Refill every tool in your loadout.",
    };
  }
  const passive =
    RUN_PASSIVES[PASSIVE_IDS[drawInt(drawSeed, 1, PASSIVE_IDS.length)]];
  return [
    weapon,
    {
      kind: "heal",
      hp: REWARD_HEAL_HP,
      name: "Patch Kit",
      description: `Restore ${REWARD_HEAL_HP} HP.`,
    },
    {
      kind: "passive",
      passiveId: passive.id,
      name: passive.name,
      description: passive.description,
    },
  ];
}

/**
 * The build after taking a reward. A heal or a refill is spent at once and
 * leaves the build as it was.
 *
 * @param build - The run build.
 * @param reward - The reward taken.
 * @returns The new build.
 */
export function applyRunReward(build: RunBuild, reward: RunReward): RunBuild {
  if (reward.kind === "weapon" && reward.weaponId) {
    if (build.bonusWeapons.includes(reward.weaponId)) return build;
    return { ...build, bonusWeapons: [...build.bonusWeapons, reward.weaponId] };
  }
  if (reward.kind === "passive") {
    return { ...build, passives: [...build.passives, reward.passiveId] };
  }
  return build;
}
