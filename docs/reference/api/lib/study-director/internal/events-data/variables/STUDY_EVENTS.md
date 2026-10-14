[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events-data](../README.md) / STUDY\_EVENTS

# Variable: STUDY\_EVENTS

> `const` **STUDY\_EVENTS**: [`StudyEvent`](../../../types/interfaces/StudyEvent.md)[]

The slice's events, in roughly the order a study would meet them. Each run
deals a deck of them (#2093): core events always, a share of the rest, each
on a day drawn from a window around the day it was written for. Triggered
ones appear when the study's own state calls for them too; follow-ups only
appear when an earlier choice schedules them. Every message is fictional.
