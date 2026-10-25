[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/staff](../README.md) / siteStaffFeed

# Function: siteStaffFeed()

> **siteStaffFeed**(`portfolio`): [`SiteStaffAssignment`](../../../../types/platform/interfaces/SiteStaffAssignment.md)[]

Derives the principal investigator assignments of every site. Each site
starts with one investigator from its study's start; about one long-running
site in twelve, and at least one when any qualifies, hands over to a second
investigator between 90 days after activation and 60 days before its
close-out or the data cut.

## Parameters

### portfolio

[`Portfolio`](../../../../types/platform/interfaces/Portfolio.md)

The portfolio, from `generatePortfolio`.

## Returns

[`SiteStaffAssignment`](../../../../types/platform/interfaces/SiteStaffAssignment.md)[]

Assignments in site order, each site's in date order.
