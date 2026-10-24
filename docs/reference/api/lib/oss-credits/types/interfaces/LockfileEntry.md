[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/types](../README.md) / LockfileEntry

# Interface: LockfileEntry

Subset of a lockfile entry the builder reads.

## Properties

### dev?

> `optional` **dev?**: `boolean`

***

### inBundle?

> `optional` **inBundle?**: `boolean`

Set when the package ships inside its parent's tarball and has no
registry tarball of its own. Newer npm releases (the one Dependabot runs)
record these entries; npm 10 omits them.

***

### integrity?

> `optional` **integrity?**: `string`

Subresource integrity hash of that tarball.

***

### license?

> `optional` **license?**: `string`

***

### link?

> `optional` **link?**: `boolean`

***

### name?

> `optional` **name?**: `string`

Published name, present when the install path is an npm alias.

***

### resolved?

> `optional` **resolved?**: `string`

Registry tarball URL; locates the package in the registry.

***

### version?

> `optional` **version?**: `string`
