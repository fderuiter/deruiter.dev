import React from "react";
import Image from "next/image";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ExternalLink } from "@/components/acknowledgments/ExternalLink";
import { getNavBreadcrumbParents } from "@/lib/navigation";
import {
  WEDDING_ALBUM_URL,
  WEDDING_DETAILS,
  WEDDING_PARTY,
  WEDDING_PHOTOS,
  WEDDING_SOURCE_URL,
  WEDDING_STORY,
} from "@/lib/wedding-archive";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4">
      <dt className="font-mono text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm leading-relaxed text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

export function WeddingArchiveView() {
  return (
    <div className="bg-zinc-950 px-4 pb-24 text-foreground sm:px-6 md:px-12 lg:px-24">
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-16">
        <header className="space-y-5">
          <Breadcrumbs
            items={[
              ...getNavBreadcrumbParents("/wedding"),
              { label: "Our Wedding" },
            ]}
          />
          <p className="font-mono text-xs uppercase tracking-wider text-amber-400">
            <time dateTime={WEDDING_DETAILS.date}>
              {WEDDING_DETAILS.dateLabel}
            </time>{" "}
            · One year on
          </p>
          <h1 className="break-words text-3xl font-bold tracking-[-0.035em] text-zinc-50 sm:text-5xl">
            {WEDDING_DETAILS.couple}
          </h1>
          <p className="max-w-3xl break-words text-base leading-relaxed text-zinc-300">
            This is an archive of the website we made for our wedding, put back
            up for our first anniversary. The guest list, RSVPs and registry
            have been retired; the story, the people and the photos stay here.
          </p>
        </header>

        <section aria-labelledby="wedding-photos" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2
              id="wedding-photos"
              className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
            >
              Photos
            </h2>
            <ExternalLink
              href={WEDDING_ALBUM_URL}
              className="text-sm text-zinc-300"
            >
              See the full album on Google Photos
            </ExternalLink>
          </div>
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {WEDDING_PHOTOS.map((photo, index) => (
              <li key={photo.src} className="mb-4 break-inside-avoid">
                <a
                  href={photo.src}
                  className="block overflow-hidden rounded-lg border border-white/[0.08] bg-[#13151a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={photo.width}
                    height={photo.height}
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
                    priority={index === 0}
                    className="h-auto w-full"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="wedding-story" className="space-y-6">
          <h2
            id="wedding-story"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Our story
          </h2>
          <div className="max-w-3xl space-y-4">
            {WEDDING_STORY.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="break-words text-base leading-relaxed text-zinc-300"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="wedding-day" className="space-y-6">
          <h2
            id="wedding-day"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            The day
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail
              label="Date"
              value={
                <time dateTime={WEDDING_DETAILS.date}>
                  {WEDDING_DETAILS.dateLabel}
                </time>
              }
            />
            <Detail
              label="Venue"
              value={
                <>
                  <ExternalLink href={WEDDING_DETAILS.venueUrl}>
                    {WEDDING_DETAILS.venue}
                  </ExternalLink>
                  , {WEDDING_DETAILS.city}
                </>
              }
            />
            <Detail label="Ceremony" value={WEDDING_DETAILS.ceremony} />
            <Detail label="Reception" value={WEDDING_DETAILS.reception} />
            <Detail label="Attire" value={WEDDING_DETAILS.attire} />
          </dl>
        </section>

        <section aria-labelledby="wedding-party" className="space-y-6">
          <h2
            id="wedding-party"
            className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50"
          >
            Wedding party
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WEDDING_PARTY.map((member) => (
              <li
                key={member.name}
                className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
              >
                <p className="break-words text-sm font-semibold text-zinc-100">
                  {member.name}
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-wider text-amber-400">
                  {member.role}
                </p>
                <p className="mt-1 break-words text-sm text-zinc-400">
                  {member.relation}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="space-y-2 border-t border-white/[0.08] pt-8 text-sm text-zinc-400">
          <p className="break-words">
            Thank you to everyone who celebrated with us, traveled to Rochester
            and helped make the day ours.
          </p>
          <p className="break-words">
            The original site was a full Next.js app with a registry, seating
            chart and admin dashboard. Its source is on{" "}
            <ExternalLink href={WEDDING_SOURCE_URL}>GitHub</ExternalLink>.
          </p>
        </footer>
      </div>
    </div>
  );
}
