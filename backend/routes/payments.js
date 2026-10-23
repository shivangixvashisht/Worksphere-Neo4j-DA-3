const express = require('express');
const router = express.Router();
const { db, upperKeys, nextId, asyncRoute } = require('../services/common');
const { Checker, parseId, AppError, PAYMENT_METHODS, PAYMENT_STATUSES } = require('../validation');

// GET all payments (the original needed a 5-table JOIN)
router.get('/', asyncRoute(async (req, res) => {
  const result = await db.read(`
    MATCH (m:Member)-[:MADE]->(b:Booking)-[:PAID_BY]->(p:Payment),
          (b)-[:BOOKED_IN]->(r:MeetingRoom)
    RETURN p.payment_id AS payment_id, b.booking_id AS booking_id, p.amount AS amount,
           toString(p.payment_date) AS payment_date, p.method AS payment_method, p.method AS method, p.status AS status,
           b.booking_date AS booking_date, b.start_time AS start_time, b.end_time AS end_time,
           m.first_name + ' ' + m.last_name AS member_name, r.room_name AS room_name
    ORDER BY payment_id DESC`);
  res.json({ success: true, data: upperKeys(result.rows), cypher: [result.cypher] });
}));

// POST add payment
router.post('/', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const c = new Checker();
  const p = {
    booking_id: c.id(body.booking_id, 'Booking'),                                                        // NOT NULL FK
    amount: c.num(body.amount, 'Amount', { required: true, min: 0, minExclusive: true, max: 99999999.99 }), // chk_payment_amount
    method: c.oneOf(body.method ?? body.payment_method, 'Payment method', PAYMENT_METHODS, { required: true }),
    status: c.oneOf(body.status, 'Status', PAYMENT_STATUSES, { fallback: 'COMPLETED' })
  };
  c.done();
  const { value, executed } = await db.writeTransaction(async run => {
    const booking = await run('MATCH (b:Booking {booking_id: $id}) RETURN b.booking_id AS id', { id: db.int(p.booking_id) });
    if (!booking.rows.length) throw new AppError(400, `Booking #${p.booking_id} does not exist`); // fk_payment_booking
    const payment_id = await nextId(run, 'SEQ_PAYMENTS');
    await run(`
      MATCH (b:Booking {booking_id: $booking_id})
      CREATE (p:Payment {payment_id: $payment_id, amount: $amount, payment_date: date(), method: $method, status: $status})
      CREATE (b)-[:PAID_BY]->(p)`,
      { ...p, booking_id: db.int(p.booking_id), payment_id: db.int(payment_id) });
    return payment_id;
  });
  res.status(201).json({ success: true, message: 'Payment recorded successfully!', id: value, cypher: executed });
}));

// DELETE payment
router.delete('/:id', asyncRoute(async (req, res) => {
  const id = parseId(req.params.id, 'payment_id');
  const result = await db.write(`
    MATCH (p:Payment {payment_id: $id})
    DETACH DELETE p
    RETURN $id AS payment_id`, { id: db.int(id) });
  if (!result.rows.length) throw new AppError(404, `Payment #${id} not found`);
  res.json({ success: true, message: 'Payment record deleted successfully!', cypher: [result.cypher] });
}));

module.exports = router;
