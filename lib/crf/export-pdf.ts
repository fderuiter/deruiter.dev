/**
 * Lazy entry point for the PDF exporter. The studio loads it with a
 * dynamic `import()` so its document library stays out of the CRF route's
 * first bundle; it is not re-exported from the package index for the same
 * reason.
 */
export * from "./internal/export-pdf";
