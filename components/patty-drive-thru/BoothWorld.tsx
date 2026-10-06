"use client";

/**
 * What is in the first-person drive-thru booth (ADR 0059, #1813): a fixed standing
 * position under fluorescent troffers. The drive-thru window, the lane and a
 * waiting car are on the left; the register sits on the counter ahead with
 * the kitchen display hanging over the pass-through; the drink station is on
 * the right. It only renders; the engine and the booth store own every rule,
 * and the shift loop moves the head.
 *
 * Built from primitives with procedural canvas textures, so it loads no
 * models or images. It renders on demand: a frame is drawn when the head
 * moves, a screen changes or the booth changes.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  type MeshBasicMaterial,
  type PerspectiveCamera,
  type PointLight,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector2,
} from "three";
import {
  formatClock,
  getKdsTickets,
  type KdsTicket,
} from "@/lib/patty-drive-thru";
import { useBooth } from "./hooks";
import { drawKds, KDS_TEXTURE_HEIGHT, KDS_TEXTURE_WIDTH } from "./kds-texture";
import {
  drawPos,
  POS_TEXTURE_HEIGHT,
  POS_TEXTURE_WIDTH,
  readPosPicture,
} from "./pos-texture";
import type { BoothState, BoothStore } from "./store";

const EYE_HEIGHT = 1.62;
const BASE_FOV = 70;

/** The player's eyes: where they stand and how wide they see at rest. */
export const BOOTH_CAMERA = {
  fov: BASE_FOV,
  near: 0.05,
  far: 30,
  position: [0, EYE_HEIGHT, 0.1] as [number, number, number],
};
/** The register zoom narrows the view, so the lane and screen drop out. */
const REGISTER_FOV = 38;
/** How often the in-booth screens check for something new to draw, in ms. */
const SCREEN_REFRESH_MS = 250;
/** The lane outside sits lower than the booth floor. */
const LANE_Y = -0.3;
/** Strength of each ceiling troffer's light at full power. */
const TROFFER_INTENSITY = 3.2;

/** Booth colours, the 3D counterpart of the cabinet's --pdt-* tokens. */
const COLORS = {
  background: "#0b0e10",
  tile: "#8a4a36",
  grout: "#3a2a22",
  wall: "#a8a28c",
  wallSpeck: "#99937d",
  wainscot: "#6b6252",
  ceiling: "#c9c5b2",
  ceilingGrid: "#8f8b7b",
  troffer: "#eef6dc",
  troffLight: "#e6f0d0",
  steel: "#9aa1a1",
  steelDark: "#5d6363",
  counter: "#5f5546",
  posBody: "#2f302d",
  kdsBody: "#1b1d1e",
  frame: "#8d9294",
  glass: "#cfe3e8",
  asphalt: "#202326",
  curb: "#55534d",
  night: "#0b0f14",
  sodium: "#ffad55",
  headlight: "#fff4cf",
  taillight: "#c2301f",
  tyre: "#151515",
  driver: "#1d1814",
  carGlass: "#151b21",
  heatLamp: "#ff9a4a",
  paper: "#e6dcc2",
  paperDark: "#cdbb92",
  bag: "#8f7556",
  ledGreen: "#4ade80",
  ledRed: "#ef4444",
  ledAmber: "#f59e0b",
  ledOff: "#2a2a28",
  rag: "#c9c0a0",
  timer: "#ff4a3a",
} as const;

/** Paint colours for the car at the window, picked by order number. */
const CAR_COLORS = ["#7d8790", "#2f3d57", "#b9b6ad", "#7a2e26"] as const;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** A small seeded generator, so procedural textures look the same each time. */
function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Red quarry tile with dark grout, two by two tiles per repeat. */
const paintQuarryTile: Painter = (ctx, w, h) => {
  const random = seededRandom(7);
  const half = w / 2;
  ctx.fillStyle = COLORS.grout;
  ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const shade = 0.86 + random() * 0.18;
      ctx.fillStyle = COLORS.tile;
      ctx.globalAlpha = shade;
      ctx.fillRect(col * half + 3, row * half + 3, half - 6, half - 6);
    }
  }
  ctx.globalAlpha = 1;
};

