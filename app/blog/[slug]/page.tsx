import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllPublishedBlogPosts,
  getBlogPostBySlug,
  extractAndInjectHeadings,
  calculateRelatedReading,
  CONTENT_PILLAR_CATALOG,
} from "@/lib/blog";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { RichNarrative } from "@/components/RichNarrative";
import { BlogPostReactions } from "@/components/blog/BlogPostReactions";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { RelatedReading } from "@/components/blog/RelatedReading";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { resolveBaseUrl } from "@/lib/domain";
import { getBreadcrumbSchema, getBlogPostingSchema } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPublishedBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Dispatch Not Found",
      description: "The requested blog post was not found.",
    };
  }

  const ogImageUrl = `${resolveBaseUrl()}/blog/${slug}/opengraph-image`;

  return {
    title: `${post.title} | Blog`,
    description: post.dek,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: `${post.title} | Blog`,
      description: post.dek,
      type: "article",
      url: `${resolveBaseUrl()}/blog/${slug}`,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${post.title} | Blog`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Blog`,
      description: post.dek,
      images: [ogImageUrl],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;

  const [allPosts, post, allCaseStudies] = await Promise.all([
    getAllPublishedBlogPosts(),
    getBlogPostBySlug(slug),
    CaseStudyService.getAllPublishedCaseStudies(),
  ]);

  if (!post) {
    notFound();
  }

  const relatedItems = calculateRelatedReading(
    {
      slug: post.slug,
      pillar: post.pillar,
      tags: post.tags,
    },
    {
      posts: allPosts,
      caseStudies: allCaseStudies,
      limit: 3,
    }
  );

  const currentIndex = allPosts.findIndex((p) => p.slug === slug);
  const prevPost =
    currentIndex > 0
      ? allPosts[currentIndex - 1]
      : allPosts[allPosts.length - 1];
  const nextPost =
    currentIndex < allPosts.length - 1
      ? allPosts[currentIndex + 1]
      : allPosts[0];

  const { html: processedHtml, headings } = extractAndInjectHeadings(post.body);

  const formattedDate = post.publishedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const isUpdated =
    post.updatedAt.getTime() > post.publishedAt.getTime() + 86400000;
  const formattedUpdatedDate = isUpdated
    ? post.updatedAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  const pillarLabel = CONTENT_PILLAR_CATALOG[post.pillar]?.label || post.pillar;

  return (
    <PageLayout
      variant="standard"
      className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-zinc-950 text-foreground flex flex-col items-center relative overflow-x-clip outline-none"
    >
      <ReadingProgressBar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            { name: post.title, url: `/blog/${post.slug}` },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBlogPostingSchema(post),
        }}
      />
      {/* Background Blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-cyan/5 blur-[120px] pointer-events-none hidden sm:block" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 w-80 h-80 rounded-full bg-brand-blue/5 blur-[120px] pointer-events-none hidden sm:block" />

      <div className="relative z-10 w-full max-w-5xl">
        {/* Breadcrumbs Navigation */}
        <div className="mb-6">
          <Breadcrumbs
            items={[{ label: "Blog", href: "/blog" }, { label: post.title }]}
          />
        </div>

        {/* Content Pillar Badge */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
            <span
              className="w-1.5 h-1.5 rounded-full bg-brand-cyan"
              aria-hidden="true"
            />
            {pillarLabel}
          </span>
        </div>

        {/* Article Header */}
        <header className="w-full max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-neutral-100 mb-4 leading-tight">
            {post.title}
          </h1>

          <p className="text-lg text-muted-strong font-medium mb-6 leading-relaxed">
            {post.dek}
          </p>

          {/* Article Metadata Row */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-mono text-zinc-400 pb-6 border-b border-zinc-900/80">
            <span className="text-zinc-200 font-semibold">
              By Frederick de Ruiter
            </span>
            <span className="text-zinc-600" aria-hidden="true">
              •
            </span>
            <time dateTime={post.publishedAt.toISOString()}>
              {formattedDate}
            </time>
            {formattedUpdatedDate && (
              <>
                <span className="text-zinc-600" aria-hidden="true">
                  •
                </span>
                <span>Updated {formattedUpdatedDate}</span>
              </>
            )}
            {typeof post.readingTimeMinutes === "number" &&
              post.readingTimeMinutes > 0 && (
                <>
                  <span className="text-zinc-600" aria-hidden="true">
                    •
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    <svg
                      className="w-3.5 h-3.5 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {post.readingTimeMinutes} min read
                  </span>
                </>
              )}
          </div>
        </header>

        <div className="mt-8 grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-8">
          <aside className="blog-reader-toc-rail lg:col-start-2 lg:row-start-1">
            <TableOfContents headings={headings} />
          </aside>

          {/* Long-form Article Narrative */}
          <article className="prose prose-invert blog-prose min-w-0 max-w-none text-neutral-300 leading-relaxed lg:col-start-1 lg:row-start-1">
            <RichNarrative html={processedHtml} />

            <footer
              aria-label="Article topics"
              className="mt-10 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-5"
            >
              <span className="sr-only">Topics:</span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1 font-mono text-xs font-medium text-muted-strong"
                >
                  #{tag}
                </span>
              ))}
            </footer>
          </article>
        </div>

        {/* Reader Reactions Control */}
        <div className="mt-8 w-full max-w-3xl">
          <BlogPostReactions slug={post.slug} />

          {/* Contextual Related Dispatches & Case Studies */}
          <RelatedReading items={relatedItems} />

          {/* Sequential Next / Previous Dispatch Navigation */}
          {prevPost && nextPost && (
            <NextPrevNav
              prev={
                prevPost.slug !== slug
                  ? {
                      title: prevPost.title,
                      href: `/blog/${prevPost.slug}`,
                      label: "Previous Dispatch",
                      tag: prevPost.pillar,
                    }
                  : null
              }
              next={
                nextPost.slug !== slug
                  ? {
                      title: nextPost.title,
                      href: `/blog/${nextPost.slug}`,
                      label: "Next Dispatch",
                      tag: nextPost.pillar,
                    }
                  : null
              }
              backToHub={{
                title: "View All Dispatches",
                href: "/blog",
              }}
            />
          )}
        </div>
      </div>
    </PageLayout>
  );
}
