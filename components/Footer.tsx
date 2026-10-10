"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { useScrollToAnchor } from "@/hooks/useScrollToAnchor";
import { resolveScrollBehavior } from "@/lib/scroll";
import { emitAppEvent } from "@/lib/event-bus";
import {
  IconArrowUp,
  IconBrandGithub,
  IconBrandLinkedin,
  IconCalendar,
  IconTerminal,
  IconSparkles,
  IconMessageCode,
  IconArticle,
  IconCamera,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";
import { usePersona } from "@/components/providers/PersonaProvider";
import { useFontPreference } from "@/hooks/useFontPreference";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { FooterStatusTicker } from "@/components/FooterStatusTicker";
import { NewsletterForm } from "@/components/NewsletterForm";
import {
  FOOTER_EXTRA_ITEMS,
  filterNavItems,
  getNavGroup,
  type NavItem,
} from "@/lib/navigation";
import { NavIcon } from "@/components/nav/NavIcon";

/** One footer link, drawn from a navigation item. */
const FooterNavLink: React.FC<{
  item: NavItem;
  onHover: (e: React.MouseEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}> = ({ item, onHover, onClick }) => (
  <li>
    <Link
      href={item.href}
      onClick={onClick}
      onMouseEnter={onHover}
      className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5"
    >
      <NavIcon name={item.icon} tone={item.tone} className="h-3 w-3" />
      {item.title}
    </Link>
  </li>
);

export const Footer: React.FC = () => {
  const pathname = usePathname();
  const { playHover, playSuccess } = useAudio();
  const { persona } = usePersona();
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const handleHover = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pan = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
    playHover(pan);
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      playSuccess();
      window.scrollTo({ top: 0, behavior: resolveScrollBehavior("smooth") });
    }
  };

  const scrollToAnchor = useScrollToAnchor();

  // On the homepage the section is scrolled to in page; elsewhere the link
  // navigates to it.
  const handleHashClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    hash: string
  ) => {
    if (pathname === "/") {
      scrollToAnchor(e, hash);
    }
  };

  const footerObserverRef = useResizeObserver<HTMLElement>(
    (entry) => {
      const h = Math.round(entry.contentRect.height);
      if (typeof document !== "undefined" && h > 0) {
        document.documentElement.style.setProperty("--footer-height", `${h}px`);
      }
    },
    { trackVertical: true }
  );

  return (
    <footer
      ref={footerObserverRef}
      className="w-full bg-zinc-950 border-t border-zinc-900 relative z-20 select-none"
    >
      {/* Top Ambient Highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/20 to-transparent" />

      {/* Live Status Ticker & Interactive Mascot */}
      <FooterStatusTicker />

      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-12 pb-[max(4rem,env(safe-area-inset-bottom)+2rem)]">
        {/* Main Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 mb-16">
          {/* Col 1: Brand & Bio */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <Link
                href="/"
                onMouseEnter={handleHover}
                className="inline-flex items-center gap-2.5 font-mono text-sm tracking-widest font-extrabold text-foreground group"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping-settle absolute inline-flex h-full w-full rounded-full bg-brand-cyan/70 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan" />
                </span>
                <span className="group-hover:text-brand-cyan transition-colors">
                  FDERUITER
                </span>
              </Link>
              <p className="text-xs font-mono text-zinc-400 max-w-sm leading-relaxed">
                Clinical data, useful software, and the occasional laser loon.
                Made by Fred, with plenty of curiosity.
              </p>
            </div>

            {/* Live Operational Status Badge */}
            <Link
              href="/stack"
              onMouseEnter={handleHover}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-brand-cyan/40 text-[11px] font-mono text-zinc-300 hover:text-white transition-all w-fit group"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:animate-pulse" />
              <span>Explore the projects</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 group-hover:text-brand-cyan transition-colors">
                Inspect Stack ↗
              </span>
            </Link>
          </div>

          {/* Col 2: Arcade, from the shared navigation data */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <IconSparkles className="w-3.5 h-3.5 text-brand-cyan" />
              Arcade
            </span>
            <ul className="space-y-2 text-xs font-mono">
              {[
                ...getNavGroup("arcade").sections[0].items,
                ...FOOTER_EXTRA_ITEMS.filter((i) => i.id === "merch"),
              ].map((item) => (
                <FooterNavLink
                  key={item.id}
                  item={item}
                  onHover={handleHover}
                />
              ))}
            </ul>
          </div>

          {/* Col 3: Simulators and studios */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <IconTerminal className="w-3.5 h-3.5 text-brand-cyan" />
              Simulators
            </span>
            <ul className="space-y-2 text-xs font-mono">
              {getNavGroup("simulators").sections.map((section) =>
                filterNavItems(section.items, persona).map((item) => (
                  <FooterNavLink
                    key={item.id}
                    item={item}
                    onHover={handleHover}
                  />
                ))
              )}
            </ul>
          </div>

          {/* Col 4: Site pages */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <IconArticle className="w-3.5 h-3.5 text-brand-cyan" />
              Site
            </span>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link
                  href="/case-studies"
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors"
                >
                  Work
                </Link>
              </li>
              <FooterNavLink
                item={FOOTER_EXTRA_ITEMS.find(
                  (i) => i.id === "brother-case-study"
                )!}
                onHover={handleHover}
              />
              <li>
                <Link
                  href="/blog"
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5"
                >
                  <IconArticle className="w-3 h-3 text-brand-cyan" />
                  Blog
                </Link>
              </li>
              {getNavGroup("about")
                .sections[0].items.filter(
                  (i) => !i.external && i.id !== "schedule"
                )
                .map((item) => (
                  <FooterNavLink
                    key={item.id}
                    item={item}
                    onHover={handleHover}
                    onClick={
                      item.href === "/#about"
                        ? (e) => handleHashClick(e, "about")
                        : undefined
                    }
                  />
                ))}
              <FooterNavLink
                item={FOOTER_EXTRA_ITEMS.find((i) => i.id === "wedding")!}
                onHover={handleHover}
              />
            </ul>
          </div>

          {/* Col 5: Connect & Schedule */}
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <IconCalendar className="w-3.5 h-3.5 text-brand-cyan" />
              Connect
            </span>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <Link
                  href="/schedule"
                  onMouseEnter={handleHover}
                  className="text-brand-cyan font-bold hover:underline transition-all flex items-center gap-1.5"
                >
                  <IconCalendar className="w-3 h-3 text-brand-cyan" />
                  Book a Chat ↗
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5"
                >
                  <IconMessageCode className="w-3 h-3 text-brand-cyan" />
                  Contact ↗
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/fderuiter"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5"
                >
                  <IconBrandGithub className="w-3 h-3 text-zinc-400" />
                  GitHub Repos ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/frederick-de-ruiter-88012467/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5"
                >
                  <IconBrandLinkedin className="w-3 h-3 text-zinc-400" />
                  LinkedIn ↗
                </a>
              </li>
              <li data-testid="footer-photo-gallery">
                <button
                  type="button"
                  onClick={() => emitAppEvent("open-photo-gallery")}
                  onMouseEnter={handleHover}
                  className="text-zinc-400 hover:text-brand-cyan transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <IconCamera className="w-3 h-3 text-amber-400" />
                  Behind the Code (Photos)
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter Subscription Strip */}
        <div className="mb-12 p-6 bg-[#13151a]/90 border border-white/10 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse-settle" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-cyan">
                Project Notes
              </span>
            </div>
            <h2 className="text-sm font-mono font-bold text-white">
              Notes from my projects
            </h2>
            <p className="text-xs font-mono text-zinc-400">
              Occasional notes on what I’m building, what I’m learning, and the
              bugs that put up a good fight.
            </p>
          </div>
          <div className="w-full md:w-auto md:min-w-[340px]">
            <NewsletterForm variant="compact" />
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              &copy; {new Date().getFullYear()} Frederick de Ruiter. All rights
              reserved.
            </span>
          </div>

          <div
            data-testid="footer-utility-row"
            className="flex flex-wrap items-center justify-center gap-4 min-w-0 max-w-full"
          >
            <button
              type="button"
              onClick={() => {
                toggleDyslexiaMode();
                announce(
                  !isDyslexic
                    ? "Dyslexia mode activated. Using OpenDyslexic typeface with increased line spacing."
                    : "Dyslexia mode deactivated. Restored standard typography.",
                  "polite"
                );
              }}
              onMouseEnter={handleHover}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors cursor-pointer ${
                isDyslexic
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
              aria-label={
                isDyslexic
                  ? "Disable Dyslexia Mode (OpenDyslexic font)"
                  : "Enable Dyslexia Mode (OpenDyslexic font)"
              }
              aria-pressed={isDyslexic}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDyslexic
                    ? "bg-amber-400 animate-pulse-settle"
                    : "bg-zinc-600"
                }`}
              />
              <span>{isDyslexic ? "Dyslexia: ON" : "Dyslexia Mode"}</span>
            </button>
            <span className="text-zinc-700">&bull;</span>
            <Link
              href="/proof"
              onMouseEnter={handleHover}
              className="hover:text-brand-cyan transition-colors"
            >
              Logic &amp; Proofs
            </Link>
            <span className="text-zinc-700">&bull;</span>
            <button
              type="button"
              onClick={scrollToTop}
              onMouseEnter={handleHover}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-brand-cyan transition-colors cursor-pointer group"
              aria-label="Scroll back to top of page"
            >
              <span>Back to Top</span>
              <IconArrowUp className="w-3.5 h-3.5 transform group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
