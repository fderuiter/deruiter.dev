/**
 * Pure cortical and subcortical geometry generation for NeuroRecon.
 *
 * Kept free of any Web Worker construction so that the mesh worker can import
 * it without its own chunk referencing the worker's async entrypoint again.
 * That self-reference formed a cycle between webpack runtime chunks (#853).
 * The public surface is re-exported from `lib/neuro/mesh-generator.ts`.
 */

import { clamp } from "../../game-utils";
import {
  AnatomicalParcel,
  DESIKAN_KILLIANY_PARCELS,
  HemisphereBufferTransfer,
  HemisphereFilter,
  RawGeometryBuffer,
  SurfaceMode,
} from "../types";

/**
 * Determine the Desikan-Killiany anatomical parcel for a 3D coordinate on a cerebral hemisphere.
 * Coordinates are in normalized model space.
 */
export function getAnatomicalParcelAtCoordinate(
  pos: { x: number; y: number; z: number },
  isLeft: boolean
): AnatomicalParcel {
  const x = Math.abs(pos.x);
  const y = pos.y;
  const z = pos.z;

  // Medial Wall & Cingulate Cortex
  if (x < 0.28) {
    if (y > 0.45 && z > -0.1)
      return DESIKAN_KILLIANY_PARCELS.rostralanteriorcingulate;
    if (y > 0.0 && y <= 0.45 && z > 0.1)
      return DESIKAN_KILLIANY_PARCELS.caudalanteriorcingulate;
    if (y < 0.0 && y >= -0.65 && z > 0.0)
      return DESIKAN_KILLIANY_PARCELS.posteriorcingulate;
    if (y < -0.65 && z > -0.2 && z < 0.3)
      return DESIKAN_KILLIANY_PARCELS.isthmuscingulate;
    if (y > 0.0 && z > 0.4) return DESIKAN_KILLIANY_PARCELS.paracentral;
    if (y < -0.5 && z > 0.2) return DESIKAN_KILLIANY_PARCELS.precuneus;
    if (y < -0.7 && z > 0.0) return DESIKAN_KILLIANY_PARCELS.cuneus;
    if (y < -0.6 && z <= 0.0) return DESIKAN_KILLIANY_PARCELS.pericalcarine;
    if (y < 0.0 && z <= -0.2)
      return (
        DESIKAN_KILLIANY_PARCELS.parahippocampal ||
        DESIKAN_KILLIANY_PARCELS.entorhinal
      );
    return DESIKAN_KILLIANY_PARCELS.superiorfrontal;
  }

  // Frontal Pole
  if (y > 1.15) {
    return DESIKAN_KILLIANY_PARCELS.frontalpole;
  }

  // Temporal Pole & Ventral Temporal
  if (z < -0.35 && y > 0.45) {
    return DESIKAN_KILLIANY_PARCELS.temporalpole;
  }

  // Ventral Stream (Fusiform & Entorhinal & Inferior Temporal)
  if (z < -0.45) {
    if (x < 0.55 && y > -0.3) return DESIKAN_KILLIANY_PARCELS.entorhinal;
    if (x < 0.75) return DESIKAN_KILLIANY_PARCELS.fusiform;
    return DESIKAN_KILLIANY_PARCELS.inferiortemporal;
  }

  // Orbitofrontal Ventral Floor
  if (z < -0.25 && y > 0.3) {
    if (x < 0.6) return DESIKAN_KILLIANY_PARCELS.medialorbitofrontal;
    return DESIKAN_KILLIANY_PARCELS.lateralorbitofrontal;
  }

  // Occipital Lobe (Posterior)
  if (y < -0.9) {
    if (z > 0.1 && x < 0.55) return DESIKAN_KILLIANY_PARCELS.cuneus;
    if (z <= 0.0 && x < 0.6) return DESIKAN_KILLIANY_PARCELS.lingual;
    return DESIKAN_KILLIANY_PARCELS.lateraloccipital;
  }

  // Lateral Temporal Lobe (Inferior to Sylvian Fissure)
  if (z <= 0.0 && z >= -0.55 && x > 0.75 && y > -0.85) {
    if (z > -0.2) return DESIKAN_KILLIANY_PARCELS.superiortemporal;
    if (z > -0.38) return DESIKAN_KILLIANY_PARCELS.middletemporal;
    return DESIKAN_KILLIANY_PARCELS.inferiortemporal;
  }

  // Central Sulcus Strip (Primary Motor & Primary Sensory)
  if (y >= -0.08 && y <= 0.22 && z > -0.15) {
    return DESIKAN_KILLIANY_PARCELS.precentral;
  }
  if (y >= -0.35 && y < -0.08 && z > -0.15) {
    return DESIKAN_KILLIANY_PARCELS.postcentral;
  }

  // Superior Dorsal Mantle (Frontal vs Parietal)
  if (z > 0.5) {
    if (y > 0.2) return DESIKAN_KILLIANY_PARCELS.superiorfrontal;
    if (y >= -0.35) return DESIKAN_KILLIANY_PARCELS.precentral;
    return DESIKAN_KILLIANY_PARCELS.superiorparietal;
  }

  // Lateral Frontal (Middle & Inferior Frontal Gyri)
  if (y > 0.22) {
    if (y > 0.75) return DESIKAN_KILLIANY_PARCELS.rostralmiddlefrontal;
    if (z > 0.15) return DESIKAN_KILLIANY_PARCELS.caudalmiddlefrontal;
    if (y > 0.45 && z > -0.1) return DESIKAN_KILLIANY_PARCELS.parstriangularis;
    if (y > 0.25 && z > -0.15) return DESIKAN_KILLIANY_PARCELS.parsopercularis;
    return DESIKAN_KILLIANY_PARCELS.parsorbitalis;
  }

  // Lateral Parietal Mantle
  if (y >= -0.9 && y < -0.35 && z > 0.0) {
    if (z > 0.35) return DESIKAN_KILLIANY_PARCELS.superiorparietal;
    if (y > -0.6) return DESIKAN_KILLIANY_PARCELS.supramarginal;
    return DESIKAN_KILLIANY_PARCELS.inferiorparietal;
  }

  // Lateral Temporal Lobe
  if (z <= 0.05 && z >= -0.45) {
    if (z > -0.15) return DESIKAN_KILLIANY_PARCELS.superiortemporal;
    if (z > -0.35) return DESIKAN_KILLIANY_PARCELS.middletemporal;
    return DESIKAN_KILLIANY_PARCELS.inferiortemporal;
  }

  // Default fallback
  return isLeft
    ? DESIKAN_KILLIANY_PARCELS.superiorfrontal
    : DESIKAN_KILLIANY_PARCELS.superiorfrontal;
}

