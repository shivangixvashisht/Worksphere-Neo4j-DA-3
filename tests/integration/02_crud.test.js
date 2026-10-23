// CRUD routes against the real database, including cascades, FKs, sequences and constraints.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, db, reseed } = require('./helpers');

test.before(reseed);
test.after(() => db.close());

test('GET routes return the original Oracle-style uppercase columns', async () => {
  const rooms = await api().get('/api/rooms').expect(200);
  assert.equal(rooms.body.data.length, 14);
  const kaveri = rooms.body.data.find(r => r.ROOM_ID === 301);
  assert.equal(kaveri.SPACE_NAME, 'Nexus WorkHub - Guindy');
  assert.deepEqual(kaveri.FACILITIES, ['Sony 4K HDR Smart Display 75-inch', 'Polycom Studio Video Bar & Mic Array', 'Magnetic Glass Whiteboard']);
  const members = await api().get('/api/members').expect(200);
  assert.equal(members.body.data[0].PLAN_NAME, 'Dedicated Resident Desk');
  const h = await api().get('/api/employees/hierarchy').expect(200);
  assert.equal(h.body.data[0].SUPERVISOR_NAME, 'TOP-LEVEL DIRECTOR');  // NULLS FIRST
  assert.ok(Array.isArray(rooms.body.cypher));
});

test('space create uses SEQ_SPACES (next id 105) and validates NOT NULL', async () => {
  const res = await api().post('/api/spaces').send({ space_name: 'DA3 Test Hub', city: 'Chennai' }).expect(201);
  assert.equal(res.body.id, 105);
  const bad = await api().post('/api/spaces').send({ space_name: '' }).expect(400);
  assert.match(bad.body.error, /Space name is required.*City is required/);
});

test('room create/update/delete with CHECK and FK rules', async () => {
  await api().post('/api/rooms').send({ space_id: 101, room_name: 'X', room_type: 'Kitchen', capacity: 0, hourly_rate: -1 })
    .expect(400).then(r => assert.equal(r.body.details.length, 3));
  await api().post('/api/rooms').send({ space_id: 999, room_name: 'X', room_type: 'Meeting Pod', capacity: 2, hourly_rate: 100 }).expect(400);
  const created = await api().post('/api/rooms').send({ space_id: 101, room_name: 'DA3 Pod', room_type: 'Meeting Pod', capacity: 3, hourly_rate: 199.999 }).expect(201);
  assert.equal(created.body.id, 315);                                     // SEQ_ROOMS restart value
  await api().put('/api/rooms/315').send({ space_id: 102, room_name: 'DA3 Pod v2', room_type: 'Meeting Pod', capacity: 4, hourly_rate: 250, status: 'MAINTENANCE' }).expect(200);
  const r = await db.read('MATCH (s:CoworkingSpace)-[:CONTAINS]->(r:MeetingRoom {room_id: 315}) RETURN s.space_id AS s, r.status AS st, count(*) AS links');
  assert.deepEqual(r.rows[0], { s: 102, st: 'MAINTENANCE', links: 1 });  // moved, not duplicated
  await api().put('/api/rooms/999').send({ space_id: 101, room_name: 'n', room_type: 'Meeting Pod', capacity: 1, hourly_rate: 1 }).expect(404);
  await api().delete('/api/rooms/315').expect(200);
  await api().delete('/api/rooms/315').expect(404);
});

test('deleting a room cascades to facilities, bookings and payments', async () => {
  const res = await api().delete('/api/rooms/301').expect(200);
  // room 301: 3 facilities, 5 bookings (5001, 5002, 5010, 5016, 5020) each with one payment
  assert.equal(res.body.counters.nodesDeleted, 1 + 3 + 5 + 5);
  const left = await db.read('MATCH (b:Booking) WHERE b.booking_id IN [5001, 5002, 5010, 5016, 5020] RETURN count(b) AS c');
  assert.equal(left.rows[0].c, 0);
});

