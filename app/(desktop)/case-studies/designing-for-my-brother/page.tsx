import CaseStudyPage, {
  generateMetadata as generateCaseStudyMetadata,
} from "@/app/(desktop)/case-studies/[slug]/page";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return generateCaseStudyMetadata({
    params: Promise.resolve({ slug: "designing-for-my-brother" }),
  });
}

export default async function DesigningForMyBrotherRoutePage() {
  return (
    <div className="min-h-dvh">
      <CaseStudyPage
        params={Promise.resolve({ slug: "designing-for-my-brother" })}
      />
    </div>
  );
}
