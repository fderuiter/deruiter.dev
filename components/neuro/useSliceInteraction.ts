import { useRef, useState } from "react";
import { coalesceStrokeVoxelEdits } from "@/lib/neuro/drafts";
import {
  ControlPoint,
  NeuroEditLayer,
  SlicePlane,
  ToolMode,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import {
  extractSlice,
  getIndex,
  SyntheticVolume,
} from "@/lib/neuro/volume-generator";
import {
  brushEdits,
  canvasPixel,
  pixelToVoxel,
  scrollCrosshair,
  sliceIndex,
} from "./slice-geometry";

/** The canvas a pointer is over: its bitmap size and where it sits. */
type SliceTarget = Pick<
  HTMLCanvasElement,
  "width" | "height" | "getBoundingClientRect"
>;

export interface CommittedBrushStroke {
  kind: "paint" | "erase";
  layer: NeuroEditLayer;
  voxelEdits: VoxelEdit[];
}

interface SliceInteractionOptions {
  volume: SyntheticVolume;
  crosshair: VoxelCoord;
  toolMode: ToolMode;
  brushRadius: number;
  activeLayer?: NeuroEditLayer;
  controlPointCount: number;
  onCrosshairChange: (coord: VoxelCoord) => void;
  onAddControlPoint: (point: Omit<ControlPoint, "id" | "timestamp">) => void;
  onApplyVoxelEdits: (edits: VoxelEdit[]) => void;
  onCommitStroke?: (stroke: CommittedBrushStroke) => void;
  onSelectROISeed?: (coord: VoxelCoord) => void;
}

/**
 * Pointer handling for the slice viewer. A press moves the crosshair and
 * applies the current tool; dragging keeps painting or erasing until release;
 * hovering reads the intensity under the cursor; the wheel steps through
 * slices.
 */
export function useSliceInteraction({
  volume,
  crosshair,
  toolMode,
  brushRadius,
  activeLayer = "brainmask",
  controlPointCount,
  onCrosshairChange,
  onAddControlPoint,
  onApplyVoxelEdits,
  onCommitStroke,
  onSelectROISeed,
}: SliceInteractionOptions) {
  const [hoverIntensity, setHoverIntensity] = useState<number | null>(null);
  const isPressedRef = useRef(false);
  const activeStrokeEditsRef = useRef<VoxelEdit[]>([]);
  const activeStrokeKindRef = useRef<"paint" | "erase" | null>(null);

  const voxelAt = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number
  ) =>
    pixelToVoxel(
      plane,
      canvasPixel(target, target.getBoundingClientRect(), clientX, clientY),
      crosshair,
      volume.dimensions
    );

  const applyTool = (coord: VoxelCoord) => {
    if (toolMode === "roi_select" && onSelectROISeed) {
      onSelectROISeed(coord);
    } else if (toolMode === "control_point") {
      onAddControlPoint({
        x: coord.x,
        y: coord.y,
        z: coord.z,
        intensity: 110,
        label: `CP-${controlPointCount + 1}`,
      });
    } else if (toolMode === "paint" || toolMode === "erase") {
      const edits = brushEdits(
        coord,
        brushRadius,
        toolMode,
        volume.dimensions,
        activeLayer
      );
      if (edits.length > 0) {
        const { width, height } = volume.dimensions;
        const targetMask =
          activeLayer === "brainmask"
            ? volume.brainmask
            : activeLayer === "overlay"
              ? volume.overlayMask
              : volume.wmMask;
        if (targetMask) {
          activeStrokeKindRef.current = toolMode;
          for (const e of edits) {
            const idx = getIndex(e.x, e.y, e.z, width, height);
            const originalValue = targetMask[idx] ?? 0;
            if (originalValue !== e.newValue) {
              activeStrokeEditsRef.current.push({
                ...e,
                originalValue,
              });
            }
          }
        }
        onApplyVoxelEdits(edits);
      }
    }
  };

  const press = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number
  ) => {
    isPressedRef.current = true;
    activeStrokeEditsRef.current = [];
    activeStrokeKindRef.current = null;
    const coord = voxelAt(plane, target, clientX, clientY);
    onCrosshairChange(coord);
    applyTool(coord);
  };

  const drag = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number
  ) => {
    if (!isPressedRef.current) return;
    if (toolMode !== "paint" && toolMode !== "erase") return;
    const coord = voxelAt(plane, target, clientX, clientY);
    onCrosshairChange(coord);
    applyTool(coord);
  };

  const hover = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number
  ) => {
    const slice = extractSlice(volume, plane, sliceIndex(plane, crosshair));
    const { x, y } = canvasPixel(
      target,
      target.getBoundingClientRect(),
      clientX,
      clientY
    );
    const idx = y * slice.width + x;
    if (idx >= 0 && idx < slice.pixels.length) {
      setHoverIntensity(slice.pixels[idx]);
    }
  };

  const release = () => {
    isPressedRef.current = false;
    const kind = activeStrokeKindRef.current;
    const rawEdits = activeStrokeEditsRef.current;
    activeStrokeKindRef.current = null;
    activeStrokeEditsRef.current = [];
    if (kind && rawEdits.length > 0 && onCommitStroke) {
      const coalesced = coalesceStrokeVoxelEdits(rawEdits);
      if (coalesced.length > 0) {
        onCommitStroke({
          kind,
          layer: activeLayer,
          voxelEdits: coalesced,
        });
      }
    }
  };

  const scroll = (plane: SlicePlane, deltaY: number) => {
    onCrosshairChange(
      scrollCrosshair(crosshair, plane, deltaY, volume.dimensions)
    );
  };

  return { hoverIntensity, press, drag, hover, release, scroll };
}
