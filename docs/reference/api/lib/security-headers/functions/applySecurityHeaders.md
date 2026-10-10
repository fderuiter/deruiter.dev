[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-headers](../README.md) / applySecurityHeaders

# Function: applySecurityHeaders()

> **applySecurityHeaders**(`res`, `req?`): `NextResponse`

Applies standard HTTP security headers to a NextResponse. When `req` resolves to the admin
surface (`/admin`, `/api/admin`), the Content-Security-Policy additionally allows the
configured Clerk origin and its supporting resources; every other route — and any call
without a request context — receives the narrower public-surface policy.

## Parameters

### res

`NextResponse`

### req?

`NextRequest`

## Returns

`NextResponse`
