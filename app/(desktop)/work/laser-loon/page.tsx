import CaseStudyPage, {
  generateMetadata as generateCSMetadata,
} from "@/app/(desktop)/case-studies/[slug]/page";
import type { Metadata } from "next";
import { resolveBaseUrl } from "@/lib/domain";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseMeta = await generateCSMetadata({
    params: Promise.resolve({ slug: "laser-loon" }),
  });

  return {
    ...baseMeta,
    title: "The Laser Loon: Design Case Study",
    description:
      "Comprehensive graphic design case study and open vector asset distribution hub for the Laser Loon (MN Flag Submission F277). Download source .ai, .eps, .pdf, .svg, .psd, .png, and .jpg master files.",
    alternates: {
      canonical: "/work/laser-loon",
    },
    openGraph: {
      ...baseMeta.openGraph,
      title: "The Laser Loon: Design Case Study",
      description:
        "Comprehensive graphic design case study and open vector asset distribution hub for the Laser Loon (MN Flag Submission F277). Download source .ai, .eps, .pdf, .svg, .psd, .png, and .jpg master files.",
      url: "/work/laser-loon",
      images: [
        {
          url: `${resolveBaseUrl()}/work/laser-loon/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "The Laser Loon: Design Case Study",
        },
      ],
    },
    twitter: {
      ...baseMeta.twitter,
      images: [`${resolveBaseUrl()}/work/laser-loon/opengraph-image`],
    },
  };
}

export default async function LaserLoonWorkPage() {
  return (
    <div className="min-h-dvh">
      <CaseStudyPage params={Promise.resolve({ slug: "laser-loon" })} />
    </div>
  );
}
