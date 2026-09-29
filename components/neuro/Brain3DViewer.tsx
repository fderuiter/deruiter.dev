"use client";

import React, { useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/game-utils";
import type * as THREE from "three";
import {
  AnatomicalParcel,
  HemisphereFilter,
  SurfaceMode,
  VoxelCoord,
} from "@/lib/neuro/types";
import {
  createCorticalSurfaceMeshBuffersAsync,
  getAnatomicalParcelAtCoordinate,
} from "@/lib/neuro/mesh-generator";
import { loadExternalBrainBuffers } from "@/lib/neuro/asset-loader";
import {
  createMeshGroupFromBuffers,
  loadGraphicsEngine,
} from "@/lib/neuro/engine-loader";
import { useWebGLContextLoss } from "@/hooks/useWebGLContextLoss";
import { ProgressHUD } from "./ProgressHUD";
import {
  Icon3dCubeSphere,
  IconAlertTriangle,
  IconCheck,
  IconLayersSubtract,
  IconRefresh,
} from "@tabler/icons-react";

interface Brain3DViewerProps {
  surfaceMode: SurfaceMode;
  crosshair: VoxelCoord;
  modelUrl?: string;
  wireframe?: boolean;
  onSurfaceChange?: (mode: SurfaceMode) => void;
  onCrosshairChange?: (coord: VoxelCoord) => void;
}

/* jscpd:ignore-start */
export const Brain3DViewer: React.FC<Brain3DViewerProps> = ({
  surfaceMode,
  crosshair,
  modelUrl,
  wireframe = false,
  onSurfaceChange,
  onCrosshairChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const crosshairMarkerRef = useRef<THREE.Mesh | null>(null);
  const meshRequestIdRef = useRef(0);
  const threeRef = useRef<typeof THREE | null>(null);

  const [contextKey, setContextKey] = useState(0);
  const [webglError, setWebglError] = useState(false);
  const isContextLostRef = useRef(false);

  const {
    status: contextStatus,
    triggerSimulation,
    bindCanvas,
  } = useWebGLContextLoss({
    label: "NeuroRecon 3D",
    onContextLost: () => {
      isContextLostRef.current = true;
    },
    onContextRestored: () => {
      isContextLostRef.current = false;
      setContextKey((k) => k + 1);
    },
  });

  const [isNearViewport, setIsNearViewport] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return true;
    }
    return false;
  });

  // IntersectionObserver Guard to pause rendering loops when scrolled offscreen and defer external model fetches
  const isIntersectingRef = useRef<boolean>(
    typeof window === "undefined" || typeof IntersectionObserver === "undefined"
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isIntersectingRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            setIsNearViewport(true);
          }
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const [isRotating, setIsRotating] = useState(true);
  const isRotatingRef = useRef(isRotating);
  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  const [hemiFilter, setHemiFilter] = useState<HemisphereFilter>("both");
  const [wireframeActive, setWireframeActive] = useState<boolean>(wireframe);
  const [hoveredParcel, setHoveredParcel] = useState<AnatomicalParcel | null>(
    null
  );
  const [hoveredPos, setHoveredPos] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.2, y: -0.4 });

  // Frame Throttling Refs for 3D Mesh Hover Raycasting
  const hoverRafIdRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ clientX: number; clientY: number } | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (hoverRafIdRef.current !== null) {
        cancelAnimationFrame(hoverRafIdRef.current);
        hoverRafIdRef.current = null;
      }
    };
  }, []);

  // Initialize Three.js Scene, Camera, and Renderer Asynchronously on Demand
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isCancelled = false;
    let animId: number;
    let handleResize: (() => void) | null = null;

    loadGraphicsEngine().then((THREE) => {
      if (isCancelled || !containerRef.current) return;
      threeRef.current = THREE;

      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x09090b); // Zinc-950
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.8);
      cameraRef.current = camera;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.25); // Sky blue key light
      dirLight1.position.set(5, 8, 6);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x818cf8, 0.85); // Indigo fill light
      dirLight2.position.set(-5, -4, -4);
      scene.add(dirLight2);

      const rimLight = new THREE.DirectionalLight(0x06b6d4, 0.5); // Cyan rim light
      rimLight.position.set(0, 6, -5);
      scene.add(rimLight);

      // 3D Crosshair Indicator
      const crossGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const crossMat = new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        wireframe: true,
      });
      const crosshairMarker = new THREE.Mesh(crossGeo, crossMat);
      scene.add(crosshairMarker);
      crosshairMarkerRef.current = crosshairMarker;

      // WebGL Renderer
      let renderer: THREE.WebGLRenderer | null = null;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.innerHTML = "";
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;
        bindCanvas(renderer.domElement);
        setWebglError(false);
      } catch {
        setWebglError(true);
        return;
      }

      const animate = () => {
        animId = requestAnimationFrame(animate);

        if (isContextLostRef.current || !isIntersectingRef.current) return;

        if (meshGroupRef.current) {
          if (isRotatingRef.current && !isDraggingRef.current) {
            rotationRef.current.y += 0.004;
          }
          meshGroupRef.current.rotation.x = rotationRef.current.x;
          meshGroupRef.current.rotation.y = rotationRef.current.y;
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };
      animate();

      handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener("resize", handleResize);
    });

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (handleResize) window.removeEventListener("resize", handleResize);
      bindCanvas(null);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (
        container &&
        rendererRef.current &&
        rendererRef.current.domElement.parentNode === container
      ) {
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, [contextKey, bindCanvas]);

  // Update Cortical Mesh on surfaceMode, modelUrl, wireframeActive, hemiFilter, contextKey, or isNearViewport change
  useEffect(() => {
    let isMounted = true;
    const reqId = ++meshRequestIdRef.current;

    const disposeGroup = (group: THREE.Group, scene: THREE.Scene) => {
      scene.remove(group);
      group.traverse((obj) => {
        // Mesh/Line/Points all carry disposable geometry+material, but plain
        // Object3D/Group nodes don't — duck-type via a partial Mesh shape.
        const renderable = obj as THREE.Object3D & Partial<THREE.Mesh>;
        if (renderable.geometry) {
          renderable.geometry.dispose();
        }
        if (renderable.material) {
          if (Array.isArray(renderable.material)) {
            renderable.material.forEach((m) => m.dispose());
          } else {
            renderable.material.dispose();
          }
        }
      });
    };

    loadGraphicsEngine().then((THREE) => {
      if (!isMounted || reqId !== meshRequestIdRef.current || !sceneRef.current)
        return;
      const scene = sceneRef.current;

      if (meshGroupRef.current) {
        disposeGroup(meshGroupRef.current, scene);
        meshGroupRef.current = null;
      }

      if (
        isNearViewport &&
        modelUrl &&
        surfaceMode === "pial" &&
        hemiFilter === "both"
      ) {
        // Offload procedural surface generation to background Web Worker thread
        createCorticalSurfaceMeshBuffersAsync(
          surfaceMode,
          wireframeActive,
          hemiFilter
        ).then((proceduralBuffers) => {
          if (
            !isMounted ||
            reqId !== meshRequestIdRef.current ||
            !sceneRef.current
          )
            return;
          if (meshGroupRef.current) {
            disposeGroup(meshGroupRef.current, sceneRef.current);
          }
          const fallbackGroup = createMeshGroupFromBuffers(
            proceduralBuffers,
            THREE,
            {
              wireframe: wireframeActive,
              mode: surfaceMode,
            }
          );
          sceneRef.current.add(fallbackGroup);
          meshGroupRef.current = fallbackGroup;
        });

        loadExternalBrainBuffers(modelUrl, surfaceMode, hemiFilter).then(
          (externalBuffers) => {
            if (
              !isMounted ||
              reqId !== meshRequestIdRef.current ||
              !sceneRef.current
            )
              return;
            if (meshGroupRef.current) {
              disposeGroup(meshGroupRef.current, sceneRef.current);
            }
            const externalGroup = createMeshGroupFromBuffers(
              externalBuffers,
              THREE,
              {
                wireframe: wireframeActive,
                mode: surfaceMode,
              }
            );
            sceneRef.current.add(externalGroup);
            meshGroupRef.current = externalGroup;
          }
        );
      } else {
        createCorticalSurfaceMeshBuffersAsync(
          surfaceMode,
          wireframeActive,
          hemiFilter
        ).then((rawBuffers) => {
          if (
            !isMounted ||
            reqId !== meshRequestIdRef.current ||
            !sceneRef.current
          )
            return;
          if (meshGroupRef.current) {
            disposeGroup(meshGroupRef.current, sceneRef.current);
          }
          const newGroup = createMeshGroupFromBuffers(rawBuffers, THREE, {
            wireframe: wireframeActive,
            mode: surfaceMode,
          });
          sceneRef.current.add(newGroup);
          meshGroupRef.current = newGroup;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    surfaceMode,
    modelUrl,
    wireframeActive,
    hemiFilter,
    contextKey,
    isNearViewport,
  ]);

  // Update Crosshair Marker Position in 3D Space
  useEffect(() => {
    if (!crosshairMarkerRef.current) return;
    // Map voxel coords (0..96) to 3D space (-1.5..1.5)
    const normX = ((crosshair.x - 48) / 48) * 1.35;
    const normY = ((crosshair.y - 48) / 48) * 1.85;
    const normZ = ((crosshair.z - 48) / 48) * 1.45;
    crosshairMarkerRef.current.position.set(normX, normY, normZ);
  }, [crosshair]);

  // Raycaster for 3D clicks and hover parcel detection
  const performRaycast = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const meshGroup = meshGroupRef.current;
    const THREE =
      threeRef.current ||
      (typeof window !== "undefined"
        ? (window as unknown as { THREE?: typeof import("three") }).THREE
        : null);
    if (!container || !camera || !meshGroup || !THREE) return null;

    const rect = container.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const intersects = raycaster.intersectObjects(meshGroup.children, true);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    // Convert world hit point to meshGroup local coordinate space
    const localPoint = hit.point.clone();
    meshGroup.worldToLocal(localPoint);

    return {
      hit,
      localPoint,
      clientPos: { x: clientX - rect.left, y: clientY - rect.top },
    };
  };

  const processHover = React.useCallback((clientX: number, clientY: number) => {
    const result = performRaycast(clientX, clientY);
    if (result) {
      const isLeft = result.localPoint.x < 0;
      const parcel = getAnatomicalParcelAtCoordinate(result.localPoint, isLeft);
      setHoveredParcel(parcel);
      setHoveredPos({
        x: Math.round(48 + (result.localPoint.x / 1.35) * 48),
        y: Math.round(48 + (result.localPoint.y / 1.85) * 48),
        z: Math.round(48 + (result.localPoint.z / 1.45) * 48),
      });
      setTooltipPos(result.clientPos);
    } else {
      setHoveredParcel(null);
      setTooltipPos(null);
    }
  }, []);

  // Mouse & Touch Orbit Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      if (hoverRafIdRef.current !== null) {
        cancelAnimationFrame(hoverRafIdRef.current);
        hoverRafIdRef.current = null;
      }
      pendingHoverRef.current = null;
      const deltaX = e.clientX - prevMouseRef.current.x;
      const deltaY = e.clientY - prevMouseRef.current.y;
      rotationRef.current.y += deltaX * 0.008;
      rotationRef.current.x += deltaY * 0.008;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      setHoveredParcel(null);
      setTooltipPos(null);
      return;
    }

    // Hover parcel detection throttled to frame refresh boundary
    pendingHoverRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (hoverRafIdRef.current === null) {
      hoverRafIdRef.current = requestAnimationFrame(() => {
        hoverRafIdRef.current = null;
        if (pendingHoverRef.current) {
          const { clientX, clientY } = pendingHoverRef.current;
          pendingHoverRef.current = null;
          processHover(clientX, clientY);
        }
      });
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (hoverRafIdRef.current !== null) {
      cancelAnimationFrame(hoverRafIdRef.current);
      hoverRafIdRef.current = null;
    }
    pendingHoverRef.current = null;
    handleMouseUp(e);
    setHoveredParcel(null);
    setTooltipPos(null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dragDist = Math.hypot(
      e.clientX - dragStartRef.current.x,
      e.clientY - dragStartRef.current.y
    );
    isDraggingRef.current = false;

    // If mouse was clicked without significant dragging, trigger 3D raycast voxel navigation
    if (dragDist < 6 && onCrosshairChange) {
      const result = performRaycast(e.clientX, e.clientY);
      if (result) {
        const vx = Math.round(48 + (result.localPoint.x / 1.35) * 48);
        const vy = Math.round(48 + (result.localPoint.y / 1.85) * 48);
        const vz = Math.round(48 + (result.localPoint.z / 1.45) * 48);
        onCrosshairChange({
          x: clamp(vx, 0, 95),
          y: clamp(vy, 0, 95),
          z: clamp(vz, 0, 95),
        });
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0];
    isDraggingRef.current = true;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    prevMouseRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches[0] || e.changedTouches[0];
    const deltaX = touch.clientX - prevMouseRef.current.x;
    const deltaY = touch.clientY - prevMouseRef.current.y;
    rotationRef.current.y += deltaX * 0.008;
    rotationRef.current.x += deltaY * 0.008;
    prevMouseRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (touch && onCrosshairChange) {
      const dragDist = Math.hypot(
        touch.clientX - dragStartRef.current.x,
        touch.clientY - dragStartRef.current.y
      );
      if (dragDist < 8) {
        const result = performRaycast(touch.clientX, touch.clientY);
        if (result) {
          const vx = Math.round(48 + (result.localPoint.x / 1.35) * 48);
          const vy = Math.round(48 + (result.localPoint.y / 1.85) * 48);
          const vz = Math.round(48 + (result.localPoint.z / 1.45) * 48);
          onCrosshairChange({
            x: clamp(vx, 0, 95),
            y: clamp(vy, 0, 95),
            z: clamp(vz, 0, 95),
          });
        }
      }
    }
    isDraggingRef.current = false;
  };
/* jscpd:ignore-end */

  return (
    <div className="relative w-full h-full min-h-[380px] bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col select-none">
      {/* 3D Viewport Top Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono min-w-0">
          <Icon3dCubeSphere className="w-4 h-4 text-brand-cyan shrink-0" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px] sm:text-xs truncate max-w-[180px] xs:max-w-[240px] sm:max-w-xs">
            {surfaceMode === "pial"
              ? "Pial Surface (lh.pial / rh.pial)"
              : surfaceMode === "white"
                ? "White Matter (lh.white / rh.white)"
                : surfaceMode === "inflated"
                  ? "Inflated Cortex (lh.inflated)"
                  : surfaceMode === "aparc"
                    ? "Desikan-Killiany Atlas (aparc)"
                    : "Subcortical ASEG"}
          </span>
        </div>

        {/* Surface Mode Toggle Bar */}
        <div className="flex items-center gap-1 bg-zinc-950/90 p-0.5 rounded-lg border border-zinc-800 text-xs font-mono overflow-x-auto scrollbar-none">
          {(
            ["pial", "white", "inflated", "aparc", "aseg"] as SurfaceMode[]
          ).map((mode) => (
            <button
              key={mode}
              onClick={() => onSurfaceChange?.(mode)}
              className={`px-2 py-0.5 rounded-md transition-all text-[11px] font-mono capitalize whitespace-nowrap ${
                surfaceMode === mode
                  ? "bg-brand-cyan text-zinc-950 font-bold shadow-xs"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {mode === "aparc" ? "Atlas" : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Hemisphere and Wireframe Secondary Controls */}
      <div className="absolute top-14 left-2.5 z-10 flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur-md p-1 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-400 shadow-sm">
        <span className="px-1.5 text-zinc-400 font-semibold">HEMI:</span>
        <button
          onClick={() => setHemiFilter("both")}
          className={`px-2 py-0.5 rounded transition ${
            hemiFilter === "both"
              ? "bg-zinc-700 text-white font-bold"
              : "hover:text-zinc-200"
          }`}
        >
          Both
        </button>
        <button
          onClick={() => setHemiFilter("lh")}
          className={`px-2 py-0.5 rounded transition ${
            hemiFilter === "lh"
              ? "bg-zinc-700 text-white font-bold"
              : "hover:text-zinc-200"
          }`}
        >
          Left (lh)
        </button>
        <button
          onClick={() => setHemiFilter("rh")}
          className={`px-2 py-0.5 rounded transition ${
            hemiFilter === "rh"
              ? "bg-zinc-700 text-white font-bold"
              : "hover:text-zinc-200"
          }`}
        >
          Right (rh)
        </button>
        <span className="text-zinc-700 mx-0.5">|</span>
        <button
          onClick={() => setWireframeActive((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
            wireframeActive
              ? "bg-brand-cyan/20 text-brand-cyan font-bold"
              : "hover:text-zinc-200"
          }`}
        >
          <IconLayersSubtract className="w-3 h-3" />
          <span>Wireframe</span>
          {wireframeActive && <IconCheck className="w-2.5 h-2.5" />}
        </button>
        <span className="text-zinc-700 mx-0.5">|</span>
        <button
          onClick={() => triggerSimulation(800)}
          title="Simulate WebGL Context Loss & Recovery (GPU Resilience Test)"
          aria-label="Simulate WebGL Context Loss and Recovery"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition"
        >
          <IconRefresh className="w-2.5 h-2.5 text-amber-400" />
          <span>GPU Test</span>
        </button>
      </div>

      {/* WebGL Context Loss & Recovery HUD Banner */}
      {contextStatus !== "idle" && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono shadow-xl transition-all duration-300 pointer-events-none ${
            contextStatus === "lost" || contextStatus === "restoring"
              ? "bg-amber-950/90 border border-amber-500/60 text-amber-300 animate-pulse"
              : "bg-emerald-950/90 border border-emerald-500/60 text-emerald-300"
          }`}
        >
          {contextStatus === "lost" || contextStatus === "restoring" ? (
            <>
              <IconRefresh className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>GPU Context Interrupted: Re-instantiating buffers...</span>
            </>
          ) : (
            <>
              <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>GPU Context Restored</span>
            </>
          )}
        </div>
      )}

      {/* WebGL Fallback Card when graphics capability is unsupported */}
      {webglError && (
        <div
          role="status"
          aria-live="polite"
          data-testid="webgl-fallback-card"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-zinc-950/95 text-center gap-3 border border-amber-500/30 rounded-2xl"
        >
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
            <IconAlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold font-mono text-white">
              3D WebGL Surface Renderer Unavailable
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm">
              Your device or browser graphics context does not support WebGL
              hardware acceleration. 2D multi-planar orthoview slice inspection
              remains fully operational below.
            </p>
          </div>
        </div>
      )}

      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        role="img"
        tabIndex={0}
        aria-label="Interactive 3D Cortical Surface Visualizer. Touch or drag to orbit brain mesh, click surface to synchronize 2D slice crosshairs."
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "none" }}
        className="w-full flex-1 cursor-grab active:cursor-grabbing"
      />

      {/* Floating Visual Progress HUD Overlay */}
      <ProgressHUD />

      {/* Interactive Anatomical Parcel Tooltip HUD */}
      {hoveredParcel && tooltipPos && (
        <div
          style={{
            transform: `translate3d(min(${tooltipPos.x + 16}px, calc(100% - 240px)), max(16px, ${tooltipPos.y - 65}px), 0)`,
            left: 0,
            top: 0,
          }}
          className="pointer-events-none absolute z-20 bg-zinc-950/90 backdrop-blur-md border border-zinc-700 p-2.5 rounded-xl shadow-2xl text-xs font-mono max-w-[230px]"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: `rgb(${hoveredParcel.rgb.join(",")})` }}
            />
            <span className="font-bold text-white leading-tight">
              {hoveredParcel.name}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="text-brand-cyan font-semibold">
              Lobe: {hoveredParcel.lobe}
            </span>
            {hoveredPos && (
              <span>
                ({hoveredPos.x}, {hoveredPos.y}, {hoveredPos.z})
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-zinc-400 leading-snug line-clamp-2">
            {hoveredParcel.description}
          </p>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-xs font-mono text-zinc-400 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <span>
            VOXEL: ({crosshair.x}, {crosshair.y}, {crosshair.z})
          </span>
          <span className="hidden sm:inline text-zinc-600">|</span>
          <span className="hidden sm:inline text-zinc-400">
            CLICK 3D TO SYNC 2D SLICES
          </span>
        </div>
        <button
          onClick={() => setIsRotating((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
            isRotating
              ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
              : "bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          <IconRefresh
            className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`}
          />
          <span>{isRotating ? "AUTOROTATE ON" : "AUTOROTATE OFF"}</span>
        </button>
      </div>
    </div>
  );
};
