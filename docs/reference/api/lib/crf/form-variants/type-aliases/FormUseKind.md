[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/form-variants](../README.md) / FormUseKind

# Type Alias: FormUseKind

> **FormUseKind** = `"visit_default"` \| `"arm_override"` \| `"arm_inherited"`

How a visit schedule reaches a form.

- `visit_default`: the visit's own `assignedFormIds` (or legacy `formIds`)
  list it. Arms without their own assignment for the visit follow this list.
- `arm_override`: the visit's arm-specific assignment for one arm lists it.
- `arm_inherited`: an arm applicable to the visit has no arm-specific
  assignment there, so it collects the form through the visit default.