/**
 * Generate raw typed array buffers for a single hemisphere (Left or Right)
 * Executes 12,500+ vertex spatial point checks, trigonometric folding calculations,
 * and Desikan-Killiany atlas parcellations into Float32Array and Uint32Array structures.
 */
export function generateHemisphereBuffers(
  hemi: "left" | "right",
  mode: SurfaceMode
): HemisphereBufferTransfer {
  const uSegments = 128; // Azimuth resolution
  const vSegments = 96; // Elevation resolution
  const isLeft = hemi === "left";
  const hemiSign = isLeft ? -1 : 1;

  const numVertices = (uSegments + 1) * (vSegments + 1); // 12,513 vertices
  const positions = new Float32Array(numVertices * 3);
  const rawNormals = new Float32Array(numVertices * 3);
  const colors = new Float32Array(numVertices * 3);
  const indices = new Uint32Array(uSegments * vSegments * 6); // 73,728 indices

  const baseScale = mode === "white" ? 0.92 : mode === "inflated" ? 1.06 : 1.0;

  let vIdx = 0;

  for (let j = 0; j <= vSegments; j++) {
    const theta = (j / vSegments) * Math.PI; // 0 to PI (Superior to Inferior)
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let i = 0; i <= uSegments; i++) {
      // 0 to PI for single lateral/medial hemisphere dome
      const phi = (i / uSegments) * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // Base ellipsoid dimensions (X: Left-Right, Y: Anterior-Posterior, Z: Superior-Inferior)
      const rx = 1.35 * baseScale;
      const ry = 1.85 * baseScale;
      const rz = 1.45 * baseScale;

      let x = rx * sinTheta * cosPhi * hemiSign + (isLeft ? -0.06 : 0.06);
      let y = ry * sinTheta * sinPhi - ry * 0.5;
      let z = rz * cosTheta;

      // Temporal lobe anterior hook & Sylvian fissure indentation
      if (z < -0.1 && y > -0.3 && y < 0.6) {
        x += hemiSign * 0.22 * Math.sin((y + 0.3) * 3.0);
      }

      // Anatomical Primary Fissures (Central Sulcus, Lateral Fissure, Parieto-Occipital)
      let centralSulcusDepth = 0;
      if (y > -0.15 && y < 0.15 && z > -0.2) {
        const distToCentral = Math.abs(y - (0.05 + (z - 0.2) * 0.18));
        centralSulcusDepth =
          Math.exp(-Math.pow(distToCentral / 0.12, 2)) * 0.14;
      }

      let sylvianFissureDepth = 0;
      if (z > -0.4 && z < 0.15 && y > -0.4 && y < 0.5) {
        const distToSylvian = Math.abs(z - (-0.12 - (y - 0.1) * 0.25));
        sylvianFissureDepth =
          Math.exp(-Math.pow(distToSylvian / 0.14, 2)) * 0.18;
      }

      // Sulcal and gyral folding patterns
      let curvature = 0;
      if (mode !== "inflated") {
        const fold1 = Math.sin(x * 5.2) * Math.cos(y * 4.6);
        const fold2 = Math.sin(y * 6.4 + z * 4.2) * 0.65;
        const fold3 = Math.cos(x * 8.5 - z * 6.2) * 0.45;
        const fold4 = Math.sin(x * 12.0 + y * 8.0) * 0.18;
        const foldScale = mode === "white" ? 0.048 : 0.088;

        curvature = (fold1 + fold2 + fold3 + fold4) / 2.2; // [-1, 1]

        // Subtract primary fissure indentations
        curvature -= (centralSulcusDepth + sylvianFissureDepth) * 2.5;

        x += x * curvature * foldScale;
        y += y * curvature * foldScale;
        z += z * curvature * foldScale;
      } else {
        // Inflated surface displays smoothed geometry with underlying sulcal depth color
        const fold1 = Math.sin(x * 5.2) * Math.cos(y * 4.6);
        const fold2 = Math.sin(y * 6.4 + z * 4.2) * 0.65;
        curvature = (fold1 + fold2) / 1.65;
      }

      const pOffset = vIdx * 3;
      positions[pOffset] = x;
      positions[pOffset + 1] = y;
      positions[pOffset + 2] = z;

      // Normal vector approximation
      const len = Math.hypot(x, y, z) || 1;
      rawNormals[pOffset] = x / len;
      rawNormals[pOffset + 1] = y / len;
      rawNormals[pOffset + 2] = z / len;

      // Vertex color assignment
      if (mode === "aparc") {
        const parcel = getAnatomicalParcelAtCoordinate({ x, y, z }, isLeft);
        // Slightly shade according to sulcal curvature for realistic 3D parcel depth
        const depthShade = 0.85 + clamp(curvature * 0.2, -0.25, 0.25);
        colors[pOffset] = parcel.normRgb[0] * depthShade;
        colors[pOffset + 1] = parcel.normRgb[1] * depthShade;
        colors[pOffset + 2] = parcel.normRgb[2] * depthShade;
      } else {
        // Sulcal fundi (dark slate/gray) vs Gyral crests (bright cyan/blue)
        const normCurv = clamp((curvature + 1.2) / 2.4, 0, 1);
        let r = 0.16 + normCurv * 0.16;
        let g = 0.26 + normCurv * 0.48;
        let b = 0.42 + normCurv * 0.58;

        if (mode === "white") {
          r = 0.78 + normCurv * 0.14;
          g = 0.78 + normCurv * 0.14;
          b = 0.68 + normCurv * 0.12;
        }

        colors[pOffset] = r;
        colors[pOffset + 1] = g;
        colors[pOffset + 2] = b;
      }

      vIdx++;
    }
  }

  // Generate triangle indices
  let iIdx = 0;
  for (let j = 0; j < vSegments; j++) {
    for (let i = 0; i < uSegments; i++) {
      const a = j * (uSegments + 1) + i;
      const b = a + 1;
      const c = (j + 1) * (uSegments + 1) + i;
      const d = c + 1;

      if (isLeft) {
        indices[iIdx++] = a;
        indices[iIdx++] = b;
        indices[iIdx++] = d;
        indices[iIdx++] = a;
        indices[iIdx++] = d;
        indices[iIdx++] = c;
      } else {
        indices[iIdx++] = a;
        indices[iIdx++] = d;
        indices[iIdx++] = b;
        indices[iIdx++] = a;
        indices[iIdx++] = c;
        indices[iIdx++] = d;
      }
    }
  }

  return {
    hemi,
    positions,
    normals: rawNormals,
    colors,
    indices,
  };
}

