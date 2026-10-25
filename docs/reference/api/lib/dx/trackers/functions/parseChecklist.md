[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / parseChecklist

# Function: parseChecklist()

> **parseChecklist**(`body`): [`ChecklistItem`](../interfaces/ChecklistItem.md)[]

Finds the checklist lines whose subject is an issue.

A line's subject is the `#N` that opens it, so "- [x] #2583 to #2590
merged" is about #2583, and "- [ ] One journey, coordinated through
#2689" has no subject and is skipped. Fenced code is ignored.

## Parameters

### body

`string`

An epic's Markdown body.

## Returns

[`ChecklistItem`](../interfaces/ChecklistItem.md)[]

The checklist items in body order.
