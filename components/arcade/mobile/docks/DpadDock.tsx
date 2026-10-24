"use client";

import React, { useEffect, useRef } from "react";
import {
  IconArrowDown,
  IconArrowDownLeft,
  IconArrowDownRight,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpLeft,
  IconArrowUpRight,
} from "@tabler/icons-react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import { useHoldRepeat } from "@/components/arcade/mobile/useHoldRepeat";
import {
  touchActionInput,
  touchAxisInput,
  useActionSink,
  type ActionMap,
  type ActionVector,
} from "@/lib/arcade";
import {
  DOCK_KEY_CLASS,
  DOCK_KEY_STYLE,
  dockActionLabel,
  useDockHeight,
  type DockSize,
} from "./dock-kit";

/** A d-pad direction. The diagonals exist only on an 8-way pad. */
export type DpadDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

type Cardinal = "up" | "down" | "left" | "right";

const VECTOR: Readonly<Record<DpadDirection, ActionVector>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  "up-left": { x: -1, y: -1 },
  "up-right": { x: 1, y: -1 },
  "down-left": { x: -1, y: 1 },
  "down-right": { x: 1, y: 1 },
};

const ICON: Readonly<Record<DpadDirection, React.FC<{ className?: string }>>> =
  {
    up: IconArrowUp,
    down: IconArrowDown,
    left: IconArrowLeft,
    right: IconArrowRight,
    "up-left": IconArrowUpLeft,
    "up-right": IconArrowUpRight,
    "down-left": IconArrowDownLeft,
    "down-right": IconArrowDownRight,
  };

// The 3x3 grid; the centre is the hub, not a control.
const GRID: readonly (DpadDirection | null)[] = [
  "up-left",
  "up",
  "up-right",
  "left",
  null,
  "right",
  "down-left",
  "down",
  "down-right",
];

const DIAGONALS: ReadonlySet<DpadDirection> = new Set([
  "up-left",
  "up-right",
  "down-left",
  "down-right",
]);

/** Props for {@link DpadDock}. */
export type DpadDockProps<A extends string> = {
  map: ActionMap<A>;
  /** Defaults to `md`. */
  size?: DockSize;
  /** True while the game takes no input; a hold in progress lets go. */
  paused?: boolean;
  className?: string;
} & (
  | {
      /**
       * One `press` or `hold` action per arrow, 4-way. A held arrow repeats
       * at the keyboard's pace, marked as a repeat, as HoldDpad does.
       */
      actions: Partial<Record<Cardinal, A>>;
      axis?: never;
      ways?: never;
    }
  | {
      /**
       * One `axis2d` action the arrows steer. The arrows held at once add
       * up, so two thumbs on Up and Right steer up-right.
       */
      axis: A;
      /** 8 adds the diagonals. Defaults to 4. */
      ways?: 4 | 8;
      actions?: never;
    }
);

function directionWords(direction: DpadDirection): string {
  return direction.replace("-", " ");
}

function PressArrow<A extends string>({
  direction,
  action,
  label,
  size,
  paused,
}: {
  direction: Cardinal;
  action: A;
  label: string;
  size: DockSize;
  paused: boolean;
}) {
  const sink = useActionSink();
  // The first step of a hold is the press; the steps after it are repeats.
  const repeatingRef = useRef(false);
  const repeat = useHoldRepeat(() => {
    sink?.(touchActionInput(action, "down", repeatingRef.current));
    repeatingRef.current = true;
  });
  useEffect(() => {
    if (paused) repeat.stop();
  }, [paused, repeat]);
  const Icon = ICON[direction];
  return (
    <TouchButton
      label={label}
      data-dpad-direction={direction}
      onPress={() => {
        repeatingRef.current = false;
        repeat.start();
      }}
      onRelease={() => {
        repeat.stop();
        sink?.(touchActionInput(action, "up"));
      }}
      className={`${DOCK_KEY_CLASS[size]} ${DOCK_KEY_STYLE}`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </TouchButton>
  );
}

/**
 * A d-pad on the action layer (#2359). With `actions` it is a 4-way pad of
 * press or hold actions, each arrow named by its action's label; with `axis`
 * it steers one `axis2d` action, 4-way or 8-way. Every arrow is its own
 * hold, so it takes several fingers at once, and Enter and Space press it
 * from a keyboard. Holds end on blur, a hidden page, pause and unmount.
 *
 * @param props - The map, the actions or axis, and the size.
 * @returns The pad.
 */
export function DpadDock<A extends string>(props: DpadDockProps<A>) {
  const { map, size = "md", paused = false, className = "" } = props;
  const dockRef = useDockHeight<HTMLDivElement>();
  const sink = useActionSink();
  const heldRef = useRef<Set<DpadDirection>>(new Set());
  const axis = props.axis;
  const ways = props.ways ?? 4;

  const sendAxis = () => {
    if (!axis) return;
    let x = 0;
    let y = 0;
    for (const direction of heldRef.current) {
      x += VECTOR[direction].x;
      y += VECTOR[direction].y;
    }
    const length = Math.hypot(x, y);
    sink?.(
      touchAxisInput(axis, {
        x: length === 0 ? 0 : Math.round((x / length) * 100) / 100 + 0,
        y: length === 0 ? 0 : Math.round((y / length) * 100) / 100 + 0,
      })
    );
  };

  // A pause lets go of the steering; a thumb still down starts again only
  // when it lifts and presses.
  useEffect(() => {
    if (!paused || heldRef.current.size === 0) return;
    heldRef.current.clear();
    if (axis) sink?.(touchAxisInput(axis, { x: 0, y: 0 }));
  }, [paused, axis, sink]);

  const groupLabel = axis ? dockActionLabel(map, axis) : "Directional pad";

  return (
    <div
      ref={dockRef}
      role="group"
      aria-label={groupLabel}
      data-dock-preset="dpad"
      data-dock-size={size}
      className={`grid w-max grid-cols-3 gap-1 touch-none select-none ${className}`}
    >
      {GRID.map((direction, index) => {
        const blank = (
          <div
            key={direction ?? `hub-${index}`}
            aria-hidden="true"
            className={DOCK_KEY_CLASS[size]}
          />
        );
        if (direction === null) return blank;
        if (axis) {
          if (ways === 4 && DIAGONALS.has(direction)) return blank;
          const Icon = ICON[direction];
          return (
            <TouchButton
              key={direction}
              label={`${dockActionLabel(map, axis)}: ${directionWords(direction)}`}
              data-dpad-direction={direction}
              onPress={() => {
                heldRef.current.add(direction);
                sendAxis();
              }}
              onRelease={() => {
                heldRef.current.delete(direction);
                sendAxis();
              }}
              className={`${DOCK_KEY_CLASS[size]} ${DOCK_KEY_STYLE}`}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
          );
        }
        const action = DIAGONALS.has(direction)
          ? undefined
          : props.actions?.[direction as Cardinal];
        if (!action) return blank;
        return (
          <PressArrow
            key={direction}
            direction={direction as Cardinal}
            action={action}
            label={dockActionLabel(map, action)}
            size={size}
            paused={paused}
          />
        );
      })}
    </div>
  );
}
