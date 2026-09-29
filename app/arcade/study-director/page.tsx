import type { Metadata } from "next";
import { StudyDirectorClient } from "@/components/arcade/StudyDirectorClient";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.studyDirector
);

export default function StudyDirectorPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.studyDirector.title,
            description: ROUTE_METADATA_CONFIGS.studyDirector.description,
            url: ROUTE_METADATA_CONFIGS.studyDirector.path,
            applicationCategory: "GameApplication",
            genre: "Management Simulation",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            {
              name: "Study Director: Everything Is Fine",
              url: "/arcade/study-director",
            },
          ]),
        }}
      />
      <StudyDirectorClient />
    </PageLayout>
  );
}
