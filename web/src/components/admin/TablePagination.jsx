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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination.jsx";

/** Collapses a run of page numbers into shadcn's usual 1 … 4 5 6 … 20 shape. */
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

  return (
    <Pagination className="reg-pagination">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPage(Math.max(1, page - 1))}
            className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        {pageList(page, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === page}
                onClick={() => onPage(p)}
                className="cursor-pointer"
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
