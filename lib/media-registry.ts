/**
 * Centralized registry of photography across the portfolio.
 *
 * Provides type-safe image paths, natural dimensions, accessible alt text,
 * and contextual descriptions for bio, arcade, case studies, and gallery views.
 */

export interface PortfolioPhoto {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
  caption: string;
  category: "bio" | "duck" | "sports" | "personal";
  tags: string[];
  aspectRatio: "3:4" | "4:3" | "1:1" | "3:2";
}

export const PORTFOLIO_PHOTOS: PortfolioPhoto[] = [
  // --- Bio & Co-Pilot ---
  {
    id: "fred-duck-couch",
    src: "/images/bio/fred-duck-couch.jpg",
    width: 360,
    height: 480,
    alt: "Frederick de Ruiter smiling in a Timberwolves playoff t-shirt on a couch next to his golden retriever Duck, who is panting happily with his tongue out.",
    title: "Couch Co-Pilots",
    caption:
      "Fred and Duck celebrating a playoff win and another clean deployment.",
    category: "bio",
    tags: ["bio", "duck", "wolves", "minnesota"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-duck-shoulder",
    src: "/images/bio/fred-duck-shoulder.jpg",
    width: 768,
    height: 1024,
    alt: "Frederick de Ruiter smiling warmly while Duck rests his chin affectionately over Fred's shoulder on the couch.",
    title: "Shoulder Co-Pilot",
    caption:
      "Duck providing real-time peer code review and immediate chin-rest comfort.",
    category: "bio",
    tags: ["bio", "duck", "co-pilot", "remote-work"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-duck-yellow-shirt",
    src: "/images/bio/fred-duck-yellow-shirt.jpg",
    width: 768,
    height: 1024,
    alt: "Frederick in a yellow button-down shirt taking a mirror selfie holding Duck upright as a growing adolescent puppy.",
    title: "Standup Review",
    caption: "Fred and Duck dressed up for a high-stakes architecture demo.",
    category: "bio",
    tags: ["bio", "duck", "growth", "mirror-selfie"],
    aspectRatio: "3:4",
  },

  // --- Duck: The Growth Journey ---
  {
    id: "duck-puppy-headrest",
    src: "/images/duck/duck-puppy-headrest.jpg",
    width: 768,
    height: 1024,
    alt: "Baby puppy Duck curled up completely asleep across the top of Fred's head like a cozy fur hat.",
    title: "The Puppy Headrest",
    caption:
      "Sprint 1 onboarding: Duck discovers that Fred's head is the premier napping perch.",
    category: "duck",
    tags: ["duck", "puppy", "nap", "8-weeks"],
    aspectRatio: "3:4",
  },
  {
    id: "duck-puppy-bed",
    src: "/images/duck/duck-puppy-bed.jpg",
    width: 768,
    height: 1024,
    alt: "Frederick lying on a white bed hugging tiny baby puppy Duck, who gazes solemnly into the camera.",
    title: "First Week Home",
    caption:
      "A very small, very fluffy Duck contemplating his future career as an 80-lb lap dog.",
    category: "duck",
    tags: ["duck", "puppy", "bed", "soft"],
    aspectRatio: "3:4",
  },
  {
    id: "duck-puppy-mirror",
    src: "/images/duck/duck-puppy-mirror.jpg",
    width: 768,
    height: 1024,
    alt: "Fred smiling in a striped shirt holding baby Duck in front of the bathroom mirror, showing off Duck's little puppy paws.",
    title: "First Mirror Check",
    caption:
      "Inspecting puppy toe beans and ensuring optimal fluff density before daily standup.",
    category: "duck",
    tags: ["duck", "puppy", "mirror", "paws"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-duck-carried-doorway",
    src: "/images/duck/fred-duck-carried-doorway.jpg",
    width: 360,
    height: 480,
    alt: "Frederick in a doorway carrying a full-grown Duck horizontally in both arms like a giant plush bear.",
    title: "The Marshmallow Armful",
    caption:
      "Duck still believes he is fully portable and requests room-to-room transit.",
    category: "duck",
    tags: ["duck", "carried", "giant", "marshmallow"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-duck-hallway",
    src: "/images/duck/fred-duck-hallway.jpg",
    width: 360,
    height: 480,
    alt: "Fred standing in the hallway holding adult Duck upright against his chest like a dance partner.",
    title: "Hallway Dance",
    caption: "Full 80-lb marshmallow height check between code compilations.",
    category: "duck",
    tags: ["duck", "dance", "hallway", "growth"],
    aspectRatio: "3:4",
  },

  // --- Sports & Real-World Lore ---
  {
    id: "theodore-wirth-mud-run",
    src: "/images/sports/theodore-wirth-mud-run.jpg",
    width: 1024,
    height: 682,
    alt: "Frederick de Ruiter competing in the Theodore Wirth Mud Run (Run Minnesota 10K, bib 1534) in an orange race tee, Kirkland running cap, and red Garmin watch on his wrist.",
    title: "Theodore Wirth Mud Run (10K)",
    caption:
      "The real-world inspiration behind Monkey C Mayhem: 10 kilometers of Minnesota mud and a Garmin watch searching for GPS lock.",
    category: "sports",
    tags: ["running", "garmin", "mud-run", "theodore-wirth", "minnesota"],
    aspectRatio: "3:2",
  },
  {
    id: "fred-ski-flame-suit",
    src: "/images/sports/fred-ski-flame-suit.jpg",
    width: 886,
    height: 886,
    alt: "Frederick standing in ski boots on a snow-covered alpine mountain slope wearing a retro 1990s blue ski suit with red and yellow flame graphics on the legs.",
    title: "Welch Village Alpine Flame",
    caption:
      "Taking on the slopes in legendary 90s flame attire. The spirit behind Patrol Shift Studio and alpine telemetry.",
    category: "sports",
    tags: ["skiing", "welch-village", "patrol", "flame-suit", "winter"],
    aspectRatio: "1:1",
  },

  // --- Personal, Couple & Lore ---
  {
    id: "fred-costco-flame-suit",
    src: "/images/personal/fred-costco-flame-suit.jpg",
    width: 480,
    height: 360,
    alt: "Frederick crouching in a ninja stance in front of a Costco Wholesale monument sign while wearing a retro blue and flame ski suit.",
    title: "Costco HQ Tactical Crouch",
    caption: "When the flame ski suit meets the temple of bulk inventory.",
    category: "personal",
    tags: ["costco", "flame-suit", "humor", "lore"],
    aspectRatio: "4:3",
  },
  {
    id: "fred-costco-parking-lot",
    src: "/images/personal/fred-costco-parking-lot.jpg",
    width: 768,
    height: 1024,
    alt: "Frederick smiling in a sunny Costco parking lot wearing a white Costco Wholesale Since 1983 t-shirt, round sunglasses, cap, and backpack.",
    title: "Wholesale Enthusiast",
    caption:
      "Engineering fuel: Next.js, PostgreSQL, and bulk Kirkland signature snacks.",
    category: "personal",
    tags: ["costco", "kirkland", "lifestyle", "humor"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-partner-statue-of-liberty",
    src: "/images/personal/fred-partner-statue-of-liberty.jpg",
    width: 768,
    height: 1024,
    alt: "Frederick in a blue rain poncho and his partner in a pink poncho smiling together with the Statue of Liberty and American flag in the rainy background.",
    title: "Rainy Day at Lady Liberty",
    caption:
      "Abbi and Fred, the couple behind the wedding website, braving New York weather.",
    category: "personal",
    tags: ["couple", "wedding-website", "travel", "new-york"],
    aspectRatio: "3:4",
  },
  {
    id: "fred-partner-sunny",
    src: "/images/personal/fred-partner-sunny.jpg",
    width: 768,
    height: 1024,
    alt: "A close-up selfie of Frederick wearing aviator sunglasses and cap smiling brightly beside his partner in a pink shirt in front of a brick building.",
    title: "Sunny Summer Walk",
    caption: "A sunny walk in the summer before the wedding.",
    category: "personal",
    tags: ["couple", "wedding-website", "summer", "smile"],
    aspectRatio: "3:4",
  },
];

/**
 * Filter photos by category.
 */
export function getPhotosByCategory(
  category: PortfolioPhoto["category"]
): PortfolioPhoto[] {
  return PORTFOLIO_PHOTOS.filter((p) => p.category === category);
}

/**
 * Look up a single photo by its identifier.
 */
export function getPhotoById(id: string): PortfolioPhoto | undefined {
  return PORTFOLIO_PHOTOS.find((p) => p.id === id);
}
