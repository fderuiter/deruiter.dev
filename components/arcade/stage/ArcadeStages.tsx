"use client";

import React from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Handedness } from "@/components/arcade/mobile";

/** Which template a stage lays out. `auto` follows the viewport. */
export type StageOrientation = "auto" | "portrait" | "landscape";

/** Extra classes for each slot, for a game's own spacing and sizing. */
export interface StageSlotClassNames {
  hud?: string;
  body?: string;
  slot?: string;
  status?: string;
  panel?: string;
  moveDock?: string;
  actionDock?: string;
}

/** The slots PhoneStage and TabletStage share. */
export interface StageSlotsProps {
  /** The HUD row: 44px tall, its right end clear of the touch toolbar. */
  hud?: React.ReactNode;
  /** The stage slot: the playfield, usually a canvas sized by `useStageFit`. */
  children: React.ReactNode;
  /** An optional status line under the stage. */
  status?: React.ReactNode;
  /** The movement dock: the left thumb, or the right one when left-handed. */
  moveDock?: React.ReactNode;
  /** The action dock: the right thumb, or the left one when left-handed. */
  actionDock?: React.ReactNode;
  /** Which thumb works the actions. Defaults to `right`. */
  handedness?: Handedness;
  /** Which template to use. Defaults to `auto`, the viewport's orientation. */
  orientation?: StageOrientation;
  /**
   * Which portrait row takes the spare height. `stage` (the default) grows the
   * stage; `dock` keeps the stage at its own height and grows the dock row.
   */
  portraitFill?: "stage" | "dock";
  /** Where landscape docks sit in their columns. Defaults to `center`. */
  dockAlign?: "center" | "end";
  /** Classes for the stage root. */
  className?: string;
  /** Classes for each slot. */
  classNames?: StageSlotClassNames;
}

interface StageLayoutProps extends StageSlotsProps {
  kind: "phone" | "tablet";
  panel?: React.ReactNode;
  panelSide?: "left" | "right";
  panelLabel?: string;
}

const PORTRAIT_QUERY = "(orientation: portrait)";

/** Joins class names, leaving out empty ones. Slot classes add to the base. */
function cx(...names: Array<string | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/**
 * The layout PhoneStage and TabletStage share. The templates live in
 * `app/arcade/arcade.css` under `.arcade-stage`; this sets the attributes they
 * read and renders only the slots it is given.
 */
function StageLayout({
  kind,
  hud,
  children,
  status,
  moveDock,
  actionDock,
  panel,
  panelSide = "right",
  panelLabel,
  handedness = "right",
  orientation = "auto",
  portraitFill = "stage",
  dockAlign = "center",
  className,
  classNames = {},
}: StageLayoutProps) {
  const portraitViewport = useMediaQuery(PORTRAIT_QUERY);
  const resolved =
    orientation === "auto"
      ? portraitViewport
        ? "portrait"
        : "landscape"
      : orientation;

  return (
    <div
      className={cx("arcade-stage", className)}
      data-stage={kind}
      data-stage-orientation={resolved}
      data-handedness={handedness}
      data-portrait-fill={portraitFill}
      data-dock-align={dockAlign}
    >
      {hud != null && (
        <div className={cx("arcade-stage-hud", classNames.hud)}>{hud}</div>
      )}
      <div className={cx("arcade-stage-body", classNames.body)}>
        {moveDock != null && (
          <div
            className={cx("arcade-stage-dock", classNames.moveDock)}
            data-dock="move"
          >
            {moveDock}
          </div>
        )}
        <div className="arcade-stage-center">
          <div
            className={cx("arcade-stage-slot", classNames.slot)}
            data-stage-slot=""
          >
            {children}
          </div>
          {status != null && (
            <div className={cx("arcade-stage-status", classNames.status)}>
              {status}
            </div>
          )}
        </div>
        {panel != null && (
          <div
            className={cx("arcade-stage-panel", classNames.panel)}
            data-panel-side={panelSide}
            role={panelLabel ? "group" : undefined}
            aria-label={panelLabel}
          >
            {panel}
          </div>
        )}
        {actionDock != null && (
          <div
            className={cx("arcade-stage-dock", classNames.actionDock)}
            data-dock="action"
          >
            {actionDock}
          </div>
        )}
      </div>
    </div>
  );
}

/** PhoneStage takes the shared slots. */
export type PhoneStageProps = StageSlotsProps;

/**
 * A phone layout (ADR 0062, #2358). Portrait stacks the HUD row, the stage,
 * an optional status line and the thumb dock above the bottom safe-area
 * inset. Landscape puts the HUD row over a left thumb column, the stage and a
 * right thumb column; the columns are as wide as their keys, and the stage's
 * side padding adds the safe-area insets. The stage relies on the immersive
 * cabinet for scroll and zoom: nothing inside it scrolls the page.
 */
export function PhoneStage(props: PhoneStageProps) {
  return <StageLayout kind="phone" {...props} />;
}

/** TabletStage adds an optional side panel to the shared slots. */
export interface TabletStageProps extends StageSlotsProps {
  /** A side panel beside the stage in landscape, and under it in portrait. */
  panel?: React.ReactNode;
  /** Which side of the stage the panel takes in landscape. Defaults to `right`. */
  panelSide?: "left" | "right";
  /** Accessible name for the panel; with it, the panel is a named group. */
  panelLabel?: string;
}

/**
 * A tablet layout (ADR 0062, #2358): the phone slots, an optional side panel
 * and a two-hand corner dock. In portrait each dock sits in its bottom
 * corner, under a thumb, at least 0.75rem above the bottom edge.
 */
export function TabletStage(props: TabletStageProps) {
  return <StageLayout kind="tablet" {...props} />;
}
