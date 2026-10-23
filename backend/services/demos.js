// ====================================================================
// WorkSphere DA-3 - preset Cypher demonstrations
// Single source of truth for:
//   * the "Cypher Demos" panel in the UI   (GET /api/demos, POST /api/demos/:key)
//   * neo4j/03_demo_queries.cypher          (generated: npm run docs:queries)
//
// sqlSource:
//   'original'   - the SQL is copied from the DA-II project (README / app.js presets)
//   'comparison' - SQL written for DA-3 to compare with the Cypher (not in the original)
// ====================================================================
const { Checker } = require('../validation');
const db = require('../db/neo4j');

const P = {
  room_id: { type: 'id', label: 'Room ID', default: 301 },
  member_id: { type: 'id', label: 'Member ID', default: 1001 },
  member_b: { type: 'id', label: 'Other member ID', default: 1004 },
  organization_id: { type: 'id', label: 'Organization ID', default: 501 },
  employee_id: { type: 'id', label: 'Employee ID', default: 9005 },
  space_id: { type: 'id', label: 'Space ID', default: 101 },
  hours: { type: 'number', label: 'Hours', default: 2 },
  date: { type: 'date', label: 'Date (YYYY-MM-DD)', default: 'today' },
  start_time: { type: 'time', label: 'Start (HH:MM)', default: '10:00' },
  end_time: { type: 'time', label: 'End (HH:MM)', default: '12:00' },
  min_capacity: { type: 'int', label: 'Minimum capacity', default: 4 },
  category: { type: 'category', label: 'Facility category (DA-3, optional)', default: '' }
};

