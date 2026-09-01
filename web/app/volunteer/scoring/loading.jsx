"use client";

import Loader from "@/components/common/Loader.jsx";

/** Shown by the App Router while this segment's chunk and data load — for
 *  exactly as long as that actually takes, and no longer. */
export default function Loading() {
  return <Loader />;
}
