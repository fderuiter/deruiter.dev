[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-headers](../README.md) / securityHeaderRules

# Function: securityHeaderRules()

> **securityHeaderRules**(): [`SecurityHeaderRule`](../interfaces/SecurityHeaderRule.md)[]

Header rules for `next.config.ts`, so every route, including static and ISR
pages the proxy never runs on, receives the security headers. The admin rules
come last because Next.js lets a later rule override the same header key.

## Returns

[`SecurityHeaderRule`](../interfaces/SecurityHeaderRule.md)[]
