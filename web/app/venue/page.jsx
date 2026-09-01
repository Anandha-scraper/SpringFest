"use client";

import VenueView from "@/views/VenueView.jsx";

// No layout wrapper — this route deliberately has no navbar and no role
// sidebar. Whoever lands here came from a footer access code, not a signed-in
// account, and there is nothing above this page to route them into.
export default function Page() {
  return <VenueView />;
}
