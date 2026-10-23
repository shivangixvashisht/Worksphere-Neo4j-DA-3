const express = require('express');
const router = express.Router();
const { db, upperKeys, asyncRoute } = require('../services/common');
const { Checker, parseId, AppError, BOOKING_STATUSES, PAYMENT_METHODS } = require('../validation');
const rules = require('../services/bookingRules');

// GET all bookings with details (the original needed a 6-table JOIN)
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (m:Member)-[:MADE]->(b:Booking)-[:BOOKED_IN]->(r:MeetingRoom)<-[:CONTAINS]-(s:CoworkingSpace)
    OPTIONAL MATCH (b)-[:BOOKED_FOR]->(o:Organization)
    RETURN b.booking_id AS booking_id, b.booking_date AS booking_date, b.start_time AS start_time,
           b.end_time AS end_time, b.total_amount AS total_amount, b.status AS status,
           m.member_id AS member_id, m.first_name + ' ' + m.last_name AS member_name, m.email AS email,
           r.room_id AS room_id, r.room_name AS room_name, r.hourly_rate AS hourly_rate,
           s.space_name AS space_name,
           o.organization_id AS organization_id, o.organization_name AS org_name
    ORDER BY booking_id DESC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

// POST create booking (+ payment when a method is given) - one atomic transaction
router.post('/', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const c = new Checker();
  const b = {
    member_id: c.id(body.member_id, 'Member'),
    room_id: c.id(body.room_id, 'Room'),
    organization_id: c.id(body.organization_id ?? body.org_id, 'Organization', { required: false }),
    booking_date: c.date(body.booking_date, 'Booking date', { required: true }),
    start_time: c.time(body.start_time, 'Start time', { required: true }),
    end_time: c.time(body.end_time, 'End time', { required: true }),
    total_amount: c.num(body.total_amount ?? 0, 'Total amount', { min: 0, max: 99999999.99 }), // chk_booking_amount, NUMBER(10,2)
    method: c.oneOf(body.method ?? body.payment_method, 'Payment method', PAYMENT_METHODS)       // chk_payment_method
  };
  if (b.start_time && b.end_time && b.end_time <= b.start_time) c.fail('End time must be after start time');
  if (b.method && b.total_amount !== null && b.total_amount <= 0) c.fail('Payment amount must be greater than 0'); // chk_payment_amount
  c.done();

  const { value, executed } = await rules.createBookingAndPay(b);
  res.status(201).json({
    success: true,
    message: `Booking #${value.booking_id} confirmed successfully in Neo4j!` + (value.payment_id ? ` Payment #${value.payment_id} recorded.` : ''),
    booking_id: value.booking_id, payment_id: value.payment_id, cypher: executed
  });
}));

// PUT update booking (status / date / time). The overlap rule runs whenever the resulting
// status is CONFIRMED, as TRG_CHECK_ROOM_OVERLAP did on UPDATE.
router.put('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'booking_id');
  const body = req.body || {};
  const c = new Checker();
  const changes = {
    status: c.oneOf(body.status, 'Status', BOOKING_STATUSES),
    booking_date: c.date(body.booking_date, 'Booking date'),
    start_time: c.time(body.start_time, 'Start time'),
    end_time: c.time(body.end_time, 'End time')
  };
  c.done();
  if (Object.values(changes).every(v => v === null)) throw new AppError(400, 'No fields provided to update.');

  const { executed } = await db.writeTransaction(async run => {
    const current = await run(`
      MATCH (b:Booking {booking_id: $id})-[:BOOKED_IN]->(r:MeetingRoom)
      RETURN r.room_id AS room_id, b.booking_date AS booking_date, b.start_time AS start_time,
             b.end_time AS end_time, b.status AS status`, { id: db.int(id) });
    if (!current.rows.length) throw new AppError(404, `Booking #${id} not found`);
    const merged = { ...current.rows[0] };
    for (const [k, v] of Object.entries(changes)) if (v !== null) merged[k] = v;
    if (merged.end_time <= merged.start_time) throw new AppError(400, 'End time must be after start time');
    if (merged.status === 'CONFIRMED') {
      await rules.lockRoom(run, merged.room_id);
      await rules.assertNoOverlap(run, { ...merged, exclude_id: id });
    }
    await run(`
      MATCH (b:Booking {booking_id: $id})
      SET b.status = $status, b.booking_date = $booking_date, b.start_time = $start_time, b.end_time = $end_time`,
      { id: db.int(id), status: merged.status, booking_date: merged.booking_date, start_time: merged.start_time, end_time: merged.end_time });
  });
  res.json({ success: true, message: 'Booking updated successfully!', cypher: executed });
}));

// DELETE booking - ON DELETE CASCADE to PAYMENTS
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'booking_id');
  const result = await db.write(`
    MATCH (b:Booking {booking_id: $id})
    OPTIONAL MATCH (b)-[:PAID_BY]->(p:Payment)
    WITH b, collect(p) AS payments
    FOREACH (p IN payments | DETACH DELETE p)
    DETACH DELETE b
    RETURN size(payments) AS cascaded`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Booking #${id} not found`);
  res.json({ success: true, message: 'Booking deleted successfully!', counters: result.counters, cypher: [result.cypher] });
}));

// FN_CALC_BOOKING_AMOUNT(p_room_id, p_hours)
router.get('/calc-amount', asyncRoute(async (req, res) => {
  const c = new Checker();
  const room_id = c.id(req.query.room_id, 'room_id');
  const hours = c.num(req.query.hours, 'hours', { required: true, min: 0, minExclusive: true, max: 24 });
  c.done();
  const result = await db.read(rules.CALC_AMOUNT_CYPHER, { room_id: db.int(room_id), hours });
  // The PL/SQL function returned 0 when the room did not exist (NO_DATA_FOUND)
  res.json({ success: true, amount: result.rows[0]?.amount ?? 0, cypher: [result.cypher] });
}));

module.exports = router;
