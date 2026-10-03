import { compileTerms } from "./term-compiler";

export interface TimelineItem {
  role: string;
  company: string;
  period: string;
  /** Professional Summary: a concise account of the responsibilities and systems involved. */
  professionalDescription: string;
  /** Behind the Scenes Reality: the candid version of the same role. */
  realityDescription: string;
  tags: string[];
}

export interface DomainItem {
  id: string;
  title: string;
  tooltip: string;
  description: string;
}

export interface Dictionary {
  bio: {
    title: string;
    subtitle: string;
    description: string;
  };
  domains: {
    title: string;
    items: DomainItem[];
  };
  timeline: TimelineItem[];
}

const rawTimelineDetailed: TimelineItem[] = [
  {
    role: "Clinical Data Specialist",
    company: "BRIGHT Research Partners, Inc.",
    period: "March 2023 to Present",
    professionalDescription:
      "I build and maintain the clinical databases behind active GxP research studies: eCRFs designed from the protocol, cross-form edit checks, and the validation evidence each build needs before it goes live. The same work carries through data management plans, SAE reconciliation, database locks, and investigational device accountability under 21 CFR 812.",
    realityDescription:
      "A study protocol can run to 150 pages. My job is to turn it into forms people can actually use, then write the checks that catch contradictions across them. The footnotes tend to earn their keep.",
    tags: [
      "GxP Systems",
      "21 CFR 812",
      "eCRF Architecture",
      "Edit Checks",
      "DMP Authoring",
      "SAE Reconciliation",
      "iMednet",
    ],
  },
  {
    role: "Research Program Coordinator",
    company: "Mayo Clinic",
    period: "July 2021 to March 2023",
    professionalDescription:
      "I used Epic SlicerDicer and MyChart to improve recruitment, helping monthly enrollment grow from 10 to 50+ participants while screen failures fell 25%. I also built REDCap databases, processed MRI scans with FreeSurfer, created 3D-printable brain models, and prepared NIH DSMB safety reports.",
    realityDescription:
      "I worked on recruitment queries, REDCap databases, MRI processing, and safety reports. We also 3D printed brain models for participants. That was a particularly good answer to “what did you do at work today?”",
    tags: [
      "Mayo Clinic",
      "Epic SlicerDicer",
      "MyChart Recruitment",
      "REDCap",
      "FreeSurfer Linux",
      "3T MRI Neuroinformatics",
      "3D Printing (STL)",
      "NIH DSMB",
    ],
  },
  {
    role: "Clinical Research Coordinator",
    company: "Mayo Clinic",
    period: "October 2019 to July 2021",
    professionalDescription:
      "I coordinated NIH-funded studies from startup to closeout, prepared IRB submissions and consent documents, and checked study data through Source Document Verification (SDV). As an Epic Super User, I trained staff and helped clinical teams troubleshoot research workflows.",
    realityDescription:
      "I kept studies moving: approvals, paperwork, data checks, and helping people get Epic to do what they needed. A lot of research depends on someone patiently untangling the practical bits.",
    tags: [
      "Mayo Clinic",
      "NIH Studies",
      "IRB Protocols",
      "Epic Super User",
      "Source Document Verification",
      "GxP Compliance",
      "Clinical Operations",
    ],
  },
  {
    role: "Desk Operations Specialist & Epic Super User",
    company: "Mayo Clinic",
    period: "February 2018 to October 2019",
    professionalDescription:
      "I helped the Division of Oncology move patient orders into a new EHR, supported staff during the transition, and worked with IT analysts to test system updates.",
    realityDescription:
      "Cancer treatment orders still need to be right during a software migration. I helped transfer and check them, then worked through the software problems with the clinical teams using it.",
    tags: [
      "Mayo Clinic",
      "Division of Oncology",
      "EHR Data Migration",
      "Epic Super User",
      "UAT Testing",
      "Technical Troubleshooting",
    ],
  },
  {
    role: "Summer Operations Coordinator & Vikings Training Camp Liaison",
    company: "Minnesota State University, Mankato",
    period: "July 2017 to February 2018",
    professionalDescription:
      "I was the university liaison for Minnesota Vikings Training Camp, coordinating facilities, broadcast, and security logistics. I also managed conference billing and helped secure free menstrual products in campus facilities.",
    realityDescription:
      "I helped get an NFL training camp onto a university campus and kept summer operations moving. I also worked on free menstrual products in campus bathrooms. Different scales of logistics; both worth getting right.",
    tags: [
      "Minnesota Vikings NFL Camp",
      "University Liaison",
      "Campus Advocacy",
      "Operations Logistics",
      "Financial Reconciliation",
      "Facilities Management",
    ],
  },
];

const compiledTimelineDetailed = rawTimelineDetailed.map((item) => ({
  ...item,
  professionalDescription: compileTerms(item.professionalDescription),
  realityDescription: compileTerms(item.realityDescription),
  tags: item.tags,
}));

