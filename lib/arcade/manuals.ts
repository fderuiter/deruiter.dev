/**
 * Public Root Entrypoint for Arcade Field Manuals
 *
 * Exposes the modularized field manuals package without funnelling through
 * the monolithic `lib/arcade/index.ts` barrel, avoiding circular dependency
 * cycles with game action definitions (#3487).
 */

export * from "./manuals/index";
