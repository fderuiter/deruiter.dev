[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/case-study-service](../README.md) / CaseStudyService

# Class: CaseStudyService

## Constructors

### Constructor

> **new CaseStudyService**(): `CaseStudyService`

#### Returns

`CaseStudyService`

## Methods

### evictCaseStudyCache()

> `static` **evictCaseStudyCache**(`slug`): `Promise`\<`boolean`\>

Explicitly evicts a case study from the Upstash Redis read-through cache
and dispatches on-demand Next.js ISR tag revalidations.

#### Parameters

##### slug

`string`

#### Returns

`Promise`\<`boolean`\>

***

### flushBufferedReactionsToDatabase()

> `static` **flushBufferedReactionsToDatabase**(`batchSize?`): `Promise`\<[`CaseStudyReactionFlushResult`](../type-aliases/CaseStudyReactionFlushResult.md)\>

Flushes buffered reactions from Upstash Redis to Neon Postgres in batches.
Designed for execution during scheduled maintenance (ADR 0036).

Never throws: failures are returned as a typed
[CaseStudyReactionFlushErrorCode](../variables/CaseStudyReactionFlushErrorCode.md).

#### Parameters

##### batchSize?

`number` = `500`

#### Returns

`Promise`\<[`CaseStudyReactionFlushResult`](../type-aliases/CaseStudyReactionFlushResult.md)\>

***

### getAllPublishedCaseStudies()

> `static` **getAllPublishedCaseStudies**(): `Promise`\<[`CaseStudyData`](../../../case-studies-data/interfaces/CaseStudyData.md)[]\>

Retrieves all published case studies combining database records with static fallbacks.
Prioritizes live database records and seamlessly appends missing static case studies.

#### Returns

`Promise`\<[`CaseStudyData`](../../../case-studies-data/interfaces/CaseStudyData.md)[]\>

***

### getAllPublishedSlugs()

> `static` **getAllPublishedSlugs**(): `Promise`\<`string`[]\>

Retrieves all published case study slugs for static route generation and sitemaps.

#### Returns

`Promise`\<`string`[]\>

***

### getCaseStudyBySlug()

> `static` **getCaseStudyBySlug**(`slug`): `Promise`\<[`CaseStudyData`](../../../case-studies-data/interfaces/CaseStudyData.md) \| `null`\>

Retrieves a single published case study by slug.
Employs the Two-Tier Compute Shield (ADR 0036):
- Check Upstash Redis read-through cache first (`cs:slug:[slug]`, 3600s TTL).
- On cache miss or Redis error, query Prisma and populate cache.
- Fall back to static dataset (FALLBACK_CASE_STUDIES) if absent from DB.

#### Parameters

##### slug

`string`

#### Returns

`Promise`\<[`CaseStudyData`](../../../case-studies-data/interfaces/CaseStudyData.md) \| `null`\>

***

### getFeedback()

> `static` **getFeedback**(`slug`, `connectionHash`): `Promise`\<\{ `caseStudySlug`: `string`; `feedback`: `object`[]; `hasSubmitted`: `boolean`; `success`: `boolean`; `totalFeedback`: `number`; \} \| \{ `caseStudySlug`: `string`; `feedback`: `object`[]; `hasSubmitted`: `boolean`; `success`: `boolean`; `totalFeedback`: `number`; \}\>

Fetches user feedback for a given case study slug.

#### Parameters

##### slug

`string`

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `caseStudySlug`: `string`; `feedback`: `object`[]; `hasSubmitted`: `boolean`; `success`: `boolean`; `totalFeedback`: `number`; \} \| \{ `caseStudySlug`: `string`; `feedback`: `object`[]; `hasSubmitted`: `boolean`; `success`: `boolean`; `totalFeedback`: `number`; \}\>

***

### getPublishedCaseStudies()

> `static` **getPublishedCaseStudies**(): `Promise`\<[`CaseStudySearchSummary`](../type-aliases/CaseStudySearchSummary.md)[]\>

Retrieves all published case studies for public search/discovery.
Reads the `cs:search_index` Upstash cache (3600s TTL) first; on a miss it
queries only the five summary columns from Postgres, appends static
fallbacks for slugs absent from the database, and caches the result.

#### Returns

`Promise`\<[`CaseStudySearchSummary`](../type-aliases/CaseStudySearchSummary.md)[]\>

***

### getReactions()

> `static` **getReactions**(`slug`, `connectionHash`): `Promise`\<\{ `caseStudySlug`: `string`; `counts`: \{\[`key`: `string`\]: `number`; \}; `success`: `boolean`; `userReactions`: `string`[]; \}\>

