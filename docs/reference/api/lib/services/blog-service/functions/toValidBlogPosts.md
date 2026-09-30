[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/services/blog-service](../README.md) / toValidBlogPosts

# Function: toValidBlogPosts()

> **toValidBlogPosts**(`items`): [`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md)[]

Validates candidate records and returns the valid ones with coerced dates,
preserving input order. Records failing either check are dropped.

## Parameters

### items

readonly `unknown`[]

## Returns

[`BlogPostData`](../../../fallback-blog-posts/interfaces/BlogPostData.md)[]
