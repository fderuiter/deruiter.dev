[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/security-headers](../README.md) / buildContentSecurityPolicy

# Function: buildContentSecurityPolicy()

> **buildContentSecurityPolicy**(`admin`, `wasm?`): `string`

Builds the Content-Security-Policy for the public or admin surface.

The policy is identical for every request, so `next.config.ts` serves it in
front of static and ISR pages. A per-request nonce made the root layout read
request headers, which rendered every page on demand and spent Vercel
function CPU on each view (#1900). Without a nonce, the inline bootstrap
scripts Next.js emits need `'unsafe-inline'`; script sources stay limited to
this origin and the named hosts.

## Parameters

### admin

`boolean`

Whether the policy is for the admin surface, which also
  allows the configured Clerk origin.

### wasm?

`boolean` = `false`

Whether the policy also allows WebAssembly compilation
  (`'wasm-unsafe-eval'`), which `WASM_POLICY_SOURCES` lists the paths for.
  It lets the page compile WebAssembly and never lets it evaluate
  JavaScript.

## Returns

`string`