test('member insert creates one :Person:Member node; email UNIQUE -> 409', async () => {
  const res = await api().post('/api/members').send({ first_name: 'Test', last_name: 'User', email: 'test.user@da3.dev', plan_id: 204 }).expect(201);
  assert.equal(res.body.id, 1009);                                          // SEQ_MEMBERS
  const n = await db.read(`MATCH (p:Person:Member {member_id: 1009})-[:HAS_PLAN]->(pl) RETURN p.person_id AS pid, p.status AS st,
                                  p.state AS state, p.city AS city, pl.plan_id AS plan`);
  assert.deepEqual(n.rows[0], { pid: 7015, st: 'ACTIVE', state: 'Tamil Nadu', city: 'Chennai', plan: 204 });
  const dup = await api().post('/api/members').send({ first_name: 'A', last_name: 'B', email: 'arjun.mehta@worksphere.io' }).expect(409);
  assert.match(dup.body.error, /already exists/);
  await api().post('/api/members').send({ first_name: 'A', last_name: 'B', email: 'a@b.co', plan_id: 999 }).expect(400);
  await api().post('/api/members').send({ first_name: 'A', last_name: 'B', email: 'a@b.co', status: 'GONE' }).expect(400);
});

test('member update changes plan (ON DELETE SET NULL semantics when cleared) and keeps status', async () => {
  await api().put('/api/members/1009').send({ first_name: 'Tess', last_name: 'User', email: 'test.user@da3.dev', plan_id: null }).expect(200);
  const n = await db.read('MATCH (p:Member {member_id: 1009}) OPTIONAL MATCH (p)-[:HAS_PLAN]->(pl) RETURN p.first_name AS f, p.status AS st, pl AS plan');
  assert.deepEqual(n.rows[0], { f: 'Tess', st: 'ACTIVE', plan: null });
  await api().put('/api/members/4242').send({ first_name: 'x', last_name: 'y', email: 'x@y.zz' }).expect(404);
});

test('deleting a member cascades to bookings and payments', async () => {
  const res = await api().delete('/api/members/1004').expect(200);
  // member 1004 made bookings 5004 and 5013, each with one payment
  assert.equal(res.body.counters.nodesDeleted, 1 + 2 + 2);
});

test('payments: create requires an existing booking, amount > 0 and a valid method', async () => {
  await api().post('/api/payments').send({ booking_id: 5005, amount: 0, method: 'Bitcoin' }).expect(400)
    .then(r => assert.equal(r.body.details.length, 2));
  await api().post('/api/payments').send({ booking_id: 1, amount: 10, method: 'UPI' }).expect(400);
  const ok = await api().post('/api/payments').send({ booking_id: 5005, amount: 100, method: 'Cash', status: 'PENDING' }).expect(201);
  assert.equal(ok.body.id, 8022);                                         // SEQ_PAYMENTS
  await api().delete('/api/payments/8022').expect(200);
  await api().delete('/api/payments/8022').expect(404);
});

test('deleting a space cascades through rooms to facilities, bookings and payments', async () => {
  // From seed_oracle.sql: space 104 has rooms 312-314, facilities 418-420,
  // bookings 5009 & 5019 (room 312) and 5015 (room 313), each with one payment.
  const res = await api().delete('/api/spaces/104').expect(200);
  assert.equal(res.body.counters.nodesDeleted, 1 + 3 + 3 + 3 + 3);
  const orphans = await db.read('MATCH (r:MeetingRoom) WHERE NOT ()-[:CONTAINS]->(r) RETURN count(r) AS c');
  assert.equal(orphans.rows[0].c, 0);
});

test('stats reflect the live graph', async () => {
  const res = await api().get('/api/stats').expect(200);
  assert.equal(res.body.stats.totalSpaces, 4);   // 4 seeded + 1 created - 1 deleted
  assert.ok(res.body.stats.totalRevenue > 0);
});

test('invalid ids and unknown API routes', async () => {
  await api().delete('/api/rooms/abc').expect(400);
  await api().delete("/api/rooms/1 OR 1=1").expect(400);
  await api().get('/api/nope').expect(404);
});
