// ====================================================================
// WorkSphere DA-3 - 03_demo_queries.cypher
// GENERATED from backend/services/demos.js (npm run docs:queries) - do not edit by hand.
//
// Every query here is runnable in Neo4j Browser (http://localhost:7474) or
// cypher-shell. Queries with $parameters list the matching :param commands
// (Neo4j Browser syntax) first. The "SQL" comment shows the original DA-II
// Oracle query, or a comparison query written for DA-3 where marked.
// ====================================================================

// ####################################################################
// Original DA-II queries in Cypher
// ####################################################################

// --- 1. Rooms with space & city (multi-table JOIN) [rooms_and_spaces]
// README sample query 1. The JOIN on space_id becomes the CONTAINS relationship.
// SQL (original DA-II project):
//   SELECT r.room_id, r.room_name, r.room_type, r.capacity, r.hourly_rate, s.space_name, s.city
//   FROM MEETING_ROOMS r
//   JOIN COWORKING_SPACES s ON r.space_id = s.space_id
//   ORDER BY r.capacity DESC
MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom)
RETURN r.room_id AS room_id, r.room_name AS room_name, r.room_type AS room_type,
       r.capacity AS capacity, r.hourly_rate AS hourly_rate, s.space_name AS space_name, s.city AS city
ORDER BY capacity DESC;

// --- 2. Active (CONFIRMED) bookings - 5-table JOIN [active_bookings]
// Console preset from the original app. Five JOINs become one connected pattern.
// SQL (original DA-II project):
//   SELECT b.booking_id, p.first_name || ' ' || p.last_name as member_name, r.room_name, s.space_name,
//          b.booking_date, b.start_time || ' - ' || b.end_time as slot, b.total_amount
//   FROM BOOKINGS b
//   JOIN MEMBERS m ON b.member_id = m.member_id
//   JOIN PERSON p ON m.person_id = p.person_id
//   JOIN MEETING_ROOMS r ON b.room_id = r.room_id
//   JOIN COWORKING_SPACES s ON r.space_id = s.space_id
//   WHERE b.status = 'CONFIRMED'
//   ORDER BY b.booking_date ASC
MATCH (m:Member)-[:MADE]->(b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r:MeetingRoom)<-[:CONTAINS]-(s:CoworkingSpace)
RETURN b.booking_id AS booking_id, m.first_name + ' ' + m.last_name AS member_name, r.room_name AS room_name,
       s.space_name AS space_name, b.booking_date AS booking_date,
       b.start_time + ' - ' + b.end_time AS slot, b.total_amount AS total_amount
ORDER BY booking_date ASC, booking_id ASC;

