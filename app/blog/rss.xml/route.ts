import { NextResponse } from "next/server";
import { GetBlogRssFeedHandler } from "@/lib/services";
import { resolveBaseUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = resolveBaseUrl();
  const result = await new GetBlogRssFeedHandler().execute({ baseUrl });
  const rssFeed = result.success
    ? result.data.xml
    : `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Systems Engineering Dispatches | Frederick de Ruiter</title><link>${baseUrl}/blog</link></channel></rss>`;

  return new NextResponse(rssFeed, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
