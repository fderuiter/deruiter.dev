"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconCalendar,
  IconClock,
  IconVideo,
  IconMail,
  IconMessageCode,
  IconExternalLink,
  IconShieldCheck,
  IconCpu,
  IconBrain,
  IconCheck,
} from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { ContactForm } from "@/components/ContactForm";

const GOOGLE_CALENDAR_URL = "https://calendar.app.google/YnR5oxos7ZTLyvUp8";

const CONSULTATION_TOPICS = [
  {
    icon: <IconCpu className="w-5 h-5 text-brand-cyan" />,
    title: "Code, Systems & Web Craft",
    description:
      "Next.js, TypeScript, canvas physics, reactive UI experiments, and open-source side projects.",
  },
  {
    icon: <IconShieldCheck className="w-5 h-5 text-brand-cyan" />,
    title: "Healthcare & Clinical Data",
    description:
      "GxP eClinical systems, CDISC standards, neuroinformatics pipelines, or venting about medical software.",
  },
  {
    icon: <IconBrain className="w-5 h-5 text-brand-cyan" />,
    title: "Saying Hi & Bouncing Ideas",
    description:
      "Casual chats, side project feedback, civic tech ideas, or talking about dogs and video games.",
  },
];

export default function SchedulePage() {
  return (
    <PageLayout
      variant="standard"
      className="bg-zinc-950 text-foreground relative overflow-hidden"
    >
      {/* Ambient Atmospheric Glows */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-brand-cyan/5 blur-[140px] pointer-events-none -z-10 rounded-full hidden sm:block" />
      <div className="absolute top-96 right-1/4 w-[450px] h-[280px] bg-brand-blue/5 blur-[120px] pointer-events-none -z-10 rounded-full hidden sm:block" />

      <div className="max-w-5xl mx-auto flex flex-col items-center relative z-10 w-full">
        {/* Navigation Breadcrumb */}
        <div className="w-full flex items-center justify-between mb-8 gap-4 flex-wrap">
          <Breadcrumbs
            items={[
              { label: "Connect", href: "/#contact" },
              { label: "Say Hi & Book a Chat" },
            ]}
          />
          <div className="flex items-center gap-2 text-xs font-mono text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
            <span>Choose a time</span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="text-center max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 mb-4">
            <IconCalendar className="w-3.5 h-3.5 text-brand-cyan" />
            <span>30 minutes on Google Meet</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-mono text-white tracking-tight mb-4">
            Say Hi &amp; Book a Chat
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 font-sans leading-relaxed">
            Let’s spend half an hour talking about what you’re working on. Bring
            a question, an idea, or just yourself. The booking link handles the
            calendar details.
          </p>
        </div>

        {/* Host & Co-Pilot Greeting Card */}
        <div className="w-full max-w-2xl mb-10 p-4 sm:p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row items-center gap-5 shadow-lg">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-black/60 shadow-md">
            <Image
              src="/images/bio/fred-duck-shoulder.jpg"
              alt="Frederick de Ruiter smiling warmly with his canine co-pilot Duck resting his chin over Fred's shoulder"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-white">
                Frederick de Ruiter
              </span>
              <span className="text-xs font-mono text-zinc-400">
                • Canine Co-Pilot Duck
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-2">
              Clinical software engineering, distributed systems, web
              experiments, and talking about dogs and video games.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-3 text-[11px] font-mono text-brand-cyan">
              <span>● Based in Minnesota</span>
              <span className="text-zinc-600">/</span>
              <span>● Google Meet</span>
              <span className="text-zinc-600">/</span>
              <span>● 30-min chat</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
          {CONSULTATION_TOPICS.map((topic, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 hover:border-brand-cyan/30 transition-all flex flex-col justify-start"
            >
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 w-fit mb-3">
                {topic.icon}
              </div>
              <h2 className="text-sm font-mono font-bold text-white mb-1.5">
                {topic.title}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {topic.description}
              </p>
            </div>
          ))}
        </div>

        {/* Interactive Booking Action Card */}
        <div className="w-full p-8 md:p-12 rounded-3xl bg-zinc-900/30 border border-zinc-800/80 hover:border-brand-cyan/40 transition-all shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-cyan/5 rounded-full blur-[100px] pointer-events-none hidden sm:block" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-blue/5 rounded-full blur-[100px] pointer-events-none hidden sm:block" />

          <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center mb-6 text-brand-cyan shadow-[0_0_25px_rgba(6,182,212,0.2)]">
            <IconCalendar className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white mb-3 tracking-tight">
            Find a time that works.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mb-8 leading-relaxed font-sans">
            Pick a time that works best for you on Google Calendar. It will
            automatically generate a Google Meet video link and send an invite
            directly to your inbox.
          </p>

          <a
            href={GOOGLE_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-brand-cyan text-zinc-950 font-mono font-bold text-sm hover:bg-white transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-105 cursor-pointer"
          >
            <span>Choose a Time</span>
            <IconExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>

          {/* Booking Specs Pills */}
          <div className="mt-10 pt-8 border-t border-zinc-800/60 w-full flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-2">
              <IconClock className="w-4 h-4 text-brand-cyan" />
              <span>30-Minute Chats</span>
            </span>
            <span className="flex items-center gap-2">
              <IconVideo className="w-4 h-4 text-brand-cyan" />
              <span>Google Meet</span>
            </span>
            <span className="flex items-center gap-2">
              <IconMail className="w-4 h-4 text-brand-cyan" />
              <span>Email Confirmation</span>
            </span>
          </div>
        </div>

        {/* Direct Contact Alternative Endpoints */}
        <div className="mt-12 pt-8 border-t border-zinc-900/80 w-full flex flex-col items-center text-center">
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
            Prefer direct email or messaging?
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-brand-cyan hover:border-brand-cyan/40 transition-colors"
            >
              <IconMessageCode className="w-4 h-4 text-brand-cyan" />
              <span>Send a Message</span>
            </Link>
            <a
              href="https://www.linkedin.com/in/frederick-de-ruiter-88012467/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-brand-cyan hover:border-brand-cyan/40 transition-colors"
            >
              <IconCheck className="w-4 h-4 text-brand-cyan" />
              <span>LinkedIn Profile</span>
              <IconExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </a>
          </div>

          <div className="w-full max-w-2xl text-left">
            <ContactForm initialIntent="consulting" />
          </div>
        </div>

        {/* Sequential Next / Prev Flow */}
        <NextPrevNav
          prev={{
            title: "Incident Alignment Simulator",
            href: "/simulator",
            label: "Systems Tool",
            tag: "Incident Commander",
          }}
          next={{
            title: "Arcade Games Hub",
            href: "/arcade",
            label: "Interactive Labs",
            tag: "6 Playable Games",
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
