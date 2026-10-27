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
 * components. The structure follows issue #1842, regrouped by #2952.
 */

import { CLINICAL_JOURNEY, type JourneyStepId } from "./clinical-journey";

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
  | "rings"
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
  /** Position on the clinical journey, shown before the title. */
  step?: number;
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
  id: "clinical" | "labs" | "arcade" | "writing" | "about" | "contact";
  label: string;
  /** Where the label goes when it is a plain link, or the menu's overview. */
  href: string;
  /**
   * Text of the link to the group's own overview page, shown at the foot of
   * its menu. Omitted when the overview is already a menu entry or a section
   * of another page.
   */
  overviewLabel?: string;
  /**
   * The group has no overview page of its own (its href is its first entry),
   * so it adds no parent crumb to the pages it lists.
   */
  noBreadcrumb?: boolean;
  /** Menu contents. A group with no sections is a plain link. */
  sections: NavSection[];
  /** Paths and path prefixes that mark the group as the current one. */
  activeWhen: {
    exact?: string[];
    prefixes?: string[];
  };
}

/** Presentation of each journey step that is a page in the Clinical menu. */
const JOURNEY_MENU_STYLE: Partial<
  Record<JourneyStepId, Omit<NavItem, "title" | "href" | "step">>
> = {
  collect: {
    id: "crf-studio",
    subtitle: "Design the forms and enter data as a site would",
    mobileHref: "/m/crf",
    icon: "spreadsheet",
    tone: "amber",
    badge: "CDISC",
  },
  consequences: {
    id: "protocol-drift",
    subtitle: "A clinical data pipeline under pressure",
    icon: "shield",
    tone: "amber",
    badge: "Simulation",
  },
  tabulate: {
    id: "study-data",
    subtitle: "One synthetic study from USDM to tables, traced end to end",
    icon: "spreadsheet",
    tone: "amber",
    badge: "Lineage",
  },
  govern: {
    id: "clinical-platform",
    subtitle: "Eight synthetic studies governed as one portfolio",
    icon: "cpu",
    tone: "amber",
    badge: "Platform",
  },
};

/**
 * The journey's pages in journey order. The order and titles come from
 * `lib/clinical-journey.ts`, so the menu and the journey strip on each page
 * cannot disagree; the case-study step is reached from Writing instead.
 */
const JOURNEY_ITEMS: NavItem[] = CLINICAL_JOURNEY.flatMap((step, index) => {
  const style = JOURNEY_MENU_STYLE[step.id];
  return style
    ? [{ ...style, title: step.title, href: step.href, step: index + 1 }]
    : [];
});

/** Tools that hang off the Clinical Data Platform hub. */
const PLATFORM_TOOL_ITEMS: NavItem[] = [
  {
    id: "platform-portfolio",
    title: "Portfolio Dashboard",
    subtitle: "Every study's milestones and cycle times side by side",
    href: "/platform/portfolio",
    icon: "activity",
    tone: "amber",
    badge: "Dashboards",
  },
  {
    id: "platform-operations",
    title: "Operations Dashboards",
    subtitle: "Portfolio to site drill-down from governed metrics",
    href: "/platform/operations",
    icon: "activity",
    tone: "amber",
    badge: "Dashboards",
  },
  {
    id: "platform-explore",
    title: "Metrics Explorer",
    subtitle: "Group and filter any governed metric, and see its SQL",
    href: "/platform/explore",
    icon: "spreadsheet",
    tone: "amber",
    badge: "Self-service",
  },
  {
    id: "platform-sql",
    title: "SQL Workbench",
    subtitle: "Run read-only SQL on the warehouse in your browser",
    href: "/platform/sql",
    icon: "terminal",
    tone: "amber",
    badge: "DuckDB-WASM",
  },
  {
    id: "platform-governance",
    title: "Data Governance",
    subtitle: "The catalog, glossary, stewardship and policies",
    href: "/platform/governance",
    icon: "shield",
    tone: "amber",
    badge: "Catalog",
  },
  {
    id: "platform-strategy",
    title: "Platform Strategy",
    subtitle: "Fictional vendor scoring and investment decisions",
    href: "/platform/strategy",
    icon: "clipboard",
    tone: "amber",
    badge: "Toolkit",
  },
];

