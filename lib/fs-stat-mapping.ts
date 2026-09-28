import fs from "fs";
import path from "path";

/**
 * Resolves the candidate source page file path on disk for a given static route path.
 * Next.js App Router convention maps routes to page files under the `app` directory.
 * e.g., '/' -> 'app/page.tsx', '/arcade' -> 'app/arcade/page.tsx'
 */
export function getRouteSourceFilePath(routePath: string): string {
  const cleanPath = routePath.replace(/^\/+|\/+$/g, "");
  const candidates =
    cleanPath === ""
      ? ["app/page.tsx", "app/desktop/page.tsx", "app/mobile/page.tsx"]
      : [
          `app/${cleanPath}/page.tsx`,
          `app/desktop/${cleanPath}/page.tsx`,
          `app/mobile/${cleanPath}/page.tsx`,
        ];

  for (const rel of candidates) {
    const absPath = path.resolve(process.cwd(), rel);
    if (fs.existsSync(absPath)) {
      return absPath;
    }
  }

  return path.resolve(process.cwd(), candidates[0]);
}

/**
 * Inspects source file modification time (mtime) dynamically for a static route path.
 * Falls back open gracefully to the provided fallbackDate (server boot/generation timestamp)
 * if the file cannot be statted or does not exist.
 */
export function getRouteLastModified(
  routePath: string,
  fallbackDate: Date = new Date()
): Date {
  try {
    const primaryPath = getRouteSourceFilePath(routePath);
    const candidatePaths = [
      primaryPath,
      primaryPath.replace(/\.tsx$/, ".ts"),
      primaryPath.replace(/\.tsx$/, ".jsx"),
      primaryPath.replace(/\.tsx$/, ".js"),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats && stats.mtime) {
          return stats.mtime;
        }
      }
    }
  } catch {
    // Fail open gracefully when path cannot be statted
  }

  return fallbackDate;
}
