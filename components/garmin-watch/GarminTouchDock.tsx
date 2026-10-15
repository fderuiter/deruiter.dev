"use client";

import React from "react";
import {
  IconArrowBackUp,
  IconArrowDown,
  IconArrowUp,
  IconBackpack,
  IconBolt,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconWalk,
} from "@tabler/icons-react";
import { TouchButton, TouchControlsGate } from "@/components/arcade/mobile";

/** A key on the Monkey C Mayhem touch dock. */
export type GarminDockKey =
  "jog" | "sprint" | "down" | "start" | "back" | "action" | "jump";

/**
 * What the dock drives: a run on the course, or a Training Plan screen
 * (map, hut, report), where the keys are the arrows, Select, Back and the
 * gear bag, as they are on a keyboard (#1994, #1995).
 */
export type GarminDockMode = "run" | "plan";

interface GarminTouchDockProps {
  mode: GarminDockMode;
  /** What START does right now: Start, Pause, Resume or Restart. */
  startAction: string;
  /** A key went down (true) or came up (false). Tap keys only report down. */
  onKey: (key: GarminDockKey, down: boolean) => void;
}

interface KeySpec {
  label: string;
  caption: string;
  shortcut: string;
  icon: React.ReactNode;
}

const ICON = "garmin-key-icon";

/**
 * The names, captions and keyboard shortcuts of every key in each mode. The
 * shortcut is the key a keyboard case presses for the same action.
 */
function keySpecs(
  mode: GarminDockMode,
  startAction: string
): Record<GarminDockKey, KeySpec> {
  if (mode === "plan") {
    return {
      jog: {
        label: "Left",
        caption: "Left",
        shortcut: "ArrowLeft",
        icon: <IconChevronLeft className={ICON} aria-hidden="true" />,
      },
      sprint: {
        label: "Right",
        caption: "Right",
        shortcut: "ArrowRight",
        icon: <IconChevronRight className={ICON} aria-hidden="true" />,
      },
      down: {
        label: "Down",
        caption: "Down",
        shortcut: "ArrowDown",
        icon: <IconArrowDown className={ICON} aria-hidden="true" />,
      },
      start: {
        label: "Select",
        caption: "Select",
        shortcut: "Enter",
        icon: <IconPlayerPlay className={ICON} aria-hidden="true" />,
      },
      back: {
        label: "Back",
        caption: "Back",
        shortcut: "Backspace",
        icon: <IconArrowBackUp className={ICON} aria-hidden="true" />,
      },
      action: {
        label: "Gear bag",
        caption: "Bag",
        shortcut: "X",
        icon: <IconBackpack className={ICON} aria-hidden="true" />,
      },
      jump: {
        label: "Up",
        caption: "Up",
        shortcut: "ArrowUp",
        icon: <IconArrowUp className={ICON} aria-hidden="true" />,
      },
    };
  }
  return {
    jog: {
      label: "Jog (hold)",
      caption: "Jog",
      shortcut: "ArrowLeft",
      icon: <IconWalk className={ICON} aria-hidden="true" />,
    },
    sprint: {
      label: "Sprint (hold)",
      caption: "Sprint",
      shortcut: "ArrowRight",
      icon: <IconChevronsRight className={ICON} aria-hidden="true" />,
    },
    down: {
      label: "Down: enter a station or slam",
      caption: "Down",
      shortcut: "ArrowDown",
      icon: <IconArrowDown className={ICON} aria-hidden="true" />,
    },
    start: {
      label: `${startAction} run`,
      caption: startAction,
      shortcut: "Enter P",
      icon:
        startAction === "Pause" ? (
          <IconPlayerPause className={ICON} aria-hidden="true" />
        ) : (
          <IconPlayerPlay className={ICON} aria-hidden="true" />
        ),
    },
    back: {
      label: "Back",
      caption: "Back",
      shortcut: "Backspace",
      icon: <IconArrowBackUp className={ICON} aria-hidden="true" />,
    },
    action: {
      label: "Action: Heat Bolt or Cape Spin",
      caption: "Action",
      shortcut: "X",
      icon: <IconBolt className={ICON} aria-hidden="true" />,
    },
    jump: {
      label: "Jump (hold for height)",
      caption: "Jump",
      shortcut: "ArrowUp Space",
      icon: <IconArrowUp className={ICON} aria-hidden="true" />,
    },
  };
}

/** The keys that act while a finger stays down. */
const HELD: ReadonlySet<GarminDockKey> = new Set(["jog", "sprint", "jump"]);

/**
 * The on-screen keys of the Monkey C Mayhem touch cabinet (#2122). The left
 * thumb holds Jog and Sprint, the right thumb holds Jump and taps Action, and
 * Down, START and BACK sit between them. They are the same actions as the
 * arrow keys, X, Enter and Backspace, and on a Training Plan screen they
 * become the arrows, Select, Back and the gear bag.
 *
 * Jog, Sprint and Jump hold while a finger is down, so a long press jumps
 * higher. The other keys act when the tap completes. No key takes focus, so
 * a keyboard case keeps driving the watch beside the dock, and the dock hides
 * while a keyboard is in use and returns on the next touch
 * (`TouchControlsGate`).
 *
 * @param props - The mode, START's current action and a handler for every key.
 * @returns The dock.
 */
export function GarminTouchDock({
  mode,
  startAction,
  onKey,
}: GarminTouchDockProps) {
  const specs = keySpecs(mode, startAction);

  const key = (id: GarminDockKey) => {
    const spec = specs[id];
    const content = (
      <>
        {spec.icon}
        <span aria-hidden="true" className="garmin-key-label">
          {spec.caption}
        </span>
      </>
    );
    // Plan screens step once per tap, so every key is a tap there.
    if (mode === "run" && HELD.has(id)) {
      return (
        <TouchButton
          key={id}
          label={spec.label}
          aria-keyshortcuts={spec.shortcut}
          data-dock-key={id}
          onPress={() => onKey(id, true)}
          onRelease={() => onKey(id, false)}
          className={`garmin-key garmin-key-${id}`}
        >
          {content}
        </TouchButton>
      );
    }
    return (
      <button
        key={id}
        type="button"
        aria-label={spec.label}
        aria-keyshortcuts={spec.shortcut}
        data-dock-key={id}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onKey(id, true)}
        className={`garmin-key garmin-key-${id} min-h-14`}
      >
        {content}
      </button>
    );
  };

  return (
    <TouchControlsGate>
      <div
        role="group"
        aria-label={
          mode === "plan"
            ? "Training Plan touch controls"
            : "Monkey C Mayhem touch controls"
        }
        data-testid="garmin-touch-dock"
        data-mode={mode}
        className="garmin-dock"
      >
        <div className="garmin-dock-side">
          {key("jog")}
          {key("sprint")}
        </div>
        <div className="garmin-dock-middle">
          {key("down")}
          {key("start")}
          {key("back")}
        </div>
        <div className="garmin-dock-side garmin-dock-side-right">
          {key("action")}
          {key("jump")}
        </div>
      </div>
    </TouchControlsGate>
  );
}
