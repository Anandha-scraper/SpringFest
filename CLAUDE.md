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
uvicorn app.main:app --reload --port 8000   # docs at /docs
python seed_events.py                       # (re)populate the Firestore `events` collection
python seed_roles.py                        # (re)populate the Firestore `roles` collection
```

There is **no `requirements.txt`** — the venv is the only record of the dependency set:
`fastapi`, `uvicorn`, `firebase-admin`, `razorpay`, `python-dotenv`, `pydantic[email]`. Install those
directly when rebuilding the venv, or `pip freeze > requirements.txt` first if you're about to deploy.

There is no deploy configuration in the repo. Firebase Hosting was removed; `npm run build` produces
`frontend/dist`, and where that gets served is not decided here. Don't reintroduce `firebase.json` or
`.firebaserc` unless asked.

There is no test suite, linter, or formatter configured. Don't invent commands for them.

## Architecture

**Two independent halves.** The frontend talks to the backend only through `frontend/src/api/client.js`,
which prefixes every path with `VITE_API_BASE` (default `http://localhost:8000/api`). All backend routers
are mounted under `/api`, and `VITE_API_BASE` is the single knob that points the browser at them. **The
backend is not deployed anywhere** — it runs locally on :8000, so anything past the public landing page
only works against a local API.

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

**API surface** (all under `/api`): `GET /events`, `GET /events/{id}` (public); `GET /me`,
`GET /me/registrations`, `POST /registrations`, `POST /registrations/verify` (authenticated);
`GET /admin/stats`, `/admin/registrations`, `/admin/registrations.csv`,
`/admin/events/{id}/participants`, and `GET|POST|DELETE /admin/people` (admin). Every one of these has
a matching wrapper in `frontend/src/api/client.js` — add both halves together or the frontend can't
reach it.

**Only the admin dashboard is wired to the backend.** The judge, volunteer and participant sections
under `frontend/src/pages/roles/` are presentational stubs ("Scoring goes here") with no API behind
them; the routing, guards and role resolution around them are real. `/participant/registrations` and
the top-level `/my-registrations` render the same `MyRegistrations` component.

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
  handles `/#events`-style hash scrolling. It currently renders only `Hero`, `EventsPreview` and
  `Schedule` — `HeroShowcase.jsx`, `ScheduleFlow.jsx` and `pages/Home.jsx` are earlier versions that
  nothing imports. Check `Landing.jsx` before editing a section, so you don't fix the unrouted one.
- The role dashboards reuse the admin stylesheet: `admin.css` classes (`admin-panel`, `panel-head`,
  `empty-state`) are the shared vocabulary for every `/admin`, `/judge`, `/volunteer`, `/participant`
  page, not admin-only styling.
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

`.gitignore` lists `CLAUDE.md`, but this file was committed before that entry was added, so it *is*
tracked and edits to it do show up in diffs — `.gitignore` never untracks. `frontend/package-lock.json`
is genuinely ignored, so npm dependency changes leave no lockfile in the diff.

`.env` files already exist locally.
- `frontend/.env`: `VITE_API_BASE`, `VITE_FIREBASE_API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID`
- `backend/.env`: `FIREBASE_CREDENTIALS` (path to a service-account JSON; falls back to Application
  Default Credentials on Cloud Run), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CORS_ORIGINS`
  (must list every dev-server port actually in use — Vite falls through to 5174 when 5173 is taken, and a
  missing origin looks exactly like a broken backend), `ADMIN_EMAILS`
