import type { Metadata } from "next";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getWebApplicationSchema, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.schedule
);

export default function ScheduleLayout({
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
            name: "Book a Coffee Chat or Tech Talk | Frederick de Ruiter",
            description:
              "Book a 30-minute Google Meet with Frederick de Ruiter to talk through clinical software, side projects, or an open-source idea.",
            url: "/schedule",
            applicationCategory: "MultimediaApplication",
            genre: "Technical Discussion Scheduler",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Connect", url: "/#contact" },
            { name: "Say Hi & Book a Chat", url: "/schedule" },
          ]),
        }}
      />
      {children}
    </>
  );
}