/** Pebbled fibreglass wall panel, flecked and a little dirty. */
const paintWallPanel: Painter = (ctx, w, h) => {
  const random = seededRandom(11);
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.wallSpeck;
  for (let i = 0; i < 500; i += 1) {
    ctx.fillRect(random() * w, random() * h, 2, 2);
  }
};

/** Two-by-four drop-ceiling tiles. */
const paintCeiling: Painter = (ctx, w, h) => {
  ctx.fillStyle = COLORS.ceiling;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.ceilingGrid;
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, 0, 4, h);
};

function paintSign(lines: readonly string[]): Painter {
  return (ctx, w, h) => {
    ctx.fillStyle = "#efeadb";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#a9412f";
    ctx.fillRect(0, 0, w, h * 0.12);
    ctx.fillStyle = "#26231d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 44px sans-serif";
    lines.forEach((line, index) => {
      ctx.fillText(line, w / 2, h * 0.38 + index * 62, w - 40);
    });
  };
}

const paintSpeedSign = paintSign(["EVERY SECOND", "COUNTS"]);
const paintHandwashSign = paintSign(["EMPLOYEES MUST", "WASH HANDS"]);

/**
 * A texture painted once on a canvas. It is disposed of when the scene
 * unmounts or the painter changes.
 */
function usePaintedTexture(
  width: number,
  height: number,
  paint: Painter,
  repeatX = 1,
  repeatY = 1
): CanvasTexture | null {
  const texture = useMemo(() => {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    paint(ctx, width, height);
    const painted = new CanvasTexture(canvas);
    painted.colorSpace = SRGBColorSpace;
    if (repeatX !== 1 || repeatY !== 1) {
      painted.wrapS = RepeatWrapping;
      painted.wrapT = RepeatWrapping;
      painted.repeat.set(repeatX, repeatY);
    }
    return painted;
  }, [width, height, paint, repeatX, repeatY]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

interface LiveScreenProps<T> {
  store: BoothStore;
  /** Canvas size in pixels. */
  width: number;
  height: number;
  /** Screen size in metres. */
  size: [number, number];
  /** Reads what the screen shows. Must be stable; equal results skip a redraw. */
  read: (state: BoothState) => T;
  /** Draws it. Must be stable. */
  draw: (ctx: CanvasRenderingContext2D, picture: T) => void;
  onClick?: () => void;
}

/**
 * A lit screen in the booth: a canvas texture redrawn when what it shows
 * changes, checked a few times a second. The texture is made and owned by
 * the effect, which disposes of it on unmount.
 */
function LiveScreen<T>({
  store,
  width,
  height,
  size,
  read,
  draw,
  onClick,
}: LiveScreenProps<T>) {
  const invalidate = useThree((state) => state.invalidate);
  const material = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const target = material.current;
    if (target) {
      target.map = texture;
      target.needsUpdate = true;
    }
    let shown = "";
    const redraw = () => {
      const picture = read(store.getState());
      const signature = JSON.stringify(picture);
      if (signature === shown) return;
      shown = signature;
      draw(ctx, picture);
      texture.needsUpdate = true;
      invalidate();
    };
    redraw();
    const timer = window.setInterval(redraw, SCREEN_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      if (target) target.map = null;
      texture.dispose();
    };
  }, [store, invalidate, width, height, read, draw]);

  return (
    <mesh
      onClick={
        onClick
          ? (event) => {
              if (event.delta < 6) onClick();
            }
          : undefined
      }
    >
      <planeGeometry args={size} />
      <meshBasicMaterial ref={material} toneMapped={false} />
    </mesh>
  );
}

