import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { getAdminAuthSession } from "@/lib/auth/admin";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { BlogAuthoringForm } from "@/components/admin/BlogAuthoringForm";
import { BlogPostService } from "@/lib/services/blog-service";
import { type ContentPillar } from "@/lib/blog/types";

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

  const post = await BlogPostService.getBlogPostById(id);

  if (!post) {
    notFound();
  }

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
