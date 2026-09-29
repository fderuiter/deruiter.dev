import type { Metadata, Viewport } from "next";
import { Lexend, Atkinson_Hyperlegible, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SkipToContent } from "@/components/SkipToContent";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  getUnifiedGraphSchema,
  getPersonNode,
  getWebsiteNode,
} from "@/lib/seo";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { AudioProvider } from "@/components/providers/AudioProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SearchProvider } from "@/components/providers/SearchProvider";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";
import { PersonaProvider } from "@/components/providers/PersonaProvider";
import { RetroChaosOverlayWrapper } from "@/components/RetroChaosOverlayWrapper";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SearchWrapper } from "@/components/SearchWrapper";
import { GlobalPhotoGallery } from "@/components/GlobalPhotoGallery";
import { resolveBaseUrl } from "@/lib/domain";

import { SerwistRegister } from "@/components/providers/SerwistRegister";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const openDyslexic = localFont({
  src: [
    {
      path: "../public/fonts/opendyslexic-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/opendyslexic-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-opendyslexic",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#090D16",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(resolveBaseUrl()),
  title: {
    template: "%s | Frederick de Ruiter",
    default: "Frederick de Ruiter | Clinical Data, Software & Side Projects",
  },
  description:
    "I’m Fred. I work with clinical data and build useful software, browser games, and the occasional laser loon. Explore my projects and the decisions behind them.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: resolveBaseUrl(),
    siteName: "Frederick de Ruiter Portfolio",
    title: "Frederick de Ruiter | Clinical Data, Software & Side Projects",
    description:
      "I’m Fred. I work with clinical data and build useful software, browser games, and the occasional laser loon. Explore my projects and the decisions behind them.",
    images: [
      {
        url: `${resolveBaseUrl()}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Frederick de Ruiter | Clinical Data, Software & Side Projects",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@laser_loon",
    title: "Frederick de Ruiter | Clinical Data, Software & Side Projects",
    description:
      "I’m Fred. I work with clinical data and build useful software, browser games, and the occasional laser loon. Explore my projects and the decisions behind them.",
    images: [`${resolveBaseUrl()}/twitter-image`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${atkinson.variable} ${lexend.variable} ${geistMono.variable} ${openDyslexic.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: getUnifiedGraphSchema([getPersonNode(), getWebsiteNode()]),
          }}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Systems Engineering Dispatches"
          href="/blog/rss.xml"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
                (function() {
                  try {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    var storedFont = localStorage.getItem('portfolio-font-mode');
                    if (storedFont === 'opendyslexic' || (storedFont && JSON.parse(storedFont) === 'opendyslexic')) {
                      document.documentElement.setAttribute('data-font-mode', 'opendyslexic');
                    }
                  } catch(e) {}
                })();
              `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-foreground antialiased">
        <SkipToContent />
        <PersonaProvider>
          <TerminologyProvider>
            <SearchProvider>
              <A11yProvider>
                <ToastProvider>
                  <AudioProvider>
                    <Navbar />
                    <main
                      id="main-content"
                      tabIndex={-1}
                      className="flex-grow flex flex-col focus:outline-none"
                    >
                      {children}
                    </main>
                    <Footer />
                    <RetroChaosOverlayWrapper />
                    <Analytics />
                    <SpeedInsights />
                    <SearchWrapper />
                    <GlobalPhotoGallery />
                    <SerwistRegister />
                  </AudioProvider>
                </ToastProvider>
              </A11yProvider>
            </SearchProvider>
          </TerminologyProvider>
        </PersonaProvider>
      </body>
    </html>
  );
}
