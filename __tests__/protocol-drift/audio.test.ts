// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const playTone = vi.fn();
let allowed = true;
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => allowed, playTone }),
}));

import {
  playProtocolCue,
  type ProtocolDriftSoundCue,
} from "@/components/protocol-drift/audio";

const CUES: Array<[ProtocolDriftSoundCue, Record<string, unknown>]> = [
  ["eventStep", { frequency: 440, type: "sine", duration: 0.04, volume: 0.05 }],
  [
    "queryAlert",
    { frequency: 293.66, type: "sawtooth", duration: 0.15, volume: 0.08 },
  ],
  [
    "sourceCorrect",
    { frequency: 659.25, type: "triangle", duration: 0.08, volume: 0.06 },
  ],
  [
    "gatePass",
    {
      frequency: 880,
      endFrequency: 1100,
      rampType: "exponential",
      duration: 0.22,
      volume: 0.1,
    },
  ],
  [
    "wireSnap",
    { frequency: 523.25, type: "sine", duration: 0.05, volume: 0.04 },
  ],
  [
    "rejectCollision",
    { frequency: 196, type: "square", duration: 0.12, volume: 0.07 },
  ],
];

describe("Protocol Drift audio cues", () => {
  beforeEach(() => {
    playTone.mockClear();
    allowed = true;
  });

  it.each(CUES)("%s plays its tone", (cue, tone) => {
    playProtocolCue(cue);
    expect(playTone).toHaveBeenCalledTimes(1);
    expect(playTone).toHaveBeenCalledWith(tone);
  });

  it("plays nothing when sound is muted or bypassed", () => {
    allowed = false;
    for (const [cue] of CUES) playProtocolCue(cue);
    expect(playTone).not.toHaveBeenCalled();
  });
});
