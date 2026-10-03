"use client";

import React, { useState, useMemo } from "react";
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
  IconCopy,
  IconWorld,
  IconSparkles,
} from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { ContactForm } from "@/components/ContactForm";
import { ARCADE_GAME_COUNT } from "@/lib/arcade";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { SCHEDULE_FAQ } from "@/lib/faq-content";
import { useClipboard } from "@/hooks/useClipboard";

const GOOGLE_CALENDAR_URL = "https://calendar.app.google/YnR5oxos7ZTLyvUp8";

interface SubTopic {
  id: string;
  title: string;
  duration: number; // in minutes
}

interface TopicCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  subtopics: SubTopic[];
}

const CONSULTATION_TOPICS: TopicCategory[] = [
  {
    id: "code-systems",
    title: "Code, Systems & Web Craft",
    description:
      "Next.js, TypeScript, canvas physics, reactive UI experiments, and open-source side projects.",
    icon: <IconCpu className="w-5 h-5 text-brand-cyan" />,
    subtopics: [
      {
        id: "code-arch",
        title: "Next.js & React 19 Architecture",
        duration: 10,
      },
      {
        id: "code-canvas",
        title: "Canvas Physics & UI Engineering",
        duration: 10,
      },
      {
        id: "code-dx",
        title: "Open-Source Tooling & DX",
        duration: 10,
      },
    ],
  },
  {
    id: "healthcare-data",
    title: "Healthcare & Clinical Data",
    description:
      "GxP eClinical systems, CDISC standards, neuroinformatics pipelines, or venting about medical software.",
    icon: <IconShieldCheck className="w-5 h-5 text-brand-cyan" />,
    subtopics: [
      {
        id: "health-eclinical",
        title: "GxP & eClinical Architecture",
        duration: 15,
      },
      {
        id: "health-cdisc",
        title: "CDISC Standards & Pipelines",
        duration: 10,
      },
      {
        id: "health-neuro",
        title: "Neuroinformatics & Med Tech",
        duration: 10,
      },
    ],
  },
  {
    id: "saying-hi",
    title: "Saying Hi & Bouncing Ideas",
    description:
      "Casual chats, side project feedback, civic tech ideas, or talking about dogs and video games.",
    icon: <IconBrain className="w-5 h-5 text-brand-cyan" />,
    subtopics: [
      {
        id: "ideas-feedback",
        title: "Side Project Strategy & Feedback",
        duration: 15,
      },
      {
        id: "ideas-civic",
        title: "Civic Tech & Open Ideas",
        duration: 10,
      },
      {
        id: "ideas-casual",
        title: "Dogs, Video Games & Casual Chat",
        duration: 10,
      },
    ],
  },
];

const COMMON_TIMEZONES = [
  { label: "US Central (America/Chicago)", value: "America/Chicago" },
  { label: "US Eastern (America/New_York)", value: "America/New_York" },
  { label: "US Mountain (America/Denver)", value: "America/Denver" },
  { label: "US Pacific (America/Los_Angeles)", value: "America/Los_Angeles" },
  { label: "Europe/London (GMT/BST)", value: "Europe/London" },
  { label: "UTC (Coordinated Universal Time)", value: "UTC" },
];

function getInitialTimeZone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

