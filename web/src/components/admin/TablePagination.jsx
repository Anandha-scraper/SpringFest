"use client";

/** Page controls for the admin tables.
 *
 * Both the Registrations and Approvals tables page client-side over a full
 * array the server already returned. That is deliberate: these collections are
 * a few hundred rows on one fest and `aggregate.loadAll()` scans all of them
 * into memory anyway, so a `?page=` parameter would cost the same Firestore
 * read and save only JSON bytes — which `compression` already handles.
 *
 * For the approvals queue it is also the *correct* model: approving a row
 * removes it and shifts every later index up, so server-side offset paging
 * would skip a pending approval on the next page. Paging over a snapshot and
 * reloading after each decision has no such hole.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Collapses a run of page numbers into the usual 1 … 4 5 6 … 20 shape. */
export function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("ellipsis");
    out.push(sorted[i]);
  }
  return out;
}

export default function TablePagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const go = (p) => onPage(Math.min(totalPages, Math.max(1, p)));

  return (
    <nav className="pager" aria-label="pagination">
      <button
        type="button"
        className="pager__nav"
        aria-label="Go to previous page"
        onClick={() => go(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div className="pager__pages" role="list">
        {pageList(page, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <span className="pager__gap" key={`e${i}`} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={p}
              className={p === page ? "pager__page is-active" : "pager__page"}
              aria-current={p === page ? "page" : undefined}
              onClick={() => go(p)}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <span className="pager__count">
        Page {page} of {totalPages}
      </span>

      <button
        type="button"
        className="pager__nav"
        aria-label="Go to next page"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}