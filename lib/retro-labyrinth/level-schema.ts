import type { DungeonRoom, Enemy, ItemPickup } from "@/lib/dungeon/types";

export interface LevelValidationResult {
  valid: boolean;
  errors: string[];
}

export function createDefaultCustomRoom(): DungeonRoom {
  const width = 15;
  const height = 9;
  const grid: string[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => {
      if (r === 0 || r === height - 1 || c === 0 || c === width - 1) {
        return "#";
      }
      return " ";
    })
  );

  // Set exit at (13, 7)
  grid[7][13] = "E";

  const enemies: Enemy[] = [
    {
      id: "enemy-1",
      type: "zombie",
      name: "Legacy Memory Leak",
      x: 7,
      y: 4,
      hp: 12,
      maxHp: 12,
      patrolDir: "left",
      color: "#ef4444",
      symbol: "Z",
      state: "patrol",
    },
  ];

  const items: ItemPickup[] = [
    {
      id: "item-1",
      itemId: "coffee",
      name: "Hot Espresso",
      x: 4,
      y: 2,
      symbol: "☕",
      color: "#f59e0b",
      collected: false,
    },
  ];

  return {
    id: "custom",
    index: 0,
    title: "Custom Scenario Alpha",
    repo: "user-repo/custom-level",
    mechanic: "Custom User Level",
    badge: "CUSTOM",
    width,
    height,
    grid,
    startX: 1,
    startY: 1,
    exitX: 13,
    exitY: 7,
    enemies,
    items,
  };
}

