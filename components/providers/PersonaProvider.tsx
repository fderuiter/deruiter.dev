"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { safeGetItem } from "@/lib/safe-storage";
import {
  DEFAULT_PERSONA,
  PERSONA_STORAGE_KEY,
  isLegacyPersonaValue,
  normalizePersona,
  type PersonaType,
} from "@/lib/persona";

interface PersonaContextType {
  persona: PersonaType;
  setPersona: (persona: PersonaType) => void;
}

const PersonaContext = createContext<PersonaContextType | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  // Stored as a plain string so values written before the ADR 0047 rename
  // (see LEGACY_*_PERSONA_VALUE in lib/persona) still resolve through
  // normalizePersona.
  const [storedPersona, setPersistentPersona] = usePersistentState<string>(
    PERSONA_STORAGE_KEY,
    DEFAULT_PERSONA
  );
  const persona = normalizePersona(storedPersona);

  // Rewrite a legacy value once so storage only ever holds current names.
  // The visitor's mode is unchanged; only its spelling is.
  useEffect(() => {
    if (isLegacyPersonaValue(storedPersona)) {
      setPersistentPersona(normalizePersona(storedPersona));
    }
  }, [storedPersona, setPersistentPersona]);

  const setPersona = useCallback(
    (newPersona: PersonaType) => {
      let scrollY = 0;
      if (typeof window !== "undefined") {
        scrollY = window.scrollY;
      }
      setPersistentPersona(normalizePersona(newPersona));
      if (
        typeof window !== "undefined" &&
        typeof window.scrollTo === "function"
      ) {
        requestAnimationFrame(() => {
          try {
            window.scrollTo({ top: scrollY, behavior: "instant" });
          } catch {
            // ignore JSDOM unsupported scrollTo
          }
        });
      }
    },
    [setPersistentPersona]
  );

  const value = useMemo(
    () => ({
      persona,
      setPersona,
    }),
    [persona, setPersona]
  );

  return (
    <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    // Read through safeStorage so the envelope written by usePersistentState
    // (and any legacy bare string) resolves, and blocked storage cannot throw.
    const persona = normalizePersona(safeGetItem<unknown>(PERSONA_STORAGE_KEY));
    return {
      persona,
      setPersona: () => {},
    };
  }
  return context;
}
