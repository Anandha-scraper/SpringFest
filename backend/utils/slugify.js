/** Event ids are the slugified event name, which is why two events can't share
 * a name. Lives here rather than in the events module because admin.js needs
 * the same function for venue ids — a route importing from another route was
 * the previous arrangement. */
export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
