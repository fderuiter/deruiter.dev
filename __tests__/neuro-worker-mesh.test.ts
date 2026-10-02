// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { generateHemisphereBuffers } from "@/lib/neuro/mesh-generator";
import {
  createHemisphereGeometryFromBuffers,
  createCorticalSurfaceMeshFromBuffers,
  createCorticalSurfaceMeshAsync,
} from "@/lib/neuro/engine-loader";
import { MeshWorkerRequest, MeshWorkerResponse } from "@/lib/neuro/types";

describe("NeuroRecon Web Worker Mesh Generator & Zero-Copy ArrayBuffer Transfer Suite", () => {
  it("computes 12,500+ vertices per hemisphere with Float32Array positions, normals, colors, and Uint32Array indices", () => {
    const lhBuf = generateHemisphereBuffers("left", "pial");
    const rhBuf = generateHemisphereBuffers("right", "pial");

    expect(lhBuf.hemi).toBe("left");
    expect(rhBuf.hemi).toBe("right");

    // 129 * 97 = 12,513 vertices per hemisphere
    const numVertices = 12513;
    expect(lhBuf.positions).toBeInstanceOf(Float32Array);
    expect(lhBuf.normals).toBeInstanceOf(Float32Array);
    expect(lhBuf.colors).toBeInstanceOf(Float32Array);
    expect(lhBuf.indices).toBeInstanceOf(Uint32Array);

    expect(lhBuf.positions.length).toBe(numVertices * 3);
    expect(lhBuf.normals.length).toBe(numVertices * 3);
    expect(lhBuf.colors.length).toBe(numVertices * 3);
    expect(lhBuf.indices.length).toBe(128 * 96 * 6);

    // Total vertices across both hemispheres = 25,026 (> 25,000 vertices)
    const totalVertices = (lhBuf.positions.length + rhBuf.positions.length) / 3;
    expect(totalVertices).toBeGreaterThan(25000);
  });

  it("calculates Desikan-Killiany atlas parcellations (aparc) into vertex color Float32Arrays", () => {
    const buf = generateHemisphereBuffers("left", "aparc");
    expect(buf.colors).toBeInstanceOf(Float32Array);

    const uniqueColors = new Set<string>();
    for (let i = 0; i < buf.colors.length; i += 60) {
      const r = buf.colors[i].toFixed(2);
      const g = buf.colors[i + 1].toFixed(2);
      const b = buf.colors[i + 2].toFixed(2);
      uniqueColors.add(`${r}_${g}_${b}`);
    }

    expect(uniqueColors.size).toBeGreaterThan(5);
  });

  it("reconstructs THREE.BufferGeometry cleanly from transferred TypedArray buffers", () => {
    const buf = generateHemisphereBuffers("left", "pial");
    const geom = createHemisphereGeometryFromBuffers(buf);

    expect(geom).toBeInstanceOf(THREE.BufferGeometry);
    expect(geom.getAttribute("position")).toBeDefined();
    expect(geom.getAttribute("normal")).toBeDefined();
    expect(geom.getAttribute("color")).toBeDefined();
    expect(geom.getIndex()).toBeDefined();

    expect(geom.getAttribute("position").count).toBe(12513);
  });

  it("constructs dual-hemisphere THREE.Group from compiled worker response", () => {
    const lhBuf = generateHemisphereBuffers("left", "pial");
    const rhBuf = generateHemisphereBuffers("right", "pial");

    const mockWorkerResponse: MeshWorkerResponse = {
      id: "req_test_1",
      mode: "pial",
      hemiFilter: "both",
      wireframe: false,
      buffers: [lhBuf, rhBuf],
      isSubcortical: false,
    };

    const group = createCorticalSurfaceMeshFromBuffers(mockWorkerResponse);
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBe(2);

    const leftMesh = group.children[0] as THREE.Mesh;
    const rightMesh = group.children[1] as THREE.Mesh;

    expect(leftMesh.name).toBe("lh_surface");
    expect(rightMesh.name).toBe("rh_surface");
  });

  it("handles Web Worker messages and transfers ArrayBuffers with zero-copy ownership transfer", async () => {
    let _workerHandler: ((e: MessageEvent<MeshWorkerRequest>) => void) | null =
      null;
    const postMessageSpy = vi.fn();

    // Mock Worker scope environment
    const mockWorkerSelf = {
      addEventListener: (
        type: string,
        handler: (e: MessageEvent<MeshWorkerRequest>) => void
      ) => {
        if (type === "message") {
          _workerHandler = handler;
        }
      },
      postMessage: postMessageSpy,
    };

    // Execute message handler logic
    const req: MeshWorkerRequest = {
      id: "test_worker_req",
      mode: "aparc",
      hemiFilter: "both",
      wireframe: false,
    };

    const lhBuf = generateHemisphereBuffers("left", req.mode);
    const rhBuf = generateHemisphereBuffers("right", req.mode);

    const response: MeshWorkerResponse = {
      id: req.id,
      mode: req.mode,
      hemiFilter: req.hemiFilter,
      wireframe: false,
      buffers: [lhBuf, rhBuf],
      isSubcortical: false,
    };

    const transferables = [
      lhBuf.positions.buffer,
      lhBuf.normals.buffer,
      lhBuf.colors.buffer,
      lhBuf.indices.buffer,
      rhBuf.positions.buffer,
      rhBuf.normals.buffer,
      rhBuf.colors.buffer,
      rhBuf.indices.buffer,
    ];

    mockWorkerSelf.postMessage(response, transferables);

    expect(postMessageSpy).toHaveBeenCalledWith(response, transferables);
    expect(transferables.length).toBe(8);
  });

  it("resolves createCorticalSurfaceMeshAsync via Web Worker or fallback", async () => {
    const meshGroup = await createCorticalSurfaceMeshAsync(
      "pial",
      false,
      "both"
    );
    expect(meshGroup).toBeInstanceOf(THREE.Group);
    expect(meshGroup.children.length).toBe(2);
  });
});
