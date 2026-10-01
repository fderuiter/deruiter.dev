"use client";

import { useEffect, useRef } from "react";

export class PolyfillDataTransfer {
  private dataMap = new Map<string, string>();
  public dropEffect = "move";
  public effectAllowed = "all";

  get types(): string[] {
    return Array.from(this.dataMap.keys());
  }

  setData(format: string, data: string): void {
    const key = format.toLowerCase();
    this.dataMap.set(key, data);
  }

  getData(format: string): string {
    const key = format.toLowerCase();
    return this.dataMap.get(key) || "";
  }

  clearData(format?: string): void {
    if (format) {
      this.dataMap.delete(format.toLowerCase());
    } else {
      this.dataMap.clear();
    }
  }
}

export function createSynthesizedDragEvent(
  type: string,
  clientX: number,
  clientY: number,
  dataTransfer: PolyfillDataTransfer
): DragEvent {
  let event: DragEvent;
  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
    });
  } catch {
    event = document.createEvent("Event") as DragEvent;
    event.initEvent(type, true, true);
    const customEvent = event as unknown as Record<string, unknown>;
    customEvent.clientX = clientX;
    customEvent.clientY = clientY;
    customEvent.screenX = clientX;
    customEvent.screenY = clientY;
  }

  Object.defineProperty(event, "dataTransfer", {
    value: dataTransfer,
    writable: false,
    configurable: true,
  });

  return event;
}

interface TouchDragAndDropOptions {
  enabled?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  moveThreshold?: number; // default 5px
  timeThreshold?: number; // default 150ms
}

