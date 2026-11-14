"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconCamera,
  IconTag,
  IconBone,
  IconRun,
  IconSparkles,
} from "@tabler/icons-react";
import { PORTFOLIO_PHOTOS, PortfolioPhoto } from "@/lib/media-registry";
import { ModalContainer } from "@/components/ui/ModalContainer";

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhotoId?: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  initialPhotoId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "bio" | "duck" | "sports" | "personal"
  >("all");
  const [activePhoto, setActivePhoto] = useState<PortfolioPhoto | null>(() => {
    if (initialPhotoId) {
      return PORTFOLIO_PHOTOS.find((p) => p.id === initialPhotoId) || null;
    }
    return null;
  });
  const filteredPhotos = useMemo(
    () =>
      selectedCategory === "all"
        ? PORTFOLIO_PHOTOS
        : PORTFOLIO_PHOTOS.filter((p) => p.category === selectedCategory),
    [selectedCategory]
  );

  useEffect(() => {
    if (initialPhotoId) {
      const found = PORTFOLIO_PHOTOS.find((p) => p.id === initialPhotoId);
      if (found) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActivePhoto(found);
      }
    }
  }, [initialPhotoId]);

  const lastClickedPhotoIdRef = useRef<string | null>(null);
  const pendingFocusPhotoIdRef = useRef<string | null>(null);
  const shouldFocusBackButtonRef = useRef<boolean>(Boolean(initialPhotoId));
  const prevActivePhotoRef = useRef<PortfolioPhoto | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const restoreThumbnailFocus = useCallback(() => {
    const targetPhotoId = pendingFocusPhotoIdRef.current;
    if (!targetPhotoId) return;

    const targetId = filteredPhotos.some((p) => p.id === targetPhotoId)
      ? targetPhotoId
      : filteredPhotos[0]?.id;

    if (targetId) {
      const btn =
        thumbnailRefs.current.get(targetId) ||
        (gridRef.current?.querySelector(
          `button[data-photo-id="${targetId}"]`
        ) as HTMLButtonElement | null);

      if (btn) {
        btn.focus();
        pendingFocusPhotoIdRef.current = null;
        lastClickedPhotoIdRef.current = null;
      }
    }
  }, [filteredPhotos]);

  const handleCloseLightbox = useCallback(() => {
    shouldFocusBackButtonRef.current = false;
    if (lastClickedPhotoIdRef.current) {
      pendingFocusPhotoIdRef.current = lastClickedPhotoIdRef.current;
    }
    setActivePhoto(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      lastClickedPhotoIdRef.current = null;
      pendingFocusPhotoIdRef.current = null;
      shouldFocusBackButtonRef.current = false;
      prevActivePhotoRef.current = null;
      return;
    }

    if (activePhoto && !prevActivePhotoRef.current) {
      // Lightbox view mounted - move focus to the back button
      shouldFocusBackButtonRef.current = true;
      if (backButtonRef.current) {
        backButtonRef.current.focus();
        shouldFocusBackButtonRef.current = false;
      }
    } else if (!activePhoto && prevActivePhotoRef.current) {
      // Lightbox view closed - restore focus to clicked thumbnail if one was recorded
      if (lastClickedPhotoIdRef.current) {
        pendingFocusPhotoIdRef.current = lastClickedPhotoIdRef.current;
        restoreThumbnailFocus();
      }
    }

    prevActivePhotoRef.current = activePhoto;
  }, [activePhoto, isOpen, restoreThumbnailFocus]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (
        e.key === "Escape" ||
        (activePhoto && (e.key === "ArrowRight" || e.key === "ArrowLeft"))
      ) {
        // Claim the key so page-level listeners (arcade controls) ignore it
        e.preventDefault();
      }

      if (e.key === "Escape") {
        if (activePhoto) {
          handleCloseLightbox();
        } else {
          onClose();
        }
      } else if (e.key === "ArrowRight" && activePhoto) {
        const currIdx = filteredPhotos.findIndex(
          (p) => p.id === activePhoto.id
        );
        if (currIdx !== -1) {
          const nextIdx = (currIdx + 1) % filteredPhotos.length;
          setActivePhoto(filteredPhotos[nextIdx]);
        }
      } else if (e.key === "ArrowLeft" && activePhoto) {
        const currIdx = filteredPhotos.findIndex(
          (p) => p.id === activePhoto.id
        );
        if (currIdx !== -1) {
          const prevIdx =
            (currIdx - 1 + filteredPhotos.length) % filteredPhotos.length;
          setActivePhoto(filteredPhotos[prevIdx]);
        }
      }
    },
    [isOpen, activePhoto, filteredPhotos, onClose, handleCloseLightbox]
  );

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      titleId="photo-gallery-title"
      closeOnEscape={false}
      onKeyDown={handleKeyDown}
      maxWidth="max-w-5xl"
      overlayClassName="p-3 sm:p-6 backdrop-blur-md"
      className="bg-[#121418] border-white/10 rounded-3xl overflow-hidden"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
            <IconCamera className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="photo-gallery-title"
              className="text-lg font-mono font-bold text-white"
            >
              Behind the Code · Visual Archive
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Duck&apos;s growth journey, Theodore Wirth mud runs, 90s flame ski
              gear, and Costco bulk snacks.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo gallery"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Category Filter Pills */}
      <div
        role="group"
        aria-label="Filter photos by category"
        className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-black/20 overflow-x-auto text-xs font-mono"
      >
        {[
          {
            id: "all",
            label: `All Photos (${PORTFOLIO_PHOTOS.length})`,
            icon: <IconSparkles className="w-3.5 h-3.5" />,
          },
          {
            id: "duck",
            label: "Duck's Growth",
            icon: <IconBone className="w-3.5 h-3.5" />,
          },
          {
            id: "bio",
            label: "Co-Pilot & Standups",
            icon: <IconBone className="w-3.5 h-3.5" />,
          },
          {
            id: "sports",
            label: "Mud Run & Skiing",
            icon: <IconRun className="w-3.5 h-3.5" />,
          },
          {
            id: "personal",
            label: "Costco & Travel",
            icon: <IconTag className="w-3.5 h-3.5" />,
          },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={selectedCategory === cat.id}
            onClick={() => {
              if (activePhoto && lastClickedPhotoIdRef.current) {
                pendingFocusPhotoIdRef.current = lastClickedPhotoIdRef.current;
              }
              setSelectedCategory(cat.id as typeof selectedCategory);
              setActivePhoto(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
              selectedCategory === cat.id
                ? "bg-amber-400 text-black shadow"
                : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Modal Body: Active Lightbox View OR Grid View */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {activePhoto ? (
            /* Lightbox Focused View */
            <motion.div
              key={activePhoto.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col md:flex-row gap-6 items-center justify-center max-w-4xl mx-auto"
            >
              {/* Large Preview */}
              <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden border border-white/20 bg-black/80 shadow-2xl">
                <Image
                  src={activePhoto.src}
                  alt={activePhoto.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 440px"
                  className="object-contain"
                  priority
                />
                {/* Prev / Next buttons inside lightbox */}
                <button
                  type="button"
                  onClick={() => {
                    const currIdx = filteredPhotos.findIndex(
                      (p) => p.id === activePhoto.id
                    );
                    const prevIdx =
                      (currIdx - 1 + filteredPhotos.length) %
                      filteredPhotos.length;
                    setActivePhoto(filteredPhotos[prevIdx]);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white hover:bg-amber-400 hover:text-black transition-colors cursor-pointer"
                >
                  <IconChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currIdx = filteredPhotos.findIndex(
                      (p) => p.id === activePhoto.id
                    );
                    const nextIdx = (currIdx + 1) % filteredPhotos.length;
                    setActivePhoto(filteredPhotos[nextIdx]);
                  }}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white hover:bg-amber-400 hover:text-black transition-colors cursor-pointer"
                >
                  <IconChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Details Panel */}
              <div className="flex-1 min-w-0 text-left flex flex-col justify-center space-y-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2 inline-block">
                    {activePhoto.category}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono text-white">
                    {activePhoto.title}
                  </h3>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                  {activePhoto.caption}
                </p>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-zinc-400 font-mono">
                  <span className="text-zinc-500 block text-[10px] uppercase mb-1">
                    Accessible Description
                  </span>
                  <p className="text-zinc-300 font-sans leading-relaxed">
                    {activePhoto.alt}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {activePhoto.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-400"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    ref={(el) => {
                      backButtonRef.current = el;
                      if (el && shouldFocusBackButtonRef.current) {
                        el.focus();
                        shouldFocusBackButtonRef.current = false;
                      }
                    }}
                    type="button"
                    onClick={handleCloseLightbox}
                    aria-label="Back to all photos"
                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    ← Back to all photos
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Grid Thumbnail View */
            <div
              ref={(el) => {
                gridRef.current = el;
                if (el && pendingFocusPhotoIdRef.current) {
                  restoreThumbnailFocus();
                }
              }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {filteredPhotos.map((photo) => (
                <button
                  key={photo.id}
                  data-photo-id={photo.id}
                  ref={(el) => {
                    if (el) {
                      thumbnailRefs.current.set(photo.id, el);
                      if (pendingFocusPhotoIdRef.current) {
                        restoreThumbnailFocus();
                      }
                    } else {
                      thumbnailRefs.current.delete(photo.id);
                    }
                  }}
                  type="button"
                  onClick={() => {
                    lastClickedPhotoIdRef.current = photo.id;
                    shouldFocusBackButtonRef.current = true;
                    setActivePhoto(photo);
                  }}
                  aria-label={`View photo: ${photo.title}`}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-black/40 hover:border-amber-400/50 transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <span className="text-[10px] font-mono font-bold text-white block truncate">
                      {photo.title}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 block truncate">
                      {photo.caption}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </ModalContainer>
  );
};
