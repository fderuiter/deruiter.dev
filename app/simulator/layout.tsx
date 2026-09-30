import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.simulator
);

export default function SimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: "Architectural Archetype & Incident Triage Simulator",
            description:
              "Interactive decision tree: choose an architecture bias, triage a production outage, review an async pipeline, and see which architectural archetype your trade-offs map to.",
            url: "/simulator",
            applicationCategory: "EducationalApplication",
            genre: "Architecture Decision Simulator",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Systems", url: "/#case-studies" },
            { name: "Incident Simulator", url: "/simulator" },
          ]),
        }}
      />
      {children}
    </>
  );
}
