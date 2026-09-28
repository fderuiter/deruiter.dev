import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.patrol
);

export default function PatrolLayout({
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
            name: "Patrol Shift Studio: Midwest Ski Patrol Simulator",
            description:
              "A Midwest ski-patrol operational judgment simulation and state machine foundation.",
            url: "/patrol",
            applicationCategory: "SimulationApplication",
            genre: "Ski Patrol Operational Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Systems", url: "/#about" },
            { name: "Patrol Shift", url: "/patrol" },
          ]),
        }}
      />
      {children}
    </>
  );
}
