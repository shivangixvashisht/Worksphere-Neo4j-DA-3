# `neo4j/` — WorkSphere graph schema, seed data and demo queries

This folder holds the database side of the DA-3 extension. Every file is plain Cypher
that runs on **Neo4j 5.26 Community Edition** (verified) and can also be pasted into
Neo4j Browser.

| File | Purpose |
|---|---|
| `01_constraints.cypher` | Uniqueness constraints (Oracle PRIMARY KEY / UNIQUE) and lookup indexes. Idempotent. |
| `02_seed.cypher` | Graph version of the original `database/seed_oracle.sql`. Every value is copied from the original file. |
| `03_demo_queries.cypher` | 22 demonstration queries: the original DA-II SQL next to the Cypher that replaces it, plus graph traversals. Generated from `backend/services/demos.js` (`npm run docs:queries`), so it is exactly what the app runs. |
| `04_reset.cypher` | Deletes all nodes and relationships (constraints are kept). |
| `05_facility_categories.cypher` | **DA-3 enhancement** (not original data): `:FacilityCategory` nodes linked to the original facility rows. |

Run everything with `npm run seed`, which resets the data and then runs 01, 02 and 05.
The script passes `$today` so the dates match the original `SYSDATE` logic.
To use Neo4j Browser instead, first run `:param today => toString(date())`, then paste the files in order.

---

## 1. Oracle tables → graph model

The original schema is in `database/schema_oracle.sql` of the DA-II project
(10 tables, 10 sequences, 5 views). Table and column names are kept exactly; columns
become node properties with the same names. **Foreign-key columns are not stored as
properties.** Each one becomes a relationship.

| Oracle table (original) | Neo4j node | Properties (original column names) |
|---|---|---|
| `PERSON` | `:Person` | `person_id`, `first_name`, `middle_name`, `last_name`, `email`, `street`, `city`, `state`, `pin`, `phone`, `created_at` |
| `MEMBERS` (subclass of PERSON) | extra label `:Member` on the same `:Person` node | `member_id`, `join_date`, `status` |
| `EMPLOYEES` (subclass of PERSON) | extra label `:Employee` on the same `:Person` node | `employee_id`, `job_title`, `salary` |
| `MEMBERSHIP_PLANS` | `:MembershipPlan` | `plan_id`, `plan_name`, `monthly_fee`, `duration_months` |
| `COWORKING_SPACES` | `:CoworkingSpace` | `space_id`, `space_name`, `address`, `city`, `state`, `pin`, `created_at` |
| `MEETING_ROOMS` | `:MeetingRoom` | `room_id`, `room_name`, `room_type`, `capacity`, `hourly_rate`, `status` |
| `ROOM_FACILITIES` (weak entity) | `:Facility` (one node per original row) | `facility_id`, `facility_name`, `quantity` |
| `ORGANIZATIONS` | `:Organization` | `organization_id`, `organization_name`, `industry` |
| `BOOKINGS` | `:Booking` | `booking_id`, `booking_date`, `start_time`, `end_time`, `total_amount`, `status`, `created_at` |
| `PAYMENTS` | `:Payment` | `payment_id`, `amount`, `payment_date`, `method`, `status` |
| `SEQ_*` sequences | `:Sequence {name, next}` | same names and restart values as the original `ALTER SEQUENCE ... RESTART WITH` |

| Oracle foreign key (original) | Neo4j relationship |
|---|---|
| `MEMBERS.person_id → PERSON` / `EMPLOYEES.person_id → PERSON` | same node with two labels (EER disjoint specialization) |
| `MEMBERS.plan_id → MEMBERSHIP_PLANS` | `(:Member)-[:HAS_PLAN]->(:MembershipPlan)` |
| `EMPLOYEES.supervisor_id → EMPLOYEES` (recursive) | `(:Employee)-[:SUPERVISES]->(:Employee)` (supervisor → subordinate) |
| `MEETING_ROOMS.space_id → COWORKING_SPACES` | `(:CoworkingSpace)-[:CONTAINS]->(:MeetingRoom)` |
| `ROOM_FACILITIES.room_id → MEETING_ROOMS` | `(:MeetingRoom)-[:HAS_FACILITY]->(:Facility)` |
| `BOOKINGS.member_id → MEMBERS` | `(:Member)-[:MADE]->(:Booking)` |
| `BOOKINGS.room_id → MEETING_ROOMS` | `(:Booking)-[:BOOKED_IN]->(:MeetingRoom)` |
| `BOOKINGS.organization_id → ORGANIZATIONS` | `(:Booking)-[:BOOKED_FOR]->(:Organization)` |
| `PAYMENTS.booking_id → BOOKINGS` | `(:Booking)-[:PAID_BY]->(:Payment)` |
| *(DA-3 only)* | `(:Facility)-[:IN_CATEGORY {source:'DA-3 classification'}]->(:FacilityCategory)` |

```
(:MembershipPlan)<-[:HAS_PLAN]-(:Person:Member)-[:MADE]->(:Booking)-[:PAID_BY]->(:Payment)
                                                            |  \
                                                 [:BOOKED_FOR]  [:BOOKED_IN]
                                                            v      v
                                             (:Organization)    (:MeetingRoom)<-[:CONTAINS]-(:CoworkingSpace)
                                                                   |
                                                           [:HAS_FACILITY]
                                                                   v
                                    (:FacilityCategory)<-[:IN_CATEGORY]-(:Facility)      (DA-3)

(:Person:Employee)-[:SUPERVISES]->(:Person:Employee)
```

**What the original data does *not* contain, so the graph doesn't either:** there is
no member→organization foreign key (organizations are linked only through bookings),
no employee→space link, no booking attendees, and no plan→space access rules. The
"member affiliations" and "member network" demos *derive* these links by
traversing bookings; nothing is stored or invented.

