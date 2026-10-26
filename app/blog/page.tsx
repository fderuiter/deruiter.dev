import type { Metadata } from "next";
import Link from "next/link";
import { getAllPublishedBlogPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { getBreadcrumbSchema } from "@/lib/seo";

// Daily: each regeneration bills Vercel active CPU, and content writes
// revalidate these paths on demand, so the timer is only a backstop (#2971).
export const revalidate = 86400;

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.blog
);

export default async function BlogIndexPage() {
  const posts = await getAllPublishedBlogPosts();

  return (
    <PageLayout
      variant="standard"
      className="relative bg-zinc-950 text-foreground outline-none"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
          ]),
        }}
      />

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Navigation Breadcrumb */}
        <div className="w-full mb-6 sm:mb-8 flex justify-start">
          <Breadcrumbs items={[{ label: "Blog" }]} />
        </div>

        {/* Page Header */}
        <div className="text-center max-w-3xl mb-10 sm:mb-14">
          <h1 className="type-display font-mono text-white mb-3">
            Engineering Dispatches
          </h1>
          <p className="text-xs sm:text-sm font-mono text-zinc-400 tracking-wider uppercase">
            Cross-project retrospectives, technique write-ups, and field notes.
          </p>
        </div>

        {/* Dispatch Grid */}
        {posts.length === 0 ? (
          <div className="text-center p-8 sm:p-12 bg-zinc-900/10 border border-zinc-900/40 border-dashed rounded-2xl w-full">
            <p className="text-sm text-zinc-400 italic mb-2">
              No dispatches published yet.
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              The first posts are on the way. In the meantime, the{" "}
              <Link
                href="/case-studies"
                className="text-accent hover:underline"
              >
                case studies
              </Link>{" "}
              cover the same engineering in more depth.
            </p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block p-6 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl hover:border-accent/40 transition-colors"
              >
                <h2 className="text-lg font-bold text-neutral-100 mb-2">
                  {post.title}
                </h2>
                <p className="text-sm text-zinc-400">{post.dek}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
