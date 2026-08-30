import "dotenv/config";

function parseAdminEmails(raw) {
  return new Set(
    (raw || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const settings = {
  FIREBASE_CREDENTIALS: process.env.FIREBASE_CREDENTIALS || "./serviceAccountKey.json",
  // Firestore database id; "(default)" unless a named database was created.
  FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID || "(default)",
  // Payment gateway credentials. Named gateway-agnostically; the id reaches
  // the browser to open checkout, the secret is server-only.
  PAYMENT_KEY_ID: process.env.PAYMENT_KEY_ID || "",
  PAYMENT_KEY_SECRET: process.env.PAYMENT_KEY_SECRET || "",
  // Cloud Storage bucket holding payment proofs and generated QR tickets.
  // Empty means storage-backed features fail with a clear 503 rather than
  // the server refusing to boot — same posture as the payment keys.
  STORAGE_BUCKET: process.env.STORAGE_BUCKET || "",
  // HMAC key for check-in QR tokens. Server-only: a leak would let someone
  // mint a valid ticket for a registration they never paid for.
  QR_SECRET: process.env.QR_SECRET || "",
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // Seeded organiser accounts — any Google login with one of these emails
  // gets admin access. Comma separated, case-insensitive.
  ADMIN_EMAILS: parseAdminEmails(process.env.ADMIN_EMAILS),
};