/** Kitchen display tickets with their clocks rounded to whole seconds. */
function readKds(state: BoothState): KdsTicket[] {
  return getKdsTickets(state.shift).map((ticket) => ({
    ...ticket,
    ageSec: Math.ceil(ticket.ageSec),
    coworkerReadyIn: null,
  }));
}

function readPos(state: BoothState) {
  return readPosPicture(state.shift);
}

/** The oldest open order's age, in whole seconds, or null with no cars. */
function readOldestAge(state: BoothState): number | null {
  const oldest = getKdsTickets(state.shift)[0];
  return oldest ? Math.ceil(oldest.ageSec) : null;
}

const TIMER_WIDTH = 256;
const TIMER_HEIGHT = 96;

/** The red drive-thru timer over the window: the oldest car's wait. */
function drawTimer(ctx: CanvasRenderingContext2D, age: number | null): void {
  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, TIMER_WIDTH, TIMER_HEIGHT);
  ctx.fillStyle = COLORS.timer;
  ctx.font = "bold 64px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    age === null ? "-:--" : formatClock(age),
    TIMER_WIDTH / 2,
    TIMER_HEIGHT / 2 + 4
  );
}

function drawKdsScreen(
  ctx: CanvasRenderingContext2D,
  tickets: readonly KdsTicket[]
): void {
  drawKds(ctx, tickets);
}

function drawPosScreen(
  ctx: CanvasRenderingContext2D,
  picture: ReturnType<typeof readPosPicture>
): void {
  drawPos(ctx, picture);
}

/** Points the camera where the head is, and narrows it for the register. */
function CameraRig({ store }: { store: BoothStore }) {
  const invalidate = useThree((state) => state.invalidate);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const { look, registerOpen } = store.getState();
    camera.rotation.set(look.pitch, look.yaw, 0, "YXZ");
    const targetFov = registerOpen ? REGISTER_FOV : BASE_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-10 * delta));
      camera.updateProjectionMatrix();
      invalidate();
    }
  });

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (
          state.look !== previous.look ||
          state.registerOpen !== previous.registerOpen ||
          state.shift.orders !== previous.shift.orders
        ) {
          invalidate();
        }
      }),
    [store, invalidate]
  );

  return null;
}

/** Ceiling troffers and their light; they stutter when the manager yells. */
function FluorescentLights({ store }: { store: BoothStore }) {
  const invalidate = useThree((state) => state.invalidate);
  const yells = useBooth(store, (s) => s.yells);
  const lights = useRef<(PointLight | null)[]>([]);

  useEffect(() => {
    if (yells === 0) return undefined;
    const timers: number[] = [];
    const set = (scale: number) => {
      for (const light of lights.current) {
        if (light) light.intensity = TROFFER_INTENSITY * scale;
      }
      invalidate();
    };
    set(0.35);
    timers.push(window.setTimeout(() => set(1), 90));
    timers.push(window.setTimeout(() => set(0.5), 180));
    timers.push(window.setTimeout(() => set(1), 260));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      set(1);
    };
  }, [yells, invalidate]);

  return (
    <>
      <hemisphereLight args={["#dfe8cf", "#3a3026", 0.4]} />
      {(
        [
          [-0.1, -0.55],
          [1.0, 0.25],
        ] as const
      ).map(([x, z], index) => (
        <group key={index} position={[x, 2.585, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.6, 1.2]} />
            <meshStandardMaterial
              color={COLORS.troffer}
              emissive={COLORS.troffer}
              emissiveIntensity={1.15}
            />
          </mesh>
          <pointLight
            ref={(light) => {
              lights.current[index] = light;
            }}
            position={[0, -0.2, 0]}
            color={COLORS.troffLight}
            intensity={TROFFER_INTENSITY}
            distance={6}
            decay={2}
          />
        </group>
      ))}
    </>
  );
}

