import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { getAdminAuthSession } from "@/lib/auth/admin";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { BlogAuthoringForm } from "@/components/admin/BlogAuthoringForm";
import { GetAdminBlogPostByIdHandler } from "@/lib/services";
import { type ContentPillar } from "@/lib/blog/types";
import { IntentLink } from "@/components/ui/IntentLink";

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

  const postResult = await new GetAdminBlogPostByIdHandler().execute({ id });

  if (!postResult.success) {
    if (
      postResult.error.code === "BLOG_POST_NOT_FOUND" ||
      postResult.error.code === "INVALID_BLOG_POST_ID"
    ) {
      notFound();
    }

    return (
      <PageLayout variant="standard">
        <div
          role="alert"
          className="max-w-3xl mx-auto w-full rounded-lg border border-rose-500/30 bg-rose-500/10 p-6 font-mono text-zinc-100 flex flex-col gap-3"
        >
          <h1 className="text-lg font-semibold text-rose-300">
            Blog Storage Temporarily Unavailable
          </h1>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Database storage could not be reached while loading draft{" "}
            <span className="text-zinc-100 font-semibold">{id}</span>. Your post
            has not been deleted — reload this page once database connectivity
            recovers.
          </p>
          <div>
            <IntentLink
              href="/admin/blog"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-white/10 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>&larr; Return to Blog Console</span>
            </IntentLink>
          </div>
        </div>
      </PageLayout>
    );
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
