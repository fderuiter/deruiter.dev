[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/navigation](../README.md) / getBreadcrumbTrail

# Function: getBreadcrumbTrail()

> **getBreadcrumbTrail**(`pathname`, `pageLabel?`): [`NavBreadcrumb`](../interfaces/NavBreadcrumb.md)[]

A page's breadcrumb trail after Home, built from the navigation so every
page names its parents the same way. The trail is the menu group's overview
(Clinical, Labs, Arcade, About), then the index page the path extends
(Clinical Data Platform for `/platform/sql`, Blog for a post), then the page.

The page is named by `pageLabel`, else by its menu entry, else by its group.
The group crumb is left out for a group with no overview page (Writing) and
on the overview page itself, so a trail never links to the page it is on.

## Parameters

### pathname

`string`

### pageLabel?

`string`

## Returns

[`NavBreadcrumb`](../interfaces/NavBreadcrumb.md)[]
