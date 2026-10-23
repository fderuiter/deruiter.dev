/**
 * Clinical Data Platform: public API (ADR 0066).
 *
 * One synthetic sponsor portfolio, modelled in bronze, silver and gold
 * layers, governed as data products and served through one semantic layer.
 * The engine is pure TypeScript with no DOM, React or Worker dependency; a
 * Web Worker imports it directly. Internals under `internal/` are private.
 */
export * from "./types";
export * from "./presets";
export { checkLayerFlow, checkRegulatoryWording } from "./internal/policy";
export { generatePortfolio } from "./internal/portfolio/generate";
export {
  scoreVendors,
  sensitivity,
  cashFlow,
  tornado,
  planRoadmap,
  decisionMemo,
} from "./internal/strategy/engine";
