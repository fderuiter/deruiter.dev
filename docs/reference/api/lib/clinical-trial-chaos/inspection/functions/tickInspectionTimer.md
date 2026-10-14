[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / tickInspectionTimer

# Function: tickInspectionTimer()

> **tickInspectionTimer**(`round`, `seconds`): [`InspectionRound`](../interfaces/InspectionRound.md)

Runs the current question's timer down; at zero the question is answered
as a timeout. A turned-off timer and an answered question do not run.

## Parameters

### round

[`InspectionRound`](../interfaces/InspectionRound.md)

The round.

### seconds

`number`

Seconds elapsed.

## Returns

[`InspectionRound`](../interfaces/InspectionRound.md)

The round after the tick.
