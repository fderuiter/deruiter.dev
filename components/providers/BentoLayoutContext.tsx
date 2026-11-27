"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface BentoLayoutContextType {
  heightOverrides: Record<string, number>;
  registerHeightOverride: (id: string, height: number) => void;
  clearHeightOverride: (id: string) => void;
  isTransitioning: Record<string, boolean>;
  setTransitioning: (id: string, transitioning: boolean) => void;
}

const BentoLayoutContext = createContext<BentoLayoutContextType | undefined>(
  undefined
);

export const BentoLayoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [heightOverrides, setHeightOverrides] = useState<
    Record<string, number>
  >({});
  const [isTransitioning, setIsTransitioning] = useState<
    Record<string, boolean>
  >({});

  const registerHeightOverride = useCallback((id: string, height: number) => {
    setHeightOverrides((prev) => {
      if (prev[id] === height) return prev;
      return { ...prev, [id]: height };
    });
  }, []);

  const clearHeightOverride = useCallback((id: string) => {
    setHeightOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const setTransitioning = useCallback((id: string, transitioning: boolean) => {
    setIsTransitioning((prev) => {
      if (prev[id] === transitioning) return prev;
      return { ...prev, [id]: transitioning };
    });
  }, []);

  return (
    <BentoLayoutContext.Provider
      value={{
        heightOverrides,
        registerHeightOverride,
        clearHeightOverride,
        isTransitioning,
        setTransitioning,
      }}
    >
      {children}
    </BentoLayoutContext.Provider>
  );
};

export const useBentoLayout = () => {
  const context = useContext(BentoLayoutContext);
  if (!context) {
    return {
      heightOverrides: {},
      registerHeightOverride: () => {},
      clearHeightOverride: () => {},
      isTransitioning: {},
      setTransitioning: () => {},
    };
  }
  return context;
};
