import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

/**
 * `ROUTE_METADATA_CONFIGS.offline` existed but nothing consumed it, so the PWA
 * offline fallback rendered the site-wide default title -- "Frederick de Ruiter
 * | Clinical Data, Software & Side Projects" -- rather than telling the reader
 * they are offline.
 *
 * Declared in a layout because `app/offline/page.tsx` is a client component and
 * cannot export `metadata`. Same pattern as `app/proof/layout.tsx` and
 * `app/contact/layout.tsx`.
 */
export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.offline
);

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
