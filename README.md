# JeevanSetu

A web app that turns a citizen's emergency report into a hospital handover. The citizen reports what happened, the server sets a preliminary priority with readable rules, ranks nearby hospitals that offer the right services, and asks the best one. If that hospital declines or does not reply in time, the request moves to the next one automatically. Everyone sees the same timeline.

It implements the paper *JeevanSetu: A Machine-Learning-Assisted Emergency Response Framework* (Verma, Pandey, Paliwal, Tomar, Bhardwaj).

> **This is a prototype.** Hospitals, bed counts and staff are simulated and labelled as such. The priority rules are not a validated clinical triage tool. In a real emergency, call 112.

## Feature list status

All **[MVP]** items are built and tested. **[V2]** items marked "Done" are built and tested; the others are the next batch. **[FUTURE]** items have data hooks (empty tables in the store) and a clearly labelled "Coming soon" page (`/coming-soon`). No ML or unvalidated feature changes priority or routing.

These features run in the portable Node server (`server/`), which is the default. The Python backend keeps the paper's core features only.

| # | Feature | Tag | Status |
| --- | --- | --- | --- |
| 1–10 | SOS home, 3-step report, OTP, draft, idempotency, live timeline, "Why this hospital?" (with data freshness), red-flag and no-hospital states, photo quality gate, Hindi/English, practice drill, first aid | MVP | Done |
| 11 | Share live status with family (view-only link, expires after 24 h or 2 h after closing) | MVP | Done |
| 12 | Voice input for the report | V2 | Not yet |
| 13 | Offline-first PWA with queued report | V2 | Not yet |
| 14 | SMS SOS fallback | V2 | Not yet |
| 15 | Emergency Passport (shared only with consent) | V2 | Done |
| 16 | Patient-side access log | V2 | Done |
| 17 | Elder / icon-based / high-contrast modes | V2 | Not yet (WCAG AA basics are in place) |
| 18 | Good Samaritan mode | V2 | Not yet |
| 19 | Multi-patient report | V2 | Not yet |
| 20 | Outcome feedback | V2 | Done |
| 21–23 | Crash detection, CPR volunteers, blood network | FUTURE | Placeholder + data hooks |
| 24–26 | Staff queue with alerts, case drawer with map and Grad-CAM, one-tap resources and diversion | MVP | Done |
| 27 | Pre-arrival QR packet that opens the case when scanned (`/staff/cases/:id`) | MVP | Done |
| 28 | "Patient arrived" confirmation (new final status `PATIENT_ARRIVED`) | MVP | Done |
| 29–33 | Capability truth panel, referral, voice note, shift notes, payment filter | V2 | Not yet |
| 34–35 | Driver mini-app, live ambulance location | V2 | Not yet |
| 36 | Green corridor | FUTURE | Placeholder + data hook |
| 37 | Overview metrics with accept rate and reply time per hospital | MVP | Done |
| 38–39 | Hospital and staff management, audit log, CSV export; reliability score | MVP | Done |
| 40 | Ranking what-if sandbox | V2 | Done |
| 41 | Refusal analytics (by reason, hospital and area) | V2 | Done |
| 42 | Public accountability scorecard (`/scorecard`) | V2 | Done |
| 43 | Fairness monitor (by area and time of day) | V2 | Done |
| 44 | Surge / disaster mode | V2 | Not yet |
| 45 | Post-incident report per case (print or save as PDF) | V2 | Done |
| 46–47 | Bed predictor, black-spot heatmap | FUTURE | Placeholder |
| 48 | Data freshness confidence (age and decay on every figure; stale gets zero) | MVP | Done |
| 49 | Prank shield: OTP, report rate limit, admin-only trust score; red-flag 112 screen never blocked | MVP | Done |
| 50–52 | Role and ownership checks, 404 across hospitals, image audit, metadata stripping, labels for simulated and ML items | MVP | Done |
| 53 | Sensitive case mode (minimum-detail alerts) | V2 | Done |
| 54 | Data retention controls and consent withdrawal | V2 | Not yet |
| 55 | Quality gate, MobileNetV2 behind a replaceable interface, abstention, Grad-CAM | MVP | Done |
| 56–57 | OOD detection, acute-injury classifier | FUTURE | Placeholder |
| 58 | Alerts through pluggable providers (SMS, WhatsApp, push, in-app; mock outbox in admin) | MVP | Done |
| 59 | Real-time updates with Server-Sent Events (polling kept as fallback) | MVP | Done |
| 60 | Seed data, demo users, README | MVP | Done |
| 61 | Road-network ETA (OSRM) | V2 | Not yet |

