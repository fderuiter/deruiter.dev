[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / CONDITIONAL\_PRECEDENCE\_NOTES

# Variable: CONDITIONAL\_PRECEDENCE\_NOTES

> `const` **CONDITIONAL\_PRECEDENCE\_NOTES**: readonly \[`"hide_field overrides show_field when both fire for the same field"`, `"a hidden field is never required, and its declared requiredness is preserved"`, `"require_field only adds requiredness; it never removes it"`, `"only a true result applies an action; false, missing and incompatible do not"`, `"values on hidden fields are retained, never cleared"`\]

Precedence, stated once so both the runtime and its tests agree.

- Hide beats show. When a `hide_field` rule and a `show_field` rule both
  fire for the same field, the field is hidden. Concealment is the
  protocol-preserving outcome: a rule written to withhold a question should
  not be defeated by a broader rule written to reveal it.
- Hidden implies not required. A mandatory control the investigator cannot
  see would make the form unsubmittable with no way to resolve it, so
  requiredness is suppressed while hidden. The authored flag is preserved in
  `declaredRequired` and returns intact if the field becomes visible again.
- Require is additive. A firing `require_field` can make an optional field
  mandatory; nothing in this module makes an authored-required field
  optional except being hidden.
- Only a `true` result acts. A `false`, `missing` or `incompatible` result
  leaves the field's declared defaults alone. Undecidable rules are reported
  through `indeterminate` rather than being treated as confident negatives.
