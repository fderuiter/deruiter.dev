/**
 * Lightweight public entry for the arcade engine base class. Standalone
 * bundles (the Garmin watch engine) import it here instead of the arcade
 * barrel, which would pull the registry and CRT pipeline into the bundle.
 */
export { ArcadeEngine } from "./core/engine";
