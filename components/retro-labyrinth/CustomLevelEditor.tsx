"use client";

import React, { useState, useMemo } from "react";
import {
  IconX,
  IconDownload,
  IconUpload,
  IconPlayerPlay,
  IconCheck,
  IconAlertTriangle,
  IconGridDots,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { downloadFile } from "@/lib/download";
import {
  createDefaultCustomRoom,
  validateDungeonRoom,
  exportRoomToJson,
  importRoomFromJson,
} from "@/lib/retro-labyrinth/level-schema";
import type { DungeonRoom } from "@/lib/dungeon/types";

export interface CustomLevelEditorProps {
  initialRoom?: DungeonRoom;
  onPlayCustomLevel: (room: DungeonRoom) => void;
  onClose: () => void;
}

type PaletteTool =
  | "wall"
  | "floor"
  | "start"
  | "exit"
  | "enemy_zombie"
  | "enemy_drone"
  | "item_coffee";

export const CustomLevelEditor: React.FC<CustomLevelEditorProps> = ({
  initialRoom,
  onPlayCustomLevel,
  onClose,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });

  const [room, setRoom] = useState<DungeonRoom>(
    initialRoom
      ? JSON.parse(JSON.stringify(initialRoom))
      : createDefaultCustomRoom()
  );
  const [activeTool, setActiveTool] = useState<PaletteTool>("wall");
  const [importError, setImportError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Derived schema validation result
  const validationResult = useMemo(() => validateDungeonRoom(room), [room]);
  const validationErrors = importError
    ? [importError, ...validationResult.errors]
    : validationResult.errors;

  const handleCellPaint = (r: number, c: number) => {
    const grid = room.grid.map((row) => [...row]);
    let enemies = [...room.enemies];
    let items = [...room.items];
    let startX = room.startX;
    let startY = room.startY;
    let exitX = room.exitX;
    let exitY = room.exitY;

    // Remove any existing enemy or item at (c, r)
    enemies = enemies.filter((e) => !(e.x === c && e.y === r));
    items = items.filter((i) => !(i.x === c && i.y === r));

    switch (activeTool) {
      case "wall":
        grid[r][c] = "#";
        break;
      case "floor":
        grid[r][c] = " ";
        break;
      case "start":
        // Remove old start tile on grid
        for (let row = 0; row < room.height; row++) {
          for (let col = 0; col < room.width; col++) {
            if (grid[row][col] === "S" || grid[row][col] === "@") {
              grid[row][col] = " ";
            }
          }
        }
        grid[r][c] = "S";
        startX = c;
        startY = r;
        break;
      case "exit":
        // Remove old exit tile on grid
        for (let row = 0; row < room.height; row++) {
          for (let col = 0; col < room.width; col++) {
            if (grid[row][col] === "E") {
              grid[row][col] = " ";
            }
          }
        }
        grid[r][c] = "E";
        exitX = c;
        exitY = r;
        break;
      case "enemy_zombie":
        grid[r][c] = " ";
        enemies.push({
          id: `enemy-zombie-${c}-${r}`,
          type: "zombie",
          name: "Zombie Daemon",
          x: c,
          y: r,
          hp: 12,
          maxHp: 12,
          patrolDir: "left",
          color: "#ef4444",
          symbol: "Z",
          state: "patrol",
        });
        break;
      case "enemy_drone":
        grid[r][c] = " ";
        enemies.push({
          id: `enemy-drone-${c}-${r}`,
          type: "drone",
          name: "Security Drone",
          x: c,
          y: r,
          hp: 10,
          maxHp: 10,
          patrolDir: "left",
          color: "#3b82f6",
          symbol: "D",
          state: "patrol",
        });
        break;
      case "item_coffee":
        grid[r][c] = " ";
        items.push({
          id: `item-coffee-${c}-${r}`,
          itemId: "coffee",
          name: "Hot Espresso",
          x: c,
          y: r,
          symbol: "☕",
          color: "#f59e0b",
          collected: false,
        });
        break;
    }

    setImportError(null);
    setRoom({
      ...room,
      grid,
      enemies,
      items,
      startX,
      startY,
      exitX,
      exitY,
    });
  };

  const handleDimensionChange = (newW: number, newH: number) => {
    if (newW < 3 || newH < 3 || newW > 30 || newH > 30) return;

    const newGrid: string[][] = Array.from({ length: newH }, (_, r) =>
      Array.from({ length: newW }, (_, c) => {
        if (r === 0 || r === newH - 1 || c === 0 || c === newW - 1) {
          return "#";
        }
        return room.grid[r]?.[c] ?? " ";
      })
    );

    // Keep start & exit inside bounds
    const startX = Math.min(room.startX, newW - 2);
    const startY = Math.min(room.startY, newH - 2);
    const exitX = Math.min(room.exitX, newW - 2);
    const exitY = Math.min(room.exitY, newH - 2);

    newGrid[exitY][exitX] = "E";

    setImportError(null);
    setRoom({
      ...room,
      width: newW,
      height: newH,
      grid: newGrid,
      startX,
      startY,
      exitX,
      exitY,
      enemies: room.enemies.filter((e) => e.x < newW - 1 && e.y < newH - 1),
      items: room.items.filter((i) => i.x < newW - 1 && i.y < newH - 1),
    });
  };

  const handleExportJson = () => {
    if (!validationResult.valid) {
      setStatusMessage("Cannot export invalid level layout. Fix errors first.");
      return;
    }
    const jsonStr = exportRoomToJson(room);
    const filename = `dungeon-room-${room.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`;
    downloadFile(jsonStr, filename, {
      mimeType: "application/json;charset=utf-8",
    });
    setStatusMessage("Level definition exported successfully!");
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const { room: importedRoom, errors } = importRoomFromJson(content);
        if (importedRoom && errors.length === 0) {
          setRoom(importedRoom);
          setImportError(null);
          setStatusMessage("Custom level imported successfully!");
        } else {
          setImportError(errors.join(" "));
          setStatusMessage("Failed to import custom level: invalid schema.");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePlayLevel = () => {
    if (!validationResult.valid) {
      setStatusMessage("Cannot start game with invalid level layout!");
      return;
    }
    onPlayCustomLevel(room);
  };

  return (
    <div
      className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Custom Level Editor"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-4xl bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl p-4 sm:p-6 text-zinc-100 relative max-h-[90vh] flex flex-col overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <IconGridDots className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-emerald-400 uppercase tracking-wider">
                CUSTOM LEVEL AUTHORING STUDIO
              </h2>
              <p className="text-xs text-neutral-400">
                Design custom dungeon maps with walls, player spawns, exits,
                enemies, and pickups.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close custom level editor"
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto my-3 space-y-4 pr-1">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800 text-xs">
            <div>
              <label
                htmlFor="room-title-input"
                className="block text-neutral-400 font-semibold mb-1"
              >
                Level Title
              </label>
              <input
                id="room-title-input"
                type="text"
                value={room.title}
                onChange={(e) => setRoom({ ...room, title: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-zinc-100 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="room-repo-input"
                className="block text-neutral-400 font-semibold mb-1"
              >
                Repository Slug
              </label>
              <input
                id="room-repo-input"
                type="text"
                value={room.repo}
                onChange={(e) => setRoom({ ...room, repo: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-zinc-100 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">
                Grid Dimensions (W x H)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={25}
                  aria-label="Level Grid Width"
                  value={room.width}
                  onChange={(e) =>
                    handleDimensionChange(
                      parseInt(e.target.value) || 15,
                      room.height
                    )
                  }
                  className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-zinc-100 focus:border-emerald-400 focus:outline-none"
                />
                <span className="text-neutral-500">x</span>
                <input
                  type="number"
                  min={5}
                  max={25}
                  aria-label="Level Grid Height"
                  value={room.height}
                  onChange={(e) =>
                    handleDimensionChange(
                      room.width,
                      parseInt(e.target.value) || 9
                    )
                  }
                  className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-zinc-100 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tool Palette */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Tool Palette
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                {
                  id: "wall",
                  label: "Wall (#)",
                  color: "bg-emerald-950 border-emerald-500 text-emerald-400",
                },
                {
                  id: "floor",
                  label: "Floor ( )",
                  color: "bg-neutral-900 border-neutral-700 text-zinc-300",
                },
                {
                  id: "start",
                  label: "Player Start (S)",
                  color: "bg-cyan-950 border-cyan-500 text-cyan-300",
                },
                {
                  id: "exit",
                  label: "Exit Portal (E)",
                  color: "bg-amber-950 border-amber-500 text-amber-300",
                },
                {
                  id: "enemy_zombie",
                  label: "Zombie (Z)",
                  color: "bg-red-950 border-red-500 text-red-400",
                },
                {
                  id: "enemy_drone",
                  label: "Drone (D)",
                  color: "bg-blue-950 border-blue-500 text-blue-400",
                },
                {
                  id: "item_coffee",
                  label: "Coffee (☕)",
                  color: "bg-yellow-950 border-yellow-500 text-yellow-300",
                },
              ].map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id as PaletteTool)}
                  aria-pressed={activeTool === tool.id}
                  className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer font-medium ${tool.color} ${
                    activeTool === tool.id
                      ? "ring-2 ring-emerald-400 font-bold scale-105"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Grid Canvas */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 flex flex-col items-center justify-center overflow-x-auto">
            <div
              className="grid gap-0.5 select-none bg-neutral-900 p-2 rounded border border-neutral-800"
              style={{
                gridTemplateColumns: `repeat(${room.width}, minmax(0, 1fr))`,
              }}
              onMouseDown={() => setIsMouseDown(true)}
              onMouseUp={() => setIsMouseDown(false)}
              onMouseLeave={() => setIsMouseDown(false)}
            >
              {room.grid.map((row, r) =>
                row.map((cell, c) => {
                  const isStart =
                    (room.startX === c && room.startY === r) ||
                    cell === "S" ||
                    cell === "@";
                  const isExit =
                    (room.exitX === c && room.exitY === r) || cell === "E";
                  const enemy = room.enemies.find(
                    (e) => e.x === c && e.y === r
                  );
                  const item = room.items.find((i) => i.x === c && i.y === r);

                  let cellBg =
                    "bg-neutral-900 hover:bg-neutral-800 text-neutral-600";
                  let cellContent = " ";

                  if (cell === "#") {
                    cellBg =
                      "bg-emerald-950/80 border border-emerald-800/50 text-emerald-400";
                    cellContent = "#";
                  } else if (isStart) {
                    cellBg =
                      "bg-cyan-900 border border-cyan-500 text-cyan-200 font-bold";
                    cellContent = "S";
                  } else if (isExit) {
                    cellBg =
                      "bg-amber-900 border border-amber-500 text-amber-200 font-bold";
                    cellContent = "E";
                  } else if (enemy) {
                    cellBg =
                      "bg-red-950 border border-red-600 text-red-300 font-bold";
                    cellContent = enemy.type === "drone" ? "D" : "Z";
                  } else if (item) {
                    cellBg =
                      "bg-yellow-950 border border-yellow-600 text-yellow-300 font-bold";
                    cellContent = "☕";
                  }

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      aria-label={`Grid cell (${c}, ${r}), tile: ${cellContent}`}
                      onClick={() => handleCellPaint(r, c)}
                      onMouseEnter={() => {
                        if (isMouseDown) handleCellPaint(r, c);
                      }}
                      className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-mono rounded cursor-pointer transition-colors ${cellBg}`}
                    >
                      {cellContent}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-neutral-500 mt-2">
              Tip: Click or drag over grid cells to paint active tool tiles.
            </p>
          </div>

          {/* Validation Feedback */}
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-1">
            <div className="flex items-center gap-2">
              {validationErrors.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <IconCheck className="w-4 h-4" />
                  Level Layout Validated & Schema Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400">
                  <IconAlertTriangle className="w-4 h-4" />
                  Schema Validation Violations ({validationErrors.length})
                </span>
              )}
            </div>
            {validationErrors.length > 0 && (
              <ul className="text-xs text-red-300/90 list-disc list-inside space-y-0.5 mt-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
            {statusMessage && (
              <p className="text-xs text-amber-300 pt-1 font-medium">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={validationErrors.length > 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-zinc-100 font-semibold cursor-pointer transition-colors"
            >
              <IconDownload className="w-4 h-4" />
              Export JSON
            </button>
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-zinc-100 font-semibold cursor-pointer transition-colors">
              <IconUpload className="w-4 h-4" />
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportJsonFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePlayLevel}
              disabled={validationErrors.length > 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold cursor-pointer transition-colors shadow-md"
            >
              <IconPlayerPlay className="w-4 h-4" />
              Play Level
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
