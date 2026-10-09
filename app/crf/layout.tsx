import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
import { getNavBreadcrumbSchemaParents } from "@/lib/navigation";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.crf
);

export default function CRFLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: "CRF Studio: Next-Gen Clinical Form & Protocol Designer",
            description:
              "Zero-latency clinical trial form designer and EDC simulator with 12-column responsive layout, AST-powered edit checks, CDISC CDASH 2.2 / ODM-XML v1.3.2 compliance, and live publication aCRF overlays.",
            url: "/crf",
            applicationCategory: "DeveloperApplication",
            genre: "Clinical Data Management Engine",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            ...getNavBreadcrumbSchemaParents("/crf"),
            { name: "CRF Studio", url: "/crf" },
          ]),
        }}
      />
      {children}
    </>
  );
}
