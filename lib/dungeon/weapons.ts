/**
 * Cybersecurity Exploits, Developer Weapons & CVE Synergy Engine
 */

import {
  ActiveSideEffect,
  BossState,
  Enemy,
  ParticleEffect,
  Weapon,
  WeaponId,
} from "./types";

export const DEFAULT_WEAPONS: Record<WeaponId, Weapon> = {
  npm_install: {
    id: "npm_install",
    name: "npm install (Dependency Bloat)",
    keyLabel: "[1]",
    ammo: 12,
    maxAmmo: 12,
    damage: 45,
    cooldownMs: 800,
    description:
      "Throws ball of 100K sub-dependencies in a wide AoE blast. Exposes memory leaks.",
    sideEffect: "Simulates severe memory bloat & lag spike.",
    iconChar: "📦",
    ramCost: 4,
  },
  git_force_push: {
    id: "git_force_push",
    name: "git push --force",
    keyLabel: "[2]",
    ammo: 3,
    maxAmmo: 3,
    damage: 150,
    cooldownMs: 2500,
    description:
      "Vaporizes all standard enemies in the room with an irreversible commit blast.",
    sideEffect: "Rewrites branch history & resets room score multiplier.",
    iconChar: "💥",
    ramCost: 8,
  },
  stack_overflow: {
    id: "stack_overflow",
    name: "Stack Overflow Snippet",
    keyLabel: "[3]",
    ammo: 4,
    maxAmmo: 4,
    damage: 0,
    cooldownMs: 1500,
    description:
      "Instantly injects undocumented code snippet to restore +40 HP.",
    sideEffect:
      "Keybind Desync: Swaps WASD directional controls for 8 seconds.",
    iconChar: "📋",
    ramCost: 6,
  },
  emp_blast: {
    id: "emp_blast",
    name: "EMP / Kernel Panic",
    keyLabel: "[SPACE]",
    ammo: 999,
    maxAmmo: 999,
    damage: 10,
    cooldownMs: 4000,
    description:
      "Fires an electromagnetic pulse that stuns all security drones and sentinels.",
    sideEffect: "Temporary daemon firmware lock.",
    iconChar: "⚡",
    ramCost: 4,
  },
  port_scan: {
    id: "port_scan",
    name: "Nmap Port Recon",
    keyLabel: "[1]",
    ammo: 99,
    maxAmmo: 99,
    damage: 20,
    cooldownMs: 600,
    description:
      "Scans all daemons in sector, exposes hidden CVE vulnerabilities and traps.",
    sideEffect: "High network traffic signature.",
    iconChar: "📡",
    ramCost: 2,
    cveSynergy: "DEFAULT_CREDS",
  },
  buffer_overflow: {
    id: "buffer_overflow",
    name: "Buffer Overflow Exploit",
    keyLabel: "[2]",
    ammo: 8,
    maxAmmo: 8,
    damage: 75,
    cooldownMs: 1200,
    description:
      "AoE memory corruption blast. Deals 2.5x critical damage to BUFFER_OVERFLOW targets.",
    sideEffect: "Memory fragmentation anomaly.",
    iconChar: "💥",
    ramCost: 6,
    cveSynergy: "BUFFER_OVERFLOW",
  },
  zero_day: {
    id: "zero_day",
    name: "Airgap 0-Day Piercer",
    keyLabel: "[3]",
    ammo: 4,
    maxAmmo: 4,
    damage: 220,
    cooldownMs: 2000,
    description:
      "Precision kinetic zero-day payload that punctures firewall barriers.",
    sideEffect: "Zero-Day signature burned in IDS logs.",
    iconChar: "🎯",
    ramCost: 10,
    cveSynergy: "ZERO_DAY",
  },
  mitm_spoof: {
    id: "mitm_spoof",
    name: "MitM Packet Spoof",
    keyLabel: "[4]",
    ammo: 5,
    maxAmmo: 5,
    damage: 30,
    cooldownMs: 1800,
    description:
      "Spoofs ARP/DNS tables, confusing hostile daemons to attack nearby allies.",
    sideEffect: "Packet collision feedback.",
    iconChar: "🔀",
    ramCost: 6,
    cveSynergy: "OUTDATED_TLS",
  },
  ransomware_lock: {
    id: "ransomware_lock",
    name: "Ransomware Encryptor",
    keyLabel: "[5]",
    ammo: 5,
    maxAmmo: 5,
    damage: 60,
    cooldownMs: 2200,
    description:
      "Freezes target in encrypted state and siphons +200 Crypto bounty.",
    sideEffect: "Target filesystem locked.",
    iconChar: "🔒",
    ramCost: 8,
    cveSynergy: "UNAUTHENTICATED_RCE",
  },
};

