[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/best-time](../README.md) / PAR\_SECONDS

# Variable: PAR\_SECONDS

> `const` **PAR\_SECONDS**: `Readonly`\<`Record`\<`"standard"` \| `"relaxed"`, `number`\>\>

Par for the default plan on the standard day, in level seconds, by timer.

Calibrated against the scripted solo player in the assist tests (the solo
helper's goal policy at full pace, pressing interact once per press, Abbi
idle, no helper, staying when the brothers call). On the default plan with
seed 0 it finishes at 110.9 s on the standard clock and 110.3 s on the
relaxed clock: the work takes the same real seconds, the relaxed clock just
has more of them. That player never hesitates, so its time is close to the
best a person can do alone.

The standard par is that time rounded up to the next 10 s: 120 s, which
reads 1:12 on the clock and leaves about 9 s of slack for a person's
reaction time. The relaxed clock is for players who asked for more time, so
its par is half again the scripted time, rounded up to the next 10 s: 170 s,
which reads 12:36 on the longer clock.

A pair in co-op, or a solo player with the helper, can beat either par
comfortably. The par is set for one person playing alone.
