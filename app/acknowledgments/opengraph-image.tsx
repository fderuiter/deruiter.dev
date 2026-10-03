import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Open Source Credits and Licenses | Frederick de Ruiter";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "OPEN SOURCE ACKNOWLEDGMENTS",
    title: "Open Source Credits and Licenses",
    description:
      "The open source projects this site is built on, each linked to its home, with versions, licenses and full notice texts.",
    badge: "CREDITS // LICENSES",
    tags: ["Next.js", "React", "Tailwind CSS", "SPDX", "Third-Party Notices"],
    systemStatus: "LICENSE COMPLIANT",
  });
}
