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
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // Seeded organiser accounts — any Google login with one of these emails
  // gets admin access. Comma separated, case-insensitive.
  ADMIN_EMAILS: parseAdminEmails(process.env.ADMIN_EMAILS),
};