/** Evidence about the clinical work as a whole, not one journey step. */
const CLINICAL_EVIDENCE_ITEMS: NavItem[] = [
  {
    id: "clinical-standards",
    title: "Standards Conformance",
    subtitle: "Every CDISC standard, its version and what checked it",
    href: "/clinical/standards",
    icon: "shield",
    tone: "amber",
    badge: "CDISC",
  },
];

const LABS_ITEMS: NavItem[] = [
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

const ARCADE_HUB_ITEMS: NavItem[] = [
  {
    id: "arcade-hub",
    title: "Arcade Hub",
    subtitle: "Every game in one place",
    href: "/arcade",
    icon: "arcade",
    tone: "cyan",
  },
];

/** Games about clinical research and the work around it. */
const ARCADE_CLINICAL_ITEMS: NavItem[] = [
  {
    id: "study-director",
    title: "Study Director",
    subtitle: "Run a clinical study. Everything is fine.",
    href: "/arcade/study-director",
    icon: "clipboard",
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
    id: "clinical-chaos",
    title: "Clinical Trial Chaos",
    subtitle: "Fast-paced medical trial simulator",
    href: "/arcade/clinical-chaos",
    icon: "shield",
    tone: "cyan",
  },
];

/** Games drawn from Fred's own life. */
const ARCADE_LIFE_ITEMS: NavItem[] = [
  {
    id: "laser-loon",
    title: "Laser Loon",
    subtitle: "A loon, lasers, and a trip to the Capitol",
    href: "/arcade/laser-loon",
    icon: "laser-loon",
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
    id: "for-better-or-bulk",
    title: "For Better or Bulk",
    subtitle: "Set up our Costco wedding before 4:00",
    href: "/arcade/for-better-or-bulk",
    icon: "rings",
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
    id: "garmin-watch",
    title: "Monkey C Mayhem",
    subtitle: "A Garmin 5K Platformer",
    href: "/arcade/garmin-watch",
    icon: "watch",
    tone: "cyan",
  },
];

const ARCADE_PUZZLE_ITEMS: NavItem[] = [
  {
    id: "retro-labyrinth",
    title: "Retro Labyrinth",
    subtitle: "Retro procedural dungeon crawler",
    href: "/arcade/retro-labyrinth",
    icon: "terminal",
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
    id: "meme-vault",
    title: "Meme Vault",
    subtitle: "Soundboard and easter egg trophies",
    href: "/arcade/meme-vault",
    icon: "vault",
    tone: "emerald",
  },
];

const WRITING_ITEMS: NavItem[] = [
  {
    id: "blog",
    title: "Blog",
    subtitle: "Notes on what I'm building and why",
    href: "/blog",
    icon: "article",
    tone: "cyan",
  },
  {
    id: "case-studies",
    title: "Case Studies",
    subtitle: "Projects, the decisions behind them and their limits",
    href: "/case-studies",
    icon: "article",
    tone: "cyan",
  },
];

const FEATURED_WRITING_ITEMS: NavItem[] = [
  {
    id: "laser-loon-design",
    title: "The Laser Loon, by Design",
    subtitle: "How the flag-inspired loon artwork came together",
    href: "/work/laser-loon",
    icon: "laser-loon",
    tone: "amber",
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
    id: "schedule",
    title: "Office Hours",
    subtitle: "Book a chat and see the schedule",
    href: "/schedule",
    icon: "calendar",
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
    id: "wedding",
    title: "Our Wedding",
    subtitle: "An archive of Abbi and Fred's wedding website and photos",
    href: "/wedding",
    icon: "heart",
    tone: "amber",
  },
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
    id: "github",
    title: "GitHub",
    subtitle: "The source for this site",
    href: "https://github.com/fderuiter/deruiter.dev",
    icon: "github",
    tone: "cyan",
    external: true,
  },
];

