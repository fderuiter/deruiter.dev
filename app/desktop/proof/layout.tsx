import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.proof
);

export default function ProofLayout({
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
            name: "Logical Proof Workspace | Interactive Formal Verification",
            description:
              "Interactive deductive logic workspace with live graph visualization, dual-mode CLI terminal, proof branch verification, and theorem validation.",
            url: "/proof",
            applicationCategory: "EducationalApplication",
            genre: "Formal Verification Logic Workspace",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Logical Proof Workspace", url: "/proof" },
          ]),
        }}
      />
      {children}
    </>
  );
}
