import { ViewportMetrics, screenToGameCoords } from "./viewport";

export interface PrimaryPointerState {
  x: number;
  y: number;
  isDown: boolean;
  pointerId: number;
  pointerType: string;
}

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  actionA: boolean;
  actionB: boolean;
  actionC: boolean;
  primaryPointer: PrimaryPointerState;
  keysDown: ReadonlySet<string>;
}

export type VirtualDirection = "up" | "down" | "left" | "right" | "neutral";
export type VirtualAction = "actionA" | "actionB" | "actionC";

/**
 * Unified Arcade Input Manager.
 * Captures Pointer Events, Keyboard events, and virtual ControlDocks buttons,
 * normalizing them into a single coherent action state vector.
 */
export class ArcadeInputManager {
  private canvas: HTMLCanvasElement | null = null;
  private getMetrics: (() => ViewportMetrics) | null = null;

  private readonly keysDown = new Set<string>();
  private primaryPointer: PrimaryPointerState = {
    x: 0,
    y: 0,
    isDown: false,
    pointerId: -1,
    pointerType: "mouse",
  };

  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualActionA = false;
  private virtualActionB = false;
  private virtualActionC = false;

  private virtualDirState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  /**
   * Attaches DOM event listeners to the canvas and window.
   */
  public attach(canvas: HTMLCanvasElement, getMetrics: () => ViewportMetrics): void {
    this.detach();
    this.canvas = canvas;
    this.getMetrics = getMetrics;

    canvas.addEventListener("pointerdown", this.onPointerDownEvent);
    canvas.addEventListener("pointermove", this.onPointerMoveEvent);
    canvas.addEventListener("pointerup", this.onPointerUpEvent);
    canvas.addEventListener("pointercancel", this.onPointerCancelEvent);

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKeyDownEvent);
      window.addEventListener("keyup", this.onKeyUpEvent);
      window.addEventListener("blur", this.onBlurEvent);
    }
  }

/* jscpd:ignore-start */
  /**
   * Detaches DOM event listeners cleanly.
   */
  public detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDownEvent);
      this.canvas.removeEventListener("pointermove", this.onPointerMoveEvent);
      this.canvas.removeEventListener("pointerup", this.onPointerUpEvent);
      this.canvas.removeEventListener("pointercancel", this.onPointerCancelEvent);
      this.canvas = null;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.onKeyDownEvent);
      window.removeEventListener("keyup", this.onKeyUpEvent);
      window.removeEventListener("blur", this.onBlurEvent);
    }

    this.reset();
  }

  public reset(): void {
    this.keysDown.clear();
    this.primaryPointer = {
      x: 0,
      y: 0,
      isDown: false,
      pointerId: -1,
      pointerType: "mouse",
    };
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualActionA = false;
    this.virtualActionB = false;
    this.virtualActionC = false;
    this.virtualDirState = { up: false, down: false, left: false, right: false };
  }

  public handleKeyDown(code: string): void {
    this.keysDown.add(code);
  }

  public handleKeyUp(code: string): void {
    this.keysDown.delete(code);
  }

  public handlePointerDown(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    button?: number;
  }): void {
    const coords = this.translatePointerCoords(e.clientX, e.clientY);
    this.primaryPointer = {
      x: coords.x,
      y: coords.y,
      isDown: true,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
    };
  }

  public handlePointerMove(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
  }): void {
    const coords = this.translatePointerCoords(e.clientX, e.clientY);
    this.primaryPointer.x = coords.x;
    this.primaryPointer.y = coords.y;
    this.primaryPointer.pointerId = e.pointerId;
    this.primaryPointer.pointerType = e.pointerType;
  }

  public handlePointerUp(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
  }): void {
    const coords = this.translatePointerCoords(e.clientX, e.clientY);
    this.primaryPointer.x = coords.x;
    this.primaryPointer.y = coords.y;
    this.primaryPointer.isDown = false;
  }