export function useTouchDragAndDrop({
  enabled = true,
  containerRef,
  moveThreshold = 5,
  timeThreshold = 150,
}: TouchDragAndDropOptions = {}) {
  const activeDragRef = useRef<{
    sourceElement: HTMLElement;
    startX: number;
    startY: number;
    startTime: number;
    isDragging: boolean;
    ghostElement: HTMLElement | null;
    dataTransfer: PolyfillDataTransfer;
    lastDropTarget: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const targetElement = containerRef?.current || document;

    const findDraggableParent = (
      el: HTMLElement | null
    ): HTMLElement | null => {
      let current: HTMLElement | null = el;
      while (
        current &&
        current !== document.body &&
        current !== containerRef?.current
      ) {
        if (
          current.getAttribute("draggable") === "true" ||
          current.draggable ||
          current.hasAttribute("data-touch-drag")
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const isInteractiveInput = (el: HTMLElement): boolean => {
      const tagName = el.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return true;
      }
      if (el.isContentEditable) return true;
      return false;
    };

    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      // Ignore right clicks or mouse non-primary buttons
      if (
        e instanceof PointerEvent &&
        e.pointerType === "mouse" &&
        e.button !== 0
      ) {
        return;
      }

      const point = "touches" in e ? e.touches[0] : e;
      if (!point) return;

      const targetEl = e.target as HTMLElement;
      if (!targetEl || isInteractiveInput(targetEl)) return;

      const draggableEl = findDraggableParent(targetEl);
      if (!draggableEl) return;

      activeDragRef.current = {
        sourceElement: draggableEl,
        startX: point.clientX,
        startY: point.clientY,
        startTime: Date.now(),
        isDragging: false,
        ghostElement: null,
        dataTransfer: new PolyfillDataTransfer(),
        lastDropTarget: null,
      };
    };

    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      const drag = activeDragRef.current;
      if (!drag) return;

      const point = "touches" in e ? e.touches[0] : e;
      if (!point) return;

      const deltaX = point.clientX - drag.startX;
      const deltaY = point.clientY - drag.startY;
      const distance = Math.hypot(deltaX, deltaY);
      const elapsedTime = Date.now() - drag.startTime;

      // Start drag mode if threshold exceeded
      if (!drag.isDragging) {
        if (distance >= moveThreshold || elapsedTime >= timeThreshold) {
          drag.isDragging = true;

          // Dispatch dragstart event on source element
          const dragStartEvent = createSynthesizedDragEvent(
            "dragstart",
            point.clientX,
            point.clientY,
            drag.dataTransfer
          );
          drag.sourceElement.dispatchEvent(dragStartEvent);

          // Create ghost preview element
          const ghost = drag.sourceElement.cloneNode(true) as HTMLElement;
          ghost.style.position = "fixed";
          ghost.style.left = `${point.clientX}px`;
          ghost.style.top = `${point.clientY}px`;
          ghost.style.transform = "translate(-50%, -50%) scale(0.95)";
          ghost.style.pointerEvents = "none";
          ghost.style.zIndex = "9999";
          ghost.style.opacity = "0.85";
          ghost.style.boxShadow =
            "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(6, 182, 212, 0.4)";
          ghost.style.borderRadius = "0.75rem";
          ghost.style.maxWidth = "280px";
          ghost.style.maxHeight = "120px";
          ghost.style.overflow = "hidden";
          document.body.appendChild(ghost);
          drag.ghostElement = ghost;

          // Prevent page scroll during drag
          document.body.style.touchAction = "none";
          document.body.style.userSelect = "none";
        }
      }

      if (drag.isDragging) {
        if (e.cancelable) {
          e.preventDefault();
        }

        // Update ghost position
        if (drag.ghostElement) {
          drag.ghostElement.style.left = `${point.clientX}px`;
          drag.ghostElement.style.top = `${point.clientY}px`;
        }

        // Locate element under finger
        const dropTarget = (
          typeof document.elementFromPoint === "function"
            ? document.elementFromPoint(point.clientX, point.clientY)
            : null
        ) as HTMLElement | null;

        if (dropTarget) {
          if (drag.lastDropTarget && drag.lastDropTarget !== dropTarget) {
            const dragLeaveEvent = createSynthesizedDragEvent(
              "dragleave",
              point.clientX,
              point.clientY,
              drag.dataTransfer
            );
            drag.lastDropTarget.dispatchEvent(dragLeaveEvent);
          }

          const dragOverEvent = createSynthesizedDragEvent(
            "dragover",
            point.clientX,
            point.clientY,
            drag.dataTransfer
          );
          dropTarget.dispatchEvent(dragOverEvent);
          drag.lastDropTarget = dropTarget;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent | TouchEvent) => {
      const drag = activeDragRef.current;
      if (!drag) return;

      const touchEv = e as TouchEvent;
      const point =
        touchEv.changedTouches && touchEv.changedTouches[0]
          ? touchEv.changedTouches[0]
          : touchEv.touches && touchEv.touches[0]
            ? touchEv.touches[0]
            : (e as PointerEvent);

      if (drag.isDragging) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const dropTarget =
          point && typeof document.elementFromPoint === "function"
            ? (document.elementFromPoint(
                point.clientX,
                point.clientY
              ) as HTMLElement | null)
            : drag.lastDropTarget;

        if (dropTarget) {
          const dropEvent = createSynthesizedDragEvent(
            "drop",
            point ? point.clientX : drag.startX,
            point ? point.clientY : drag.startY,
            drag.dataTransfer
          );
          dropTarget.dispatchEvent(dropEvent);
        }

        const dragEndEvent = createSynthesizedDragEvent(
          "dragend",
          point ? point.clientX : drag.startX,
          point ? point.clientY : drag.startY,
          drag.dataTransfer
        );
        drag.sourceElement.dispatchEvent(dragEndEvent);
      }

      // Cleanup ghost element and touch action styles
      if (drag.ghostElement && drag.ghostElement.parentNode) {
        drag.ghostElement.parentNode.removeChild(drag.ghostElement);
      }
      document.body.style.touchAction = "";
      document.body.style.userSelect = "";

      activeDragRef.current = null;
    };

    // Attach listeners
    const el = targetElement;
    el.addEventListener("pointerdown", handlePointerDown as EventListener, {
      passive: true,
    });
    window.addEventListener("pointermove", handlePointerMove as EventListener, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp as EventListener, {
      passive: false,
    });
    window.addEventListener("pointercancel", handlePointerUp as EventListener, {
      passive: false,
    });

    el.addEventListener("touchstart", handlePointerDown as EventListener, {
      passive: true,
    });
    window.addEventListener("touchmove", handlePointerMove as EventListener, {
      passive: false,
    });
    window.addEventListener("touchend", handlePointerUp as EventListener, {
      passive: false,
    });
    window.addEventListener("touchcancel", handlePointerUp as EventListener, {
      passive: false,
    });

    return () => {
      el.removeEventListener("pointerdown", handlePointerDown as EventListener);
      window.removeEventListener(
        "pointermove",
        handlePointerMove as EventListener
      );
      window.removeEventListener("pointerup", handlePointerUp as EventListener);
      window.removeEventListener(
        "pointercancel",
        handlePointerUp as EventListener
      );

      el.removeEventListener("touchstart", handlePointerDown as EventListener);
      window.removeEventListener(
        "touchmove",
        handlePointerMove as EventListener
      );
      window.removeEventListener("touchend", handlePointerUp as EventListener);
      window.removeEventListener(
        "touchcancel",
        handlePointerUp as EventListener
      );

      if (activeDragRef.current?.ghostElement?.parentNode) {
        activeDragRef.current.ghostElement.parentNode.removeChild(
          activeDragRef.current.ghostElement
        );
      }
      document.body.style.touchAction = "";
      document.body.style.userSelect = "";
      activeDragRef.current = null;
    };
  }, [enabled, containerRef, moveThreshold, timeThreshold]);
}
