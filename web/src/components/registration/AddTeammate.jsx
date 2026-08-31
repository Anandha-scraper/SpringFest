"use client";

import { useEffect, useState } from "react";
import "@/styles/components/add-teammate.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.jsx";
import DetailFields from "@/components/registration/DetailFields.jsx";
import Loader from "@/components/common/Loader.jsx";
import PaymentProofForm from "@/components/registration/PaymentProofForm.jsx";
import { addTeamMember, getTopupPayment, submitPaymentProof } from "@/api/client.js";
import { openCheckout } from "@/api/payment.js";
import { useAuth } from "@/auth/AuthContext.jsx";

const blank = () => ({
  name: "", email: "", phone: "", college: "", department: "", year: "", location: "", location_other: "",
});
const digitsOnly = (v) => v.replace(/\D/g, "").slice(0, 10);

/**
 * Slide-over for adding one teammate to an already-confirmed team registration.
 * Step 1 collects the teammate's details; step 2 collects payment for exactly
 * one extra entry fee, through whichever flow the fest is running (screenshot
 * proof → admin approval, or the Razorpay gateway). Pass `resume` to jump
 * straight to step 2 for a top-up the lead started but didn't pay.
 */
export default function AddTeammate({ registration, event, resume = false, onClose, onDone }) {
  const { paymentUpiId, hasPaymentQr } = useAuth();
  const [step, setStep] = useState(resume ? "pay" : "form");
  const [member, setMember] = useState(blank);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== "pay" || pay) return;
    let alive = true;
    getTopupPayment(registration.id)
      .then((d) => alive && setPay(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [step, pay, registration.id]);

  const change = (f, v) => setMember((m) => ({ ...m, [f]: v }));
  const amountDue = pay?.amount_due ?? Math.round((pay?.amount || 0) / 100);
  const eventName = event?.name || registration.event_name || "";

  const submitForm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await addTeamMember(registration.id, member);
      if (!res.amount) {
        onDone("added"); // free event — nothing to pay
        return;
      }
      setPay(res);
      setStep("pay");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleProof = async ({ transactionId, file }) => {
    setBusy(true);
    setError("");
    try {
      await submitPaymentProof(registration.id, { transactionId, file });
      onDone("review");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const payGateway = () => {
    setError("");
    openCheckout({
      order: {
        key_id: pay.key_id,
        amount: pay.amount,
        currency: pay.currency || "INR",
        order_id: pay.order_id,
        registration_id: registration.id,
      },
      user: member.email
        ? member
        : { name: registration.name, email: registration.email, phone: registration.phone },
      event: { name: eventName },
      onSuccess: () => onDone("paid"),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="at-sheet">
        <SheetHeader className="at-head">
          <SheetTitle className="pr-6">Add a teammate</SheetTitle>
          <SheetDescription>
            {eventName}
            {" · "}
            {step === "form"
              ? "Their details, then one more entry fee."
              : "Pay for the added teammate to confirm them."}
          </SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="form at-body" onSubmit={submitForm}>
            <h4>Member {(registration.team_size || 1) + 1}</h4>

            <label htmlFor="at-name">Full name</label>
            <input
              id="at-name"
              required
              minLength={2}
              value={member.name}
              onChange={(e) => change("name", e.target.value)}
            />

            <label htmlFor="at-email">Email</label>
            <input
              id="at-email"
              type="email"
              required
              value={member.email}
              onChange={(e) => change("email", e.target.value)}
            />

            <label htmlFor="at-phone">Phone</label>
            <input
              id="at-phone"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              value={member.phone}
              onChange={(e) => change("phone", digitsOnly(e.target.value))}
            />

            <DetailFields idPrefix="at" values={member} onChange={change} labelled />

            {error && <p className="error">{error}</p>}
            <div className="form-actions-row">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Please wait…" : "Continue to payment"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        ) : !pay ? (
          <div className="at-body">
            {error ? <p className="error">{error}</p> : <Loader compact />}
          </div>
        ) : pay.payment_mode === "screenshot" ? (
          <div className="at-body">
            <PaymentProofForm
              amount={amountDue}
              upiId={pay.upi_id || paymentUpiId}
              hasQr={pay.has_qr ?? hasPaymentQr}
              rejectionNote={pay.rejection_note || ""}
              onSubmit={handleProof}
              submitting={busy}
            />
            <button className="btn btn-ghost at-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="form at-body">
            <p className="notice">
              <strong>Pay ₹{amountDue}</strong> for the added teammate to confirm them.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="form-actions-row">
              <button className="btn" type="button" onClick={payGateway}>
                Pay ₹{amountDue}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
