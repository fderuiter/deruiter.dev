"use client";

import { createContext, useContext } from "react";

/**
 * True while a game runs inside the immersive touch cabinet (ADR 0061): a
 * phone or portrait tablet after Launch. PlayCabinet provides it, so a game
 * can lay out for touch without knowing the device itself. Desktop and the
 * attract screen read false.
 */
export const CabinetTouchContext = createContext<boolean>(false);

/**
 * Whether the game is running in the immersive touch cabinet.
 *
 * @returns True inside an immersive touch cabinet.
 */
export function useCabinetTouch(): boolean {
  return useContext(CabinetTouchContext);
}
