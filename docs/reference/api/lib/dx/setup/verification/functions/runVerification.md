[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/verification](../README.md) / runVerification

# Function: runVerification()

> **runVerification**(`options`): `Promise`\<[`VerificationCheck`](../../types/interfaces/VerificationCheck.md)[]\>

Runs verification from cheapest to most expensive. Non-interactive runs
execute exactly the requested levels. Interactive runs execute those,
then offer each remaining level in order and stop at the first "no".
Levels that did not run are reported as `not-checked`, so a summary never
implies a check that nobody performed.

## Parameters

### options

[`VerificationOptions`](../interfaces/VerificationOptions.md)

## Returns

`Promise`\<[`VerificationCheck`](../../types/interfaces/VerificationCheck.md)[]\>
