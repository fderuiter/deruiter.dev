import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { getAdminAuthSession } from "@/lib/auth/admin";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { prisma } from "@/lib/db";
import {
  IconPlus,
  IconEdit,
  IconLockCheck,
  IconFileText,
  IconCheck,
  IconClock,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "Blog Authoring & Dispatches | Admin",
  description: "Manage, draft, preview, and publish systems blog posts.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

/* jscpd:ignore-start */
export default async function AdminBlogPage() {
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

  let posts: Array<{
    id: string;
    slug: string;
    title: string;
    pillar: string;
    published: boolean;
    created_at: Date;
    updated_at: Date;
  }> = [];

  try {
    posts = await prisma.blogPost.findMany({
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    });
  } catch {
    posts = [];
  }

  return (
    <PageLayout variant="standard">
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400">
              <IconLockCheck className="w-4 h-4" aria-hidden="true" />
              <span>AUTHENTICATED AUTHOR SESSION</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
              <IconFileText
                className="w-8 h-8 text-amber-500"
                aria-hidden="true"
              />
              <span>Blog Authoring Console</span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Draft, preview, and publish technical dispatches with shared HTML
              sanitization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/blog/new"
              className="px-4 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"
            >
              <IconPlus className="w-4 h-4" />
              <span>Draft New Post</span>
            </Link>
          </div>
        </header>

        {/* Blog Post Inventory Table */}
        <div className="rounded-lg border border-white/10 bg-[#0d0e11] overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-[#13151a] flex items-center justify-between">
            <h2 className="text-sm font-mono font-semibold text-zinc-200">
              Persisted Blog Posts & Drafts ({posts.length})
            </h2>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
              <p className="text-sm font-mono text-zinc-400">
                No blog posts or drafts found in database persistence.
              </p>
              <Link
                href="/admin/blog/new"
                className="px-4 py-2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono text-xs hover:bg-amber-500/30 transition-colors"
              >
                Create your first draft
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#13151a] text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Title & Slug</th>
                    <th className="p-3">Pillar</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Updated</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-zinc-100">
                          {post.title}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          /blog/{post.slug}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                          {post.pillar}
                        </span>
                      </td>
                      <td className="p-3">
                        {post.published ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <IconCheck className="w-3 h-3" />
                            <span>PUBLISHED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <IconClock className="w-3 h-3" />
                            <span>DRAFT</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-400">
                        {new Date(post.updated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/blog/${post.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-white/5 transition-colors"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
/* jscpd:ignore-end */
}
