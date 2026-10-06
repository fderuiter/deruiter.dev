import React, { useEffect } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useThree } from "@react-three/fiber";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { MeshBasicMaterial, PerspectiveCamera, PointLight } from "three";
import { LOOK_PRESETS } from "@/lib/patty-drive-thru";
import {
  BOOTH_CAMERA,
  BoothWorld,
} from "@/components/patty-drive-thru/BoothWorld";
import {
  createBoothStore,
  type BoothStore,
} from "@/components/patty-drive-thru/store";

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const renderers: Renderer[] = [];
let camera: PerspectiveCamera | null = null;

/** Hands the test the scene's camera. */
function CameraProbe() {
  const sceneCamera = useThree((state) => state.camera);
  useEffect(() => {
    camera = sceneCamera as PerspectiveCamera;
  }, [sceneCamera]);
  return null;
}

async function renderBooth(store: BoothStore, onOpenRegister = vi.fn()) {
  const renderer = await ReactThreeTestRenderer.create(
    <>
      <CameraProbe />
      <BoothWorld store={store} onOpenRegister={onOpenRegister} />
    </>,
    { camera: BOOTH_CAMERA }
  );
  renderers.push(renderer);
  return { renderer, onOpenRegister };
}

function clockedIn(seed = "e2e-4"): BoothStore {
  const store = createBoothStore({ seed, durationSec: 180 });
  store.getState().clockIn();
  return store;
}

function run(store: BoothStore, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) store.getState().tick(0.1);
}

/** Every mesh whose geometry is of the given type. */
function meshesWith(renderer: Renderer, geometry: string) {
  return renderer.scene
    .findAll((node) => node.type === "Mesh")
    .filter((mesh) =>
      mesh.allChildren.some((child) => child.type === geometry)
    );
}

/**
 * Every unlit material in the booth: the screens and the LEDs. Checked by
 * three's type flags, because the renderer loads three's CommonJS build and
 * the test its ES module build, so `instanceof` is always false.
 */
function basicMaterials(renderer: Renderer): MeshBasicMaterial[] {
  return renderer.scene
    .findAll((node) => node.type === "MeshBasicMaterial")
    .map((node): unknown => node.instance)
    .filter(
      (material): material is MeshBasicMaterial =>
        typeof material === "object" &&
        material !== null &&
        "isMeshBasicMaterial" in material
    );
}

afterEach(async () => {
  while (renderers.length > 0) {
    await renderers.pop()?.unmount();
  }
  vi.useRealTimers();
});

