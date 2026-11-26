// @vitest-environment jsdom
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { IDBFactory } from "fake-indexeddb";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";
import {
  clearNeuroLocalStorage,
  coalesceStrokeVoxelEdits,
  createDefaultAffine,
  createEmptyStrokeHistory,
  deriveDraftFromStrokeStack,
  estimateNeuroWorkspaceBytes,
  generateSyntheticVolume,
  gzipBytes,
  hydrateVolumeFromStorage,
  loadNeuroWorkspaceState,
  MAX_NEURO_STORAGE_BYTES,
  pushNeuroStroke,
  resetNeuroMemoryFallback,
  revertVoxelEditsOnVolume,
  saveNeuroWorkspaceState,
  serializeMaskToNiftiBytes,
  serializeVolumeForStorage,
  stepRedoStrokeHistory,
  stepUndoStrokeHistory,
  type NeuroPersistedWorkspace,
} from "@/lib/neuro";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

vi.mock("@/components/neuro/Brain3DViewer", () => ({
  Brain3DViewer: ({
    uploadedVolume,
    isosurfaceThreshold,
  }: {
    uploadedVolume?: { fileName?: string } | null;
    isosurfaceThreshold?: number;
  }) => (
    <div data-testid="brain-3d-stub">
      {uploadedVolume
        ? `MC:${uploadedVolume.fileName}:${isosurfaceThreshold}`
        : "SYNTHETIC"}
    </div>
  ),
}));

vi.mock("@/components/neuro/NeuroFieldManual", () => ({
  NeuroFieldManual: () => null,
}));

vi.mock("@/components/neuro/NeuroSuccessDialog", () => ({
  NeuroSuccessDialog: () => null,
}));

