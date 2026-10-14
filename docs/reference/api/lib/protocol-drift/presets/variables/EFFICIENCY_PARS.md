[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/protocol-drift/presets](../README.md) / EFFICIENCY\_PARS

# Variable: EFFICIENCY\_PARS

> `const` **EFFICIENCY\_PARS**: `Readonly`\<`Record`\<[`EfficiencyMetricId`](../../types/type-aliases/EfficiencyMetricId.md), [`EfficiencyPar`](../../types/interfaces/EfficiencyPar.md)\>\>

Efficiency pars (#2054), calibrated from the reference solve: the scripted
careful playthrough in the test helpers, which publishes WAVE1_GRAPH, then
FULL_GRAPH (13 chips, 21 wires), dispositions every issue with evidence and
locks on Day 28 with no rejected commands and no fabricated precision. A
calibration test replays that solve and fails if the engine drifts from
these numbers. Each measure is worth 100 points at par, gains or loses
pointsPerUnit for each unit under or over, and stays between 0 and 150.
