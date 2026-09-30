[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/a11y/announcer](../README.md) / Priority

# Type Alias: Priority

> **Priority** = `"polite"` \| `"assertive"`

Pure LiveAnnouncer Engine & State Machine

Provides a framework-agnostic, zero-React queue management engine for screen reader live region announcements:
- Bounded polite queuing: the newest waiting status update supersedes older ones
- Assertive preemption for critical alerts
- Deterministic auto-expiration timers
- PII masking for Social Security Numbers and sensitive identifiers
- Snapshot subscriptions compatible with useSyncExternalStore