/* jscpd:ignore-end */

  public handlePointerCancel(): void {
    this.primaryPointer.isDown = false;
  }

  public setVirtualDirection(dir: VirtualDirection, pressed: boolean): void {
    if (dir === "neutral") {
      this.virtualDirState = { up: false, down: false, left: false, right: false };
      return;
    }
    this.virtualDirState[dir] = pressed;
  }

  public setVirtualStick(x: number, y: number): void {
    this.virtualMoveX = Math.max(-1, Math.min(1, x));
    this.virtualMoveY = Math.max(-1, Math.min(1, y));
  }

  public setVirtualAction(action: VirtualAction, pressed: boolean): void {
    if (action === "actionA") this.virtualActionA = pressed;
    if (action === "actionB") this.virtualActionB = pressed;
    if (action === "actionC") this.virtualActionC = pressed;
  }

  /**
   * Derives normalized input snapshot across all physical and virtual input sources.
   */
  public getSnapshot(): InputSnapshot {
    // Keyboard directional components
    let keyX = 0;
    let keyY = 0;
    if (this.keysDown.has("ArrowLeft") || this.keysDown.has("KeyA")) keyX -= 1;
    if (this.keysDown.has("ArrowRight") || this.keysDown.has("KeyD")) keyX += 1;
    if (this.keysDown.has("ArrowUp") || this.keysDown.has("KeyW")) keyY -= 1;
    if (this.keysDown.has("ArrowDown") || this.keysDown.has("KeyS")) keyY += 1;

    // Virtual D-pad components
    let dpadX = 0;
    let dpadY = 0;
    if (this.virtualDirState.left) dpadX -= 1;
    if (this.virtualDirState.right) dpadX += 1;
    if (this.virtualDirState.up) dpadY -= 1;
    if (this.virtualDirState.down) dpadY += 1;

    const moveX = Math.max(-1, Math.min(1, keyX + dpadX + this.virtualMoveX));
    const moveY = Math.max(-1, Math.min(1, keyY + dpadY + this.virtualMoveY));

    // Action keys
    const keyActionA =
      this.keysDown.has("Space") ||
      this.keysDown.has("Enter") ||
      this.keysDown.has("KeyJ") ||
      this.keysDown.has("KeyZ");
    const keyActionB =
      this.keysDown.has("KeyK") ||
      this.keysDown.has("KeyX") ||
      this.keysDown.has("ShiftLeft") ||
      this.keysDown.has("ShiftRight");
    const keyActionC = this.keysDown.has("KeyL") || this.keysDown.has("KeyC");

    const actionA = keyActionA || this.virtualActionA || this.primaryPointer.isDown;
    const actionB = keyActionB || this.virtualActionB;
    const actionC = keyActionC || this.virtualActionC;

    return {
      moveX,
      moveY,
      aimX: this.primaryPointer.x,
      aimY: this.primaryPointer.y,
      actionA,
      actionB,
      actionC,
      primaryPointer: { ...this.primaryPointer },
      keysDown: this.keysDown,
    };
  }

  private translatePointerCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.canvas || !this.getMetrics) {
      return { x: clientX, y: clientY };
    }
    const rect = this.canvas.getBoundingClientRect();
    const metrics = this.getMetrics();
    return screenToGameCoords(clientX, clientY, rect, metrics);
  }

  private onPointerDownEvent = (e: PointerEvent): void => {
    if (this.canvas && typeof this.canvas.setPointerCapture === "function") {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
    this.handlePointerDown(e);
  };

  private onPointerMoveEvent = (e: PointerEvent): void => {
    this.handlePointerMove(e);
  };

  private onPointerUpEvent = (e: PointerEvent): void => {
    if (this.canvas && typeof this.canvas.releasePointerCapture === "function") {
      try {
        if (this.canvas.hasPointerCapture?.(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe fallback
      }
    }
    this.handlePointerUp(e);
  };

  private onPointerCancelEvent = (): void => {
    this.handlePointerCancel();
  };

  private onKeyDownEvent = (e: KeyboardEvent): void => {
    this.handleKeyDown(e.code);
  };

  private onKeyUpEvent = (e: KeyboardEvent): void => {
    this.handleKeyUp(e.code);
  };

  private onBlurEvent = (): void => {
    this.reset();
  };
}
