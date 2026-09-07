"use client";

import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";

/** "You may register for at most N Technical events" — said up front, once.
 *
 * The cap used to be invisible until someone hit it, which meant the first
 * time anyone learned the rule was a warning replacing the form they were
 * about to fill in. This says it before they start.
 *
 * Shown once per category and then remembered, deliberately: someone signing
 * up for four events in a row should not be interrupted four times by a rule
 * they have already read. The memory is per browser and is only ever a
 * convenience — losing it shows the notice again, which is harmless. The
 * server remains the authority (`assertCategoryCapacityFor`), and this must
 * never be treated as enforcement: it does not know about drafts, teammates,
 * or another tab.
 */
const STORAGE_KEY = "sf:category-limit-seen";

function alreadySeen(category) {
  try {
    const seen = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(seen) && seen.includes(category);
  } catch {
    // Private mode, blocked storage, corrupted value — showing the notice is
    // always the safe answer.
    return false;
  }
}

function remember(category) {
  try {
    const seen = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    const next = Array.isArray(seen) ? seen : [];
    if (!next.includes(category)) next.push(category);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do — the notice simply shows again next time.
  }
}

export default function CategoryLimitNotice({ category, limit, used }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // `used >= limit` is the cap-reached case, which the page already explains
    // in place of the form — a dialog on top of that is just another click.
    if (!category || !limit || used >= limit) return;
    if (alreadySeen(category)) return;
    setOpen(true);
  }, [category, limit, used]);

  if (!category || !limit) return null;

  const remaining = Math.max(0, limit - used);

  const close = () => {
    remember(category);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {limit} {category} event{limit === 1 ? "" : "s"} per person
          </AlertDialogTitle>
          <AlertDialogDescription>
            {used > 0 ? (
              <>
                You&apos;ve registered for {used} of your {limit} {category} event
                {limit === 1 ? "" : "s"}, so you can still pick {remaining} more. Choose
                carefully — registrations can&apos;t be cancelled.
              </>
            ) : (
              <>
                You can register for up to {limit} {category} event
                {limit === 1 ? "" : "s"} in total. Choose carefully — registrations
                can&apos;t be cancelled once they&apos;re confirmed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={close}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
