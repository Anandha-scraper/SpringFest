"use client";

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Values from Firebase console > Project settings > Your apps (Web)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const PLACEHOLDER = /^(your-|xxx|<)/i;
const filled = (v) => Boolean(v) && !PLACEHOLDER.test(v);

// Without real credentials getAuth() throws at import time, which blanks the
// whole page. Detect that up front so the site still renders and tells the
// developer what to fix, instead of white-screening.
export const isFirebaseConfigured =
  filled(firebaseConfig.apiKey) && filled(firebaseConfig.authDomain);

export const firebaseConfigError = isFirebaseConfigured
  ? ""
  : "Firebase is not configured. Fill NEXT_PUBLIC_FIREBASE_* in web/.env.local and restart the dev server.";

let app = null;
let auth = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (e) {
    console.error("[firebase] init failed:", e);
  }
} else {
  console.warn(`[firebase] ${firebaseConfigError}`);
}

export { app, auth };