/** Floor, ceiling and the walls around the booth and the kitchen. */
function BoothShell() {
  const floor = usePaintedTexture(128, 128, paintQuarryTile, 7, 9.75);
  const wall = usePaintedTexture(256, 256, paintWallPanel, 2, 2);
  const ceiling = usePaintedTexture(128, 256, paintCeiling, 4.6, 3.25);
  const speedSign = usePaintedTexture(512, 256, paintSpeedSign);
  const handwash = usePaintedTexture(512, 256, paintHandwashSign);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.225, 0, -0.65]}>
        <planeGeometry args={[2.75, 3.9]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.225, 2.6, -0.65]}>
        <planeGeometry args={[2.75, 3.9]} />
        <meshStandardMaterial map={ceiling} roughness={1} />
      </mesh>

      {/* Window wall on the left, with the drive-thru window cut out. */}
      <mesh position={[-1.2, 0.475, -0.65]}>
        <boxGeometry args={[0.1, 0.95, 3.9]} />
        <meshStandardMaterial color={COLORS.wainscot} roughness={0.9} />
      </mesh>
      <mesh position={[-1.2, 2.275, -0.65]}>
        <boxGeometry args={[0.1, 0.65, 3.9]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[-1.2, 1.45, -1.625]}>
        <boxGeometry args={[0.1, 1.0, 1.95]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[-1.2, 1.45, 0.825]}>
        <boxGeometry args={[0.1, 1.0, 0.95]} />
        <meshStandardMaterial map={wall} />
      </mesh>

      {/* Right wall, behind the drink station. */}
      <mesh position={[1.65, 1.3, -0.65]}>
        <boxGeometry args={[0.1, 2.6, 3.9]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[1.595, 1.78, 0.2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 0.25]} />
        <meshStandardMaterial map={handwash} />
      </mesh>

      {/* Back wall, behind the player. */}
      <mesh position={[0.225, 1.3, 1.3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.75, 2.6]} />
        <meshStandardMaterial map={wall} />
      </mesh>

      {/* Pass-through wall ahead, open over the counter to the kitchen. */}
      <mesh position={[-0.95, 1.3, -1.29]}>
        <boxGeometry args={[0.4, 2.6, 0.08]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[1.225, 1.3, -1.29]}>
        <boxGeometry args={[0.75, 2.6, 0.08]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[0.05, 0.5, -1.29]}>
        <boxGeometry args={[1.6, 1.0, 0.08]} />
        <meshStandardMaterial color={COLORS.wainscot} />
      </mesh>
      <mesh position={[0.05, 2.175, -1.29]}>
        <boxGeometry args={[1.6, 0.85, 0.08]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      <mesh position={[1.22, 1.5, -1.245]}>
        <planeGeometry args={[0.55, 0.28]} />
        <meshStandardMaterial map={speedSign} />
      </mesh>

      {/* Kitchen beyond the pass: back wall, grill and its hood. */}
      <mesh position={[0.225, 1.3, -2.6]}>
        <planeGeometry args={[2.75, 2.6]} />
        <meshStandardMaterial
          color={COLORS.steelDark}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0.05, 2.25, -2.3]}>
        <boxGeometry args={[1.6, 0.5, 0.6]} />
        <meshStandardMaterial
          color={COLORS.steelDark}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0.05, 0.45, -2.25]}>
        <boxGeometry args={[1.4, 0.9, 0.6]} />
        <meshStandardMaterial
          color={COLORS.steel}
          metalness={0.45}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0.05, 0.905, -2.25]}>
        <boxGeometry args={[1.36, 0.02, 0.56]} />
        <meshStandardMaterial color="#2a2a28" roughness={0.6} />
      </mesh>
      <pointLight
        position={[0.05, 2.0, -1.9]}
        color="#f4efd2"
        intensity={1.6}
        distance={4}
        decay={2}
      />
    </group>
  );
}

