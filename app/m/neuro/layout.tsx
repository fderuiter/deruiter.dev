import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.mNeuro
);

export default function MobileNeuroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