export interface WeaponFireResult {
  updatedWeapons: Record<WeaponId, Weapon>;
  updatedEnemies: Enemy[];
  updatedBoss?: BossState;
  updatedPlayerHp: number;
  scoreGained: number;
  cryptoGained: number;
  particles: ParticleEffect[];
  activeSideEffect?: ActiveSideEffect;
  message: string;
  success: boolean;
  critTriggered?: boolean;
}

/**
 * Fires a cybersecurity weapon or exploit with damage, CVE multipliers, particles, and side-effects.
 */
export function fireWeapon(
  weaponId: WeaponId,
  weapons: Record<WeaponId, Weapon>,
  playerX: number,
  playerY: number,
  playerHp: number,
  maxPlayerHp: number,
  enemies: Enemy[],
  boss: BossState | undefined,
  nowMs: number,
  currentRam: number = 32
): WeaponFireResult {
  const weapon = weapons[weaponId];
  if (!weapon || weapon.ammo <= 0) {
    return {
      updatedWeapons: weapons,
      updatedEnemies: enemies,
      updatedBoss: boss,
      updatedPlayerHp: playerHp,
      scoreGained: 0,
      cryptoGained: 0,
      particles: [],
      message: `Out of ammo for ${weapon?.name || weaponId}!`,
      success: false,
    };
  }

  const ramCost = weapon.ramCost || 0;
  if (currentRam < ramCost) {
    return {
      updatedWeapons: weapons,
      updatedEnemies: enemies,
      updatedBoss: boss,
      updatedPlayerHp: playerHp,
      scoreGained: 0,
      cryptoGained: 0,
      particles: [],
      message: `Insufficient Cyberdeck RAM! Requires ${ramCost} GB (Have: ${currentRam} GB)`,
      success: false,
    };
  }

  // Deduct ammo
  const nextWeapons = {
    ...weapons,
    [weaponId]: {
      ...weapon,
      ammo: Math.max(0, weapon.ammo - 1),
    },
  };

  const particles: ParticleEffect[] = [];
  let scoreGained = 0;
  let cryptoGained = 0;
  let updatedPlayerHp = playerHp;
  let activeSideEffect: ActiveSideEffect | undefined;
  let message = "";
  let critTriggered = false;

  let updatedEnemies = [...enemies];
  let updatedBoss = boss ? { ...boss } : undefined;

  switch (weaponId) {
    case "port_scan": {
      message =
        "📡 Nmap Port Scan complete! Exposed CVE vulnerabilities in sector.";
      updatedEnemies = updatedEnemies.map((e) => {
        const nextHp = e.hp - weapon.damage;
        return {
          ...e,
          hp: Math.max(1, nextHp),
          cveExposed: true,
          state: "stunned",
          stunTimerMs: 1200,
        };
      });

      for (let i = 0; i < 20; i++) {
        const angle = (i * 2 * Math.PI) / 20;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * 2.5,
          vy: Math.sin(angle) * 2.5,
          color: "#38bdf8",
          alpha: 1,
          decay: 0.03,
          radius: 3,
          char: "SCAN",
        });
      }
      break;
    }

    case "buffer_overflow": {
      const aoeRadius = 4.5;
      message = "💥 Buffer Overflow payload executed! Memory corrupted!";

      activeSideEffect = {
        type: "lag_spike",
        title: "SIGSEGV_CORE_DUMP",
        description: "Memory fragmentation detected. Transient latency spike.",
        expiresAt: nowMs + 3000,
      };

      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 3.0;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#ef4444",
          alpha: 1,
          decay: 0.025,
          radius: 4,
          char: "0xDEADBEEF",
        });
      }

      updatedEnemies = updatedEnemies
        .map((e) => {
          const dist = Math.hypot(e.x - playerX, e.y - playerY);
          if (dist <= aoeRadius) {
            let dmg = weapon.damage;
            if (e.cve === "BUFFER_OVERFLOW" || e.cve === "WEAK_SSH") {
              dmg *= 2.5;
              critTriggered = true;
            }
            const nextHp = e.hp - dmg;
            if (nextHp <= 0) {
              scoreGained += 200;
              cryptoGained += 50;
              return null;
            }
            return {
              ...e,
              hp: nextHp,
              state: "stunned",
              stunTimerMs: 2000,
            };
          }
          return e;
        })
        .filter((e): e is Enemy => e !== null);

      if (updatedBoss && !updatedBoss.defeated) {
        const bossDist = Math.hypot(
          updatedBoss.x - playerX,
          updatedBoss.y - playerY
        );
        if (bossDist <= aoeRadius + 1) {
          const nextBossHp = updatedBoss.hp - weapon.damage;
          if (nextBossHp <= 0) {
            updatedBoss = { ...updatedBoss, hp: 0, defeated: true };
            scoreGained += 1500;
            cryptoGained += 300;
          } else {
            updatedBoss = { ...updatedBoss, hp: nextBossHp };
          }
        }
      }
      break;
    }

    case "zero_day": {
      message =
        "🎯 Airgap 0-Day Exploit injected! Target firewall neutralized!";
      critTriggered = true;

      for (let i = 0; i < 35; i++) {
        const angle = (i * 2 * Math.PI) / 35;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * 4,
          vy: Math.sin(angle) * 4,
          color: "#a855f7",
          alpha: 1,
          decay: 0.02,
          radius: 5,
          char: "0DAY",
        });
      }

      // Eliminate all regular enemies
      scoreGained += updatedEnemies.length * 150;
      cryptoGained += updatedEnemies.length * 40;
      updatedEnemies = [];

      if (updatedBoss && !updatedBoss.defeated) {
        const nextBossHp = updatedBoss.hp - weapon.damage;
        if (nextBossHp <= 0) {
          updatedBoss = { ...updatedBoss, hp: 0, defeated: true };
          scoreGained += 2000;
          cryptoGained += 500;
        } else {
          updatedBoss = { ...updatedBoss, hp: nextBossHp };
        }
      }
      break;
    }

    case "mitm_spoof": {
      message = "🔀 MitM Packet Spoof active! Hostile daemons desynchronized!";
      updatedEnemies = updatedEnemies.map((e) => ({
        ...e,
        state: "confused",
        confusedMs: 6000,
      }));

      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * 2,
          vy: Math.sin(angle) * 2,
          color: "#ec4899",
          alpha: 1,
          decay: 0.03,
          radius: 3,
          char: "SPOOF",
        });
      }
      break;
    }

    case "ransomware_lock": {
      message =
        "🔒 Ransomware Lock engaged! Daemons frozen & crypto harvested!";
      updatedEnemies = updatedEnemies.map((e) => ({
        ...e,
        state: "frozen",
        frozenMs: 5000,
        hp: Math.max(1, e.hp - weapon.damage),
      }));
      cryptoGained += 200;
      scoreGained += 300;
      break;
    }

    case "npm_install": {
      const aoeRadius = 4.5;
      message = "📦 npm install executed! 100,000 node_modules hurled!";

      activeSideEffect = {
        type: "lag_spike",
        title: "DEPENDENCY_BLOAT.LOG",
        description:
          "Resolving 84,219 transitive dependencies... frame latency elevated.",
        expiresAt: nowMs + 4000,
      };

      const chars = [
        "node_modules",
        "left-pad",
        "is-even",
        "lodash",
        "babel",
        "webpack",
      ];
      for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2.5;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#f59e0b",
          alpha: 1,
          decay: 0.03,
          radius: 4,
          char: chars[i % chars.length],
        });
      }

      updatedEnemies = updatedEnemies
        .map((e) => {
          const dist = Math.hypot(e.x - playerX, e.y - playerY);
          if (dist <= aoeRadius) {
            const nextHp = e.hp - weapon.damage;
            if (nextHp <= 0) {
              scoreGained += 150;
              cryptoGained += 25;
              return null;
            }
            return {
              ...e,
              hp: nextHp,
              state: "stunned",
              stunTimerMs: 2500,
            };
          }
          return e;
        })
        .filter((e): e is Enemy => e !== null);

      if (updatedBoss && !updatedBoss.defeated) {
        const bossDist = Math.hypot(
          updatedBoss.x - playerX,
          updatedBoss.y - playerY
        );
        if (bossDist <= aoeRadius + 1) {
          const nextBossHp = updatedBoss.hp - weapon.damage;
          if (nextBossHp <= 0) {
            updatedBoss = { ...updatedBoss, hp: 0, defeated: true };
            scoreGained += 1000;
            cryptoGained += 200;
          } else {
            updatedBoss = { ...updatedBoss, hp: nextBossHp };
          }
        }
      }
      break;
    }

    case "git_force_push": {
      message = "💥 git push --force: Room history obliterated!";

      activeSideEffect = {
        type: "history_rewritten",
        title: "FORCE_PUSH_EXECUTED",
        description:
          "Branch history rewritten. Upstream refs permanently desynchronized.",
        expiresAt: nowMs + 5000,
      };

      for (let i = 0; i < 40; i++) {
        const angle = (i * 2 * Math.PI) / 40;
        const speed = 1.0 + Math.random() * 3.5;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#ef4444",
          alpha: 1,
          decay: 0.02,
          radius: 6,
          char: "FORCE",
        });
      }

      scoreGained += updatedEnemies.length * 100;
      cryptoGained += updatedEnemies.length * 20;
      updatedEnemies = [];

      if (updatedBoss && !updatedBoss.defeated) {
        const nextBossHp = updatedBoss.hp - weapon.damage;
        if (nextBossHp <= 0) {
          updatedBoss = { ...updatedBoss, hp: 0, defeated: true };
          scoreGained += 1000;
          cryptoGained += 200;
        } else {
          updatedBoss = { ...updatedBoss, hp: nextBossHp };
        }
      }
      break;
    }

    case "stack_overflow": {
      const healAmount = 40;
      updatedPlayerHp = Math.min(maxPlayerHp, playerHp + healAmount);
      message = `📋 Stack Overflow code applied: +${healAmount} HP!`;

      activeSideEffect = {
        type: "scrambled_keys",
        title: "KEYBIND_DESYNC_WARNING",
        description:
          "Copied untested code from 2011! Directional keybindings are inverted!",
        expiresAt: nowMs + 8000,
      };

      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#10b981",
          alpha: 1,
          decay: 0.04,
          radius: 4,
          char: "+HP",
        });
      }
      break;
    }

    case "emp_blast": {
      message = "⚡ EMP shockwave stunned all active security drones!";
      updatedEnemies = updatedEnemies.map((e) => ({
        ...e,
        state: "stunned",
        stunTimerMs: 4000,
      }));

      for (let i = 0; i < 30; i++) {
        const angle = (i * 2 * Math.PI) / 30;
        particles.push({
          x: playerX,
          y: playerY,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          color: "#38bdf8",
          alpha: 1,
          decay: 0.03,
          radius: 3,
          char: "EMP",
        });
      }
      break;
    }
  }

  return {
    updatedWeapons: nextWeapons,
    updatedEnemies,
    updatedBoss,
    updatedPlayerHp,
    scoreGained,
    cryptoGained,
    particles,
    activeSideEffect,
    message,
    success: true,
    critTriggered,
  };
}

