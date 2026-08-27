import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

  if (error && !event) return <p className="error container">{error}</p>;
  if (!event) return <p className="container">Loading...</p>;

  return (
    <main className="container narrow">
      <h1>{event.name}</h1>
      <p>{event.description}</p>
      <p className="price">{event.fee > 0 ? `Fee: ₹${event.fee}` : "Free entry"}</p>
      {error && <p className="error">{error}</p>}
      <RegistrationForm onSubmit={handleSubmit} submitting={submitting} />
    </main>
  );
}
