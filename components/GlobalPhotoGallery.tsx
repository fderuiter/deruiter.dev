"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAppEvent } from "@/hooks/useAppEvent";

const PhotoGalleryModal = dynamic(
  () => import("./PhotoGalleryModal").then((mod) => mod.PhotoGalleryModal),
  { ssr: false }
);

/**
 * GlobalPhotoGallery listens for the 'open-photo-gallery' custom event
 * and displays the PhotoGalleryModal across any page without prop drilling.
 */
export function GlobalPhotoGallery() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialPhotoId, setInitialPhotoId] = useState<string | undefined>(
    undefined
  );

  useAppEvent("open-photo-gallery", (detail) => {
    setInitialPhotoId(detail?.photoId || undefined);
    setIsOpen(true);
  });

  if (!isOpen) return null;

  return (
    <PhotoGalleryModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      initialPhotoId={initialPhotoId}
    />
  );
}
