"use client";

import { useCallback, useMemo, useState } from "react";
import "@/styles/pages/admin/registrations.css";
import Loader from "@/components/common/Loader.jsx";
import RegistrationsTable from "@/components/admin/RegistrationsTable.jsx";
import TablePagination from "@/components/admin/TablePagination.jsx";
import { getParticipants, downloadRegistrationsCsv } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { useToast } from "@/components/ui/toast.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Button } from "@/components/ui/button.jsx";

const PAGE_SIZE = 8;

export default function Registrations() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const fetcher = useCallback(() => getParticipants(), []);
  const { data, error, loading, reload } = useApi(fetcher);
  const people = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((r) =>
      [
        r.name,
        r.email,
        r.phone,
        r.college,
        // Every team they're in, not just one — a person can lead several.
        ...r.teams.map((t) => t.team_name),
        ...r.events.map((e) => e.event_name),
      ]
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

  if (loading) return <Loader />;
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
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadRegistrationsCsv().catch((err) => toast.bad(err.message))
            }
          >
            Export CSV
          </Button>
        </div>

        <RegistrationsTable rows={pageRows} minRows={PAGE_SIZE} onSaved={reload} />

        <TablePagination page={safePage} totalPages={totalPages} onPage={setPage} />
      </section>
    </div>
  );
}
