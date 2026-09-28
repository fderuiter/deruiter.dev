import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.contact
);

export default function ContactLayout({
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
            name: ROUTE_METADATA_CONFIGS.contact.title,
            description: ROUTE_METADATA_CONFIGS.contact.description,
            url: ROUTE_METADATA_CONFIGS.contact.path,
            applicationCategory: "DeveloperApplication",
            genre: "Contact & Direct Inquiries Channel",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Contact & Direct Inquiries", url: "/contact" },
          ]),
        }}
      />
      {children}
    </>
  );
}
