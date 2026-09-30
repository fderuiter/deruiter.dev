[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useArcadeFx](../README.md) / useArcadeFx

# Function: useArcadeFx()

> **useArcadeFx**(`options?`): [`ArcadeFx`](../interfaces/ArcadeFx.md)

Shared arcade feedback: screen shake, a colour flash and hit stop.

Shake and flash animate only `transform` and `opacity` through the Web
Animations API, so they cost no React renders and no game-loop work. Both
are skipped under `prefers-reduced-motion`, below a 768px viewport, and
when the cabinet's Setup Wizard sets screen shake to none. Hit stop is a
timestamp the game loop checks, so a game decides what freezing means.

## Parameters

### options?

[`ArcadeFxOptions`](../interfaces/ArcadeFxOptions.md) = `{}`

The game's own effects toggle.

## Returns

[`ArcadeFx`](../interfaces/ArcadeFx.md)

Refs to attach and the effect triggers.