const DEMOS = [
  // ---------------- Original DA-II queries, rewritten in Cypher ----------------
  {
    key: 'rooms_and_spaces', group: 'Original DA-II queries in Cypher',
    title: 'Rooms with space & city (multi-table JOIN)',
    description: 'README sample query 1. The JOIN on space_id becomes the CONTAINS relationship.',
    sqlSource: 'original',
    sql: `SELECT r.room_id, r.room_name, r.room_type, r.capacity, r.hourly_rate, s.space_name, s.city
FROM MEETING_ROOMS r
JOIN COWORKING_SPACES s ON r.space_id = s.space_id
ORDER BY r.capacity DESC`,
    cypher: `MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom)
RETURN r.room_id AS room_id, r.room_name AS room_name, r.room_type AS room_type,
       r.capacity AS capacity, r.hourly_rate AS hourly_rate, s.space_name AS space_name, s.city AS city
ORDER BY capacity DESC`
  },
  {
    key: 'active_bookings', group: 'Original DA-II queries in Cypher',
    title: 'Active (CONFIRMED) bookings - 5-table JOIN',
    description: 'Console preset from the original app. Five JOINs become one connected pattern.',
    sqlSource: 'original',
    sql: `SELECT b.booking_id, p.first_name || ' ' || p.last_name as member_name, r.room_name, s.space_name,
       b.booking_date, b.start_time || ' - ' || b.end_time as slot, b.total_amount
FROM BOOKINGS b
JOIN MEMBERS m ON b.member_id = m.member_id
JOIN PERSON p ON m.person_id = p.person_id
JOIN MEETING_ROOMS r ON b.room_id = r.room_id
JOIN COWORKING_SPACES s ON r.space_id = s.space_id
WHERE b.status = 'CONFIRMED'
ORDER BY b.booking_date ASC`,
    cypher: `MATCH (m:Member)-[:MADE]->(b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r:MeetingRoom)<-[:CONTAINS]-(s:CoworkingSpace)
RETURN b.booking_id AS booking_id, m.first_name + ' ' + m.last_name AS member_name, r.room_name AS room_name,
       s.space_name AS space_name, b.booking_date AS booking_date,
       b.start_time + ' - ' + b.end_time AS slot, b.total_amount AS total_amount
ORDER BY booking_date ASC, booking_id ASC`
  },
  {
    key: 'revenue_by_room', group: 'Original DA-II queries in Cypher',
    title: 'Revenue by room (aggregate)',
    description: 'README sample query 2. LEFT JOIN + GROUP BY becomes OPTIONAL MATCH + implicit grouping.',
    sqlSource: 'original',
    sql: `SELECT r.room_id, r.room_name, COUNT(b.booking_id) as total_bookings, NVL(SUM(b.total_amount), 0) as total_revenue
FROM MEETING_ROOMS r
LEFT JOIN BOOKINGS b ON r.room_id = b.room_id AND b.status = 'CONFIRMED'
GROUP BY r.room_id, r.room_name
ORDER BY total_revenue DESC`,
    cypher: `MATCH (r:MeetingRoom)
OPTIONAL MATCH (b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
RETURN r.room_id AS room_id, r.room_name AS room_name,
       count(b) AS total_bookings, coalesce(sum(b.total_amount), 0) AS total_revenue
ORDER BY total_revenue DESC, room_id`
  },
  {
    key: 'member_plans', group: 'Original DA-II queries in Cypher',
    title: 'EER specialization: PERSON -> MEMBERS -> MEMBERSHIP_PLANS',
    description: 'README sample query 4. Superclass and subclass are one node with two labels (:Person:Member).',
    sqlSource: 'original',
    sql: `SELECT m.member_id, p.first_name || ' ' || p.last_name AS member_name,
       p.email, p.city, pl.plan_name, pl.monthly_fee, m.status
FROM MEMBERS m
JOIN PERSON p ON m.person_id = p.person_id
LEFT JOIN MEMBERSHIP_PLANS pl ON m.plan_id = pl.plan_id
ORDER BY m.member_id ASC`,
    cypher: `MATCH (m:Person:Member)
OPTIONAL MATCH (m)-[:HAS_PLAN]->(pl:MembershipPlan)
RETURN m.member_id AS member_id, m.first_name + ' ' + m.last_name AS member_name,
       m.email AS email, m.city AS city, pl.plan_name AS plan_name, pl.monthly_fee AS monthly_fee, m.status AS status
ORDER BY member_id ASC`
  },
  {
    key: 'room_facilities', group: 'Original DA-II queries in Cypher',
    title: 'Room facilities (weak entity)',
    description: 'Console preset from the original app. ROOM_FACILITIES rows are :Facility nodes linked by HAS_FACILITY.',
    sqlSource: 'original',
    sql: `SELECT r.room_name, f.facility_name, f.quantity
FROM ROOM_FACILITIES f
JOIN MEETING_ROOMS r ON f.room_id = r.room_id
ORDER BY r.room_name, f.facility_name`,
    cypher: `MATCH (r:MeetingRoom)-[:HAS_FACILITY]->(f:Facility)
RETURN r.room_name AS room_name, f.facility_name AS facility_name, f.quantity AS quantity
ORDER BY room_name, facility_name`
  },
  {
    key: 'eer_hierarchy', group: 'Original DA-II queries in Cypher',
    title: 'Recursive SUPERVISES hierarchy (self-join)',
    description: 'README sample query 5. The recursive FK supervisor_id becomes a SUPERVISES relationship.',
    sqlSource: 'original',
    sql: `SELECT e.employee_id, pe.first_name || ' ' || pe.last_name AS employee_name, e.job_title, e.salary,
       NVL(ps.first_name || ' ' || ps.last_name, 'TOP-LEVEL DIRECTOR') AS supervisor_name,
       NVL(s.job_title, 'EXECUTIVE BOARD') AS supervisor_title
FROM EMPLOYEES e
JOIN PERSON pe ON e.person_id = pe.person_id
LEFT JOIN EMPLOYEES s ON e.supervisor_id = s.employee_id
LEFT JOIN PERSON ps ON s.person_id = ps.person_id
ORDER BY e.supervisor_id NULLS FIRST, e.employee_id ASC`,
    cypher: `MATCH (e:Person:Employee)
OPTIONAL MATCH (s:Employee)-[:SUPERVISES]->(e)
RETURN e.employee_id AS employee_id, e.first_name + ' ' + e.last_name AS employee_name,
       e.job_title AS job_title, e.salary AS salary,
       coalesce(s.first_name + ' ' + s.last_name, 'TOP-LEVEL DIRECTOR') AS supervisor_name,
       coalesce(s.job_title, 'EXECUTIVE BOARD') AS supervisor_title
ORDER BY s.employee_id IS NOT NULL, s.employee_id, employee_id`
  },
  {
    key: 'graph_catalog', group: 'Original DA-II queries in Cypher',
    title: 'Database catalog: node labels and relationship counts',
    description: 'Replaces the original "SELECT ... FROM user_tables" preset.',
    sqlSource: 'original',
    sql: `SELECT table_name, num_rows, status FROM user_tables ORDER BY table_name`,
    cypher: `MATCH (n)
UNWIND labels(n) AS label
RETURN 'node label' AS kind, label AS name, count(*) AS total
UNION ALL
MATCH ()-[r]->()
RETURN 'relationship' AS kind, type(r) AS name, count(*) AS total`
  },
  {
    key: 'fn_room_total_revenue', group: 'Original DA-II queries in Cypher',
    title: 'FN_ROOM_TOTAL_REVENUE(p_room_id)',
    description: 'PL/SQL function from triggers_and_procedures.sql, as a parameterised Cypher query.',
    sqlSource: 'original',
    sql: `SELECT NVL(SUM(total_amount), 0) INTO v_sum
FROM BOOKINGS
WHERE room_id = p_room_id AND status = 'CONFIRMED';`,
    params: ['room_id'],
    cypher: `MATCH (r:MeetingRoom {room_id: $room_id})
OPTIONAL MATCH (b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
RETURN r.room_name AS room_name, coalesce(sum(b.total_amount), 0) AS total_revenue`
  },
  {
    key: 'fn_calc_booking_amount', group: 'Original DA-II queries in Cypher',
    title: 'FN_CALC_BOOKING_AMOUNT(p_room_id, p_hours)',
    description: 'PL/SQL function: hourly_rate * hours.',
    sqlSource: 'original',
    sql: `SELECT hourly_rate INTO v_rate FROM MEETING_ROOMS WHERE room_id = p_room_id;
v_total := v_rate * p_hours;`,
    params: ['room_id', 'hours'],
    cypher: `MATCH (r:MeetingRoom {room_id: $room_id})
RETURN r.room_name AS room_name, r.hourly_rate AS hourly_rate, $hours AS hours, r.hourly_rate * $hours AS amount`
  },
  {
    key: 'overlap_check', group: 'Original DA-II queries in Cypher',
    title: 'TRG_CHECK_ROOM_OVERLAP logic (read-only preview)',
    description: 'The same three overlap conditions the trigger used. The booking API runs this inside the write transaction before creating a booking.',
    sqlSource: 'original',
    sql: `SELECT COUNT(*) INTO v_overlap_count FROM BOOKINGS
WHERE room_id = :NEW.room_id AND booking_date = :NEW.booking_date AND status = 'CONFIRMED'
  AND booking_id != NVL(:NEW.booking_id, -1)
  AND ((:NEW.start_time >= start_time AND :NEW.start_time < end_time) OR
       (:NEW.end_time > start_time AND :NEW.end_time <= end_time) OR
       (:NEW.start_time <= start_time AND :NEW.end_time >= end_time));`,
    params: ['room_id', 'date', 'start_time', 'end_time'],
    cypher: `MATCH (m:Member)-[:MADE]->(b:Booking {booking_date: $date, status: 'CONFIRMED'})-[:BOOKED_IN]->(r:MeetingRoom {room_id: $room_id})
WHERE ($start_time >= b.start_time AND $start_time < b.end_time)
   OR ($end_time > b.start_time AND $end_time <= b.end_time)
   OR ($start_time <= b.start_time AND $end_time >= b.end_time)
RETURN b.booking_id AS conflicting_booking, m.first_name + ' ' + m.last_name AS booked_by,
       b.start_time AS start_time, b.end_time AS end_time`
  },

  // ---------------- DA-3 graph-native queries ----------------
  {
    key: 'supervision_chain', group: 'DA-3 graph traversals',
    title: 'Full chain of command (variable-length path)',
    description: 'Every employee with their level and complete path to the top director. SQL needs CONNECT BY or a recursive CTE.',
    sqlSource: 'comparison',
    sql: `WITH RECURSIVE chain (employee_id, supervisor_id, lvl, path) AS (
  SELECT e.employee_id, e.supervisor_id, 0, CAST(e.employee_id AS VARCHAR2(400))
  FROM EMPLOYEES e WHERE e.supervisor_id IS NULL
  UNION ALL
  SELECT e.employee_id, e.supervisor_id, c.lvl + 1, c.path || ' > ' || e.employee_id
  FROM EMPLOYEES e JOIN chain c ON e.supervisor_id = c.employee_id
)
SELECT * FROM chain ORDER BY lvl;`,
    cypher: `MATCH path = (top:Employee)-[:SUPERVISES*0..]->(e:Employee)
WHERE NOT ()-[:SUPERVISES]->(top)
RETURN e.employee_id AS employee_id, e.first_name + ' ' + e.last_name AS employee, e.job_title AS job_title,
       length(path) AS level,
       [n IN nodes(path) | n.first_name + ' ' + n.last_name] AS chain_of_command, path
ORDER BY level, employee_id`
  },
  {
    key: 'employee_reports', group: 'DA-3 graph traversals',
    title: 'Everyone above one employee, at any depth',
    description: 'Walks SUPERVISES backwards from the chosen employee to the root.',
    sqlSource: 'comparison',
    sql: `SELECT LEVEL, employee_id, job_title FROM EMPLOYEES
START WITH employee_id = :employee_id
CONNECT BY PRIOR supervisor_id = employee_id;`,
    params: ['employee_id'],
    cypher: `MATCH path = (boss:Employee)-[:SUPERVISES*1..]->(e:Employee {employee_id: $employee_id})
RETURN boss.first_name + ' ' + boss.last_name AS supervisor, boss.job_title AS job_title,
       length(path) AS levels_above, path
ORDER BY levels_above`
  },
  {
    key: 'org_footprint', group: 'DA-3 graph traversals',
    title: 'Organization footprint: members, rooms, spaces, payments',
    description: 'Starts from one organization and follows BOOKED_FOR, MADE, BOOKED_IN, CONTAINS and PAID_BY.',
    sqlSource: 'comparison',
    sql: `SELECT o.organization_name, p.first_name || ' ' || p.last_name AS member, r.room_name, s.space_name,
       b.booking_date, pay.amount, pay.method
FROM ORGANIZATIONS o
JOIN BOOKINGS b ON b.organization_id = o.organization_id
JOIN MEMBERS m ON m.member_id = b.member_id
JOIN PERSON p ON p.person_id = m.person_id
JOIN MEETING_ROOMS r ON r.room_id = b.room_id
JOIN COWORKING_SPACES s ON s.space_id = r.space_id
LEFT JOIN PAYMENTS pay ON pay.booking_id = b.booking_id
WHERE o.organization_id = :organization_id;`,
    params: ['organization_id'],
    cypher: `MATCH (o:Organization {organization_id: $organization_id})<-[bf:BOOKED_FOR]-(b:Booking)<-[made:MADE]-(m:Member),
      (b)-[bi:BOOKED_IN]->(r:MeetingRoom)<-[c:CONTAINS]-(s:CoworkingSpace)
OPTIONAL MATCH (b)-[pb:PAID_BY]->(p:Payment)
RETURN o.organization_name AS organization, m.first_name + ' ' + m.last_name AS member,
       r.room_name AS room, s.space_name AS space, b.booking_date AS booking_date,
       p.amount AS amount, p.method AS method,
       [o, b, m, r, s, p] AS graph_nodes, [bf, made, bi, c, pb] AS graph_rels
ORDER BY booking_date, room`
  },
  {
    key: 'org_revenue', group: 'DA-3 graph traversals',
    title: 'Revenue per organization (through bookings to payments)',
    description: 'Aggregates COMPLETED payments reached from each organization.',
    sqlSource: 'comparison',
    sql: `SELECT o.organization_name, o.industry, COUNT(DISTINCT b.booking_id) AS bookings, SUM(p.amount) AS revenue
FROM ORGANIZATIONS o
JOIN BOOKINGS b ON b.organization_id = o.organization_id
JOIN PAYMENTS p ON p.booking_id = b.booking_id AND p.status = 'COMPLETED'
GROUP BY o.organization_name, o.industry
ORDER BY revenue DESC;`,
    cypher: `MATCH (o:Organization)<-[:BOOKED_FOR]-(b:Booking)-[:PAID_BY]->(p:Payment {status: 'COMPLETED'})
RETURN o.organization_name AS organization, o.industry AS industry,
       count(DISTINCT b) AS bookings, sum(p.amount) AS revenue
ORDER BY revenue DESC`
  },
  {
    key: 'member_affiliations', group: 'DA-3 graph traversals',
    title: 'Member to organization affiliations (derived from bookings)',
    description: 'The original schema has no member-organization FK. The link is worked out by following Member-MADE-Booking-BOOKED_FOR-Organization.',
    sqlSource: 'comparison',
    sql: `SELECT m.member_id, p.first_name || ' ' || p.last_name AS member,
       LISTAGG(DISTINCT o.organization_name, ', ') AS organizations, COUNT(*) AS bookings
FROM MEMBERS m JOIN PERSON p ON p.person_id = m.person_id
JOIN BOOKINGS b ON b.member_id = m.member_id
JOIN ORGANIZATIONS o ON o.organization_id = b.organization_id
GROUP BY m.member_id, p.first_name, p.last_name;`,
    cypher: `MATCH (m:Member)-[:MADE]->(b:Booking)-[:BOOKED_FOR]->(o:Organization)
RETURN m.member_id AS member_id, m.first_name + ' ' + m.last_name AS member,
       collect(DISTINCT o.organization_name) AS organizations, count(b) AS bookings
ORDER BY member_id`
  },
  {
    key: 'member_network', group: 'DA-3 graph traversals',
    title: 'Member network: who shares rooms or organizations with a member',
    description: 'A 4-hop pattern: Member -> Booking -> (Room | Organization) <- Booking <- other Member.',
    sqlSource: 'comparison',
    sql: `-- Two self-joins on BOOKINGS (one per shared attribute) combined with UNION
SELECT b2.member_id, 'ROOM' AS via, b1.room_id AS shared FROM BOOKINGS b1
JOIN BOOKINGS b2 ON b1.room_id = b2.room_id AND b2.member_id <> b1.member_id
WHERE b1.member_id = :member_id
UNION
SELECT b2.member_id, 'ORG', b1.organization_id FROM BOOKINGS b1
JOIN BOOKINGS b2 ON b1.organization_id = b2.organization_id AND b2.member_id <> b1.member_id
WHERE b1.member_id = :member_id;`,
    params: ['member_id'],
    cypher: `MATCH path = (me:Member {member_id: $member_id})-[:MADE]->(:Booking)-[:BOOKED_IN|BOOKED_FOR]->(shared)
      <-[:BOOKED_IN|BOOKED_FOR]-(:Booking)<-[:MADE]-(other:Member)
WHERE other <> me
WITH other, collect(DISTINCT shared) AS via, collect(path) AS paths
RETURN other.member_id AS member_id, other.first_name + ' ' + other.last_name AS connected_member,
       [x IN via | labels(x)[0] + ': ' + coalesce(x.room_name, x.organization_name)] AS shared_via,
       size(via) AS connection_strength, paths
ORDER BY connection_strength DESC, member_id`
  },
  {
    key: 'shortest_path', group: 'DA-3 graph traversals',
    title: 'Shortest path between two members',
    description: 'shortestPath() finds how two members are connected through bookings, rooms, spaces and organizations.',
    sqlSource: 'comparison',
    sql: `-- No direct SQL equivalent: needs a recursive CTE across every FK table
-- with cycle detection.`,
    params: ['member_id', 'member_b'],
    cypher: `MATCH (a:Member {member_id: $member_id}), (b:Member {member_id: $member_b})
MATCH p = shortestPath((a)-[:MADE|BOOKED_IN|BOOKED_FOR|CONTAINS*..12]-(b))
RETURN length(p) AS hops,
       [n IN nodes(p) | labels(n)[-1] + ': ' + coalesce(n.first_name + ' ' + n.last_name, n.room_name,
                         n.space_name, n.organization_name, 'Booking #' + toString(n.booking_id))] AS route, p`
  },
  {
    key: 'room_recommendation', group: 'DA-3 graph traversals',
    title: 'Room recommendation: free, large enough, optional facility category',
    description: 'Free in the slot (same overlap rule), AVAILABLE, capacity >= minimum, optionally having a facility in a DA-3 category; ranked by past bookings.',
    sqlSource: 'comparison',
    sql: `SELECT r.room_id, r.room_name, s.space_name, r.capacity, r.hourly_rate,
       (SELECT COUNT(*) FROM BOOKINGS x WHERE x.room_id = r.room_id) AS popularity
FROM MEETING_ROOMS r JOIN COWORKING_SPACES s ON s.space_id = r.space_id
WHERE r.status = 'AVAILABLE' AND r.capacity >= :min_capacity
  AND NOT EXISTS (SELECT 1 FROM BOOKINGS b WHERE b.room_id = r.room_id AND b.booking_date = :d
                  AND b.status = 'CONFIRMED' AND :start < b.end_time AND :end > b.start_time)
ORDER BY popularity DESC, r.hourly_rate;`,
    params: ['date', 'start_time', 'end_time', 'min_capacity', 'category'],
    cypher: `MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom {status: 'AVAILABLE'})
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
ORDER BY popularity DESC, hourly_rate ASC`
  },
  {
    key: 'rooms_by_category', group: 'DA-3 facility categories (enhancement)',
    title: 'Rooms offering a facility category',
    description: 'DA-3 enhancement: FacilityCategory nodes group the original facility rows.',
    sqlSource: 'comparison',
    sql: `-- Would need a new FACILITY_CATEGORY table plus a junction table in Oracle.`,
    params: ['category'],
    cypher: `MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom)-[:HAS_FACILITY]->(f:Facility)-[:IN_CATEGORY]->(c:FacilityCategory)
WHERE $category = '' OR c.name = $category
RETURN c.name AS category, r.room_name AS room_name, s.space_name AS space_name,
       collect(f.facility_name) AS matching_facilities
ORDER BY category, room_name`
  },
  {
    key: 'similar_rooms', group: 'DA-3 facility categories (enhancement)',
    title: 'Rooms similar to a room (shared facility categories)',
    description: 'Ranks other rooms by the number of facility categories they share with the chosen room.',
    sqlSource: 'comparison',
    sql: `-- Requires the category tables and a self-join through them.`,
    params: ['room_id'],
    cypher: `MATCH (r:MeetingRoom {room_id: $room_id})-[:HAS_FACILITY]->(:Facility)-[:IN_CATEGORY]->(c:FacilityCategory)
      <-[:IN_CATEGORY]-(:Facility)<-[:HAS_FACILITY]-(other:MeetingRoom)
WHERE other <> r
RETURN other.room_id AS room_id, other.room_name AS similar_room, other.room_type AS room_type,
       collect(DISTINCT c.name) AS shared_categories, count(DISTINCT c) AS similarity
ORDER BY similarity DESC, room_id`
  },
  {
    key: 'category_coverage', group: 'DA-3 facility categories (enhancement)',
    title: 'Facility category coverage across spaces',
    description: 'How many rooms and spaces offer each DA-3 category.',
    sqlSource: 'comparison',
    sql: `-- Requires the category tables.`,
    cypher: `MATCH (c:FacilityCategory)
OPTIONAL MATCH (c)<-[:IN_CATEGORY]-(:Facility)<-[:HAS_FACILITY]-(r:MeetingRoom)<-[:CONTAINS]-(s:CoworkingSpace)
RETURN c.name AS category, c.description AS description,
       count(DISTINCT r) AS rooms, count(DISTINCT s) AS spaces, collect(DISTINCT s.space_name) AS space_names
ORDER BY rooms DESC, category`
  },
  {
    key: 'space_graph', group: 'DA-3 graph traversals',
    title: 'Graph of one coworking space (for the visualizer)',
    description: 'Returns one space with its rooms, facilities and the bookings on a date, as a subgraph.',
    sqlSource: 'comparison',
    sql: `-- A relational database returns rows, not a connected subgraph.`,
    params: ['space_id', 'date'],
    cypher: `MATCH (s:CoworkingSpace {space_id: $space_id})-[c:CONTAINS]->(r:MeetingRoom)
OPTIONAL MATCH (r)-[hf:HAS_FACILITY]->(f:Facility)
OPTIONAL MATCH (m:Member)-[made:MADE]->(b:Booking {booking_date: $date})-[bi:BOOKED_IN]->(r)
RETURN s, c, r, collect(DISTINCT [hf, f]) AS facilities, collect(DISTINCT [m, made, b, bi]) AS bookings`
  }
];