/**
 * Weapons that damage a boss, in the order a converted ammo grant prefers
 * them. Port Scan, EMP, MitM Spoof, Ransomware Lock and Stack Overflow do no
 * boss damage.
 */
export const BOSS_DAMAGE_WEAPON_IDS: readonly WeaponId[] = [
  "zero_day",
  "git_force_push",
  "buffer_overflow",
  "npm_install",
];

/** What an ammo pickup or purchase actually gave the player. */
export interface AmmoGrantResult {
  updatedWeapons: Record<WeaponId, Weapon>;
  /** The weapon that received the charges, or null when none could. */
  weaponId: WeaponId | null;
  /** Charges added, after any conversion and cap. */
  charges: number;
}

/**
 * Gives ammo the player's class can fire (#1667).
 *
 * A grant for a weapon on the class's hotbar goes to that weapon. Otherwise
 * it converts to the class's first boss-damaging hotbar weapon, with enough
 * charges to deal at least the same damage. When the class carries no such
 * weapon, nothing changes and `weaponId` is null.
 *
 * @param weapons - The player's current weapons.
 * @param loadout - The class's hotbar weapons, in key order.
 * @param grantedId - The weapon the pickup or purchase is for.
 * @param charges - Charges of `grantedId` it grants.
 * @param capAtMax - Whether the result is capped at the weapon's `maxAmmo`.
 * @returns The new weapons, which weapon got the ammo, and how much.
 */
