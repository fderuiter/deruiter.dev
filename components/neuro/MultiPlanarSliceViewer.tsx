"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ControlPoint,
  SlicePlane,
  ToolMode,
  VectorContourPath,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import { SyntheticVolume, VOLUME_SIZE } from "@/lib/neuro/volume-generator";
import { IconLayersSubtract } from "@tabler/icons-react";
import { drawSlice } from "./drawSlice";
import { sliceIndex } from "./slice-geometry";
import { useSliceInteraction } from "./useSliceInteraction";

interface MultiPlanarSliceViewerProps {
  volume: SyntheticVolume;
  crosshair: VoxelCoord;
  toolMode: ToolMode;
  brushRadius: number;
  showPialContour: boolean;
  showWmContour: boolean;
  controlPoints: ControlPoint[];
  vectorContours?: VectorContourPath[];
  roiMask?: Uint8Array;
  onCrosshairChange: (coord: VoxelCoord) => void;
  onAddControlPoint: (point: Omit<ControlPoint, "id" | "timestamp">) => void;
  onApplyVoxelEdits: (edits: VoxelEdit[]) => void;
  onSelectROISeed?: (coord: VoxelCoord) => void;
}

/** How each plane is labelled: its name, slice axis and compass badges. */
const PLANES: Record<
  SlicePlane,
  {
    title: string;
    axis: "x" | "y" | "z";
    direction: string;
    compass: [top: string, bottom: string, left: string, right: string];
  }
> = {
  coronal: {
    title: "Coronal",
    axis: "y",
    direction: "ANT / POST",
    compass: ["S", "I", "R", "L"],
  },
  axial: {
    title: "Axial",
    axis: "z",
    direction: "SUP / INF",
    compass: ["A", "P", "R", "L"],
  },
  sagittal: {
    title: "Sagittal",
    axis: "x",
    direction: "LEFT / RIGHT",
    compass: ["S", "I", "A", "P"],
  },
};

const PLANE_ORDER: SlicePlane[] = ["coronal", "axial", "sagittal"];

const COMPASS_POSITIONS = [
  "top-1 left-1/2 -translate-x-1/2",
  "bottom-1 left-1/2 -translate-x-1/2",
  "left-1 top-1/2 -translate-y-1/2",
  "right-1 top-1/2 -translate-y-1/2",
];

type SliceInteraction = ReturnType<typeof useSliceInteraction>;

