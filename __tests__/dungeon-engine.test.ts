import { describe, it, expect } from "vitest";
import {
  generateRoguelikeCampaign,
  generateTSPRoom,
  generateFaceForgeRoom,
  generateBlinkBrowseRoom,
  generateBillableHoursRoom,
  generateClassicStage1,
  generateClassicStage2,
  generateCyberpunkCampaign,
  calculateFOV,
  hasLineOfSight,
  computeShortestTour,
  updateTSPMovingWalls,
  createFaceForgeBoss,
  updateFaceForgeBoss,
  rotate3D,
  project3DTo2D,
  fireWeapon,
  DEFAULT_WEAPONS,
  updateEnemyAI,
  generateHexMatrixPuzzle,
  selectHexCell,
  consumeBypassChip,
  CYBERDECK_CLASSES,
  CRT_THEMES,
} from "@/lib/dungeon";
import { retroAudio } from "@/lib/dungeon/audio";
import {
  loadCyberdeckProfile,
  saveCyberdeckProfile,
  DEFAULT_CYBERDECK_PROFILE,
} from "@/lib/dungeon/metaprogression";

describe("Roguelike Dungeon Generator & Rooms", () => {
  it("should generate the full campaign with 4 distinct themed rooms", () => {
    const rooms = generateRoguelikeCampaign();
    expect(rooms).toHaveLength(4);
    expect(rooms.map((r) => r.id)).toEqual([
      "tsp",
      "faceforge",
      "blinkbrowse",
      "billable_hours",
    ]);
  });

  it("should generate Room 1 (TSP) with valid dimensions, nodes, and moving walls", () => {
    const tspRoom = generateTSPRoom();
    expect(tspRoom.id).toBe("tsp");
    expect(tspRoom.width).toBe(15);
    expect(tspRoom.height).toBe(9);
    expect(tspRoom.startX).toBe(1);
    expect(tspRoom.startY).toBe(1);
    expect(tspRoom.exitX).toBe(13);
    expect(tspRoom.exitY).toBe(7);
    expect(tspRoom.tspNodes?.length).toBeGreaterThanOrEqual(4);
    expect(tspRoom.tspMovingWalls?.length).toBeGreaterThanOrEqual(3);
    expect(tspRoom.enemies.length).toBeGreaterThan(0);
  });

  it("should generate Room 2 (FaceForge 3D) with boss initialized", () => {
    const bossRoom = generateFaceForgeRoom();
    expect(bossRoom.id).toBe("faceforge");
    expect(bossRoom.boss).toBeDefined();
    expect(bossRoom.boss?.name).toContain("faceforge_3d");
    expect(bossRoom.boss?.hp).toBe(300);
    expect(bossRoom.boss?.mesh.vertices.length).toBeGreaterThan(10);
  });

  it("should generate Room 3 (BlinkBrowse) with gaze tracker enemies and items", () => {
    const blinkRoom = generateBlinkBrowseRoom();
    expect(blinkRoom.id).toBe("blinkbrowse");
    expect(
      blinkRoom.enemies.some((e) => e.type === "slime" || e.type === "drone")
    ).toBe(true);
    expect(blinkRoom.items.length).toBeGreaterThan(0);
  });

  it("should generate Room 4 (Billable Hours) with treasure chests", () => {
    const billableRoom = generateBillableHoursRoom();
    expect(billableRoom.id).toBe("billable_hours");
    expect(billableRoom.items.some((i) => i.itemId === "commit_token")).toBe(
      true
    );
  });

  it("should generate classic stages and Cyberpunk campaign", () => {
    const s1 = generateClassicStage1();
    expect(s1.id).toBe("classic_1");

    const s2 = generateClassicStage2();
    expect(s2.id).toBe("classic_2");
    expect(s2.enemies.length).toBeGreaterThan(0);

    const cp = generateCyberpunkCampaign();
    expect(cp.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Field-of-View & Line of Sight Engine", () => {
  const sampleGrid = [
    ["#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", "#"],
    ["#", " ", "#", " ", "#"],
    ["#", " ", " ", " ", "#"],
    ["#", "#", "#", "#", "#"],
  ];

  it("computes field of view centered at player and marks explored tiles", () => {
    const { visible, explored } = calculateFOV(sampleGrid, 1, 1, 3);
    expect(visible[1][1]).toBe(true);
    expect(explored[1][1]).toBe(true);
    expect(visible[0][0]).toBe(true); // adjacent wall
  });

  it("correctly identifies unobstructed line of sight", () => {
    expect(hasLineOfSight(sampleGrid, 1, 1, 1, 3)).toBe(true);
    expect(hasLineOfSight(sampleGrid, 1, 1, 3, 3)).toBe(false); // blocked by wall at (2,2)
  });
});

describe("TSP Dynamic Moving Walls & Path Recalculation", () => {
  it("calculates shortest TSP tour through landmark nodes", () => {
    const nodes = [
      { id: 1, x: 2, y: 1, visited: false },
      { id: 2, x: 4, y: 1, visited: false },
    ];
    const { tour, totalDistance } = computeShortestTour(1, 1, nodes, 5, 1);
    expect(tour.length).toBe(4); // Start -> Node1 -> Node2 -> Exit
    expect(totalDistance).toBeCloseTo(4, 1);
  });

  it("updates moving walls and stamps 'W' onto grid correctly", () => {
    const grid = [
      ["#", "#", "#", "#", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", "#", "#", "#", "#"],
    ];
    const walls = [{ x: 2, y: 2, baseX: 2, baseY: 2, active: true }];

    const { updatedGrid, updatedWalls } = updateTSPMovingWalls(grid, walls, 1);
    expect(updatedWalls[0].x).toBe(2);
    expect(updatedGrid[updatedWalls[0].y][updatedWalls[0].x]).toBe("W");
  });
});

describe("FaceForge 3D Boss & Wireframe Projection Engine", () => {
  it("rotates and projects 3D vertices to 2D screen coords deterministically", () => {
    const v = { x: 1, y: 0, z: 0 };
    const rotated = rotate3D(v, { x: 0, y: Math.PI / 2, z: 0 });
    expect(rotated.x).toBeCloseTo(0, 4);
    expect(rotated.z).toBeCloseTo(-1, 4);

    const projected = project3DTo2D(rotated, 100, 100, 20, 4);
    expect(projected.x).toBeCloseTo(100, 1);
    expect(projected.y).toBeCloseTo(100, 1);
  });

  it("progresses boss phases and spawns projectiles as HP decreases", () => {
    const boss = createFaceForgeBoss(7, 4);
    expect(boss.phase).toBe(1);

    // Phase 1 update
    const { updatedBoss } = updateFaceForgeBoss(boss, 1, 1, 2000, 15, 9);
    expect(updatedBoss.projectiles.length).toBeGreaterThan(0);

    // Damage to phase 2
    const phase2Boss = { ...boss, hp: 150 };
    const res2 = updateFaceForgeBoss(phase2Boss, 1, 1, 4000, 15, 9);
    expect(res2.updatedBoss.phase).toBe(2);

    // Damage to phase 3
    const phase3Boss = { ...boss, hp: 50 };
    const res3 = updateFaceForgeBoss(phase3Boss, 1, 1, 6000, 15, 9);
    expect(res3.updatedBoss.phase).toBe(3);
  });
});

describe("Developer Weapons & Humorous Side Effects", () => {
  it("executes npm install with AoE damage and lag spike side effect", () => {
    const enemies = [
      {
        id: "e1",
        type: "zombie" as const,
        name: "Zombie",
        x: 2,
        y: 1,
        hp: 30,
        maxHp: 30,
        state: "patrol" as const,
        patrolDir: "right" as const,
        symbol: "Z",
        color: "#f59e0b",
      },
    ];

    const res = fireWeapon(
      "npm_install",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      1000
    );

    expect(res.success).toBe(true);
    expect(res.activeSideEffect?.type).toBe("lag_spike");
    expect(res.activeSideEffect?.title).toContain("DEPENDENCY_BLOAT");
    expect(res.updatedEnemies).toHaveLength(0); // Defeated by AoE
    expect(res.particles.length).toBeGreaterThan(0);
  });

  it("executes git push --force and wipes room history", () => {
    const enemies = [
      {
        id: "e1",
        type: "drone" as const,
        name: "Drone",
        x: 10,
        y: 5,
        hp: 50,
        maxHp: 50,
        state: "patrol" as const,
        patrolDir: "left" as const,
        symbol: "D",
        color: "#ef4444",
      },
    ];

    const res = fireWeapon(
      "git_force_push",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      1000
    );

    expect(res.success).toBe(true);
    expect(res.activeSideEffect?.type).toBe("history_rewritten");
    expect(res.updatedEnemies).toHaveLength(0);
    expect(res.updatedWeapons.git_force_push.ammo).toBe(
      DEFAULT_WEAPONS.git_force_push.ammo - 1
    );
  });

  it("executes Stack Overflow Copy-Paste, heals HP, and triggers keybind scramble", () => {
    const res = fireWeapon(
      "stack_overflow",
      DEFAULT_WEAPONS,
      1,
      1,
      40,
      100,
      [],
      undefined,
      1000
    );

    expect(res.success).toBe(true);
    expect(res.updatedPlayerHp).toBe(80);
    expect(res.activeSideEffect?.type).toBe("scrambled_keys");
    expect(res.activeSideEffect?.description).toContain("inverted");
  });
});

describe("Enemy AI State Machine", () => {
  const grid = [
    ["#", "#", "#", "#", "#"],
    ["#", " ", " ", " ", "#"],
    ["#", " ", " ", " ", "#"],
    ["#", "#", "#", "#", "#"],
  ];

  it("patrols within bounds and turns around on edge", () => {
    const enemies = [
      {
        id: "e1",
        type: "drone" as const,
        name: "Drone",
        x: 3,
        y: 1,
        hp: 50,
        maxHp: 50,
        state: "patrol" as const,
        patrolDir: "right" as const,
        minX: 1,
        maxX: 3,
        symbol: "D",
        color: "#ef4444",
      },
    ];

    const { updatedEnemies } = updateEnemyAI(enemies, grid, 1, 2, 100);
    expect(updatedEnemies[0].patrolDir).toBe("left");
    expect(updatedEnemies[0].x).toBe(2);
  });

  it("transitions to chase state for zombies when player is in line of sight within range", () => {
    const enemies = [
      {
        id: "z1",
        type: "zombie" as const,
        name: "Zombie",
        x: 3,
        y: 1,
        hp: 50,
        maxHp: 50,
        state: "patrol" as const,
        patrolDir: "left" as const,
        minX: 1,
        maxX: 3,
        symbol: "Z",
        color: "#f59e0b",
      },
    ];

    const { updatedEnemies } = updateEnemyAI(enemies, grid, 2, 1, 100);
    expect(updatedEnemies[0].state).toBe("chase");
  });
});

describe("Cybersecurity Hex Matrix Buffer Hacking Minigame", () => {
  it("generates a solvable procedural hex matrix puzzle", () => {
    const puzzle = generateHexMatrixPuzzle(2);
    expect(puzzle.grid.length).toBeGreaterThanOrEqual(4);
    expect(puzzle.targetSequence.length).toBeGreaterThanOrEqual(2);
    expect(puzzle.activeAxis).toBe("row");
    expect(puzzle.solved).toBe(false);
  });

  it("evaluates byte selection with row/col alternation", () => {
    const puzzle = generateHexMatrixPuzzle(1);
    const targetByte = puzzle.grid[0][0].byte;
    const res = selectHexCell(puzzle, 0, 0);

    expect(res.puzzle.currentInput).toContain(targetByte);
    expect(res.puzzle.activeAxis).toBe("col");
    expect(res.puzzle.activeIndex).toBe(0);
  });

  it("instantly solves puzzle when using a hardware bypass chip", () => {
    const puzzle = generateHexMatrixPuzzle(3);
    const solved = consumeBypassChip(puzzle);
    expect(solved.solved).toBe(true);
    expect(solved.failed).toBe(false);
  });
});

describe("Cyberdeck Archetypes, Meta-Progression & Themes", () => {
  it("defines 4 distinct cyberdeck classes with unique perks and starting stats", () => {
    expect(Object.keys(CYBERDECK_CLASSES)).toEqual([
      "script_kiddie",
      "cryptanalyst",
      "apt_specialist",
      "hardware_hacker",
    ]);

    const scriptKiddie = CYBERDECK_CLASSES.script_kiddie;
    expect(scriptKiddie.startBypassChips).toBe(2);
    expect(scriptKiddie.starterWeapons).toContain("port_scan");

    const apt = CYBERDECK_CLASSES.apt_specialist;
    expect(apt.baseRam).toBe(48);
  });

  it("provides 3 retro CRT phosphor themes, emerald first and no synthwave (#1522)", () => {
    expect(Object.keys(CRT_THEMES)).toEqual(["emerald", "amber", "matrix"]);
    expect(CRT_THEMES.emerald.primaryColor).toBe("#10b981");
    expect(CRT_THEMES.amber.primaryColor).toBe("#f59e0b");
  });
});

describe("Cybersecurity Weapons & CVE Synergies", () => {
  it("fires port_scan and exposes CVE vulnerabilities in sector", () => {
    const enemies = [
      {
        id: "d1",
        type: "drone" as const,
        name: "Sentinel",
        x: 2,
        y: 1,
        hp: 40,
        maxHp: 40,
        state: "patrol" as const,
        patrolDir: "right" as const,
        symbol: "D",
        color: "#ef4444",
        cve: "DEFAULT_CREDS" as const,
      },
    ];

    const res = fireWeapon(
      "port_scan",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      1000,
      32
    );

    expect(res.success).toBe(true);
    expect(res.updatedEnemies[0].cveExposed).toBe(true);
  });

  it("fires buffer_overflow with critical damage on BUFFER_OVERFLOW targets", () => {
    const enemies = [
      {
        id: "vuln-1",
        type: "zombie" as const,
        name: "Vulnerable Daemon",
        x: 2,
        y: 1,
        hp: 150,
        maxHp: 150,
        state: "patrol" as const,
        patrolDir: "right" as const,
        symbol: "Z",
        color: "#ef4444",
        cve: "BUFFER_OVERFLOW" as const,
      },
    ];

    const res = fireWeapon(
      "buffer_overflow",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      1000,
      32
    );

    expect(res.success).toBe(true);
    expect(res.critTriggered).toBe(true);
  });

  it("fires npm_install, git_force_push, stack_overflow, zero_day, and ransomware_lock", () => {
    const enemies = [
      {
        id: "e1",
        type: "drone" as const,
        name: "Sentinel",
        x: 2,
        y: 1,
        hp: 100,
        maxHp: 100,
        state: "patrol" as const,
        patrolDir: "right" as const,
        symbol: "D",
        color: "#ef4444",
        cve: "UNAUTHENTICATED_RCE" as const,
      },
    ];

    // npm_install
    const npmRes = fireWeapon(
      "npm_install",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      1000,
      32
    );
    expect(npmRes.success).toBe(true);

    // git_force_push
    const gitRes = fireWeapon(
      "git_force_push",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      2000,
      32
    );
    expect(gitRes.success).toBe(true);

    // stack_overflow
    const stackRes = fireWeapon(
      "stack_overflow",
      DEFAULT_WEAPONS,
      1,
      1,
      50,
      100,
      enemies,
      undefined,
      3000,
      32
    );
    expect(stackRes.success).toBe(true);
    expect(stackRes.updatedPlayerHp).toBe(90);

    // zero_day
    const zdRes = fireWeapon(
      "zero_day",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      4000,
      32
    );
    expect(zdRes.success).toBe(true);

    // ransomware_lock
    const rwRes = fireWeapon(
      "ransomware_lock",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      5000,
      32
    );
    expect(rwRes.success).toBe(true);
    expect(rwRes.cryptoGained).toBeGreaterThan(0);

    // emp_blast
    const empRes = fireWeapon(
      "emp_blast",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      enemies,
      undefined,
      6000,
      32
    );
    expect(empRes.success).toBe(true);
    expect(empRes.updatedEnemies[0].state).toBe("stunned");

    // git_force_push against low-HP boss
    const lowHpBoss = { ...createFaceForgeBoss(10, 10), hp: 10 };
    const forceBossRes = fireWeapon(
      "git_force_push",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      [],
      lowHpBoss,
      7000,
      32
    );
    expect(forceBossRes.updatedBoss?.defeated).toBe(true);
  });

  it("handles weapons against FaceForge 3D boss and tests boss updates", () => {
    const boss = createFaceForgeBoss(10, 10);
    const res = fireWeapon(
      "zero_day",
      DEFAULT_WEAPONS,
      1,
      1,
      100,
      100,
      [],
      boss,
      1000,
      32
    );
    expect(res.success).toBe(true);
    expect(res.updatedBoss).toBeDefined();

    // Update boss through phases
    let b = createFaceForgeBoss(10, 10);
    let updateRes = updateFaceForgeBoss(b, 1, 1, 100, 32, 32);
    b = updateRes.updatedBoss;
    expect(b.mesh.rotation.y).toBeGreaterThan(0);

    // Phase 2 transition
    b.hp = 150;
    updateRes = updateFaceForgeBoss(b, 1, 1, 200, 32, 32);
    b = updateRes.updatedBoss;
    expect(b.phase).toBe(2);

    // Phase 3 transition
    b.hp = 50;
    updateRes = updateFaceForgeBoss(b, 1, 1, 300, 32, 32);
    b = updateRes.updatedBoss;
    expect(b.phase).toBe(3);
  });

  it("updates enemy AI states (patrol, chase, stunned, confused, attacking)", () => {
    const sampleGrid = [
      ["#", "#", "#", "#", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", "#", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", "#", "#", "#", "#"],
    ];

    const enemies = [
      {
        id: "patrol-drone",
        type: "drone" as const,
        name: "Drone",
        x: 1,
        y: 1,
        hp: 30,
        maxHp: 30,
        state: "patrol" as const,
        patrolDir: "right" as const,
        symbol: "D",
        color: "#38bdf8",
      },
      {
        id: "stunned-drone",
        type: "drone" as const,
        name: "Stunned",
        x: 3,
        y: 1,
        hp: 30,
        maxHp: 30,
        state: "stunned" as const,
        stunTimerMs: 2000,
        patrolDir: "left" as const,
        symbol: "D",
        color: "#38bdf8",
      },
      {
        id: "confused-drone",
        type: "drone" as const,
        name: "Confused",
        x: 3,
        y: 3,
        hp: 30,
        maxHp: 30,
        state: "confused" as const,
        confusedTimerMs: 2000,
        patrolDir: "up" as const,
        symbol: "D",
        color: "#38bdf8",
      },
    ];

    const aiRes = updateEnemyAI(enemies, sampleGrid, 1, 3, 16.6);
    expect(aiRes.updatedEnemies.length).toBe(3);
    expect(
      aiRes.updatedEnemies.find((e) => e.id === "stunned-drone")?.state
    ).toBe("stunned");
  });

  it("exercises retro audio synthesizer methods without error", () => {
    const mockCtx = {
      state: "running",
      currentTime: 0,
      destination: {},
      resume: async () => {},
      createOscillator: () => ({
        type: "sawtooth",
        frequency: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
        start: () => {},
        stop: () => {},
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
        connect: () => {},
      }),
    };
    (globalThis as unknown as { AudioContext: unknown }).AudioContext =
      function () {
        return mockCtx;
      };

    retroAudio.setMuted(false);
    expect(retroAudio.getMuted()).toBe(false);

    expect(() => retroAudio.playStep()).not.toThrow();
    expect(() => retroAudio.playPortScan()).not.toThrow();
    expect(() => retroAudio.playExploitBlast()).not.toThrow();
    expect(() => retroAudio.playCriticalHit()).not.toThrow();
    expect(() => retroAudio.playHackSuccess()).not.toThrow();
    expect(() => retroAudio.playAlertPulse()).not.toThrow();
    expect(() => retroAudio.playPickup()).not.toThrow();
    expect(() => retroAudio.playTone(440, 50, "square", 0.05)).not.toThrow();

    retroAudio.setMuted(true);
    expect(retroAudio.getMuted()).toBe(true);
    expect(() => retroAudio.playStep()).not.toThrow();
  });

  it("handles cyberdeck profile persistence in localStorage", () => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
      length: 0,
      key: () => null,
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const profile = loadCyberdeckProfile();
    expect(profile.unlockedClasses).toContain("script_kiddie");

    saveCyberdeckProfile({
      ...DEFAULT_CYBERDECK_PROFILE,
      totalCrypto: 500,
    });

    const loaded = loadCyberdeckProfile();
    expect(loaded.totalCrypto).toBe(500);
  });
});
