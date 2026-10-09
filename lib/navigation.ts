/**
 * The site's navigation, as data.
 *
 * The top bar, the mobile drawer and the footer all read these groups, so a
 * page is added in one place and cannot be listed under different names or
 * different headings on different surfaces. The command palette keeps its own
 * richer entries (previews, tags) and a test checks that it covers every href
 * here.
 *
 * This module holds no JSX: icons are named by key and drawn by the
 * components. The structure follows issue #1842.
 */

/** Names an icon the components know how to draw. */
export type NavIconKey =
  | "arcade"
  | "laser-loon"
  | "merch"
  | "puzzle"
  | "watch"
  | "shield"
  | "cards"
  | "clipboard"
  | "headset"
  | "terminal"
  | "duck"
  | "vault"
  | "spreadsheet"
  | "brain"
  | "cpu"
  | "heart"
  | "activity"
  | "user"
  | "calendar"
  | "github"
  | "article";

/** Accent used for an item's icon. */
export type NavTone = "cyan" | "amber" | "emerald" | "purple";

/** Which reading mode hides an item, where one does. */
export type NavHiddenFor = "behind-the-scenes";

/** One destination. */
export interface NavItem {
  /** Stable id, also the React key. */
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** Phone-sized variant of the page, used by the mobile drawer. */
  mobileHref?: string;
  icon: NavIconKey;
  tone: NavTone;
  /** Short label shown beside the item in the drawer. */
  badge?: string;
  /** Opens off-site, so it gets an arrow and a new tab. */
  external?: boolean;
  /** Reading mode that hides this item. */
  hiddenFor?: NavHiddenFor;
}

/** A labelled run of items inside a menu. */
export interface NavSection {
  id: string;
  /** Heading shown above the items. Omitted for a menu with one run. */
  label?: string;
  items: NavItem[];
}

/** One entry in the top bar. */
export interface NavGroup {
  id: "work" | "blog" | "arcade" | "simulators" | "about" | "contact";
  label: string;
  /** Where the label goes when it is a plain link, or the menu's overview. */
  href: string;
  /** Menu contents. A group with no sections is a plain link. */
  sections: NavSection[];
  /** Paths and path prefixes that mark the group as the current one. */
  activeWhen: {
    exact?: string[];
    prefixes?: string[];
  };
  /** Pages that belong under the group but are not menu entries. */
  also?: string[];
}

const ARCADE_ITEMS: NavItem[] = [
  {
    id: "arcade-hub",
    title: "Arcade Hub",
    subtitle: "Every game in one place",
    href: "/arcade",
    icon: "arcade",
    tone: "cyan",
  },
  {
    id: "laser-loon",
    title: "Laser Loon",
    subtitle: "A loon, lasers, and a trip to the Capitol",
    href: "/arcade/laser-loon",
    icon: "laser-loon",
    tone: "cyan",
  },
  {
    id: "study-director",
    title: "Study Director",
    subtitle: "Run a clinical study. Everything is fine.",
    href: "/arcade/study-director",
    icon: "clipboard",
    tone: "cyan",
  },
  {
    id: "patty-drive-thru",
    title: "Patty's Drive-Thru",
    subtitle: "One shift at my first job, in first person",
    href: "/arcade/patty-drive-thru",
    icon: "headset",
    tone: "cyan",
  },
  {
    id: "quasi-puzzler",
    title: "Quasi-Perfect Puzzler",
    subtitle: "Deductive logic puzzle assistant",
    href: "/arcade/quasi-puzzler",
    icon: "puzzle",
    tone: "cyan",
  },
  {
    id: "trial-and-error",
    title: "Trial & Error: Biostat Ops",
    subtitle: "Clinical-output roguelike deckbuilder",
    href: "/arcade/trial-and-error",
    icon: "cards",
    tone: "cyan",
  },
  {
    id: "retro-labyrinth",
    title: "Retro Labyrinth",
    subtitle: "Retro procedural dungeon crawler",
    href: "/arcade/retro-labyrinth",
    icon: "terminal",
    tone: "cyan",
  },
  {
    id: "working-with-duck",
    title: "Working With Duck",
    subtitle: "You have work. Duck has other plans.",
    href: "/arcade/working-with-duck",
    icon: "duck",
    tone: "cyan",
  },
  {
    id: "clinical-chaos",
    title: "Clinical Trial Chaos",
    subtitle: "Fast-paced medical trial simulator",
    href: "/arcade/clinical-chaos",
    icon: "shield",
    tone: "cyan",
  },
  {
    id: "garmin-watch",
    title: "Monkey C Mayhem",
    subtitle: "Garmin Schvitz App smartwatch simulator",
    href: "/arcade/garmin-watch",
    icon: "watch",
    tone: "cyan",
  },
  {
    id: "meme-vault",
    title: "Meme Vault",
    subtitle: "Soundboard and easter egg trophies",
    href: "/arcade/meme-vault",
    icon: "vault",
    tone: "emerald",
  },
];

