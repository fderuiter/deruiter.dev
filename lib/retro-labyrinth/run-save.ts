import {
  CYBERDECK_CLASSES,
  DEFAULT_WEAPONS,
  RUN_PASSIVES,
  type CyberdeckClassId,
  type FirmwareTiers,
  type RunBuild,
  type RunPassiveId,
  type WeaponId,
} from "@/lib/dungeon";
import {
  safeGetRawItem,
  safeRemoveItem,
  safeSetRawItem,
} from "@/lib/safe-storage";

/**
 * The saved Retro Labyrinth run (#3460, part of #2381): enough to restart
 * the current room of an unfinished run on the next launch.
 */

/** Storage key of the run save. A new schema gets a new key and version. */
export const RUN_SAVE_KEY = "retro_labyrinth_run_v1";

/** Schema version written with every save. */
export const RUN_SAVE_VERSION = 1;

/** One unfinished run, as saved at a room boundary. */
export interface RetroLabyrinthRunSave {
  readonly version: typeof RUN_SAVE_VERSION;
  /** The run seed, such as "LAB-3F9K2Q". */
  readonly seed: string;
  /** Room-library positions entered so far; the last is the current room. */
  readonly route: readonly number[];
  /** Position of the current room in `route`. */
  readonly roomIndex: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly ram: number;
  readonly maxRam: number;
  readonly crypto: number;
  /** Ammo left for each tool that has any tracked. */
  readonly ammo: Readonly<Partial<Record<WeaponId, number>>>;
  /** The weapons and passives the run's rewards added to the class tools. */
  readonly loadout: RunBuild;
  readonly classId: CyberdeckClassId;
  readonly activeWeaponId: WeaponId;
  /** Firmware tiers active for this run. */
  readonly firmware: FirmwareTiers;
  readonly score: number;
  /** Run time so far, in milliseconds. */
  readonly elapsedMs: number;
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIndex(value: unknown): value is number {
  return isCount(value) && Number.isInteger(value);
}

function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === "string" && Object.hasOwn(DEFAULT_WEAPONS, value);
}

function isPassiveId(value: unknown): value is RunPassiveId {
  return typeof value === "string" && Object.hasOwn(RUN_PASSIVES, value);
}

function isClassId(value: unknown): value is CyberdeckClassId {
  return typeof value === "string" && Object.hasOwn(CYBERDECK_CLASSES, value);
}

const FIRMWARE_FIELDS = [
  "maxRamTier",
  "scanSpeedTier",
  "exploitRadiusTier",
  "startChipsTier",
] as const;

function isFirmware(value: unknown): value is FirmwareTiers {
  return isRecord(value) && FIRMWARE_FIELDS.every((f) => isIndex(value[f]));
}

function isLoadout(value: unknown): value is RunBuild {
  return (
    isRecord(value) &&
    Array.isArray(value.bonusWeapons) &&
    value.bonusWeapons.every(isWeaponId) &&
    Array.isArray(value.passives) &&
    value.passives.every(isPassiveId)
  );
}

function isAmmo(value: unknown): value is RetroLabyrinthRunSave["ammo"] {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([id, count]) => isWeaponId(id) && isCount(count)
    )
  );
}

/** Whether a parsed value is a complete save of the current version. */
function isRunSave(value: unknown): value is RetroLabyrinthRunSave {
  if (!isRecord(value) || value.version !== RUN_SAVE_VERSION) return false;
  const route = value.route;
  return (
    typeof value.seed === "string" &&
    Array.isArray(route) &&
    route.length > 0 &&
    route.every(isIndex) &&
    isIndex(value.roomIndex) &&
    value.roomIndex < route.length &&
    isCount(value.hp) &&
    isCount(value.maxHp) &&
    isCount(value.ram) &&
    isCount(value.maxRam) &&
    isCount(value.crypto) &&
    isAmmo(value.ammo) &&
    isLoadout(value.loadout) &&
    isClassId(value.classId) &&
    isWeaponId(value.activeWeaponId) &&
    isFirmware(value.firmware) &&
    isCount(value.score) &&
    isCount(value.elapsedMs)
  );
}

/**
 * Saves the run, replacing any earlier save. The save is kept only in
 * localStorage, never in memory, so blocked storage leaves no save at all
 * rather than one that vanishes on reload.
 *
 * @param run - The run to save, without its version.
 * @returns true when the save reached localStorage.
 */
export function saveRun(run: Omit<RetroLabyrinthRunSave, "version">): boolean {
  const record: RetroLabyrinthRunSave = { ...run, version: RUN_SAVE_VERSION };
  return safeSetRawItem(RUN_SAVE_KEY, JSON.stringify(record), {
    retainInMemory: false,
  });
}

/**
 * Reads the saved run. Missing storage, corrupt JSON, another version and a
 * missing or malformed field all read as no save; it never throws.
 *
 * @returns The saved run, or null when there is none to trust.
 */
export function loadRun(): RetroLabyrinthRunSave | null {
  const raw = safeGetRawItem(RUN_SAVE_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRunSave(value) ? value : null;
}

/** Removes the saved run, if any. */
export function clearRun(): void {
  safeRemoveItem(RUN_SAVE_KEY);
}
