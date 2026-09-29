"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { clamp } from "@/lib/game-utils";
import {
  ControlPoint,
  SlicePlane,
  ToolMode,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import {
  extractSlice,
  SyntheticVolume,
  VOLUME_SIZE,
} from "@/lib/neuro/volume-generator";
import { IconLayersSubtract } from "@tabler/icons-react";

interface MultiPlanarSliceViewerProps {
  volume: SyntheticVolume;
  crosshair: VoxelCoord;
  toolMode: ToolMode;
  brushRadius: number;
  showPialContour: boolean;
  showWmContour: boolean;
  controlPoints: ControlPoint[];
  onCrosshairChange: (coord: VoxelCoord) => void;
  onAddControlPoint: (point: Omit<ControlPoint, "id" | "timestamp">) => void;
  onApplyVoxelEdits: (edits: VoxelEdit[]) => void;
}

export const MultiPlanarSliceViewer: React.FC<MultiPlanarSliceViewerProps> = ({
  volume,
  crosshair,
  toolMode,
  brushRadius,
  showPialContour,
  showWmContour,
  controlPoints,
  onCrosshairChange,
  onAddControlPoint,
  onApplyVoxelEdits,
}) => {
  const [activePlane, setActivePlane] = useState<SlicePlane>("coronal");
  const [viewLayout, setViewLayout] = useState<"focused" | "multi">("multi");
  const [hoverIntensity, setHoverIntensity] = useState<number | null>(null);

  const isMouseDownRef = useRef(false);
  const activePlaneRef = useRef<SlicePlane>("coronal");

  // Canvases for each anatomical plane
  const axialCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement | null>(null);

/* jscpd:ignore-start */
  /**
   * Render an individual 2D anatomical slice onto a Canvas 2D context
   */
  const renderSliceToCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, plane: SlicePlane, sliceIdx: number) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sliceData = extractSlice(volume, plane, sliceIdx);
      const { width, height, pixels, mask, wm } = sliceData;

      canvas.width = width;
      canvas.height = height;

      // Draw grayscale MRI pixels
      const imgData = ctx.createImageData(width, height);
      for (let i = 0; i < pixels.length; i++) {
        const val = pixels[i];
        const pIdx = i * 4;
        imgData.data[pIdx] = val; // R
        imgData.data[pIdx + 1] = val; // G
        imgData.data[pIdx + 2] = val; // B
        imgData.data[pIdx + 3] = 255; // Alpha
      }
      ctx.putImageData(imgData, 0, 0);

      // Render Pial Surface (Red contour)
      if (showPialContour) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // Red-500
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (mask[idx] === 1) {
              // Edge detection
              if (
                mask[idx - 1] === 0 ||
                mask[idx + 1] === 0 ||
                mask[idx - width] === 0 ||
                mask[idx + width] === 0
              ) {
                ctx.rect(x, y, 1, 1);
              }
            }
          }
        }
        ctx.stroke();
      }

      // Render White Matter Surface (Yellow contour)
      if (showWmContour) {
        ctx.strokeStyle = "rgba(234, 179, 8, 0.9)"; // Yellow-500
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (wm[idx] === 1) {
              if (
                wm[idx - 1] === 0 ||
                wm[idx + 1] === 0 ||
                wm[idx - width] === 0 ||
                wm[idx + width] === 0
              ) {
                ctx.rect(x, y, 1, 1);
              }
/* jscpd:ignore-end */
            }
          }
        }
        ctx.stroke();
      }

      // Render Defect Bounding Box if intersecting current slice
      const { min, max } = volume.defectRegion;
      let inDefectSlice = false;
      let dX = 0,
        dY = 0,
        dW = 0,
        dH = 0;

      if (plane === "axial" && sliceIdx >= min.z && sliceIdx <= max.z) {
        inDefectSlice = true;
        dX = min.x;
        dY = min.y;
        dW = max.x - min.x;
        dH = max.y - min.y;
      } else if (
        plane === "coronal" &&
        sliceIdx >= min.y &&
        sliceIdx <= max.y
      ) {
        inDefectSlice = true;
        dX = min.x;
        dY = height - 1 - max.z;
        dW = max.x - min.x;
        dH = max.z - min.z;
      } else if (
        plane === "sagittal" &&
        sliceIdx >= min.x &&
        sliceIdx <= max.x
      ) {
        inDefectSlice = true;
        dX = min.y;
        dY = height - 1 - max.z;
        dW = max.y - min.y;
        dH = max.z - min.z;
      }

      if (inDefectSlice && dW > 0 && dH > 0) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.75)"; // Amber-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(dX, dY, dW, dH);
        ctx.setLineDash([]);
      }

      // Render Control Points located near this slice (within 1.5 slices)
      controlPoints.forEach((cp) => {
        let isNear = false;
        let cX = 0;
        let cY = 0;

        if (plane === "axial" && Math.abs(cp.z - sliceIdx) <= 1.5) {
          isNear = true;
          cX = cp.x;
          cY = cp.y;
        } else if (plane === "coronal" && Math.abs(cp.y - sliceIdx) <= 1.5) {
          isNear = true;
          cX = cp.x;
          cY = height - 1 - cp.z;
        } else if (plane === "sagittal" && Math.abs(cp.x - sliceIdx) <= 1.5) {
          isNear = true;
          cX = cp.y;
          cY = height - 1 - cp.z;
        }

        if (isNear) {
          ctx.strokeStyle = "#00f5d4"; // Cyan
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cX, cY, 3.5, 0, Math.PI * 2);
          ctx.stroke();
          // Cross
          ctx.beginPath();
          ctx.moveTo(cX - 5, cY);
          ctx.lineTo(cX + 5, cY);
          ctx.moveTo(cX, cY - 5);
          ctx.lineTo(cX, cY + 5);
          ctx.stroke();
        }
      });

      // Render Crosshair Reticle
      let crossX = 0;
      let crossY = 0;
      if (plane === "axial") {
        crossX = crosshair.x;
        crossY = crosshair.y;
      } else if (plane === "coronal") {
        crossX = crosshair.x;
        crossY = height - 1 - crosshair.z;
      } else {
        crossX = crosshair.y;
        crossY = height - 1 - crosshair.z;
      }

      ctx.strokeStyle = "rgba(16, 185, 129, 0.65)"; // Emerald-500
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 2]);
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(0, crossY);
      ctx.lineTo(width, crossY);
      ctx.stroke();
      // Vertical
      ctx.beginPath();
      ctx.moveTo(crossX, 0);
      ctx.lineTo(crossX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [volume, crosshair, showPialContour, showWmContour, controlPoints]
  );

  // Render all active slice views on state update and context restoration
  useEffect(() => {
    const redrawAll = () => {
      renderSliceToCanvas(axialCanvasRef.current, "axial", crosshair.z);
      renderSliceToCanvas(coronalCanvasRef.current, "coronal", crosshair.y);
      renderSliceToCanvas(sagittalCanvasRef.current, "sagittal", crosshair.x);
    };

    redrawAll();

    const handleRestore = () => {
      redrawAll();
    };

    const handleLoss = (e: Event) => {
      e.preventDefault();
    };

    const canvases = [
      axialCanvasRef.current,
      coronalCanvasRef.current,
      sagittalCanvasRef.current,
    ].filter(Boolean) as HTMLCanvasElement[];

    canvases.forEach((c) => {
      c.addEventListener("contextlost", handleLoss);
      c.addEventListener("contextrestored", handleRestore);
    });

    return () => {
      canvases.forEach((c) => {
        c.removeEventListener("contextlost", handleLoss);
        c.removeEventListener("contextrestored", handleRestore);
      });
    };
  }, [renderSliceToCanvas, crosshair]);

