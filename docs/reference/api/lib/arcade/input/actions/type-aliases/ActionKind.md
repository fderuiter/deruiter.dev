[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/input/actions](../README.md) / ActionKind

# Type Alias: ActionKind

> **ActionKind** = `"press"` \| `"hold"` \| `"axis2d"` \| `"pointer"`

How an action behaves over time.

`press` fires once when a key goes down. `hold` fires `down` when the first
bound key goes down and `up` when the last one is released. `axis2d` is a
direction vector built from four key sets or a stick, sent as `change`.
`pointer` is a mouse, touch or Pencil gesture the view handles itself; it
has no keys and exists so hints and the manual can name it.
