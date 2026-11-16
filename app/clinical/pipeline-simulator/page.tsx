import type { Metadata } from "next";
import { ClinicalJourneyNav } from "@/components/clinical-journey/ClinicalJourneyNav";
import { ProtocolDriftClient } from "@/components/arcade/ProtocolDriftClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { PIPELINE_SIMULATOR_PATH } from "@/lib/clinical-tools/pipeline-simulator";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.protocolDrift
);

export default function ProtocolDriftPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.protocolDrift.title,
            description: ROUTE_METADATA_CONFIGS.protocolDrift.description,
            url: ROUTE_METADATA_CONFIGS.protocolDrift.path,
            applicationCategory: "SimulationApplication",
            genre: "Systems Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema(PIPELINE_SIMULATOR_PATH)
          ),
        }}
      />
      <div className="mx-auto mb-4 w-full max-w-[1600px]">
        <ClinicalJourneyNav path={PIPELINE_SIMULATOR_PATH} variant="compact" />
      </div>
      <ProtocolDriftClient />
    </PageLayout>
  );
}
