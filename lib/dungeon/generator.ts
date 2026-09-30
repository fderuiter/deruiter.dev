/**
 * Procedural Dungeon & Cybersecurity Themed Room Generator
 */

import { createFaceForgeBoss, createNeuralWardenBoss } from "./boss";
import {
  DungeonRoom,
  Enemy,
  ItemPickup,
  TSPMovingWall,
  TSPNode,
} from "./types";

export const STAGE_1_MAZE: string[][] = [
  ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ["#", "P", " ", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#"],
  ["#", "#", "#", " ", "#", " ", "#", "#", "#", "#", "#", " ", "#", " ", "#"],
  ["#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#", " ", "#"],
  ["#", " ", "#", "#", "#", "#", "#", "#", "#", " ", "#", " ", "#", " ", "#"],
  ["#", " ", "#", " ", " ", " ", " ", " ", "#", " ", "#", " ", "#", " ", "#"],
  ["#", " ", "#", " ", "#", "#", "#", " ", "#", " ", "#", " ", "#", " ", "#"],
  ["#", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", " ", "#", "E", "#"],
  ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
];

export const STAGE_2_MAZE: string[][] = [
  ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ["#", "P", " ", " ", " ", "#", " ", " ", " ", "#", " ", " ", " ", " ", "#"],
  ["#", " ", "#", "#", " ", "#", " ", "#", " ", "#", " ", "#", "#", " ", "#"],
  ["#", " ", "#", " ", " ", " ", " ", "#", " ", " ", " ", " ", "#", " ", "#"],
  ["#", " ", "#", " ", "#", "#", " ", "#", " ", "#", "#", " ", "#", " ", "#"],
  ["#", " ", " ", " ", "#", " ", " ", " ", " ", " ", "#", " ", " ", " ", "#"],
  ["#", "#", "#", " ", "#", " ", "#", "#", "#", " ", "#", " ", "#", "#", "#"],
  ["#", " ", " ", " ", " ", " ", "#", " ", " ", " ", "#", " ", " ", "E", "#"],
  ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
];

/**
 * Creates Security Tier 1: DMZ Gateway (Subnet 01)
 */
export function generateDMZGatewayRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", " ", "#", " ", "#", "#", "#", "#", "#", " ", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#", " ", "#"],
    ["#", " ", "#", "#", "#", "#", "#", "#", "#", " ", "#", " ", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", "#", " ", "#", " ", "#", " ", "#"],
    ["#", " ", "#", " ", "#", "#", "#", " ", "#", " ", "#", " ", "#", " ", "#"],
    ["#", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", " ", "#", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const enemies: Enemy[] = [
    {
      id: "dmz-drone-1",
      type: "drone",
      name: "Perimeter Port Sniffer",
      x: 7,
      y: 1,
      hp: 40,
      maxHp: 40,
      state: "patrol",
      patrolDir: "right",
      minX: 5,
      maxX: 12,
      symbol: "D",
      color: "#38bdf8",
      cve: "DEFAULT_CREDS",
    },
    {
      id: "dmz-zombie-1",
      type: "zombie",
      name: "Script Kiddie Bot",
      x: 1,
      y: 5,
      hp: 35,
      maxHp: 35,
      state: "patrol",
      patrolDir: "down",
      minY: 3,
      maxY: 7,
      symbol: "Z",
      color: "#f59e0b",
      cve: "WEAK_SSH",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-ram-1",
      itemId: "ram_expansion",
      name: "16GB Overclocked RAM (+16 Max RAM)",
      x: 1,
      y: 7,
      symbol: "💾",
      color: "#38bdf8",
      collected: false,
    },
    {
      id: "item-crypto-1",
      itemId: "crypto_stash",
      name: "Decrypted Crypto Bounty (+150 Crypto)",
      x: 13,
      y: 1,
      symbol: "🪙",
      color: "#fbbf24",
      collected: false,
    },
  ];

  return {
    id: "dmz_gateway",
    index: 1,
    title: "DMZ Gateway (Subnet 01)",
    repo: "netsec://dmz-perimeter-gateway",
    mechanic:
      "Unauthenticated perimeter. Use Nmap [1] to expose CVEs for critical burst damage.",
    badge: "TIER 01 :: DMZ PERIMETER",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
    securityTier: 1,
    hasTerminal: true,
    terminalHacked: false,
  };
}

/**
 * Creates Security Tier 2: Active Directory & Intranet (Subnet 02)
 */
export function generateActiveDirectoryRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", " ", "#", " ", " ", " ", "#", " ", " ", " ", " ", "#"],
    ["#", " ", "#", "#", " ", "#", " ", "#", " ", "#", " ", "#", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", "#", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", " ", "#", "#", " ", "#", " ", "#", "#", " ", "#", " ", "#"],
    ["#", " ", " ", " ", "#", " ", " ", " ", " ", " ", "#", " ", " ", " ", "#"],
    ["#", "#", "#", " ", "#", " ", "#", "#", "#", " ", "#", " ", "#", "#", "#"],
    ["#", " ", " ", " ", " ", " ", "#", " ", " ", " ", "#", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const enemies: Enemy[] = [
    {
      id: "ad-daemon-1",
      type: "sentinel_daemon",
      name: "Kerberoasting Daemon",
      x: 6,
      y: 5,
      hp: 70,
      maxHp: 70,
      state: "patrol",
      patrolDir: "right",
      minX: 4,
      maxX: 9,
      symbol: "K",
      color: "#ef4444",
      cve: "BUFFER_OVERFLOW",
    },
    {
      id: "ad-slime-1",
      type: "slime",
      name: "LDAP Memory Leak Slime",
      x: 10,
      y: 3,
      hp: 55,
      maxHp: 55,
      state: "patrol",
      patrolDir: "down",
      minY: 1,
      maxY: 5,
      symbol: "S",
      color: "#a855f7",
      cve: "OUTDATED_TLS",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-bypass-1",
      itemId: "bypass_chip",
      name: "Hardware Jumper Bypass Chip",
      x: 1,
      y: 7,
      symbol: "🔌",
      color: "#34d399",
      collected: false,
    },
    {
      id: "item-coffee-ad",
      itemId: "coffee",
      name: "Caffeine Overclock (+25 HP)",
      x: 13,
      y: 1,
      symbol: "☕",
      color: "#38bdf8",
      collected: false,
    },
  ];

  return {
    id: "active_directory",
    index: 2,
    title: "Active Directory & Intranet",
    repo: "netsec://corp-active-directory-forest",
    mechanic:
      "Kerberos tokens and LDAP daemons. MitM spoof [4] scrambles patrol coordinates.",
    badge: "TIER 02 :: ACTIVE DIRECTORY",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
    securityTier: 2,
    hasTerminal: true,
    terminalHacked: false,
  };
}

/**
 * Creates Room 1 / Tier 3: Traveling-Salesman-Problem / Zero-Trust Enclave
 */
export function generateTSPRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", "#", " ", " ", " ", "H", "#", " ", " ", " ", " ", "#"],
    ["#", " ", "#", " ", "#", " ", "#", " ", " ", "#", " ", "#", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", "#", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", "#", " ", " ", "#", "#", "#", " ", " ", " ", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#", " ", " ", " ", "#"],
    ["#", " ", "#", "#", "#", " ", "#", " ", "#", " ", "#", "#", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const tspNodes: TSPNode[] = [
    { id: 1, x: 3, y: 1, visited: false },
    { id: 2, x: 7, y: 2, visited: false },
    { id: 3, x: 11, y: 5, visited: false },
    { id: 4, x: 4, y: 7, visited: false },
  ];

  const tspMovingWalls: TSPMovingWall[] = [
    { x: 5, y: 3, baseX: 5, baseY: 3, active: true },
    { x: 9, y: 4, baseX: 9, baseY: 4, active: true },
    { x: 11, y: 6, baseX: 11, baseY: 6, active: true },
  ];

  const enemies: Enemy[] = [
    {
      id: "tsp-drone-1",
      type: "drone",
      name: "Zero-Trust Airgap Sentinel",
      x: 7,
      y: 5,
      hp: 65,
      maxHp: 65,
      state: "patrol",
      patrolDir: "right",
      minX: 5,
      maxX: 9,
      symbol: "D",
      color: "#ef4444",
      cve: "ZERO_DAY",
    },
    {
      id: "tsp-zombie-1",
      type: "zombie",
      name: "EDR Sysmon Kernel Tracker",
      x: 12,
      y: 3,
      hp: 55,
      maxHp: 55,
      state: "patrol",
      patrolDir: "down",
      minY: 1,
      maxY: 4,
      symbol: "Z",
      color: "#f59e0b",
      cve: "BUFFER_OVERFLOW",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-node-1",
      itemId: "node_modules",
      name: "node_modules Bundle (+4 Ammo)",
      x: 1,
      y: 5,
      symbol: "📦",
      color: "#f59e0b",
      collected: false,
    },
    {
      id: "item-coffee-1",
      itemId: "coffee",
      name: "Cold Brew (+20 HP)",
      x: 13,
      y: 1,
      symbol: "☕",
      color: "#38bdf8",
      collected: false,
    },
  ];

  return {
    id: "tsp",
    index: 3,
    title: "Zero-Trust Enclave & Kernel Ring 0",
    repo: "github.com/fderuiter/tsp-heuristic-v1",
    mechanic:
      "Dynamic airgap moving walls shift every step. TSP route recalculates shortest tour.",
    badge: "TIER 03 :: AIRGAP ENCLAVE",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
    tspNodes,
    tspMovingWalls,
    securityTier: 3,
    hasTerminal: true,
  };
}

/**
 * Creates Room 4 / Tier 4: Darknet Black-Market & Admin Vault
 */
export function generateDarknetVaultRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", "#", "#", " ", " ", "#", " ", " ", "#", "#", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", " ", "T", " ", " ", " ", " ", " ", "H", " ", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", "#", "#", " ", " ", "#", " ", " ", "#", "#", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", "#", " ", " ", " ", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const enemies: Enemy[] = [
    {
      id: "darknet-drone-1",
      type: "drone",
      name: "Audit Daemon Sentinel",
      x: 7,
      y: 3,
      hp: 75,
      maxHp: 75,
      state: "patrol",
      patrolDir: "left",
      minX: 5,
      maxX: 9,
      symbol: "D",
      color: "#ef4444",
      cve: "UNAUTHENTICATED_RCE",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-commit-1",
      itemId: "commit_token",
      name: "Gold Commit Token (+500 Pts)",
      x: 4,
      y: 4,
      symbol: "💎",
      color: "#fbbf24",
      collected: false,
    },
    {
      id: "item-commit-2",
      itemId: "commit_token",
      name: "Gold Commit Token (+500 Pts)",
      x: 10,
      y: 4,
      symbol: "💎",
      color: "#fbbf24",
      collected: false,
    },
    {
      id: "item-stash-1",
      itemId: "git_stash",
      name: "Encrypted Root Stash (+1 Zero-Day Piercer)",
      x: 7,
      y: 1,
      symbol: "💥",
      color: "#a855f7",
      collected: false,
    },
  ];

  return {
    id: "billable_hours",
    index: 4,
    title: "Darknet Black-Market & Admin Vault",
    repo: "darknet://admin-privilege-vault",
    mechanic:
      "Terminal hacking bypass & Darknet vendor node. Decrypt root chests for high bounties.",
    badge: "TIER 04 :: DARKNET VAULT",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
    chestOpened: false,
    securityTier: 4,
    hasTerminal: true,
    darknetVendor: true,
  };
}

/**
 * Creates Room 2 / Tier 5: FaceForge / Neural Warden 3D Boss Arena
 */
export function generateFaceForgeRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", "#", " ", " ", " ", " ", " ", " ", " ", "#", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", "B", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", "#", " ", " ", " ", " ", " ", " ", " ", "#", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const boss = createFaceForgeBoss(7, 4);

  const items: ItemPickup[] = [
    {
      id: "item-git-1",
      itemId: "git_stash",
      name: "git commit Ammo (+1 Force Push)",
      x: 1,
      y: 7,
      symbol: "💥",
      color: "#ef4444",
      collected: false,
    },
    {
      id: "item-shield-1",
      itemId: "todo_shield",
      name: "TODO: Fix Later (Shield)",
      x: 13,
      y: 1,
      symbol: "🛡️",
      color: "#10b981",
      collected: false,
    },
  ];

  return {
    id: "faceforge",
    index: 2,
    title: "faceforge_3d :: Neural Warden Core",
    repo: "github.com/fderuiter/faceforge-wireframe-abandoned",
    mechanic:
      "Boss Fight: Wireframe 3D face firing untextured mesh projectiles.",
    badge: "ROOM 02 :: BOSS ARENA",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies: [],
    items,
    boss,
    securityTier: 5,
  };
}

/**
 * Creates Final Mainframe AI Sovereign Boss Room (Neural Warden)
 */
export function generateNeuralWardenRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", "#", " ", " ", " ", " ", " ", " ", " ", "#", "#", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", "B", " ", " ", " ", " ", " ", " ", "#"],
    ["#", " ", "#", " ", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#"],
    ["#", " ", "#", "#", " ", " ", " ", " ", " ", " ", " ", "#", "#", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const boss = createNeuralWardenBoss(7, 4);

  const items: ItemPickup[] = [
    {
      id: "item-stash-warden",
      itemId: "git_stash",
      name: "Airgap 0-Day Ammo (+2 Ammunition)",
      x: 1,
      y: 7,
      symbol: "🎯",
      color: "#a855f7",
      collected: false,
    },
    {
      id: "item-shield-warden",
      itemId: "todo_shield",
      name: "Encrypted Shield Buffer",
      x: 13,
      y: 1,
      symbol: "🛡️",
      color: "#10b981",
      collected: false,
    },
  ];

  return {
    id: "neural_warden",
    index: 5,
    title: "NEURAL_WARDEN_v9 :: AI Sovereign Core",
    repo: "netsec://neural-warden-core-mainframe",
    mechanic:
      "Final Boss: Multi-phase 3D vector octahedron firing zero-trust beam volleys.",
    badge: "TIER 05 :: AI SOVEREIGN",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies: [],
    items,
    boss,
    securityTier: 5,
  };
}

/**
 * Creates Room 3: BlinkBrowse (Eye-tracking / Cursor Steering)
 */
export function generateBlinkBrowseRoom(): DungeonRoom {
  const grid: string[][] = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", " ", " ", "#", " ", " ", " ", " ", " ", "#", " ", " ", " ", " ", "#"],
    ["#", " ", " ", "#", " ", "#", "#", "#", " ", "#", " ", "#", "#", " ", "#"],
    ["#", " ", " ", " ", " ", "#", " ", "#", " ", " ", " ", "#", " ", " ", "#"],
    ["#", "#", "#", " ", " ", "#", " ", "#", " ", " ", " ", "#", " ", " ", "#"],
    ["#", " ", " ", " ", " ", " ", " ", " ", " ", "#", " ", "#", " ", " ", "#"],
    ["#", " ", "#", "#", "#", " ", "#", " ", " ", "#", " ", "#", " ", " ", "#"],
    ["#", " ", " ", " ", " ", " ", "#", " ", " ", " ", " ", " ", " ", "E", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  ];

  const enemies: Enemy[] = [
    {
      id: "blink-slime-1",
      type: "slime",
      name: "Gaze Tracker Drift Slime",
      x: 6,
      y: 3,
      hp: 60,
      maxHp: 60,
      state: "patrol",
      patrolDir: "left",
      minX: 4,
      maxX: 8,
      symbol: "S",
      color: "#38bdf8",
      cve: "OUTDATED_TLS",
    },
    {
      id: "blink-drone-2",
      type: "drone",
      name: "Pupil Calibration Drone",
      x: 10,
      y: 5,
      hp: 55,
      maxHp: 55,
      state: "patrol",
      patrolDir: "right",
      minX: 9,
      maxX: 13,
      symbol: "D",
      color: "#a855f7",
      cve: "DEFAULT_CREDS",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-node-2",
      itemId: "node_modules",
      name: "node_modules Bundle (+4 Ammo)",
      x: 1,
      y: 6,
      symbol: "📦",
      color: "#f59e0b",
      collected: false,
    },
    {
      id: "item-coffee-2",
      itemId: "coffee",
      name: "Espresso (+25 HP)",
      x: 7,
      y: 1,
      symbol: "☕",
      color: "#38bdf8",
      collected: false,
    },
  ];

  return {
    id: "blinkbrowse",
    index: 3,
    title: "BlinkBrowse",
    repo: "github.com/fderuiter/blink-browse-webcam-nav",
    mechanic:
      "Eye-tracking drift: Character steers towards mouse cursor position!",
    badge: "ROOM 03 :: GAZE TRACKING",
    width: 15,
    height: 9,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
  };
}

/**
 * Creates Room 4: billable_hours_automation (Chest Room with Timesheet Modal)
 */
export function generateBillableHoursRoom(): DungeonRoom {
  return generateDarknetVaultRoom();
}

/**
 * Creates classic stage 1 baseline room.
 */
export function generateClassicStage1(): DungeonRoom {
  return {
    id: "classic_1",
    index: 1,
    title: "Subnet 01",
    repo: "system_labyrinth_subnet_01",
    mechanic: "Standard cybernetic navigation grid.",
    badge: "STAGE 01 :: SUBNET CORE",
    width: 15,
    height: 9,
    grid: STAGE_1_MAZE,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies: [],
    items: [],
  };
}

/**
 * Creates classic stage 2 firewall room.
 */
export function generateClassicStage2(): DungeonRoom {
  return {
    id: "classic_2",
    index: 2,
    title: "Subnet 02 (Firewall)",
    repo: "system_labyrinth_subnet_02",
    mechanic: "Firewall perimeter with active security drones.",
    badge: "STAGE 02 :: FIREWALL PERIMETER",
    width: 15,
    height: 9,
    grid: STAGE_2_MAZE,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies: [
      {
        id: "drone-stage-2",
        type: "drone",
        name: "Firewall Sentinel",
        x: 6,
        y: 5,
        hp: 50,
        maxHp: 50,
        state: "patrol",
        patrolDir: "right",
        minX: 5,
        maxX: 9,
        symbol: "D",
        color: "#ef4444",
        cve: "DEFAULT_CREDS",
      },
    ],
    items: [],
  };
}

/**
 * Creates the full roguelike campaign list of themed graveyard rooms.
 */
export function generateRoguelikeCampaign(): DungeonRoom[] {
  return [
    generateTSPRoom(),
    generateFaceForgeRoom(),
    generateBlinkBrowseRoom(),
    generateDarknetVaultRoom(),
  ];
}

/**
 * Creates the expanded 5-tier Cyberpunk Red Team Breach campaign.
 */
export function generateCyberpunkCampaign(): DungeonRoom[] {
  return [
    generateDMZGatewayRoom(),
    generateActiveDirectoryRoom(),
    generateTSPRoom(),
    generateDarknetVaultRoom(),
    generateFaceForgeRoom(),
  ];
}
