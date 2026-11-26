import { clamp } from "@/lib/game-utils";
import {
  ControlPoint,
  SlicePlane,
  VectorContourPath,
  VoxelCoord,
} from "@/lib/neuro/types";
import { extractSlice, SyntheticVolume } from "@/lib/neuro/volume-generator";
import { defectRect, isNearSlice, voxelToPixel } from "./slice-geometry";

/** What one slice canvas shows besides the MRI pixels. */
interface SliceOverlays {
  crosshair: VoxelCoord;
  showPialContour: boolean;
  showWmContour: boolean;
  showOverlayMask?: boolean;
  overlayOpacity?: number;
  controlPoints: ControlPoint[];
  vectorContours?: VectorContourPath[];
}

/** Outline the edge pixels of a mask as one-pixel squares. */
function traceMaskEdges(
  ctx: CanvasRenderingContext2D,
  mask: ArrayLike<number>,
  width: number,
  height: number
) {
  ctx.beginPath();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (
        mask[idx] > 0 &&
        (mask[idx - 1] === 0 ||
          mask[idx + 1] === 0 ||
          mask[idx - width] === 0 ||
          mask[idx + width] === 0)
      ) {
        ctx.rect(x, y, 1, 1);
      }
    }
  }
  ctx.stroke();
}

/**
 * Draw one anatomical slice and its overlays: surface contours, overlay mask,
 * vector contours, the defect region, nearby control points and the crosshair.
 */
export function drawSlice(
  canvas: HTMLCanvasElement | null,
  volume: SyntheticVolume,
  plane: SlicePlane,
  slice: number,
  overlays: SliceOverlays
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    width,
    height,
    pixels,
    mask,
    wm,
    overlay,
    voxelWidthMm,
    voxelHeightMm,
  } = extractSlice(volume, plane, slice);
  canvas.width = width;
  canvas.height = height;

  if (canvas.style && voxelWidthMm > 0 && voxelHeightMm > 0) {
    canvas.style.aspectRatio = `${width * voxelWidthMm} / ${height * voxelHeightMm}`;
  }

  const showOverlay =
    Boolean(overlay) &&
    overlays.showOverlayMask !== false &&
    (overlays.overlayOpacity ?? 0.55) > 0;
  const overlayAlpha = showOverlay
    ? clamp(overlays.overlayOpacity ?? 0.55, 0, 1)
    : 0;

  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < pixels.length; i++) {
    const p = i * 4;
    const base = pixels[i];
    if (showOverlay && overlay && overlay[i] > 0) {
      imgData.data[p] = Math.round(base * (1 - overlayAlpha));
      imgData.data[p + 1] = Math.round(
        base * (1 - overlayAlpha) + 245 * overlayAlpha
      );
      imgData.data[p + 2] = Math.round(
        base * (1 - overlayAlpha) + 212 * overlayAlpha
      );
    } else {
      imgData.data[p] = base;
      imgData.data[p + 1] = base;
      imgData.data[p + 2] = base;
    }
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  if (showOverlay && overlay) {
    ctx.strokeStyle = `rgba(0, 245, 212, ${Math.min(0.95, overlayAlpha + 0.25)})`;
    ctx.lineWidth = 1.0;
    traceMaskEdges(ctx, overlay, width, height);
  }

  if (overlays.showPialContour) {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // Red-500
    ctx.lineWidth = 1.2;
    traceMaskEdges(ctx, mask, width, height);
  }

  if (overlays.showWmContour) {
    ctx.strokeStyle = "rgba(234, 179, 8, 0.9)"; // Yellow-500
    ctx.lineWidth = 1.0;
    traceMaskEdges(ctx, wm, width, height);
  }

  overlays.vectorContours?.forEach((contour) => {
    if (!contour.segments || contour.segments.length === 0) return;
    ctx.strokeStyle = contour.color || "#00f5d4";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    contour.segments.forEach((seg) => {
      ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
    });
    ctx.stroke();
  });

  const defect = defectRect(volume.defectRegion, plane, slice, height);
  if (defect) {
    ctx.strokeStyle = "rgba(245, 158, 11, 0.75)"; // Amber-500
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(defect.x, defect.y, defect.width, defect.height);
    ctx.setLineDash([]);
  }

  overlays.controlPoints.forEach((cp) => {
    if (!isNearSlice(cp, plane, slice)) return;
    const { x, y } = voxelToPixel(plane, cp, height);
    ctx.strokeStyle = "#00f5d4"; // Cyan
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  });

  const cross = voxelToPixel(plane, overlays.crosshair, height);
  ctx.strokeStyle = "rgba(16, 185, 129, 0.65)"; // Emerald-500
  ctx.lineWidth = 1.0;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(0, cross.y);
  ctx.lineTo(width, cross.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cross.x, 0);
  ctx.lineTo(cross.x, height);
  ctx.stroke();
  ctx.setLineDash([]);
}