// --- 3. Revenue by room (aggregate) [revenue_by_room]
// README sample query 2. LEFT JOIN + GROUP BY becomes OPTIONAL MATCH + implicit grouping.
// SQL (original DA-II project):
//   SELECT r.room_id, r.room_name, COUNT(b.booking_id) as total_bookings, NVL(SUM(b.total_amount), 0) as total_revenue
//   FROM MEETING_ROOMS r
//   LEFT JOIN BOOKINGS b ON r.room_id = b.room_id AND b.status = 'CONFIRMED'
//   GROUP BY r.room_id, r.room_name
//   ORDER BY total_revenue DESC
MATCH (r:MeetingRoom)
OPTIONAL MATCH (b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
RETURN r.room_id AS room_id, r.room_name AS room_name,
       count(b) AS total_bookings, coalesce(sum(b.total_amount), 0) AS total_revenue
ORDER BY total_revenue DESC, room_id;

// --- 4. EER specialization: PERSON -> MEMBERS -> MEMBERSHIP_PLANS [member_plans]
// README sample query 4. Superclass and subclass are one node with two labels (:Person:Member).
// SQL (original DA-II project):
//   SELECT m.member_id, p.first_name || ' ' || p.last_name AS member_name,
//          p.email, p.city, pl.plan_name, pl.monthly_fee, m.status
//   FROM MEMBERS m
//   JOIN PERSON p ON m.person_id = p.person_id
//   LEFT JOIN MEMBERSHIP_PLANS pl ON m.plan_id = pl.plan_id
//   ORDER BY m.member_id ASC
MATCH (m:Person:Member)
OPTIONAL MATCH (m)-[:HAS_PLAN]->(pl:MembershipPlan)
RETURN m.member_id AS member_id, m.first_name + ' ' + m.last_name AS member_name,
       m.email AS email, m.city AS city, pl.plan_name AS plan_name, pl.monthly_fee AS monthly_fee, m.status AS status
ORDER BY member_id ASC;

// --- 5. Room facilities (weak entity) [room_facilities]
// Console preset from the original app. ROOM_FACILITIES rows are :Facility nodes linked by HAS_FACILITY.
// SQL (original DA-II project):
//   SELECT r.room_name, f.facility_name, f.quantity
//   FROM ROOM_FACILITIES f
//   JOIN MEETING_ROOMS r ON f.room_id = r.room_id
//   ORDER BY r.room_name, f.facility_name
MATCH (r:MeetingRoom)-[:HAS_FACILITY]->(f:Facility)
RETURN r.room_name AS room_name, f.facility_name AS facility_name, f.quantity AS quantity
ORDER BY room_name, facility_name;

// --- 6. Recursive SUPERVISES hierarchy (self-join) [eer_hierarchy]
// README sample query 5. The recursive FK supervisor_id becomes a SUPERVISES relationship.
// SQL (original DA-II project):
//   SELECT e.employee_id, pe.first_name || ' ' || pe.last_name AS employee_name, e.job_title, e.salary,
//          NVL(ps.first_name || ' ' || ps.last_name, 'TOP-LEVEL DIRECTOR') AS supervisor_name,
//          NVL(s.job_title, 'EXECUTIVE BOARD') AS supervisor_title
//   FROM EMPLOYEES e
//   JOIN PERSON pe ON e.person_id = pe.person_id
//   LEFT JOIN EMPLOYEES s ON e.supervisor_id = s.employee_id
//   LEFT JOIN PERSON ps ON s.person_id = ps.person_id
//   ORDER BY e.supervisor_id NULLS FIRST, e.employee_id ASC
MATCH (e:Person:Employee)
OPTIONAL MATCH (s:Employee)-[:SUPERVISES]->(e)
RETURN e.employee_id AS employee_id, e.first_name + ' ' + e.last_name AS employee_name,
       e.job_title AS job_title, e.salary AS salary,
       coalesce(s.first_name + ' ' + s.last_name, 'TOP-LEVEL DIRECTOR') AS supervisor_name,
       coalesce(s.job_title, 'EXECUTIVE BOARD') AS supervisor_title
ORDER BY s.employee_id IS NOT NULL, s.employee_id, employee_id;

// --- 7. Database catalog: node labels and relationship counts [graph_catalog]
// Replaces the original "SELECT ... FROM user_tables" preset.
// SQL (original DA-II project):
//   SELECT table_name, num_rows, status FROM user_tables ORDER BY table_name
MATCH (n)
UNWIND labels(n) AS label
RETURN 'node label' AS kind, label AS name, count(*) AS total
UNION ALL
MATCH ()-[r]->()
RETURN 'relationship' AS kind, type(r) AS name, count(*) AS total;

// --- 8. FN_ROOM_TOTAL_REVENUE(p_room_id) [fn_room_total_revenue]
// PL/SQL function from triggers_and_procedures.sql, as a parameterised Cypher query.
// SQL (original DA-II project):
//   SELECT NVL(SUM(total_amount), 0) INTO v_sum
//   FROM BOOKINGS
//   WHERE room_id = p_room_id AND status = 'CONFIRMED';
// :param room_id => 301
MATCH (r:MeetingRoom {room_id: $room_id})
OPTIONAL MATCH (b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
RETURN r.room_name AS room_name, coalesce(sum(b.total_amount), 0) AS total_revenue;

// --- 9. FN_CALC_BOOKING_AMOUNT(p_room_id, p_hours) [fn_calc_booking_amount]
// PL/SQL function: hourly_rate * hours.
// SQL (original DA-II project):
//   SELECT hourly_rate INTO v_rate FROM MEETING_ROOMS WHERE room_id = p_room_id;
//   v_total := v_rate * p_hours;
// :param room_id => 301
// :param hours => 2
MATCH (r:MeetingRoom {room_id: $room_id})
RETURN r.room_name AS room_name, r.hourly_rate AS hourly_rate, $hours AS hours, r.hourly_rate * $hours AS amount;

// --- 10. TRG_CHECK_ROOM_OVERLAP logic (read-only preview) [overlap_check]
// The same three overlap conditions the trigger used. The booking API runs this inside the write transaction before creating a booking.
// SQL (original DA-II project):
//   SELECT COUNT(*) INTO v_overlap_count FROM BOOKINGS
//   WHERE room_id = :NEW.room_id AND booking_date = :NEW.booking_date AND status = 'CONFIRMED'
//     AND booking_id != NVL(:NEW.booking_id, -1)
//     AND ((:NEW.start_time >= start_time AND :NEW.start_time < end_time) OR
//          (:NEW.end_time > start_time AND :NEW.end_time <= end_time) OR
//          (:NEW.start_time <= start_time AND :NEW.end_time >= end_time));
// :param room_id => 301
// :param date => toString(date())
// :param start_time => '10:00'
// :param end_time => '12:00'
MATCH (m:Member)-[:MADE]->(b:Booking {booking_date: $date, status: 'CONFIRMED'})-[:BOOKED_IN]->(r:MeetingRoom {room_id: $room_id})
WHERE ($start_time >= b.start_time AND $start_time < b.end_time)
   OR ($end_time > b.start_time AND $end_time <= b.end_time)
   OR ($start_time <= b.start_time AND $end_time >= b.end_time)
RETURN b.booking_id AS conflicting_booking, m.first_name + ' ' + m.last_name AS booked_by,
       b.start_time AS start_time, b.end_time AS end_time;

// ####################################################################
// DA-3 graph traversals
// ####################################################################

// --- 11. Full chain of command (variable-length path) [supervision_chain]
// Every employee with their level and complete path to the top director. SQL needs CONNECT BY or a recursive CTE.
// SQL (DA-3 comparison, not in the original):
//   WITH RECURSIVE chain (employee_id, supervisor_id, lvl, path) AS (
//     SELECT e.employee_id, e.supervisor_id, 0, CAST(e.employee_id AS VARCHAR2(400))
//     FROM EMPLOYEES e WHERE e.supervisor_id IS NULL
//     UNION ALL
//     SELECT e.employee_id, e.supervisor_id, c.lvl + 1, c.path || ' > ' || e.employee_id
//     FROM EMPLOYEES e JOIN chain c ON e.supervisor_id = c.employee_id
//   )
//   SELECT * FROM chain ORDER BY lvl;
MATCH path = (top:Employee)-[:SUPERVISES*0..]->(e:Employee)
WHERE NOT ()-[:SUPERVISES]->(top)
RETURN e.employee_id AS employee_id, e.first_name + ' ' + e.last_name AS employee, e.job_title AS job_title,
       length(path) AS level,
       [n IN nodes(path) | n.first_name + ' ' + n.last_name] AS chain_of_command, path
ORDER BY level, employee_id;

// --- 12. Everyone above one employee, at any depth [employee_reports]
// Walks SUPERVISES backwards from the chosen employee to the root.
// SQL (DA-3 comparison, not in the original):
//   SELECT LEVEL, employee_id, job_title FROM EMPLOYEES
//   START WITH employee_id = :employee_id
//   CONNECT BY PRIOR supervisor_id = employee_id;
// :param employee_id => 9005
MATCH path = (boss:Employee)-[:SUPERVISES*1..]->(e:Employee {employee_id: $employee_id})
RETURN boss.first_name + ' ' + boss.last_name AS supervisor, boss.job_title AS job_title,
       length(path) AS levels_above, path
ORDER BY levels_above;

// --- 13. Organization footprint: members, rooms, spaces, payments [org_footprint]
// Starts from one organization and follows BOOKED_FOR, MADE, BOOKED_IN, CONTAINS and PAID_BY.
// SQL (DA-3 comparison, not in the original):
//   SELECT o.organization_name, p.first_name || ' ' || p.last_name AS member, r.room_name, s.space_name,
//          b.booking_date, pay.amount, pay.method
//   FROM ORGANIZATIONS o
//   JOIN BOOKINGS b ON b.organization_id = o.organization_id
//   JOIN MEMBERS m ON m.member_id = b.member_id
//   JOIN PERSON p ON p.person_id = m.person_id
//   JOIN MEETING_ROOMS r ON r.room_id = b.room_id
//   JOIN COWORKING_SPACES s ON s.space_id = r.space_id
//   LEFT JOIN PAYMENTS pay ON pay.booking_id = b.booking_id
//   WHERE o.organization_id = :organization_id;
// :param organization_id => 501
MATCH (o:Organization {organization_id: $organization_id})<-[bf:BOOKED_FOR]-(b:Booking)<-[made:MADE]-(m:Member),
      (b)-[bi:BOOKED_IN]->(r:MeetingRoom)<-[c:CONTAINS]-(s:CoworkingSpace)
OPTIONAL MATCH (b)-[pb:PAID_BY]->(p:Payment)
RETURN o.organization_name AS organization, m.first_name + ' ' + m.last_name AS member,
       r.room_name AS room, s.space_name AS space, b.booking_date AS booking_date,
       p.amount AS amount, p.method AS method,
       [o, b, m, r, s, p] AS graph_nodes, [bf, made, bi, c, pb] AS graph_rels
ORDER BY booking_date, room;

// --- 14. Revenue per organization (through bookings to payments) [org_revenue]
// Aggregates COMPLETED payments reached from each organization.
// SQL (DA-3 comparison, not in the original):
//   SELECT o.organization_name, o.industry, COUNT(DISTINCT b.booking_id) AS bookings, SUM(p.amount) AS revenue
//   FROM ORGANIZATIONS o
//   JOIN BOOKINGS b ON b.organization_id = o.organization_id
//   JOIN PAYMENTS p ON p.booking_id = b.booking_id AND p.status = 'COMPLETED'
//   GROUP BY o.organization_name, o.industry
//   ORDER BY revenue DESC;
MATCH (o:Organization)<-[:BOOKED_FOR]-(b:Booking)-[:PAID_BY]->(p:Payment {status: 'COMPLETED'})
RETURN o.organization_name AS organization, o.industry AS industry,
       count(DISTINCT b) AS bookings, sum(p.amount) AS revenue
ORDER BY revenue DESC;

// --- 15. Member to organization affiliations (derived from bookings) [member_affiliations]
// The original schema has no member-organization FK. The link is worked out by following Member-MADE-Booking-BOOKED_FOR-Organization.
// SQL (DA-3 comparison, not in the original):
//   SELECT m.member_id, p.first_name || ' ' || p.last_name AS member,
//          LISTAGG(DISTINCT o.organization_name, ', ') AS organizations, COUNT(*) AS bookings
//   FROM MEMBERS m JOIN PERSON p ON p.person_id = m.person_id
//   JOIN BOOKINGS b ON b.member_id = m.member_id
//   JOIN ORGANIZATIONS o ON o.organization_id = b.organization_id
//   GROUP BY m.member_id, p.first_name, p.last_name;
MATCH (m:Member)-[:MADE]->(b:Booking)-[:BOOKED_FOR]->(o:Organization)
RETURN m.member_id AS member_id, m.first_name + ' ' + m.last_name AS member,
       collect(DISTINCT o.organization_name) AS organizations, count(b) AS bookings
ORDER BY member_id;

// --- 16. Member network: who shares rooms or organizations with a member [member_network]
// A 4-hop pattern: Member -> Booking -> (Room | Organization) <- Booking <- other Member.
// SQL (DA-3 comparison, not in the original):
//   -- Two self-joins on BOOKINGS (one per shared attribute) combined with UNION
//   SELECT b2.member_id, 'ROOM' AS via, b1.room_id AS shared FROM BOOKINGS b1
//   JOIN BOOKINGS b2 ON b1.room_id = b2.room_id AND b2.member_id <> b1.member_id
//   WHERE b1.member_id = :member_id
//   UNION
//   SELECT b2.member_id, 'ORG', b1.organization_id FROM BOOKINGS b1
//   JOIN BOOKINGS b2 ON b1.organization_id = b2.organization_id AND b2.member_id <> b1.member_id
//   WHERE b1.member_id = :member_id;
// :param member_id => 1001
MATCH path = (me:Member {member_id: $member_id})-[:MADE]->(:Booking)-[:BOOKED_IN|BOOKED_FOR]->(shared)
      <-[:BOOKED_IN|BOOKED_FOR]-(:Booking)<-[:MADE]-(other:Member)
WHERE other <> me
WITH other, collect(DISTINCT shared) AS via, collect(path) AS paths
RETURN other.member_id AS member_id, other.first_name + ' ' + other.last_name AS connected_member,
       [x IN via | labels(x)[0] + ': ' + coalesce(x.room_name, x.organization_name)] AS shared_via,
       size(via) AS connection_strength, paths
ORDER BY connection_strength DESC, member_id;

// --- 17. Shortest path between two members [shortest_path]
// shortestPath() finds how two members are connected through bookings, rooms, spaces and organizations.
// SQL (DA-3 comparison, not in the original):
//   -- No direct SQL equivalent: needs a recursive CTE across every FK table
//   -- with cycle detection.
// :param member_id => 1001
// :param member_b => 1004
MATCH (a:Member {member_id: $member_id}), (b:Member {member_id: $member_b})
MATCH p = shortestPath((a)-[:MADE|BOOKED_IN|BOOKED_FOR|CONTAINS*..12]-(b))
RETURN length(p) AS hops,
       [n IN nodes(p) | labels(n)[-1] + ': ' + coalesce(n.first_name + ' ' + n.last_name, n.room_name,
                         n.space_name, n.organization_name, 'Booking #' + toString(n.booking_id))] AS route, p;

// --- 18. Room recommendation: free, large enough, optional facility category [room_recommendation]
// Free in the slot (same overlap rule), AVAILABLE, capacity >= minimum, optionally having a facility in a DA-3 category; ranked by past bookings.
// SQL (DA-3 comparison, not in the original):
//   SELECT r.room_id, r.room_name, s.space_name, r.capacity, r.hourly_rate,
//          (SELECT COUNT(*) FROM BOOKINGS x WHERE x.room_id = r.room_id) AS popularity
//   FROM MEETING_ROOMS r JOIN COWORKING_SPACES s ON s.space_id = r.space_id
//   WHERE r.status = 'AVAILABLE' AND r.capacity >= :min_capacity
//     AND NOT EXISTS (SELECT 1 FROM BOOKINGS b WHERE b.room_id = r.room_id AND b.booking_date = :d
//                     AND b.status = 'CONFIRMED' AND :start < b.end_time AND :end > b.start_time)
//   ORDER BY popularity DESC, r.hourly_rate;
// :param date => toString(date())
// :param start_time => '10:00'
// :param end_time => '12:00'
// :param min_capacity => 4
// :param category => ''
MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom {status: 'AVAILABLE'})
WHERE r.capacity >= $min_capacity
  AND ($category = '' OR EXISTS {
        (r)-[:HAS_FACILITY]->(:Facility)-[:IN_CATEGORY]->(:FacilityCategory {name: $category}) })
  AND NOT EXISTS {
        MATCH (b:Booking {booking_date: $date, status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
        WHERE ($start_time >= b.start_time AND $start_time < b.end_time)
           OR ($end_time > b.start_time AND $end_time <= b.end_time)
           OR ($start_time <= b.start_time AND $end_time >= b.end_time) }
OPTIONAL MATCH (past:Booking)-[:BOOKED_IN]->(r)
WITH s, r, count(past) AS popularity,
     duration.inSeconds(time($start_time), time($end_time)).seconds / 3600.0 AS hours
RETURN r.room_id AS room_id, r.room_name AS room_name, r.room_type AS room_type, s.space_name AS space_name,
       r.capacity AS capacity, r.hourly_rate AS hourly_rate, r.hourly_rate * hours AS estimated_cost,
       popularity
ORDER BY popularity DESC, hourly_rate ASC;

// ####################################################################
// DA-3 facility categories (enhancement)
// ####################################################################

// --- 19. Rooms offering a facility category [rooms_by_category]
// DA-3 enhancement: FacilityCategory nodes group the original facility rows.
// SQL (DA-3 comparison, not in the original):
//   -- Would need a new FACILITY_CATEGORY table plus a junction table in Oracle.
// :param category => ''
MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom)-[:HAS_FACILITY]->(f:Facility)-[:IN_CATEGORY]->(c:FacilityCategory)
WHERE $category = '' OR c.name = $category
RETURN c.name AS category, r.room_name AS room_name, s.space_name AS space_name,
       collect(f.facility_name) AS matching_facilities
ORDER BY category, room_name;

// --- 20. Rooms similar to a room (shared facility categories) [similar_rooms]
// Ranks other rooms by the number of facility categories they share with the chosen room.
// SQL (DA-3 comparison, not in the original):
//   -- Requires the category tables and a self-join through them.
// :param room_id => 301
MATCH (r:MeetingRoom {room_id: $room_id})-[:HAS_FACILITY]->(:Facility)-[:IN_CATEGORY]->(c:FacilityCategory)
      <-[:IN_CATEGORY]-(:Facility)<-[:HAS_FACILITY]-(other:MeetingRoom)
WHERE other <> r
RETURN other.room_id AS room_id, other.room_name AS similar_room, other.room_type AS room_type,
       collect(DISTINCT c.name) AS shared_categories, count(DISTINCT c) AS similarity
ORDER BY similarity DESC, room_id;

// --- 21. Facility category coverage across spaces [category_coverage]
// How many rooms and spaces offer each DA-3 category.
// SQL (DA-3 comparison, not in the original):
//   -- Requires the category tables.
MATCH (c:FacilityCategory)
OPTIONAL MATCH (c)<-[:IN_CATEGORY]-(:Facility)<-[:HAS_FACILITY]-(r:MeetingRoom)<-[:CONTAINS]-(s:CoworkingSpace)
RETURN c.name AS category, c.description AS description,
       count(DISTINCT r) AS rooms, count(DISTINCT s) AS spaces, collect(DISTINCT s.space_name) AS space_names
ORDER BY rooms DESC, category;

// ####################################################################
// DA-3 graph traversals
// ####################################################################

// --- 22. Graph of one coworking space (for the visualizer) [space_graph]
// Returns one space with its rooms, facilities and the bookings on a date, as a subgraph.
// SQL (DA-3 comparison, not in the original):
//   -- A relational database returns rows, not a connected subgraph.
// :param space_id => 101
// :param date => toString(date())
MATCH (s:CoworkingSpace {space_id: $space_id})-[c:CONTAINS]->(r:MeetingRoom)
OPTIONAL MATCH (r)-[hf:HAS_FACILITY]->(f:Facility)
OPTIONAL MATCH (m:Member)-[made:MADE]->(b:Booking {booking_date: $date})-[bi:BOOKED_IN]->(r)
RETURN s, c, r, collect(DISTINCT [hf, f]) AS facilities, collect(DISTINCT [m, made, b, bi]) AS bookings;
