import { useCallback, useMemo, useState } from "react";
import RegistrationsTable from "../../components/admin/RegistrationsTable.jsx";
import { getParticipants, downloadRegistrationsCsv } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination.jsx";

const PAGE_SIZE = 8;

// Collapses a run of page numbers into shadcn's usual 1 … 4 5 6 … 20 shape.
function pageList(current, total) {
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

export default function Registrations() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const fetcher = useCallback(() => getParticipants(), []);
  const { data, error, loading } = useApi(fetcher);
  const people = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((r) =>
      [r.name, r.email, r.phone, r.college, r.team_name, ...r.events.map((e) => e.event_name)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [query, people]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSearch = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  if (loading) return <div className="spinner" />;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="admin">
      <section className="admin-panel">
        <div className="reg-toolbar">
          <Input
            type="search"
            placeholder="Search name, email, team, college…"
            value={query}
            onChange={onSearch}
            className="reg-search"
          />
          <span className="reg-total">
            {/* People, not registrations — the rows are one per person. */}
            {filtered.length} participant{filtered.length === 1 ? "" : "s"}
            {query && ` matching "${query}"`}
          </span>
          <Button type="button" variant="outline" onClick={() => downloadRegistrationsCsv()}>
            Export CSV
          </Button>
        </div>

        <RegistrationsTable rows={pageRows} minRows={PAGE_SIZE} />

        {totalPages > 1 && (
          <Pagination className="reg-pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={safePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {pageList(safePage, totalPages).map((p, i) =>
                p === "ellipsis" ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === safePage}
                      onClick={() => setPage(p)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={safePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>
    </div>
  );
}
