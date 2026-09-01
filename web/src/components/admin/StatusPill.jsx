"use client";

// "awaiting_approval" is accurate on the wire but reads badly in a pill, so
// statuses get a human label here. The class still keys off the raw value.
const LABELS = {
  awaiting_approval: "awaiting approval",
};

export default function StatusPill({ status }) {
  const value = status || "unknown";
  return <span className={`status-pill status-pill--${value}`}>{LABELS[value] || value}</span>;
}
