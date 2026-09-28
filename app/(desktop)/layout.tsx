import React from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AudioProvider } from "@/components/providers/AudioProvider";
import { RetroChaosOverlayWrapper } from "@/components/RetroChaosOverlayWrapper";
import { SearchWrapper } from "@/components/SearchWrapper";
import { GlobalPhotoGallery } from "@/components/GlobalPhotoGallery";

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioProvider>
      <Navbar />
      {children}
      <Footer />
      <RetroChaosOverlayWrapper />
      <SearchWrapper />
      <GlobalPhotoGallery />
    </AudioProvider>
  );
}
