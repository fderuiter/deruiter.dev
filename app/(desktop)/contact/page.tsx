"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconMessageCode,
  IconCalendar,
  IconBrandLinkedin,
  IconBrandGithub,
  IconShieldLock,
  IconExternalLink,
} from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { ContactForm } from "@/components/ContactForm";
import { NewsletterForm } from "@/components/NewsletterForm";

export default function ContactPage() {
  const [costcoMode, setCostcoMode] = React.useState<"wholesale" | "flame">(
    "wholesale"
  );
  return (
    <PageLayout
      variant="standard"
      className="bg-zinc-950 text-foreground relative overflow-hidden pt-28 pb-20"
    >
      {/* Ambient Atmospheric Glows */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-brand-cyan/5 blur-[140px] pointer-events-none -z-10 rounded-full hidden sm:block" />
      <div className="absolute top-96 right-1/4 w-[450px] h-[280px] bg-amber-500/5 blur-[120px] pointer-events-none -z-10 rounded-full hidden sm:block" />

      <div className="max-w-5xl mx-auto flex flex-col items-center relative z-10 w-full px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="w-full flex items-center justify-between mb-8 gap-4 flex-wrap">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Contact" }]}
          />
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Say hello</span>
          </div>
        </div>

        {/* Header Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-300 uppercase tracking-widest">
            <IconMessageCode className="w-3.5 h-3.5" />
            <span>A NOTE TO FRED</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 heading-editorial">
            Let’s talk.
          </h1>
          <p className="text-sm sm:text-base font-mono text-zinc-400 leading-relaxed">
            Have something you want to build, a role I might fit, or a question
            about a project? I’d like to hear it.
          </p>
        </div>

        {/* Two-Column Grid: Contact Form & Alternative Channels */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Main Column: Contact Form */}
          <div className="lg:col-span-7 bg-[#13151a]/80 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 border-b border-white/5 pb-4">
              <h2 className="text-lg font-mono font-bold text-white mb-1">
                Send me a message
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                This goes to my inbox. The ordinary email kind.
              </p>
            </div>
            <ContactForm />
          </div>

          {/* Side Column: Schedule Sync & Newsletter */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick 30-Min Chat Card */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-500/10 via-[#13151a] to-[#13151a] border border-amber-500/30 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <IconCalendar className="w-4 h-4" />
                </span>
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] font-mono text-amber-300 uppercase">
                  Google Meet
                </span>
              </div>
              <h3 className="text-sm font-mono font-bold text-white mb-1">
                More of a talking person?
              </h3>
              <p className="text-xs font-mono text-zinc-400 mb-4 leading-relaxed">
                Pick a time for a project chat, an introduction, or a second
                opinion on something tricky.
              </p>
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                <span>Book a Chat</span>
                <IconExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Newsletter Dispatch Card */}
            <NewsletterForm variant="card" />

            {/* Friendly Location & Lore Card with Easter Egg Flip */}
            <button
              type="button"
              onClick={() =>
                setCostcoMode((prev) =>
                  prev === "wholesale" ? "flame" : "wholesale"
                )
              }
              className="w-full text-left p-4 sm:p-5 bg-zinc-900/40 border border-zinc-800 hover:border-amber-500/40 rounded-2xl flex items-center gap-4 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/60 shadow group-hover:scale-105 transition-transform duration-200">
                <Image
                  src={
                    costcoMode === "wholesale"
                      ? "/images/personal/fred-costco-parking-lot.jpg"
                      : "/images/personal/fred-costco-flame-suit.jpg"
                  }
                  alt={
                    costcoMode === "wholesale"
                      ? "Frederick smiling in a Costco Wholesale t-shirt and sunglasses"
                      : "Frederick in a flame ski suit crouched by the Costco Wholesale sign"
                  }
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block truncate">
                    {costcoMode === "wholesale"
                      ? "Based in Minnesota"
                      : "Tactical Flame Mode"}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 group-hover:text-amber-400 transition-colors shrink-0">
                    [flip]
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {costcoMode === "wholesale"
                    ? "Powered by TypeScript, Next.js, canine co-pilot Duck, and occasional Costco wholesale runs."
                    : "When 90s slope flame suits meet the temple of bulk inventory."}
                </p>
              </div>
            </button>

            {/* Verified Network Shortcuts */}
            <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                You can also find me here
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="https://www.linkedin.com/in/frederick-de-ruiter-88012467/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 hover:text-brand-cyan hover:border-brand-cyan/40 transition-colors"
                >
                  <IconBrandLinkedin className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://github.com/fderuiter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 hover:text-brand-cyan hover:border-brand-cyan/40 transition-colors"
                >
                  <IconBrandGithub className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>GitHub</span>
                </a>
              </div>
            </div>

            {/* Privacy & Anti-Spam Notice */}
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-zinc-400">
              <IconShieldLock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Please keep patient details and other sensitive information out
                of your message.
              </span>
            </div>
          </div>
        </div>

        {/* Sequential Next / Prev Navigation */}
        <NextPrevNav
          prev={{
            title: "Book a Chat",
            href: "/schedule",
            label: "Find a Time",
            tag: "30 Min Meeting",
          }}
          next={{
            title: "Project Writeups",
            href: "/case-studies",
            label: "Systems & Architecture",
            tag: "How They Work",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </PageLayout>
  );
}
