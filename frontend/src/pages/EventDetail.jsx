import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { getEvent, createRegistration, submitPaymentProof } from "../api/client.js";
import { openCheckout } from "../api/payment.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { formatEventTime } from "../lib/format.js";
import RegistrationForm from "../components/RegistrationForm.jsx";
import PaymentProofForm from "../components/PaymentProofForm.jsx";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentInstructions } = useAuth();

  const [event, setEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Set once a screenshot-mode registration exists and is waiting for its
  // proof — this is what swaps the details form for the upload step.
  const [awaitingProof, setAwaitingProof] = useState(null);

  // MyRegistrations links back here to resubmit after a rejection, handing
  // over the registration so we can skip straight to the upload step.
  const resume = location.state?.resumeRegistration;

  useEffect(() => {
    getEvent(id).then(setEvent).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (resume) {
      setAwaitingProof({
        registrationId: resume.id,
        amount: resume.fee,
        rejectionNote: resume.review_note || "",
      });
    }
  }, [resume]);

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
      <div className="container narrow">
        <p className="error">{error}</p>
        <Link to="/#events" className="btn btn-ghost">← All events</Link>
      </div>
    );
  }
  if (!event) return <div className="spinner" />;

  return (
    <div className="container narrow">
      <Link to="/#events" className="back-link">← All events</Link>

      <div className="detail-head">
        {event.category && <span className="tag">{event.category}</span>}
        <h1>{event.name}</h1>
        <p className="muted">{event.description}</p>
        <div className="detail-meta">
          {/* Dates are stored ISO now, so format rather than printing raw. */}
          <span>📅 {formatEventTime(event) || "Date to be announced"}</span>
          {event.venue_name && <span>📍 {event.venue_name}</span>}
          <span className="price">{event.fee > 0 ? `₹${event.fee}` : "Free entry"}</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-card">
        {awaitingProof ? (
          <>
            <h2>Confirm your payment</h2>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Your place is held. An organiser checks the proof and confirms you —
              you'll see the result under My Registrations.
            </p>
            <PaymentProofForm
              amount={awaitingProof.amount || event.fee}
              instructions={paymentInstructions}
              rejectionNote={awaitingProof.rejectionNote}
              onSubmit={handleProof}
              submitting={submitting}
            />
          </>
        ) : (
          <>
            <h2>Your details</h2>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {event.fee > 0
                ? "You'll confirm payment after this step."
                : "This event is free — you'll be confirmed instantly."}
            </p>
            <RegistrationForm
              onSubmit={handleSubmit}
              submitting={submitting}
              fee={event.fee}
              event={event}
            />
          </>
        )}
      </div>
    </div>
  );
}
