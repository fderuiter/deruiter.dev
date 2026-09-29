import type { FAQItem } from "@/lib/seo";

/**
 * Single source of truth for the visible FAQ modules (ADR 0053 section 4).
 *
 * The same array feeds both the on-page accordion and the FAQPage JSON-LD, so
 * the structured data can never describe content a visitor cannot see
 * (Google's anti-cloaking rule for FAQ rich results).
 */
export const SCHEDULE_FAQ: readonly FAQItem[] = [
  {
    question: "What can we talk about in a 30-minute chat?",
    answer:
      "Clinical software engineering, CDISC data standards, distributed systems, web experiments, the projects on this site, or feedback on a side project. Bring a question or an idea and we will take it from there.",
  },
  {
    question: "How do I book a time?",
    answer:
      "Use the Google Calendar booking link on this page to pick an open slot. The call takes place on Google Meet and the booking link handles the calendar details.",
  },
  {
    question: "Is this a formal consulting engagement?",
    answer:
      "No. The booking page is for a single 30-minute conversation. If your question turns out to be bigger than half an hour, we can talk about what a longer collaboration might look like on the call.",
  },
  {
    question: "What if I would rather send a message first?",
    answer:
      "Use the contact form on this page. It reaches the same inbox, and you can book a time afterwards if a conversation still makes sense.",
  },
];

export const CRF_FAQ: readonly FAQItem[] = [
  {
    question: "Which clinical data standards does CRF Studio work with?",
    answer:
      "The studio scaffolds forms from CDISC CDASH 2.2 domains and reads and writes CDISC ODM-XML 1.3.2. It is a demonstration designer, so check exported files against your own validation tooling before relying on them.",
  },
  {
    question: "Where does my study data go?",
    answer:
      "Nowhere. CRF Studio runs entirely in your browser and makes no network requests to save your work. Drafts and the sample data you try are kept in your browser's local storage, so clearing site data removes them.",
  },
  {
    question: "Is CRF Studio ready for 21 CFR Part 11 use?",
    answer:
      "It models Part 11 concepts such as electronic signature fields and audit-style field comments so you can design and discuss them. It is not a validated system, and it is not a substitute for a qualified electronic data capture platform in a regulated study.",
  },
  {
    question: "Can I try validation rules without writing code?",
    answer:
      "Yes. Edit checks are written as readable rules, and you can run them against sample data in the simulator to see which entries would raise a query.",
  },
];

export const LASER_LOON_FAQ: readonly FAQItem[] = [
  {
    question: "What is the Laser Loon?",
    answer:
      "The Laser Loon is Fred de Ruiter's submission to Minnesota's state flag redesign: a common loon with red laser eyes. The submission was numbered F277, which is where the name comes from.",
  },
  {
    question: "Can I use the Laser Loon artwork?",
    answer:
      "Yes. The artwork is shared under the Creative Commons Attribution 4.0 license (CC BY 4.0), so you may use and adapt it, including commercially, as long as you credit the author.",
  },
  {
    question: "Which file formats are available?",
    answer:
      "The download set includes the editable source vector (.ai), print vectors (.eps and .pdf), and web-ready files (.svg and .png). Pick the format that suits screen or print use.",
  },
];
