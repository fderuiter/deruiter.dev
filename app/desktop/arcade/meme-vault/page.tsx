import type { Metadata } from "next";
import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";
import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.memeVault
);

export default function MemeVaultPage() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: ROUTE_METADATA_CONFIGS.memeVault.title,
            description: ROUTE_METADATA_CONFIGS.memeVault.description,
            url: ROUTE_METADATA_CONFIGS.memeVault.path,
            applicationCategory: "GameApplication",
            genre: "Meme Soundboard & Trophy Room",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Arcade Hub", url: "/arcade" },
            { name: "Meme Vault", url: "/arcade/meme-vault" },
          ]),
        }}
      />
      <MemeVaultClient />
    </PageLayout>
  );
}
