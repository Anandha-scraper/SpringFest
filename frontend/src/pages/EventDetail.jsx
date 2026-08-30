import { useEffect, useState } from "react";
import "@/styles/pages/event-detail.css";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import { getEvent, createRegistration, submitPaymentProof } from "@/api/client.js";
import { openCheckout } from "@/api/payment.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { formatEventTime } from "@/utils/format.js";
import RegistrationForm from "@/components/registration/RegistrationForm.jsx";
import PaymentProofForm from "@/components/registration/PaymentProofForm.jsx";

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
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentUpiId, hasPaymentQr, registrationOpen } = useAuth();

  const [event, setEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Set once a screenshot-mode registration exists and is waiting for its
  // proof — this is what swaps the details form for the upload step.
  const [awaitingProof, setAwaitingProof] = useState(null);

  // MyRegistrations links back here to resume a saved draft or resubmit
  // after a rejection, handing over the registration so we can pick up
  // where it left off instead of starting blank.
  const resume = location.state?.resumeRegistration;
  const isDraftResume = resume?.status === "draft";

  useEffect(() => {
    getEvent(id).then(setEvent).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    // A draft goes back into the form itself (prefilled); anything else
    // being resumed (a rejected screenshot) skips straight to the proof step.
    if (resume && !isDraftResume) {
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
          navigate("/success", { state: { registrationId: r.registration_id } }),
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
      navigate("/my-registrations");
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
      navigate("/success", {
        state: { registrationId: awaitingProof.registrationId, awaitingApproval: true },
      });
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
  if (!event) return <div className="spinner" />;

  return (
    <div className="container event-register">
      <div className="detail-card">
        {error && <p className="error">{error}</p>}
        {!registrationOpen && !awaitingProof ? (
          <div className="notice notice-warn">
            <strong>Registration is closed</strong>
            <p>The organisers aren't accepting new sign-ups right now.</p>
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
        ) : (
          <>
            <h2>Your details</h2>
            <p className="muted register-note">
              {event.fee > 0
                ? "You'll confirm payment after this step."
                : "This event is free — you'll be confirmed instantly."}
            </p>
            <RegistrationForm
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
              submitting={submitting}
              fee={event.fee}
              event={event}
              initialValues={isDraftResume ? draftInitialValues(resume) : null}
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
    </div>
  );
}
