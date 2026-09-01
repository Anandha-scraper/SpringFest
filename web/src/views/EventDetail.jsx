"use client";

import { useEffect, useState } from "react";
import "@/styles/pages/event-detail.css";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import {
  createRegistration,
  getEvent,
  getEvents,
  getMyRegistrations,
  submitPaymentProof,
} from "@/api/client.js";
import { openCheckout } from "@/api/payment.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { formatEventTime } from "@/utils/format.js";
import RegistrationForm from "@/components/registration/RegistrationForm.jsx";
import PaymentProofForm from "@/components/registration/PaymentProofForm.jsx";
import RegistrationResultDialog from "@/components/registration/RegistrationResultDialog.jsx";
import Loader from "@/components/common/Loader.jsx";
import { useDeferredLoading } from "@/hooks/useDeferredLoading.js";
import { homeForRole } from "@/content/roles.js";

// Statuses that hold a slot against the per-category cap. Mirrors
// LIVE_STATUSES in backend/utils/statuses.js — `draft` counts there too, so a
// saved-but-unfinished form is shown as using up an allowance here as well.
const HOLDS_A_SLOT = ["draft", "pending", "awaiting_approval", "completed", "rejected"];

/** Pull just the form-shaped fields out of a saved draft (or any registration
 * row) — the row also carries id/status/fee/etc. that the form has no use
 * for and shouldn't echo back on submit. */
function draftInitialValues(row) {
  if (!row) return null;
  return {
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    college: row.college || "",
    department: row.department || "",
    year: row.year || "",
    location: row.location || "",
    location_other: row.location_other || "",
    team_name: row.team_name || "",
    members: (row.members || []).map((m) => ({
      name: m.name || "",
      email: m.email || "",
      phone: m.phone || "",
      college: m.college || "",
      department: m.department || "",
      year: m.year || "",
      location: m.location || "",
      location_other: m.location_other || "",
    })),
  };
}

