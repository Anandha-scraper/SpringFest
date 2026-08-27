import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getEvent, createRegistration } from "../api/client.js";
import { openCheckout } from "../api/payment.js";
import RegistrationForm from "../components/RegistrationForm.jsx";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEvent(id).then(setEvent).catch((e) => setError(e.message));
  }, [id]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    setError("");
    try {
      const order = await createRegistration({ event_id: id, ...form });
      if (!order.order_id) {
        navigate("/success", { state: { registrationId: order.registration_id } });
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

  if (error && !event) {
    return (
      <div className="container narrow page-pad">
        <p className="error">{error}</p>
        <Link to="/events" className="btn btn-ghost">← All events</Link>
      </div>
    );
  }
  if (!event) return <div className="spinner" />;

  return (
    <div className="container narrow page-pad">
      <Link to="/events" className="back-link">← All events</Link>

      <div className="detail-head">
        {event.category && <span className="tag">{event.category}</span>}
        <h1>{event.name}</h1>
        <p className="muted">{event.description}</p>
        <div className="detail-meta">
          <span>📅 {event.date || "Date to be announced"}</span>
          <span className="price">{event.fee > 0 ? `₹${event.fee}` : "Free entry"}</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="detail-card">
        <h2>Your details</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          {event.fee > 0
            ? "You'll be taken to secure payment after this step."
            : "This event is free — you'll be confirmed instantly."}
        </p>
        <RegistrationForm onSubmit={handleSubmit} submitting={submitting} fee={event.fee} />
      </div>
    </div>
  );
}
