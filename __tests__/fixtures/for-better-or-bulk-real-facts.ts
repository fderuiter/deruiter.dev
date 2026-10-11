/**
 * The [Real] facts from section 1 ("Historical anchors") of the design doc,
 * plans/2026-10-11-for-better-or-bulk-design.md. Each text is copied word for
 * word from the doc, without the bold bullet label and without the [Real]
 * tag. This copy is the reference: the tests check the game's real lines
 * against it, so editing the doc means editing this list too. It is kept
 * out of lib/ on purpose, so the engine never reads it.
 *
 * The "morning" text is the playtest rewrite (S10). It drops the doc's line
 * that Abbi was upset, because that attributes a feeling to a real person. The
 * design doc needs the same edit before this copy matches it again.
 *
 * The "suit" text is the round 9 playtest rewrite. It drops the doc's "(a
 * fictional homage name)" aside and the word "guilted", which read as a
 * character claim about Fred. The design doc needs the same edit.
 */
export const REAL_FACTS_FROM_DESIGN_DOC: readonly {
  readonly id: string;
  readonly text: string;
}[] = [
  {
    id: "date",
    text: "Friday, 10/10/25, at the Plummer House in Rochester, a publicly owned venue. The ceremony is at 4:00 and the buffet at 5:30.",
  },
  {
    id: "prep",
    text: 'Two weeks out she "wasn\'t really thinking about it that much". She arrived and did the vast majority of the work on Wednesday and Thursday, with all of Thursday spent getting things ready. Friday was setup. Friends helped.',
  },
  {
    id: "tables",
    text: "They set up all the tables and chairs themselves.",
  },
  {
    id: "suit",
    text: "The Suit Wherehouse lost Fred's suit and gave him a free one. He wore the rented tux anyway.",
  },
  {
    id: "morning",
    text: "Fred was anxious and went out with his brothers. Abbi kept things moving without him.",
  },
  {
    id: "weather",
    text: "The weather was perfect. Fred jokes he caused it.",
  },
  {
    id: "dinner",
    text: "Hot dogs, wings, mac and cheese and quinoa salad from Costco, plus a Kirkland sheet cake for the guests. Abbi's sister made the cake they cut.",
  },
  {
    id: "leftovers",
    text: "Leftovers went to the Rochester warming shelter.",
  },
  {
    id: "goal",
    text: 'Abbi\'s goal was for the wedding to be "successful and fun".',
  },
  {
    id: "website",
    text: 'The website was built months earlier: FAQ, registry scraper, admin page for Abbi, 3D heart (the rings-into-heart intro "looked awful"). RSVPs went through iCloud, never the site. Registry gifts were never part of the wedding budget.',
  },
];
