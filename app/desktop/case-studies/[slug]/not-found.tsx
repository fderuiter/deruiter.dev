"use client";

import { UnifiedErrorLayout } from "@/components/UnifiedErrorLayout";

export default function CaseStudyNotFound() {
  return (
    <UnifiedErrorLayout
      badge="CASE_NOT_FOUND"
      title="Case Study Unresolved"
      description="The requested clinical case study narrative does not exist or has not been published to the active database partition."
      secondaryActionText="Return to Core Feed"
      secondaryActionHref="/#case-studies"
      showRetroLabyrinth={true}
    />
  );
}
