import { createHash } from "node:crypto";
import { prisma } from "../lib/db";
import { sanitizeContentHtml } from "../lib/content-sanitizer";
import { EvictBlogPostCacheHandler } from "../lib/services";
import {
  FALLBACK_BLOG_POSTS,
  type BlogPostData,
} from "../lib/fallback-blog-posts";

export interface SyncOptions {
  commit?: boolean;
  silent?: boolean;
  customPosts?: BlogPostData[];
  prismaClient?: typeof prisma;
  /** Evicts the Redis read-through cache and ISR page for a written slug. */
  evictCache?: (slug: string) => Promise<unknown>;
}

export interface SyncItemResult {
  slug: string;
  action: "create" | "update" | "unchanged" | "error";
  localMd5: string;
  dbMd5?: string;
  reason?: string;
}

export interface SyncReport {
  mode: "dry-run" | "commit";
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  details: SyncItemResult[];
}

/**
 * Calculates a deterministic MD5 hash across the content and metadata fields of a blog post.
 */
export function calculatePostMd5(post: {
  title: string;
  dek: string;
  body: string;
  pillar: string;
  tags: string;
  reading_time_minutes?: number | null;
  published?: boolean | null;
  hero_image_url?: string | null;
}): string {
  const payload = [
    post.title.trim(),
    post.dek.trim(),
    post.body.trim(),
    post.pillar.trim(),
    post.tags.trim(),
    post.reading_time_minutes ?? "",
    post.published ?? "",
    post.hero_image_url ?? "",
  ].join(":::");

  return createHash("md5").update(payload, "utf8").digest("hex");
}

/**
 * Synchronizes local audited blog post content into Neon PostgreSQL BlogPost rows.
 * Defaults to dry-run mode unless `commit: true` is explicitly passed.
 */
export async function syncBlogPosts(
  options: SyncOptions = {}
): Promise<SyncReport> {
  const isCommit = Boolean(options.commit);
  const isSilent = Boolean(options.silent);
  const posts = options.customPosts ?? FALLBACK_BLOG_POSTS;
  const db = options.prismaClient ?? prisma;
  const evictCache =
    options.evictCache ??
    ((slug: string) => new EvictBlogPostCacheHandler().execute({ slug }));

  const report: SyncReport = {
    mode: isCommit ? "commit" : "dry-run",
    total: posts.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  const log = (...args: unknown[]) => {
    if (!isSilent) {
      console.log(...args);
    }
  };

  log(
    `\n=== Blog Content Database Synchronization (${report.mode.toUpperCase()}) ===`
  );
  log(`Scanning ${posts.length} audited dispatches...\n`);

  for (const rawPost of posts) {
    // Store bodies through the same sanitizer every other write path uses,
    // and hash the sanitized form so it compares equal to what is stored.
    const post = { ...rawPost, body: sanitizeContentHtml(rawPost.body) };
    const localMd5 = calculatePostMd5(post);

    try {
      const existing = await db.blogPost.findUnique({
        where: { slug: post.slug },
      });

      if (!existing) {
        if (isCommit) {
          await db.blogPost.create({
            data: {
              slug: post.slug,
              title: post.title,
              dek: post.dek,
              body: post.body,
              pillar: post.pillar,
              tags: post.tags,
              published: post.published,
              reading_time_minutes: post.reading_time_minutes,
              hero_image_url: post.hero_image_url,
              created_at: new Date(post.created_at),
              updated_at: new Date(post.updated_at),
            },
          });
          await evictCache(post.slug);
          log(`  [CREATED]  ${post.slug} (MD5: ${localMd5})`);
        } else {
          log(`  [WOULD CREATE] ${post.slug} (MD5: ${localMd5})`);
        }

        report.created++;
        report.details.push({
          slug: post.slug,
          action: "create",
          localMd5,
        });
      } else {
        const dbMd5 = calculatePostMd5(existing);

        if (dbMd5 === localMd5) {
          log(`  [UNCHANGED] ${post.slug} (MD5: ${localMd5})`);
          report.unchanged++;
          report.details.push({
            slug: post.slug,
            action: "unchanged",
            localMd5,
            dbMd5,
          });
        } else {
          if (isCommit) {
            await db.blogPost.update({
              where: { slug: post.slug },
              data: {
                title: post.title,
                dek: post.dek,
                body: post.body,
                pillar: post.pillar,
                tags: post.tags,
                published: post.published,
                reading_time_minutes: post.reading_time_minutes,
                hero_image_url: post.hero_image_url,
                updated_at: new Date(),
              },
            });
            await evictCache(post.slug);
            log(
              `  [UPDATED]  ${post.slug} (Local: ${localMd5}, DB was: ${dbMd5})`
            );
          } else {
            log(
              `  [WOULD UPDATE] ${post.slug} (Local: ${localMd5}, DB is: ${dbMd5})`
            );
          }

          report.updated++;
          report.details.push({
            slug: post.slug,
            action: "update",
            localMd5,
            dbMd5,
          });
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`  [ERROR]    ${post.slug}: ${errorMessage}`);
      report.errors++;
      report.details.push({
        slug: post.slug,
        action: "error",
        localMd5,
        reason: errorMessage,
      });
    }
  }

  log(`\n--- Summary ---`);
  log(`Mode:      ${report.mode.toUpperCase()}`);
  log(`Total:     ${report.total}`);
  log(`Created:   ${report.created}`);
  log(`Updated:   ${report.updated}`);
  log(`Unchanged: ${report.unchanged}`);
  log(`Errors:    ${report.errors}\n`);

  if (!isCommit && (report.created > 0 || report.updated > 0)) {
    log(
      `ℹ️  To write changes to the database, run with: npx tsx scripts/sync-blog-posts.ts --commit\n`
    );
  }

  return report;
}

// Direct CLI invocation
if (
  process.argv[1]?.endsWith("sync-blog-posts.ts") ||
  process.argv[1]?.endsWith("sync-blog-posts.js")
) {
  const commit = process.argv.includes("--commit");
  syncBlogPosts({ commit })
    .then((report) => {
      if (report.errors > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal sync error:", err);
      process.exit(1);
    });
}
