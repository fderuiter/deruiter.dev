import type { Metadata } from "next";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
import { StackOverviewView } from "@/components/stack/StackOverviewView";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.stack
);

export default function StackPage() {
  return (
    <div className="min-h-screen pt-28 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.stack.title,
            description: ROUTE_METADATA_CONFIGS.stack.description,
            url: ROUTE_METADATA_CONFIGS.stack.path,
            applicationCategory: "DeveloperApplication",
            genre: "Systems Architecture Blueprint",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Systems", url: "/#case-studies" },
            { name: "Under the Hood (Stack)", url: "/stack" },
          ]),
        }}
      />
      <StackOverviewView />
    </div>
  );
}
