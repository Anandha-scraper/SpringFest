# Deploying Spring Fest

Everything that can be scripted is in `deploy/`. What's left is six steps, and two of them
are just waiting.

---

## Your checklist

```
[ ] 1. ./deploy/setup-secrets.sh                      one command, all 11 secrets
[ ] 2. create the API backend      root: backend      firebase apphosting:backends:create
[ ] 3. ./deploy/setup-secrets.sh --api-origin <url>   paste the URL from step 2
[ ] 4. create the web backend      root: web          firebase apphosting:backends:create
[ ] 5. IAM: Cloud Datastore User   both service accounts
[ ] 6. custom domain               web backend only, then DNS at your registrar
[ ] 7. ./deploy/verify.sh <url>    9 automated checks
[ ] 8. sign in and click through   the part no script can do
```

---

## How it works

Two App Hosting backends, one repo, one public domain:

```
  yourdomain.com ──▶ [ web backend ]   root: web/      Next.js 15
                          │            · serves every page
                          │            · /api/* proxied server-side
                          ▼
                     [ api backend ]   root: backend/  Express
                          │            · never in the browser's URL bar
                          ▼            · keeps its default *.run.app URL
                  Firestore · Storage · Auth
```

The browser only ever talks to **one** origin. `web/app/api/[...path]/route.js` forwards
`/api/*` to the API backend from Next's server side. That is why there is no CORS setup,
why `web/src/api/client.js` uses a relative `/api` base, and why the API is not reachable
on a public domain.

**The custom domain attaches to the web backend only.** The API backend keeps its
generated URL — nothing outside the web backend ever calls it.

Both backends deploy from the same repo on push to `main`, each building only its own
directory.

---

## Step 1 — Secrets

```bash
./deploy/setup-secrets.sh --dry-run    # see what it will do, touch nothing
./deploy/setup-secrets.sh              # apply
```

Reads values from `backend/.env` and `web/.env.local`, so they must be filled in locally
first. Secret *values* are never printed. Safe to re-run any time — a re-run adds a new
version rather than failing.

`API_ORIGIN` gets a placeholder on this first pass, because it is the API backend's own
URL and that does not exist yet. Step 3 replaces it. The placeholder exists so that no
rollout fails on a secret that isn't there.

> **Never regenerate `QR_SECRET`.** It is the HMAC key behind every personal QR pass
> (`backend/auth/qrToken.js`). A new value silently invalidates every pass already
> downloaded by a participant. The script reads the existing value from `.env`, so this is
> correct by default — just don't "freshen" it while tidying.

## Steps 2 & 4 — Create the backends

```bash
firebase apphosting:backends:create --project spring-fest-ksrce-cse
```

Run it twice. The prompts, and what to answer:

| Prompt | API backend | Web backend |
|---|---|---|
| Region | pick one close to users (e.g. `asia-east1`) | **the same one** |
| GitHub repo | `Anandha-scraper/SpringFest` | same |
| Live branch | `main` | `main` |
| Root directory | `backend` | `web` |
| Backend ID | e.g. `springfest-api` | e.g. `springfest-web` |

First time only, it opens a browser to connect GitHub through Developer Connect. That
handshake is the reason this step can't be scripted.

After step 2, copy the API backend's URL and run:

```bash
./deploy/setup-secrets.sh --api-origin https://springfest-api--….run.app
```

Then create the web backend. Once both exist:

```bash
./deploy/setup-secrets.sh --grant springfest-api,springfest-web
```

## Step 5 — IAM

**Do not skip this.** A fresh backend gets a fresh service account with no permissions.
Firebase Auth keeps working, so sign-in succeeds — and then every Firestore call returns
`403 Missing or insufficient permissions`, which reads exactly like a bug in the code.

[Cloud console → IAM](https://console.cloud.google.com/iam-admin/iam) → for each backend's
service account → **Add role → Cloud Datastore User**.

The API backend is the one that must have it. Grant both; it costs nothing.

## Step 6 — Custom domain

Firebase console → **App Hosting** → the **web** backend → **Settings** → *Add custom
domain*. Console only; there is no CLI for this.

It will ask for some of:

| Record | Purpose |
|---|---|
| `A` | points the domain at App Hosting |
| `AAAA` | **remove** any existing ones for that name |
| `CNAME` on `_acme-challenge.…` | proves ownership so the SSL certificate can be issued |
| `TXT` `fah-claim=…` | ownership metadata, sometimes requested |

Add them at your registrar, then wait. **DNS propagation takes up to 24 hours**, and the
SSL certificate up to a few hours after that. Start this days before you need it, not the
night before.

Apex (`example.com`) and subdomain (`www.example.com`) both work.

## Steps 7 & 8 — Verify

```bash
./deploy/verify.sh https://your-domain-or-backend-url
```

Nine checks that need no login: the site serves, the proxy reaches the API, auth is
enforced, POSTs work (not just GETs), the stream is wired, and no private field leaks.

Then the part no script can do — **sign in and use it**:

- register for an event, all the way through payment
- check someone in by scanning their QR
- open `/admin/attendance` on one device, check someone in on another, and watch the row
  move without a refresh
- leave that tab open **more than six minutes** and check someone in again. The live
  stream is cut about every five minutes by Cloud Run's request timeout, which
  `apphosting.yaml` cannot raise; the client reconnects by itself, and this confirms it.

---

## Before real money

`backend/apphosting.yaml` carries the Razorpay **test** key as a plain value:

```yaml
- variable: PAYMENT_KEY_ID
  value: "rzp_test_TUmxr2bTulNHjs"
```

Swap it for the live key, and update the `PAYMENT_KEY_SECRET` secret to match, before
taking real payments.

## One-off, after the first deploy

```bash
node backend/scripts/judges-to-volunteers.js          # dry run — read the output
node backend/scripts/judges-to-volunteers.js --yes    # apply
```

The judge role was folded into volunteer. Until this runs, any account still holding
`role: "judge"` resolves as **participant** (`backend/auth/roles.js` fails closed on an
unknown role), so they lose access until converted.

---

## When something is wrong

| Symptom | Cause |
|---|---|
| `403 Missing or insufficient permissions` on every Firestore call, but sign-in works | Step 5. This is almost always it. |
| `/api/health` fails, site otherwise loads | `API_ORIGIN` wrong or unset — re-run step 3 |
| Every write 502s, reads are fine | The proxy isn't forwarding request bodies — `verify.sh` catches this |
| Sign-in works but nothing live-updates | No `__session` cookie. `EventSource` can't send an auth header, so the stream needs the cookie; check DevTools → Application → Cookies |
| Rollout fails on a missing secret | A name in an `apphosting.yaml` with no secret in Secret Manager — re-run step 1 |
| Domain not resolving after an hour | Normal. Up to 24h. |
| Build fails on `next` version | App Hosting supports Next 15.0–15.2; `web/package.json` pins 15.2.x deliberately |