/** The top bar, left to right. */
export const PRIMARY_NAV: readonly NavGroup[] = [
  {
    id: "clinical",
    label: "Clinical",
    href: "/clinical",
    overviewLabel: "The whole clinical journey",
    sections: [
      { id: "journey", label: "The journey, in order", items: JOURNEY_ITEMS },
      {
        id: "platform-tools",
        label: "Platform tools",
        items: PLATFORM_TOOL_ITEMS,
      },
      { id: "evidence", label: "Evidence", items: CLINICAL_EVIDENCE_ITEMS },
    ],
    activeWhen: {
      exact: [
        "/clinical",
        "/clinical/standards",
        "/crf",
        "/protocol-drift",
        "/study-data",
      ],
      prefixes: ["/platform", "/m/crf"],
    },
  },
  {
    id: "labs",
    label: "Labs",
    href: "/labs",
    overviewLabel: "Every lab on one page",
    sections: [{ id: "labs", items: LABS_ITEMS }],
    activeWhen: {
      exact: ["/labs", "/simulator", "/proof", "/neuro"],
      prefixes: ["/patrol", "/m/proof", "/m/neuro", "/m/patrol"],
    },
  },
  {
    id: "arcade",
    label: "Arcade",
    href: "/arcade",
    sections: [
      { id: "hub", items: ARCADE_HUB_ITEMS },
      {
        id: "clinical-life",
        label: "Clinical life",
        items: ARCADE_CLINICAL_ITEMS,
      },
      { id: "freds-life", label: "Fred's life", items: ARCADE_LIFE_ITEMS },
      {
        id: "puzzles",
        label: "Puzzles and classics",
        items: ARCADE_PUZZLE_ITEMS,
      },
    ],
    activeWhen: { prefixes: ["/arcade"] },
  },
  {
    id: "writing",
    label: "Writing",
    href: "/blog",
    noBreadcrumb: true,
    sections: [
      { id: "writing", items: WRITING_ITEMS },
      { id: "featured", label: "Featured", items: FEATURED_WRITING_ITEMS },
    ],
    activeWhen: { prefixes: ["/blog", "/case-studies", "/work"] },
  },
  {
    id: "about",
    label: "About",
    href: "/#about",
    sections: [{ id: "about", items: ABOUT_ITEMS }],
    activeWhen: {
      exact: ["/stack", "/acknowledgments", "/schedule", "/wedding", "/merch"],
    },
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

/** Every href the navigation reaches: group overviews and menu entries. */
export function getAllNavHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const group of PRIMARY_NAV) {
    hrefs.add(group.href);
    for (const item of getNavGroupItems(group)) hrefs.add(item.href);
  }
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
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
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

/** One crumb in a page's trail. The page's own crumb, last, has no href. */
export interface NavBreadcrumb {
  label: string;
  href?: string;
}

/**
 * A page's breadcrumb trail after Home, built from the navigation so every
 * page names its parents the same way. The trail is the menu group's overview
 * (Clinical, Labs, Arcade, About), then the index page the path extends
 * (Clinical Data Platform for `/platform/sql`, Blog for a post), then the page.
 *
 * The page is named by `pageLabel`, else by its menu entry, else by its group.
 * The group crumb is left out for a group with no overview page (Writing) and
 * on the overview page itself, so a trail never links to the page it is on.
 */
export function getBreadcrumbTrail(
  pathname: string,
  pageLabel?: string
): NavBreadcrumb[] {
  const path = (pathname.split("#")[0] ?? "").replace(/\/+$/, "") || "/";
  if (path === "/") return [];
  const group = getNavGroupForHref(path);
  const items = getAllNavItems().filter((item) => !item.external);
  const trail: NavBreadcrumb[] = [];

  const groupCrumb =
    group && isNavMenu(group) && !group.noBreadcrumb ? group : undefined;
  if (groupCrumb && path === groupCrumb.href) {
    return [{ label: pageLabel ?? groupCrumb.label }];
  }
  if (groupCrumb) {
    trail.push({ label: groupCrumb.label, href: groupCrumb.href });
  }

  // The group crumb already links the hub a menu shares an href with (Arcade).
  const parent = items
    .filter(
      (item) =>
        item.href !== groupCrumb?.href && path.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (parent) trail.push({ label: parent.title, href: parent.href });

  const own = items.find(
    (item) => item.href === path || item.mobileHref === path
  );
  trail.push({ label: pageLabel ?? own?.title ?? group?.label ?? path });
  return trail;
}

/**
 * The same trail, Home first, in the `{ name, url }` shape the JSON-LD helper
 * takes, so the visible crumbs and the structured data cannot disagree.
 */
export function getBreadcrumbTrailSchema(
  pathname: string,
  pageLabel?: string
): { name: string; url: string }[] {
  const path = pathname.split("#")[0] || "/";
  return [
    { name: "Home", url: "/" },
    ...getBreadcrumbTrail(pathname, pageLabel).map(({ label, href }) => ({
      name: label,
      url: href ?? path,
    })),
  ];
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
