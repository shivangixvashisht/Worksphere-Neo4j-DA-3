// ====================================================================
// Booking business rules - Neo4j replacement for the original PL/SQL:
//   TRG_CHECK_ROOM_OVERLAP     -> OVERLAP_CYPHER, checked inside the write transaction
//   SP_CREATE_BOOKING_AND_PAY  -> createBookingAndPay(): booking + payment in ONE transaction
//   FN_CALC_BOOKING_AMOUNT     -> CALC_AMOUNT_CYPHER
//   FN_ROOM_TOTAL_REVENUE      -> ROOM_REVENUE_CYPHER
// ====================================================================
const { db, nextId } = require('./common');
const { AppError } = require('../validation');

// Takes a write lock on the room node (SET + REMOVE of a temporary property) so that two
// concurrent bookings for the same room are serialised: the second transaction waits,
// then sees the first booking when it runs the overlap check.
const LOCK_ROOM_CYPHER = `
MATCH (r:MeetingRoom {room_id: $room_id})
SET r._lock = true
REMOVE r._lock
RETURN r.room_id AS room_id, r.hourly_rate AS hourly_rate`;

// Same three overlap conditions as TRG_CHECK_ROOM_OVERLAP (string comparison of 'HH:MM').
const OVERLAP_CYPHER = `
MATCH (b:Booking {booking_date: $booking_date, status: 'CONFIRMED'})-[:BOOKED_IN]->(:MeetingRoom {room_id: $room_id})
WHERE ($exclude_id IS NULL OR b.booking_id <> $exclude_id)
  AND (($start_time >= b.start_time AND $start_time < b.end_time)
    OR ($end_time > b.start_time AND $end_time <= b.end_time)
    OR ($start_time <= b.start_time AND $end_time >= b.end_time))
RETURN b.booking_id AS booking_id, b.start_time AS start_time, b.end_time AS end_time`;

const CALC_AMOUNT_CYPHER = `
MATCH (r:MeetingRoom {room_id: $room_id})
RETURN r.hourly_rate * $hours AS amount`;

const ROOM_REVENUE_CYPHER = `
MATCH (r:MeetingRoom {room_id: $room_id})
OPTIONAL MATCH (b:Booking {status: 'CONFIRMED'})-[:BOOKED_IN]->(r)
RETURN r.room_name AS room_name, coalesce(sum(b.total_amount), 0) AS total_revenue`;

const CONFLICT_MESSAGE = 'CONFLICT (Overlap check): This meeting room is already booked for this date and time slot!';

async function assertNoOverlap(run, { room_id, booking_date, start_time, end_time, exclude_id = null }) {
  const overlap = await run(OVERLAP_CYPHER, {
    room_id: db.int(room_id), booking_date, start_time, end_time,
    exclude_id: exclude_id === null ? null : db.int(exclude_id)
  });
  if (overlap.rows.length) {
    const clash = overlap.rows[0];
    throw new AppError(409, `${CONFLICT_MESSAGE} (clashes with booking #${clash.booking_id}, ${clash.start_time}-${clash.end_time})`);
  }
}

async function lockRoom(run, roomId) {
  const room = await run(LOCK_ROOM_CYPHER, { room_id: db.int(roomId) });
  if (!room.rows.length) throw new AppError(400, `Meeting room #${roomId} does not exist`); // fk_booking_room
  return room.rows[0];
}

// Booking + optional payment, atomically (SP_CREATE_BOOKING_AND_PAY semantics).
async function createBookingAndPay(b) {
  return db.writeTransaction(async run => {
    await lockRoom(run, b.room_id);
    const member = await run('MATCH (m:Member {member_id: $id}) RETURN m.member_id AS id', { id: db.int(b.member_id) });
    if (!member.rows.length) throw new AppError(400, `Member #${b.member_id} does not exist`); // fk_booking_member
    if (b.organization_id !== null) {
      const org = await run('MATCH (o:Organization {organization_id: $id}) RETURN o.organization_id AS id', { id: db.int(b.organization_id) });
      if (!org.rows.length) throw new AppError(400, `Organization #${b.organization_id} does not exist`); // fk_booking_org
    }
    await assertNoOverlap(run, b);

    const booking_id = await nextId(run, 'SEQ_BOOKINGS');
    await run(`
      MATCH (m:Member {member_id: $member_id}), (r:MeetingRoom {room_id: $room_id})
      CREATE (b:Booking {booking_id: $booking_id, booking_date: $booking_date, start_time: $start_time,
                         end_time: $end_time, total_amount: $total_amount, status: 'CONFIRMED', created_at: datetime()})
      CREATE (m)-[:MADE]->(b)
      CREATE (b)-[:BOOKED_IN]->(r)
      WITH b
      OPTIONAL MATCH (o:Organization {organization_id: $organization_id})
      FOREACH (_ IN CASE WHEN o IS NULL THEN [] ELSE [1] END | CREATE (b)-[:BOOKED_FOR]->(o))`,
      {
        booking_id: db.int(booking_id), member_id: db.int(b.member_id), room_id: db.int(b.room_id),
        organization_id: b.organization_id === null ? null : db.int(b.organization_id),
        booking_date: b.booking_date, start_time: b.start_time, end_time: b.end_time, total_amount: b.total_amount
      });

    let payment_id = null;
    if (b.method) {
      payment_id = await nextId(run, 'SEQ_PAYMENTS');
      await run(`
        MATCH (b:Booking {booking_id: $booking_id})
        CREATE (p:Payment {payment_id: $payment_id, amount: $amount, payment_date: date(), method: $method, status: 'COMPLETED'})
        CREATE (b)-[:PAID_BY]->(p)`,
        { booking_id: db.int(booking_id), payment_id: db.int(payment_id), amount: b.total_amount, method: b.method });
    }
    return { booking_id, payment_id };
  });
}

module.exports = {
  LOCK_ROOM_CYPHER, OVERLAP_CYPHER, CALC_AMOUNT_CYPHER, ROOM_REVENUE_CYPHER, CONFLICT_MESSAGE,
  assertNoOverlap, lockRoom, createBookingAndPay
};
