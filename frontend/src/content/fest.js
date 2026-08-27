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
  dates: "March 14–16, 2026",
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

  // Shown when the events API is unreachable — placeholder categories
  eventCategories: [
    { name: "Technical", count: 10, description: "Hackathons, paper presentations, coding sprints." },
    { name: "Non-Technical", count: 8, description: "Quizzes, debates, treasure hunts, gaming." },
    { name: "Workshops", count: 6, description: "AI, cloud, embedded systems, design." },
  ],

  schedule: [
    {
      day: "Day 1",
      date: "Fri, March 14",
      items: [
        { time: "09:00", title: "Registration & Welcome Kit", venue: "Main Foyer" },
        { time: "10:30", title: "Inauguration & Keynote", venue: "Auditorium" },
        { time: "12:00", title: "Paper Presentation — Round 1", venue: "Seminar Hall A" },
        { time: "14:00", title: "Code Sprint Prelims", venue: "Lab Block 2" },
        { time: "17:00", title: "Hackathon Kickoff", venue: "Innovation Centre" },
      ],
    },
    {
      day: "Day 2",
      date: "Sat, March 15",
      items: [
        { time: "09:00", title: "Robotics Arena", venue: "Open Ground" },
        { time: "10:00", title: "Workshop — Applied AI", venue: "Seminar Hall B" },
        { time: "13:00", title: "Tech Quiz Finals", venue: "Auditorium" },
        { time: "15:00", title: "UI/UX Design Challenge", venue: "Design Studio" },
        { time: "17:00", title: "Hackathon Demo Day", venue: "Innovation Centre" },
      ],
    },
    {
      day: "Day 3",
      date: "Sun, March 16",
      items: [
        { time: "10:00", title: "Startup Pitch Fest", venue: "Auditorium" },
        { time: "12:00", title: "Gaming Championship Finals", venue: "Lab Block 1" },
        { time: "15:00", title: "Cultural Night", venue: "Open Air Theatre" },
        { time: "18:00", title: "Prize Distribution & Valedictory", venue: "Auditorium" },
      ],
    },
  ],

  sponsors: [
    { tier: "Title Sponsor", names: ["Acme Technologies"] },
    { tier: "Gold", names: ["Northwind Cloud", "Globex Systems", "Initech Labs"] },
    { tier: "Silver", names: ["Umbrella Software", "Stark Digital", "Wayne Analytics", "Hooli Cloud"] },
    { tier: "Community", names: ["Local Dev Circle", "OSS Chapter", "GDG Campus", "Coding Club"] },
  ],

  faqs: [
    { q: "Who can participate?", a: "Any student currently enrolled in an undergraduate or postgraduate programme. Carry your college ID to the venue." },
    { q: "How do I register?", a: "Sign in with your Google account, pick an event, and complete payment online. You'll get a registration ID instantly." },
    { q: "Can I register for multiple events?", a: "Yes. Register for each event separately — just check the schedule so your timings don't clash." },
    { q: "Is accommodation provided?", a: "Yes, for outstation participants on a first-come basis. Mention it in the registration form and our team will reach out." },
    { q: "What about refunds?", a: "Registration fees are non-refundable, but transferable to another participant up to 48 hours before the event." },
    { q: "Will I get a certificate?", a: "All participants receive a digital participation certificate. Winners receive merit certificates and cash prizes." },
  ],

  contacts: [
    { role: "Student Convenor", name: "Convenor Name", phone: "+91 90000 00001", email: "convenor@example.edu" },
    { role: "Faculty Coordinator", name: "Coordinator Name", phone: "+91 90000 00002", email: "faculty@example.edu" },
    { role: "Registrations", name: "Registration Desk", phone: "+91 90000 00003", email: "register@example.edu" },
  ],

  social: {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/",
    twitter: "https://x.com/",
  },
};

export const navLinks = [
  { label: "About", href: "/#about" },
  { label: "Events", href: "/events" },
  { label: "Schedule", href: "/#schedule" },
  { label: "Sponsors", href: "/#sponsors" },
  { label: "FAQ", href: "/#faq" },
];
