import type { AmmoGrantResult, WeaponId } from "@/lib/dungeon";

/** Short tool names for the hotbar and the floating lines. */
export const WEAPON_SHORT_LABELS: Record<WeaponId, string> = {
  npm_install: "npm i",
  git_force_push: "git push -f",
  stack_overflow: "StackOverflow",
  emp_blast: "EMP",
  port_scan: "Port Scan",
  buffer_overflow: "Buffer Overflow",
  zero_day: "0-Day",
  mitm_spoof: "MitM Spoof",
  ransomware_lock: "Ransomware",
};

/** Short tool names for the phone grid, so each fits a 44px key at 9px. */
export const PHONE_TOOL_LABELS: Partial<Record<WeaponId, string>> = {
  npm_install: "npm i",
  git_force_push: "push -f",
  stack_overflow: "Stack",
  port_scan: "Scan",
  buffer_overflow: "Buffer",
  mitm_spoof: "MitM",
  ransomware_lock: "Ransom",
};

/** The tool's short name for a phone toast, such as "Scan" or "EMP". */
export function phoneToolLabel(weaponId: WeaponId): string {
  return (
    PHONE_TOOL_LABELS[weaponId] ?? WEAPON_SHORT_LABELS[weaponId] ?? weaponId
  );
}

/**
 * The floating line for an ammo pickup or purchase, naming what the player's
 * class actually received (#1667).
 */
export function describeAmmoGrants(grants: AmmoGrantResult[]): string {
  const totals = new Map<WeaponId, number>();
  for (const grant of grants) {
    if (grant.weaponId && grant.charges > 0) {
      totals.set(
        grant.weaponId,
        (totals.get(grant.weaponId) ?? 0) + grant.charges
      );
    }
  }
  if (totals.size === 0) {
    return grants.some((grant) => grant.weaponId)
      ? "Ammo already full"
      : "No weapon on this class can use this";
  }
  return Array.from(totals)
    .map(([id, charges]) => `+${charges} ${WEAPON_SHORT_LABELS[id]}`)
    .join(", ");
}
