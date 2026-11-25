import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { getAdminAuthSession } from "@/lib/auth/admin";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { BlogAuthoringForm } from "@/components/admin/BlogAuthoringForm";
import { GetBlogPostByIdHandler } from "@/lib/services";
import { type ContentPillar } from "@/lib/blog/types";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
  title: "Edit BlogPost | Admin Authoring",
  description: "Edit, preview, and publish systems blog post.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({
  params,
}: EditBlogPostPageProps) {
  const session = await getAdminAuthSession();

  if (!session.isAdmin) {
    return (
      <PageLayout variant="standard">
        <AdminAccessDenied
          userId={session.userId}
          primaryEmail={session.primaryEmail}
          displayName={session.displayName}
        />
      </PageLayout>
    );
  }

  const { id } = await params;

  const postResult = await new GetBlogPostByIdHandler().execute({ id });

  if (!postResult.success) {
    if (postResult.error.code === "STORAGE_UNAVAILABLE") {
      logger.error(
        "Admin blog post edit page read failed:",
        postResult.error.details
      );
      return (
        <PageLayout variant="standard">
          <div
            role="alert"
            data-status="503"
            className="max-w-3xl mx-auto w-full p-8 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center flex flex-col items-center justify-center gap-2"
          >
            <p className="text-sm font-mono font-semibold text-amber-300">
              503 — Service Temporarily Unavailable
            </p>
            <p className="text-xs font-mono text-zinc-400">
              Database persistence is currently unreachable, so this blog post
              could not be loaded for editing.
            </p>
          </div>
        </PageLayout>
      );
    }
    notFound();
  }

  const post = postResult.data;

  return (
    <PageLayout variant="standard">
      <BlogAuthoringForm
        isNew={false}
        initialData={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          dek: post.dek,
          body: post.body,
          pillar: post.pillar as ContentPillar,
          tags: post.tags,
          hero_image_url: post.hero_image_url,
          published: post.published,
        }}
      />
    </PageLayout>
  );
}
