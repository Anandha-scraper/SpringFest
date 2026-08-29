import { existsSync } from "node:fs";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { settings } from "../config.js";

let db = null;

function initApp() {
  if (admin.apps.length) return;
  // Only set storageBucket when configured — passing an empty string makes
  // every bucket() call fail with a confusing SDK error instead of the 503
  // services/storage.js raises.
  const options = settings.STORAGE_BUCKET ? { storageBucket: settings.STORAGE_BUCKET } : {};
  if (existsSync(settings.FIREBASE_CREDENTIALS)) {
    admin.initializeApp({
      ...options,
      credential: admin.credential.cert(settings.FIREBASE_CREDENTIALS),
    });
  } else {
    // App Hosting / Cloud Run: use Application Default Credentials.
    admin.initializeApp(options);
  }
}

export function getDb() {
  if (!db) {
    initApp();
    // getFirestore(app, databaseId) is the multi-database entry point — plain
    // admin.firestore() only ever gives you "(default)" regardless of what's
    // passed to .settings(), so a named database has to go through this.
    db = getFirestore(admin.app(), settings.FIRESTORE_DATABASE_ID);
  }
  return db;
}

export function getAuth() {
  initApp();
  return admin.auth();
}

export function getStorage() {
  initApp();
  return admin.storage();
}
