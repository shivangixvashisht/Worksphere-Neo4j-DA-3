# WorkSphere DA-3: Neo4j Graph Database Extension

**Digital Assignment 3:** *"Extend the same mini-project by implementing it using one
modern database technology (other than MongoDB)."*

This repository extends the team's DA-II project **WorkSphere**, a meeting-room and
coworking-space management platform built on Oracle 21c XE, PL/SQL, Node.js/Express,
Java JDBC and a vanilla JS + Tailwind frontend
([original repository](https://github.com/mantavya1910-byte/WorkSphere), not modified),
with **Neo4j**, a native graph database.

It is the same use case, entities, sample data and UI: spaces, rooms, facilities,
members, employees, plans, organizations, bookings and payments. They're stored as
a graph of nodes and relationships and queried with real Cypher through the
official Neo4j driver. Nothing is mocked: the server refuses to start without a
reachable Neo4j database.

Original DA-II team: Mantavya Sharma (25BCE5583), Purva Golande (25BCE5535), Shivangi Vashisht (25BCE5577).

---

## What DA-3 adds

| Area | Original (DA-II, Oracle) | DA-3 (this repository, Neo4j) |
|---|---|---|
| Storage | 10 relational tables, FKs, sequences, views | Labelled nodes + typed relationships, uniqueness constraints, `:Sequence` counters (see [`neo4j/README.md`](neo4j/README.md)) |
| Connectivity | Java JDBC Thin driver (`ojdbc11.jar`) / SQL\*Plus | Official `neo4j-driver` over Bolt (`backend/db/neo4j.js`) |
| Queries | SQL with string concatenation | Parameterised Cypher everywhere (`$param`) |
| Double-booking trigger | PL/SQL `TRG_CHECK_ROOM_OVERLAP` | Same overlap rule inside the booking write transaction, plus a room write-lock against concurrent requests |
| Booking + payment procedure | `SP_CREATE_BOOKING_AND_PAY` | One atomic Neo4j transaction |
| "Type query & fetch it" | Arbitrary SQL (any statement) | **Read-only** Cypher console with four security layers |
| New graph features | – | Chain of command at any depth, organization footprint, member network, shortest path, free-room recommendation, facility-category similarity, interactive graph visualisation |
| DA-3 enhancement | – | `:FacilityCategory` nodes grouping the original facility rows (clearly marked as not original data) |

The REST API keeps the **original paths and JSON shape** (`/api/rooms`,
`/api/bookings`, …, UPPERCASE column keys), so the original frontend was ported with
small, reviewable changes (see the commit *"Phase 4a"* for the unchanged copy and
*"Phase 4b"* for the adaptation).

---

## Project structure

```
neo4j/                     Cypher schema, seed, demo queries, reset, DA-3 categories + README
backend/
  server.js                Express app (same routes as the original + /api/demos, /api/graph)
  db/neo4j.js              Neo4j driver, read/write/transaction helpers
  validation.js            Oracle CHECK / NOT NULL / length rules reproduced
  routes/                  spaces, rooms, members, employees, bookings, payments, stats, query, demos, graph
  services/                booking rules, read-only console guard, Cypher lexer, demo registry
  scripts/                 seed.js, check-connection.js, generate-demo-queries.js
frontend/                  ported WorkSphere UI (index.html, js/app.js, css/style.css)
tests/unit/                no database needed
tests/integration/         run against a REAL Neo4j server (they wipe and re-seed it)
tests/ui/smoke.js          optional browser smoke test (Playwright)
docker-compose.yml         Neo4j 5.26 Community
.env.example               configuration template (copy to .env; .env is git-ignored)
```

---

## Setup on macOS Catalina (10.15)

You need **Node.js** and **a Neo4j 5 database**. Pick one of the database options below.

### Step 0: Node.js

Node 22+ needs macOS 11 or later, so on Catalina install **Node.js 20 LTS** (macOS
installer from <https://nodejs.org/en/download>, "previous releases"). Note that
Node 20 is past its end-of-life date, but it's the newest line that supports
Catalina. CI tests this project on Node 20 and 22.

```bash
node -v      # v20.x
cd ~/Desktop
git clone https://github.com/shivangixvashisht/Worksphere-Neo4j-DA-3.git
cd Worksphere-Neo4j-DA-3
npm install
cp .env.example .env
open -e .env          # set NEO4J_PASSWORD (at least 8 characters)
```

### Option A (recommended on Catalina): Neo4j Community 5.26 tarball + Java 17

Current Docker Desktop releases no longer support Catalina, so running Neo4j directly
is the most reliable local option. Neo4j 5.26 (LTS) runs on Java 17 or 21.

1. Install **Java 17**: the Eclipse Temurin 17 `.pkg` from <https://adoptium.net>.
   Check with `/usr/libexec/java_home -V`.
2. Download **Neo4j Community Edition 5.26.x** for macOS/Linux (`.tar.gz`) from the
   Neo4j Deployment Center: <https://neo4j.com/deployment-center/>.
3. In Terminal:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
cd ~/Downloads
tar -xzf neo4j-community-5.26.*-unix.tar.gz
cd neo4j-community-5.26.*
bin/neo4j-admin dbms set-initial-password 'the-same-password-as-in-.env'
bin/neo4j console            # keep this window open; Ctrl+C stops Neo4j
```

If macOS blocks the downloaded files ("cannot be opened"), run
`xattr -dr com.apple.quarantine ~/Downloads/neo4j-community-5.26.*` and try again.
Neo4j Browser is then at <http://localhost:7474>.

### Option B: Docker Compose (if you already have a working Docker install)

```bash
docker compose up -d          # uses NEO4J_PASSWORD from .env on first start
docker compose ps             # wait until "healthy"
```

### Option C (backup): Neo4j Aura Free (cloud, nothing to install)

1. Sign in at <https://console.neo4j.io> and create a **Free** instance.
2. Download the credentials file shown once at creation.
3. In `.env` set `NEO4J_URI=neo4j+s://<instance-id>.databases.neo4j.io`, and set
   `NEO4J_USER` / `NEO4J_PASSWORD` (and `NEO4J_DATABASE` if listed) to the values in
   that file.

### Run WorkSphere

```bash
npm run db:check     # prints the live Neo4j version, proving the connection
npm run seed         # loads constraints + the original WorkSphere data + DA-3 categories
npm start            # http://localhost:5000
```

| Command | What it does |
|---|---|
| `npm run db:check` | Connects and prints `dbms.components()` (name, version, edition) and the node count |
| `npm run seed` | Resets, then runs `neo4j/01`, `02`, `05` |
| `npm run db:reset` | Deletes all data (constraints kept) |
| `npm start` / `npm run dev` | Starts the server (dev mode restarts on file changes) |
| `npm test` | Unit tests (no database) |
| `npm run test:integration` | Integration tests against a real Neo4j. **They wipe the database.** Set `WORKSPHERE_ALLOW_DB_RESET=true` or point `NEO4J_TEST_URI` at a throwaway instance |
| `npm run docs:queries` | Regenerates `neo4j/03_demo_queries.cypher` from the app's presets |

---

## Using the application

* **Home / Services / Portfolio / Team / Pricing:** the original screens (dashboard,
  catalog with floor map, hourly slot grid, checkout with promo codes and GST, CRUD for
  rooms and members, employees and hierarchy, invoices), now reading and writing Neo4j.
  The navbar badge shows the live Neo4j version.
* **Portfolio → "Find free rooms":** a graph query that combines the overlap rule,
  capacity and an optional DA-3 facility category.
* **Graph / Cypher:**
  * **Presets**: each one shows the original SQL (or a clearly labelled comparison SQL)
    next to the Cypher that runs, with parameter inputs.
  * **Read-only console**: type your own Cypher.
  * **Results**: shown as a table, an interactive graph, or the exact Cypher executed.
  * **Show whole graph**: draws the entire dataset.

### Console security (read-only)

Neo4j Community has no role-based access control, so a read-only database role
isn't available (that needs Enterprise or AuraDB Professional). Instead, every console
query must pass all four layers:

1. **Allowlist** (`backend/services/cypherGuard.js`), working on lexer tokens so that
   strings, comments and backtick names can't hide keywords:
   * single statement only;
   * must start with `MATCH`/`OPTIONAL MATCH`/`WITH`/`UNWIND`/`RETURN`/`CALL`;
   * any write, admin or schema keyword is rejected (`CREATE`, `MERGE`, `SET`,
     `DELETE`, `DETACH`, `REMOVE`, `FOREACH`, `LOAD CSV`, `IN TRANSACTIONS`, `SHOW`,
     `USE`, …);
   * `CALL` only for read subqueries or 7 allowlisted read-only procedures;
   * no APOC/GDS.
2. **EXPLAIN check:** Neo4j must classify the query as read-only (`queryType = 'r'`).
3. **READ transaction:** the query runs with session access mode READ + `executeRead`.
   Neo4j itself rejects writes (`Neo.ClientError.Statement.AccessMode`). The tests
   prove this layer alone blocks writes.
4. **Limits:** a 5 s transaction timeout enforced by the server (HTTP 408) and a
   500-row cap.

Application queries never use string concatenation: all values are `$parameters`.

---

## Testing: what was actually executed

All runs below were made in the development sandbox against a **real Neo4j 5.26.32
Community server** (Docker image `neo4j:5.26-community`), using Node 22.

| Test | Status |
|---|---|
| `npm test`: 17 unit tests (console guard: 15 allowed + 35 blocked queries, lexer, validation, graph shaping, demo params, generated-file drift) | **Executed, all pass** |
| `npm run test:integration`: 39 integration tests on the real server (seed fidelity vs `seed_oracle.sql`, CRUD + cascades + sequences + constraints, overlap rule incl. 8 concurrent bookings, atomic rollback, console security layers 1–4 incl. timeout, all 22 demos with expected results) | **Executed, all pass** |
| All 22 statements in `neo4j/03_demo_queries.cypher` run with their documented `:param` values | **Executed, all pass** |
| `tests/ui/smoke.js` in headless Chromium against the running server (booking through checkout, member modal, HTML escaping, presets, graph view, blocked write) | **Executed, all pass**. External CDNs (Tailwind, Font Awesome, fonts, images) were blocked in the sandbox; the layout was checked separately with locally built Tailwind CSS |
| GitHub Actions CI (`.github/workflows/ci.yml`, Node 20 + 22, Neo4j service container) | Runs on push; check the repository's Actions tab |
| Setup on **macOS Catalina** (tarball + Java 17, Node 20) | **Not executed** (no macOS available); instructions follow the vendors' documented steps |
| **Neo4j Aura Free** | **Not executed**; only the connection URI changes (`neo4j+s://`) |

---

## Differences from the original behaviour (deliberate)

* **Stricter validation.**
  * `start_time` / `end_time` must be `HH:MM` and end after start (the overlap rule
    compares them as strings, exactly like the trigger).
  * Dates must be real `YYYY-MM-DD` dates.
  * Emails must look like emails.
* **Atomic booking + payment.** The original route inserted the booking and the
  payment in two separate calls. Here both happen in one transaction, and a booking
  with a payment method but amount 0 is rejected up front (the original
  `chk_payment_amount` would have failed only after the booking was saved).
* **Member update keeps the current status** when the form doesn't send one (the
  original reset it to `ACTIVE`).
* **Frontend fixes:**
  * database values are HTML-escaped;
  * local dates are used instead of UTC dates;
  * the "New Reservation / Contact" buttons call an `openNewBookingModal()` that
    was missing in the original `app.js` (it now opens the slot picker).
* **Not carried over:**
  * The Java JDBC layer and SQL\*Plus bridge (Oracle-specific; replaced by the Neo4j driver).
  * The 1NF/2NF normalization demo tables (a relational-design topic with separate
    sample data).
  * Arbitrary write access from the console (now read-only by design).
  * The unused 8 MB `frontend/assets/images` folder.
* **Kept as in the original:**
  * Checkout books as the first listed member.
  * Promo codes and GST are calculated in the browser.
  * The amenity filter matches facility names by keyword.