/* jscpd:ignore-start */
  /**
   * Convert canvas mouse event to 3D Voxel Coordinate
   */
  const getVoxelFromCanvas = (
    e: React.MouseEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ): VoxelCoord => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = Math.floor((e.clientX - rect.left) * scaleX);
    const clickY = Math.floor((e.clientY - rect.top) * scaleY);

    const clampedX = clamp(clickX, 0, VOLUME_SIZE - 1);
    const clampedY = clamp(clickY, 0, VOLUME_SIZE - 1);

    if (plane === "axial") {
      return { x: clampedX, y: clampedY, z: crosshair.z };
    } else if (plane === "coronal") {
      const z = VOLUME_SIZE - 1 - clampedY;
      return { x: clampedX, y: crosshair.y, z: clamp(z, 0, VOLUME_SIZE - 1) };
    } else {
      const z = VOLUME_SIZE - 1 - clampedY;
      return { x: crosshair.x, y: clampedX, z: clamp(z, 0, VOLUME_SIZE - 1) };
    }
  };

  /**
   * Apply editing tool action at coordinate
   */
  const handleToolAction = (coord: VoxelCoord) => {
    if (toolMode === "control_point") {
      onAddControlPoint({
        x: coord.x,
        y: coord.y,
        z: coord.z,
        intensity: 110,
        label: `CP-${controlPoints.length + 1}`,
      });
    } else if (toolMode === "paint" || toolMode === "erase") {
      const edits: VoxelEdit[] = [];
      const newValue = toolMode === "paint" ? 1 : 0;
      const radius = brushRadius;

      for (let dz = -radius; dz <= radius; dz++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy + dz * dz <= radius * radius) {
              const vx = coord.x + dx;
              const vy = coord.y + dy;
              const vz = coord.z + dz;

              if (
                vx >= 0 &&
                vx < VOLUME_SIZE &&
                vy >= 0 &&
                vy < VOLUME_SIZE &&
                vz >= 0 &&
                vz < VOLUME_SIZE
              ) {
                edits.push({
                  x: vx,
                  y: vy,
                  z: vz,
                  originalValue: toolMode === "paint" ? 0 : 1,
                  newValue,
                  layer: "brainmask",
                });
              }
/* jscpd:ignore-end */
            }
          }
        }
      }

      if (edits.length > 0) {
        onApplyVoxelEdits(edits);
      }
    }
  };

