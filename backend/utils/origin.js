/** Where a registration came from.
 *
 * Two values, and only two, because this field drives the allocation code's
 * prefix (services/allocation.service.js):
 *
 *   online → SF…   someone filled the public form themselves
 *   spot   → SP…   an organiser entered them at the desk on fest day
 *
 * Both prefixes draw their participant number from the same
 * `counters/{eventId}` document, so SFTA7 and SPTA8 are one sequence and can
 * never collide — the prefix says how they got in, not which numbering they
 * belong to.
 *
 * A pure-string module with no imports, in `utils/` beside identity/slugify,
 * because both the write paths and the admin read rollups need it and having
 * a rollup module imported by the write path would invert the layering the
 * rest of the backend is careful about.
 *
 * `originOf()` defaults to `online` for a row with no field at all, which is
 * what makes this backfill-free: every registration predating the feature
 * came through the web form, and every code already minted is already `SF`.
 * The cost of that choice: a Firestore `where("origin", "==", "online")`
 * would miss every one of those rows, so origin is only ever filtered
 * in-memory over `aggregate.loadAll()` — which is how the admin lists
 * already work.
 *
 * Once codes are minted the value must never change: `addMember` mints the
 * new seats with whatever the row says now, so flipping it would hand one
 * team two different prefixes. It is deliberately absent from
 * `adminReports.editRegistration`'s allow-list.
 */

export const ORIGIN_ONLINE = "online";
export const ORIGIN_SPOT = "spot";

export const ORIGINS = [ORIGIN_ONLINE, ORIGIN_SPOT];

/** Code prefix per origin. Keyed on the exact ORIGIN_* strings. */
export const ORIGIN_PREFIX = {
  [ORIGIN_ONLINE]: "SF",
  [ORIGIN_SPOT]: "SP",
};

/** The origin of a registration row — `online` unless it explicitly says
 * otherwise, so an unknown or missing value can never produce a code with no
 * prefix. */
export function originOf(row) {
  return row?.origin === ORIGIN_SPOT ? ORIGIN_SPOT : ORIGIN_ONLINE;
}

/** The `SF`/`SP` an allocation code for this row starts with. */
export function prefixFor(row) {
  return ORIGIN_PREFIX[originOf(row)];
}
