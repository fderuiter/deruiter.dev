import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.neuro
);

export default function NeuroLayout({
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
            name: "NeuroRecon: FreeSurfer Pipeline Simulator & QA Studio",
            description:
              "Interactive neuroimaging CAD workspace: repair 3D cortical surfaces, place intensity control points, resolve topological Euler defects, and slice 2D MRI orthoviews.",
            url: "/neuro",
            applicationCategory: "EducationalApplication",
            genre: "Neuroimaging Post-Processing Simulator",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Systems", url: "/#about" },
            { name: "NeuroRecon Studio", url: "/neuro" },
          ]),
        }}
      />
      {children}
    </>
  );
}
