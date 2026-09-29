[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/qstash-retry](../README.md) / QSTASH\_RETRY\_DELAYS\_SECONDS

# Variable: QSTASH\_RETRY\_DELAYS\_SECONDS

> `const` **QSTASH\_RETRY\_DELAYS\_SECONDS**: readonly `number`[]

Delay, in seconds, before each successive QStash-driven retry: 5 minutes,
15 minutes, then 1 hour. The last entry repeats. Attempts are bounded by the
queue's own retry ceiling, so one email costs at most a handful of the 500
free-tier messages per day (ADR 0036).
