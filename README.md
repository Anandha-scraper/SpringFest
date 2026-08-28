# Spring Fest 2k26

Event registration site for Spring Fest 2k26 — a React (Vite) frontend and a FastAPI backend, using Firebase Auth + Firestore, with Razorpay for paid events.

Sign-in is Google-only. Access is role-based (participant, volunteer, judge, admin), with the backend as the sole authority on roles.

## Prerequisites

- Node.js 18+
- Python 3.11+ (developed on 3.14)
- A Firebase project

## 1. Firebase setup

Filling in `.env` is not enough on its own — four things must be done in the console first.

**a. Create a Firestore database** — Build → Firestore Database → Create database. Native mode. Pick a location close to your users (`asia-south1` for India); the location is permanent.

> If you give the database a name other than `(default)`, you must set `FIRESTORE_DATABASE_ID` in `backend/.env` to match it exactly. The Admin SDK connects to `(default)` otherwise and every call fails with `404 The database (default) does not exist`.

**b. Enable Google sign-in** — Authentication → Sign-in method → Google → Enable, and set a support email. Also set a public-facing project name, since users see it in the Google popup. No other provider is needed.

**c. Register a web app** — Project settings → Your apps → Web. Copy the config values into `frontend/.env`.

**d. Create a service account key** — Project settings → Service accounts → Generate new private key. Save it as `backend/serviceAccountKey.json`. It's gitignored; never commit it or expose it to the frontend — it bypasses all Firestore security rules.

Then grant that service account Firestore access, which **is not granted automatically**:

[Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam) → find `firebase-adminsdk-…@<project>.iam.gserviceaccount.com` → Edit → Add role → **Cloud Datastore User** (`roles/datastore.user`).

> Skipping this produces `403 Missing or insufficient permissions` on every Firestore call, even though Auth works fine.

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then fill it in
./run.sh
```

`./run.sh` is a wrapper for `.venv/bin/uvicorn app.main:app --reload --port 8000`; override the port with `PORT=9000 ./run.sh`.

Runs on http://localhost:8000. Check it with `curl localhost:8000/` → `{"status":"ok"}`.

The virtualenv never needs activating — `.venv/bin/…` resolves its own environment.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # then fill it in
npm run dev
```

Runs on http://localhost:5173. Vite reads `.env` only at startup, so restart it after any change there.

## Both at once

```bash
./dev.sh
```

Starts both servers and stops both on Ctrl+C. Assumes the setup above is done.

## Configuration

`backend/.env` — see `backend/.env.example`:

| Variable | Purpose |
|---|---|
| `FIREBASE_CREDENTIALS` | Path to the service account key. Ignored on Cloud Run, which uses Application Default Credentials. |
| `FIRESTORE_DATABASE_ID` | `(default)`, or the name of your database if you created a named one. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay credentials. The id reaches the browser to open Checkout; the secret is server-only. |
| `CORS_ORIGINS` | Comma-separated allowed origins. Must include the frontend's dev URL. |
| `ADMIN_EMAILS` | Comma-separated emails granted admin on sign-in. |

`frontend/.env` — see `frontend/.env.example`. The `VITE_FIREBASE_*` values are public by design: they identify the project and grant nothing on their own. Access is controlled by Firebase Auth and the backend.

## Architecture

- **Firestore is backend-only.** The browser never reads or writes it directly; everything goes through the API using the Admin SDK.
- **Auth.** The frontend signs in with Google and sends the Firebase ID token as `Authorization: Bearer …`. `backend/app/deps.py` verifies it and resolves the caller's role from `ADMIN_EMAILS` and the `roles` collection. `GET /api/me` returns it.
- **Payments.** `POST /api/registrations` reads the fee from the *event* document, never the client payload, and creates a pending registration. Free events are confirmed immediately and return an empty `order_id`, which the frontend treats as "skip checkout". Paid events get a Razorpay order; `POST /api/registrations/verify` checks the signature server-side before confirming. Registration status only ever advances on the server.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `404 The database (default) does not exist` | `FIRESTORE_DATABASE_ID` doesn't match your database name. |
| `403 Missing or insufficient permissions` | Service account is missing **Cloud Datastore User**. |
| `auth/operation-not-allowed` on sign-in | Google provider isn't enabled in the console. |
| `auth/unauthorized-domain` | Add the domain under Authentication → Settings → Authorized domains. |
| Frontend says Firebase is not configured | `VITE_FIREBASE_*` missing from `frontend/.env`, or Vite wasn't restarted. |
| CORS errors in the browser | Frontend origin missing from `CORS_ORIGINS`. |
