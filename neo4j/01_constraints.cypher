// ====================================================================
// WorkSphere DA-3 - 01_constraints.cypher
// Graph schema: uniqueness constraints (Oracle PRIMARY KEY / UNIQUE)
// and lookup indexes. All statements are idempotent (IF NOT EXISTS).
//
// Neo4j Community Edition supports UNIQUE constraints. Property-existence
// (NOT NULL) and property-type constraints are Enterprise-only, so the
// Oracle NOT NULL and CHECK rules are enforced in backend/validation.js.
// ====================================================================

// PERSON.person_id (PK) and PERSON.email (UNIQUE)
CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.person_id IS UNIQUE;
CREATE CONSTRAINT person_email_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.email IS UNIQUE;
// MEMBERS.member_id (PK), EMPLOYEES.employee_id (PK)
CREATE CONSTRAINT member_id_unique IF NOT EXISTS FOR (m:Member) REQUIRE m.member_id IS UNIQUE;
CREATE CONSTRAINT employee_id_unique IF NOT EXISTS FOR (e:Employee) REQUIRE e.employee_id IS UNIQUE;
// MEMBERSHIP_PLANS.plan_id (PK)
CREATE CONSTRAINT plan_id_unique IF NOT EXISTS FOR (p:MembershipPlan) REQUIRE p.plan_id IS UNIQUE;
// COWORKING_SPACES.space_id (PK)
CREATE CONSTRAINT space_id_unique IF NOT EXISTS FOR (s:CoworkingSpace) REQUIRE s.space_id IS UNIQUE;
// MEETING_ROOMS.room_id (PK)
CREATE CONSTRAINT room_id_unique IF NOT EXISTS FOR (r:MeetingRoom) REQUIRE r.room_id IS UNIQUE;
// ROOM_FACILITIES.facility_id (PK)
CREATE CONSTRAINT facility_id_unique IF NOT EXISTS FOR (f:Facility) REQUIRE f.facility_id IS UNIQUE;
// ORGANIZATIONS.organization_id (PK)
CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.organization_id IS UNIQUE;
// BOOKINGS.booking_id (PK)
CREATE CONSTRAINT booking_id_unique IF NOT EXISTS FOR (b:Booking) REQUIRE b.booking_id IS UNIQUE;
// PAYMENTS.payment_id (PK)
CREATE CONSTRAINT payment_id_unique IF NOT EXISTS FOR (p:Payment) REQUIRE p.payment_id IS UNIQUE;
// Oracle SEQUENCE replacement counters
CREATE CONSTRAINT sequence_name_unique IF NOT EXISTS FOR (s:Sequence) REQUIRE s.name IS UNIQUE;
// DA-3 enhancement: facility categories
CREATE CONSTRAINT facility_category_unique IF NOT EXISTS FOR (c:FacilityCategory) REQUIRE c.name IS UNIQUE;

// Lookup indexes used by the overlap check, dashboards and filters
CREATE INDEX booking_date_idx IF NOT EXISTS FOR (b:Booking) ON (b.booking_date);
CREATE INDEX booking_status_idx IF NOT EXISTS FOR (b:Booking) ON (b.status);
CREATE INDEX room_status_idx IF NOT EXISTS FOR (r:MeetingRoom) ON (r.status);
CREATE INDEX room_type_idx IF NOT EXISTS FOR (r:MeetingRoom) ON (r.room_type);
CREATE INDEX member_status_idx IF NOT EXISTS FOR (m:Member) ON (m.status);