/**
 * Generate UV sphere geometry buffer for subcortical structures.
 */
function generateSphereBuffer(
  center: [number, number, number],
  scale: [number, number, number],
  colorHex: number,
  name: string
): RawGeometryBuffer {
  const widthSegments = 24;
  const heightSegments = 16;
  const numVertices = (widthSegments + 1) * (heightSegments + 1);
  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);
  const indices = new Uint32Array(widthSegments * heightSegments * 6);

  let vIdx = 0;
  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let i = 0; i <= widthSegments; i++) {
      const u = i / widthSegments;
      const phi = u * Math.PI * 2;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const nx = sinTheta * cosPhi;
      const ny = cosTheta;
      const nz = sinTheta * sinPhi;

      const pOffset = vIdx * 3;
      normals[pOffset] = nx;
      normals[pOffset + 1] = ny;
      normals[pOffset + 2] = nz;

      positions[pOffset] = center[0] + nx * scale[0];
      positions[pOffset + 1] = center[1] + ny * scale[1];
      positions[pOffset + 2] = center[2] + nz * scale[2];

      vIdx++;
    }
  }

  let iIdx = 0;
  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < widthSegments; i++) {
      const a = j * (widthSegments + 1) + i;
      const b = a + 1;
      const c = (j + 1) * (widthSegments + 1) + i;
      const d = c + 1;

      indices[iIdx++] = a;
      indices[iIdx++] = b;
      indices[iIdx++] = d;
      indices[iIdx++] = a;
      indices[iIdx++] = d;
      indices[iIdx++] = c;
    }
  }

  return {
    name,
    positions,
    normals,
    indices,
    color: colorHex,
  };
}