### Seed data fidelity (checked by `tests/integration/01_connection_and_seed.test.js`)

| Entity | Original rows | Nodes / relationships |
|---|---|---|
| Spaces / Plans / Organizations | 4 / 4 / 5 | 4 / 4 / 5 nodes |
| Person (8 members + 6 employees) | 14 | 14 `:Person` (8 `:Member`, 6 `:Employee`, none both) |
| Rooms / Facilities | 14 / 20 | 14 / 20 nodes, 14 `CONTAINS`, 20 `HAS_FACILITY` |
| Bookings / Payments | 21 / 21 | 21 / 21 nodes; 21 each of `MADE`, `BOOKED_IN`, `BOOKED_FOR`, `PAID_BY` |
| Supervisor links | 5 non-NULL `supervisor_id` | 5 `SUPERVISES` |
| Total payments | ₹78,550.00 | ₹78,550.00 |

`TO_CHAR(SYSDATE + n, 'YYYY-MM-DD')` booking dates are stored as the same
`'YYYY-MM-DD'` strings, worked out from `$today` (the local date of the machine running
the seed). `join_date` and `payment_date` (Oracle `DATE`) are stored as Neo4j `DATE` values.

---

## 2. Business rules: where each Oracle constraint lives now

Neo4j **Community** supports uniqueness constraints only. Property-existence (NOT
NULL) and property-type constraints are Enterprise features, and CHECK constraints don't
exist in Neo4j. Rules that Oracle enforced in the schema are therefore enforced by the
API (`backend/validation.js`). Writes made directly in Neo4j Browser bypass them.

| Original rule | DA-3 implementation |
|---|---|
| Primary keys, `PERSON.email UNIQUE` | Neo4j uniqueness constraints (`01_constraints.cypher`); a violation returns HTTP 409 |
| `NOT NULL`, `VARCHAR2(n)` lengths | `Checker.str(..., {required, max})` |
| `chk_room_type`, `chk_room_status`, member/booking/payment status, `chk_payment_method` | `Checker.oneOf` with the same value lists |
| `capacity > 0`, `hourly_rate > 0`, `salary >= 0`, `total_amount >= 0`, `amount > 0` | `Checker.num` bounds |
| Foreign keys must exist | an existence check inside the same write transaction (HTTP 400) |
| `ON DELETE CASCADE` (space → rooms → facilities/bookings → payments; person → member → bookings → payments) | `DETACH DELETE` of the collected dependent nodes in one statement |
| `ON DELETE SET NULL` (plan, organization) | deleting the node removes the relationship; the booking or member remains |
| Sequences `SEQ_*` | `:Sequence` counter incremented with `SET` (write-locked, so no duplicates) |
| Trigger `TRG_CHECK_ROOM_OVERLAP` | `OVERLAP_CYPHER` in `backend/services/bookingRules.js`, same three conditions, run in the booking write transaction. A room write-lock serializes concurrent bookings (tested with 8 parallel requests: exactly 1 succeeds). |
| Procedure `SP_CREATE_BOOKING_AND_PAY` | `createBookingAndPay()`: booking and payment in **one** transaction |
| `FN_CALC_BOOKING_AMOUNT`, `FN_ROOM_TOTAL_REVENUE` | Cypher queries (`/api/bookings/calc-amount`, demo `fn_room_total_revenue`) |

---

## 3. Why a graph database suits WorkSphere

WorkSphere's data is mostly *connections*: a member makes bookings, a booking is in
a room, a room belongs to a space, a booking is for an organization and is paid by a
payment, and employees supervise employees. In Oracle every one of those connections
is a foreign key that must be re-joined at query time.

1. **Relationships are stored, not computed.** The original bookings list needed a
   6-table JOIN (`BOOKINGS ⋈ MEMBERS ⋈ PERSON ⋈ MEETING_ROOMS ⋈ COWORKING_SPACES ⋈ ORGANIZATIONS`).
   In Cypher it's one pattern:
   `(m:Member)-[:MADE]->(b:Booking)-[:BOOKED_IN]->(r)<-[:CONTAINS]-(s)`.
   Neo4j follows direct pointers from node to node (index-free adjacency), so each
   hop costs about the same however large the other tables grow.
2. **Recursive and variable-depth questions are natural.** "Everyone above Manoj in the
   chain of command" is `(boss)-[:SUPERVISES*1..]->(e)`. SQL needs `CONNECT BY` or a
   recursive CTE (see the `supervision_chain` demo for both side by side).
3. **Path questions have no simple SQL equivalent.** `shortestPath()` finds how two
   members are connected through bookings, rooms and organizations, across any mix of
   tables, in one line.
4. **Inheritance without joins.** The EER `PERSON → MEMBERS / EMPLOYEES` specialization
   is one node with two labels, so there's no 1:1 join to read a member's name.
5. **Flexible schema for new connection types.** DA-3 adds facility categories by
   creating new nodes and `IN_CATEGORY` relationships. The original nodes and every
   existing query are untouched. In Oracle this needs new tables plus a junction table
   and a migration.
6. **Visual results.** Query results are subgraphs that the UI draws directly, which
   makes the data model easy to explain.

**Trade-offs (where Oracle remains stronger):** declarative CHECK / NOT NULL
constraints (Enterprise-only or missing in Neo4j Community, so the API must enforce
them), mature tooling for tabular reporting and aggregation, and decades of financial
and ACID tooling. Neo4j is also fully ACID, but WorkSphere's payment ledger is
naturally tabular. A production system might keep billing in a relational store
and use the graph for the connected data. For this small dataset, performance
differences are not measurable; the advantages above are about how queries are
expressed and how easily the model can grow.
