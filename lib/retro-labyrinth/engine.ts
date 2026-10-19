/**
 * Headless Arcade Engine implementation for Retro Labyrinth
 * Manages game state, cyberdeck classes, roguelike rooms, enemies, weapons, and FOV calculations.
 */

import { ArcadeEngine } from "@/lib/arcade";
import { CRT_THEMES, CYBERDECK_CLASSES } from "@/lib/dungeon/metaprogression";
import { DEFAULT_WEAPONS } from "@/lib/dungeon/weapons";
import {
  generateRoguelikeCampaign,
  STAGE_1_MAZE,
} from "@/lib/dungeon/generator";
import { calculateFOV, resetFogOfWar } from "@/lib/dungeon/fov";
import { updateEnemyAI } from "@/lib/dungeon/ai";
import {
  CyberdeckClassId,
  CRTThemeId,
  Weapon,
  WeaponId,
  Enemy,
  ItemPickup,
  ActiveSideEffect,
  FloatingNotification,
  ParticleEffect,
  BossState,
  DungeonRoom,
} from "@/lib/dungeon/types";
import {
  RunTelemetryData,
  StepTrajectoryEntry,
  CombatActionEntry,
  exportTelemetryToJson,
  exportTelemetryToCsv,
} from "./telemetry";

export interface RetroLabyrinthConfig {
  classId?: CyberdeckClassId;
  gameMode?: "classic" | "roguelike" | "custom";
  crtThemeId?: CRTThemeId;
  customRoom?: DungeonRoom;
}

export interface RetroLabyrinthState {
  gameMode: "classic" | "roguelike" | "custom";
  stage: number;
  roomIndex: number;
  campaignRooms: DungeonRoom[];
  currentMaze: string[][];
  playerPosition: { x: number; y: number };
  playerHp: number;
  maxHp: number;
  score: number;
  highScore: number;
  gameStatus: "playing" | "victory" | "game_over";
  weapons: Weapon[];
  activeWeaponId: string;
  selectedWeaponIndex: number;
  cryptoCredits: number;
  visitedNodes: number[];
  tspTour: number[];
  faceForgeBoss: BossState | null;
  enemies: Enemy[];
  items: ItemPickup[];
  sideEffects: ActiveSideEffect[];
  floatingTexts: FloatingNotification[];
  particles: ParticleEffect[];
  visibleCells: boolean[][];
  exploredCells: boolean[][];
  hexPuzzle: unknown;
  crtThemeId: CRTThemeId;
  selectedClassId: CyberdeckClassId;
}

export interface RetroLabyrinthSnapshot {
  gameMode: "classic" | "roguelike" | "custom";
  stage: number;
  roomIndex: number;
  totalRooms: number;
  playerPosition: { x: number; y: number };
  playerHp: number;
  maxHp: number;
  score: number;
  highScore: number;
  gameStatus: "playing" | "victory" | "game_over";
  weapons: Weapon[];
  activeWeaponId: string;
  selectedWeaponIndex: number;
  cryptoCredits: number;
  crtThemeId: CRTThemeId;
  selectedClassId: CyberdeckClassId;
  visibleCells?: boolean[][];
  exploredCells?: boolean[][];
}

const START_X = 1;
const START_Y = 1;

export class RetroLabyrinthEngine extends ArcadeEngine<
  RetroLabyrinthState,
  RetroLabyrinthSnapshot