export function grantAmmoForLoadout(
  weapons: Record<WeaponId, Weapon>,
  loadout: readonly WeaponId[],
  grantedId: WeaponId,
  charges: number,
  capAtMax: boolean
): AmmoGrantResult {
  let targetId: WeaponId | null = null;
  let targetCharges = charges;

  if (loadout.includes(grantedId)) {
    targetId = grantedId;
  } else {
    targetId =
      loadout.find((id) => BOSS_DAMAGE_WEAPON_IDS.includes(id)) ?? null;
    if (targetId) {
      const grantedDamage = (weapons[grantedId]?.damage ?? 0) * charges;
      const targetDamage = weapons[targetId]?.damage ?? 0;
      targetCharges =
        targetDamage > 0 ? Math.ceil(grantedDamage / targetDamage) : 0;
    }
  }

  const target = targetId ? weapons[targetId] : undefined;
  if (!targetId || !target || targetCharges <= 0) {
    return { updatedWeapons: weapons, weaponId: null, charges: 0 };
  }

  const nextAmmo = capAtMax
    ? Math.min(target.maxAmmo, target.ammo + targetCharges)
    : target.ammo + targetCharges;
  return {
    updatedWeapons: {
      ...weapons,
      [targetId]: { ...target, ammo: nextAmmo },
    },
    weaponId: targetId,
    charges: nextAmmo - target.ammo,
  };
}
