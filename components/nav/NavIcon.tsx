import React from "react";
import {
  IconActivity,
  IconArticle,
  IconBone,
  IconBrain,
  IconBrandGithub,
  IconCalendar,
  IconCards,
  IconClipboardCheck,
  IconCpu,
  IconCrosshair,
  IconDeviceGamepad2,
  IconDeviceWatch,
  IconFileSpreadsheet,
  IconHeartHandshake,
  IconPuzzle,
  IconShieldCheck,
  IconShoppingBag,
  IconTerminal,
  IconUser,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavTone } from "@/lib/navigation";

const ICONS: Record<NavIconKey, typeof IconActivity> = {
  arcade: IconDeviceGamepad2,
  "laser-loon": IconCrosshair,
  merch: IconShoppingBag,
  puzzle: IconPuzzle,
  watch: IconDeviceWatch,
  shield: IconShieldCheck,
  cards: IconCards,
  clipboard: IconClipboardCheck,
  terminal: IconTerminal,
  duck: IconBone,
  vault: IconDeviceGamepad2,
  spreadsheet: IconFileSpreadsheet,
  brain: IconBrain,
  cpu: IconCpu,
  heart: IconHeartHandshake,
  activity: IconActivity,
  user: IconUser,
  calendar: IconCalendar,
  github: IconBrandGithub,
  article: IconArticle,
};

const TONES: Record<NavTone, string> = {
  cyan: "text-brand-cyan",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  purple: "text-brand-purple",
};

/** The text colour class for a tone, shared with badges. */
export function navToneClass(tone: NavTone): string {
  return TONES[tone];
}

/** Draws the icon a navigation item names, in its tone. */
export const NavIcon: React.FC<{
  name: NavIconKey;
  tone: NavTone;
  className?: string;
}> = ({ name, tone, className }) => {
  const Icon = ICONS[name];
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", TONES[tone], className)}
      aria-hidden="true"
    />
  );
};