/** The counter under the register, the heat shelf and what sits on them. */
function Counters() {
  return (
    <group>
      {/* Front counter. */}
      <mesh position={[-0.15, 0.45, -0.815]}>
        <boxGeometry args={[2.0, 0.9, 0.87]} />
        <meshStandardMaterial color={COLORS.counter} roughness={0.8} />
      </mesh>
      <mesh position={[-0.15, 0.91, -0.81]}>
        <boxGeometry args={[2.02, 0.03, 0.9]} />
        <meshStandardMaterial
          color={COLORS.steel}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[-0.15, 0.06, -0.37]}>
        <boxGeometry args={[2.0, 0.12, 0.02]} />
        <meshStandardMaterial color={COLORS.steelDark} metalness={0.4} />
      </mesh>

      {/* Heat shelf in the pass-through, under its lamps. */}
      <mesh position={[0.05, 1.0, -1.375]}>
        <boxGeometry args={[1.6, 0.03, 0.35]} />
        <meshStandardMaterial
          color={COLORS.steel}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0.05, 1.7, -1.375]}>
        <boxGeometry args={[1.5, 0.05, 0.12]} />
        <meshStandardMaterial
          color={COLORS.heatLamp}
          emissive={COLORS.heatLamp}
          emissiveIntensity={1.4}
        />
      </mesh>
      <pointLight
        position={[0.05, 1.5, -1.3]}
        color={COLORS.heatLamp}
        intensity={0.9}
        distance={1.4}
        decay={2}
      />
      {(
        [
          [-0.42, COLORS.paper],
          [-0.22, COLORS.paperDark],
          [0.48, COLORS.paper],
        ] as const
      ).map(([x, color]) => (
        <mesh key={x} position={[x, 1.05, -1.38]} rotation={[0, x, 0]}>
          <boxGeometry args={[0.12, 0.06, 0.12]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}

      {/* A bag waiting by the window and the rag for idle hands. */}
      <mesh position={[-0.92, 1.045, -1.02]}>
        <boxGeometry args={[0.16, 0.24, 0.1]} />
        <meshStandardMaterial color={COLORS.bag} roughness={1} />
      </mesh>
      <mesh position={[0.42, 0.932, -0.55]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.22, 0.015, 0.16]} />
        <meshStandardMaterial color={COLORS.rag} roughness={1} />
      </mesh>
    </group>
  );
}

/** The register on the counter; its screen is a picture of the real one. */
function RegisterTerminal({
  store,
  onOpen,
}: {
  store: BoothStore;
  onOpen: () => void;
}) {
  return (
    <group position={[-0.2, 0.925, -0.8]} rotation={[0, 0.2, 0]}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[0.34, 0.05, 0.26]} />
        <meshStandardMaterial color={COLORS.posBody} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.17, -0.06]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.05, 0.26, 0.05]} />
        <meshStandardMaterial color={COLORS.posBody} />
      </mesh>
      <group position={[0, 0.35, -0.03]} rotation={[-0.42, 0, 0]}>
        <mesh
          onClick={(event) => {
            if (event.delta < 6) onOpen();
          }}
        >
          <boxGeometry args={[0.46, 0.355, 0.04]} />
          <meshStandardMaterial color={COLORS.posBody} roughness={0.5} />
        </mesh>
        <group position={[0, 0, 0.021]}>
          <LiveScreen
            store={store}
            width={POS_TEXTURE_WIDTH}
            height={POS_TEXTURE_HEIGHT}
            size={[0.42, 0.315]}
            read={readPos}
            draw={drawPosScreen}
            onClick={onOpen}
          />
        </group>
      </group>
    </group>
  );
}

