[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/a11y/announcer](../README.md) / LiveAnnouncerOptions

# Interface: LiveAnnouncerOptions

## Properties

### expirationMs?

> `optional` **expirationMs?**: `number`

Auto-expiration timeout duration in milliseconds for active announcements.
Defaults to 3000ms.

***

### minPoliteDwellMs?

> `optional` **minPoliteDwellMs?**: `number`

Minimum time in milliseconds a polite announcement stays in the live region
before a newer polite announcement replaces it. Without a newer one waiting,
the announcement stays for the full expiration.
Defaults to 1000ms and is clamped to the expiration timeout.

***

### sanitizePII?

> `optional` **sanitizePII?**: `boolean`

Whether to sanitize sensitive personal identifiers such as SSNs.
Defaults to true.
