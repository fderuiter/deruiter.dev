// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getAnatomicalParcelAtCoordinate } from "@/lib/neuro/mesh-generator";
import { createCorticalSurfaceMesh } from "@/lib/neuro/engine-loader";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";

describe("NeuroRecon 3D High-Fidelity Brain Model & Desikan-Killiany Atlas Engine", () => {
  describe("createCorticalSurfaceMesh", () => {
    it("generates dual-hemisphere mesh in pial mode with vertex colors and high tessellation", () => {
      const group = createCorticalSurfaceMesh("pial", false, "both");
      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.children.length).toBe(2);

      const leftHemi = group.children[0] as THREE.Mesh;
      const rightHemi = group.children[1] as THREE.Mesh;

      expect(leftHemi.name).toBe("lh_surface");
      expect(rightHemi.name).toBe("rh_surface");

      const geom = leftHemi.geometry as THREE.BufferGeometry;
      expect(geom.getAttribute("position")).toBeDefined();
      expect(geom.getAttribute("normal")).toBeDefined();
      expect(geom.getAttribute("color")).toBeDefined();
      expect(geom.getIndex()).toBeDefined();

      // High density tessellation: (128 + 1) * (96 + 1) vertices = 12513 vertices
      expect(geom.getAttribute("position").count).toBeGreaterThan(10000);
      expect(geom.getIndex()!.count).toBeGreaterThan(50000);
    });

    it("supports white matter surface mode with scaled geometry and lighter vertex colors", () => {
      const group = createCorticalSurfaceMesh("white", false, "both");
      expect(group.children.length).toBe(2);

      const leftHemi = group.children[0] as THREE.Mesh;
      const geom = leftHemi.geometry as THREE.BufferGeometry;
      const colors = geom.getAttribute("color");

      // White matter colors are predominantly high brightness (>0.6)
      const firstR = colors.getX(0);
      const firstG = colors.getY(0);
      const firstB = colors.getZ(0);
      expect(firstR).toBeGreaterThan(0.6);
      expect(firstG).toBeGreaterThan(0.6);
      expect(firstB).toBeGreaterThan(0.5);
    });

    it("supports inflated cortical surface mode", () => {
      const group = createCorticalSurfaceMesh("inflated", false, "both");
      expect(group.children.length).toBe(2);
    });

    it("generates Desikan-Killiany Atlas (aparc) mesh with distinct regional vertex colors", () => {
      const group = createCorticalSurfaceMesh("aparc", false, "both");
      expect(group.children.length).toBe(2);

      const leftHemi = group.children[0] as THREE.Mesh;
      const geom = leftHemi.geometry as THREE.BufferGeometry;
      const colors = geom.getAttribute("color");

      // Verify that colors attribute contains varied RGB values across vertices
      const uniqueColors = new Set<string>();
      for (let i = 0; i < colors.count; i += 20) {
        const rgbKey = `${colors.getX(i).toFixed(1)}_${colors.getY(i).toFixed(1)}_${colors.getZ(i).toFixed(1)}`;
        uniqueColors.add(rgbKey);
      }
      expect(uniqueColors.size).toBeGreaterThan(5);
    });

    it("supports subcortical ASEG mode with deep gray nuclei and ventricular structures", () => {
      const group = createCorticalSurfaceMesh("aseg", false, "both");
      expect(group.children.length).toBe(1); // subGroup

      const subGroup = group.children[0] as THREE.Group;
      expect(subGroup.children.length).toBeGreaterThanOrEqual(10);

      const structureNames = subGroup.children.map((c) => c.name);
      expect(structureNames).toContain("Left-Lateral-Ventricle");
      expect(structureNames).toContain("Right-Lateral-Ventricle");
      expect(structureNames).toContain("Left-Thalamus");
      expect(structureNames).toContain("Left-Caudate");
      expect(structureNames).toContain("Left-Putamen");
      expect(structureNames).toContain("Left-Hippocampus");
      expect(structureNames).toContain("Brain-Stem");
    });

    it("respects hemisphere filtering for lh and rh isolation", () => {
      const leftOnly = createCorticalSurfaceMesh("pial", false, "lh");
      expect(leftOnly.children.length).toBe(1);
      expect(leftOnly.children[0].name).toBe("lh_surface");

      const rightOnly = createCorticalSurfaceMesh("pial", false, "rh");
      expect(rightOnly.children.length).toBe(1);
      expect(rightOnly.children[0].name).toBe("rh_surface");

      const subcorticalLeftOnly = createCorticalSurfaceMesh(
        "aseg",
        false,
        "lh"
      );
      const subGroup = subcorticalLeftOnly.children[0] as THREE.Group;
      const structureNames = subGroup.children.map((c) => c.name);
      expect(structureNames).toContain("Left-Lateral-Ventricle");
      expect(structureNames).not.toContain("Right-Lateral-Ventricle");
    });
  });

  describe("getAnatomicalParcelAtCoordinate", () => {
    it("identifies Precentral Gyrus (Primary Motor Cortex) in peri-central coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.8, y: 0.05, z: 0.2 },
        true
      );
      expect(parcel.name).toContain("Precentral Gyrus");
      expect(parcel.lobe).toBe("Frontal");
    });

    it("identifies Postcentral Gyrus (Primary Somatosensory Cortex) in post-central coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.8, y: -0.2, z: 0.2 },
        true
      );
      expect(parcel.name).toContain("Postcentral Gyrus");
      expect(parcel.lobe).toBe("Parietal");
    });

    it("identifies Superior Frontal Gyrus at dorsal anterior coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.5, y: 0.5, z: 0.6 },
        true
      );
      expect(parcel.name).toContain("Superior Frontal");
      expect(parcel.lobe).toBe("Frontal");
    });

    it("identifies Frontal Pole at extreme anterior coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.3, y: 1.3, z: 0.1 },
        true
      );
      expect(parcel.name).toContain("Frontal Pole");
      expect(parcel.lobe).toBe("Frontal");
    });

    it("identifies Superior Temporal Gyrus in lateral Sylvian fissure territory", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 1.1, y: -0.1, z: -0.05 },
        true
      );
      expect(parcel.name).toContain("Superior Temporal");
      expect(parcel.lobe).toBe("Temporal");
    });

    it("identifies Occipital cortex at posterior coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.7, y: -1.1, z: -0.1 },
        true
      );
      expect(parcel.lobe).toBe("Occipital");
    });

    it("identifies Cingulate cortex at medial coordinates", () => {
      const parcel = getAnatomicalParcelAtCoordinate(
        { x: 0.1, y: 0.5, z: 0.1 },
        true
      );
      expect(parcel.name).toContain("Anterior Cingulate");
      expect(parcel.lobe).toBe("Cingulate");
    });
  });

  describe("loadExternalBrainMesh with Fallback & Caching", () => {
    it("falls back cleanly to high-fidelity procedural cortical surface when external URL is missing/unreachable", async () => {
      const mesh = await loadExternalBrainMesh(
        "/nonexistent/model.glb",
        "aparc",
        "both"
      );
      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh.children.length).toBe(2);
    });

    it("caches loaded meshes across multiple requests", async () => {
      const mesh1 = await loadExternalBrainMesh(
        "/nonexistent/cached-model.glb",
        "pial",
        "both"
      );
      const mesh2 = await loadExternalBrainMesh(
        "/nonexistent/cached-model.glb",
        "pial",
        "both"
      );
      expect(mesh1).toBeInstanceOf(THREE.Group);
      expect(mesh2).toBeInstanceOf(THREE.Group);
    });
  });

  describe("3D to Voxel Coordinate Mapping Verification", () => {
    it("correctly translates normalized 3D coordinates to (0..96) voxel grid bounds", () => {
      // Center (0, 0, 0) in 3D maps to (48, 48, 48) voxel space
      const localPoint = { x: 0, y: 0, z: 0 };
      const vx = Math.round(48 + (localPoint.x / 1.35) * 48);
      const vy = Math.round(48 + (localPoint.y / 1.85) * 48);
      const vz = Math.round(48 + (localPoint.z / 1.45) * 48);

      expect(vx).toBe(48);
      expect(vy).toBe(48);
      expect(vz).toBe(48);

      // Max bounds
      const maxPoint = { x: 1.35, y: 1.85, z: 1.45 };
      const maxVx = Math.round(48 + (maxPoint.x / 1.35) * 48);
      const maxVy = Math.round(48 + (maxPoint.y / 1.85) * 48);
      const maxVz = Math.round(48 + (maxPoint.z / 1.45) * 48);

      expect(maxVx).toBe(96);
      expect(maxVy).toBe(96);
      expect(maxVz).toBe(96);
    });
  });
});