export function validateDungeonRoom(
  room: Partial<DungeonRoom>
): LevelValidationResult {
  const errors: string[] = [];

  if (!room) {
    return { valid: false, errors: ["Room configuration object is missing."] };
  }

  const width = room.width;
  const height = room.height;

  if (typeof width !== "number" || width < 3 || !Number.isInteger(width)) {
    errors.push("Level width must be an integer of at least 3.");
  }

  if (typeof height !== "number" || height < 3 || !Number.isInteger(height)) {
    errors.push("Level height must be an integer of at least 3.");
  }

  if (!Array.isArray(room.grid)) {
    errors.push("Level grid must be a 2D matrix array.");
  } else if (typeof height === "number" && room.grid.length !== height) {
    errors.push(
      `Grid row count (${room.grid.length}) does not match height (${height}).`
    );
  } else if (typeof width === "number") {
    for (let r = 0; r < room.grid.length; r++) {
      if (!Array.isArray(room.grid[r])) {
        errors.push(`Grid row ${r} is not an array.`);
      } else if (room.grid[r].length !== width) {
        errors.push(
          `Grid row ${r} length (${room.grid[r].length}) does not match width (${width}).`
        );
      }
    }
  }

  // If grid structure is valid so far, validate perimeter and tile rules
  if (
    errors.length === 0 &&
    Array.isArray(room.grid) &&
    typeof width === "number" &&
    typeof height === "number"
  ) {
    const grid = room.grid;

    // 1. Perimeter boundary validation
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const isPerimeter =
          r === 0 || r === height - 1 || c === 0 || c === width - 1;
        const cell = grid[r]?.[c];
        if (isPerimeter && cell !== "#") {
          errors.push(
            `Perimeter boundary broken at row ${r}, col ${c} (found '${cell}'). Outer border must be solid walls (#).`
          );
        }
      }
    }

    // 2. Start position validation
    let foundStartTiles = 0;
    let startX: number | undefined = room.startX;
    let startY: number | undefined = room.startY;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const cell = grid[r]?.[c];
        if (cell === "S" || cell === "@") {
          foundStartTiles++;
          startX = c;
          startY = r;
        }
      }
    }

    if (
      typeof startX !== "number" ||
      typeof startY !== "number" ||
      startX < 0 ||
      startX >= width ||
      startY < 0 ||
      startY >= height
    ) {
      errors.push(
        `Player start position (${startX}, ${startY}) is out of grid bounds.`
      );
    } else if (grid[startY]?.[startX] === "#") {
      errors.push(
        `Player start position (${startX}, ${startY}) cannot be placed inside a wall (#).`
      );
    }

    if (
      foundStartTiles === 0 &&
      (typeof startX !== "number" ||
        typeof startY !== "number" ||
        grid[startY]?.[startX] === "#")
    ) {
      errors.push("Level must contain at least one valid player start tile.");
    }

    // 3. Exit tile validation
    let foundExitTiles = 0;
    let exitX: number | undefined = room.exitX;
    let exitY: number | undefined = room.exitY;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (grid[r]?.[c] === "E") {
          foundExitTiles++;
          exitX = c;
          exitY = r;
        }
      }
    }

    if (foundExitTiles === 0) {
      errors.push("Level must contain at least one exit portal tile (E).");
    } else if (typeof exitX === "number" && typeof exitY === "number") {
      if (exitX < 0 || exitX >= width || exitY < 0 || exitY >= height) {
        errors.push(
          `Exit position (${exitX}, ${exitY}) is out of grid bounds.`
        );
      } else if (grid[exitY]?.[exitX] !== "E") {
        errors.push(`Exit tile at position (${exitX}, ${exitY}) must be 'E'.`);
      }
    }

    // 4. Enemy placement validation
    if (Array.isArray(room.enemies)) {
      room.enemies.forEach((enemy, idx) => {
        if (
          typeof enemy.x !== "number" ||
          typeof enemy.y !== "number" ||
          enemy.x < 0 ||
          enemy.x >= width ||
          enemy.y < 0 ||
          enemy.y >= height
        ) {
          errors.push(
            `Enemy #${idx + 1} (${enemy.name || enemy.id}) position (${
              enemy.x
            }, ${enemy.y}) is out of bounds.`
          );
        } else if (grid[enemy.y]?.[enemy.x] === "#") {
          errors.push(
            `Enemy #${idx + 1} (${enemy.name || enemy.id}) position (${
              enemy.x
            }, ${enemy.y}) cannot be inside a wall (#).`
          );
        }
      });
    }

    // 5. Item placement validation
    if (Array.isArray(room.items)) {
      room.items.forEach((item, idx) => {
        if (
          typeof item.x !== "number" ||
          typeof item.y !== "number" ||
          item.x < 0 ||
          item.x >= width ||
          item.y < 0 ||
          item.y >= height
        ) {
          errors.push(
            `Item #${idx + 1} (${item.name || item.id}) position (${item.x}, ${
              item.y
            }) is out of bounds.`
          );
        } else if (grid[item.y]?.[item.x] === "#") {
          errors.push(
            `Item #${idx + 1} (${item.name || item.id}) position (${item.x}, ${
              item.y
            }) cannot be inside a wall (#).`
          );
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function exportRoomToJson(room: DungeonRoom): string {
  return JSON.stringify(room, null, 2);
}

export function importRoomFromJson(jsonString: string): {
  room?: DungeonRoom;
  errors: string[];
} {
  try {
    const parsed = JSON.parse(jsonString);
    const validation = validateDungeonRoom(parsed);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    // Standardize start and exit coordinates if 'S' or 'E' exist on grid
    const grid: string[][] = parsed.grid.map((row: string[]) => [...row]);
    const height = grid.length;
    const width = grid[0].length;
    let startX = parsed.startX ?? 1;
    let startY = parsed.startY ?? 1;
    let exitX = parsed.exitX ?? width - 2;
    let exitY = parsed.exitY ?? height - 2;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === "S" || grid[r][c] === "@") {
          startX = c;
          startY = r;
          grid[r][c] = " ";
        } else if (grid[r][c] === "E") {
          exitX = c;
          exitY = r;
        }
      }
    }

    const room: DungeonRoom = {
      id: parsed.id || "custom",
      index: parsed.index ?? 0,
      title: parsed.title || "Custom Dungeon Room",
      repo: parsed.repo || "custom/repository",
      mechanic: parsed.mechanic || "Custom Level",
      badge: parsed.badge || "CUSTOM",
      width,
      height,
      grid,
      startX,
      startY,
      exitX,
      exitY,
      enemies: Array.isArray(parsed.enemies) ? parsed.enemies : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };

    return { room, errors: [] };
  } catch (err) {
    return {
      errors: [
        `Invalid JSON formatting: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }
}