Gets aggregated reactions for a case study.
Employs the Two-Tier Compute Shield (ADR 0036):
Reads cached base counts (3600s TTL) and merges uncommitted Redis write-buffer increments,
completely avoiding database queries during active browsing.

#### Parameters

##### slug

`string`

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `caseStudySlug`: `string`; `counts`: \{\[`key`: `string`\]: `number`; \}; `success`: `boolean`; `userReactions`: `string`[]; \}\>

***

### submitCaseStudy()

> `static` **submitCaseStudy**(`input`): `Promise`\<\{ `architectural_narrative`: `string`; `commands_json`: `string` \| `null`; `created_at`: `Date`; `editorial_content`: `string`; `github_url`: `string` \| `null`; `hero_image_url`: `string` \| `null`; `id`: `string`; `playback_json`: `string` \| `null`; `primary_language`: `string`; `published`: `boolean`; `simulated_telemetry`: `boolean`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \}\>

Sanitizes rich text / HTML content submissions and persists draft case study.

#### Parameters

##### input

[`CaseStudySubmissionInput`](../interfaces/CaseStudySubmissionInput.md)

#### Returns

`Promise`\<\{ `architectural_narrative`: `string`; `commands_json`: `string` \| `null`; `created_at`: `Date`; `editorial_content`: `string`; `github_url`: `string` \| `null`; `hero_image_url`: `string` \| `null`; `id`: `string`; `playback_json`: `string` \| `null`; `primary_language`: `string`; `published`: `boolean`; `simulated_telemetry`: `boolean`; `slug`: `string`; `tags`: `string`; `title`: `string`; `updated_at`: `Date`; \}\>

***

### submitFeedback()

> `static` **submitFeedback**(`input`, `connectionHash`): `Promise`\<\{ `feedback?`: `undefined`; `message`: `string`; `rateLimited`: `boolean`; `success?`: `undefined`; \} \| \{ `feedback`: \{ `caseStudySlug`: `string`; `comments`: `string`; `createdAt`: `Date`; `id`: `string`; `takeaways`: `string`[]; \}; `message`: `string`; `rateLimited`: `boolean`; `success`: `boolean`; \} \| \{ `feedback`: \{ `caseStudySlug`: `string`; `comments`: `string`; `createdAt`: `string`; `id`: `string`; `takeaways`: `string`[]; \}; `message`: `string`; `rateLimited`: `boolean`; `success`: `boolean`; \}\>

Submits feedback for a case study with duplicate rate-limiting.

#### Parameters

##### input

[`FeedbackSubmissionInput`](../interfaces/FeedbackSubmissionInput.md)

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `feedback?`: `undefined`; `message`: `string`; `rateLimited`: `boolean`; `success?`: `undefined`; \} \| \{ `feedback`: \{ `caseStudySlug`: `string`; `comments`: `string`; `createdAt`: `Date`; `id`: `string`; `takeaways`: `string`[]; \}; `message`: `string`; `rateLimited`: `boolean`; `success`: `boolean`; \} \| \{ `feedback`: \{ `caseStudySlug`: `string`; `comments`: `string`; `createdAt`: `string`; `id`: `string`; `takeaways`: `string`[]; \}; `message`: `string`; `rateLimited`: `boolean`; `success`: `boolean`; \}\>

***

### submitReaction()

> `static` **submitReaction**(`input`, `connectionHash`): `Promise`\<\{ `counts`: `Record`\<`string`, `number`\>; `reactionType`: `string`; `success`: `boolean`; `userReactions`: `string`[]; \}\>

Submits a reaction for a case study.
Employs Write-Buffering in Upstash Redis (ADR 0036):
Buffers reaction increments via HINCRBY and enqueues events without waking Neon Postgres.

#### Parameters

##### input

[`ReactionSubmissionInput`](../interfaces/ReactionSubmissionInput.md)

##### connectionHash

`string`

#### Returns

`Promise`\<\{ `counts`: `Record`\<`string`, `number`\>; `reactionType`: `string`; `success`: `boolean`; `userReactions`: `string`[]; \}\>

***

### updateCaseStudyImage()

> `static` **updateCaseStudyImage**(`slug`, `heroImageUrl`): `Promise`\<[`UpdateCaseStudyImageResult`](../type-aliases/UpdateCaseStudyImageResult.md)\>

Updates the hero image asset URL for a case study and evicts cache.

Never throws: an unknown slug resolves to `CASE_STUDY_NOT_FOUND` and a
failed database read or write to `PERSISTENCE_FAILED` (ADR 0028).

#### Parameters

##### slug

`string`

##### heroImageUrl

`string` \| `null`

#### Returns

`Promise`\<[`UpdateCaseStudyImageResult`](../type-aliases/UpdateCaseStudyImageResult.md)\>