/* jscpd:ignore-start */
  /**
   * Convert canvas touch event to 3D Voxel Coordinate
   */
  const getVoxelFromTouchEvent = (
    e: React.TouchEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ): VoxelCoord => {
    const touch = e.touches[0] || e.changedTouches[0];
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const touchX = Math.floor((touch.clientX - rect.left) * scaleX);
    const touchY = Math.floor((touch.clientY - rect.top) * scaleY);

    const clampedX = clamp(touchX, 0, VOLUME_SIZE - 1);
    const clampedY = clamp(touchY, 0, VOLUME_SIZE - 1);

    if (plane === "axial") {
      return { x: clampedX, y: clampedY, z: crosshair.z };
    } else if (plane === "coronal") {
      const z = VOLUME_SIZE - 1 - clampedY;
      return { x: clampedX, y: crosshair.y, z: clamp(z, 0, VOLUME_SIZE - 1) };
    } else {
      const z = VOLUME_SIZE - 1 - clampedY;
      return { x: crosshair.x, y: clampedX, z: clamp(z, 0, VOLUME_SIZE - 1) };
    }
  };

  const handleCanvasTouchStart = (
    e: React.TouchEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ) => {
    isMouseDownRef.current = true;
    activePlaneRef.current = plane;
    const coord = getVoxelFromTouchEvent(e, plane);
    onCrosshairChange(coord);
    handleToolAction(coord);
  };

  const handleCanvasTouchMove = (
    e: React.TouchEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ) => {
    const coord = getVoxelFromTouchEvent(e, plane);
    if (
      isMouseDownRef.current &&
      (toolMode === "paint" || toolMode === "erase")
    ) {
      onCrosshairChange(coord);
      handleToolAction(coord);
    }
  };

  const handleCanvasTouchEnd = () => {
    isMouseDownRef.current = false;
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ) => {
    isMouseDownRef.current = true;
    activePlaneRef.current = plane;
    const coord = getVoxelFromCanvas(e, plane);
    onCrosshairChange(coord);
    handleToolAction(coord);
  };

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
    plane: SlicePlane
  ) => {
    const coord = getVoxelFromCanvas(e, plane);

    // Get intensity under cursor
    const sliceData = extractSlice(
      volume,
      plane,
      plane === "axial"
        ? crosshair.z
        : plane === "coronal"
          ? crosshair.y
          : crosshair.x
    );
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor(
      (e.clientY - rect.top) * (canvas.height / rect.height)
    );
    const idx = y * sliceData.width + x;
    if (idx >= 0 && idx < sliceData.pixels.length) {
      setHoverIntensity(sliceData.pixels[idx]);
    }

    if (
      isMouseDownRef.current &&
      (toolMode === "paint" || toolMode === "erase")
    ) {
      onCrosshairChange(coord);
      handleToolAction(coord);
    }
  };

  const handleCanvasMouseUp = () => {
    isMouseDownRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent, plane: SlicePlane) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    if (plane === "axial") {
      const nextZ = clamp(crosshair.z + delta, 0, VOLUME_SIZE - 1);
      onCrosshairChange({ ...crosshair, z: nextZ });
    } else if (plane === "coronal") {
      const nextY = clamp(crosshair.y + delta, 0, VOLUME_SIZE - 1);
      onCrosshairChange({ ...crosshair, y: nextY });
    } else {
      const nextX = clamp(crosshair.x + delta, 0, VOLUME_SIZE - 1);
      onCrosshairChange({ ...crosshair, x: nextX });
    }
  };

  return (
    <div
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      className="relative w-full h-full min-h-[380px] bg-zinc-950 rounded-2xl border border-zinc-800/80 p-3 flex flex-col gap-3 select-none"
    >
      {/* Top Header / View Mode Controls */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <IconLayersSubtract className="w-4 h-4 text-brand-cyan" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            2D Multi-Planar Orthoview
          </span>
          <span className="text-[11px] font-mono text-zinc-400">
            [SCROLL TO SLICE · CLICK TO EDIT]
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="bg-zinc-900 border border-zinc-750 px-2.5 py-1 rounded-lg text-zinc-300">
            <span>INTENSITY: </span>
            <span className="font-bold text-brand-cyan">
              {hoverIntensity !== null ? `${hoverIntensity}` : "—"}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-750 p-0.5 rounded-lg">
            <button
              onClick={() => setViewLayout("multi")}
              className={`px-2 py-0.5 rounded-md transition-all ${
                viewLayout === "multi"
                  ? "bg-brand-cyan text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              3-Planar
            </button>
            <button
              onClick={() => setViewLayout("focused")}
              className={`px-2 py-0.5 rounded-md transition-all ${
                viewLayout === "focused"
                  ? "bg-brand-cyan text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Focused
            </button>
          </div>
        </div>
      </div>

      {/* Slices Container */}
      {viewLayout === "multi" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
          {/* Coronal Pane */}
          <div className="flex flex-col bg-zinc-900/60 rounded-xl border border-zinc-800 p-2 relative">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5 px-1">
              <span className="text-brand-cyan font-bold">
                CORONAL (Y={crosshair.y})
              </span>
              <span className="text-zinc-400">ANT / POST</span>
            </div>
            <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black">
              {/* Anatomical Compass Badges */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                S
              </span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                I
              </span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                R
              </span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                L
              </span>
              <canvas
                ref={coronalCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`2D Coronal MRI Slice View at Y=${crosshair.y}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "coronal")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "coronal")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "coronal")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "coronal")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "coronal")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
            <input
              type="range"
              min="0"
              max={VOLUME_SIZE - 1}
              value={crosshair.y}
              onChange={(e) =>
                onCrosshairChange({
                  ...crosshair,
                  y: parseInt(e.target.value, 10),
                })
              }
              className="w-full mt-2 accent-brand-cyan h-1 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Axial Pane */}
          <div className="flex flex-col bg-zinc-900/60 rounded-xl border border-zinc-800 p-2 relative">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5 px-1">
              <span className="text-brand-cyan font-bold">
                AXIAL (Z={crosshair.z})
              </span>
              <span className="text-zinc-400">SUP / INF</span>
            </div>
            <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black">
              {/* Anatomical Compass Badges */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                A
              </span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                P
              </span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                R
              </span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                L
              </span>
              <canvas
                ref={axialCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`2D Axial MRI Slice View at Z=${crosshair.z}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "axial")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "axial")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "axial")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "axial")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "axial")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
            <input
              type="range"
              min="0"
              max={VOLUME_SIZE - 1}
              value={crosshair.z}
              onChange={(e) =>
                onCrosshairChange({
                  ...crosshair,
                  z: parseInt(e.target.value, 10),
                })
              }
              className="w-full mt-2 accent-brand-cyan h-1 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sagittal Pane */}
          <div className="flex flex-col bg-zinc-900/60 rounded-xl border border-zinc-800 p-2 relative">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5 px-1">
              <span className="text-brand-cyan font-bold">
                SAGITTAL (X={crosshair.x})
              </span>
              <span className="text-zinc-400">LEFT / RIGHT</span>
            </div>
            <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black">
              {/* Anatomical Compass Badges */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                S
              </span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                I
              </span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                A
              </span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-950/80 px-1 rounded pointer-events-none z-10">
                P
              </span>
              <canvas
                ref={sagittalCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`2D Sagittal MRI Slice View at X=${crosshair.x}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "sagittal")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "sagittal")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "sagittal")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "sagittal")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "sagittal")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            </div>
            <input
              type="range"
              min="0"
              max={VOLUME_SIZE - 1}
              value={crosshair.x}
              onChange={(e) =>
                onCrosshairChange({
                  ...crosshair,
                  x: parseInt(e.target.value, 10),
                })
              }
              className="w-full mt-2 accent-brand-cyan h-1 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      ) : (
        /* Focused Single View */
        <div className="flex flex-col flex-1 bg-zinc-900/60 rounded-xl border border-zinc-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              {(["coronal", "axial", "sagittal"] as SlicePlane[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePlane(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono uppercase font-bold transition-all ${
                    activePlane === p
                      ? "bg-brand-cyan text-zinc-950"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <span className="text-xs font-mono text-zinc-400">
              SLICE:{" "}
              {activePlane === "axial"
                ? `Z = ${crosshair.z}`
                : activePlane === "coronal"
                  ? `Y = ${crosshair.y}`
                  : `X = ${crosshair.x}`}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black max-h-[480px]">
            {activePlane === "axial" && (
              <canvas
                ref={axialCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`Focused 2D Axial MRI Slice View at Z=${crosshair.z}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "axial")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "axial")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "axial")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "axial")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "axial")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            )}
            {activePlane === "coronal" && (
              <canvas
                ref={coronalCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`Focused 2D Coronal MRI Slice View at Y=${crosshair.y}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "coronal")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "coronal")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "coronal")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "coronal")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "coronal")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            )}
            {activePlane === "sagittal" && (
              <canvas
                ref={sagittalCanvasRef}
                role="img"
                tabIndex={0}
                aria-label={`Focused 2D Sagittal MRI Slice View at X=${crosshair.x}. Click or drag to inspect or apply edits.`}
                onMouseDown={(e) => handleCanvasMouseDown(e, "sagittal")}
                onMouseMove={(e) => handleCanvasMouseMove(e, "sagittal")}
                onTouchStart={(e) => handleCanvasTouchStart(e, "sagittal")}
                onTouchMove={(e) => handleCanvasTouchMove(e, "sagittal")}
                onTouchEnd={handleCanvasTouchEnd}
                onWheel={(e) => handleWheel(e, "sagittal")}
                style={{ touchAction: "none" }}
                className="w-full h-full object-contain cursor-crosshair"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
/* jscpd:ignore-end */
};
