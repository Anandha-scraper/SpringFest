import { useCallback, useEffect, useState } from "react";
import "@/styles/pages/admin/payment.css";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";
import TablePagination from "@/components/admin/TablePagination.jsx";
import { getApprovals, proofObjectUrl, reviewApproval } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";

// Screenshot proofs are read one at a time, so a short page keeps each
// thumbnail large enough to actually check against the transaction ID.
const PAGE_SIZE = 6;

/** The payment screenshot, inline so the queue can be reviewed at a glance.
 *
 * Fetched as a blob because the endpoint needs a bearer token — a plain
 * <img src> would send none and render broken. */
function ProofThumb({ registrationId, hasProof }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasProof) return;
    let url = "";
    let cancelled = false;
    proofObjectUrl(registrationId)
      .then((objectUrl) => {
        if (cancelled) return URL.revokeObjectURL(objectUrl);
        url = objectUrl;
        setSrc(objectUrl);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [registrationId, hasProof]);

  if (!hasProof) return <span className="muted">No screenshot</span>;
  if (error) return <span className="muted" title={error}>Unavailable</span>;
  if (!src) return <div className="proof-thumb proof-thumb--loading">…</div>;

  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
      <img className="proof-thumb" src={src} alt="Payment screenshot" />
    </a>
  );
}

export default function Approvals() {
  const fetcher = useCallback(() => getApprovals(), []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const rows = data || [];

  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const decide = async (registrationId, decision, reason = "") => {
    setBusy(registrationId);
    try {
      await reviewApproval(registrationId, decision, reason);
      await reload();
      toast.ok(decision === "approve" ? "Registration confirmed." : "Payment rejected.");
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setBusy("");
    }
  };

  const confirmReject = async () => {
    const target = rejecting;
    const reason = note.trim();
    setRejecting(null);
    setNote("");
    if (target) await decide(target.registration_id, "reject", reason);
  };

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Waiting for review</h2>
          <span className="muted">{rows.length} pending</span>
        </div>

        {!rows.length ? (
          <p className="empty-state">
            Nothing waiting. Screenshot payments show up here as participants submit them.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Transaction ID</th>
                  <th>Submitted</th>
                  <th>Proof</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <br />
                      <span className="muted">{r.email}</span>
                      {r.team_name && (
                        <>
                          <br />
                          <span className="muted">
                            Team {r.team_name} · {r.team_size} member{r.team_size === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </td>
                    <td>{r.event_name || r.event_id}</td>
                    <td>
                      ₹{r.amount_due > 0 ? r.amount_due : r.fee}
                      {r.amount_due > 0 && <span className="cell-sub">added teammate</span>}
                    </td>
                    <td className="mono">{r.transaction_id || "—"}</td>
                    <td>
                      {r.proof_uploaded_at
                        ? new Date(r.proof_uploaded_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <ProofThumb registrationId={r.id} hasProof={r.has_proof} />
                    </td>
                    <td className="row-actions">
                      <button
                        className="btn btn-sm"
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => decide(r.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => setRejecting({ registration_id: r.id, name: r.name })}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination page={safePage} totalPages={totalPages} onPage={setPage} />
      </section>

      <AlertDialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejecting?.name}'s payment?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll see this reason and can upload a new screenshot on the same
              registration, so say what needs fixing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="input"
            rows={3}
            placeholder="e.g. The screenshot is cut off — we can't see the amount."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* The API requires a reason; disabling here makes that obvious
                before the round trip. */}
            <AlertDialogAction disabled={note.trim().length < 4} onClick={confirmReject}>
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
