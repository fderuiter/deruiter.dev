import type { DossierChips } from "@/lib/og-image";

const WORDS_PER_MINUTE = 200;

/** Reading time label such as "6 min read", from plain or HTML text. Never below one minute. */
export function formatReadingTime(text: string): string {
  const words = text
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`;
}

/** Stable UTC date label such as "Sep 24, 2026" so cards do not vary by server timezone. */
export function formatDossierDate(date: Date): string | undefined {
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Builds dossier chips, dropping any fact that is missing. */
export function buildDossierChips(input: {
  readingTime?: string;
  publishedAt?: Date;
  language?: string;
  verified?: boolean;
}): DossierChips {
  return {
    ...(input.readingTime ? { readingTime: input.readingTime } : {}),
    ...(input.publishedAt
      ? { publishedAt: formatDossierDate(input.publishedAt) }
      : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.verified ? { verified: true } : {}),
  };
}
