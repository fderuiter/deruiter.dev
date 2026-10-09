"use client";

import React, { useEffect, useRef } from "react";
import { ArcadeGameLoop, computeCanvasResolution } from "@/lib/arcade";
import { FloorRenderer, TILE, type FloorScene } from "./floor-renderer";

/**
 * The canvas half of the world: draws the floor when the scene changes and
 * runs the arcade loop only while the player is gliding between tiles or,
 * when motion is allowed, while the bin is on fire. The art is drawn at a
 * whole-number scale so it stays crisp. The
 * canvas carries the text description of the current room as its name.
 */
export const FloorView: React.FC<{
  scene: FloorScene;
  description: string;
  reducedMotion: boolean;
}> = ({ scene, description, reducedMotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FloorRenderer | null>(null);
  const loopRef = useRef<ArcadeGameLoop | null>(null);
  const sceneRef = useRef(scene);
  const reducedRef = useRef(reducedMotion);
  const width = scene.map.width * TILE;
  const height = scene.map.height * TILE;

  // One engine and loop for the life of the view.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new FloorRenderer(sceneRef.current);
    engine.setReducedMotion(reducedRef.current);
    const getContext = () => canvas.getContext("2d");
    const loop = new ArcadeGameLoop(engine, getContext);
    // When the glide lands, the loop has drawn its last frame: stop it,
    // unless the bin is burning and motion is allowed.
    const off = engine.on("settled", () => {
      if (!engine.isAnimating()) loop.stop();
    });
    engineRef.current = engine;
    loopRef.current = loop;

    const draw = () => {
      const ctx = getContext();
      if (ctx) engine.render(ctx);
    };
    const resize = () => {
      const cssWidth = Math.floor(canvas.getBoundingClientRect().width);
      const res = computeCanvasResolution(
        width,
        height,
        cssWidth,
        window.devicePixelRatio || 1
      );
      // Whole-number scale only, so every art pixel lands on whole device
      // pixels and the tiles stay crisp.
      const scale = Math.max(1, Math.round(res.scale));
      const backingWidth = width * scale;
      const backingHeight = height * scale;
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      engine.setScale(scale);
      draw();
    };
    resize();
    if (engine.isAnimating()) loop.start();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (observer && wrapRef.current) observer.observe(wrapRef.current);
    return () => {
      observer?.disconnect();
      off();
      loop.stop();
      engine.destroy();
      engineRef.current = null;
      loopRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const engine = engineRef.current;
    const loop = loopRef.current;
    reducedRef.current = reducedMotion;
    if (!engine || !loop) return;
    engine.setReducedMotion(reducedMotion);
    if (engine.isAnimating()) {
      if (!loop.isRunning()) loop.start();
    } else {
      loop.stop();
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) engine.render(ctx);
    }
  }, [reducedMotion]);

  useEffect(() => {
    const engine = engineRef.current;
    const loop = loopRef.current;
    const canvas = canvasRef.current;
    sceneRef.current = scene;
    if (!engine || !loop || !canvas) return;
    engine.setScene(scene);
    if (engine.isAnimating()) {
      if (!loop.isRunning()) loop.start();
    } else {
      loop.stop();
      const ctx = canvas.getContext("2d");
      if (ctx) engine.render(ctx);
    }
  }, [scene]);

  return (
    <div ref={wrapRef} className="w-full min-w-0">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description}
        data-testid="world-canvas"
        width={width}
        height={height}
        className="block h-auto w-full border border-[var(--sd-hairline)] bg-[#0d0e11]"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </div>
  );
};
