[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getFastTrackDomain

# Function: getFastTrackDomain()

> **getFastTrackDomain**(`subject`, `stations`): [`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The station a Fast-Track signature routes to: the first station on the
floor that one of the subject's observations belongs to, else the first
observation's domain, else DM.

## Parameters

### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

The subject being signed.

### stations

[`StationConfig`](../../types/interfaces/StationConfig.md)[]

The active stations.

## Returns

[`CDISCDomain`](../../types/type-aliases/CDISCDomain.md)

The target domain.