const SIMULATOR_ITEMS: NavItem[] = [
  {
    id: "protocol-drift",
    title: "Protocol Drift",
    subtitle: "A clinical data pipeline under pressure",
    href: "/protocol-drift",
    icon: "shield",
    tone: "amber",
    badge: "CDISC",
  },
  {
    id: "incident-simulator",
    title: "Incident Simulator",
    subtitle: "Architecture bias and outage triage",
    href: "/simulator",
    icon: "activity",
    tone: "cyan",
    badge: "Outage Drill",
    hiddenFor: "behind-the-scenes",
  },
  {
    id: "patrol-shift",
    title: "Patrol Shift",
    subtitle: "Midwest ski-patrol operational judgment simulator",
    href: "/patrol",
    mobileHref: "/m/patrol",
    icon: "shield",
    tone: "cyan",
    badge: "Judgment",
  },
];

const STUDIO_ITEMS: NavItem[] = [
  {
    id: "crf-studio",
    title: "CRF Studio",
    subtitle: "Clinical form designer and live trial simulator",
    href: "/crf",
    mobileHref: "/m/crf",
    icon: "spreadsheet",
    tone: "cyan",
    badge: "CDISC",
  },
  {
    id: "proof-workspace",
    title: "Proof Workspace",
    subtitle: "Build a proof, one step at a time",
    href: "/proof",
    mobileHref: "/m/proof",
    icon: "brain",
    tone: "purple",
    badge: "AST",
  },
  {
    id: "neuro-studio",
    title: "NeuroRecon Studio",
    subtitle: "Interactive 3D MRI brain viewer",
    href: "/neuro",
    mobileHref: "/m/neuro",
    icon: "brain",
    tone: "emerald",
    badge: "3D MRI",
  },
];

const ABOUT_ITEMS: NavItem[] = [
  {
    id: "about-me",
    title: "About Fred",
    subtitle: "Background, experience and how I work",
    href: "/#about",
    icon: "user",
    tone: "cyan",
  },
  {
    id: "stack",
    title: "Under the Hood",
    subtitle: "The tools and decisions behind this site",
    href: "/stack",
    icon: "cpu",
    tone: "cyan",
    badge: "Architecture",
  },
  {
    id: "credits",
    title: "Open Source Credits",
    subtitle: "The projects and licenses this site is built on",
    href: "/acknowledgments",
    icon: "heart",
    tone: "emerald",
    badge: "Licenses",
  },
  {
    id: "schedule",
    title: "Office Hours",
    subtitle: "Book a chat and see the schedule",
    href: "/schedule",
    icon: "calendar",
    tone: "cyan",
  },
  {
    id: "github",
    title: "GitHub",
    subtitle: "The source for this site",
    href: "https://github.com/fderuiter/deruiter.dev",
    icon: "github",
    tone: "cyan",
    external: true,
  },
];

/**
 * Pages the footer lists that the top bar does not. Merch is reached from
 * Laser Loon and the footer rather than from the Arcade menu.
 */
export const FOOTER_EXTRA_ITEMS: readonly NavItem[] = [
  {
    id: "merch",
    title: "Laser Loon Merch (soon)",
    subtitle: "Flag stickers, shirts and prints at cost, coming soon",
    href: "/merch",
    icon: "merch",
    tone: "amber",
    badge: "Coming soon",
  },
  {
    id: "brother-case-study",
    title: "Designing for My Brother",
    subtitle: "Dyslexia-first typography and cognitive accessibility",
    href: "/case-studies/designing-for-my-brother",
    icon: "article",
    tone: "amber",
  },
];

