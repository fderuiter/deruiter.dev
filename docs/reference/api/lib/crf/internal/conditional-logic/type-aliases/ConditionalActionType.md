[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / ConditionalActionType

# Type Alias: ConditionalActionType

> **ConditionalActionType** = `"show_field"` \| `"hide_field"` \| `"require_field"`

The rule actions this runtime resolves. `raise_query` and `set_value` are
deliberately excluded: they do not participate in visibility or
requiredness, and the simulator already handles queries separately.
