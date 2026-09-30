[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/seed](../README.md) / RunOrigin

# Type Alias: RunOrigin

> **RunOrigin** = \{ `kind`: `"RANDOM"`; \} \| \{ `kind`: `"SEEDED"`; \} \| \{ `date`: `string`; `kind`: `"DAILY"`; \}

How a run's seed was chosen, for the end screen and run history.

## Union Members

### Type Literal

\{ `kind`: `"RANDOM"`; \}

***

### Type Literal

\{ `kind`: `"SEEDED"`; \}

Typed in, or opened from a challenge link.

***

### Type Literal

\{ `date`: `string`; `kind`: `"DAILY"`; \}

The Daily Protocol for a UTC date, `YYYY-MM-DD`.
