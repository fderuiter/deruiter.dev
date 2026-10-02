// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

vi.mock("three/examples/jsm/loaders/OBJLoader.js", () => {
  const MockOBJLoader = vi.fn();
  return {
    OBJLoader: MockOBJLoader,
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  const MockGLTFLoader = vi.fn();
  return {
    GLTFLoader: MockGLTFLoader,
  };
});

describe("NeuroRecon 3D Asset Loader (loadExternalBrainMesh)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and normalizes an .obj model successfully with MeshStandardMaterial", async () => {
    const mockGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(10, 20, 30);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mockGroup.add(mesh);

    const computeNormalsSpy = vi.spyOn(geometry, "computeVertexNormals");

    const mockLoad = vi.fn(
      (url: string, onLoad: (res: THREE.Group) => void) => {
        onLoad(mockGroup);
      }
    );

    vi.mocked(OBJLoader).mockImplementation(function (this: any) {
      this.load = mockLoad;
    } as any);

    const result = await loadExternalBrainMesh(
      "/models/brain-scan-test.obj",
      "pial",
      "both"
    );

    expect(result).toBeInstanceOf(THREE.Group);
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(computeNormalsSpy).toHaveBeenCalled();
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((mesh.material as any).color.getHex()).toBe(0x93c5fd);

    // Verify cloned group returned
    expect(result).not.toBe(mockGroup);
  });

  it("loads and normalizes a .gltf / .glb model successfully", async () => {
    const mockScene = new THREE.Group();
    const geometry = new THREE.SphereGeometry(15);
    const mesh = new THREE.Mesh(geometry);
    mockScene.add(mesh);

    const mockLoad = vi.fn(
      (url: string, onLoad: (res: { scene: THREE.Group }) => void) => {
        onLoad({ scene: mockScene });
      }
    );

    vi.mocked(GLTFLoader).mockImplementation(function (this: any) {
      this.load = mockLoad;
    } as any);

    const result = await loadExternalBrainMesh(
      "/models/brain-scan-test.glb",
      "inflated",
      "lh"
    );

    expect(result).toBeInstanceOf(THREE.Group);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("returns cached mesh on subsequent calls with identical arguments without re-fetching", async () => {
    const mockScene = new THREE.Group();
    const mockLoad = vi.fn(
      (url: string, onLoad: (res: { scene: THREE.Group }) => void) => {
        onLoad({ scene: mockScene });
      }
    );

    vi.mocked(GLTFLoader).mockImplementation(function (this: any) {
      this.load = mockLoad;
    } as any);

    const first = await loadExternalBrainMesh(
      "/models/cached-test.glb",
      "white",
      "rh"
    );
    const second = await loadExternalBrainMesh(
      "/models/cached-test.glb",
      "white",
      "rh"
    );

    expect(first).toBeInstanceOf(THREE.Group);
    expect(second).toBeInstanceOf(THREE.Group);
    expect(first).not.toBe(second); // Cloned
    expect(mockLoad).toHaveBeenCalledTimes(1); // Cached
  });

  it("gracefully falls back to procedural cortical mesh if loader fails or throws", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const mockLoad = vi.fn(
      (
        url: string,
        onLoad: any,
        onProgress: any,
        onError: (err: Error) => void
      ) => {
        onError(new Error("Corrupt GLB file"));
      }
    );

    vi.mocked(GLTFLoader).mockImplementation(function (this: any) {
      this.load = mockLoad;
    } as any);

    const fallbackMesh = await loadExternalBrainMesh(
      "/models/corrupt-scan.glb",
      "inflated",
      "both"
    );

    expect(fallbackMesh).toBeInstanceOf(THREE.Group);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load external model"),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it("handles empty geometries and zero bounding box dimension without division by zero", async () => {
    const emptyGroup = new THREE.Group();
    const mockLoad = vi.fn(
      (url: string, onLoad: (res: THREE.Group) => void) => {
        onLoad(emptyGroup);
      }
    );

    vi.mocked(OBJLoader).mockImplementation(function (this: any) {
      this.load = mockLoad;
    } as any);

    const result = await loadExternalBrainMesh(
      "/models/empty-scan.obj",
      "pial",
      "both"
    );
    expect(result).toBeInstanceOf(THREE.Group);
    expect(Number.isFinite(result.scale.x)).toBe(true);
  });
});
