"use client";

/**
 * The WebGL canvas for the first-person booth (ADR 0059, #1813). It renders
 * on demand, and reports a lost WebGL context so the game can fall back to
 * the flat view; what is inside the booth lives in BoothWorld.
 */

import React, { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { BOOTH_CAMERA, BoothWorld } from "./BoothWorld";
import type { BoothStore } from "./store";

interface BoothSceneProps {
  store: BoothStore;
  /** Opens the register when its screen in the scene is clicked. */
  onOpenRegister: () => void;
  /** Called if the browser takes the WebGL context away mid-shift. */
  onContextLost: () => void;
}

/** The WebGL canvas for the booth, mounted only when WebGL is available. */
export default function BoothScene({
  store,
  onOpenRegister,
  onContextLost,
}: BoothSceneProps) {
  // React Three Fiber releases the context itself a moment after unmount,
  // which fires the same event; only a loss while mounted is a real one.
  const mounted = useRef(false);
  const contextLost = useRef(onContextLost);
  useEffect(() => {
    contextLost.current = onContextLost;
  }, [onContextLost]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={BOOTH_CAMERA}
      gl={{ antialias: true, powerPreference: "default" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          if (mounted.current) contextLost.current();
        });
      }}
      aria-hidden="true"
      data-testid="pdt-booth-canvas"
    >
      <BoothWorld store={store} onOpenRegister={onOpenRegister} />
    </Canvas>
  );
}
