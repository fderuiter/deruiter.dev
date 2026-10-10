/**
 * Content for the wedding archive at /wedding: a static keepsake of the
 * website Abbi and Fred ran for their wedding on 10 October 2025, published
 * for their first anniversary. The original app (fderuiter/wedding_website)
 * kept guests, registry contributions and seating in Postgres; none of that is
 * carried over. Everything here is checked-in text and images, so the page
 * never touches the database.
 */

/** One photo in the archive gallery, served from `public/images/wedding`. */
export interface WeddingPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** One member of the wedding party, as listed on the original site. */
export interface WeddingPartyMember {
  name: string;
  role: string;
  relation: string;
}

/** The day itself. */
export const WEDDING_DETAILS = {
  couple: "Abbi & Fred",
  date: "2025-10-10",
  dateLabel: "Friday, October 10, 2025",
  venue: "Plummer House",
  venueUrl: "https://mngardens.horticulture.umn.edu/plummer-house-arts-gardens",
  city: "Rochester, Minnesota",
  ceremony: "4:00 pm in the gardens",
  reception: "Buffet dinner at 5:30 pm, then dancing under the lanterns",
  attire: "Garden formal",
} as const;

/** The story from the original home page, lightly edited into past tense. */
export const WEDDING_STORY: readonly string[] = [
  "It all began with a swipe right on a cool evening in 2024. Abbi was drawn to Fred's adventurous spirit, while Fred was captivated by Abbi's warm smile and shared love for hotdogs. Our first date involved Fred plugging the Laser Loon and ended with hours of conversation that felt like minutes.",
  "Since then, we've built a life filled with laughter, shared dreams and countless adventures. From exploring parks to cozy nights binge-watching our favorite shows, we've collected miles on the odometer, concert stubs, a few Wolves tickets and a growing library of inside jokes. We've supported each other through thick and thin, celebrated milestones like Abbi's graduation as a Nurse Practitioner, and learned that home isn't just a place but a feeling we find in each other.",
  "As 2024 turned into 2025, Fred recreated our very first date in downtown Minneapolis. Just after the ball dropped, he asked Abbi to be his forever adventure partner. Through happy tears, she said yes.",
  'On October 10, 2025 we said "I do" at the Plummer House in Rochester, a Tudor mansion that was once home to Dr. Henry Stanley Plummer of the Mayo Clinic, surrounded by the people we love most.',
];

/** The wedding party, in the order the original site listed them. */
export const WEDDING_PARTY: readonly WeddingPartyMember[] = [
  {
    name: "Emily Schultz",
    role: "Maid of Honor",
    relation: "Sister of the bride",
  },
  {
    name: "Callie Sebora",
    role: "Bridesmaid",
    relation: "Sister of the bride",
  },
  {
    name: "Isabella de Ruiter",
    role: "Bridesmaid",
    relation: "Sister of the groom",
  },
  {
    name: "Delaney Sebora",
    role: "Bridesmaid",
    relation: "Sister of the bride",
  },
  {
    name: "Vincent de Ruiter",
    role: "Best Man",
    relation: "Brother of the groom",
  },
  {
    name: "Peter de Ruiter",
    role: "Groomsman",
    relation: "Brother of the groom",
  },
  { name: "Caleb Sebora", role: "Groomsman", relation: "Brother of the bride" },
  {
    name: "Ethan Schultz",
    role: "Groomsman",
    relation: "Brother of the bride",
  },
];

const portrait = { width: 960, height: 1440 } as const;
const landscape = { width: 1440, height: 960 } as const;

/**
 * The curated photos from the shared album "Wedding Pics (Good ones)". The
 * full album stays on Google Photos and is linked from the page.
 */
export const WEDDING_PHOTOS: readonly WeddingPhoto[] = [
  {
    src: "/images/wedding/04-ceremony-dip-wide.jpg",
    alt: "Fred dips Abbi for a kiss at the end of the aisle as guests cheer in the garden",
    ...portrait,
  },
  {
    src: "/images/wedding/06-recessional.jpg",
    alt: "Abbi and Fred walk back up the aisle together, smiling, as newlyweds",
    ...portrait,
  },
  {
    src: "/images/wedding/07-rings.jpg",
    alt: "Close-up of Abbi's and Fred's hands showing their wedding rings",
    ...portrait,
  },
  {
    src: "/images/wedding/01-cake-topper.jpg",
    alt: "A bride and groom cake topper on a pink heart-decorated cake with roses",
    ...portrait,
  },
  {
    src: "/images/wedding/02-grazing-table.jpg",
    alt: "A long grazing table inside the Plummer House with snacks arranged into letters",
    ...landscape,
  },
  {
    src: "/images/wedding/03-love-you-more-sign.jpg",
    alt: "A white sign reading love you more, covered in lipstick kisses from guests",
    ...landscape,
  },
  {
    src: "/images/wedding/05-ceremony-dip.jpg",
    alt: "Closer view of the kiss at the end of the ceremony with guests seated behind",
    ...portrait,
  },
  {
    src: "/images/wedding/10-family-group.jpg",
    alt: "A large family group photo in front of the Tudor facade of the Plummer House",
    ...landscape,
  },
  {
    src: "/images/wedding/11-couple-with-party.jpg",
    alt: "Abbi and Fred with members of the wedding party by the house's arched doorway",
    ...landscape,
  },
  {
    src: "/images/wedding/09-couple-with-family.jpg",
    alt: "Abbi and Fred with two older family members in front of the stone house",
    ...portrait,
  },
  {
    src: "/images/wedding/08-couple-with-friend.jpg",
    alt: "Abbi and Fred standing with a guest in a black dress outside the house",
    ...portrait,
  },
  {
    src: "/images/wedding/12-first-dance.jpg",
    alt: "Abbi and Fred's first dance under white paper lanterns at dusk",
    ...portrait,
  },
  {
    src: "/images/wedding/13-twirl.jpg",
    alt: "Fred twirls Abbi on the patio beside the reception tables",
    ...portrait,
  },
  {
    src: "/images/wedding/14-dancing-by-the-house.jpg",
    alt: "Abbi and Fred slow dance beside the house as guests watch",
    ...portrait,
  },
  {
    src: "/images/wedding/15-head-table-left.jpg",
    alt: "The bride's side of the head table, laughing at dinner",
    ...landscape,
  },
  {
    src: "/images/wedding/16-head-table-right.jpg",
    alt: "The groom's side of the head table in suits and red bow ties",
    ...landscape,
  },
];

/** The full shared Google Photos album. */
export const WEDDING_ALBUM_URL = "https://photos.app.goo.gl/v1Rw81HSoyLVNEDx5";

/** The source of the original website. */
export const WEDDING_SOURCE_URL =
  "https://github.com/fderuiter/wedding_website";
