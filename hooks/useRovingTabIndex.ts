"use client";

import { useCallback, useState } from "react";

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** Standard 2D navigation map for 4-way D-Pad controls. */
export const DPAD_NAVIGATION_MAP: Record<
  "up" | "down" | "left" | "right",
  Record<ArrowKey, "up" | "down" | "left" | "right">
> = {
  up: {
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "down",
  },
  down: {
    ArrowUp: "up",
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "up",
  },
  left: {
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "right",
  },
  right: {
    ArrowLeft: "left",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowRight: "left",
  },
};

export interface UseRovingTabIndexOptions<T extends string = string> {
  /** Ordered list of focusable element IDs. */
  items: readonly T[];
  /** Initially active item ID. Defaults to items[0]. */
  defaultActiveId?: T;
  /** Optional custom spatial navigation graph mapping item ID and arrow key to destination ID. */
  navigationMap?: Partial<Record<T, Partial<Record<ArrowKey, T>>>>;
}

export interface RovingTabProps {
  "data-roving-id": string;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

export interface UseRovingTabIndexResult<T extends string = string> {
  /** The ID of the currently focused or active element holding tabIndex 0. */
  activeId: T;
  /** Sets the active element ID directly. */
  setActiveId: (id: T) => void;
  /** Returns accessible roving tabindex props for a given item ID. */
  getTabProps: (id: T) => RovingTabProps;
}

/**
 * Manages roving tabindex across a composite widget pursuant to Technique ARIA4.
 *
 * Ensures exactly one element in the group holds tabIndex 0 while all others hold tabIndex -1.
 * Supports Arrow key spatial and linear navigation, Home/End boundaries, and updates the tab stop
 * on focus. Uses DOM query resolution instead of ref arrays to comply with React Compiler rules.
 */
export function useRovingTabIndex<T extends string = string>({
  items,
  defaultActiveId,
  navigationMap,
}: UseRovingTabIndexOptions<T>): UseRovingTabIndexResult<T> {
  const fallbackId = defaultActiveId ?? items[0];
  const [activeIdState, setActiveIdState] = useState<T>(fallbackId);

  // Derive activeId without cascading effects
  const activeId: T = items.includes(activeIdState)
    ? activeIdState
    : (items[0] ?? fallbackId);

  const getNextId = useCallback(
    (currentId: T, key: ArrowKey): T => {
      // 1. Custom navigation map lookup
      if (navigationMap?.[currentId]?.[key]) {
        return navigationMap[currentId]![key]!;
      }

      const currentIndex = items.indexOf(currentId);
      if (currentIndex === -1) return currentId;

      // 2. Default directional handling for D-Pad items
      const isUp = currentId === "up";
      const isDown = currentId === "down";
      const isLeft = currentId === "left";
      const isRight = currentId === "right";

      if (isUp || isDown || isLeft || isRight) {
        // If right is pressed from right and more items exist (e.g. action buttons), advance
        if (isRight && key === "ArrowRight") {
          const nextIdx = currentIndex + 1;
          if (nextIdx < items.length) return items[nextIdx];
        }

        const dpadTarget =
          DPAD_NAVIGATION_MAP[currentId as "up" | "down" | "left" | "right"][
            key
          ];
        if (items.includes(dpadTarget as T)) {
          return dpadTarget as T;
        }
      }

      // 3. Linear navigation fallback with wrap-around
      if (key === "ArrowRight" || key === "ArrowDown") {
        const nextIndex = (currentIndex + 1) % items.length;
        return items[nextIndex];
      }
      if (key === "ArrowLeft" || key === "ArrowUp") {
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        return items[prevIndex];
      }

      return currentId;
    },
    [items, navigationMap]
  );

  const handleKeyDown = useCallback(
    (currentId: T, event: React.KeyboardEvent<HTMLElement>) => {
      let nextId: T | null = null;

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        nextId = getNextId(currentId, event.key);
      } else if (event.key === "Home") {
        event.preventDefault();
        if (items.length > 0) nextId = items[0];
      } else if (event.key === "End") {
        event.preventDefault();
        if (items.length > 0) nextId = items[items.length - 1];
      }

      if (nextId) {
        setActiveIdState(nextId);
        const currentTarget = event.currentTarget;
        const container =
          currentTarget.closest<HTMLElement>(
            "[data-roving-group], [role='group']"
          ) ?? currentTarget.parentElement;
        const target = container?.querySelector<HTMLElement>(
          `[data-roving-id="${nextId}"]`
        );
        target?.focus();
      }
    },
    [getNextId, items]
  );

  const getTabProps = useCallback(
    (id: T): RovingTabProps => {
      return {
        "data-roving-id": id,
        tabIndex: activeId === id ? 0 : -1,
        onFocus: () => setActiveIdState(id),
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          handleKeyDown(id, event);
        },
      };
    },
    [activeId, handleKeyDown]
  );

  return {
    activeId,
    setActiveId: setActiveIdState,
    getTabProps,
  };
}