/** One plane's slice canvas, wired to the viewer's pointer handling. */
function SliceCanvas({
  plane,
  crosshair,
  focused,
  canvasRef,
  interaction,
}: {
  plane: SlicePlane;
  crosshair: VoxelCoord;
  focused: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  interaction: SliceInteraction;
}) {
  const { title, axis } = PLANES[plane];
  const touchPoint = (e: React.TouchEvent<HTMLCanvasElement>) =>
    e.touches[0] || e.changedTouches[0];
  return (
    <canvas
      ref={canvasRef}
      role="img"
      tabIndex={0}
      aria-label={`${focused ? "Focused 2D" : "2D"} ${title} MRI Slice View at ${axis.toUpperCase()}=${crosshair[axis]}. Click or drag to inspect or apply edits.`}
      onMouseDown={(e) =>
        interaction.press(plane, e.currentTarget, e.clientX, e.clientY)
      }
      onMouseMove={(e) => {
        interaction.hover(plane, e.currentTarget, e.clientX, e.clientY);
        interaction.drag(plane, e.currentTarget, e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        const touch = touchPoint(e);
        interaction.press(plane, e.currentTarget, touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        const touch = touchPoint(e);
        interaction.drag(plane, e.currentTarget, touch.clientX, touch.clientY);
      }}
      onTouchEnd={interaction.release}
      onWheel={(e) => {
        e.preventDefault();
        interaction.scroll(plane, e.deltaY);
      }}
      style={{ touchAction: "none" }}
      className="w-full h-full object-contain cursor-crosshair"
    />
  );
}

export const MultiPlanarSliceViewer: React.FC<MultiPlanarSliceViewerProps> = ({
  volume,
  crosshair,
  toolMode,
  brushRadius,
  showPialContour,
  showWmContour,
  controlPoints,
  vectorContours,
  roiMask: _roiMask,
  onCrosshairChange,
  onAddControlPoint,
  onApplyVoxelEdits,
  onSelectROISeed,
}) => {
  const [activePlane, setActivePlane] = useState<SlicePlane>("coronal");
  const [viewLayout, setViewLayout] = useState<"focused" | "multi">("multi");

  const axialCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRefs: Record<
    SlicePlane,
    React.RefObject<HTMLCanvasElement | null>
  > = {
    axial: axialCanvasRef,
    coronal: coronalCanvasRef,
    sagittal: sagittalCanvasRef,
  };

  const interaction = useSliceInteraction({
    volume,
    crosshair,
    toolMode,
    brushRadius,
    controlPointCount: controlPoints.length,
    onCrosshairChange,
    onAddControlPoint,
    onApplyVoxelEdits,
    onSelectROISeed,
  });

  // Redraw every slice on change, and again when a lost context comes back
  useEffect(() => {
    const overlays = {
      crosshair,
      showPialContour,
      showWmContour,
      controlPoints,
      vectorContours,
    };
    const planes: [SlicePlane, HTMLCanvasElement | null][] = [
      ["axial", axialCanvasRef.current],
      ["coronal", coronalCanvasRef.current],
      ["sagittal", sagittalCanvasRef.current],
    ];
    const redrawAll = () => {
      for (const [plane, canvas] of planes) {
        drawSlice(
          canvas,
          volume,
          plane,
          sliceIndex(plane, crosshair),
          overlays
        );
      }
    };

    redrawAll();

    const handleLoss = (e: Event) => {
      e.preventDefault();
    };

    const canvases = planes
      .map(([, canvas]) => canvas)
      .filter(Boolean) as HTMLCanvasElement[];

    canvases.forEach((c) => {
      c.addEventListener("contextlost", handleLoss);
      c.addEventListener("contextrestored", redrawAll);
    });

    return () => {
      canvases.forEach((c) => {
        c.removeEventListener("contextlost", handleLoss);
        c.removeEventListener("contextrestored", redrawAll);
      });
    };
  }, [
    volume,
    crosshair,
    showPialContour,
    showWmContour,
    controlPoints,
    vectorContours,
    viewLayout,
    activePlane,
  ]);

  return (
    <div
      onMouseUp={interaction.release}
      onMouseLeave={interaction.release}
      className="relative w-full h-full flex-1 min-h-[380px] bg-zinc-950 rounded-2xl border border-zinc-800/80 p-3 flex flex-col gap-3 select-none"
    >
      {/* Top Header / View Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <IconLayersSubtract className="w-4 h-4 text-brand-cyan" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            2D Multi-Planar Orthoview
          </span>
          <span className="text-[11px] font-mono text-zinc-400">
            [SCROLL TO SLICE · CLICK TO EDIT]
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="bg-zinc-900 border border-zinc-750 px-2.5 py-1 rounded-lg text-zinc-300">
            <span>INTENSITY: </span>
            <span className="font-bold text-brand-cyan">
              {interaction.hoverIntensity !== null
                ? `${interaction.hoverIntensity}`
                : "—"}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-750 p-0.5 rounded-lg">
            <button
              onClick={() => setViewLayout("multi")}
              className={`px-2 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-3 rounded-md transition-all ${
                viewLayout === "multi"
                  ? "bg-brand-cyan text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              3-Planar
            </button>
            <button
              onClick={() => setViewLayout("focused")}
              className={`px-2 py-0.5 pointer-coarse:min-h-11 pointer-coarse:px-3 rounded-md transition-all ${
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
          {PLANE_ORDER.map((plane) => {
            const { title, axis, direction, compass } = PLANES[plane];
            const label = axis.toUpperCase();
            return (
              <div
                key={plane}
                className="flex flex-col bg-zinc-900/60 rounded-xl border border-zinc-800 p-2 relative"
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1.5 px-1">
                  <span className="text-brand-cyan font-bold">
                    {title.toUpperCase()} ({label}={crosshair[axis]})
                  </span>
                  <span className="text-zinc-400">{direction}</span>
                </div>
                <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black">
                  {/* Anatomical Compass Badges */}
                  {compass.map((badge, i) => (
                    <span
                      key={COMPASS_POSITIONS[i]}
                      className={`absolute ${COMPASS_POSITIONS[i]} text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950/80 px-1 rounded pointer-events-none z-10`}
                    >
                      {badge}
                    </span>
                  ))}
                  <SliceCanvas
                    plane={plane}
                    crosshair={crosshair}
                    focused={false}
                    canvasRef={canvasRefs[plane]}
                    interaction={interaction}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max={VOLUME_SIZE - 1}
                  value={crosshair[axis]}
                  aria-label={`${title} slice`}
                  aria-valuetext={`${title} slice ${label} = ${crosshair[axis]}`}
                  onChange={(e) =>
                    onCrosshairChange({
                      ...crosshair,
                      [axis]: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full mt-2 accent-brand-cyan h-1 bg-zinc-800 pointer-coarse:h-11 pointer-coarse:bg-transparent rounded-lg cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Focused Single View */
        <div className="flex flex-col flex-1 bg-zinc-900/60 rounded-xl border border-zinc-800 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap gap-2">
              {PLANE_ORDER.map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePlane(p)}
                  className={`px-3 py-1 pointer-coarse:min-h-11 rounded-lg text-xs font-mono uppercase font-bold transition-all ${
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
              SLICE: {PLANES[activePlane].axis.toUpperCase()} ={" "}
              {crosshair[PLANES[activePlane].axis]}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-black max-h-[480px]">
            <SliceCanvas
              key={activePlane}
              plane={activePlane}
              crosshair={crosshair}
              focused
              canvasRef={canvasRefs[activePlane]}
              interaction={interaction}
            />
          </div>
        </div>
      )}
    </div>
  );
};
