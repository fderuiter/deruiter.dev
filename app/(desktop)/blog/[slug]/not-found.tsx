"use client";

import { UnifiedErrorLayout } from "@/components/UnifiedErrorLayout";

export default function BlogPostNotFound() {
  return (
    <UnifiedErrorLayout
      badge="DISPATCH_NOT_FOUND"
      title="Dispatch Unresolved"
      description="The requested blog post does not exist or has not been published yet."
      secondaryActionText="Return to Blog"
      secondaryActionHref="/blog"
      showRetroLabyrinth={true}
    />
  );
}
