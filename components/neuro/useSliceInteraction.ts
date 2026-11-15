import { useRef, useState } from "react";
import {
  ControlPoint,
  SlicePlane,
  ToolMode,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import { extractSlice, SyntheticVolume, VOLUME_SIZE } from "@/lib/neuro/volume-generator";
import { clamp } from "@/lib/game-utils";
import {
  brushEdits,
  canvasPixel,
  pixelToVoxel,
  scrollCrosshair,
  sliceIndex,
  ViewportTransform,
} from "./slice-geometry";

/** The canvas a pointer is over: its bitmap size and where it sits. */
type SliceTarget = Pick<
  HTMLCanvasElement,
  "width" | "height" | "getBoundingClientRect"
>;

interface SliceInteractionOptions {
  volume: SyntheticVolume;
  crosshair: VoxelCoord;
  toolMode: ToolMode;
  brushRadius: number;
  controlPointCount: number;
  transforms?: Record<SlicePlane, ViewportTransform>;
  onTransformChange?: (
    plane: SlicePlane,
    transform:
      | ViewportTransform
      | ((prev: ViewportTransform) => ViewportTransform)
  ) => void;
  onCrosshairChange: (coord: VoxelCoord) => void;
  onAddControlPoint: (point: Omit<ControlPoint, "id" | "timestamp">) => void;
  onApplyVoxelEdits: (edits: VoxelEdit[]) => void;
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
  controlPointCount,
  transforms: transformsProp,
  onTransformChange,
  onCrosshairChange,
  onAddControlPoint,
  onApplyVoxelEdits,
  onSelectROISeed,
}: SliceInteractionOptions) {
  const [hoverIntensity, setHoverIntensity] = useState<number | null>(null);
  const [internalTransforms, setInternalTransforms] = useState<
    Record<SlicePlane, ViewportTransform>
  >({
    axial: { zoom: 1, pan: { x: 0, y: 0 } },
    coronal: { zoom: 1, pan: { x: 0, y: 0 } },
    sagittal: { zoom: 1, pan: { x: 0, y: 0 } },
  });

  const currentTransforms = transformsProp ?? internalTransforms;
  const updateTransform = (
    plane: SlicePlane,
    updater: (prev: ViewportTransform) => ViewportTransform
  ) => {
    if (onTransformChange) {
      onTransformChange(
        plane,
        updater(currentTransforms[plane] ?? { zoom: 1, pan: { x: 0, y: 0 } })
      );
    } else {
      setInternalTransforms((prev) => ({
        ...prev,
        [plane]: updater(prev[plane] ?? { zoom: 1, pan: { x: 0, y: 0 } }),
      }));
    }
  };

  const isPressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const voxelAt = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number
  ) =>
    pixelToVoxel(
      plane,
      canvasPixel(
        target,
        target.getBoundingClientRect(),
        clientX,
        clientY,
        currentTransforms[plane]
      ),
      crosshair
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
      const edits = brushEdits(coord, brushRadius, toolMode);
      if (edits.length > 0) onApplyVoxelEdits(edits);
    }
  };

  const press = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number,
    button = 0
  ) => {
    if (button === 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }
    isPressedRef.current = true;
    const coord = voxelAt(plane, target, clientX, clientY);
    onCrosshairChange(coord);
    applyTool(coord);
  };

  const drag = (
    plane: SlicePlane,
    target: SliceTarget,
    clientX: number,
    clientY: number,
    buttons?: number
  ) => {
    if (buttons !== undefined && (buttons & 4) && !isPanningRef.current) {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
    }

    if (isPanningRef.current) {
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };

      const rect = target.getBoundingClientRect();
      const maxPanX = rect.width || VOLUME_SIZE * 2;
      const maxPanY = rect.height || VOLUME_SIZE * 2;

      updateTransform(plane, (prev) => {
        const curPan = prev.pan ?? { x: 0, y: 0 };
        return {
          ...prev,
          pan: {
            x: clamp(curPan.x + dx, -maxPanX, maxPanX),
            y: clamp(curPan.y + dy, -maxPanY, maxPanY),
          },
        };
      });
      return;
    }

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
      clientY,
      currentTransforms[plane]
    );
    const idx = y * slice.width + x;
    if (
      idx >= 0 &&
      idx < slice.pixels.length &&
      x >= 0 &&
      x < slice.width &&
      y >= 0 &&
      y < slice.height
    ) {
      setHoverIntensity(slice.pixels[idx]);
    }
  };

  const release = () => {
    isPressedRef.current = false;
    isPanningRef.current = false;
  };

  const scroll = (plane: SlicePlane, deltaY: number, shiftKey = false) => {
    if (shiftKey) {
      const zoomStep = deltaY < 0 ? 0.25 : -0.25;
      updateTransform(plane, (prev) => {
        const currentZoom = prev.zoom ?? 1;
        return {
          ...prev,
          zoom: clamp(Number((currentZoom + zoomStep).toFixed(2)), 1, 8),
        };
      });
      return;
    }
    onCrosshairChange(scrollCrosshair(crosshair, plane, deltaY));
  };

  return {
    hoverIntensity,
    transforms: currentTransforms,
    press,
    drag,
    hover,
    release,
    scroll,
  };
}