> {
  private tickCounter = 0;
  private runId = "";
  private startTime = Date.now();
  private endTime?: number;
  private stepTrajectories: StepTrajectoryEntry[] = [];
  private combatLogs: CombatActionEntry[] = [];
  private enemiesDefeated = 0;
  private itemsCollected = 0;
  private damageDealt = 0;
  private damageTaken = 0;

  constructor(config: RetroLabyrinthConfig = {}) {
    const classId = config.classId ?? "script_kiddie";
    const selectedClass =
      CYBERDECK_CLASSES[classId] || CYBERDECK_CLASSES.script_kiddie;
    const gameMode =
      config.gameMode ?? (config.customRoom ? "custom" : "roguelike");
    const crtThemeId = config.crtThemeId ?? "emerald";

    let campaignRooms: DungeonRoom[] = [];
    if (gameMode === "custom" && config.customRoom) {
      campaignRooms = [config.customRoom];
    } else if (gameMode === "roguelike") {
      campaignRooms = generateRoguelikeCampaign();
    }

    const currentMaze = campaignRooms[0]?.grid || STAGE_1_MAZE;
    const startX = campaignRooms[0]?.startX ?? START_X;
    const startY = campaignRooms[0]?.startY ?? START_Y;
    const initialEnemies = campaignRooms[0]?.enemies
      ? JSON.parse(JSON.stringify(campaignRooms[0].enemies))
      : [];
    const initialItems = campaignRooms[0]?.items
      ? JSON.parse(JSON.stringify(campaignRooms[0].items))
      : [];

    const initialWeapons = selectedClass.starterWeapons.map((id: WeaponId) => {
      const template = DEFAULT_WEAPONS[id] || DEFAULT_WEAPONS.npm_install;
      return { ...template };
    });

    const rows = currentMaze.length || 9;
    const cols = currentMaze[0]?.length || 15;
    const visibleCells = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );
    const exploredCells = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );

    super({
      gameMode,
      stage: 1,
      roomIndex: 0,
      campaignRooms,
      currentMaze,
      playerPosition: { x: startX, y: startY },
      playerHp: selectedClass.baseHp,
      maxHp: selectedClass.baseHp,
      score: 0,
      highScore: 0,
      gameStatus: "playing",
      weapons: initialWeapons,
      activeWeaponId: initialWeapons[0]?.id || "npm_install",
      selectedWeaponIndex: 0,
      cryptoCredits: 0,
      visitedNodes: [],
      tspTour: [],
      faceForgeBoss: null,
      enemies: initialEnemies,
      items: initialItems,
      sideEffects: [],
      floatingTexts: [],
      particles: [],
      visibleCells,
      exploredCells,
      hexPuzzle: null,
      crtThemeId,
      selectedClassId: classId,
    });

    this.resetTelemetry();
    this.updateFOV();
  }

  public override init(): void {
    this.updateFOV();
  }

  public override update(dt: number): void {
    if (this.state.gameStatus !== "playing") return;
    this.tickCounter++;

    // Update enemy AI every 12 ticks
    if (this.tickCounter % 12 === 0) {
      if (this.state.enemies.length > 0) {
        const aiRes = updateEnemyAI(
          this.state.enemies,
          this.state.currentMaze,
          this.state.playerPosition.x,
          this.state.playerPosition.y,
          dt * 1000
        );
        this.state.enemies = aiRes.updatedEnemies;
        if (aiRes.damageToPlayer > 0) {
          this.damageTaken += aiRes.damageToPlayer;
          this.recordCombatAction({
            actionType: "player_damaged",
            damage: aiRes.damageToPlayer,
            details: `Took ${aiRes.damageToPlayer} damage from enemies`,
          });
          this.state.playerHp = Math.max(
            0,
            this.state.playerHp - aiRes.damageToPlayer
          );
          if (this.state.playerHp <= 0) {
            this.endTime = Date.now();
            this.state.gameStatus = "game_over";
            this.emit("gameOver", { score: this.state.score });
          }
        }
      }
    }

    // Update particles and floating texts
    this.state.particles = this.state.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        alpha: p.alpha - p.decay * dt,
      }))
      .filter((p) => p.alpha > 0);

    this.state.floatingTexts = this.state.floatingTexts
      .map((t) => ({
        ...t,
        y: t.y + (t.vy || -10) * dt,
        alpha: t.alpha - dt,
      }))
      .filter((t) => t.alpha > 0);
  }

  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;

    const maze = this.state.currentMaze;
    const rows = maze.length || 9;
    const cols = maze[0]?.length || 15;

    const canvasW = 240;
    const canvasH = 144;
    const cellW = canvasW / cols;
    const cellH = canvasH / rows;

    const theme = CRT_THEMES[this.state.crtThemeId] || CRT_THEMES.emerald;

    // Background clear
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw maze grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = maze[r][c];
        const px = c * cellW;
        const py = r * cellH;
        const isVisible = this.state.visibleCells[r]?.[c] ?? true;

        if (char === "#") {
          ctx.fillStyle = isVisible
            ? theme.primaryColor
            : theme.bgDark || "#002b11";
          ctx.fillRect(px, py, cellW, cellH);
        } else if (char === "E") {
          ctx.fillStyle = theme.accentColor;
          ctx.fillRect(px + 2, py + 2, cellW - 4, cellH - 4);
        }
      }
    }

    // Draw player
    const pX = this.state.playerPosition.x * cellW;
    const pY = this.state.playerPosition.y * cellH;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pX + 2, pY + 2, cellW - 4, cellH - 4);

    // Draw enemies
    ctx.fillStyle = "#ef4444";
    for (const enemy of this.state.enemies) {
      if (enemy.hp > 0) {
        ctx.fillRect(
          enemy.x * cellW + 2,
          enemy.y * cellH + 2,
          cellW - 4,
          cellH - 4
        );
      }
    }
  }

  public override createSnapshot(): RetroLabyrinthSnapshot {
    return {
      gameMode: this.state.gameMode,
      stage: this.state.stage,
      roomIndex: this.state.roomIndex,
      totalRooms: this.state.campaignRooms.length,
      playerPosition: { ...this.state.playerPosition },
      playerHp: this.state.playerHp,
      maxHp: this.state.maxHp,
      score: this.state.score,
      highScore: this.state.highScore,
      gameStatus: this.state.gameStatus,
      weapons: this.state.weapons.map((w) => ({ ...w })),
      activeWeaponId: this.state.activeWeaponId,
      selectedWeaponIndex: this.state.selectedWeaponIndex,
      cryptoCredits: this.state.cryptoCredits,
      crtThemeId: this.state.crtThemeId,
      selectedClassId: this.state.selectedClassId,
      visibleCells: this.state.visibleCells?.map((row) => [...row]),
      exploredCells: this.state.exploredCells?.map((row) => [...row]),
    };
  }

  public move(dx: number, dy: number): boolean {
    if (this.state.gameStatus !== "playing") return false;

    const newX = this.state.playerPosition.x + dx;
    const newY = this.state.playerPosition.y + dy;

    const maze = this.state.currentMaze;
    if (newY < 0 || newY >= maze.length || newX < 0 || newX >= maze[0].length) {
      return false;
    }

    const targetCell = maze[newY][newX];
    if (targetCell === "#") {
      return false; // Solid wall
    }

    this.state.playerPosition = { x: newX, y: newY };
    this.updateFOV();

    // Track step trajectory
    this.stepTrajectories.push({
      stepIndex: this.stepTrajectories.length + 1,
      timestamp: Date.now(),
      x: newX,
      y: newY,
      dx,
      dy,
      playerHp: this.state.playerHp,
      score: this.state.score,
    });

    // Check item pickups
    this.state.items.forEach((item) => {
      if (!item.collected && item.x === newX && item.y === newY) {
        item.collected = true;
        this.itemsCollected += 1;
        this.state.score += 50;
        this.recordCombatAction({
          actionType: "item_pickup",
          targetX: newX,
          targetY: newY,
          details: `Picked up ${item.name}`,
        });
      }
    });

    // Check exit
    if (targetCell === "E") {
      this.endTime = Date.now();
      this.state.gameStatus = "victory";
      this.recordCombatAction({
        actionType: "enemy_hit",
        details: "Reached exit portal. Level victory!",
      });
      this.emit("victory", { score: this.state.score });
    }

    this.notifySubscribers();
    return true;
  }

  public fireActiveWeapon(): void {
    if (this.state.gameStatus !== "playing") return;

    const weapon = this.state.weapons[this.state.selectedWeaponIndex];
    if (!weapon || (weapon.ammo <= 0 && weapon.ammo !== -1)) return;

    if (weapon.ammo > 0) {
      weapon.ammo -= 1;
    }

    this.recordCombatAction({
      actionType: "fire_weapon",
      weaponId: weapon.id,
      damage: weapon.damage,
      details: `Fired ${weapon.name}`,
    });

    // Damage adjacent enemies
    const pX = this.state.playerPosition.x;
    const pY = this.state.playerPosition.y;
    this.state.enemies.forEach((enemy) => {
      if (
        enemy.hp > 0 &&
        Math.abs(enemy.x - pX) <= 1 &&
        Math.abs(enemy.y - pY) <= 1
      ) {
        const dmg = weapon.damage || 5;
        enemy.hp = Math.max(0, enemy.hp - dmg);
        this.damageDealt += dmg;
        this.recordCombatAction({
          actionType: "enemy_hit",
          weaponId: weapon.id,
          targetX: enemy.x,
          targetY: enemy.y,
          damage: dmg,
          enemyType: enemy.type,
          details: `Hit ${enemy.name || enemy.type} for ${dmg} damage.`,
        });

        if (enemy.hp <= 0) {
          this.enemiesDefeated += 1;
          this.state.score += 100;
          this.recordCombatAction({
            actionType: "enemy_defeated",
            targetX: enemy.x,
            targetY: enemy.y,
            enemyType: enemy.type,
            details: `Defeated ${enemy.name || enemy.type}!`,
          });
        }
      }
    });

    this.emit("fireWeapon", { weaponId: weapon.id });
    this.notifySubscribers();
  }

  public selectWeapon(index: number): void {
    if (index >= 0 && index < this.state.weapons.length) {
      this.state.selectedWeaponIndex = index;
      this.state.activeWeaponId = this.state.weapons[index].id;
      this.notifySubscribers();
    }
  }

  public setCrtTheme(themeId: CRTThemeId): void {
    this.state.crtThemeId = themeId;
    this.notifySubscribers();
  }

  public loadCustomRoom(room: DungeonRoom): void {
    this.state.gameMode = "custom";
    this.state.stage = 1;
    this.state.roomIndex = 0;
    this.state.campaignRooms = [room];
    this.state.currentMaze = room.grid;
    this.state.playerPosition = { x: room.startX, y: room.startY };
    this.state.enemies = room.enemies
      ? JSON.parse(JSON.stringify(room.enemies))
      : [];
    this.state.items = room.items ? JSON.parse(JSON.stringify(room.items)) : [];
    this.state.gameStatus = "playing";

    const rows = room.grid.length;
    const cols = room.grid[0]?.length || 0;
    this.state.visibleCells = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );
    this.state.exploredCells = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );

    this.updateFOV();
    this.resetTelemetry();
    this.notifySubscribers();
  }

  public recordCombatAction(action: Partial<CombatActionEntry>): void {
    const entry: CombatActionEntry = {
      actionIndex: this.combatLogs.length + 1,
      timestamp: Date.now(),
      actionType: action.actionType || "fire_weapon",
      weaponId: action.weaponId,
      targetX: action.targetX,
      targetY: action.targetY,
      damage: action.damage,
      enemyType: action.enemyType,
      details: action.details,
    };
    this.combatLogs.push(entry);
  }

  public getTelemetry(): RunTelemetryData {
    const currentRoom =
      this.state.campaignRooms[this.state.roomIndex] ||
      this.state.campaignRooms[0];
    const levelId = currentRoom?.id || "custom";
    const levelTitle = currentRoom?.title || "Custom Dungeon Level";

    const endTime =
      this.state.gameStatus !== "playing"
        ? this.endTime || Date.now()
        : Date.now();
    const durationMs = Math.max(0, endTime - this.startTime);

    return {
      summary: {
        runId: this.runId,
        levelId,
        levelTitle,
        startTime: this.startTime,
        endTime: this.state.gameStatus !== "playing" ? endTime : undefined,
        durationMs,
        totalSteps: this.stepTrajectories.length,
        combatActionsCount: this.combatLogs.length,
        finalStatus: this.state.gameStatus,
        finalScore: this.state.score,
        enemiesDefeated: this.enemiesDefeated,
        itemsCollected: this.itemsCollected,
        damageDealt: this.damageDealt,
        damageTaken: this.damageTaken,
      },
      stepTrajectories: [...this.stepTrajectories],
      combatLogs: [...this.combatLogs],
    };
  }

  public exportTelemetryJson(): string {
    return exportTelemetryToJson(this.getTelemetry());
  }

  public exportTelemetryCsv(): {
    summaryCsv: string;
    stepsCsv: string;
    combatCsv: string;
    combinedCsv: string;
  } {
    return exportTelemetryToCsv(this.getTelemetry());
  }

  public resetTelemetry(): void {
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.startTime = Date.now();
    this.endTime = undefined;
    this.stepTrajectories = [];
    this.combatLogs = [];
    this.enemiesDefeated = 0;
    this.itemsCollected = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
  }

  public resetGame(): void {
    const selectedClass =
      CYBERDECK_CLASSES[this.state.selectedClassId] ||
      CYBERDECK_CLASSES.script_kiddie;
    let campaignRooms = this.state.campaignRooms;
    if (this.state.gameMode === "roguelike") {
      campaignRooms = generateRoguelikeCampaign();
    }
    const currentMaze =
      this.state.gameMode === "roguelike" || this.state.gameMode === "custom"
        ? campaignRooms[0]?.grid || STAGE_1_MAZE
        : STAGE_1_MAZE;
    const startX =
      this.state.gameMode === "roguelike" || this.state.gameMode === "custom"
        ? (campaignRooms[0]?.startX ?? START_X)
        : START_X;
    const startY =
      this.state.gameMode === "roguelike" || this.state.gameMode === "custom"
        ? (campaignRooms[0]?.startY ?? START_Y)
        : START_Y;

    this.state.campaignRooms = campaignRooms;
    this.state.currentMaze = currentMaze;
    this.state.playerPosition = { x: startX, y: startY };
    this.state.playerHp = selectedClass.baseHp;
    this.state.score = 0;
    this.state.gameStatus = "playing";
    this.state.exploredCells = resetFogOfWar(
      currentMaze.length,
      currentMaze[0]?.length ?? 0
    );
    this.updateFOV();
    this.resetTelemetry();
    this.notifySubscribers();
  }

  private updateFOV(): void {
    const maze = this.state.currentMaze;
    if (!maze || maze.length === 0 || !maze[0]) return;

    const fov = calculateFOV(
      maze,
      this.state.playerPosition.x,
      this.state.playerPosition.y,
      5,
      this.state.exploredCells
    );
    this.state.visibleCells = fov.visible;
    this.state.exploredCells = fov.explored;
  }
}
