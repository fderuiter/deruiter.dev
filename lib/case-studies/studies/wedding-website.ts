import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-4",
    slug: "wedding-website",
    title: "Our Wedding Website: A Registry, a Heart, and a Lapsed Domain",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/wedding_website",
    interactive_url: "/wedding",
    interactive_label: "See the wedding archive",
    published: true,
    simulated_telemetry: false,
    hero_image_url: "/images/wedding/12-first-dance.jpg",
    tags: "TypeScript, Next.js, React, Tailwind CSS, Prisma, PostgreSQL, Neon, Vercel, React Three Fiber, Build vs Buy",
    editorial_content:
      "The website for our 10/10/25 wedding: a **Next.js** and **Prisma** site with a custom registry that fills itself in from a pasted product link, group gifts, and a 3D heart. RSVPs went through an iCloud invite on purpose. A year later the domain had lapsed, so the site lives on as a static archive.",
    architectural_narrative: `<h3>The problem</h3>
<p>Abbi and I got married on 10 October 2025 at the Plummer House in Rochester, Minnesota, for under $4,000. The free wedding platforms are free because they sell to you: vendor ads, upsells, and a registry that takes a cut. I wanted a site that looked like us, pushed nothing at our guests, and kept their names off a marketing list. I'm also an engineer, so "how hard can it be?" was always going to win.</p>
<p><strong>The approach:</strong> A Next.js site with a home page (our story, the schedule, the venue, travel notes and an FAQ), a custom registry, a wedding party page, things to do in Rochester, a forecast for the day, a photo gallery, and an admin page so Abbi could edit the registry without me. The first commit was 11 April 2025. By the last release before the wedding the repository had 171 commits.</p>
<p><strong>What it deliberately did not do:</strong> RSVPs. The RSVP page was a button linking to an iCloud invite. RSVPs are where real guest data, plus-ones, kids and deadlines meet, and a solved tool was worth more there than a custom one.</p>

<h3>How it works</h3>
<p><strong>Stack:</strong> Next.js 15 with the App Router, React 19, Tailwind CSS 4, and Prisma 6 over PostgreSQL on Neon's free tier, deployed on Vercel. Hosting cost nothing; the domain was about $11 a year.</p>
<p><strong>The registry:</strong> Two tables, <code>RegistryItem</code> and <code>Contributor</code>. To add an item you paste a product link. <code>open-graph-scraper</code> reads the title, description and image from the page's Open Graph tags; when an Amazon page has no usable image, a Cheerio fallback pulls the main product image out of the HTML. Any item can be a group gift, and a progress bar shows how close it is.</p>
<p><strong>The admin page:</strong> A password checked against an environment variable sets an HTTP-only cookie for eight hours. The registry's add, edit and delete routes check that cookie.</p>
<p><strong>The rest:</strong> A weather page asks Open-Meteo for the Rochester forecast on the wedding date. A "Play with the Heart" button in the footer opens a React Three Fiber scene: a gold-and-silver heart in a cloud of sparkles, with Rapier physics so you can drag it around.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Guest] --> B[Home, schedule, FAQ, wedding party]
    A --> C[Registry]
    A --> R[RSVP button]
    R --> S[iCloud invite]
    C --> D[Contribute to an item]
    D --> E[Prisma transaction]
    E --> F[(Postgres on Neon)]
    G[Abbi or Fred] --> H[Admin login]
    H --> I[Paste a product link]
    I --> J[Open Graph scraper, Amazon fallback]
    J --> F
</code></pre>

<h3>Implementation notes</h3>

<h4>Recording a contribution (<code>src/features/registry/repository.ts</code>)</h4>
<pre><code class="language-typescript">
static async contributeToItem(
  itemId: string,
  contribution: { name: string; amount: number }
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.registryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      // This should ideally not be reached if service layer validation is correct
      throw new Error('Item not found');
    }

    const newTotal = item.amountContributed + contribution.amount;

    const updatedItem = await tx.registryItem.update({
      where: { id: itemId },
      data: {
        amountContributed: newTotal,
        purchased: newTotal &gt;= item.price,
        contributors: {
          create: {
            name: contribution.name,
            amount: contribution.amount,
            date: new Date()
          }
        }
      },
      include: {
        contributors: true
      }
    });

    return updatedItem;
  });
}
</code></pre>
<p>The total and the contributor row are written together. The service layer checks that the amount is positive and no more than what is left before it calls this. That check runs outside the transaction, so two guests chipping in at the same moment could, in principle, push an item past its price. With about a hundred guests it never came up, but the check belongs inside the transaction.</p>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>The registry was worth building.</strong> Pasting a link from any store and letting guests chip in toward bigger items gave us what the commercial registries charge for or limit to partner stores, with no platform fee.</li>
  <li><strong>The data moved three times.</strong> It started in a JSON file, moved to SQLite through Prisma, and ended up on Postgres on Neon when the site went to Vercel. Starting on the database it would deploy to would have saved two migrations.</li>
  <li><strong>The admin cookie was too simple.</strong> The cookie only said <code>true</code>. It was HTTP-only and the password lived in an environment variable, but a signed session token is the version I'd ship now.</li>
  <li><strong>Scope creep is the default.</strong> The first idea was rings flying around each other, merging into a heart, then transitioning into the home page. It looked awful. I kept the heart and cut the rest, after the time was spent.</li>
  <li><strong>Nothing stays up on its own.</strong> A commercial wedding site lives as long as the company does. Ours lived exactly as long as I remembered to renew the domain, which I didn't. For our first anniversary the story, photos and wedding party came back as a static page on this site, with no guest or registry data, at <a href="/wedding">deruiter.dev/wedding</a>.</li>
</ul>
<p>Since the wedding the repository has kept going as a general, self-hostable wedding site. This write-up describes the version our guests used.</p>
<h3>Sources</h3>
<p>Everything above is checked against commit <code>75c6524</code>, the last release before the wedding.</p>
<ul>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/prisma/schema.prisma" target="_blank" rel="noopener noreferrer"><code>prisma/schema.prisma</code></a>: the registry schema</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/features/registry/api/scrape.ts" target="_blank" rel="noopener noreferrer"><code>src/features/registry/api/scrape.ts</code></a>: the product-link scraper</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/features/registry/repository.ts" target="_blank" rel="noopener noreferrer"><code>src/features/registry/repository.ts</code></a>: the contribution transaction</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/features/registry/service.ts" target="_blank" rel="noopener noreferrer"><code>src/features/registry/service.ts</code></a>: the contribution checks</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/app/api/admin/login/route.ts" target="_blank" rel="noopener noreferrer"><code>src/app/api/admin/login/route.ts</code></a>: the admin login</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/app/rsvp/page.tsx" target="_blank" rel="noopener noreferrer"><code>src/app/rsvp/page.tsx</code></a>: the RSVP page</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/src/app/heart/page.tsx" target="_blank" rel="noopener noreferrer"><code>src/app/heart/page.tsx</code></a>: the heart</li>
  <li><a href="https://github.com/fderuiter/wedding_website/blob/75c6524/PROJECT_HISTORY.md" target="_blank" rel="noopener noreferrer"><code>PROJECT_HISTORY.md</code></a>: the JSON, SQLite and Postgres history</li>
</ul>`,
    created_at: new Date("2026-02-10T00:00:00Z"),
    updated_at: new Date("2026-10-11T00:00:00Z"),
  });