/** The top bar, left to right. */
export const PRIMARY_NAV: readonly NavGroup[] = [
  {
    id: "work",
    label: "Work",
    href: "/case-studies",
    sections: [],
    activeWhen: { prefixes: ["/case-studies"] },
    also: ["/case-studies/designing-for-my-brother"],
  },
  {
    id: "blog",
    label: "Blog",
    href: "/blog",
    sections: [],
    activeWhen: { prefixes: ["/blog"] },
  },
  {
    id: "arcade",
    label: "Arcade",
    href: "/arcade",
    sections: [{ id: "games", items: ARCADE_ITEMS }],
    activeWhen: { prefixes: ["/arcade"] },
    also: ["/merch"],
  },
  {
    id: "simulators",
    label: "Simulators",
    href: "/simulator",
    sections: [
      { id: "simulators", label: "Simulators", items: SIMULATOR_ITEMS },
      { id: "studios", label: "Studios", items: STUDIO_ITEMS },
    ],
    activeWhen: {
      exact: ["/protocol-drift", "/simulator", "/crf", "/proof", "/neuro"],
      prefixes: ["/patrol", "/m/crf", "/m/proof", "/m/neuro", "/m/patrol"],
    },
  },
  {
    id: "about",
    label: "About",
    href: "/#about",
    sections: [{ id: "about", items: ABOUT_ITEMS }],
    activeWhen: { exact: ["/stack", "/acknowledgments", "/schedule"] },
  },
  {
    id: "contact",
    label: "Contact",
    href: "/contact",
    sections: [],
    activeWhen: { exact: ["/contact"] },
  },
];

/** True when the group is a menu rather than a plain link. */
export function isNavMenu(group: NavGroup): boolean {
  return group.sections.length > 0;
}

/** Every item in a group, in menu order. */
export function getNavGroupItems(group: NavGroup): NavItem[] {
  return group.sections.flatMap((section) => section.items);
}

/** Every item in the navigation, in top bar order. */
export function getAllNavItems(): NavItem[] {
  return PRIMARY_NAV.flatMap(getNavGroupItems);
}

/** Every href the navigation reaches, menu entries and footer extras alike. */
export function getAllNavHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const group of PRIMARY_NAV) {
    hrefs.add(group.href);
    for (const item of getNavGroupItems(group)) hrefs.add(item.href);
    for (const path of group.also ?? []) hrefs.add(path);
  }
  for (const item of FOOTER_EXTRA_ITEMS) hrefs.add(item.href);
  return [...hrefs];
}

/** Looks a group up by id. */
export function getNavGroup(id: NavGroup["id"]): NavGroup {
  const group = PRIMARY_NAV.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown navigation group: ${id}`);
  return group;
}

/** Whether a path puts the group in its current state. */
export function isNavGroupActive(group: NavGroup, pathname: string): boolean {
  const { exact = [], prefixes = [] } = group.activeWhen;
  return (
    exact.includes(pathname) ||
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    (group.also ?? []).includes(pathname)
  );
}

/**
 * The top-bar group a page belongs to, or undefined for pages outside the
 * navigation. Accepts a path or an href with a hash, so the command palette and
 * the sitemap can name a page's group without keeping their own lists.
 */
export function getNavGroupForHref(href: string): NavGroup | undefined {
  const exact = PRIMARY_NAV.find((group) => group.href === href);
  if (exact) return exact;
  const path = href.split("#")[0] || "/";
  return PRIMARY_NAV.find((group) => isNavGroupActive(group, path));
}

/** One parent crumb for a page's breadcrumb trail. */
export interface NavBreadcrumbParent {
  label: string;
  href: string;
}

/**
 * The parent crumb a page shows between Home and its own name: the label and
 * overview href of the menu group that lists it (Simulators, About). Empty for
 * pages outside a menu group, and for the group's own overview page, so a trail
 * never links to the page it is on.
 */
export function getNavBreadcrumbParents(
  pathname: string
): NavBreadcrumbParent[] {
  const group = getNavGroupForHref(pathname);
  if (!group || !isNavMenu(group) || pathname === group.href) return [];
  return [{ label: group.label, href: group.href }];
}

/** The same parent crumb in the `{ name, url }` shape the JSON-LD helper takes. */
export function getNavBreadcrumbSchemaParents(
  pathname: string
): { name: string; url: string }[] {
  return getNavBreadcrumbParents(pathname).map(({ label, href }) => ({
    name: label,
    url: href,
  }));
}

/** The href to use on a phone-sized surface. */
export function getNavHref(item: NavItem, surface: "desktop" | "mobile") {
  return surface === "mobile" && item.mobileHref ? item.mobileHref : item.href;
}

/** Hides items the current reading mode removes. */
export function filterNavItems(
  items: readonly NavItem[],
  persona: string
): NavItem[] {
  return items.filter((item) => item.hiddenFor !== persona);
}