function pressKey(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

describe("Per-Stroke Undo/Redo & IndexedDB Workspace Persistence", () => {
  beforeEach(() => {
    resetNeuroMemoryFallback();
    window.history.replaceState(null, "", window.location.pathname);
    const context2D = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        measureText: (text: string) => ({ width: (text || "").length * 8 }),
      } as Record<string | symbol, unknown>,
      {
        get: (target, key) => (key in target ? target[key] : () => {}),
        set: () => true,
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      fromAny((contextId: string) => (contextId === "2d" ? context2D : null))
    );
  });

  afterEach(() => {
    cleanup();
    resetNeuroMemoryFallback();
    vi.restoreAllMocks();
  });

  it("coalesces overlapping drag edits within a stroke and cleanly undoes/redoes multi-stroke edits", () => {
    const vol = generateSyntheticVolume("sandbox");
    const { width, height } = vol.dimensions;
    const targetIdx = 20 * width * height + 20 * width + 20;
    const orig = vol.brainmask[targetIdx];
    const toggled = orig === 1 ? 0 : 1;

    // Simulate dragging across the same voxel multiple times in one gesture
    const coalesced = coalesceStrokeVoxelEdits([
      {
        x: 20,
        y: 20,
        z: 20,
        originalValue: orig,
        newValue: toggled,
        layer: "brainmask",
      },
      {
        x: 20,
        y: 20,
        z: 20,
        originalValue: toggled,
        newValue: toggled,
        layer: "brainmask",
      },
      {
        x: 21,
        y: 20,
        z: 20,
        originalValue: 0,
        newValue: 0, // unchanged voxel filtered out
        layer: "brainmask",
      },
    ]);
    expect(coalesced).toHaveLength(1);
    expect(coalesced[0].originalValue).toBe(orig);
    expect(coalesced[0].newValue).toBe(toggled);

    vol.brainmask[targetIdx] = toggled;
    let history = createEmptyStrokeHistory();
    history = pushNeuroStroke(history, {
      id: "s1",
      kind: toggled === 1 ? "paint" : "erase",
      layer: "brainmask",
      voxelEdits: coalesced,
      timestamp: 1000,
    });
    history = pushNeuroStroke(history, {
      id: "s2",
      kind: "control_point",
      voxelEdits: [],
      controlPoint: {
        id: "cp-1",
        x: 15,
        y: 15,
        z: 15,
        intensity: 110,
        timestamp: 2000,
      },
      timestamp: 2000,
    });

    expect(
      deriveDraftFromStrokeStack(history.undoStack).controlPoints
    ).toHaveLength(1);
    expect(
      deriveDraftFromStrokeStack(history.undoStack).voxelEdits
    ).toHaveLength(1);

    // Undo control point stroke
    const u1 = stepUndoStrokeHistory(history);
    expect(u1.stroke?.id).toBe("s2");
    history = u1.history;
    expect(
      deriveDraftFromStrokeStack(history.undoStack).controlPoints
    ).toHaveLength(0);

    // Undo brush stroke and revert volume buffer
    const u2 = stepUndoStrokeHistory(history);
    expect(u2.stroke?.id).toBe("s1");
    history = u2.history;
    if (u2.stroke) revertVoxelEditsOnVolume(vol, u2.stroke.voxelEdits);
    expect(vol.brainmask[targetIdx]).toBe(orig);

    // Redo brush stroke
    const r1 = stepRedoStrokeHistory(history);
    expect(r1.stroke?.id).toBe("s1");
    expect(r1.history.undoStack).toHaveLength(1);
  });

  it("persists volumes, overlays, control points, and stroke history in IndexedDB, enforces the 250 MB cap, falls back to memory in private mode, and clears local storage", async () => {
    const idb = new IDBFactory();
    const dims = { width: 20, height: 16, depth: 12 };
    const spacing = { x: 0.9, y: 0.9, z: 1.5 };
    const total = dims.width * dims.height * dims.depth;
    const affine = createDefaultAffine(dims, spacing);

    const sampleVol = {
      dimensions: dims,
      spacing,
      affine,
      sourceFormat: "nifti" as const,
      fileName: "sub-09_T1w.nii.gz",
      rawT1: new Uint8Array(total).fill(120),
      brainmask: new Uint8Array(total).fill(1),
      wmMask: new Uint8Array(total),
      initialBrainmask: new Uint8Array(total).fill(1),
      initialWmMask: new Uint8Array(total),
      labels: new Uint8Array(total),
      scenarioId: "sandbox" as const,
      defectRegion: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    };

    const workspace: NeuroPersistedWorkspace = {
      updatedAt: 123456,
      activeScenarioId: "sandbox",
      activeDataset: "case_study",
      activeEditLayer: "overlay",
      isosurfaceThreshold: 72,
      uploadedVolume: serializeVolumeForStorage(sampleVol),
      overlayLayer: {
        name: "tumor-seg.nii.gz",
        data: new Uint8Array(total).fill(2),
        opacity: 0.6,
        visible: true,
        dimensions: dims,
        spacing,
        affine,
      },
      controlPoints: [
        { id: "cp-9", x: 5, y: 5, z: 5, intensity: 110, timestamp: 123 },
      ],
      voxelEdits: [
        {
          x: 3,
          y: 4,
          z: 5,
          originalValue: 0,
          newValue: 1,
          layer: "overlay",
        },
      ],
      strokeHistory: {
        undoStack: [
          {
            id: "st-1",
            kind: "paint",
            layer: "overlay",
            voxelEdits: [
              {
                x: 3,
                y: 4,
                z: 5,
                originalValue: 0,
                newValue: 1,
                layer: "overlay",
              },
            ],
            timestamp: 120,
          },
        ],
        redoStack: [],
      },
      drafts: {},
    };

    // 1. Save & reload via IndexedDB
    const saveRes = await saveNeuroWorkspaceState(workspace, {
      indexedDB: idb,
    });
    expect(saveRes.ok).toBe(true);
    if (saveRes.ok) {
      expect(saveRes.backend).toBe("indexeddb");
      expect(saveRes.bytes).toBe(estimateNeuroWorkspaceBytes(workspace));
    }

    const loadRes = await loadNeuroWorkspaceState({ indexedDB: idb });
    expect(loadRes.backend).toBe("indexeddb");
    expect(loadRes.workspace?.uploadedVolume?.fileName).toBe(
      "sub-09_T1w.nii.gz"
    );
    expect(loadRes.workspace?.overlayLayer?.name).toBe("tumor-seg.nii.gz");
    expect(loadRes.workspace?.controlPoints).toHaveLength(1);
    expect(loadRes.workspace?.strokeHistory.undoStack).toHaveLength(1);

    const hydrated = hydrateVolumeFromStorage(
      loadRes.workspace!.uploadedVolume!,
      loadRes.workspace!.overlayLayer
    );
    expect(hydrated.overlayMask?.[0]).toBe(2);

    // 2. Enforce 250 MB cap (and custom byte cap)
    expect(MAX_NEURO_STORAGE_BYTES).toBe(250 * 1024 * 1024);
    const overCap = await saveNeuroWorkspaceState(workspace, {
      indexedDB: idb,
      maxBytes: 1024, // 1 KB cap to test quota rejection deterministically
    });
    expect(overCap.ok).toBe(false);
    if (!overCap.ok) {
      expect(overCap.code).toBe("QUOTA_EXCEEDED");
      expect(overCap.message).toMatch(/local storage limit/i);
    }

    // 3. Clear Local Storage purges IndexedDB + memory fallback
    const cleared = await clearNeuroLocalStorage({ indexedDB: idb });
    expect(cleared).toEqual({ ok: true, backend: "indexeddb" });
    const afterClear = await loadNeuroWorkspaceState({ indexedDB: idb });
    expect(afterClear.workspace).toBeNull();

    // 4. Private browsing fallback when IndexedDB is unavailable or open() throws
    const memSave = await saveNeuroWorkspaceState(workspace, {
      indexedDB: null,
    });
    expect(memSave).toMatchObject({ ok: true, backend: "memory" });
    const memLoad = await loadNeuroWorkspaceState({ indexedDB: null });
    expect(memLoad.backend).toBe("memory");
    expect(memLoad.workspace?.uploadedVolume?.fileName).toBe(
      "sub-09_T1w.nii.gz"
    );

    const blockedFactory = fromPartial<IDBFactory>({
      open: () => {
        throw new Error("SecurityError: IndexedDB blocked in private mode");
      },
    });
    const blockedLoad = await loadNeuroWorkspaceState({
      indexedDB: blockedFactory,
    });
    expect(blockedLoad.backend).toBe("memory");
    expect(blockedLoad.workspace?.uploadedVolume?.fileName).toBe(
      "sub-09_T1w.nii.gz"
    );
  });

  it("keeps the newer volume when older uploads and overlays finish later", async () => {
    render(<NeuroReconClient />);
    const dimensions = { width: 8, height: 8, depth: 8 };
    const bytes = serializeMaskToNiftiBytes(new Uint8Array(512).fill(1), {
      dimensions,
    });
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const upload = screen.getByTestId("neuro-upload-volume-input");
    const overlay = screen.getByTestId("neuro-import-overlay-input");
    const makeSlowFile = (name: string) => {
      const read = Promise.withResolvers<ArrayBuffer>();
      const file = new File([buffer], name);
      vi.spyOn(file, "arrayBuffer").mockReturnValue(read.promise);
      return { file, read };
    };

    const older = makeSlowFile("older.nii");
    fireEvent.change(upload, { target: { files: [older.file] } });
    await act(async () => {
      fireEvent.change(upload, {
        target: { files: [new File([buffer], "current.nii")] },
      });
    });
    expect(screen.getByTestId("brain-3d-stub").textContent).toContain(
      "current.nii"
    );

    const delayedOverlay = makeSlowFile("older-overlay.nii");
    fireEvent.change(overlay, { target: { files: [delayedOverlay.file] } });
    await act(async () => {
      fireEvent.change(upload, {
        target: { files: [new File([buffer], "latest.nii")] },
      });
    });
    await act(async () => {
      older.read.resolve(buffer);
      delayedOverlay.read.resolve(buffer);
    });

    expect(screen.getByTestId("brain-3d-stub").textContent).toContain(
      "latest.nii"
    );
    expect(
      screen.queryByRole("slider", { name: "Overlay mask opacity" })
    ).toBeNull();
  });

  it("supports per-stroke Undo (Ctrl+Z / Cmd+Z), Redo (Ctrl+Shift+Z / Ctrl+Y), native upload, overlay validation, and reload persistence in NeuroReconClient", async () => {
    const idb = new IDBFactory();
    const { unmount } = render(
      <NeuroReconClient storageOptions={{ indexedDB: idb }} />
    );

    // Select Paint tool [3] and draw a multi-move brush stroke on Coronal canvas
    pressKey("3");
    const coronalCanvas = screen.getByRole("img", {
      name: /^2D Coronal MRI Slice View/,
    });
    vi.spyOn(coronalCanvas, "getBoundingClientRect").mockReturnValue(
      fromPartial<DOMRect>({
        left: 0,
        top: 0,
        width: 96,
        height: 96,
      })
    );

    const undoBtn = screen.getByRole("button", { name: "Undo stroke" });
    const redoBtn = screen.getByRole("button", { name: "Redo stroke" });
    expect(undoBtn.hasAttribute("disabled")).toBe(true);
    expect(redoBtn.hasAttribute("disabled")).toBe(true);

    // Perform a single continuous drag gesture across multiple pixels -> grouped into 1 stroke
    fireEvent.mouseDown(coronalCanvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(coronalCanvas, { clientX: 14, clientY: 12 });
    fireEvent.mouseMove(coronalCanvas, { clientX: 18, clientY: 14 });
    fireEvent.mouseUp(coronalCanvas);

    expect(undoBtn.hasAttribute("disabled")).toBe(false);

    // Undo with Ctrl+Z -> undo button disables (proving the 3 drag steps coalesced into 1 stroke!)
    const undoEvt = pressKey("z", { ctrlKey: true });
    expect(undoEvt.defaultPrevented).toBe(true);
    expect(undoBtn.hasAttribute("disabled")).toBe(true);
    expect(redoBtn.hasAttribute("disabled")).toBe(false);

    // Redo with Ctrl+Shift+Z -> stroke restored
    const redoEvt = pressKey("Z", { ctrlKey: true, shiftKey: true });
    expect(redoEvt.defaultPrevented).toBe(true);
    expect(undoBtn.hasAttribute("disabled")).toBe(false);
    expect(redoBtn.hasAttribute("disabled")).toBe(true);

    // Undo with Cmd+Z and Redo with Ctrl+Y
    pressKey("z", { metaKey: true });
    expect(undoBtn.hasAttribute("disabled")).toBe(true);
    pressKey("y", { ctrlKey: true });
    expect(undoBtn.hasAttribute("disabled")).toBe(false);

    // Upload a native anisotropic .nii.gz scan via file input
    const dims = { width: 32, height: 24, depth: 20 };
    const spacing = { x: 0.8, y: 0.9, z: 1.5 };
    const maskSeed = new Uint8Array(dims.width * dims.height * dims.depth);
    for (let i = 0; i < maskSeed.length; i++) {
      maskSeed[i] = i % 5 === 0 ? 180 : 0;
    }
    const niiBytes = serializeMaskToNiftiBytes(maskSeed, {
      dimensions: dims,
      spacing,
    });
    const gzBytes = await gzipBytes(niiBytes);
    const gzBuf = new ArrayBuffer(gzBytes.byteLength);
    new Uint8Array(gzBuf).set(gzBytes);
    const scanFile = new File([gzBuf], "subject_aniso.nii.gz", {
      type: "application/gzip",
    });

    const uploadInput = screen.getByTestId("neuro-upload-volume-input");
    await act(async () => {
      fireEvent.change(uploadInput, { target: { files: [scanFile] } });
    });

    await waitFor(() => {
      expect(screen.getByTestId("slice-grid-badge").textContent).toContain(
        "32×24×20"
      );
    });
    expect(screen.getByTestId("neuro-provenance").textContent).toContain(
      "subject_aniso.nii.gz"
    );
    expect(screen.getByTestId("brain-3d-stub").textContent).toContain(
      "MC:subject_aniso.nii.gz"
    );

    // Import misaligned overlay -> rejected; import aligned overlay -> accepted with opacity slider
    const badOverlayBytes = serializeMaskToNiftiBytes(new Uint8Array(1000), {
      dimensions: { width: 10, height: 10, depth: 10 },
      spacing,
    });
    const badBuf = new ArrayBuffer(badOverlayBytes.byteLength);
    new Uint8Array(badBuf).set(badOverlayBytes);
    const overlayInput = screen.getByTestId("neuro-import-overlay-input");
    await act(async () => {
      fireEvent.change(overlayInput, {
        target: {
          files: [new File([badBuf], "bad-overlay.nii")],
        },
      });
    });
    expect(
      screen.queryByRole("slider", { name: "Overlay mask opacity" })
    ).toBeNull();

    const goodOverlayBytes = serializeMaskToNiftiBytes(maskSeed, {
      dimensions: dims,
      spacing,
    });
    const goodBuf = new ArrayBuffer(goodOverlayBytes.byteLength);
    new Uint8Array(goodBuf).set(goodOverlayBytes);
    await act(async () => {
      fireEvent.change(overlayInput, {
        target: {
          files: [new File([goodBuf], "lesion-overlay.nii")],
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("slider", { name: "Overlay mask opacity" })
      ).toBeDefined();
    });

    // WCAG 2.5.3 Label-in-Name: accessible names begin with each button's visible text
    expect(
      screen.getByRole("button", {
        name: "Export CSV: ROI and histogram metrics",
      }).textContent
    ).toContain("Export CSV");
    expect(
      screen.getByRole("button", {
        name: "Export Mask (.nii.gz): overlay layer",
      }).textContent
    ).toContain("Export Mask (.nii.gz)");
    expect(
      screen.getByRole("button", {
        name: "Overlay (lesion-overlay.nii): toggle mask visibility",
      }).textContent
    ).toContain("Overlay (lesion-overlay.nii)");

    // Wait for debounced IndexedDB persistence, then simulate browser reload by remounting!
    await new Promise((r) => setTimeout(r, 180));
    unmount();

    render(<NeuroReconClient storageOptions={{ indexedDB: idb }} />);
    await waitFor(() => {
      expect(screen.getByTestId("slice-grid-badge").textContent).toContain(
        "32×24×20"
      );
    });
    expect(
      screen.getByRole("slider", { name: "Overlay mask opacity" })
    ).toBeDefined();

    // Clear Local Storage purges uploaded scan and overlay back to synthetic defaults
    const clearBtn = screen.getByRole("button", {
      name: "Clear local storage",
    });
    await act(async () => {
      fireEvent.click(clearBtn);
    });
    await waitFor(() => {
      expect(screen.getByTestId("slice-grid-badge").textContent).toContain(
        "96×96×96"
      );
    });
  });
});