const BY_KEY = new Map(DEMOS.map(d => [d.key, d]));

function todayLocal() {
  const d = new Date();
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function describe(demo) {
  return {
    key: demo.key, group: demo.group, title: demo.title, description: demo.description,
    sqlSource: demo.sqlSource, sql: demo.sql, cypher: demo.cypher,
    params: (demo.params || []).map(name => ({
      name, ...P[name], default: P[name].default === 'today' ? todayLocal() : P[name].default
    }))
  };
}

// Validates user-supplied values and converts them to Cypher parameter types.
function buildParams(demo, input = {}) {
  const c = new Checker();
  const params = {};
  for (const name of demo.params || []) {
    const def = P[name];
    const raw = input[name] === undefined || input[name] === '' ? (def.default === 'today' ? todayLocal() : def.default) : input[name];
    let v;
    switch (def.type) {
      case 'id': v = c.id(raw, def.label); params[name] = v === null ? null : db.int(v); break;
      case 'int': v = c.num(raw, def.label, { integer: true, min: 0, max: 100000 }); params[name] = v === null ? null : db.int(v); break;
      case 'number': params[name] = c.num(raw, def.label, { min: 0, minExclusive: true, max: 24 }); break;
      case 'date': params[name] = c.date(raw, def.label, { required: true }); break;
      case 'time': params[name] = c.time(raw, def.label, { required: true }); break;
      case 'category': params[name] = c.str(raw, def.label, { max: 100 }) ?? ''; break;
      default: throw new Error(`Unknown parameter type ${def.type}`);
    }
  }
  if (params.start_time && params.end_time && params.end_time <= params.start_time) c.fail('End time must be after start time');
  c.done();
  return params;
}

module.exports = { DEMOS, BY_KEY, describe, buildParams, PARAM_TYPES: P };
