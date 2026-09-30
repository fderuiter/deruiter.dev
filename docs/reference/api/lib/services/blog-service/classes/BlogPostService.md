[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/blog-service](../README.md) / BlogPostService

# Class: BlogPostService

## Constructors

### Constructor

> **new BlogPostService**(): `BlogPostService`

#### Returns

`BlogPostService`

## Methods

### createDraftBlogPost()

> `static` **createDraftBlogPost**(`input`): `Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \}\>

Persists an unpublished blog draft using server-owned publication state.
The existing public cache is evicted only after Prisma confirms creation.

#### Parameters

##### input

[`CreateBlogDraftInput`](../interfaces/CreateBlogDraftInput.md)

#### Returns

`Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \}\>

***

### deleteBlogPost()

> `static` **deleteBlogPost**(`id`): `Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

Deletes a persisted blog post or draft by ID and evicts associated caches.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

***

### evictBlogPostCache()

> `static` **evictBlogPostCache**(`slug`): `Promise`\<`boolean`\>

Explicitly evicts a blog post from the Upstash Redis read-through cache
and dispatches on-demand Next.js ISR path revalidations for rendered routes
(`/blog`, `/blog/[slug]`) and associated cache tags.

Admin draft creation and editing invoke this after confirmed persistence.

#### Parameters

##### slug

`string`

The unique URL slug of the blog post to evict.

#### Returns

`Promise`\<`boolean`\>

True if the Redis cache keys were successfully deleted; false if Redis
         was unconfigured, timed out, or encountered a deletion error.

***

### flushBufferedReactionsToDatabase()

> `static` **flushBufferedReactionsToDatabase**(`batchSize?`): `Promise`\<[`BlogReactionFlushResult`](../type-aliases/BlogReactionFlushResult.md)\>

Flushes buffered blog post reactions from Upstash Redis to Neon Postgres in batches.
Executed during scheduled maintenance.

Never throws: failures are returned as a typed
[BlogReactionFlushErrorCode](../variables/BlogReactionFlushErrorCode.md).

#### Parameters

##### batchSize?

`number` = `500`

#### Returns

`Promise`\<[`BlogReactionFlushResult`](../type-aliases/BlogReactionFlushResult.md)\>

***

### getAllPublishedBlogPosts()

> `static` **getAllPublishedBlogPosts**(): `Promise`\<[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md)[]\>

Retrieves all published blog posts combining database records with
static fallbacks. Employs the Two-Tier Cache Shield (ADR 0036, ADR 0041):
Redis read-through cache first, then Neon, then the static `FALLBACK_BLOG_POSTS`
safety net so a database outage never breaks the `/blog` index or the sitemap.

Guarantees:
- Empty lists are cached with bounded TTL to avoid repeated database reads.
- Unpublished drafts in DB or cache are never exposed.
- Published DB records take precedence over same-slug fallbacks.
- Resulting list is strictly ordered newest-first by creation timestamp.

#### Returns

`Promise`\<[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md)[]\>

***

### getBlogPostById()

> `static` **getBlogPostById**(`id`): `Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

Retrieves a persisted blog post by ID (published or draft) for admin inspection.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

***

### getBlogPostBySlug()

> `static` **getBlogPostBySlug**(`slug`): `Promise`\<[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md) \| `null`\>

Retrieves a single published blog post by slug.
Employs the Two-Tier Cache Shield (ADR 0036):
- Check Upstash Redis read-through cache first (`blog:slug:[slug]`, 3600s TTL).
- On cache miss or Redis error, query Prisma and populate cache.
- Fall back to the static `FALLBACK_BLOG_POSTS` dataset only if absent from DB.
- If a record exists in DB with `published === false`, returns `null` (draft precedence).

#### Parameters

##### slug

`string`

#### Returns

`Promise`\<[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md) \| `null`\>

***

### getDraftBlogPostById()

> `static` **getDraftBlogPostById**(`id`): `Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

Retrieves a persisted unpublished draft for an authorized admin item read.
Static public fallbacks are deliberately excluded from this private workflow.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

***

### getDraftBlogPosts()

> `static` **getDraftBlogPosts**(`__namedParameters`): `Promise`\<\{ `drafts`: `object`[]; `total`: `number`; \}\>

Retrieves only persisted unpublished drafts for the authenticated admin
collection. This intentionally never consults the public fallback data.

#### Parameters

##### \_\_namedParameters

[`BlogDraftPagination`](../interfaces/BlogDraftPagination.md)

#### Returns

`Promise`\<\{ `drafts`: `object`[]; `total`: `number`; \}\>

***

### getReactions()

> `static` **getReactions**(`slug`, `connectionHash`): `Promise`\<\{ `blogPostSlug`: `string`; `counts`: \{\[`key`: `string`\]: `number`; \}; `success`: `boolean`; `userReactions`: `string`[]; \}\>

Gets aggregated reactions for a blog post.
Employs Two-Tier Compute Shield:
Reads cached base counts (3600s TTL) and merges uncommitted Redis write-buffer increments,
completely avoiding database queries during active browsing.

#### Parameters

##### slug

`string`

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `blogPostSlug`: `string`; `counts`: \{\[`key`: `string`\]: `number`; \}; `success`: `boolean`; `userReactions`: `string`[]; \}\>

***

### hydrateBlogReactionCounts()

> `static` **hydrateBlogReactionCounts**(`slug`): `Promise`\<`Record`\<`string`, `number`\>\>

Hydrates the authoritative base reaction counts in Upstash Redis from Postgres.
Executed during scheduled maintenance or database seeding when Postgres is awake.
Never invoked on the public visitor read path per ADR 0043 §3.

#### Parameters

##### slug

`string`

#### Returns

`Promise`\<`Record`\<`string`, `number`\>\>

***

### submitReaction()

> `static` **submitReaction**(`input`, `connectionHash`): `Promise`\<\{ `counts?`: `Record`\<`string`, `number`\>; `duplicate?`: `boolean`; `message?`: `string`; `notFound?`: `boolean`; `reactionType?`: `string`; `success`: `boolean`; `userReactions?`: `string`[]; \}\>

Submits a reaction for a published blog post.
Buffers reaction increments via HINCRBY in Upstash Redis without waking Neon Postgres.

#### Parameters

##### input

[`BlogPostReactionSubmissionInput`](../interfaces/BlogPostReactionSubmissionInput.md)

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `counts?`: `Record`\<`string`, `number`\>; `duplicate?`: `boolean`; `message?`: `string`; `notFound?`: `boolean`; `reactionType?`: `string`; `success`: `boolean`; `userReactions?`: `string`[]; \}\>

***

### updateDraftBlogPost()

> `static` **updateDraftBlogPost**(`id`, `input`): `Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>

Applies a partial edit to a blog post or draft. Handles publishing state transitions.
Cache eviction runs only after persistence returns the updated record.

#### Parameters

##### id

`string`

##### input

[`UpdateBlogDraftInput`](../interfaces/UpdateBlogDraftInput.md)

#### Returns

`Promise`\<\{ `body`: `string`; `created_at`: `Date`; `dek`: `string`; `hero_image_url`: `string` \| `null`; `id`: `string`; `pillar`: `string`; `published`: `boolean`; `reading_time_minutes`: `number` \| `null`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \} \| `null`\>
