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

## Setup on macOS Catalina (10.15), step by step

You will run **two programs in two separate Terminal windows**:

| Window | Runs | Stays open? |
|---|---|---|
| Terminal 1 | the **Neo4j database** server | yes, while you use the app |
| Terminal 2 | the **WorkSphere app** (Node.js) | yes, while you use the app |

Docker Desktop is **not** needed (current Docker Desktop releases don't support
Catalina). Every command below is typed into the macOS **Terminal** app
(Applications → Utilities → Terminal). Catalina's default shell is `zsh`.

### What you must do by hand (one-time)

1. Install **Node.js 20** (step 1).
2. Install **Java 17** (step 2).
3. Download **Neo4j Community 5.26** (step 3).
4. **Choose a database password** and use the *same* password in Neo4j (step 3)
   and in the app's `.env` file (step 5). Neo4j has no WorkSphere database to
   create by hand: Community Edition comes with one database named `neo4j`, and
   `npm run seed` fills it.

### Step 1: Install Node.js 20 (not 22 or newer)

Why 20: Node.js 22 and newer require macOS 11 or later (Node's own platform list;
Node 20 supports macOS 10.15). This project needs Node ≥ 20.10 because its test
scripts use `node --test --test-concurrency`.

1. Download **`node-v20.20.2.pkg`** (the newest Node 20) from
   <https://nodejs.org/dist/v20.20.2/node-v20.20.2.pkg>.
2. Double-click it and follow the installer.
3. Check it in Terminal:

```bash
node -v     # must print v20.20.2 (any v20.10 or newer works)
npm -v
```

Node 20 stopped receiving security updates in April 2026. It is still the newest
Node line that officially supports Catalina, and this project is tested on it.

### Step 2: Install Java 17

Neo4j 5.26 is a Java program and needs Java 17 or 21.

1. Download the **Eclipse Temurin 17 (LTS)** macOS **x64 `.pkg` JDK** installer from
   <https://adoptium.net/temurin/releases/?os=mac&arch=x64&package=jdk&version=17>.
2. Run the installer.
3. Check it:

```bash
/usr/libexec/java_home -v 17      # prints a path such as /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
```

If the Temurin installer refuses to run on 10.15, use another Java 17 build that
lists macOS 10.15 support, such as Azul Zulu 17 from <https://www.azul.com/downloads/>.

### Step 3: Download Neo4j, set its password, start it (Terminal 1)

1. Download **Neo4j Community Edition 5.26.x for Linux/Mac** (`.tar.gz`) from the
   Neo4j Deployment Center, <https://neo4j.com/deployment-center/>: choose
   *Graph Database Self-Managed → Community → 5.26.x (LTS) → Linux / Mac Executable*.
2. Safari usually saves it in `~/Downloads`. If Safari already unpacked it into a
   folder, skip the `tar` line below.
3. Choose your database password now (at least 8 characters, e.g. `worksphere2026`).
   Then run:

```bash
# Terminal 1
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
cd ~/Downloads
tar -xzf neo4j-community-5.26.*-unix.tar.gz          # skip if already unpacked
cd neo4j-community-5.26.*/
xattr -dr com.apple.quarantine .                      # avoids macOS "cannot be opened" blocks
bin/neo4j-admin dbms set-initial-password 'worksphere2026'   # ONLY before the first start
bin/neo4j console
```

Wait until the window prints **`Started.`** and leave it open. Stop Neo4j later with
**Ctrl + C**.

* A warning about the *maximum number of open files* is harmless for this small database.
* `set-initial-password` only works **before the very first start**. Run after that, it
  still prints "Changed password" but has no effect. To reset a forgotten password:
  1. Stop Neo4j (Ctrl + C).
  2. Delete the whole `data` folder inside the Neo4j folder (`rm -rf data`). This
     also deletes the WorkSphere data.
  3. Run `bin/neo4j-admin dbms set-initial-password '<new password>'`.
  4. Start Neo4j again (`bin/neo4j console`).
  5. Put the same password in `.env` and run `npm run seed` again.
* Next time, Terminal 1 only needs:
  `export JAVA_HOME=$(/usr/libexec/java_home -v 17) && cd ~/Downloads/neo4j-community-5.26.*/ && bin/neo4j console`
* Optional check: open <http://localhost:7474> (Neo4j Browser) and log in as user
  `neo4j` with your password.

### Step 4: Get the project and install its packages (Terminal 2)

The first time you run `git` on Catalina, macOS may offer to install the **Command
Line Developer Tools**. Click *Install*, wait, then run the command again.

```bash
# Terminal 2
cd ~/Desktop
git clone -b claude/sharp-darwin-85xb0j https://github.com/shivangixvashisht/Worksphere-Neo4j-DA-3.git
cd Worksphere-Neo4j-DA-3
npm ci                     # installs the exact package versions from package-lock.json
```

### Step 5: Configure the environment (`.env`)

```bash
cp .env.example .env
open -e .env               # opens it in TextEdit (or: nano .env)
```

Change this line to the password you chose in step 3, then save:

```
NEO4J_PASSWORD=worksphere2026
```

Leave the other lines as they are for a local Neo4j:

