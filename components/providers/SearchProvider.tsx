"use client";

import React, { createContext, useContext, useState } from "react";

interface SearchContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = () => setIsOpen(true);
  const closeSearch = () => setIsOpen(false);

  const value = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openSearch,
      closeSearch,
    }),
    [isOpen]
  );

  React.useEffect(() => {
    window.__openSearch = () => setIsOpen(true);
    return () => {
      delete window.__openSearch;
    };
  }, []);

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