## Quick start (Windows, Mac or Linux)

You only need **Node.js 20 LTS or newer** (nodejs.org). Python is not required to run the app.

Open the `jeevansetu` folder in VS Code, open a terminal (Ctrl + `) and run:

```bash
npm install
npm run dev
```

Open **http://localhost:5173/demo** and click a role to sign in with a demo account. Keep the terminal open; Ctrl + C stops everything.

For a presentation, build once and serve everything from one address:

```bash
npm start
```

Then open **http://localhost:8000/demo**. Other commands:

| Command | What it does |
| --- | --- |
| `npm run reset` | Deletes all saved data. The demo hospitals and accounts come back on the next start. |
| `npm test` | 14 tests: priority rules, Table VIII ranking, Algorithm 1, the ONNX analyzer, and API integration tests for the newer features |
| `npm run e2e` | 9 browser tests of the whole app (run `npx playwright install chromium` in `frontend` once first) |

### Why there are two servers

| Folder | Server | When to use it |
| --- | --- | --- |
| `server/` | **Portable Node.js server.** Pure JavaScript with no compiled add-ons, saving data to a JSON file in `server/data/`. | Default. It runs on locked-down Windows laptops where Smart App Control blocks compiled Python packages. |
| `backend/` | **FastAPI reference backend** described in the paper: SQLAlchemy, Alembic migrations, Argon2id, 78 pytest tests and the MobileNetV2 analyzer. | When Python with compiled packages is allowed (Linux, Mac, GitHub Codespaces, or Windows with Smart App Control off). |

Both expose the same `/api`, so the frontend works with either. The portable server uses Node's built-in scrypt for passwords and has no wound model, so photos are checked and stored but marked "Not analysed".

### What is in the box

| Part | Stack |
| --- | --- |
| `frontend/` | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Leaflet with OpenStreetMap, react-i18next (English and Hindi), Lucide icons, Vitest, Playwright |
| `server/` | Node.js (built-in `http` and `crypto`), jpeg-js and pngjs for the photo quality gate |
| `backend/` | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, Argon2id, SQLite (PostgreSQL-ready), pytest |
| `backend/ml/` | Training script for the MobileNetV2 wound analyzer (PyTorch, timm) |

## Running the Python backend instead (optional)

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # Mac/Linux: source .venv/bin/activate
python -m pip install -e ".[dev]"
copy .env.example .env               # Mac/Linux: cp
python -m alembic upgrade head
python -m app.seed
python -m pytest
python -m uvicorn app.main:app --reload --port 8000
```

Then, in a second terminal: `cd frontend` and `npm run dev`. If Windows reports *"An Application Control policy has blocked this file"*, Smart App Control is on. Use the portable server, GitHub Codespaces, or turn Smart App Control off.

### Demo accounts

| Role | Sign in at | Credentials |
| --- | --- | --- |
| Citizen | `/login` | Mobile `98110 24521`. In dev the 6-digit code is shown on screen; no SMS is sent. Any valid Indian mobile number also works and creates a new citizen. |
| Hospital staff | `/staff/login` | `staff.h3@jeevansetu.demo` / `Demo@2026!` (Pari Chowk Trauma Centre). `staff.h1` to `staff.h5` cover the other four hospitals. |
| Admin | `/staff/login` | `admin@jeevansetu.demo` / `Admin@2026!` |

The `/demo` page signs in to any of these with one click.

### Seeded hospitals (all simulated)

They sit at the distances used in Table VIII of the paper, measured from the demo patient location near Alpha-1, Greater Noida. A road-accident report from there reproduces the paper's worked example.

| Key | Hospital | Distance | Services | Free beds |
| --- | --- | --- | --- | --- |
| H1 | Sector Beta-2 City Hospital | 2.00 km | Emergency, orthopaedics, cardiac | 4 |
| H2 | Alpha Care Hospital | 4.98 km | Emergency, trauma | 1 |
| H3 | Pari Chowk Trauma Centre | 8.01 km | Emergency, trauma, orthopaedics | 6 |
| H4 | Knowledge Park Medical Centre | 11.93 km | Emergency, trauma, burn | not reported |
| H5 | Dadri Road Hospital | 30.02 km | Emergency, trauma, burn, cardiac | 8 |

### A two-minute demo

1. Open `/demo` and choose **Citizen**. Tap **Report an emergency**, choose **Road accident**, answer the questions, use your location (or tap the map near Greater Noida), tick consent and send.
2. In a private window, open `/demo` and choose **Hospital staff**. The request is at the top of the table. Open it, press **D**, choose a reason and decline.
3. Back on the citizen screen, the request has moved to Alpha Care Hospital, with a notice saying why.
4. Choose **Administrator** on `/demo` to see the metrics, filters, CSV export and audit log.

## Tests

```bash
npm test                             # Node: priority rules, Table VIII example, Algorithm 1
cd backend && python -m pytest       # 78 tests: rules, ranking, Algorithm 1, auth, images, admin, migrations
cd frontend && npm test              # Vitest: formatting, and English/Hindi key and placeholder parity
cd frontend && npx playwright install chromium && npm run e2e
```

`npm run e2e` starts the whole stack itself: the portable server with fresh demo data on port 8000, and a production build on port 4173. It runs 7 browser tests:

- citizen report to trauma centre, including the "Why this hospital?" terms;
- red-flag takeover and undo;
- practice drill;
- Hindi switch;
- staff decline and reassignment;
- cross-hospital 404;
- admin CSV export.

Stop anything already on ports 8000 and 4173 first.

### Where each required test lives

| Requirement | Test (Python reference backend; the Node server repeats the core ones in `server/test/`) |
| --- | --- |
| Every priority rule, age boundaries, unknown never read as no | `backend/tests/test_priority.py` |
| Haversine, filtering, scoring, Table VIII example, stale availability | `backend/tests/test_ranking.py` |
| Consent required, double-submit idempotency | `backend/tests/test_emergencies.py` |
| Reject to next hospital, timeout to next hospital, no candidates left, simultaneous accepts (one 409), cross-hospital 404 with audit | `backend/tests/test_allocation_flow.py` |
| Corrupt image, blurred image, low-confidence image (UNCERTAIN), metadata stripped, model never changes priority or routing | `backend/tests/test_images.py` |
| Session token stored only as a hash, logout revokes, role guards | `backend/tests/test_auth.py` |

## Screens

**Citizen.** Mobile-first at 360 px, centred at 480 px on larger screens. A Call 112 button is on every screen.

1. **Home.** The SOS button and Call 112 sit at the bottom, within thumb reach. Below them are "My requests" with live status and a first-aid link. The top bar has the language switch and the Practice toggle.
2. **Report, three steps.** Step 1 asks what happened, with optional patient details behind a toggle. Step 2 is the symptom questions, each with Yes / No / Unknown; Unknown is drawn in neutral grey and skipped questions are sent as Unknown. Step 3 is the location (GPS, map pin or typed coordinates, with the source stored) and the consent checkbox with its version. The draft saves on the phone as you go, and the same idempotency key is reused if sending is retried.
3. **Red-flag takeover.** Answering Yes to any danger sign fills the screen red with one large Call 112 button. Two smaller choices sit under it: send to a hospital anyway, or undo a mis-tap.
4. **Live status.**
   - A collapsible map sits at the top.
   - The current-hospital card stays pinned, with a countdown and "Why this hospital?". That panel shows each term of Eq. 8 with its weight, plus the reliability term and the services the injury needs.
   - A notice explains any reassignment, and the timeline below lists every event.
   - Cancel asks for confirmation first, and a photo can be added (optional).
   - Accepted, no-hospital and cancelled requests each have their own state.
5. **Photo upload.** Separate from the report, so it can never delay it. If the gate rejects a photo, the message says why: too dark, too bright, blurred, wrong type or too large.
6. **Phone sign-in** with a one-time code.
7. **First aid.** Static steps for each injury type, under a Call 112 banner. No model output is used.
8. **Hospitals near you.** A map and a list ordered by distance, each with its services, a call button and driving directions. The map also says clearly when street tiles cannot load without internet.
9. **Practice drill.** Runs the real rules and ranking through an endpoint that writes nothing, then shows a simulated hospital reply.

**Hospital staff.** Desktop-first and usable on a tablet.

9. **Incoming requests.**
   - A side menu sits next to the beds-and-services panel: one-tap bed count, service toggles and the Diversion switch.
   - The table has a sticky header, sorts red flags first, shows priority as an icon plus text, and has live waiting and reply-due timers.
   - Tabs list pending, accepted and declined requests.
   - A new red flag raises a banner and an optional two-tone sound.
10. **Case drawer.**
    - Priority reasons with the rule-set version.
    - The pre-arrival packet: age, sex, blood group, allergies, contact and location, with a QR code holding the same data.
    - A map of the patient's location against your hospital, with a directions link.
    - Photos with a Grad-CAM toggle and the "Preliminary, not a diagnosis" label.
    - Accept (**A**) or Decline (**D**). A decline needs a reason, and Esc closes the drawer.

**Admin.**

11. **Overview.** A wound-model card with its test accuracy, plus four metrics: requests by status, median hospital reply time, accept rate and no-hospital cases. Below them are tabs for Requests, Map (hospitals and requests still being placed), Hospitals, Staff and Audit log, each with filters and CSV export. Admins can add staff accounts, deactivate them, and switch hospitals open or on diversion.

Every screen has a loading skeleton shaped like its content, plus empty, error and offline states.

## How it maps to the paper

| Paper | Code |
| --- | --- |
| Table I priority rules, stored reasons, rule-set version | `backend/app/features/priority/engine.py` |
| Table II required services | `backend/app/features/allocation/capabilities.py` |
| Eq. 6–7 haversine distance | `backend/app/features/allocation/geo.py` |
| Eq. 8 eligibility filter and additive score (wd 0.7, wr 0.3, bcap 5, Dmax 25 km) | `backend/app/features/allocation/ranking.py` |
| Algorithm 1: REASSIGN, DECIDE, periodic timeout | `backend/app/features/allocation/service.py`, `worker.py` |
| Unique (request, hospital) key; at most one pending or accepted assignment per request | `backend/app/features/allocation/models.py`, migration `0001` |
| Eq. 1 blur check and exposure check | `backend/app/features/images/quality.py` |
| Eq. 2–5 classifier, abstention threshold τ, Grad-CAM | `backend/app/features/images/mobilenet.py`, `analyzer.py` |
| Fig. 2 status lifecycle | `backend/app/core/enums.py` |

**Additions beyond the paper:**
- A small **reliability term** (weight 0.05) built from each hospital's accept rate and median reply time. New hospitals start at a neutral 0.5, and the term is stored with every assignment.
- **Diversion**, which removes a hospital from ranking.
- The **practice drill** and the **pre-arrival QR code**.

## Security and privacy

- **Accounts and sessions.** Passwords are hashed with Argon2id. Sessions use a random token in an httpOnly, SameSite=Strict cookie, and only its SHA-256 hash is stored, so signing out takes effect immediately. Phone codes are HMAC-hashed, expire after 5 minutes, allow a limited number of attempts, and are rate-limited per number.
- **Access checks.** Role and ownership are checked on the server for every endpoint. A request from another hospital or another citizen returns 404, so its existence is not revealed.
- **Concurrency.** Decisions use conditional updates; a losing click or a racing timeout gets 409.
- **Images.** The file's real content is checked (not its name), size is capped at 5 MB, and the image is re-encoded, which drops EXIF and GPS data. Files are kept in a private folder and served only through an authorised route, and every view is audit-logged.
- **Logs and consent.** Audit logs hold identifiers only. Consent is stored with its text version and timestamp.

## The wound-photo model (train it on Kaggle)

**Dataset:** the public **AZH wound dataset** (UWM BigData Lab, AZH Wound and Vascular Center). It is on GitHub, not Kaggle: https://github.com/uwm-bigdata/Multi-modal-wound-classification-using-images-and-locations. The notebook uses the four wound classes (diabetic, pressure, surgical, venous) and the official split: 464 training, 82 validation and 184 test images. Background and normal-skin images are left out, as in the paper.

**Train it (about 10 minutes, free GPU, nothing to install on your laptop):**

1. Go to kaggle.com, then **Create → New Notebook → File → Import Notebook**, and upload `ml/JeevanSetu_Train_Wound_Model.ipynb`.
2. In the right panel set **Accelerator → GPU T4 x2** (or P100) and switch **Internet on**. Kaggle asks you to verify your phone number once.
3. Click **Run All**. The last cell prints the test accuracy, macro-F1, coverage and selective accuracy.
4. Download **`jeevansetu_model.zip`** from the Output panel.
5. Copy `wound_model.onnx` and `wound_model.json` from it into `server/models/`, then restart the app (`npm run dev` or `npm start`).

After that:
- The terminal says `Wound model: loaded`.
- The admin console shows the model's test results.
- Staff see a prediction (or "Uncertain") and can switch on the Grad-CAM view for each photo.

Google Colab works the same way (Runtime → Change runtime type → T4 GPU → Run all).

The model runs inside the portable server through ONNX Runtime Web (WebAssembly), so it needs no compiled files and works on locked-down Windows laptops. The zip also contains `mobilenetv2_azh.pt` for the Python backend (`backend/ml/weights/`).

**Our results (Kaggle, T4 GPU, seed 42).** MobileNetV2: 64.1% test accuracy, macro-F1 0.628; with abstention (tau 0.63) it answers 81.0% of test photos at 69.1% accuracy; 24.9 ms per photo on one CPU core. EfficientNet-B0: 67.4%, macro-F1 0.657, 50.4 ms. ResNet-50: 62.5%, macro-F1 0.592, 120.6 ms. The paper's earlier run of the same protocol gave MobileNetV2 71.7%; with only 464 training images, results move by several points between runs. The model's output is always preliminary and never changes priority or hospital choice.

## Switching to PostgreSQL

```bash
pip install -e ".[postgres]"
export JS_DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/jeevansetu
alembic upgrade head && python -m app.seed
```

The schema avoids SQLite-only features. The partial unique index is declared for both databases.

## Settings

All settings use the `JS_` prefix (see `backend/.env.example` and `backend/app/core/config.py`). The ones you are most likely to change:

| Setting | Default | Meaning |
| --- | --- | --- |
| `JS_DATABASE_URL` | `sqlite:///./jeevansetu.db` | Database |
| `JS_REPLY_TIMEOUT_SECONDS` | `120` | How long a hospital has to reply |
| `JS_EXPOSE_DEV_OTP` | `true` | Return the sign-in code in the API response. **Set to false outside development.** |
| `JS_COOKIE_SECURE` | `false` | **Set to true behind HTTPS.** |
| `JS_OTP_PEPPER` | dev value | **Change before any real use.** |
| `JS_RUN_TIMEOUT_CHECKER` | `true` | Background timeout loop. It assumes a single API process. |
| `JS_IMAGE_STORE_DIR` | `./private_images` | Private photo store |

## Known limitations

These are the same limitations the paper lists:

- **The wound model does not match the use.** It is trained on chronic ulcers, not acute injuries.
- **Nothing is validated or real.** The priority rules are unvalidated, and hospitals and beds are simulated.
- **Distance is a straight line**, so roads and traffic are ignored.
- **Updates are not pushed.** The client polls every 5 seconds, and the timeout checker assumes one server process.
- **There is no link to ERSS 112** and no ambulance dispatch.
- **No real SMS is sent.** The one-time code is shown on screen in development.

## Folder layout

```
package.json             npm install / npm run dev / npm start for the whole project
scripts/                 dev launcher and data reset
server/                  portable Node.js server
  lib/                   priority rules, ranking, Algorithm 1, images, security, JSON store, seed
  routes/                auth, citizen, staff, admin
  models/                put wound_model.onnx and wound_model.json here
  test/                  node:test unit tests (fixtures/ holds a tiny random-weight model for tests only)
ml/
  JeevanSetu_Train_Wound_Model.ipynb   Kaggle / Colab notebook: AZH dataset, MobileNetV2, accuracy, export
backend/
  app/core/              settings, database, types, errors, security
  app/features/
    auth/                phone OTP, staff and admin password login, sessions
    priority/            Table I engine
    allocation/          geo, capabilities, ranking, reliability, Algorithm 1, timeout worker
    emergencies/         citizen requests, consent, events
    staff/               hospital queue, case detail, decisions, resources
    images/              quality gate, private store, analyzer interface, MobileNetV2 + Grad-CAM
    drill/               practice preview (writes nothing)
    hospitals/           map pins
    admin/               metrics, tables, CSV, staff and hospital management
    audit/               audit log
  migrations/            Alembic
  ml/                    training script and weights folder
  tests/
frontend/
  src/components/        Button, Badge, Card, Input, SegmentedControl, Timeline, Table,
                         Drawer, Modal, Toast, Skeleton, Empty/Error states, OfflineBanner,
                         Switch, MapView, Call112Button, LanguageToggle
  src/features/          auth, citizen (home, report, status, first aid), drill, staff, admin
  src/lib/               API client and types, i18n (en, hi), hooks, formatting, config
  e2e/                   Playwright tests
  tailwind.config.ts     design tokens: closed palette, type scale, radii
```
