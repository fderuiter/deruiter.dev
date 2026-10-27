[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / HCE\_HIERARCHY

# Variable: HCE\_HIERARCHY

> `const` **HCE\_HIERARCHY**: readonly \[\{ `better`: `"higher"`; `kind`: `"time-to-event"`; `label`: `"Death from any cause"`; `paramcd`: `"HCEDTH"`; `rule`: `"a later death, or no death, is better"`; \}, \{ `better`: `"higher"`; `kind`: `"time-to-event"`; `label`: `"First serious TEAE"`; `paramcd`: `"HCESAE"`; `rule`: `"a later first serious TEAE, or none, is better"`; \}, \{ `better`: `"higher"`; `kind`: `"time-to-event"`; `label`: `"First rescue medication"`; `paramcd`: `"HCERESC"`; `rule`: `"later first rescue medication, or none, is better"`; \}, \{ `better`: `"lower"`; `kind`: `"continuous"`; `label`: `"SBP change from baseline at Week 12"`; `margin`: `5`; `paramcd`: `"HCESBP"`; `rule`: `"a larger fall is better, and differences of 5 mmHg or less tie"`; \}\]

The DEMO-301 hierarchical composite, most important component first, as
the analysis compares it: the ADHCE parameter, which values are better,
and the margin within which two values tie.