| Variable | Value for a local Neo4j | Meaning |
|---|---|---|
| `NEO4J_URI` | `bolt://localhost:7687` | where Neo4j listens |
| `NEO4J_USER` | `neo4j` | default admin user |
| `NEO4J_PASSWORD` | your password | must match step 3 |
| `NEO4J_DATABASE` | `neo4j` | Community's built-in database |
| `PORT` | `5000` | the app's web port |

`.env` is listed in `.gitignore`, so your password is never committed.

### Step 6: Check the connection, load the data, start the app (Terminal 2)

```bash
npm run db:check           # must print "Neo4j Kernel | 5.26.x | community"
npm run seed               # loads the WorkSphere data; ends with "Seed complete."
npm start                  # ends with "WorkSphere DA-3 (Neo4j edition) Server Running!"
```

### Step 7: Open it

Open **<http://localhost:5000>** in Safari or Chrome. The badge in the top bar must
show **Neo4j 5.26.x**. Stop the app with **Ctrl + C** in Terminal 2.

### If something goes wrong

| Message | Fix |
|---|---|
| `NEO4J_PASSWORD is not set` | You skipped step 5, or `.env` is not in the project folder |
| `Neo4j connection FAILED … ServiceUnavailable` | Neo4j isn't running: start it in Terminal 1 and wait for `Started.` |
| `… Unauthorized` / `authentication failure` | The password in `.env` differs from the one set in step 3 |
| `Unable to find any JVMs matching version "17"` | Java 17 isn't installed (step 2) |
| `EADDRINUSE … 5000` | Something else uses port 5000: set `PORT=5050` in `.env` and open <http://localhost:5050> |
| Page has no styling or icons | The page loads Tailwind CSS, icons and fonts from the internet: check your connection |

### Alternatives to the local Neo4j in step 3

**Neo4j Aura Free (cloud backup option):**
1. Sign in at <https://console.neo4j.io> and create a **Free** instance.
2. Download the credentials file (shown once).
3. In `.env`, set `NEO4J_URI=neo4j+s://<id>.databases.neo4j.io` and set
   `NEO4J_USER` / `NEO4J_PASSWORD` (and `NEO4J_DATABASE`, if listed) to the values
   from that file.
4. Skip steps 2 and 3, and continue with step 6.

**Docker Compose** (only on a machine where Docker already works, not Catalina):
`docker compose up -d` uses `NEO4J_PASSWORD` from `.env`. Then continue with step 6.

### All npm commands

| Command | What it does |
|---|---|
| `npm run db:check` | Connects and prints `dbms.components()` (name, version, edition) and the node count |
| `npm run seed` | Deletes all data, then runs `neo4j/01`, `02`, `05` (safe to repeat) |
| `npm run db:reset` | Deletes all data (constraints kept) |
| `npm start` / `npm run dev` | Starts the server (dev mode restarts on file changes) |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | Integration tests against a real Neo4j. **They wipe the database.** Run as `WORKSPHERE_ALLOW_DB_RESET=true npm run test:integration`, then `npm run seed` again |
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

Every run below used a **real Neo4j 5.26.32 Community server**. Nothing was mocked.

| Test | Where / how | Status |
|---|---|---|
| `npm test`: 17 unit tests (console guard: 15 allowed + 35 blocked queries, lexer, validation, graph shaping, demo params, generated-file drift) | Sandbox (Node 22 and Node **20.20.2**), GitHub Actions (Node 20 and 22) | **Executed, all pass** |
| `npm run test:integration`: 39 integration tests (seed fidelity vs `seed_oracle.sql`, CRUD + cascades + sequences + constraints, overlap rule incl. 8 concurrent bookings, atomic rollback, console security layers 1–4 incl. timeout, all 22 demos with expected results) | Sandbox (Neo4j in Docker on Java 21, **and** the same Neo4j distribution started with `bin/neo4j console` on **Java 17**), GitHub Actions (Node 20 and 22) | **Executed, all pass** |
| Full beginner flow on Node 20.20.2 + Java 17 Neo4j: fresh copy without `node_modules`/`.env` → `npm ci` → `cp .env.example .env` → `db:check` → `seed` → `npm start` / `npm run dev` → page and `/api/health` | Sandbox (Linux) | **Executed, works** |
| `set-initial-password` before the first start; password reset by deleting `data` | Sandbox, Java 17 | **Executed, works** (deleting only `data/dbms` does **not** reset it) |
| All 22 statements in `neo4j/03_demo_queries.cypher` with their `:param` values | Sandbox | **Executed, all pass** |
| `tests/ui/smoke.js` in headless Chromium (booking through checkout, member modal, HTML escaping, presets, graph view, blocked write) | Sandbox, Node 22 and Node 20.20.2 | **Executed, all pass**. External CDNs were blocked in the sandbox; the layout was checked separately with locally built Tailwind CSS |
| `npm audit` | Sandbox | **0 vulnerabilities** (after patch-level updates of Express 4.22.3 and vis-network 9.1.13) |
| The steps **on a real Mac with macOS Catalina** | – | **Not executed** (no Mac available). Node 20's macOS 10.15 support is from Node's official platform list; the Temurin 17 / Neo4j tarball steps are the vendors' documented ones |
| **Neo4j Aura Free** | – | **Not executed**; only the `.env` values change (`neo4j+s://…`) |

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
