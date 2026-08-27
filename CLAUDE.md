# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Spring Fest 2k26 — a college technical-symposium site: a React/Vite marketing landing page plus event
registration with Google sign-in and Razorpay payments, backed by a FastAPI + Firestore API.
Firebase project: `spring-fest-ksrce-cse`.

## Commands

Frontend (`frontend/`):
```bash
npm install
npm run dev        # vite dev server on :5173
npm run build      # -> frontend/dist
npm run preview
```

Backend (`backend/`, venv at `backend/.venv`):
```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # docs at /docs
python seed_events.py                       # (re)populate the Firestore `events` collection
python seed_roles.py                        # (re)populate the Firestore `roles` collection
```

Deploy (frontend only — `firebase.json` serves `frontend/dist` as an SPA):
```bash
npm --prefix frontend run build && firebase deploy --only hosting
```

There is no test suite, linter, or formatter configured. Don't invent commands for them.

## Architecture

**Two independent halves.** The frontend talks to the backend only through `frontend/src/api/client.js`,
which prefixes every path with `VITE_API_BASE` (default `http://localhost:8000/api`). All backend routers
are mounted under `/api` because the intended production topology is a Firebase Hosting rewrite
`/api/**` → Cloud Run. **That rewrite does not exist in `firebase.json` yet and the backend is not
deployed** — the live site is currently the static landing page only.

**Auth is Firebase ID tokens, end to end.** The browser signs in with Google
(`frontend/src/auth/AuthContext.jsx`), and `client.js` attaches
`Authorization: Bearer <idToken>` to any request flagged `authRequired`. The backend verifies it in
`backend/app/deps.py` and exposes two dependency shorthands: `CurrentUser` and `AdminUser`.

**Roles are resolved server-side, on every authenticated request.** Four roles: `admin`, `judge`,
`volunteer`, `participant`. `backend/app/services/roles.py` is the only place that decides, with a fixed
precedence: `ADMIN_EMAILS` (comma-separated, in `backend/.env`) → the Firestore `roles` collection →
`participant`. That last fallback is why there is no participant list — anyone not explicitly an admin,
judge or volunteer is one. Env admins are deliberately unremovable through the API, so they are the
lockout recovery path; never let `ADMIN_EMAILS` become empty.

`deps.get_current_user` attaches `role` (and `is_admin`, kept as `role == "admin"`) to the user dict, and
`require_roles(*roles)` builds guards — `AdminUser`, `JudgeUser`, `VolunteerUser`. **Admin satisfies every
role check**, expressed once in `require_roles` so it can't drift. A Firestore failure during resolution
is a 503, never a silent demotion to participant.

Admins manage judges and volunteers through `/api/admin/people` (GET/POST/DELETE). Demoting someone is a
DELETE, not a write — `participant` is deliberately absent from `ASSIGNABLE_ROLES`, since the role *is* the
absence of a record. The API refuses to let an admin change their own role or touch a seeded env admin.

The frontend never decides roles; it reads `role` from `GET /api/me` (`AuthContext`) and uses it only to
pick a dashboard and render links — never as an access decision.

**Registration + payment flow** (`backend/app/routers/registrations.py`):
`POST /api/registrations` creates a Firestore `registrations` doc with `status: "pending"`; a zero-fee
event is confirmed immediately, otherwise a Razorpay order is created and returned. The browser opens
checkout via `frontend/src/api/payment.js`, then `POST /api/registrations/verify` checks the signature
server-side and flips the doc to `confirmed` (or `failed`). Never mark a registration confirmed from the
client.

**Firestore collections:** `events` (doc id is the slug, e.g. `hackathon-24h`), `registrations`, and
`roles` (doc id is the lowercased email).
There are no migrations — shape is defined by `backend/app/models/schemas.py` and `seed_events.py`.
Admin aggregation (`routers/admin.py`) streams the whole `registrations` collection and filters in
Python; the CSV export shares `_apply_filters` with the JSON endpoint, so keep `CSV_COLUMNS` in sync
when adding fields.

**Firebase config is fail-soft.** `frontend/src/auth/firebase.js` detects missing/placeholder
`VITE_FIREBASE_*` values and exports `auth = null` with `isFirebaseConfigured = false`, so public pages
still render instead of white-screening. Any new code touching `auth` must tolerate `null`.

## Frontend conventions

- **All fest copy lives in `frontend/src/content/fest.js`** — names, dates, stats, schedule, FAQs,
  contacts, partners, and the nav/bubble-menu item lists. Change content there, not in components.
- `src/components/reactbits/` holds vendored ReactBits animation components (GSAP / motion / ogl).
  Treat them as third-party: prefer configuring via props over rewriting internals.
- `src/components/sections/` are the landing-page sections; `Landing.jsx` composes them in order and
  handles `/#events`-style hash scrolling.
- Styling is plain CSS in `src/styles/`, all imported once in `main.jsx`. Colors come from CSS custom
  properties in `tokens.css`. The token *names* are historical (`--pink`, `--mint`, `--lilac`) and no
  longer match their values (orange / sage / navy) — reuse the existing names rather than renaming, since
  they're referenced across ~1500 lines of CSS.
- Routing lives entirely in `main.jsx`. `/login` renders outside `Layout` (no navbar/footer); everything
  else nests under it. `/admin`, `/judge`, `/volunteer` and `/participant` are parent routes rendering the
  shared `RoleLayout` (heading + sidebar + `<Outlet/>`), with their sections as children. Guards are
  `<ProtectedRoute adminOnly>` or `<ProtectedRoute roles={[...]}>`; a denied user is sent to their own
  dashboard, not `/`.
- The Razorpay checkout script is a `<script>` tag in `index.html`; `window.Razorpay` is a global.

## Environment

`.env` files are gitignored and already exist locally.
- `frontend/.env`: `VITE_API_BASE`, `VITE_FIREBASE_API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID`
- `backend/.env`: `FIREBASE_CREDENTIALS` (path to a service-account JSON; falls back to Application
  Default Credentials on Cloud Run), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CORS_ORIGINS`
  (must list every dev-server port actually in use — Vite falls through to 5174 when 5173 is taken, and a
  missing origin looks exactly like a broken backend), `ADMIN_EMAILS`
