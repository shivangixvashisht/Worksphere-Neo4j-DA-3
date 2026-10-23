// Verifies the real Neo4j connection and that the seed reproduces seed_oracle.sql.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, db, reseed, today, addDays } = require('./helpers');

test.before(reseed);
test.after(() => db.close());

test('health endpoint reports a live Neo4j server', async () => {
  const res = await api().get('/api/health').expect(200);
  assert.equal(res.body.status, 'UP');
  assert.match(res.body.database, /^Neo4j 5\.\d+/);
  assert.match(res.body.agent, /^Neo4j\//);
  assert.ok(res.body.nodeCount > 100);
});

test('node and relationship counts equal the original Oracle seed rows', async () => {
  const labels = await db.read('MATCH (n) UNWIND labels(n) AS l RETURN l, count(*) AS c');
  const byLabel = Object.fromEntries(labels.rows.map(r => [r.l, r.c]));
  assert.deepEqual(byLabel, {
    CoworkingSpace: 4, MembershipPlan: 4, Organization: 5, Person: 14, Member: 8, Employee: 6,
    MeetingRoom: 14, Facility: 20, Booking: 21, Payment: 21, Sequence: 10, FacilityCategory: 8
  });
  const rels = await db.read('MATCH ()-[r]->() RETURN type(r) AS t, count(*) AS c');
  const byType = Object.fromEntries(rels.rows.map(r => [r.t, r.c]));
  assert.deepEqual(byType, {
    HAS_PLAN: 8, SUPERVISES: 5, CONTAINS: 14, HAS_FACILITY: 20,
    MADE: 21, BOOKED_IN: 21, BOOKED_FOR: 21, PAID_BY: 21, IN_CATEGORY: 25
  });
});

test('Person subclasses are disjoint (no node is both :Member and :Employee)', async () => {
  const r = await db.read('MATCH (p:Member:Employee) RETURN count(p) AS c');
  assert.equal(r.rows[0].c, 0);
});

test('sample values match seed_oracle.sql exactly', async () => {
  const b = await db.read(`
    MATCH (m:Member)-[:MADE]->(b:Booking {booking_id: 5006})-[:BOOKED_IN]->(r:MeetingRoom),
          (b)-[:BOOKED_FOR]->(o:Organization), (b)-[:PAID_BY]->(p:Payment)
    RETURN m.member_id AS member, r.room_id AS room, o.organization_id AS org, b.booking_date AS d,
           b.start_time AS s, b.end_time AS e, b.total_amount AS amt, p.payment_id AS pay, p.method AS method`);
  // 5006: member 1003, room 305, org 502, TODAY 14:00-17:00, 7500.00, payment 8006 Net Banking
  assert.deepEqual(b.rows[0], { member: 1003, room: 305, org: 502, d: today, s: '14:00', e: '17:00', amt: 7500, pay: 8006, method: 'Net Banking' });

  const y = await db.read('MATCH (b:Booking {booking_id: 5018}) RETURN b.booking_date AS d');
  assert.equal(y.rows[0].d, addDays(today, -1));       // TO_CHAR(SYSDATE - 1, ...)
  const p = await db.read('MATCH (p:Person {person_id: 7002}) RETURN p.middle_name AS mid, p.email AS email');
  assert.deepEqual(p.rows[0], { mid: null, email: 'aditya.rao@quantixai.com' }); // NULL middle_name
  const sup = await db.read('MATCH (b:Employee)-[:SUPERVISES]->(e:Employee {employee_id: 9005}) RETURN b.employee_id AS boss');
  assert.equal(sup.rows[0].boss, 9002);
  const rev = await db.read("MATCH (p:Payment {status: 'COMPLETED'}) RETURN sum(p.amount) AS total");
  assert.equal(rev.rows[0].total, 78550);              // sum of all 21 seeded PAYMENTS.amount
});

test('uniqueness constraints exist for every original primary key', async () => {
  const r = await db.read("SHOW CONSTRAINTS YIELD name, type WHERE type = 'UNIQUENESS' RETURN collect(name) AS names");
  for (const name of ['person_id_unique', 'person_email_unique', 'member_id_unique', 'employee_id_unique', 'plan_id_unique',
    'space_id_unique', 'room_id_unique', 'facility_id_unique', 'organization_id_unique', 'booking_id_unique', 'payment_id_unique']) {
    assert.ok(r.rows[0].names.includes(name), name);
  }
});

test('DA-3 categories link only to original facility rows and are marked as an enhancement', async () => {
  const r = await db.read(`
    MATCH (f:Facility)-[rel:IN_CATEGORY]->(c:FacilityCategory)
    RETURN count(DISTINCT f) AS facilities, collect(DISTINCT rel.source) AS sources, collect(DISTINCT c.source) AS catSources`);
  assert.deepEqual(r.rows[0], { facilities: 20, sources: ['DA-3 classification'], catSources: ['DA-3 enhancement'] });
});