/**
 * Generate subcortical structure geometry buffers (Ventricles, Thalamus, Caudate, Putamen, Hippocampus, Amygdala, Brainstem)
 */
export function generateSubcorticalBuffers(
  hemiFilter: HemisphereFilter = "both"
): RawGeometryBuffer[] {
  const structures = [
    {
      name: "Left-Lateral-Ventricle",
      hemi: "lh",
      pos: [-0.38, 0.1, 0.15],
      scale: [0.22, 0.75, 0.28],
      color: 0x7890cd,
    },
    {
      name: "Right-Lateral-Ventricle",
      hemi: "rh",
      pos: [0.38, 0.1, 0.15],
      scale: [0.22, 0.75, 0.28],
      color: 0x7890cd,
    },
    {
      name: "Left-Thalamus",
      hemi: "lh",
      pos: [-0.35, -0.15, -0.05],
      scale: [0.32, 0.45, 0.35],
      color: 0x00760e,
    },
    {
      name: "Right-Thalamus",
      hemi: "rh",
      pos: [0.35, -0.15, -0.05],
      scale: [0.32, 0.45, 0.35],
      color: 0x00760e,
    },
    {
      name: "Left-Caudate",
      hemi: "lh",
      pos: [-0.55, 0.25, 0.2],
      scale: [0.22, 0.48, 0.25],
      color: 0x7aff88,
    },
    {
      name: "Right-Caudate",
      hemi: "rh",
      pos: [0.55, 0.25, 0.2],
      scale: [0.22, 0.48, 0.25],
      color: 0x7aff88,
    },
    {
      name: "Left-Putamen",
      hemi: "lh",
      pos: [-0.75, 0.05, -0.02],
      scale: [0.28, 0.55, 0.32],
      color: 0xeb4095,
    },
    {
      name: "Right-Putamen",
      hemi: "rh",
      pos: [0.75, 0.05, -0.02],
      scale: [0.28, 0.55, 0.32],
      color: 0xeb4095,
    },
    {
      name: "Left-Hippocampus",
      hemi: "lh",
      pos: [-0.62, -0.32, -0.38],
      scale: [0.2, 0.55, 0.2],
      color: 0xd0e83b,
    },
    {
      name: "Right-Hippocampus",
      hemi: "rh",
      pos: [0.62, -0.32, -0.38],
      scale: [0.2, 0.55, 0.2],
      color: 0xd0e83b,
    },
    {
      name: "Left-Amygdala",
      hemi: "lh",
      pos: [-0.58, 0.02, -0.36],
      scale: [0.18, 0.22, 0.18],
      color: 0x67a8ff,
    },
    {
      name: "Right-Amygdala",
      hemi: "rh",
      pos: [0.58, 0.02, -0.36],
      scale: [0.18, 0.22, 0.18],
      color: 0x67a8ff,
    },
    {
      name: "Brain-Stem",
      hemi: "both",
      pos: [0, -0.25, -0.75],
      scale: [0.45, 0.48, 0.75],
      color: 0x776655,
    },
  ] as const;

  const buffers: RawGeometryBuffer[] = [];

  for (const s of structures) {
    if (hemiFilter !== "both" && s.hemi !== "both" && s.hemi !== hemiFilter) {
      continue;
    }
    buffers.push(
      generateSphereBuffer(
        s.pos as [number, number, number],
        s.scale as [number, number, number],
        s.color,
        s.name
      )
    );
  }

  return buffers;
}

/**
 * Procedurally generates raw cortical surface geometry array buffers synchronously.
 */
/* jscpd:ignore-start */
export function createCorticalSurfaceMeshBuffers(
  mode: SurfaceMode = "pial",
  _wireframe = false,
  hemiFilter: HemisphereFilter = "both"
): RawGeometryBuffer[] {
  if (mode === "aseg") {
    return generateSubcorticalBuffers(hemiFilter);
  }

  const buffers: RawGeometryBuffer[] = [];

  if (hemiFilter === "both" || hemiFilter === "lh") {
    const lhBuf = generateHemisphereBuffers("left", mode);
    buffers.push({
      name: "lh_surface",
      hemi: "left",
      positions: lhBuf.positions,
      normals: lhBuf.normals,
      colors: lhBuf.colors,
      indices: lhBuf.indices,
    });
  }

  if (hemiFilter === "both" || hemiFilter === "rh") {
    const rhBuf = generateHemisphereBuffers("right", mode);
    buffers.push({
      name: "rh_surface",
      hemi: "right",
      positions: rhBuf.positions,
      normals: rhBuf.normals,
      colors: rhBuf.colors,
      indices: rhBuf.indices,
    });
  }

  return buffers;
}
/* jscpd:ignore-end */
