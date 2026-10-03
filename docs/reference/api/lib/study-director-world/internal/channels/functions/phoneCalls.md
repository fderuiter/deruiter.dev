[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/channels](../README.md) / phoneCalls

# Function: phoneCalls()

> **phoneCalls**(`world`): [`PhoneCall`](../../../types/interfaces/PhoneCall.md)[]

Today's calls, in the order the phone rings. Each waiting phone message
rings once at a time drawn from the world's own seeded stream, between
half an hour after the morning starts and half past four, at least twenty
minutes after the call before it. A message carried over from an earlier
day rings earlier: the caller is chasing. An ignored call rings again
forty-five minutes later; a call sent to voicemail or answered does not.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

## Returns

[`PhoneCall`](../../../types/interfaces/PhoneCall.md)[]
