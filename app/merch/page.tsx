import type { Metadata } from "next";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { getBreadcrumbSchema } from "@/lib/seo";
import { MerchView } from "@/components/merch/MerchView";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.merch
);

export default function MerchPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden pt-28 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Laser Loon Merch", url: "/merch" },
          ]),
        }}
      />
      <MerchView />
    </div>
  );
}
