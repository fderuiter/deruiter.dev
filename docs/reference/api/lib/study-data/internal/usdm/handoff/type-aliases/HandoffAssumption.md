[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/usdm/handoff](../README.md) / HandoffAssumption

# Type Alias: HandoffAssumption

> **HandoffAssumption** = `"single-arm"` \| `"epochs-from-study-day"` \| `"elements-per-epoch"`

A design element the run supplies because the study does not define it:
`single-arm` adds one Experimental Arm, `epochs-from-study-day` adds
Screening and Treatment epochs and places each visit by its planned study
day (before Day 1 is Screening), and `elements-per-epoch` adds one element
per epoch and the study cells joining them to the arms, so the trial design
domains have rows.
