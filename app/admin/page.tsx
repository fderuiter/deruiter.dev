import type { Metadata } from "next";
import { UserButton } from "@clerk/nextjs";
import { PageLayout } from "@/components/PageLayout";
import { getAdminAuthSession } from "@/lib/auth/admin";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { ProjectImageUploader } from "@/components/admin/ProjectImageUploader";
import { CaseStudyService } from "@/lib/services/case-study-service";
import {
  IconDashboard,
  IconFileText,
  IconActivity,
  IconLockCheck,
} from "@tabler/icons-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Author & Admin Console",
  description:
    "Administrative console for managing case studies and telemetry.",
  robots: {
    index: false,
    follow: false,
  },
};

/* jscpd:ignore-start */
export default async function AdminDashboardPage() {
  const session = await getAdminAuthSession();

  if (!session.isAdmin) {
    return (
      <PageLayout variant="standard">
        <AdminAccessDenied
          userId={session.userId}
          primaryEmail={session.primaryEmail}
          displayName={session.displayName}
        />
      </PageLayout>
    );
  }

  const { userId, primaryEmail, displayName } = session;
  const caseStudies = await CaseStudyService.getAllPublishedCaseStudies();
  const projectOptions = caseStudies.map((cs) => ({
    slug: cs.slug,
    title: cs.title,
    hero_image_url: cs.hero_image_url,
  }));

  return (
    <PageLayout variant="standard">
      <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400">
              <IconLockCheck className="w-4 h-4" aria-hidden="true" />
              <span>AUTHENTICATED AUTHOR SESSION</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
              <IconDashboard
                className="w-8 h-8 text-amber-500"
                aria-hidden="true"
              />
              <span>Systems Console</span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Identity: {displayName} ({primaryEmail}) • UID: {userId}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-9 h-9 border border-white/20",
                },
              }}
            />
          </div>
        </header>

        {/* Project Image Uploader Console */}
        <ProjectImageUploader initialProjects={projectOptions} />

        {/* Console Hub Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Blog Authoring & Dispatches */}
          <div className="p-6 rounded-lg border border-white/10 bg-[#0d0e11] flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <IconFileText className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                  Editorial Workflow
                </span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 font-mono">
                Blog Posts & Dispatches
              </h2>
              <p className="text-xs text-zinc-400">
                Draft, preview, publish, and manage systems blog dispatches
                backed by Prisma and shared HTML sanitization.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/admin/blog"
                className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span>Manage Blog Dispatches &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Case Studies Management */}
          <div className="p-6 rounded-lg border border-white/10 bg-[#0d0e11] flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <IconFileText className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                  Content Engine
                </span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 font-mono">
                Case Studies & Drafts
              </h2>
              <p className="text-xs text-zinc-400">
                Review published technical case studies, verify editorial
                markdown ASTs, and inspect draft revisions.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/case-studies"
                className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span>Browse Published Index &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Card 3: Live Telemetry & Health */}
          <div className="p-6 rounded-lg border border-white/10 bg-[#0d0e11] flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <IconActivity className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                  Edge Observability
                </span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 font-mono">
                Edge Telemetry Stream
              </h2>
              <p className="text-xs text-zinc-400">
                Inspect anonymized client SHA-256 fingerprint event queues,
                Redis buffer synchronization, and route performance.
              </p>
            </div>

            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Buffer Pipeline Active</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
/* jscpd:ignore-end */
}
