import fs from "fs";
import path from "path";

/**
 * Resolves the candidate source page file path on disk for a given static route path.
 * Next.js App Router convention maps routes to page files under the `app` directory.
 * e.g., '/' -> 'app/page.tsx', '/arcade' -> 'app/arcade/page.tsx'
 */
export function getRouteSourceFilePath(routePath: string): string {
  const cleanPath = routePath.replace(/^\/+|\/+$/g, "");
  const relativePath =
    cleanPath === "" ? "app/page.tsx" : `app/${cleanPath}/page.tsx`;
  return path.resolve(process.cwd(), relativePath);
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
