[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/haptics](../README.md) / triggerHaptic

# Function: triggerHaptic()

> **triggerHaptic**(`pattern?`): `void`

Triggers physical haptic vibration feedback with graceful degradation
for devices or browsers that do not support navigator.vibrate. It stays
still while this device's Vibration setting, from the arcade cabinet's
Setup sheet, is off (#2924).

## Parameters

### pattern?

`number` \| `number`[] = `15`

Single duration in ms or pattern array of durations

## Returns

`void`
