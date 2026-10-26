import CaseStudyPage, {
  generateMetadata as generateCaseStudyMetadata,
} from "@/app/case-studies/[slug]/page";
import type { Metadata } from "next";

// Daily: each regeneration bills Vercel active CPU, and content writes
// revalidate these paths on demand, so the timer is only a backstop (#2971).
export const revalidate = 86400;

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
