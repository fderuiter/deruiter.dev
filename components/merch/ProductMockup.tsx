import React from "react";
import type { MerchCategory } from "@/lib/merch-data";

interface ProductMockupProps {
  category: MerchCategory;
  image: string;
  alt: string;
}

/** The flag artwork at its native 16:9 shape; width and height reserve the space. */
function Art({
  image,
  alt,
  className,
}: {
  image: string;
  alt: string;
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={alt}
      width={1920}
      height={1080}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

/**
 * A flat stand-in for each product, built from CSS shapes around the real
 * artwork, until Redbubble mockups exist. The frame has a fixed 4:3 ratio so
 * the card never shifts when the image loads.
 */
export function ProductMockup({ category, image, alt }: ProductMockupProps) {
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#13151a]"
      data-mockup={category}
    >
      {category === "sticker" && (
        <Art
          image={image}
          alt={alt}
          className="absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 -rotate-3 rounded-[14px] border-[6px] border-white object-cover shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        />
      )}
      {category === "apparel" && (
        <>
          <svg
            viewBox="0 0 200 150"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M70 14 L100 24 L130 14 L172 34 L158 62 L142 54 L142 136 L58 136 L58 54 L42 62 L28 34 Z"
              fill="#1f2937"
              stroke="#374151"
              strokeWidth="1.5"
            />
          </svg>
          <Art
            image={image}
            alt={alt}
            className="absolute left-1/2 top-[34%] w-[30%] -translate-x-1/2 object-cover"
          />
        </>
      )}
      {category === "desk" && (
        <Art
          image={image}
          alt={alt}
          className="absolute left-1/2 top-1/2 w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-zinc-700 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        />
      )}
      {category === "drinkware" && (
        <>
          <div
            aria-hidden="true"
            className="absolute right-[24%] top-[36%] h-[30%] w-[16%] rounded-r-full border-[8px] border-l-0 border-zinc-200"
          />
          <div className="absolute left-[26%] top-[24%] h-[54%] w-[40%] overflow-hidden rounded-b-[18px] rounded-t-md bg-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <Art
              image={image}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </>
      )}
      {category === "print" && (
        <div className="absolute left-1/2 top-1/2 w-[64%] -translate-x-1/2 -translate-y-1/2 border-[8px] border-zinc-200 bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
          <Art image={image} alt={alt} className="w-full object-cover" />
        </div>
      )}
    </div>
  );
}
