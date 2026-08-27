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
  venue: "Main Campus Auditorium",

  institution: {
    name: "Your Institution Name",
    shortName: "YIN",
    department: "Department of Computer Science & Engineering",
    city: "Chennai, Tamil Nadu",
    website: "https://example.edu",
  },

  // Hero counters
  stats: [
    { label: "Events", value: 24, suffix: "" },
    { label: "Colleges", value: 30, suffix: "+" },
    { label: "Participants", value: 1500, suffix: "+" },
    { label: "Prize Pool", value: 1, prefix: "₹", suffix: "L" },
  ],

  about: [
    "Spring Fest 2k26 is the flagship technical symposium of the Department of Computer Science & Engineering, bringing together students from across the state for three days of competition, learning and celebration.",
    "From 24-hour hackathons and paper presentations to robotics showdowns and a closing cultural night, there is something here whether you write code, design, debate or just want a very good weekend.",
  ],

  highlights: [
    { icon: "🏆", title: "₹1 Lakh Prize Pool", text: "Across 24 technical and non-technical events." },
    { icon: "🎓", title: "Industry Workshops", text: "Hands-on sessions led by engineers from top product companies." },
    { icon: "🤝", title: "30+ Colleges", text: "Meet and compete with the best from across the region." },
    { icon: "🎤", title: "Cultural Night", text: "Live band, stand-up and the closing awards ceremony." },
  ],


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


  faqs: [
    { q: "Who can participate?", a: "Any student currently enrolled in an undergraduate or postgraduate programme. Carry your college ID to the venue." },
    { q: "How do I register?", a: "Sign in with your Google account, pick an event, and complete payment online. You'll get a registration ID instantly." },
    { q: "Can I register for multiple events?", a: "Yes. Register for each event separately — just check the schedule so your timings don't clash." },
    { q: "Is accommodation provided?", a: "Yes, for outstation participants on a first-come basis. Mention it in the registration form and our team will reach out." },
    { q: "What about refunds?", a: "Registration fees are non-refundable, but transferable to another participant up to 48 hours before the event." },
    { q: "Will I get a certificate?", a: "All participants receive a digital participation certificate. Winners receive merit certificates and cash prizes." },
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

  contacts: [
    { role: "Student Convenor", name: "Convenor Name", phone: "+91 90000 00001", email: "convenor@example.edu" },
    { role: "Faculty Coordinator", name: "Coordinator Name", phone: "+91 90000 00002", email: "faculty@example.edu" },
    { role: "Registrations", name: "Registration Desk", phone: "+91 90000 00003", email: "register@example.edu" },
  ],

  // Mock contact details — swap for the real ones.
  contact: {
    person: "Aarthi Ramesh",
    role: "Student Convenor",
    email: "springfest@example.edu",
    phone: "+91 90000 00001",
    location: "Department of CSE, Main Campus, Chennai, Tamil Nadu 600001",
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

// BubbleMenu (mobile) needs rotation + hover colours per item.
const BUBBLE_HOVERS = [
  { bgColor: "#f87b1b", textColor: "#ffffff" },  // orange
  { bgColor: "#11224e", textColor: "#eeeeee" },  // navy
  { bgColor: "#cbd99b", textColor: "#11224e" },  // sage
];

export const bubbleNavItems = navLinks.map((link, i) => ({
  label: link.label,
  href: link.href,
  ariaLabel: link.label,
  rotation: i % 2 === 0 ? -8 : 8,
  hoverStyles: BUBBLE_HOVERS[i % BUBBLE_HOVERS.length],
}));

// Event-track picker (BubbleMenu inside the Events section). Decorative for
// now — the items open/close the overlay but don't filter the grid.
export const eventTrackItems = [
  { label: "Technical",     href: "#events", ariaLabel: "Technical events",     rotation: -8, hoverStyles: { bgColor: "#f87b1b", textColor: "#ffffff" } },
  { label: "Non-Technical", href: "#events", ariaLabel: "Non-technical events", rotation:  8, hoverStyles: { bgColor: "#11224e", textColor: "#eeeeee" } },
  { label: "Hackathon",     href: "#events", ariaLabel: "Hackathon",            rotation:  8, hoverStyles: { bgColor: "#cbd99b", textColor: "#11224e" } },
  { label: "Workshop",      href: "#events", ariaLabel: "Workshops",            rotation: -8, hoverStyles: { bgColor: "#f5a55c", textColor: "#11224e" } },
];
