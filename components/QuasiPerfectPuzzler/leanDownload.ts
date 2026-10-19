/**
 * Shared file naming and download for the generated Lean text, so the victory
 * card and the Lean inspector name their files the same way (#2518).
 */
import { downloadFile, sanitizeFilename } from "@/lib/download";
import type { PuzzlerLevelDef } from "@/lib/quasi-perfect/types";

type LeanFileLevel = Pick<PuzzlerLevelDef, "leanTheoremName" | "title">;

/** File name stem: the Lean theorem name, then the level title, then "proof". */
export function leanFileStem(level: LeanFileLevel): string {
  return (
    sanitizeFilename(level.leanTheoremName, "") ||
    sanitizeFilename(level.title, "proof")
  );
}

/** Saves the generated (not compiled) Lean text as `<stem>.lean`. */
export function downloadLeanSource(
  level: LeanFileLevel,
  leanCode: string
): boolean {
  return downloadFile(leanCode, `${leanFileStem(level)}.lean`);
}
