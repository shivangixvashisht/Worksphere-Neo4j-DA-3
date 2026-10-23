// Booking rules: TRG_CHECK_ROOM_OVERLAP and SP_CREATE_BOOKING_AND_PAY semantics on Neo4j.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, db, reseed, today, addDays } = require('./helpers');

test.before(reseed);
test.after(() => db.close());

// Seeded today: room 301 is booked 10:00-12:00 (5001) and 14:00-16:00 (5002).
const base = { member_id: 1002, room_id: 301, booking_date: today, total_amount: 1200 };

test('each of the three trigger overlap conditions is rejected with 409', async () => {
  for (const [s, e] of [['11:00', '13:00'], ['09:00', '11:00'], ['09:00', '17:00'], ['10:00', '12:00'], ['10:30', '11:30']]) {
    const res = await api().post('/api/bookings').send({ ...base, start_time: s, end_time: e }).expect(409);
    assert.match(res.body.error, /CONFLICT/);
  }
});

test('adjacent slots are allowed (end == start is not an overlap)', async () => {
  const res = await api().post('/api/bookings').send({ ...base, start_time: '12:00', end_time: '14:00', payment_method: 'UPI' }).expect(201);
  assert.equal(res.body.booking_id, 5022);                                 // SEQ_BOOKINGS
  assert.equal(res.body.payment_id, 8022);                                 // SEQ_PAYMENTS
  const g = await db.read(`
    MATCH (m:Member)-[:MADE]->(b:Booking {booking_id: 5022})-[:BOOKED_IN]->(r:MeetingRoom), (b)-[:PAID_BY]->(p:Payment)
    OPTIONAL MATCH (b)-[:BOOKED_FOR]->(o)
    RETURN m.member_id AS m, r.room_id AS r, b.status AS st, p.amount AS amt, p.method AS method, p.status AS pst, o AS org`);
  assert.deepEqual(g.rows[0], { m: 1002, r: 301, st: 'CONFIRMED', amt: 1200, method: 'UPI', pst: 'COMPLETED', org: null });
});

test('cancelled bookings do not block a slot; re-confirming re-checks the overlap', async () => {
  await api().put('/api/bookings/5002').send({ status: 'CANCELLED' }).expect(200);
  await api().post('/api/bookings').send({ ...base, start_time: '14:00', end_time: '15:00', organization_id: 503 }).expect(201);
  const res = await api().put('/api/bookings/5002').send({ status: 'CONFIRMED' }).expect(409);
  assert.match(res.body.error, /CONFLICT/);
  const st = await db.read('MATCH (b:Booking {booking_id: 5002}) RETURN b.status AS s');
  assert.equal(st.rows[0].s, 'CANCELLED');                                 // rolled back
});

test('moving a booking onto an occupied slot is rejected; onto a free slot it succeeds', async () => {
  await api().put('/api/bookings/5016').send({ booking_date: today, start_time: '10:00', end_time: '11:00' }).expect(409);
  await api().put('/api/bookings/5016').send({ booking_date: addDays(today, 5), start_time: '10:00', end_time: '11:00' }).expect(200);
  await api().put('/api/bookings/5016').send({}).expect(400);
  await api().put('/api/bookings/999999').send({ status: 'CANCELLED' }).expect(404);
});

test('validation: required fields, formats, FK existence, payment amount', async () => {
  const r = await api().post('/api/bookings').send({}).expect(400);
  assert.ok(r.body.details.length >= 5);
  await api().post('/api/bookings').send({ ...base, start_time: '15:00', end_time: '14:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, start_time: '7:00', end_time: '08:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, member_id: 4242, start_time: '18:00', end_time: '19:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, room_id: 4242, start_time: '18:00', end_time: '19:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, organization_id: 4242, start_time: '18:00', end_time: '19:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, total_amount: 0, payment_method: 'UPI', start_time: '18:00', end_time: '19:00' }).expect(400);
  await api().post('/api/bookings').send({ ...base, payment_method: 'Bitcoin', start_time: '18:00', end_time: '19:00' }).expect(400);
});

test('failed bookings leave no partial data and do not consume sequence values', async () => {
  const before = await db.read("MATCH (s:Sequence) WHERE s.name IN ['SEQ_BOOKINGS','SEQ_PAYMENTS'] RETURN s.name AS n, s.next AS v ORDER BY n");
  await api().post('/api/bookings').send({ ...base, start_time: '10:00', end_time: '11:00', payment_method: 'UPI' }).expect(409);
  const after = await db.read("MATCH (s:Sequence) WHERE s.name IN ['SEQ_BOOKINGS','SEQ_PAYMENTS'] RETURN s.name AS n, s.next AS v ORDER BY n");
  assert.deepEqual(after.rows, before.rows);
});

test('concurrent requests for the same slot: exactly one succeeds (room write-lock)', async () => {
  const slot = { ...base, booking_date: addDays(today, 10), start_time: '09:00', end_time: '10:00' };
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    api().post('/api/bookings').send({ ...slot, member_id: 1001 + (i % 8) })));
  const codes = results.map(r => r.status).sort();
  assert.equal(codes.filter(c => c === 201).length, 1, `status codes: ${codes}`);
  assert.equal(codes.filter(c => c === 409).length, 7, `status codes: ${codes}`);
  const n = await db.read('MATCH (b:Booking {booking_date: $d, start_time: "09:00"})-[:BOOKED_IN]->(:MeetingRoom {room_id: 301}) RETURN count(b) AS c', { d: slot.booking_date });
  assert.equal(n.rows[0].c, 1);
});

test('FN_CALC_BOOKING_AMOUNT returns rate * hours, and 0 for an unknown room', async () => {
  assert.equal((await api().get('/api/bookings/calc-amount?room_id=305&hours=3').expect(200)).body.amount, 7500);
  assert.equal((await api().get('/api/bookings/calc-amount?room_id=4242&hours=3').expect(200)).body.amount, 0);
});

test('DELETE booking cascades to its payment', async () => {
  const res = await api().delete('/api/bookings/5003').expect(200);
  assert.equal(res.body.counters.nodesDeleted, 2);
  const p = await db.read('MATCH (p:Payment {payment_id: 8003}) RETURN count(p) AS c');
  assert.equal(p.rows[0].c, 0);
});
