[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportVisual

# Type Alias: ReportVisual

> **ReportVisual** = `"bar"` \| `"line"` \| `"stat"` \| `"table"`

How a report shows its numbers. Every visual also renders its data as a
table.

- `bar`: one bar per value of the one grouped dimension, a bar per metric;
- `line`: one line per metric over `month`;
- `stat`: one number per metric, ungrouped;
- `table`: a table only, grouped by up to two dimensions.
