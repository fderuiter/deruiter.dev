"use client";

import { useState, useCallback, useMemo } from "react";
import { useHotkeys, type UseHotkeysOptions } from "@/hooks/useHotkeys";

/**
 * Options controlling the behavior of `usePatrolTriageHotkeys`.
 */
export interface UsePatrolTriageHotkeysOptions<T = unknown> {
  /**
   * List of items available for hotkey triage navigation.
   */
  items?: T[];
  /**
   * Total item count when items array is omitted.
   */
  itemsCount?: number;
  /**
   * Predicate to determine if an item at index is selectable.
   * Locked, completed, or disabled items should return false to be skipped.
   */
  isItemSelectable?: (item: T | undefined, index: number) => boolean;
  /**
   * Callback invoked when an item is selected via numeric hotkeys (1-9) or Enter/Space.
   */
  onSelectItem?: (index: number, item?: T) => void;
  /**
   * Callback invoked when Enter/Space is pressed and no item is focused, or to advance the shift phase.
   */
  onAdvancePhase?: () => void;
  /**
   * Current shift phase or scenario ID. Changes reset `focusedIndex` to 0 to prevent out-of-bounds focus.
   */
  phase?: string;
  /**
   * Whether hotkeys are active. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Allow hotkeys while typing in editable inputs. Defaults to false.
   */
  allowInInputs?: boolean;
  /**
   * Ignore hotkeys when any modal or focus trap is active. Defaults to true.
   */
  ignoreWhenModalOpen?: boolean;
  /**
   * Initial focused item index. Defaults to 0.
   */
  initialIndex?: number;
}

/**
 * Return type for `usePatrolTriageHotkeys`.
 */
export interface UsePatrolTriageHotkeysResult<T = unknown> {
  /** Currently focused item index. */
  focusedIndex: number;
  /** State setter for focused item index. */
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Currently focused item object (if `items` array was provided). */
  focusedItem: T | undefined;
  /** Programmatically select an item at the given index. */
  selectIndex: (index: number) => void;
  /** Navigate focus to the next selectable item. */
  nextItem: () => void;
  /** Navigate focus to the previous selectable item. */
  prevItem: () => void;
  /** Checks if the given item index is currently focused. */
  isFocused: (index: number) => boolean;
  /** Returns hotkey badge text (e.g., "[1]", "[2]") for item at index, or null if beyond 9 items. */
  getHotkeyBadge: (index: number) => string | null;
}

/**
 * Phase-aware keyboard triage hook for the Patrol Shift Studio.
 * Supports j/k and ArrowDown/ArrowUp navigation, numeric hotkeys (1-9),
 * Enter/Space selection or phase advancement, input suppression, and modal focus traps.
 */
export function usePatrolTriageHotkeys<T = unknown>(
  options: UsePatrolTriageHotkeysOptions<T> = {}
): UsePatrolTriageHotkeysResult<T> {
  const {
    items,
    itemsCount,
    isItemSelectable,
    onSelectItem,
    onAdvancePhase,
    phase,
    enabled = true,
    allowInInputs = false,
    ignoreWhenModalOpen = true,
    initialIndex = 0,
  } = options;

  const totalCount = items ? items.length : (itemsCount ?? 0);
  const [focusedIndex, setFocusedIndex] = useState<number>(initialIndex);
  const [prevPhaseKey, setPrevPhaseKey] = useState<string>(
    `${phase ?? ""}-${totalCount}`
  );

  // Reset focus index when phase or totalCount changes during render
  const currentPhaseKey = `${phase ?? ""}-${totalCount}`;
  if (currentPhaseKey !== prevPhaseKey) {
    setPrevPhaseKey(currentPhaseKey);
    setFocusedIndex(0);
  }

  const checkSelectable = useCallback(
    (index: number): boolean => {
      if (index < 0 || index >= totalCount) return false;
      if (!isItemSelectable) return true;
      const item = items ? items[index] : undefined;
      return isItemSelectable(item, index);
    },
    [totalCount, isItemSelectable, items]
  );

  const selectIndex = useCallback(
    (index: number) => {
      if (checkSelectable(index)) {
        const item = items ? items[index] : undefined;
        onSelectItem?.(index, item);
      }
    },
    [checkSelectable, items, onSelectItem]
  );

  const nextItem = useCallback(() => {
    if (totalCount === 0) return;
    setFocusedIndex((prev) => {
      let next = prev + 1;
      while (next < totalCount && !checkSelectable(next)) {
        next++;
      }
      if (next < totalCount && checkSelectable(next)) {
        return next;
      }
      return prev;
    });
  }, [totalCount, checkSelectable]);

  const prevItem = useCallback(() => {
    if (totalCount === 0) return;
    setFocusedIndex((prev) => {
      let prevIdx = prev - 1;
      while (prevIdx >= 0 && !checkSelectable(prevIdx)) {
        prevIdx--;
      }
      if (prevIdx >= 0 && checkSelectable(prevIdx)) {
        return prevIdx;
      }
      return prev;
    });
  }, [totalCount, checkSelectable]);

  const hotkeyOptions: UseHotkeysOptions = {
    enabled,
    allowInInputs,
    ignoreWhenModalOpen,
    preventDefault: true,
  };

  // j / k and ArrowDown / ArrowUp navigation
  useHotkeys(["j", "arrowdown"], () => nextItem(), hotkeyOptions);
  useHotkeys(["k", "arrowup"], () => prevItem(), hotkeyOptions);

  // Numeric hotkeys 1-9
  useHotkeys(
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    (_event, hotkey) => {
      const digit = parseInt(hotkey, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        const targetIndex = digit - 1;
        if (checkSelectable(targetIndex)) {
          setFocusedIndex(targetIndex);
          selectIndex(targetIndex);
        }
      }
    },
    hotkeyOptions
  );

  // Enter / Space activation
  useHotkeys(
    ["enter", "space"],
    () => {
      if (
        totalCount > 0 &&
        focusedIndex >= 0 &&
        focusedIndex < totalCount &&
        checkSelectable(focusedIndex)
      ) {
        selectIndex(focusedIndex);
      } else if (onAdvancePhase) {
        onAdvancePhase();
      }
    },
    hotkeyOptions
  );

  const focusedItem = useMemo(() => {
    if (items && focusedIndex >= 0 && focusedIndex < items.length) {
      return items[focusedIndex];
    }
    return undefined;
  }, [items, focusedIndex]);

  const isFocused = useCallback(
    (index: number) => focusedIndex === index,
    [focusedIndex]
  );

  const getHotkeyBadge = useCallback((index: number): string | null => {
    if (index >= 0 && index < 9) {
      return `[${index + 1}]`;
    }
    return null;
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    focusedItem,
    selectIndex,
    nextItem,
    prevItem,
    isFocused,
    getHotkeyBadge,
  };
}