/** The kitchen display, hanging over the pass-through on two rods. */
function KitchenDisplay({ store }: { store: BoothStore }) {
  return (
    <group>
      <group position={[0.05, 1.9, -1.02]} rotation={[0.3, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.16, 0.46, 0.06]} />
          <meshStandardMaterial color={COLORS.kdsBody} roughness={0.6} />
        </mesh>
        <group position={[0, 0, 0.031]}>
          <LiveScreen
            store={store}
            width={KDS_TEXTURE_WIDTH}
            height={KDS_TEXTURE_HEIGHT}
            size={[1.1, 1.1 * (KDS_TEXTURE_HEIGHT / KDS_TEXTURE_WIDTH)]}
            read={readKds}
            draw={drawKdsScreen}
          />
        </group>
      </group>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[0.05 + x, 2.36, -0.99]}>
          <cylinderGeometry args={[0.012, 0.012, 0.48, 8]} />
          <meshStandardMaterial color={COLORS.steelDark} />
        </mesh>
      ))}
    </group>
  );
}

/** The window frame, its sill, the timer over it and the headset box. */
function DriveThruWindow({ store }: { store: BoothStore }) {
  const carWaiting = useBooth(store, (s) => s.shift.orders.length > 0);
  return (
    <group>
      {(
        [
          // [y, z, height, depth]
          [1.95, -0.15, 0.04, 1.04],
          [0.95, -0.15, 0.04, 1.04],
          [1.45, -0.65, 1.0, 0.04],
          [1.45, 0.35, 1.0, 0.04],
          [1.45, -0.15, 1.0, 0.03],
        ] as const
      ).map(([y, z, height, depth]) => (
        <mesh key={`${y}-${z}`} position={[-1.15, y, z]}>
          <boxGeometry args={[0.06, height, depth]} />
          <meshStandardMaterial
            color={COLORS.frame}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
      <mesh position={[-1.03, 0.94, -0.15]}>
        <boxGeometry args={[0.26, 0.03, 1.0]} />
        <meshStandardMaterial
          color={COLORS.steel}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>
      {/* The sliding pane, shut on the back half. */}
      <mesh position={[-1.17, 1.45, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 1.0]} />
        <meshStandardMaterial
          color={COLORS.glass}
          transparent
          opacity={0.14}
          roughness={0.1}
          depthWrite={false}
        />
      </mesh>
      {/* A drink waiting on the sill. */}
      <mesh position={[-1.0, 1.025, -0.42]}>
        <cylinderGeometry args={[0.045, 0.035, 0.14, 16]} />
        <meshStandardMaterial color={COLORS.paper} roughness={0.9} />
      </mesh>

      <group position={[-1.14, 2.12, -0.15]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.38, 0.16, 0.04]} />
          <meshStandardMaterial color={COLORS.kdsBody} />
        </mesh>
        <group position={[0, 0, 0.021]}>
          <LiveScreen
            store={store}
            width={TIMER_WIDTH}
            height={TIMER_HEIGHT}
            size={[0.34, 0.1275]}
            read={readOldestAge}
            draw={drawTimer}
          />
        </group>
      </group>

      <group position={[-1.13, 1.45, -0.98]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.24, 0.18, 0.05]} />
          <meshStandardMaterial color={COLORS.posBody} />
        </mesh>
        <mesh position={[-0.06, 0.04, 0.026]}>
          <circleGeometry args={[0.02, 16]} />
          <meshBasicMaterial
            color={carWaiting ? COLORS.ledGreen : COLORS.ledOff}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Side profile of the car body, front at the left, in metres. */
const CAR_BODY_PROFILE = new Shape(
  [
    [-2.15, 0.3],
    [-2.15, 0.74],
    [-1.25, 0.86],
    [-0.75, 0.9],
    [1.45, 0.9],
    [2.15, 0.82],
    [2.15, 0.3],
  ].map(([x, y]) => new Vector2(x, y))
);
/** Side profile of the cabin: sloped windscreen, roof and rear window. */
const CAR_CABIN_PROFILE = new Shape(
  [
    [-0.75, 0.9],
    [-0.12, 1.36],
    [1.0, 1.36],
    [1.45, 0.9],
  ].map(([x, y]) => new Vector2(x, y))
);
const CAR_WIDTH = 1.75;
const CABIN_WIDTH = 1.5;

/**
 * The car at the window, built from two extruded side profiles so the
 * windscreen slopes and it reads as a car through the window. The driver sits
 * on the near side, by the booth.
 */
function WaitingCar({ color }: { color: string }) {
  return (
    <group position={[-2.4, LANE_Y, -0.2]}>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CAR_WIDTH / 2, 0, 0]}>
        <extrudeGeometry
          args={[CAR_BODY_PROFILE, { depth: CAR_WIDTH, bevelEnabled: false }]}
        />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CABIN_WIDTH / 2, 0, 0]}>
        <extrudeGeometry
          args={[
            CAR_CABIN_PROFILE,
            { depth: CABIN_WIDTH, bevelEnabled: false },
          ]}
        />
        <meshStandardMaterial
          color={COLORS.carGlass}
          roughness={0.1}
          metalness={0.4}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 1.37, 0.44]}>
        <boxGeometry args={[CABIN_WIDTH, 0.03, 1.08]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh position={[0.35, 1.13, 0.1]}>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color={COLORS.driver} roughness={0.9} />
      </mesh>
      <mesh position={[0.35, 0.98, 0.3]}>
        <boxGeometry args={[0.5, 0.5, 0.14]} />
        <meshStandardMaterial color={COLORS.driver} roughness={0.9} />
      </mesh>
      {(
        [
          [0.8, -1.35],
          [-0.8, -1.35],
          [0.8, 1.35],
          [-0.8, 1.35],
        ] as const
      ).map(([x, z]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, 0.33, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.33, 0.33, 0.2, 18]} />
          <meshStandardMaterial color={COLORS.tyre} roughness={0.9} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={`head-${x}`} position={[x, 0.64, -2.16]}>
          <boxGeometry args={[0.32, 0.12, 0.02]} />
          <meshBasicMaterial color={COLORS.headlight} toneMapped={false} />
        </mesh>
      ))}
      {[-0.6, 0.6].map((x) => (
        <mesh key={`tail-${x}`} position={[x, 0.7, 2.16]}>
          <boxGeometry args={[0.28, 0.1, 0.02]} />
          <meshBasicMaterial color={COLORS.taillight} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0.95, 0.98, -0.7]}>
        <boxGeometry args={[0.16, 0.1, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Outside: the lane, the sodium lamp, the night and, if one is open, a car. */
function DriveThruLane({ store }: { store: BoothStore }) {
  const firstOrder = useBooth(store, (s) => s.shift.orders[0]?.id ?? null);
  const carColor =
    firstOrder === null
      ? null
      : CAR_COLORS[(firstOrder - 1 + CAR_COLORS.length) % CAR_COLORS.length];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.6, LANE_Y, 0]}>
        <planeGeometry args={[6.9, 20]} />
        <meshStandardMaterial color={COLORS.asphalt} roughness={0.95} />
      </mesh>
      <mesh position={[-1.32, LANE_Y + 0.08, 0]}>
        <boxGeometry args={[0.24, 0.16, 20]} />
        <meshStandardMaterial color={COLORS.curb} roughness={0.95} />
      </mesh>
      <mesh position={[-8, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[24, 8]} />
        <meshBasicMaterial color={COLORS.night} />
      </mesh>

      {/* The sodium street lamp across the lane. */}
      <mesh position={[-5.3, 1.6, -2.4]}>
        <cylinderGeometry args={[0.05, 0.06, 3.7, 8]} />
        <meshStandardMaterial color={COLORS.steelDark} />
      </mesh>
      <mesh position={[-5.0, 3.45, -2.4]}>
        <boxGeometry args={[0.6, 0.1, 0.22]} />
        <meshBasicMaterial color={COLORS.sodium} toneMapped={false} />
      </mesh>
      <pointLight
        position={[-4.9, 3.3, -2.4]}
        color={COLORS.sodium}
        intensity={14}
        distance={14}
        decay={2}
      />

      {/* Booth light spilling out of the window onto whoever is there. */}
      <pointLight
        position={[-1.6, 1.75, -0.15]}
        color={COLORS.troffLight}
        intensity={2.2}
        distance={3}
        decay={2}
      />
      {carColor ? <WaitingCar color={carColor} /> : null}
    </group>
  );
}

/** The drink station on the right: dispenser, cups and the coffee brewer. */
function DrinkStation({ store }: { store: BoothStore }) {
  const dropped = useBooth(store, (s) =>
    s.shift.orders.some((order) => order.items.some((item) => item.dropped))
  );
  const brewing = useBooth(store, (s) =>
    s.shift.orders.some(
      (order) =>
        order.coworkerReadyAt !== null && s.shift.time < order.coworkerReadyAt
    )
  );

  return (
    <group>
      <mesh position={[1.225, 0.45, -0.275]}>
        <boxGeometry args={[0.75, 0.9, 1.95]} />
        <meshStandardMaterial color={COLORS.counter} roughness={0.8} />
      </mesh>
      <mesh position={[1.225, 0.91, -0.275]}>
        <boxGeometry args={[0.77, 0.03, 1.97]} />
        <meshStandardMaterial
          color={COLORS.steel}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>

      {/* The automatic dispenser; its light goes red when it drops a drink. */}
      <group position={[1.32, 0.925, -0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[0.52, 0.76, 0.46]} />
          <meshStandardMaterial
            color={COLORS.steel}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.56, 0.231]}>
          <planeGeometry args={[0.4, 0.2]} />
          <meshStandardMaterial color="#2a2f33" />
        </mesh>
        <mesh position={[0.15, 0.7, 0.232]}>
          <circleGeometry args={[0.022, 16]} />
          <meshBasicMaterial
            color={dropped ? COLORS.ledRed : COLORS.ledOff}
            toneMapped={false}
          />
        </mesh>
        {[-0.14, 0, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.24, 0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.08, 8]} />
            <meshStandardMaterial color={COLORS.steelDark} />
          </mesh>
        ))}
      </group>

      {/* Sleeves of cups. */}
      {[0.02, 0.14].map((z) => (
        <mesh key={z} position={[1.28, 1.08, z]}>
          <cylinderGeometry args={[0.045, 0.04, 0.3, 12]} />
          <meshStandardMaterial color={COLORS.paper} roughness={0.95} />
        </mesh>
      ))}

      {/* The coffee brewer, amber while Dale brews. */}
      <group position={[1.32, 0.925, 0.42]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[0.3, 0.54, 0.34]} />
          <meshStandardMaterial color={COLORS.posBody} roughness={0.6} />
        </mesh>
        <mesh position={[0.09, 0.45, 0.171]}>
          <circleGeometry args={[0.018, 16]} />
          <meshBasicMaterial
            color={brewing ? COLORS.ledAmber : COLORS.ledOff}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

interface BoothWorldProps {
  store: BoothStore;
  /** Opens the register when its screen in the scene is clicked. */
  onOpenRegister: () => void;
}

/**
 * Everything inside the booth's canvas: the camera rig, the lights and every
 * fixture. Kept apart from the canvas so tests can render it without WebGL.
 */
export function BoothWorld({ store, onOpenRegister }: BoothWorldProps) {
  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 4, 11]} />
      <CameraRig store={store} />
      <FluorescentLights store={store} />
      <BoothShell />
      <Counters />
      <DriveThruWindow store={store} />
      <DriveThruLane store={store} />
      <DrinkStation store={store} />
      <KitchenDisplay store={store} />
      <RegisterTerminal store={store} onOpen={onOpenRegister} />
    </>
  );
}