export default function EventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resume") || "";
  const { categoryLimits, paymentUpiId, hasPaymentQr, registrationOpen, role } = useAuth();

  const [event, setEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // The outcome popup shown over this page before we move on. Every flow —
  // free, screenshot proof, gateway — ends here rather than on its own route.
  const [result, setResult] = useState(null);
  // Set once a screenshot-mode registration exists and is waiting for its
  // proof — this is what swaps the details form for the upload step.
  const [awaitingProof, setAwaitingProof] = useState(null);
  const loading = useDeferredLoading(!event);

  // MyRegistrations links back here to resume a saved draft or resubmit after
  // a rejection. It hands over only the registration id (?resume=), so the row
  // itself is fetched from the caller's own registrations — the server already
  // scopes that list to them, so a guessed id in the URL buys nothing.
  const [resume, setResume] = useState(null);
  const isDraftResume = resume?.status === "draft";
  // Everything this person already holds, and every event's category — used
  // for the resume lookup and for the per-category cap notice below. Fetched
  // unconditionally (it used to be gated on ?resume=): the cap has to be known
  // on a plain visit too, or the form only refuses after it has been filled in.
  const [myRegs, setMyRegs] = useState(null);
  const [allEvents, setAllEvents] = useState([]);

  useEffect(() => {
    let live = true;
    Promise.all([getMyRegistrations(), getEvents()])
      .then(([rows, events]) => {
        if (!live) return;
        setMyRegs(rows || []);
        setAllEvents(events || []);
        if (resumeId) setResume((rows || []).find((r) => r.id === resumeId) || null);
      })
      .catch(() => {
        // Signed out, or the call failed: the form still renders and the
        // server stays the authority on both the cap and the resume.
        if (live) setMyRegs([]);
      });
    return () => {
      live = false;
    };
  }, [resumeId]);

  useEffect(() => {
    getEvent(id).then(setEvent).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    // A draft goes back into the form itself (prefilled); a rejected *paid*
    // registration skips straight to the proof step. A rejected free one has
    // no proof to give, so it falls through to the form for a plain resubmit.
    if (resume && !isDraftResume && resume.fee > 0) {
      setAwaitingProof({
        registrationId: resume.id,
        amount: resume.fee,
        rejectionNote: resume.review_note || "",
      });
    }
  }, [resume, isDraftResume]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError("");
    try {
      const order = await createRegistration({ event_id: id, ...form });

      // Which flow follows is the server's call, not the client's — it stamps
      // the mode on the registration so it can't change underneath us.
      if (order.payment_mode === "free") {
        // Nothing to pay — the row is already in the organiser's queue.
        setResult({
          awaiting: true,
          free: true,
          registrationId: order.registration_id,
        });
        return;
      }

      if (order.payment_mode === "screenshot") {
        setAwaitingProof({
          registrationId: order.registration_id,
          amount: Math.round((order.amount || 0) / 100),
          rejectionNote: "",
        });
        setSubmitting(false);
        return;
      }

      openCheckout({
        order,
        user: form,
        event,
        onSuccess: (r) =>
          setResult({
            awaiting: false,
            registrationId: r.registration_id,
            codes: r.allocation_codes || [],
          }),
        onError: (e) => {
          setError(e.message);
          setSubmitting(false);
        },
      });
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (form) => {
    setSubmitting(true);
    setError("");
    try {
      await createRegistration({ event_id: id, ...form, save_as_draft: true });
      router.push("/my-registrations");
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const handleProof = async ({ transactionId, file }) => {
    setSubmitting(true);
    setError("");
    try {
      await submitPaymentProof(awaitingProof.registrationId, { transactionId, file });
      setResult({ awaiting: true, registrationId: awaitingProof.registrationId });
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  if (error && !event) {
    return (
      <div className="container">
        <p className="error">{error}</p>
      </div>
    );
  }
  if (loading || !event) return <Loader />;

  // Both gates, not just the fest-wide one: an organiser can close a single
  // event whose slots are full while the rest of the fest keeps taking
  // entries, and the server refuses that case whether or not this page says so.
  const eventClosed = event.registration_open === false;
  const closed = !registrationOpen || eventClosed;

  // Courtesy check only — the server enforces the same rule and is the
  // authority. Rows for *this* event are excluded because those are a resume,
  // which never consumes a fresh slot.
  const categoryOf = new Map((allEvents || []).map((e) => [e.id, e.category || ""]));
  const limit = Number(categoryLimits?.[event.category]) || 0;
  const heldInCategory = (myRegs || []).filter(
    (r) =>
      r.event_id !== id &&
      HOLDS_A_SLOT.includes(r.status) &&
      categoryOf.get(r.event_id) === event.category
  );
  const capReached = limit > 0 && heldInCategory.length >= limit;

  return (
    <div className="container event-register">
      <div className="detail-card">
        {error && <p className="error">{error}</p>}
        {closed && !awaitingProof ? (
          <div className="notice notice-warn">
            <strong>Registration is closed</strong>
            <p>
              {eventClosed && registrationOpen
                ? `The organisers aren't accepting new sign-ups for ${event.name} right now.`
                : "The organisers aren't accepting new sign-ups right now."}
            </p>
          </div>
        ) : awaitingProof ? (
          <>
            <h2>Confirm your payment</h2>
            <p className="muted register-note">
              Your place is held. An organiser checks the proof and confirms you —
              you'll see the result under My Registrations.
            </p>
            <PaymentProofForm
              amount={awaitingProof.amount || event.fee}
              upiId={paymentUpiId}
              hasQr={hasPaymentQr}
              rejectionNote={awaitingProof.rejectionNote}
              onSubmit={handleProof}
              submitting={submitting}
            />
          </>
        ) : capReached ? (
          <div className="notice notice-warn">
            <strong>You've reached the {event.category} limit</strong>
            <p>
              You can register for at most {limit} {event.category} event
              {limit === 1 ? "" : "s"}, and you already have{" "}
              {heldInCategory.map((r) => r.event_name).join(", ")}.
            </p>
          </div>
        ) : (
          <>
            <h2>Your details</h2>
            <p className="muted register-note">
              {event.fee > 0
                ? "You'll confirm payment after this step."
                : "This event is free — an organiser will confirm your spot."}
            </p>
            <RegistrationForm
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
              submitting={submitting}
              fee={event.fee}
              event={event}
              initialValues={resume ? draftInitialValues(resume) : null}
            />
          </>
        )}
      </div>

      <aside className="event-summary">
        {event.category && <span className="tag">{event.category}</span>}
        <h1>{event.name}</h1>
        <ul className="event-summary__meta">
          <li>
            <CalendarDays size={15} aria-hidden="true" />
            <span>{formatEventTime(event) || "Date to be announced"}</span>
          </li>
          {event.venue_name && (
            <li>
              <MapPin size={15} aria-hidden="true" />
              <span>{event.venue_name}</span>
            </li>
          )}
          <li>
            <Wallet size={15} aria-hidden="true" />
            <span>
              {event.fee > 0
                ? `₹${event.fee}${event.is_team_event ? " / person" : ""}`
                : "Free entry"}
            </span>
          </li>
          {event.is_team_event && (
            <li>
              <Users size={15} aria-hidden="true" />
              <span>Teams of {event.team_min}–{event.team_max}</span>
            </li>
          )}
        </ul>
        {event.description && <p className="muted">{event.description}</p>}
      </aside>

      <RegistrationResultDialog
        open={!!result}
        awaiting={result?.awaiting}
        free={result?.free}
        registrationId={result?.registrationId}
        codes={result?.codes}
        // homeForRole, not a hardcoded /participant: a volunteer can
        // register too, and /participant's role guard would bounce them.
        onDone={() => router.push(homeForRole(role))}
      />
    </div>
  );
}