describe("Patty's Drive-Thru booth scene (#1813)", () => {
  it("builds the booth with lights, screens and no car before the first order", async () => {
    const store = clockedIn();
    const { renderer } = await renderBooth(store);
    const lights = renderer.scene.findAll((n) => n.type === "PointLight");
    expect(lights.length).toBeGreaterThanOrEqual(5);
    expect(
      renderer.scene.findAll((n) => n.type === "HemisphereLight")
    ).toHaveLength(1);
    // The car is the only extruded geometry in the booth.
    expect(meshesWith(renderer, "ExtrudeGeometry")).toHaveLength(0);
  });

  it("pulls a car up to the window when an order arrives", async () => {
    const store = clockedIn();
    const { renderer } = await renderBooth(store);
    await ReactThreeTestRenderer.act(async () => run(store, 2.5));
    expect(meshesWith(renderer, "ExtrudeGeometry")).toHaveLength(2);
  });

  it("points the camera where the head is and zooms into the register", async () => {
    const store = clockedIn();
    const { renderer } = await renderBooth(store);
    await ReactThreeTestRenderer.act(async () => {
      store.getState().setRegisterOpen(true);
      for (let i = 0; i < 40; i++) {
        store.getState().moveHead({ turn: 0, dragYaw: 0, dragPitch: 0 }, 0.05);
      }
    });
    await renderer.advanceFrames(30, 0.05);
    const cam = camera;
    expect(cam).not.toBeNull();
    expect(cam?.rotation.y).toBeCloseTo(LOOK_PRESETS.register.yaw, 2);
    expect(cam?.rotation.x).toBeCloseTo(LOOK_PRESETS.register.pitch, 2);
    expect(cam?.fov).toBeLessThan(BOOTH_CAMERA.fov);
  });

  it("opens the register from a click on its screen, but not from a drag", async () => {
    const store = clockedIn();
    const { renderer, onOpenRegister } = await renderBooth(store);
    const clickable = renderer.scene
      .findAll((n) => n.type === "Mesh")
      .filter((mesh) => typeof mesh.props.onClick === "function");
    expect(clickable.length).toBeGreaterThanOrEqual(2);
    for (const mesh of clickable) {
      await renderer.fireEvent(mesh, "onClick", { delta: 20 });
    }
    expect(onOpenRegister).not.toHaveBeenCalled();
    for (const mesh of clickable) {
      await renderer.fireEvent(mesh, "onClick", { delta: 0 });
    }
    expect(onOpenRegister).toHaveBeenCalledTimes(clickable.length);
  });

  it("flickers the troffers when the manager yells, then restores them", async () => {
    vi.useFakeTimers();
    const store = clockedIn();
    const { renderer } = await renderBooth(store);
    const troffers = () =>
      renderer.scene
        .findAll((n) => n.type === "PointLight")
        .map((n) => n.instance)
        .filter((light): light is PointLight => "isPointLight" in light)
        .filter((light) => light.color.getHexString() === "e6f0d0");
    const full = troffers().map((light) => light.intensity);
    await ReactThreeTestRenderer.act(async () => run(store, 16));
    expect(store.getState().yells).toBeGreaterThan(0);
    expect(troffers()[0].intensity).toBeLessThan(full[0]);
    await ReactThreeTestRenderer.act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(troffers().map((light) => light.intensity)).toEqual(full);
  });

  it("redraws the screens as the shift changes and frees them on unmount", async () => {
    vi.useFakeTimers();
    const store = clockedIn("e2e-1");
    const { renderer } = await renderBooth(store);
    const screens = basicMaterials(renderer).filter((material) => material.map);
    expect(screens.length).toBe(3);
    const versions = screens.map((material) => material.map?.version ?? 0);
    await ReactThreeTestRenderer.act(async () => {
      run(store, 2.5);
      store.getState().act({ type: "selectOrder", orderId: 1 });
      vi.advanceTimersByTime(300);
    });
    const after = screens.map((material) => material.map?.version ?? 0);
    expect(after.every((version, i) => version > versions[i])).toBe(true);
    // An unchanged picture is not drawn again.
    await ReactThreeTestRenderer.act(async () => {
      vi.advanceTimersByTime(300);
    });
    const pos = screens.map((material) => material.map?.version ?? 0);
    expect(pos.some((version, i) => version === after[i])).toBe(true);

    await renderers.pop()?.unmount();
    expect(screens.every((material) => material.map === null)).toBe(true);
  });

  it("lights the dispenser red for a dropped drink and the brewer amber while Dale brews", async () => {
    const store = clockedIn("e2e-5");
    const { renderer } = await renderBooth(store);
    const ledColors = () =>
      basicMaterials(renderer).map((material) => material.color.getHexString());
    expect(ledColors()).not.toContain("f59e0b");
    await ReactThreeTestRenderer.act(async () => {
      run(store, 2.5);
      store.getState().act({ type: "flagCoworker", orderId: 1 });
    });
    expect(ledColors()).toContain("f59e0b");

    expect(ledColors()).not.toContain("ef4444");
    await ReactThreeTestRenderer.act(async () => {
      const { shift } = store.getState();
      const [order] = shift.orders;
      store.setState({
        shift: {
          ...shift,
          orders: [
            {
              ...order,
              items: order.items.map((item, index) =>
                index === 0 ? { ...item, dropped: true } : item
              ),
            },
          ],
        },
      });
    });
    expect(ledColors()).toContain("ef4444");
  });
});
