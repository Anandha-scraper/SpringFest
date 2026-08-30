// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to rebrand the site. Nothing else hardcodes
//  institution names, dates, contacts or copy.
// ─────────────────────────────────────────────────────────────

export const fest = {
  name: "Spring Fest",
  year: "2k26",
  tagline: "Three days of code, culture and chaos.",
  blurb:
    "The annual inter-collegiate technical symposium — 24 events, 30+ colleges, one campus in full bloom.",
  dates: "March 14–15, 2026",

  institution: {
    name: "Your Institution Name",
    shortName: "YIN",
    department: "Department of Computer Science & Engineering",
    city: "Chennai, Tamil Nadu",
    website: "https://example.edu",
  },

  // UNUSED — the landing Schedule section is built from the real events API
  // (see components/sections/ScheduleFlow.jsx). Kept as reference copy only.
  schedule: [
    {
      day: "Day 1",
      date: "Fri, March 14",
      items: [
        { time: "09:00", title: "Registration & Welcome Kit", venue: "Main Foyer" },
        { time: "10:30", title: "Inauguration & Keynote", venue: "Auditorium" },
        { time: "12:00", title: "Paper Presentation", venue: "Seminar Hall A" },
        { time: "14:00", title: "Code Sprint Prelims", venue: "Lab Block 2" },
        { time: "17:00", title: "Hackathon Kickoff", venue: "Innovation Centre" },
      ],
    },
    {
      day: "Day 2",
      date: "Sat, March 15",
      items: [
        { time: "09:00", title: "Robotics Arena", venue: "Open Ground" },
        { time: "11:00", title: "Workshop — Applied AI", venue: "Seminar Hall B" },
        { time: "13:00", title: "Tech Quiz Finals", venue: "Auditorium" },
        { time: "15:00", title: "Hackathon Demo Day", venue: "Innovation Centre" },
        { time: "17:30", title: "Prize Distribution & Valedictory", venue: "Auditorium" },
      ],
    },
  ],


  // Placeholder partner wordmarks for the hero LogoLoop — swap for real
  // sponsors (or { src, alt } image entries) when you have them.
  partners: [
    "Acme Technologies",
    "Northwind Cloud",
    "Globex Systems",
    "Initech Labs",
    "Umbrella Software",
    "Stark Digital",
    "Wayne Analytics",
    "Hooli Cloud",
  ],

  contact: {
    faculty: { name: "Mr. V. PRAKASHAM", phone: "99651 90985" },
    students: [
      { name: "DHIVAGAR P.R", phone: "7339224113" },
      { name: "PRAVEEN K", phone: "638179634" },
      { name: "BAARHAVI M D", phone: "6369163774" },
      { name: "SANGAMITHA P", phone: "7010699283" },
    ],
    mapEmbed:
      "https://www.google.com/maps?q=Chennai%2C%20Tamil%20Nadu&output=embed",
    mapLink: "https://www.google.com/maps/search/?api=1&query=Chennai,Tamil+Nadu",
  },

  social: {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/",
    twitter: "https://x.com/",
  },
};

export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/#events" },
  { label: "Schedule", href: "/#schedule" },
  { label: "Contact", href: "/#contact" },
];
