"use client";

import { createContext, useContext, type ReactNode } from "react";

const ArcadeSessionContext = createContext<unknown>(null);

/** Props for {@link ArcadeSessionProvider}. */
export interface ArcadeSessionProviderProps<T> {
  /** The value a game's `use<Game>Session()` returned. */
  readonly value: T;
  readonly children: ReactNode;
}

/**
 * Provides a game's session to its views (ADR 0062). A game's session holder
 * calls its `use<Game>Session()` and wraps the views in this, so the views
 * read one session whichever of them is mounted.
 */
export function ArcadeSessionProvider<T>({
  value,
  children,
}: ArcadeSessionProviderProps<T>) {
  return (
    <ArcadeSessionContext.Provider value={value}>
      {children}
    </ArcadeSessionContext.Provider>
  );
}

/**
 * The session the nearest {@link ArcadeSessionProvider} holds. Throws outside
 * one, since a view without its session is a wiring mistake.
 *
 * @returns The game's session.
 */
export function useArcadeSession<T>(): T {
  const session = useContext(ArcadeSessionContext);
  if (session === null) {
    throw new Error(
      "useArcadeSession must be used inside ArcadeSessionProvider"
    );
  }
  return session as T;
}
