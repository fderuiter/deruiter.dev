export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  badge?: string;
  techStack?: string[];
  tags?: string[];
}

export function filterFuzzySearch<T extends SearchItem>(
  query: string,
  items: T[]
): T[] {
  if (!query) return items;
  const cleanQuery = query.toLowerCase().trim();

  if (!cleanQuery) return items;

  return items.filter((item) => {
    // Normalize strings: handle special characters, empty fields
    const titleNorm = (item.title || "").toLowerCase();
    const subtitleNorm = (item.subtitle || "").toLowerCase();
    const descriptionNorm = (item.description || "").toLowerCase();
    const badgeNorm = (item.badge || "").toLowerCase();
    const techStackNorm = Array.isArray(item.techStack)
      ? item.techStack.join(" ").toLowerCase()
      : "";
    const tagsNorm = Array.isArray(item.tags)
      ? item.tags.join(" ").toLowerCase()
      : typeof (item.tags as unknown) === "string"
        ? (item.tags as unknown as string).toLowerCase()
        : "";

    return (
      titleNorm.includes(cleanQuery) ||
      subtitleNorm.includes(cleanQuery) ||
      descriptionNorm.includes(cleanQuery) ||
      badgeNorm.includes(cleanQuery) ||
      techStackNorm.includes(cleanQuery) ||
      tagsNorm.includes(cleanQuery)
    );
  });
}

export interface CaseStudyItem {
  id: string;
  slug: string;
  title: string;
  primary_language: string;
  tags: string;
}

export function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

export function getClosestMatches<
  T extends {
    id: string;
    slug: string;
    title: string;
    primary_language?: string;
    tags?: string;
  },
>(path: string, items: T[]): T[] {
  if (!path || items.length === 0) return items.slice(0, 3);

  // Clean the path (remove leading/trailing slashes, convert to lowercase)
  const cleanPath = path.toLowerCase().replace(/^\/+|\/+$/g, "");

  // Extract segments/tokens from the path
  const pathSegments = cleanPath.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || "";

  // Tokenize the whole path for keyword matching (non-alphanumeric split)
  const pathTokens = cleanPath.split(/[^a-z0-9]+/).filter((t) => t.length > 1);

  const scored = items.map((item) => {
    let score = 0;
    const slugLower = (item.slug || "").toLowerCase();
    const titleLower = (item.title || "").toLowerCase();
    const langLower = (item.primary_language || "").toLowerCase();
    const tagsLower = (item.tags || "")
      .toLowerCase()
      .split(",")
      .map((t) => t.trim());

    // 1. Exact or close slug/title matches
    if (slugLower === cleanPath || slugLower === lastSegment) {
      score += 150;
    }
    if (titleLower === cleanPath || titleLower === lastSegment) {
      score += 130;
    }

    // 2. Substring matches
    if (cleanPath.includes(slugLower) || slugLower.includes(cleanPath)) {
      score += 60;
    } else if (
      lastSegment &&
      (lastSegment.includes(slugLower) || slugLower.includes(lastSegment))
    ) {
      score += 50;
    }

    if (cleanPath.includes(titleLower) || titleLower.includes(cleanPath)) {
      score += 50;
    } else if (
      lastSegment &&
      (lastSegment.includes(titleLower) || titleLower.includes(lastSegment))
    ) {
      score += 40;
    }

    // 3. Keyword/Token overlap
    pathTokens.forEach((token) => {
      if (slugLower.includes(token)) {
        score += 30;
      }
      if (titleLower.includes(token)) {
        score += 25;
      }
      if (langLower === token) {
        score += 20;
      }
      if (tagsLower.includes(token)) {
        score += 15;
      }
    });

    // 4. Typographical closeness (Levenshtein Distance)
    // We compute distance between the last path segment and the item slug
    if (lastSegment && slugLower) {
      const dist = getLevenshteinDistance(lastSegment, slugLower);
      const maxLength = Math.max(lastSegment.length, slugLower.length);
      if (dist <= 3) {
        score += (maxLength - dist) * 15;
      }
    }

    // Also distance between the last path segment and the title
    if (lastSegment && titleLower) {
      const dist = getLevenshteinDistance(lastSegment, titleLower);
      const maxLength = Math.max(lastSegment.length, titleLower.length);
      if (dist <= 3) {
        score += (maxLength - dist) * 10;
      }
    }

    return { item, score };
  });

  // Sort by score descending. If scores are equal, sort alphabetically by title
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.title.localeCompare(b.item.title);
  });

  return scored.slice(0, 3).map((s) => s.item);
}