const rawTimelineSimplified: TimelineItem[] = [
  {
    role: "Clinical Data Specialist",
    company: "BRIGHT Research Partners, Inc.",
    period: "March 2023 to Present",
    professionalDescription:
      "I build and look after the electronic forms and databases for ongoing clinical studies, with checks that catch missing or inconsistent entries and testing that shows those checks work. I also manage trial data from collection through database lock and track investigational medical devices.",
    realityDescription:
      "I read long study plans, turn them into usable forms, and add checks for missing or conflicting answers. There is usually an exception tucked into a footnote.",
    tags: [
      "GxP Systems",
      "21 CFR Part 11",
      "Database Design",
      "Data Validation",
      "Clinical Operations",
    ],
  },
  {
    role: "Research Program Coordinator",
    company: "Mayo Clinic",
    period: "July 2021 to March 2023",
    professionalDescription:
      "I improved recruitment using hospital records, helping monthly enrollment grow fivefold while fewer people were ruled out during screening. I also built research databases and prepared study safety reports.",
    realityDescription:
      "I helped find study participants, organized research data, and made 3D-printed models of people’s brains from their MRI scans. The printer had an unusually interesting workload.",
    tags: [
      "Mayo Clinic",
      "Trial Enrollment",
      "3D Printing",
      "Database Management",
      "Data Safety dossiers",
    ],
  },
  {
    role: "Clinical Research Coordinator",
    company: "Mayo Clinic",
    period: "October 2019 to July 2021",
    professionalDescription:
      "I managed the day-to-day work of clinical studies, including ethics approvals, consent documents, data checks, and staff training.",
    realityDescription:
      "I handled the approvals, forms, data checks, and software questions that keep a research study moving.",
    tags: [
      "Mayo Clinic",
      "Trial Operations",
      "Compliance Checks",
      "Staff Training",
    ],
  },
  {
    role: "Desk Operations Specialist & Epic Super User",
    company: "Mayo Clinic",
    period: "February 2018 to October 2019",
    professionalDescription:
      "I helped move oncology records during a hospital software transition and supported the people using the new system.",
    realityDescription:
      "I helped clinical teams through a software change while keeping patient orders accurate. It was a good education in what software feels like from the other side of the desk.",
    tags: [
      "Mayo Clinic",
      "Data Migration",
      "IT Support",
      "Workflow Optimization",
    ],
  },
  {
    role: "Summer Operations Coordinator & Vikings Training Camp Liaison",
    company: "Minnesota State University, Mankato",
    period: "July 2017 to February 2018",
    professionalDescription:
      "I coordinated Vikings training camp and summer conference logistics, managed billing, and helped make menstrual products freely available on campus.",
    realityDescription:
      "I coordinated training camp logistics, summer events, and campus billing. I also helped get free menstrual products into campus bathrooms. Useful work comes in a lot of forms.",
    tags: [
      "Minnesota Vikings NFL Camp",
      "Campus Advocacy",
      "Operations Logistics",
      "Facilities Management",
    ],
  },
];

const compiledTimelineSimplified = rawTimelineSimplified.map((item) => ({
  ...item,
  professionalDescription: compileTerms(item.professionalDescription),
  realityDescription: compileTerms(item.realityDescription),
  tags: item.tags,
}));

export const dictionary = {
  detailed: {
    bio: {
      title: "Hi, I’m Fred.",
      subtitle: "Clinical research • Software • Side projects",
      description:
        "I work with clinical data and build tools for the parts that are harder than they ought to be. My route here includes Mayo Clinic research, Vikings training camp logistics, and 3D-printed brain models. Outside work, there’s ski patrol, browser games, and Laser Loon, a flag design that helped raise $13.5k for public libraries. It’s been an interesting set of tabs to have open.",
    },
    domains: {
      title: "Core Toolkit & Domains",
      items: [
        {
          id: "01",
          title: "Clinical Data Systems",
          tooltip:
            "Clinical forms, edit checks, and data structures based on study protocols.",
          description:
            "I turn study protocols into eCRFs, database schemas, and validation rules that help catch inconsistent data.",
        },
        {
          id: "02",
          title: "Interactive Canvas Physics",
          tooltip:
            "Canvas games, raycasting, and interactive logic tools built for the browser.",
          description:
            "I build browser games and visual tools to explore rendering, physics, and logic. Making them playable is half the fun.",
        },
        {
          id: "03",
          title: "Civic Tech & Laser Loon",
          tooltip: "Open artwork and community projects, including Laser Loon.",
          description:
            "I made Laser Loon for the Minnesota flag redesign and shared the artwork. The project helped raise $13.5k for public libraries.",
        },
        {
          id: "04",
          title: "Ski Patrol & Emergency Triage",
          tooltip:
            "OEC/OET-certified Alpine Ski Patroller providing emergency care on the slopes.",
          description:
            "I volunteer on Alpine Ski Patrol. It’s a very practical reminder to stay calm, ask good questions, and help the person in front of you.",
        },
      ],
    },
    timeline: compiledTimelineDetailed,
  },
  simplified: {
    bio: {
      title: "Hi, I’m Fred.",
      subtitle: "Clinical research • Useful tools • Occasional lasers",
      description:
        "I work with clinical data, build software, and follow interesting questions into side projects. That has led to research databases, 3D-printed brains, browser games, and a laser-eyed loon that helped raise money for public libraries.",
    },
    domains: {
      title: "What I Build (Simplified)",
      items: [
        {
          id: "01",
          title: "Clinical Databases",
          tooltip:
            "Electronic research forms and checks for missing or inconsistent data.",
          description:
            "I design clinical forms and checks that help people catch missing or inconsistent answers.",
        },
        {
          id: "02",
          title: "Interactive Web Graphics",
          tooltip:
            "Games, animations, and interactive tools that run in your browser.",
          description:
            "I make browser games, animations, and visual tools you can try for yourself.",
        },
        {
          id: "03",
          title: "Civic Open Source",
          tooltip: "Code and artwork shared for other people to use.",
          description:
            "I share code and artwork people can use, including Laser Loon, which helped raise $13,500 for public libraries.",
        },
        {
          id: "04",
          title: "Emergency Triage & Safety",
          tooltip:
            "Emergency care and practical decision-making on ski patrol.",
          description:
            "I volunteer on ski patrol, providing emergency care and helping people get safely off the hill.",
        },
      ],
    },
    timeline: compiledTimelineSimplified,
  },
};
