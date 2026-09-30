[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/blog-service](../README.md) / parseBlogPostDates

# Function: parseBlogPostDates()

> **parseBlogPostDates**(`post`): [`BlogPostDatesResult`](../type-aliases/BlogPostDatesResult.md)

Coerces created_at and updated_at on a BlogPostData record into validated
Date instances. Returns `INVALID_DATE_CONTRACT` when either date is invalid.

## Parameters

### post

[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md)

## Returns

[`BlogPostDatesResult`](../type-aliases/BlogPostDatesResult.md)
