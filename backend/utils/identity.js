/** Who counts as the same person.
 *
 * This used to be answered in three places that quietly disagreed:
 * `aggregate.personKey()` keyed on `uid || email` and never lowercased,
 * `attendance.service.js` lowercased and built its own email->uid map, and
 * `registrationLookup.matchMemberIndex()` matched the lead by uid but members
 * by lowercased email. Three answers meant "142 registered users" and a
 * 143-row attendance list could both look right.
 *
 * A pure-string module with no imports, in `utils/` beside slugify/validate,
 * because both the admin read rollups AND the registration write path need it
 * — and having the write path import the admin read-model module would invert
 * the layering the rest of the backend is careful about.
 *
 * The hard case it exists to solve: one human appears as a *lead* on one
 * registration (they have a `uid`) and as a *teammate* on someone else's
 * (an email inside `members[]`, no uid anywhere). Both must collapse to one
 * row, and the answer must not depend on Firestore's document order.
 */

/** Emails are stored as typed — `requireEmail` does not lowercase — so
 * `Foo@x.com` and `foo@x.com` are genuinely different strings on disk.
 * Normalising at this boundary is what makes them one person without a data
 * migration. */
export function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

/** `requirePhone` already stores bare 10 digits, so this is a no-op on
 * anything written through the API. It exists for values arriving from
 * elsewhere (an admin edit, a legacy row) so a key is never built from
 * "98765 43210". */
export function normalizePhone(value) {
  return (value || "").replace(/\D/g, "");
}

/** The canonical key for one person: their uid when we know it, otherwise
 * their lowercased email. Returns "" for a holder with neither — such a row
 * is unaddressable and callers should skip it rather than bucket every one of
 * them under a shared placeholder. */
export function personKeyFor({ uid, email } = {}) {
  return uid || normalizeEmail(email) || "";
}

/** email -> uid, built from every registration that has a lead uid.
 *
 * Indexes BOTH the typed `email` and the Google `user_email`: holder 0 of
 * `ticketHolders()` carries the typed address, which a lead can set to
 * anything, while `user_email` is the account. If only one were indexed,
 * someone who leads under one address and is typed as a teammate under the
 * other would split into two people.
 *
 * Deliberately takes EVERY registration, never a filtered slice — someone who
 * leads a pending registration and is a teammate on an approved one still
 * needs their uid known here, or they key by email now and abruptly re-key by
 * uid the moment that pending row is approved.
 *
 * Iterated in a stable order and first-uid-wins, so two accounts sharing a
 * contact address produce the same grouping on every request rather than
 * whichever Firestore happened to return first.
 */
export function buildUidByEmail(registrations) {
  const rows = [...(registrations || [])].sort(
    (a, b) =>
      (a.created_at || "").localeCompare(b.created_at || "") || (a.id || "").localeCompare(b.id || "")
  );
  const map = new Map();
  for (const row of rows) {
    if (!row?.uid) continue;
    for (const address of [row.email, row.user_email]) {
      const key = normalizeEmail(address);
      if (key && !map.has(key)) map.set(key, row.uid);
    }
  }
  return map;
}

/** Turn an email->uid map into the resolver the rollups use. A teammate known
 * only by email resolves to the uid of whatever they lead elsewhere, which is
 * what merges their two appearances onto one row. */
export function keyResolver(uidByEmail) {
  return function keyFor({ uid, email } = {}) {
    if (uid) return uid;
    const key = normalizeEmail(email);
    if (!key) return "";
    return uidByEmail.get(key) || key;
  };
}
