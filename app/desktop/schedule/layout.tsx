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
            name: "Schedule 1:1 Systems Consultation | Frederick de Ruiter",
            description:
              "Book a direct 1:1 technical sync or systems architecture consultation on Google Calendar with Principal Systems Engineer Frederick de Ruiter.",
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
