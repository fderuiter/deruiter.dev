import React, { type ComponentType } from "react";
import {
  IconAlarm,
  IconBinary,
  IconBolt,
  IconClipboardCheck,
  IconCoffee,
  IconDeviceGamepad2,
  IconHeadphones,
  IconPaw,
  IconPhoneCall,
  IconRocket,
  IconStar,
  IconTeapot,
  IconTerminal2,
  IconTrophy,
  IconWaveSine,
} from "@tabler/icons-react";

interface PictogramProps {
  className?: string;
  stroke?: number;
}

type Pictogram = ComponentType<PictogramProps & { "aria-hidden"?: boolean }>;

/**
 * One line pictogram per sampler pad, replacing the emoji. Keyed by the
 * pad's id in SOUNDBOARD_BUTTONS; an unknown id falls back to a sine wave.
 */
const PAD_PICTOGRAMS: Record<string, Pictogram> = {
  "snd-bark": IconPaw,
  "snd-laser": IconBolt,
  "snd-friday": IconAlarm,
  "snd-matrix": IconBinary,
  "snd-teapot": IconTeapot,
  "snd-modem": IconPhoneCall,
  "snd-fda": IconClipboardCheck,
  "snd-levelup": IconStar,
};

/** The glyph engraved on each trophy badge, keyed by achievement id. */
const TROPHY_GLYPHS: Record<string, Pictogram> = {
  "konami-hero": IconDeviceGamepad2,
  "terminal-cowboy": IconTerminal2,
  "duck-whisperer": IconPaw,
  "rfc-barista": IconCoffee,
  "soundboard-maestro": IconHeadphones,
  "friday-survivor": IconRocket,
};

/** Renders the pictogram for a pad, decorative (hidden from assistive tech). */
export function renderPadPictogram(id: string, props: PictogramProps) {
  const Icon = PAD_PICTOGRAMS[id] ?? IconWaveSine;
  return <Icon aria-hidden={true} {...props} />;
}

/** Renders the glyph engraved on a trophy badge, decorative. */
export function renderTrophyGlyph(id: string, props: PictogramProps) {
  const Icon = TROPHY_GLYPHS[id] ?? IconTrophy;
  return <Icon aria-hidden={true} {...props} />;
}
