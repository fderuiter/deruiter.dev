[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/navigation](../README.md) / getNavBreadcrumbParents

# Function: getNavBreadcrumbParents()

> **getNavBreadcrumbParents**(`pathname`): [`NavBreadcrumbParent`](../interfaces/NavBreadcrumbParent.md)[]

The parent crumb a page shows between Home and its own name: the label and
overview href of the menu group that lists it (Simulators, About). Empty for
pages outside a menu group, and for the group's own overview page, so a trail
never links to the page it is on.

## Parameters

### pathname

`string`

## Returns

[`NavBreadcrumbParent`](../interfaces/NavBreadcrumbParent.md)[]