export default function SchedulePage() {
  const [selectedSubtopics, setSelectedSubtopics] = useState<
    Record<string, boolean>
  >({});
  const [selectedTimeZone, setSelectedTimeZone] =
    useState<string>(getInitialTimeZone);

  const { copy, copied } = useClipboard({
    successMessage: "Agenda summary copied to clipboard!",
  });

  const toggleSubtopic = (subtopicId: string) => {
    setSelectedSubtopics((prev) => ({
      ...prev,
      [subtopicId]: !prev[subtopicId],
    }));
  };

  const toggleCategory = (category: TopicCategory) => {
    const categorySubtopicIds = category.subtopics.map((s) => s.id);
    const allSelected = categorySubtopicIds.every(
      (id) => selectedSubtopics[id]
    );

    setSelectedSubtopics((prev) => {
      const next = { ...prev };
      categorySubtopicIds.forEach((id) => {
        next[id] = !allSelected;
      });
      return next;
    });
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedSubtopics).filter(Boolean).length;
  }, [selectedSubtopics]);

  const { totalMinutes, selectedSubtopicsList, selectedCategories } =
    useMemo(() => {
      const list: {
        categoryTitle: string;
        subtopicTitle: string;
        duration: number;
      }[] = [];
      const categoriesSet = new Set<string>();
      let mins = 0;

      for (const category of CONSULTATION_TOPICS) {
        for (const subtopic of category.subtopics) {
          if (selectedSubtopics[subtopic.id]) {
            list.push({
              categoryTitle: category.title,
              subtopicTitle: subtopic.title,
              duration: subtopic.duration,
            });
            categoriesSet.add(category.title);
            mins += subtopic.duration;
          }
        }
      }

      return {
        totalMinutes: list.length > 0 ? mins : 30, // Fallback to 30 mins if none selected
        selectedSubtopicsList: list,
        selectedCategories: Array.from(categoriesSet),
      };
    }, [selectedSubtopics]);

  const computedSubject = useMemo(() => {
    if (selectedCategories.length === 0) {
      return "30-Min General Chat";
    }
    const topicStr = selectedCategories.join(", ");
    const subject = `Chat Agenda: ${topicStr}`;
    return subject.length > 150 ? subject.slice(0, 147) + "..." : subject;
  }, [selectedCategories]);

  const computedMessage = useMemo(() => {
    if (selectedSubtopicsList.length === 0) {
      return `30-minute general chat (Timezone: ${selectedTimeZone}). Looking forward to connecting!`;
    }

    const grouped: Record<string, string[]> = {};
    for (const item of selectedSubtopicsList) {
      if (!grouped[item.categoryTitle]) {
        grouped[item.categoryTitle] = [];
      }
      grouped[item.categoryTitle].push(
        `${item.subtopicTitle} (${item.duration}m)`
      );
    }

    const itemsSummary = Object.entries(grouped)
      .map(([cat, subItems]) => `- ${cat}:\n  • ${subItems.join("\n  • ")}`)
      .join("\n");

    return `Proposed Agenda (Estimated Duration: ${totalMinutes} mins | Timezone: ${selectedTimeZone}):\n${itemsSummary}\n\nLooking forward to discussing these focus areas!`;
  }, [selectedSubtopicsList, totalMinutes, selectedTimeZone]);

  const bookingUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0) {
      params.set("subject", computedSubject);
      params.set(
        "agenda",
        selectedSubtopicsList.map((s) => s.subtopicTitle).join(", ")
      );
    }
    params.set("tz", selectedTimeZone);
    const queryString = params.toString();
    return `${GOOGLE_CALENDAR_URL}?${queryString}`;
  }, [
    computedSubject,
    selectedSubtopicsList,
    selectedCategories,
    selectedTimeZone,
  ]);

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
            Let’s spend half an hour talking about what you’re working on.
            Customize your meeting agenda below or send a pre-filled note
            directly.
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
              <span className="text-zinc-400" aria-hidden="true">
                /
              </span>
              <span>● Google Meet</span>
              <span className="text-zinc-400" aria-hidden="true">
                /
              </span>
              <span>● 30-min chat</span>
            </div>
          </div>
        </div>

        {/* Interactive Agenda Customizer Header */}
        <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <IconSparkles className="w-4 h-4 text-brand-cyan" />
              <h2 className="text-lg font-mono font-bold text-white">
                Interactive Agenda Customizer
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Select topics &amp; sub-items to structure our 30-minute chat.
            </p>
          </div>

          {/* Timezone Selector Badge */}
          <div className="flex max-w-full min-w-0 items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-300">
            <IconWorld className="w-4 h-4 text-brand-cyan shrink-0" />
            <span className="text-zinc-400 shrink-0">Time Zone:</span>
            <select
              aria-label="Select Timezone"
              value={selectedTimeZone}
              onChange={(e) => setSelectedTimeZone(e.target.value)}
              className="min-w-0 max-w-full truncate bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
              suppressHydrationWarning
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option
                  key={tz.value}
                  value={tz.value}
                  className="bg-zinc-900 text-white"
                >
                  {tz.label}
                </option>
              ))}
              {!COMMON_TIMEZONES.some(
                (tz) => tz.value === selectedTimeZone
              ) && (
                <option
                  value={selectedTimeZone}
                  className="bg-zinc-900 text-white"
                >
                  {selectedTimeZone}
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Feature Highlights Grid with Interactive Sub-Topics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
          {CONSULTATION_TOPICS.map((category) => {
            const categorySubtopicIds = category.subtopics.map((s) => s.id);
            const isCategorySelected = categorySubtopicIds.some(
              (id) => selectedSubtopics[id]
            );
            const allSubtopicsSelected = categorySubtopicIds.every(
              (id) => selectedSubtopics[id]
            );

            return (
              <div
                key={category.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCategorySelected
                    ? "bg-zinc-900/60 border-brand-cyan/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : "bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                      {category.icon}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        allSubtopicsSelected
                          ? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {allSubtopicsSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <h3 className="text-sm font-mono font-bold text-white mb-1.5">
                    {category.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    {category.description}
                  </p>
                </div>

                {/* Subtopic Items */}
                <div className="space-y-2 pt-3 border-t border-zinc-800/50">
                  {category.subtopics.map((subtopic) => {
                    const active = !!selectedSubtopics[subtopic.id];
                    return (
                      <button
                        key={subtopic.id}
                        type="button"
                        onClick={() => toggleSubtopic(subtopic.id)}
                        aria-pressed={active}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs font-mono transition-all cursor-pointer border ${
                          active
                            ? "bg-brand-cyan/15 border-brand-cyan/40 text-white"
                            : "bg-zinc-950/60 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              active
                                ? "bg-brand-cyan border-brand-cyan text-zinc-950"
                                : "border-zinc-700 bg-transparent"
                            }`}
                          >
                            {active && (
                              <IconCheck className="w-2.5 h-2.5 stroke-[3]" />
                            )}
                          </span>
                          <span className="truncate">{subtopic.title}</span>
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                            active
                              ? "bg-brand-cyan/30 text-brand-cyan"
                              : "bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          +{subtopic.duration}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Agenda Real-time Summary Banner */}
        <div className="w-full mb-10 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Agenda Summary
              </span>
              <span className="text-xs font-mono text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-2 py-0.5 rounded-full">
                {selectedCount > 0
                  ? `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected`
                  : "Default 30-min settings"}
              </span>
            </div>
            <p className="text-sm font-mono font-bold text-white">
              {computedSubject}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-xl">
              <IconClock className="w-4 h-4" />
              <span>Est. {totalMinutes} Mins</span>
            </div>
          </div>
        </div>

        {/* Interactive Booking Action Card */}
        <div className="w-full p-8 md:p-12 rounded-3xl bg-zinc-900/30 border border-zinc-800/80 hover:border-brand-cyan/40 transition-all shadow-2xl relative overflow-hidden flex flex-col items-center text-center mb-12">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-cyan/5 rounded-full blur-[100px] pointer-events-none hidden sm:block" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-blue/5 rounded-full blur-[100px] pointer-events-none hidden sm:block" />

          <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center mb-6 text-brand-cyan shadow-[0_0_25px_rgba(6,182,212,0.2)]">
            <IconCalendar className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white mb-3 tracking-tight">
            Find a time that works.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mb-8 leading-relaxed font-sans">
            Pick a time on Google Calendar. Copy your customized agenda context
            to include in your calendar note, or send a direct pre-filled
            message below.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-brand-cyan text-zinc-950 font-mono font-bold text-sm hover:bg-white transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-105 cursor-pointer"
            >
              <span>Choose a Time</span>
              <IconExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <button
              type="button"
              onClick={() => copy(computedMessage)}
              className={`inline-flex items-center gap-2 px-6 py-4 rounded-2xl font-mono font-bold text-sm transition-all duration-300 cursor-pointer border ${
                copied
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:border-brand-cyan/50 hover:bg-zinc-800"
              }`}
            >
              {copied ? (
                <>
                  <IconCheck className="w-4 h-4 text-emerald-400" />
                  <span>Agenda Copied!</span>
                </>
              ) : (
                <>
                  <IconCopy className="w-4 h-4 text-brand-cyan" />
                  <span>Copy Agenda Context</span>
                </>
              )}
            </button>
          </div>

          {/* Booking Specs Pills */}
          <div className="mt-10 pt-8 border-t border-zinc-800/60 w-full flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-2">
              <IconClock className="w-4 h-4 text-brand-cyan" />
              <span>{totalMinutes}-Minute Session</span>
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

        {/* Direct Contact Alternative Endpoints with Pre-filled Agenda */}
        <div className="mt-4 pt-8 border-t border-zinc-900/80 w-full flex flex-col items-center text-center">
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
              <IconExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>

          <div className="w-full max-w-2xl text-left">
            <ContactForm
              initialIntent="collaboration"
              initialSubject={computedSubject}
              initialMessage={computedMessage}
            />
          </div>
        </div>

        <FAQAccordion
          items={SCHEDULE_FAQ}
          pageUrl="/schedule"
          className="mt-12 mb-4"
        />

        {/* Sequential Next / Prev Flow */}
        <NextPrevNav
          prev={{
            title: "Architectural Archetype Simulator",
            href: "/simulator",
            label: "Systems Tool",
            tag: "Incident Commander",
          }}
          next={{
            title: "Arcade Games Hub",
            href: "/arcade",
            label: "Interactive Labs",
            tag: `${ARCADE_GAME_COUNT} Playable Games`,
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
