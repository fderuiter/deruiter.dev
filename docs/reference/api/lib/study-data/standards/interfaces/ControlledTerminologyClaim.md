[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/standards](../README.md) / ControlledTerminologyClaim

# Interface: ControlledTerminologyClaim

How far the controlled terminology the site uses has been checked.

## Properties

### package

> `readonly` **package**: `string`

The NCI EVS CDISC CT package the codes are aligned to.

***

### packageDate

> `readonly` **packageDate**: `string`

Release date of that package, as NCI EVS publishes it.

***

### scope

> `readonly` **scope**: `"local subset"`

A local, hand-curated subset of codelists and terms, not the whole
package. No new codelists are added through this profile.

***

### verifiedAgainst?

> `readonly` `optional` **verifiedAgainst?**: `string`

The package files the subset is verified against, when it is:
`__tests__/cdisc-ct-release.test.ts` checks every code against the subset
`scripts/cdisc-ct-subset.ts` derives from them. Absent: the codes have
not been verified against a downloaded package.
